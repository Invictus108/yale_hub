import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@modelcontextprotocol/server", "@modelcontextprotocol/client", "nodemailer"],
  // Imports use .js specifiers for the TypeScript sources. Webpack follows this alias.
  experimental: {
    extensionAlias: {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    },
  },
};

export default nextConfig;
