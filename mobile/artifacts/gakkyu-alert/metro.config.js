const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the entire monorepo so Metro can resolve workspace packages
config.watchFolders = [monorepoRoot];

// Prefer the app's own node_modules for all resolutions, then fall back to
// the monorepo root. This prevents Metro from picking up a second copy of
// React (or react-native) from the workspace-root node_modules.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Force React and react-native to always resolve from the app's node_modules,
// preventing the "multiple copies of React" error that arises in pnpm
// monorepos where React ends up in both the app and the workspace root.
const singletonModules = ["react", "react-native", "react-native/jsx-runtime"];
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (singletonModules.includes(moduleName)) {
    const resolved = require.resolve(moduleName, {
      paths: [projectRoot],
    });
    return { filePath: resolved, type: "sourceFile" };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
