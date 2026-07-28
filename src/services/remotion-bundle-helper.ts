import type {WebpackOverrideFn} from "@remotion/bundler";
import fs from "node:fs";
import path from "node:path";

export function getProjectRootDir(): string {
  return process.cwd();
}

export function getRemotionBundlePath(): string {
  return path.resolve(
    getProjectRootDir(),
    process.env.REMOTION_BUNDLE_DIRECTORY ?? "remotion-bundle"
  );
}

export function getRemotionEntryPoint(): string {
  return path.resolve(getProjectRootDir(), "src/remotion/index.ts");
}

export const remotionWebpackOverride: WebpackOverrideFn = (config) => ({
  ...config,
  resolve: {
    ...(config.resolve || {}),
    alias: {
      ...(config.resolve?.alias || {}),
      "@": path.resolve(getProjectRootDir(), "src")
    }
  }
});

let bundlePromise: Promise<string> | null = null;

export async function getOrBuildRemotionBundle(): Promise<string> {
  const bundlePath = getRemotionBundlePath();
  const indexHtmlPath = path.join(bundlePath, "index.html");

  const isProduction = process.env.NODE_ENV === "production";
  const bundleExists =
    fs.existsSync(bundlePath) && fs.existsSync(indexHtmlPath);

  if (isProduction && bundleExists) {
    return bundlePath;
  }

  if (bundlePromise) {
    return bundlePromise;
  }

  bundlePromise = (async () => {
    console.log(
      `[Remotion Bundler] Building bundle on-demand at: ${bundlePath}`
    );
    const {bundle} = await import("@remotion/bundler");
    const entryPoint = getRemotionEntryPoint();

    const resultPath = await bundle({
      entryPoint,
      outDir: bundlePath,
      webpackOverride: remotionWebpackOverride
    });

    console.log(
      `[Remotion Bundler] Bundle created successfully at: ${resultPath}`
    );
    return resultPath;
  })().catch((err) => {
    bundlePromise = null;
    throw err;
  });

  return bundlePromise;
}
