import { dirname, resolve } from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Set workspace root to avoid lockfile detection warnings
  outputFileTracingRoot: resolve(__dirname, "../.."),
  transpilePackages: ["@workspace/ui", "@renegade/backend"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "api.dicebear.com",
      },
      {
        protocol: "https",
        hostname: "ik.imgkit.net",
      },
      {
        protocol: "https",
        hostname: "ik.imagekit.io",
      },
      {
        // Cloudflare R2 public bucket URLs (pub-*.r2.dev)
        protocol: "https",
        hostname: "*.r2.dev",
      },
      {
        // Cloudflare R2 custom domains
        protocol: "https",
        hostname: "*.cloudflarestorage.com",
      },
    ],
  },
  webpack: (config) => {
    // Allow importing from backend package's generated files
    config.resolve.alias = {
      ...config.resolve.alias,
      "@renegade/backend": resolve(__dirname, "../../packages/backend"),
    }
    return config
  },
}

export default nextConfig
