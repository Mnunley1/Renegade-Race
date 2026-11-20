import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import SignInPage from "@/app/(auth)/sign-in/[[...sign-in]]/page"
import SignUpPage from "@/app/(auth)/sign-up/[[...sign-up]]/page"
import SsoCallbackPage from "@/app/(auth)/sso-callback/page"
import VerifyEmailPage from "@/app/(auth)/verify-email/page"

const mock = vi.hoisted(() => ({
  params: "",
  push: vi.fn(),
  setActive: vi.fn(),
  create: vi.fn(),
  prepare: vi.fn(),
  verify: vi.fn(),
  oauth: vi.fn(),
  callback: vi.fn(),
}))
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mock.params),
  useRouter: () => ({ push: mock.push }),
}))
vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({ isSignedIn: false, isLoaded: true }),
  useSignIn: () => ({
    isLoaded: true,
    setActive: mock.setActive,
    signIn: { create: mock.create, authenticateWithRedirect: mock.oauth },
  }),
  useSignUp: () => ({
    isLoaded: true,
    setActive: mock.setActive,
    signUp: {
      create: mock.create,
      unverifiedFields: ["email_address"],
      prepareEmailAddressVerification: mock.prepare,
      attemptEmailAddressVerification: mock.verify,
      authenticateWithRedirect: mock.oauth,
    },
  }),
  AuthenticateWithRedirectCallback: (props: unknown) => {
    mock.callback(props)
    return <p>Completing sign in</p>
  },
}))
vi.mock("@/components/auth/otp-input", () => ({
  OtpInput: ({ onChange, value }: { onChange: (value: string) => void; value: string }) => (
    <input
      aria-label="Verification code"
      onChange={(e) => onChange(e.target.value)}
      value={value}
    />
  ),
}))
const GOOGLE_BUTTON = /Continue with Google/
const returnPath = "/checkout?vehicleId=vehicle&resume=1"
const query = `redirect_url=${encodeURIComponent(returnPath)}`
beforeEach(() => {
  vi.clearAllMocks()
  mock.params = query
  mock.create.mockResolvedValue({ status: "complete", createdSessionId: "session" })
  mock.verify.mockResolvedValue({ status: "complete", createdSessionId: "session" })
  mock.prepare.mockResolvedValue(undefined)
  mock.setActive.mockResolvedValue(undefined)
})
afterEach(cleanup)

it.each([
  SignInPage,
  SignUpPage,
])("preserves a validated checkout return through account crosslinks and Google", (Page) => {
  render(<Page />)
  const destination = Page === SignInPage ? "/sign-up" : "/sign-in"
  const links = screen.getAllByRole("link")
  expect(
    links.some(
      (link) =>
        link.getAttribute("href") ===
        `${destination}?redirect_url=%2Fcheckout%3FvehicleId%3Dvehicle%26resume%3D1`
    )
  ).toBe(true)
  fireEvent.click(screen.getByRole("button", { name: GOOGLE_BUTTON }))
  expect(mock.oauth).toHaveBeenCalledWith({
    strategy: "oauth_google",
    redirectUrl: "/sso-callback?redirect_url=%2Fcheckout%3FvehicleId%3Dvehicle%26resume%3D1",
    redirectUrlComplete: returnPath,
  })
})
it("preserves the destination while creating an account that requires email verification", async () => {
  mock.create.mockResolvedValue({ status: "missing_requirements" })
  render(<SignUpPage />)
  fireEvent.click(screen.getByRole("checkbox"))
  fireEvent.submit(screen.getByRole("button", { name: "Create account" }).closest("form")!)
  await waitFor(() => expect(mock.prepare).toHaveBeenCalledWith({ strategy: "email_code" }))
  expect(mock.push).toHaveBeenCalledWith(
    "/verify-email?redirect_url=%2Fcheckout%3FvehicleId%3Dvehicle%26resume%3D1"
  )
})
it("returns a completed signup to checkout after activating the session", async () => {
  render(<SignUpPage />)
  fireEvent.click(screen.getByRole("checkbox"))
  fireEvent.submit(screen.getByRole("button", { name: "Create account" }).closest("form")!)
  await waitFor(() => expect(mock.push).toHaveBeenCalledWith(returnPath))
  expect(mock.setActive).toHaveBeenCalledWith({ session: "session" })
})
it("preserves the destination through email verification and its back link", async () => {
  render(<VerifyEmailPage />)
  expect(screen.getByRole("link", { name: "Go back" })).toHaveAttribute(
    "href",
    "/sign-up?redirect_url=%2Fcheckout%3FvehicleId%3Dvehicle%26resume%3D1"
  )
  fireEvent.change(screen.getByRole("textbox", { name: "Verification code" }), {
    target: { value: "424242" },
  })
  fireEvent.click(screen.getByRole("button", { name: "Verify email" }))
  await waitFor(() => expect(mock.push).toHaveBeenCalledWith(returnPath))
  expect(mock.setActive).toHaveBeenCalledWith({ session: "session" })
})
it("gives OAuth completion and account transfer the same checkout destination", () => {
  render(<SsoCallbackPage />)
  expect(mock.callback).toHaveBeenCalledWith(
    expect.objectContaining({
      signInFallbackRedirectUrl: returnPath,
      signUpFallbackRedirectUrl: returnPath,
      signInUrl: "/sign-in?redirect_url=%2Fcheckout%3FvehicleId%3Dvehicle%26resume%3D1",
      signUpUrl: "/sign-up?redirect_url=%2Fcheckout%3FvehicleId%3Dvehicle%26resume%3D1",
    })
  )
})
it.each([
  SignInPage,
  SignUpPage,
])("uses a safe fallback for malicious auth return input", (Page) => {
  mock.params = "redirect_url=%2F%2Fevil.example"
  render(<Page />)
  fireEvent.click(screen.getByRole("button", { name: GOOGLE_BUTTON }))
  expect(mock.oauth).toHaveBeenCalledWith(expect.objectContaining({ redirectUrlComplete: "/" }))
})
