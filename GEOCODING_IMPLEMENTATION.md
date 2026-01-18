# Geocoding Implementation

This document describes the geocoding functionality that has been added to the Renegade Rentals application.

## Overview

Geocoding converts street addresses into latitude and longitude coordinates. This enables location-based features such as:
- Distance calculations between vehicles and users
- Map displays showing vehicle locations
- "Search by location" or "Near me" functionality
- Location-based sorting and filtering

## Implementation Details

### Schema Changes

The vehicle address schema has been updated to include optional latitude and longitude fields:

```typescript
address: v.optional(
  v.object({
    street: v.string(),
    city: v.string(),
    state: v.string(),
    zipCode: v.string(),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
  })
)
```

### Geocoding Service

A new geocoding utility module (`packages/backend/convex/geocoding.ts`) has been created that uses the Google Maps Geocoding API to convert addresses to coordinates.

**Key Features:**
- Uses Google Maps Geocoding API
- Gracefully handles failures (geocoding is optional)
- Returns null if API key is not set or geocoding fails
- Does not block vehicle creation/updates if geocoding fails

### Automatic Geocoding

Geocoding is automatically performed in the following scenarios:

1. **Vehicle Creation** (`createVehicleWithImages` mutation)
   - When a new vehicle is created with an address, it's automatically geocoded
   - Coordinates are stored with the address

2. **Vehicle Updates** (`update` mutation)
   - When a vehicle's address is updated, it's automatically geocoded
   - Only geocodes if address fields (street, city, state, zipCode) have changed
   - Preserves existing coordinates if only coordinates are being updated

3. **Onboarding Flow** (`saveOnboardingVehicleAddress` mutation)
   - When a host saves their vehicle address during onboarding, it's geocoded
   - Coordinates are stored in the temporary onboarding address field

## Setup Instructions

### 1. Get Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Geocoding API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Geocoding API"
   - Click "Enable"
4. Create an API key:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - Copy the API key

### 2. Secure Your API Key

**Important:** Restrict your API key to prevent unauthorized use:

1. Click on your API key in the credentials list
2. Under "API restrictions", select "Restrict key"
3. Choose "Geocoding API" from the list
4. Under "Application restrictions", set appropriate restrictions:
   - **IP addresses**: Add your Convex deployment IPs (if known)
   - **HTTP referrers**: Not applicable for server-side usage
5. Save the restrictions

### 3. Add API Key to Convex

Add the API key to your Convex environment:

```bash
npx convex env set GOOGLE_MAPS_API_KEY your-api-key-here
```

### 4. Verify It's Working

1. Create or update a vehicle with an address
2. Check the vehicle record in Convex dashboard
3. Verify that `address.latitude` and `address.longitude` are populated

## Usage

### In Code

The geocoding functions are available for use in other Convex functions:

```typescript
import { geocodeAddress, geocodeAddressWithCoordinates } from "./geocoding"

// Geocode an address and get coordinates
const result = await geocodeAddress({
  street: "123 Main St",
  city: "Los Angeles",
  state: "CA",
  zipCode: "90001"
})

if (result) {
  console.log(`Latitude: ${result.latitude}, Longitude: ${result.longitude}`)
}

// Or geocode and get address with coordinates
const addressWithCoords = await geocodeAddressWithCoordinates({
  street: "123 Main St",
  city: "Los Angeles",
  state: "CA",
  zipCode: "90001"
})
```

### Querying Vehicles with Coordinates

Once addresses are geocoded, you can query vehicles and use their coordinates:

```typescript
const vehicle = await ctx.db.get(vehicleId)
if (vehicle.address?.latitude && vehicle.address?.longitude) {
  // Use coordinates for distance calculations, map displays, etc.
  const lat = vehicle.address.latitude
  const lng = vehicle.address.longitude
}
```

## Error Handling

Geocoding is designed to be **non-blocking**:

- If the API key is not set, geocoding silently returns null
- If the API request fails, geocoding silently returns null
- If the address cannot be found, geocoding silently returns null
- Vehicle creation/updates continue normally even if geocoding fails

This ensures that:
- The app works without geocoding (if API key is not set)
- Vehicle operations are not blocked by geocoding failures
- Users can still create and update vehicles even if addresses can't be geocoded

## Cost Considerations

Google Maps Geocoding API pricing (as of 2024):
- **Free tier**: $200 credit per month (covers ~40,000 geocoding requests)
- **After free tier**: $5.00 per 1,000 requests

**Tips to minimize costs:**
- Only geocode when addresses change (already implemented)
- Cache geocoded addresses (coordinates don't change unless address changes)
- Monitor API usage in Google Cloud Console
- Set up billing alerts

## Future Enhancements

Potential future improvements:

1. **Distance-based search**: Filter vehicles by distance from user location
2. **Map display**: Show vehicles on an interactive map
3. **Route calculation**: Calculate driving distance/time to pickup location
4. **Batch geocoding**: Geocode multiple addresses at once
5. **Reverse geocoding**: Convert coordinates back to addresses
6. **Caching**: Cache geocoded results to reduce API calls

## Troubleshooting

### Addresses not being geocoded

1. **Check API key is set:**
   ```bash
   npx convex env get GOOGLE_MAPS_API_KEY
   ```

2. **Verify API is enabled:**
   - Check Google Cloud Console > APIs & Services > Enabled APIs
   - Ensure "Geocoding API" is enabled

3. **Check API key restrictions:**
   - Ensure API key is not restricted to specific IPs that don't include Convex
   - Verify "Geocoding API" is allowed in API restrictions

4. **Check API quota:**
   - Verify you haven't exceeded the free tier limit
   - Check for any billing issues

### Geocoding returns null

This is normal behavior if:
- API key is not set
- Address cannot be found
- API request fails
- API quota is exceeded

The app will continue to function normally - addresses will just be stored without coordinates.

## Related Files

- `packages/backend/convex/geocoding.ts` - Geocoding utility functions
- `packages/backend/convex/schema.ts` - Schema with address coordinates
- `packages/backend/convex/vehicles.ts` - Vehicle mutations with geocoding
- `packages/backend/convex/users.ts` - Onboarding address geocoding
- `PRODUCTION_ENV_CHECKLIST.md` - Environment variable documentation
