
import {bundle} from "@remotion/bundler";
import {rm} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const entryPoint = path.resolve(__dirname, "../src/remotion/index.ts");
const outDir = path.resolve(
  __dirname,
  "..",
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
          "@": path.resolve(__dirname, "../src")
        }
      }
    })
  });

  console.log(`Remotion bundle created at: ${bundlePath}`);
} catch (error) {
  console.error("Failed to build Remotion bundle:", error);
  process.exitCode = 1;
}


