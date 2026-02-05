import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

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
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.com https://*.clerk.accounts.dev https://*.renegaderace.com https://*.stripe.com https://*.sentry.io https://maps.googleapis.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.r2.dev https://ik.imagekit.io https://images.unsplash.com https://*.clerk.com https://*.clerk.accounts.dev https://*.renegaderace.com https://*.stripe.com; font-src 'self' data:; connect-src 'self' https://*.convex.cloud https://*.clerk.com https://*.clerk.accounts.dev https://*.renegaderace.com https://*.stripe.com https://maps.googleapis.com https://*.sentry.io wss://*.convex.cloud; media-src 'self' https://ik.imagekit.io https://*.r2.dev; frame-src https://*.stripe.com https://*.clerk.com https://*.clerk.accounts.dev https://*.renegaderace.com; worker-src 'self' blob:;",
          },
        ],
      },
    ]
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
