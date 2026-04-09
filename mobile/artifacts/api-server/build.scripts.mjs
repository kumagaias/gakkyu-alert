/**
 * スクリプト用ビルド (load-pref-closures 等)
 * Usage: node build.scripts.mjs
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";

globalThis.require = createRequire(import.meta.url);
const artifactDir = path.dirname(fileURLToPath(import.meta.url));

await esbuild({
  entryPoints: [path.resolve(artifactDir, "src/scripts/load-pref-closures.ts")],
  platform: "node",
  bundle: true,
  format: "esm",
  outdir: path.resolve(artifactDir, "dist/scripts"),
  outExtension: { ".js": ".mjs" },
  external: ["@aws-sdk/*"],
  sourcemap: "linked",
  banner: {
    js: `import { createRequire as __cr } from 'node:module';
globalThis.require = __cr(import.meta.url);`,
  },
  logLevel: "info",
});
