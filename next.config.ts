import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@modelcontextprotocol/server", "@modelcontextprotocol/client", "nodemailer"],
};

export default nextConfig;
