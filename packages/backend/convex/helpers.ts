import type { Doc } from "./_generated/dataModel"

/**
 * Returns the configured web URL. Requires WEB_URL to be set
 * in the Convex deployment environment variables.
 */
export function getWebUrl(): string {
  const url = process.env.WEB_URL
  if (!url) {
    throw new Error("Missing required environment variable: WEB_URL")
  }
  return url
}

export function isReservationParticipant(
  reservation: Pick<Doc<"reservations">, "renterId" | "ownerId"> | null,
  subject: string
) {
  return (
    reservation !== null && (reservation.renterId === subject || reservation.ownerId === subject)
  )
}

// Return evidence is private even when an admin is viewing the enclosing dispute.
// Verify the association before joining records, including historical rows.
export function participantCompletion(
  completion: Doc<"rentalCompletions"> | null,
  reservation: Doc<"reservations"> | null,
  subject: string
) {
  if (
    !(reservation && completion) ||
    completion.reservationId !== reservation._id ||
    completion.renterId !== reservation.renterId ||
    completion.ownerId !== reservation.ownerId ||
    !isReservationParticipant(reservation, subject)
  )
    return null
  return completion
}
