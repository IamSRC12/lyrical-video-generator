import { bundle } from "@remotion/bundler";
import { rm, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const entryPoint = path.resolve(__dirname, "../src/remotion/index.ts");
const outDir = path.resolve(
  __dirname,
  "..",
  process.env.REMOTION_BUNDLE_DIRECTORY ?? "remotion-bundle"
);

console.log("Building Remotion bundle...");
console.log(`  Entry point: ${entryPoint}`);
console.log(`  Output dir:  ${outDir}`);

try {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const bundleLocation = await bundle({
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

  console.log(`Remotion bundle successfully created at: ${bundleLocation}`);
} catch (error) {
  console.error("Failed to build Remotion bundle:", error);
  process.exitCode = 1;
}
