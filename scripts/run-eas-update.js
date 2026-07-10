const path = require('path');
const { spawn } = require('child_process');
const { cleanDist, distPath } = require('./prep-eas-update');

function readOption(args, longOption, shortOption) {
  const longPrefix = `${longOption}=`;
  const shortPrefix = shortOption ? `${shortOption}=` : null;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === longOption || argument === shortOption) return args[index + 1] ?? null;
    if (argument.startsWith(longPrefix)) return argument.slice(longPrefix.length);
    if (shortPrefix && argument.startsWith(shortPrefix)) return argument.slice(shortPrefix.length);
  }

  return null;
}

function validateUpdateArgs(args) {
  const channel = readOption(args, '--channel');
  const environment = readOption(args, '--environment');
  const message = readOption(args, '--message', '-m');

  if (!channel || !environment) {
    throw new Error(
      'Refusing to publish an unspecified update. Use --channel and --environment explicitly, for example: npm run update:preview -- --message "...".',
    );
  }

  if (channel !== environment) {
    throw new Error(`Channel "${channel}" must use the matching EAS environment "${channel}"; received "${environment}".`);
  }

  if (!message?.trim()) {
    throw new Error('A release message is required. Append -- --message "..." to the npm command.');
  }

  if (args.includes('--auto') || args.includes('--branch')) {
    throw new Error('Automatic branch selection is disabled. Publish to an explicit channel only.');
  }
}

function runEasUpdate(args) {
  const easBinary = process.platform === 'win32' ? 'eas.cmd' : 'eas';
  const easArgs = ['update', ...args];
  const child = spawn(easBinary, easArgs, {
    stdio: 'inherit',
    env: {
      ...process.env,
      CI: process.env.CI || '1',
    },
  });

  child.on('error', (error) => {
    console.error('Failed to launch EAS CLI:', error);
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });
}

(async () => {
  try {
    const args = process.argv.slice(2);
    validateUpdateArgs(args);
    await cleanDist();
    console.log(`Removed stale export directory: ${path.relative(process.cwd(), distPath)}`);
    runEasUpdate(args);
  } catch (error) {
    console.error('Refused to run EAS update:', error);
    process.exit(1);
  }
})();
