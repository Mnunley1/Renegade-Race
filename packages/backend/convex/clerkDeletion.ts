import type { UserIdentity } from "convex/server"
import { createClerkClient } from "@clerk/clerk-sdk-node"

const CLERK_KEY_PATTERN = /^sk_(test|live)_/
const BACKEND = "https://api.clerk.com/v1"

function configuredIssuer() {
  const configured = process.env.CLERK_JWT_ISSUER_DOMAIN || process.env.CLERK_FRONTEND_API_URL
  if (!configured) throw new Error("Account deletion is not configured. Contact support.")
  const issuer = new URL(configured)
  if (issuer.protocol !== "https:" || issuer.pathname !== "/" || issuer.search || issuer.hash)
    throw new Error("Account deletion is not configured. Contact support.")
  return issuer.origin
}

/** Bind a fixed Clerk BAPI endpoint to this deployment's verified FAPI issuer.
 * Never accept a provider URL, secret, or target subject from the client. */
export async function deletionProvider(identity: Pick<UserIdentity, "issuer" | "subject">) {
  const issuer = configuredIssuer()
  const secret = process.env.CLERK_SECRET_KEY
  if (!(secret && CLERK_KEY_PATTERN.test(secret)) || identity.issuer !== issuer)
    throw new Error("Account deletion is not configured for this session. Contact support.")
  function request(path: string, method = "GET") {
    return fetch(`${BACKEND}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
        "User-Agent": "Renegade-account-deletion/1.0",
      },
      redirect: "error",
    })
  }
  const domainsResponse = await request("/domains")
  if (!domainsResponse.ok)
    throw new Error("Unable to verify the account provider. Please retry later.")
  const domains = (await domainsResponse.json()) as { data?: { frontend_api_url?: string }[] }
  if (
    !domains.data?.some((domain) => {
      try {
        return new URL(domain.frontend_api_url ?? "").origin === issuer
      } catch {
        return false
      }
    })
  )
    throw new Error("Account provider does not match this application. Contact support.")
  const instanceResponse = await request("/instance")
  if (!instanceResponse.ok)
    throw new Error("Unable to verify the account provider. Please retry later.")
  const instance = (await instanceResponse.json()) as { environment_type?: string; id?: string }
  const expectedMode = secret.startsWith("sk_live_") ? "production" : "development"
  if (
    instance.environment_type !== expectedMode ||
    !process.env.CLERK_INSTANCE_ID ||
    process.env.CLERK_INSTANCE_ID !== instance.id
  ) {
    throw new Error("Account provider does not match this application. Contact support.")
  }
  const subjectPath = `/users/${encodeURIComponent(identity.subject)}`
  return {
    async verifyRecentAuthentication(token: string): Promise<boolean> {
      if (!token || token.length > 16_384)
        throw new Error("Recent sign-in verification is required.")
      let claims: Awaited<ReturnType<ReturnType<typeof createClerkClient>["verifyToken"]>>
      try {
        claims = await createClerkClient({ secretKey: secret }).verifyToken(token)
      } catch {
        throw new Error("Unable to verify this sign-in. Please sign in again.")
      }
      if (
        claims.iss !== issuer ||
        claims.sub !== identity.subject ||
        typeof claims.sid !== "string" ||
        typeof claims.iat !== "number" ||
        claims.iat > Date.now() / 1000 + 5
      ) {
        throw new Error("Recent sign-in verification does not match this account.")
      }
      const sessionResponse = await request(`/sessions/${encodeURIComponent(claims.sid)}`)
      if (!sessionResponse.ok)
        throw new Error("Unable to verify this sign-in. Please sign in again.")
      const session = (await sessionResponse.json()) as {
        id?: string
        user_id?: string
        status?: string
      }
      if (
        session.id !== claims.sid ||
        session.user_id !== identity.subject ||
        session.status !== "active"
      ) {
        throw new Error("This sign-in is no longer active. Please sign in again.")
      }
      const userResponse = await request(subjectPath)
      if (!userResponse.ok) throw new Error("Unable to verify this account. Please retry.")
      const user = (await userResponse.json()) as { id?: string; two_factor_enabled?: boolean }
      if (user.id !== identity.subject || typeof user.two_factor_enabled !== "boolean")
        throw new Error("Unable to verify this account. Please retry.")
      const ages = claims.fva as unknown
      if (
        !Array.isArray(ages) ||
        ages.length !== 2 ||
        !ages.every((age) => Number.isInteger(age) && age >= -1)
      )
        return false
      const [first, second] = ages as [number, number]
      const strongest = user.two_factor_enabled || second !== -1 ? second : first
      const elapsedMinutes = Math.max(0, (Date.now() / 1000 - claims.iat) / 60)
      return strongest >= 0 && strongest + elapsedMinutes < 10
    },
    async exists() {
      const response = await request(subjectPath)
      if (response.status === 404) return false
      if (!response.ok) throw new Error("Unable to confirm account deletion. Please retry.")
      const user = (await response.json()) as { id?: string }
      if (user.id !== identity.subject)
        throw new Error("Unable to confirm account deletion. Please retry.")
      return true
    },
    async delete() {
      const response = await request(subjectPath, "DELETE")
      if (!response.ok && response.status !== 404)
        throw new Error("Account deletion is not confirmed. Please retry.")
      if (response.ok) {
        const deleted = (await response.json()) as { id?: string; deleted?: boolean }
        if (deleted.id !== identity.subject || deleted.deleted !== true)
          throw new Error("Account deletion is not confirmed. Please retry.")
      }
    },
  }
}
