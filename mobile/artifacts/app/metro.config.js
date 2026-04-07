const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
// pnpm workspace root is two levels up (artifacts/app → artifacts → mobile)
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Let Metro watch the whole workspace so shared packages resolve correctly.
config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Explicitly pass routerRoot to the Babel transform worker so
// expo-router's babel plugin can correctly resolve EXPO_ROUTER_APP_ROOT
// in pnpm monorepo / CI environments where the caller metadata may be
// missing the project root or router root.
const appDir = "app";
const originalGetTransformOptions = config.transformer.getTransformOptions;
config.transformer.getTransformOptions = async (...args) => {
  const base = originalGetTransformOptions
    ? await originalGetTransformOptions(...args)
    : {};
  return {
    ...base,
    transform: {
      ...(base.transform ?? {}),
      // Ensure the Babel plugin always has the router root, even in CI.
      customTransformOptions: {
        ...(base.transform?.customTransformOptions ?? {}),
        routerRoot: appDir,
      },
    },
  };
};

module.exports = config;
