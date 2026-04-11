import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client", "@prisma/adapter-libsql", "libsql", "@libsql/darwin-arm64", "pdfkit"],
};

export default nextConfig;
