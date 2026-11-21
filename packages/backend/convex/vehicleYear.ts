/** Format validation only; the business has not chosen a model-year eligibility window. */
export function isVehicleYear(year: unknown): year is number {
  return typeof year === "number" && Number.isInteger(year) && year >= 1000 && year <= 9999
}

export const VEHICLE_YEAR_ERROR = "Enter a four-digit vehicle year"

export function requireVehicleYear(year: unknown) {
  if (!isVehicleYear(year)) throw new Error(VEHICLE_YEAR_ERROR)
}

export function formatVehicleYear(year: unknown): string {
  return isVehicleYear(year) ? String(year) : "Year unconfirmed"
}

export function formatVehicleTitle(vehicle: { year?: unknown; make: string; model: string }) {
  return `${formatVehicleYear(vehicle.year)} ${vehicle.make} ${vehicle.model}`
}
