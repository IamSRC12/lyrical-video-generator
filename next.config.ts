import type {NextConfig} from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@remotion/renderer",
    "@remotion/bundler",
    "@remotion/compositor-linux-x64-gnu",
    "@remotion/compositor-linux-x64-musl",
    "esbuild"
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb"
    }
  }
};

export default nextConfig;
