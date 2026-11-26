/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf parsing, docx conversion and the embedding model run server-side only
  serverExternalPackages: ["unpdf", "mammoth", "@huggingface/transformers", "onnxruntime-node"],
  // storage.ts resolves files from process.cwd(), so the tracer would pull the
  // whole project into every function: the build cache (hundreds of MB) and
  // any locally stored contracts. Keep functions small and free of contracts.
  // The embedding runtime ships binaries for every platform and a browser
  // build; Vercel runs linux x64 only.
  outputFileTracingExcludes: {
    "/**": [
      "./.next/cache/**/*",
      "./storage/**/*",
      "./.git/**/*",
      "./.cache/**/*",
      "./node_modules/onnxruntime-node/bin/napi-v3/darwin/**/*",
      "./node_modules/onnxruntime-node/bin/napi-v3/win32/**/*",
      "./node_modules/onnxruntime-node/bin/napi-v3/linux/arm64/**/*",
      "./node_modules/onnxruntime-web/**/*",
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "30mb" },
  },
};

export default nextConfig;
