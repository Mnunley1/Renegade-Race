import { makeFunctionReference } from "convex/server"
import { api } from "@/lib/convex"

// The web and Convex releases have separate verified baselines. These typed
// references describe the deployed upload contract without importing a newer
// backend source tree into the web release.
type UploadGrant = { key: string; url: string }

export const onboardingImageUploadApi = {
  generateUploadUrl: makeFunctionReference<"mutation", Record<string, never>, UploadGrant>(
    "r2:generateOnboardingImageUploadUrl"
  ),
  syncMetadata: api.r2.syncMetadata,
}

export const listingImageUploadApi = {
  generateUploadUrl: makeFunctionReference<"mutation", Record<string, never>, UploadGrant>(
    "r2:generateListingImageUploadUrl"
  ),
  syncMetadata: api.r2.syncMetadata,
}
