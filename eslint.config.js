// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  {
    ignores: [
      "dist/**",
      "dist-*/**",
      "web-build/**",
      "backup/**",
      ".local-disabled/**",
      "convex/_generated/**",
      "supabase/functions/**",
      "marketing/**",
      "debug_help.ts",
      "deploy_sync_fix.js",
      "test-image-upload.js",
      "**/* 2.ts",
      "**/* 2.tsx",
      "**/*[ ]2.ts",
      "**/*[ ]2.tsx",
    ],
  },
  expoConfig,
  {
    // Existing screens are being migrated to the React Compiler incrementally.
    // Keep these diagnostics visible without letting legacy patterns hide
    // conventional ESLint errors in the CI gate.
    rules: {
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  }
]);
