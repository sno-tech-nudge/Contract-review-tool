/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf parsing and docx conversion run server-side only
  serverExternalPackages: ["unpdf", "mammoth"],
  // storage.ts resolves files from process.cwd(), so the tracer would pull the
  // whole project into every function: the build cache (hundreds of MB) and
  // any locally stored contracts. Keep functions small and free of contracts.
  outputFileTracingExcludes: {
    "/**": ["./.next/cache/**/*", "./storage/**/*", "./.git/**/*"],
  },
  experimental: {
    serverActions: { bodySizeLimit: "30mb" },
  },
};

export default nextConfig;
