/**
 * Pre-builds the Remotion bundle during `npm run build:remotion`.
 * This bundle is reused by the rendering route at runtime.
 * @remotion/bundler should NOT run inside a Next.js route.
 */

import {bundle} from "@remotion/bundler";
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
  const bundlePath = await bundle({
    entryPoint,
    outDir,
    webpackOverride: (config) => config
  });

  console.log(`Remotion bundle created at: ${bundlePath}`);
} catch (error) {
  console.error("Failed to build Remotion bundle:", error);
  // Don't fail the overall build if Remotion bundle fails
  // (e.g., during CI without GPU/Chrome)
  console.warn("Continuing without Remotion bundle...");
}
