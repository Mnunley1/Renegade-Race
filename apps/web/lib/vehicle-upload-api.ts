import { api } from "@/lib/convex"

// Keep onboarding and listing uploads on their purpose-specific server grants.
export const onboardingImageUploadApi = {
  generateUploadUrl: api.r2.generateOnboardingImageUploadUrl,
  syncMetadata: api.r2.syncMetadata,
}

export const listingImageUploadApi = {
  generateUploadUrl: api.r2.generateListingImageUploadUrl,
  syncMetadata: api.r2.syncMetadata,
}
