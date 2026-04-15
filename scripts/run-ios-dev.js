#!/usr/bin/env node
/* global __dirname */

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const iosDir = path.join(projectRoot, 'ios');
const podfilePropertiesPath = path.join(iosDir, 'Podfile.properties.json');
const xcodeProjectPath = path.join(
  iosDir,
  'LottiBaby.xcodeproj',
  'project.pbxproj',
);
const desiredJsEngine = (process.env.LOTTI_IOS_JS_ENGINE || 'jsc').trim();
const expoAppConfigPath = path.join(projectRoot, 'app.json');
const port = String(process.env.RCT_METRO_PORT || process.env.EXPO_DEV_SERVER_PORT || '8081');
const metroBaseUrl = (
  process.env.EXPO_PACKAGER_PROXY_URL || `http://localhost:${port}`
).replace(/\/$/, '');
const forwardedArgs = process.argv.slice(2);
const warmupTimeoutMs = Number(process.env.LOTTI_IOS_WARMUP_TIMEOUT_MS || 5 * 60 * 1000);

if (!['hermes', 'jsc'].includes(desiredJsEngine)) {
  console.error(
    `[ios-dev] Unsupported LOTTI_IOS_JS_ENGINE="${desiredJsEngine}". Use "hermes" or "jsc".`,
  );
  process.exit(1);
}

const readPodfileProperties = () => {
  if (!fs.existsSync(podfilePropertiesPath)) {
    return {};
  }

  return JSON.parse(fs.readFileSync(podfilePropertiesPath, 'utf8'));
};

const writePodfileProperties = (properties) => {
  fs.writeFileSync(
    podfilePropertiesPath,
    `${JSON.stringify(properties, null, 2)}\n`,
    'utf8',
  );
};

const syncXcodeProjectHermesFlag = (useHermes) => {
  if (!fs.existsSync(xcodeProjectPath)) {
    return false;
  }

  const source = fs.readFileSync(xcodeProjectPath, 'utf8');
  const desiredValue = useHermes ? 'true' : 'false';
  const next = source.replace(/USE_HERMES = (true|false);/g, `USE_HERMES = ${desiredValue};`);

  if (next === source) {
    return false;
  }

  fs.writeFileSync(xcodeProjectPath, next, 'utf8');
  return true;
};

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: process.env,
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const runQuiet = (command, args, options = {}) =>
  spawnSync(command, args, {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
    encoding: 'utf8',
    ...options,
  });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const formatElapsed = (startedAt) => {
  const totalSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
};

const getExpoConfig = () => {
  if (!fs.existsSync(expoAppConfigPath)) {
    return {};
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(expoAppConfigPath, 'utf8'));
    return parsed.expo || {};
  } catch (error) {
    console.warn(`[ios-dev] Could not parse app.json: ${error.message}`);
    return {};
  }
};

const expoConfig = getExpoConfig();
const appSlug = String(expoConfig.slug || path.basename(projectRoot)).toLowerCase();
const appBundleIdentifier = expoConfig.ios?.bundleIdentifier || 'com.LottiBaby.app';
const devClientScheme = `exp+${appSlug}`;
const devClientUrl = `${devClientScheme}://expo-development-client/?url=${encodeURIComponent(metroBaseUrl)}`;
const bundleWarmupUrl =
  `${metroBaseUrl}/node_modules/expo-router/entry.bundle?` +
  'platform=ios&dev=true&hot=false&lazy=true&transform.routerRoot=app';

const readResponseText = async (url, timeoutMs) => {
  const response = await new Promise((resolve, reject) => {
    const request = http.get(url, resolve);
    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`Timed out after ${Math.round(timeoutMs / 1000)}s`));
    });
    request.on('error', reject);
  });
  let body = '';

  response.setEncoding('utf8');
  response.on('data', (chunk) => {
    body += chunk;
  });

  await new Promise((resolve, reject) => {
    response.on('end', resolve);
    response.on('error', reject);
  });

  return {
    statusCode: response.statusCode,
    headers: response.headers,
    body,
  };
};

const probeMetroServer = async () => {
  try {
    const response = await readResponseText(`${metroBaseUrl}/status`, 2000);
    return {
      isRunning: response.statusCode === 200 && response.body.includes('packager-status:running'),
      projectRootHeader: response.headers['x-react-native-project-root'],
    };
  } catch {
    return {
      isRunning: false,
      projectRootHeader: undefined,
    };
  }
};

const findListeningPid = () => {
  const result = runQuiet('lsof', ['-tiTCP:' + port, '-sTCP:LISTEN']);
  if (result.status !== 0) {
    return null;
  }

  const pid = Number((result.stdout || '').trim().split('\n')[0]);
  return Number.isFinite(pid) ? pid : null;
};

const waitForPortToBeReleased = async (timeoutMs = 15000) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (!findListeningPid()) {
      return;
    }
    await sleep(250);
  }

  throw new Error(`Port ${port} did not become available within ${Math.round(timeoutMs / 1000)}s.`);
};

const stopExistingMetroIfOwnedByProject = async () => {
  const probe = await probeMetroServer();
  if (!probe.isRunning) {
    return;
  }

  if (probe.projectRootHeader && path.resolve(probe.projectRootHeader) !== projectRoot) {
    console.error(
      `[ios-dev] Port ${port} is already in use by another React Native project: ${probe.projectRootHeader}`,
    );
    process.exit(1);
  }

  const pid = findListeningPid();
  if (!pid) {
    return;
  }

  console.log(`[ios-dev] Restarting existing Metro server on port ${port} (pid ${pid})...`);

  try {
    process.kill(pid, 'SIGTERM');
  } catch (error) {
    console.warn(`[ios-dev] Could not stop Metro process ${pid}: ${error.message}`);
    return;
  }

  const stopDeadline = Date.now() + 15000;
  while (Date.now() < stopDeadline) {
    const status = await probeMetroServer();
    if (!status.isRunning) {
      await waitForPortToBeReleased();
      return;
    }
    await sleep(500);
  }

  console.error(`[ios-dev] Metro on port ${port} did not stop in time.`);
  process.exit(1);
};

const waitForMetroReady = async () => {
  const startedAt = Date.now();
  const deadline = startedAt + 60000;

  while (Date.now() < deadline) {
    const status = await probeMetroServer();
    if (status.isRunning) {
      console.log(`[ios-dev] Metro is ready after ${formatElapsed(startedAt)}.`);
      return;
    }
    await sleep(1000);
  }

  throw new Error('Metro did not become ready within 60s.');
};

const isMetroPortOccupied = () => Boolean(findListeningPid());

const warmBundleUntilFirstByte = async () => {
  const startedAt = Date.now();
  console.log('[ios-dev] Warming the first iOS bundle before opening the dev client...');

  const response = await new Promise((resolve, reject) => {
    const request = http.get(bundleWarmupUrl, resolve);
    request.setTimeout(warmupTimeoutMs, () => {
      request.destroy(new Error(`Timed out after ${Math.round(warmupTimeoutMs / 1000)}s`));
    });
    request.on('error', reject);
  });

  if (response.statusCode !== 200) {
    response.resume();
    throw new Error(`Metro returned HTTP ${response.statusCode} for the bundle warmup request.`);
  }

  const progressTimer = setInterval(() => {
    console.log(
      `[ios-dev] Bundle warmup still running after ${formatElapsed(startedAt)}...`,
    );
  }, 15000);

  await new Promise((resolve, reject) => {
    const cleanup = () => {
      clearInterval(progressTimer);
      response.removeAllListeners('data');
      response.removeAllListeners('end');
      response.removeAllListeners('error');
    };

    response.once('data', (chunk) => {
      cleanup();
      if (!chunk || chunk.length === 0) {
        reject(new Error('Metro warmup request received an empty first chunk.'));
        return;
      }
      // Let Metro finish streaming the response in the background without
      // aborting the socket, otherwise the request can surface ECONNRESET.
      response.on('error', () => {});
      response.resume();
      resolve();
    });

    response.once('end', () => {
      cleanup();
      reject(new Error('Metro finished the warmup request before sending any bundle bytes.'));
    });

    response.once('error', (error) => {
      cleanup();
      reject(error);
    });
  });

  console.log(
    `[ios-dev] Bundle warmup reached first bundle bytes after ${formatElapsed(startedAt)}.`,
  );
};

const startMetro = () => {
  console.log(`[ios-dev] Starting Metro on ${metroBaseUrl}...`);
  const metroLogDir = path.join(os.tmpdir(), 'lottibaby');
  const metroLogPath = path.join(metroLogDir, 'ios-metro.log');
  fs.mkdirSync(metroLogDir, { recursive: true });
  const metroLogFd = fs.openSync(metroLogPath, 'a');

  const metroProcess = spawn(
    'npx',
    ['expo', 'start', '--dev-client', '--localhost', '--port', port],
    {
      cwd: projectRoot,
      detached: true,
      stdio: ['ignore', metroLogFd, metroLogFd],
      env: process.env,
    },
  );

  metroProcess.on('error', (error) => {
    console.error(`[ios-dev] Failed to start Metro: ${error.message}`);
  });

  metroProcess.unref();
  fs.closeSync(metroLogFd);
  console.log(`[ios-dev] Metro logs: ${metroLogPath}`);
  return metroProcess;
};

const terminateAppIfRunning = () => {
  runQuiet('xcrun', ['simctl', 'terminate', 'booted', appBundleIdentifier]);
};

const openDevClient = () => {
  console.log(`[ios-dev] Opening the dev client with ${devClientUrl}...`);
  run('xcrun', ['simctl', 'openurl', 'booted', devClientUrl]);
};

const podfileProperties = readPodfileProperties();
const previousJsEngine = podfileProperties['expo.jsEngine'];
const didChangeJsEngine = previousJsEngine !== desiredJsEngine;
const didChangeHermesBuildSetting = syncXcodeProjectHermesFlag(
  desiredJsEngine === 'hermes',
);

if (didChangeJsEngine) {
  podfileProperties['expo.jsEngine'] = desiredJsEngine;
  writePodfileProperties(podfileProperties);
  console.log(
    `[ios-dev] Updated ios/Podfile.properties.json: expo.jsEngine=${desiredJsEngine}`,
  );
}

if (didChangeHermesBuildSetting) {
  console.log(
    `[ios-dev] Updated Xcode build setting USE_HERMES=${desiredJsEngine === 'hermes' ? 'true' : 'false'}`,
  );
}

if (didChangeJsEngine || didChangeHermesBuildSetting) {
  console.log('[ios-dev] Running pod install to apply the JS engine change...');
  run('pod', ['install'], { cwd: iosDir });
}

const runMain = async () => {
  await stopExistingMetroIfOwnedByProject();

  const metroStatus = await probeMetroServer();
  if (metroStatus.isRunning) {
    console.log('[ios-dev] Reusing Metro that is already running on localhost.');
  } else if (isMetroPortOccupied()) {
    console.log('[ios-dev] Port 8081 is already occupied; waiting for the existing Metro process to answer.');
  } else {
    startMetro();
  }
  await waitForMetroReady();
  const warmBundlePromise = warmBundleUntilFirstByte();

  console.log(
    `[ios-dev] Building iOS with ${desiredJsEngine.toUpperCase()} after Metro is ready...`,
  );
  run('npx', ['expo', 'run:ios', '--no-bundler', ...forwardedArgs]);
  await warmBundlePromise;
  terminateAppIfRunning();
  await sleep(1000);
  openDevClient();
};

runMain().catch((error) => {
  if (error?.code === 'ECONNRESET') {
    console.warn('[ios-dev] Ignoring transient ECONNRESET after opening the dev client.');
    process.exit(0);
  }
  console.error(`[ios-dev] ${error.message}`);
  process.exit(1);
});
