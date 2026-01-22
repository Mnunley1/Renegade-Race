# Geocoding Setup Guide

This guide walks you through setting up and using the geocoding functionality.

## ✅ What's Already Implemented

The geocoding system is fully implemented and includes:

1. **Automatic geocoding** for new vehicles and address updates
2. **Distance calculation** utilities (Haversine formula)
3. **Distance-based search** in vehicle queries
4. **Migration tools** for existing vehicles

## 🚀 Setup Steps

### Step 1: Get Google Maps API Key

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

### Step 2: Secure Your API Key

**Important:** Restrict your API key to prevent unauthorized use:

1. Click on your API key in the credentials list
2. Under "API restrictions", select "Restrict key"
3. Choose "Geocoding API" from the list
4. Under "Application restrictions", set appropriate restrictions
5. Save the restrictions

### Step 3: Add API Key to Convex

Add the API key to your Convex environment:

```bash
npx convex env set GOOGLE_MAPS_API_KEY your-api-key-here
```

### Step 4: Verify It's Working

1. Create a new vehicle with an address
2. Check the vehicle record in Convex dashboard
3. Verify that `address.latitude` and `address.longitude` are populated

## 📍 Geocoding Existing Vehicles

If you have existing vehicles that were created before geocoding was added, you can geocode them using the migration function.

### Option 1: Geocode All Vehicles (Recommended)

Run this from the Convex dashboard or via API:

```typescript
// In Convex dashboard, run:
await ctx.runMutation(api.geocodeExistingVehicles.geocodeAllVehicles, {
  batchSize: 10,  // Process 10 vehicles at a time
  limit: 100      // Process up to 100 vehicles (remove limit to process all)
})
```

### Option 2: Geocode a Single Vehicle

```typescript
await ctx.runMutation(api.geocodeExistingVehicles.geocodeVehicle, {
  vehicleId: "your-vehicle-id"
})
```

## 🔍 Using Distance-Based Search

The vehicle search query now supports distance-based filtering:

```typescript
// Search for vehicles within 50 miles of a location
const vehicles = await ctx.runQuery(api.vehicles.searchWithAvailability, {
  userLatitude: 34.0522,      // Los Angeles coordinates
  userLongitude: -118.2437,
  maxDistanceMiles: 50,        // Within 50 miles
  startDate: "2024-01-01",
  endDate: "2024-01-05"
})
```

The results will be:
- Filtered to only include vehicles within the specified distance
- Sorted by distance (closest first)

## 📊 Distance Calculation Utilities

You can calculate distances between coordinates:

```typescript
import { calculateDistance, calculateDistanceKm } from "./geocoding"

// Distance in miles
const distanceMiles = calculateDistance(
  34.0522, -118.2437,  // Los Angeles
  37.7749, -122.4194   // San Francisco
)
// Returns: ~380.3 miles

// Distance in kilometers
const distanceKm = calculateDistanceKm(
  34.0522, -118.2437,  // Los Angeles
  37.7749, -122.4194   // San Francisco
)
// Returns: ~612.2 km
```

## 🎯 Next Steps

### Frontend Integration

To add distance-based search to your frontend:

1. **Get user's location** (browser geolocation API)
2. **Pass coordinates to search query**:
   ```typescript
   const vehicles = useQuery(api.vehicles.searchWithAvailability, {
     userLatitude: userLat,
     userLongitude: userLng,
     maxDistanceMiles: 50
   })
   ```
3. **Display distance** in vehicle cards using the calculated distance

### Map Display

You can now display vehicles on a map using their coordinates:
- Use Google Maps JavaScript API
- Or use a library like Mapbox, Leaflet, etc.
- Plot vehicle locations using `address.latitude` and `address.longitude`

## ⚠️ Important Notes

1. **Geocoding is optional**: The app works without it. If the API key isn't set, addresses are stored without coordinates.

2. **Rate limits**: Google Maps Geocoding API has rate limits. The migration function includes delays to avoid hitting limits.

3. **Cost**: Free tier covers ~40,000 requests/month. Monitor usage in Google Cloud Console.

4. **Error handling**: Geocoding failures don't block vehicle operations. Addresses are stored even if geocoding fails.

## 📝 Files Reference

- `packages/backend/convex/geocoding.ts` - Geocoding utilities and distance calculations
- `packages/backend/convex/geocodeExistingVehicles.ts` - Migration functions
- `packages/backend/convex/vehicles.ts` - Vehicle queries with distance filtering
- `GEOCODING_IMPLEMENTATION.md` - Detailed implementation documentation

## 🆘 Troubleshooting

### Addresses not being geocoded

1. Check API key is set: `npx convex env get GOOGLE_MAPS_API_KEY`
2. Verify Geocoding API is enabled in Google Cloud Console
3. Check API key restrictions
4. Verify API quota hasn't been exceeded

### Migration not working

1. Check that vehicles have addresses
2. Verify API key is set
3. Check for errors in Convex function logs
4. Try processing smaller batches
