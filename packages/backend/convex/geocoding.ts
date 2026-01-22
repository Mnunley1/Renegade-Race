/**
 * Geocoding utility functions using Google Maps Geocoding API
 */

export type Address = {
  street: string
  city: string
  state: string
  zipCode: string
}

export type GeocodeResult = {
  latitude: number
  longitude: number
  formattedAddress?: string
}

/**
 * Geocode an address to get latitude and longitude coordinates
 * @param address - Address object with street, city, state, and zipCode
 * @returns GeocodeResult with latitude and longitude, or null if geocoding fails
 */
export async function geocodeAddress(address: Address): Promise<GeocodeResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY

  // If no API key is set, return null (geocoding is optional)
  if (!apiKey) {
    return null
  }

  // Construct the full address string
  const fullAddress = `${address.street}, ${address.city}, ${address.state} ${address.zipCode}`

  // Encode the address for URL
  const encodedAddress = encodeURIComponent(fullAddress)

  // Google Maps Geocoding API endpoint
  const geocodingUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`

  try {
    const response = await fetch(geocodingUrl)

    if (!response.ok) {
      return null
    }

    const data = await response.json()

    // Check if the API returned results
    if (data.status === "OK" && data.results && data.results.length > 0) {
      const result = data.results[0]
      const location = result.geometry.location

      return {
        latitude: location.lat,
        longitude: location.lng,
        formattedAddress: result.formatted_address,
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Geocode an address and return it with coordinates
 * @param address - Address object without coordinates
 * @returns Address object with latitude and longitude if geocoding succeeds
 */
export async function geocodeAddressWithCoordinates(
  address: Address
): Promise<Address & { latitude?: number; longitude?: number }> {
  const geocodeResult = await geocodeAddress(address)

  if (geocodeResult) {
    return {
      ...address,
      latitude: geocodeResult.latitude,
      longitude: geocodeResult.longitude,
    }
  }

  // Return address without coordinates if geocoding fails
  return address
}

/**
 * Calculate the distance between two coordinates using the Haversine formula
 * @param lat1 - Latitude of first point
 * @param lon1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lon2 - Longitude of second point
 * @returns Distance in miles
 */
// Constants for distance calculations
const EARTH_RADIUS_MILES = 3959
const EARTH_RADIUS_KM = 6371
const DECIMAL_PLACES = 10

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = EARTH_RADIUS_MILES
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c

  return Math.round(distance * DECIMAL_PLACES) / DECIMAL_PLACES
}

// Constants for coordinate conversion
const PI = Math.PI
const DEGREES_IN_CIRCLE = 180
const DEGREES_TO_RADIANS = PI / DEGREES_IN_CIRCLE

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * DEGREES_TO_RADIANS
}

/**
 * Calculate distance in kilometers (alternative to miles)
 * @param lat1 - Latitude of first point
 * @param lon1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lon2 - Longitude of second point
 * @returns Distance in kilometers
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = EARTH_RADIUS_KM
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c

  return Math.round(distance * DECIMAL_PLACES) / DECIMAL_PLACES
}
