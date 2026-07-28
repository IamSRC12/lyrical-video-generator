import fs from "node:fs";
import path from "node:path";
import {
  getProjectRootDir,
  getRemotionBundlePath,
  getOrBuildRemotionBundle
} from "./remotion-bundle-helper";

export {
  getProjectRootDir,
  getRemotionBundlePath,
  getOrBuildRemotionBundle
};

export function getRenderOutputDirectory(): string {
  return path.resolve(
    getProjectRootDir(),
    process.env.RENDER_DIRECTORY ?? "./data/renders"
  );
}

export function getRenderConcurrency(): string | number {
  const val = process.env.RENDER_CONCURRENCY?.trim();
  if (!val) return "50%";
  if (/^\d+%$/.test(val)) return val;

  const parsedNum = parseInt(val, 10);
  if (Number.isInteger(parsedNum) && parsedNum > 0) {
    return parsedNum;
  }

  return "50%";
}

export function getBrowserExecutable(): string | undefined {
  const chromiumPath = process.env.CHROMIUM_PATH?.trim();
  if (chromiumPath && fs.existsSync(chromiumPath)) {
    return chromiumPath;
  }
  return undefined;
}

export type RenderRequest = {
  projectJson: string;
  outputFilename: string;
};

export type RenderResult = {
  filePath: string;
  url: string;
  durationMs: number;
};
