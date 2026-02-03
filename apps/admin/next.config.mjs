import { dirname, resolve } from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ]
  },
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
        protocol: "https",
        hostname: "**.cloudflare.com",
      },
      {
        protocol: "https",
        hostname: "**.r2.cloudflarestorage.com",
      },
    ],
  },
  // Set workspace root to avoid lockfile detection warnings
  outputFileTracingRoot: resolve(__dirname, "../.."),
  // Turbopack is now the default bundler in Next.js 16
  // Configuration for Turbopack alias resolution
  turbopack: {
    resolveAlias: {
      "@renegade/backend": resolve(__dirname, "../../packages/backend"),
    },
  },
  // Webpack config for fallback (when using --webpack flag)
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
