/**
 * Shared constants used across the application
 */

export const COMMON_AMENITIES = [
  "GPS Navigation",
  "Bluetooth",
  "Apple CarPlay",
  "Android Auto",
  "Premium Sound System",
  "Racing Seats",
  "Roll Cage",
  "Fire Suppression System",
  "Data Logger",
  "Telemetry System",
  "Track Tires",
  "Racing Wheels",
  "Aerodynamic Package",
  "Racing Suspension",
  "Performance Exhaust",
] as const

export const SIM_RACING_PLATFORMS = [
  "iRacing",
  "Assetto Corsa Competizione",
  "Gran Turismo 7",
  "F1 24",
  "rFactor 2",
  "RaceRoom",
  "Automobilista 2",
  "Other",
] as const

export const RACING_TYPES = [
  { value: "real-world", label: "Real-World Racing" },
  { value: "sim-racing", label: "Sim Racing" },
  { value: "both", label: "Both" },
] as const

export const REAL_WORLD_CATEGORIES = [
  "GT3",
  "GT4",
  "Formula",
  "Open Wheel",
  "Endurance",
  "Time Attack",
  "Drifting",
  "Club Racing",
  "Vintage Racing",
  "Track Days",
] as const

export const SIM_RACING_CATEGORIES = [
  "iRacing",
  "Assetto Corsa Competizione",
  "Gran Turismo",
  "F1 Esports",
  "Sim Racing - GT",
  "Sim Racing - Formula",
  "Sim Racing - Endurance",
  "Sim Racing - Oval",
] as const

export const COMMON_LICENSES = ["FIA", "NASA", "SCCA", "IMSA", "HPDE", "Other"] as const

export const EXPERIENCE_LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "professional", label: "Professional" },
] as const

export const AVAILABILITY_OPTIONS = [
  { value: "single-race", label: "Single Race" },
  { value: "multi-race", label: "Multi-Race" },
  { value: "season-commitment", label: "Season Commitment" },
] as const

// File upload constants
export const MAX_FILE_SIZE_MB = 10
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
export const UPLOAD_DELAY_MS = 500

// Image upload constants
export const MAX_IMAGE_SIZE_MB = 5
export const BYTES_PER_KB = 1024
export const KB_PER_MB = 1024
export const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * KB_PER_MB * BYTES_PER_KB
