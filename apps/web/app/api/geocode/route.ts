import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address")
  if (!address) {
    return NextResponse.json({ error: "Missing address parameter" }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "Geocoding service not configured" }, { status: 500 })
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
    )
    const data = await response.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "Geocoding request failed" }, { status: 500 })
  }
}
