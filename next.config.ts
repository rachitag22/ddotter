import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // playwright-core and the Browserbase SDK must not be bundled into
  // serverless functions — they're too large and need native binaries.
  // They're loaded from node_modules at runtime instead.
  serverExternalPackages: ["playwright-core", "@browserbasehq/sdk"],
};

export default nextConfig;
