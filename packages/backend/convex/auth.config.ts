import { AuthConfig } from "convex/server"

export default {
  providers: [
    {
      // Use CLERK_JWT_ISSUER_DOMAIN environment variable
      // This should be set to your Clerk Frontend API URL
      // In development: https://verb-noun-00.clerk.accounts.dev
      // In production: https://clerk.<your-domain>.com
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN || process.env.CLERK_FRONTEND_API_URL,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig
