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
//
// Also handle react-native sub-path imports (e.g. react-native/Libraries/...)
// directly via the file system, bypassing Metro's unstable_enablePackageExports
// logic which fails for react-native's glob-based exports patterns.
const singletonModules = ["react", "react-native", "react-native/jsx-runtime"];
const rnRoot = path.dirname(
  require.resolve("react-native/package.json", { paths: [projectRoot] })
);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (singletonModules.includes(moduleName)) {
    const resolved = require.resolve(moduleName, {
      paths: [projectRoot],
    });
    return { filePath: resolved, type: "sourceFile" };
  }
  // Resolve react-native sub-path imports directly from the package root so
  // Metro's package-exports resolution (which mishandles RN's glob patterns)
  // is bypassed.
  if (moduleName.startsWith("react-native/")) {
    const relativePath = moduleName.slice("react-native/".length);
    // Try Node require.resolve first (ignores exports field in Node 24 for
    // deep imports that have a "default" condition), otherwise fall back to
    // explicit .js path.
    try {
      const filePath = require.resolve(path.join(rnRoot, relativePath));
      return { filePath, type: "sourceFile" };
    } catch {
      const filePath = path.join(rnRoot, `${relativePath}.js`);
      return { filePath, type: "sourceFile" };
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
