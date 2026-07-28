import path from "node:path";

/**
 * Server-side rendering service.
 * The Remotion bundle must be pre-built during `npm run build:remotion`.
 * This module provides helpers for the export API route.
 */

export function getRemotionBundlePath(): string {
  return path.resolve(
    process.env.REMOTION_BUNDLE_DIRECTORY ?? "./remotion-bundle"
  );
}

export function getRenderOutputDirectory(): string {
  return path.resolve(process.env.RENDER_DIRECTORY ?? "./data/renders");
}

export function getRenderConcurrency(): string {
  return process.env.RENDER_CONCURRENCY ?? "75%";
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
