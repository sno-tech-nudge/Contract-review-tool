/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf parsing and docx conversion run server-side only
  serverExternalPackages: ["unpdf", "mammoth"],
  experimental: {
    serverActions: { bodySizeLimit: "30mb" },
  },
};

export default nextConfig;
