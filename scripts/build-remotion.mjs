import {bundle} from "@remotion/bundler";
import {rm} from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const entryPoint = path.resolve(rootDir, "src/remotion/index.ts");
const outDir = path.resolve(
  rootDir,
  process.env.REMOTION_BUNDLE_DIRECTORY ?? "remotion-bundle"
);

console.log("Building Remotion bundle...");
console.log(`  Entry: ${entryPoint}`);
console.log(`  Output: ${outDir}`);

try {
  await rm(outDir, {recursive: true, force: true});

  const bundlePath = await bundle({
    entryPoint,
    outDir,
    webpackOverride: (config) => ({
      ...config,
      resolve: {
        ...(config.resolve || {}),
        alias: {
          ...(config.resolve?.alias || {}),
          "@": path.resolve(rootDir, "src")
        }
      }
    })
  });

  console.log(`Remotion bundle created at: ${bundlePath}`);
} catch (error) {
  console.error("Failed to build Remotion bundle:", error);
  process.exit(1);
}
