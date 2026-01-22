import type { Metadata } from "next"
import Link from "next/link"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for RaceRentals, LLC",
}

export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="mb-4 font-bold text-4xl md:text-5xl">Privacy Policy</h1>
        <p className="text-muted-foreground text-lg">Last Updated: January 9, 2026</p>
      </div>

      <Card>
        <CardContent className="space-y-8 p-8">
          <section>
            <h2 className="mb-4 font-bold text-2xl">Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              At RaceRentals, LLC, we are committed to protecting your privacy. This Privacy Policy explains how we
              collect, use, disclose, and safeguard your personal information when you use our platform to rent vehicles
              for races, track days, or related events. By accessing or using our website and services, you agree to
              the terms outlined herein. If you disagree with any part of this policy, please do not use our service.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="mb-4 font-bold text-2xl">Information We Collect</h2>
            <p className="mb-4 text-muted-foreground leading-relaxed">
              We collect two types of information:
            </p>

            <div className="space-y-6">
              <div>
                <h3 className="mb-3 font-semibold text-xl text-foreground">
                  1. Information You Provide
                </h3>
                <ul className="ml-6 list-disc space-y-2 text-muted-foreground">
                  <li>
                    <strong>Personal Details:</strong> Name, email address, phone number, physical address, and date
                    of birth (for account creation and verification).
                  </li>
                  <li>
                    <strong>Vehicle Listing Information (if applicable):</strong> Vehicle make/model, year,
                    registration details, photos, insurance documentation, and other materials required to list a
                    vehicle for rent.
                  </li>
                  <li>
                    <strong>Payment Information:</strong> Credit/debit card details or other payment method information
                    processed securely by third-party payment processors. We do not store full payment card numbers on
                    our servers.
                  </li>
                  <li>
                    <strong>Communication Preferences:</strong> Opt-in/out preferences for marketing emails or
                    notifications about races/track days.
                  </li>
                  <li>
                    <strong>Profile Information:</strong> Driver's license information, racing experience, bio, location,
                    and other profile details you choose to share.
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="mb-3 font-semibold text-xl text-foreground">
                  2. Information We Collect Automatically
                </h3>
                <ul className="ml-6 list-disc space-y-2 text-muted-foreground">
                  <li>
                    <strong>Usage Data:</strong> IP address, browser type, device information, operating system, and
                    browsing behavior (e.g., pages visited, time spent).
                  </li>
                  <li>
                    <strong>Cookies and Tracking Technologies:</strong> We use cookies, web beacons, and similar tools
                    to enhance your experience, analyze traffic, and assist in error tracking. You can manage your
                    cookie preferences{" "}
                    <Link href="/cookie-preferences" className="text-primary underline">
                      here
                    </Link>
                    .
                  </li>
                  <li>
                    <strong>Vehicle Analytics:</strong> Views, shares, and favorites for vehicle listings (aggregated
                    data).
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <Separator />

          <section>
            <h2 className="mb-4 font-bold text-2xl">How We Use Your Information</h2>
            <p className="mb-4 text-muted-foreground leading-relaxed">
              We use the information we collect for the following purposes:
            </p>
            <ul className="ml-6 list-disc space-y-2 text-muted-foreground">
              <li>
                <strong>Providing and Improving Our Service:</strong> To facilitate vehicle rentals, match renters with
                car owners, process payments securely, resolve disputes, and improve our platform's functionality and
                user experience.
              </li>
              <li>
                <strong>Customer Support:</strong> To respond to inquiries, provide technical support, and address
                concerns related to your use of the service.
              </li>
              <li>
                <strong>Legal Compliance:</strong> To comply with applicable laws, regulations, or legal requests (e.g.,
                law enforcement investigations).
              </li>
              <li>
                <strong>Safety and Security:</strong> To verify identities, prevent fraud, and ensure the safety of
                participants in races and track events.
              </li>
              <li>
                <strong>Communication:</strong> To send you important updates about your reservations, respond to your
                messages, and (with your consent) send marketing communications.
              </li>
            </ul>
          </section>

          <Separator />

          <section>
            <h2 className="mb-4 font-bold text-2xl">Third-Party Services and Data Sharing</h2>
            <p className="mb-4 text-muted-foreground leading-relaxed">
              We use third-party services to operate our platform. These services may collect and process your data
              according to their own privacy policies. We share data with the following categories of third-party
              services:
            </p>

            <div className="space-y-4">
              <div>
                <h3 className="mb-2 font-semibold text-lg text-foreground">Authentication Services</h3>
                <ul className="ml-6 list-disc space-y-1 text-muted-foreground">
                  <li>
                    <strong>Clerk:</strong> We use Clerk for user authentication and account management. Clerk processes
                    your email, password (encrypted), and authentication tokens.{" "}
                    <a
                      href="https://clerk.com/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      View Clerk's Privacy Policy
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="mb-2 font-semibold text-lg text-foreground">Payment Processing</h3>
                <ul className="ml-6 list-disc space-y-1 text-muted-foreground">
                  <li>
                    <strong>Stripe:</strong> We use Stripe to process payments and manage payouts to vehicle owners.
                    Stripe processes payment card information, billing addresses, and transaction data. We never store
                    full payment card numbers on our servers.{" "}
                    <a
                      href="https://stripe.com/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      View Stripe's Privacy Policy
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="mb-2 font-semibold text-lg text-foreground">Backend and Database Services</h3>
                <ul className="ml-6 list-disc space-y-1 text-muted-foreground">
                  <li>
                    <strong>Convex:</strong> We use Convex as our backend database and API service. Convex stores your
                    user profile data, vehicle listings, reservations, messages, and other platform data.{" "}
                    <a
                      href="https://www.convex.dev/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      View Convex's Privacy Policy
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="mb-2 font-semibold text-lg text-foreground">Error Tracking and Analytics</h3>
                <ul className="ml-6 list-disc space-y-1 text-muted-foreground">
                  <li>
                    <strong>Sentry:</strong> We use Sentry for error tracking and performance monitoring. Sentry collects
                    error logs, performance data, and session replays (with text and media masked). This service only
                    operates if you consent to non-essential cookies.{" "}
                    <a
                      href="https://sentry.io/privacy/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      View Sentry's Privacy Policy
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="mb-2 font-semibold text-lg text-foreground">Email Services</h3>
                <ul className="ml-6 list-disc space-y-1 text-muted-foreground">
                  <li>
                    <strong>Resend:</strong> We use Resend to send transactional emails (verification emails,
                    reservation confirmations, notifications). Resend processes your email address and email content.{" "}
                    <a
                      href="https://resend.com/legal/privacy-policy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      View Resend's Privacy Policy
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="mb-2 font-semibold text-lg text-foreground">File Storage</h3>
                <ul className="ml-6 list-disc space-y-1 text-muted-foreground">
                  <li>
                    <strong>Cloudflare R2:</strong> We use Cloudflare R2 to store vehicle images, profile photos,
                    dispute documentation, and other user-uploaded files.{" "}
                    <a
                      href="https://www.cloudflare.com/privacy/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      View Cloudflare's Privacy Policy
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            <p className="mt-4 text-muted-foreground leading-relaxed">
              We do not sell your personal information to third parties. We only share data as necessary to provide our
              services and as described in this policy.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="mb-4 font-bold text-2xl">Cookies and Tracking Technologies</h2>
            <p className="mb-4 text-muted-foreground leading-relaxed">
              We use cookies and similar technologies to enhance your experience on our platform. You can manage your
              cookie preferences at any time by visiting our{" "}
              <Link href="/cookie-preferences" className="text-primary underline">
                Cookie Preferences page
              </Link>
              .
            </p>

            <div className="space-y-4">
              <div>
                <h3 className="mb-2 font-semibold text-lg text-foreground">Essential Cookies</h3>
                <p className="mb-2 text-muted-foreground text-sm">
                  These cookies are necessary for the website to function and cannot be disabled:
                </p>
                <ul className="ml-6 list-disc space-y-1 text-muted-foreground text-sm">
                  <li>
                    <strong>Authentication Cookies:</strong> Used to maintain your login session and authenticate your
                    identity (managed by Clerk).
                  </li>
                  <li>
                    <strong>Session Cookies:</strong> Used to maintain your session state and preferences during your
                    visit.
                  </li>
                  <li>
                    <strong>Security Cookies:</strong> Used to protect against fraud and ensure platform security.
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="mb-2 font-semibold text-lg text-foreground">Non-Essential Cookies</h3>
                <p className="mb-2 text-muted-foreground text-sm">
                  These cookies require your consent and can be disabled:
                </p>
                <ul className="ml-6 list-disc space-y-1 text-muted-foreground text-sm">
                  <li>
                    <strong>Error Tracking (Sentry):</strong> Used to identify and fix bugs and errors. Collects error
                    logs, performance data, and session replays (with sensitive data masked). Expires: Session-based or
                    as configured by Sentry.
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="mb-2 font-semibold text-lg text-foreground">Managing Cookies</h3>
                <p className="text-muted-foreground text-sm">
                  You can control cookies through your browser settings or by using our{" "}
                  <Link href="/cookie-preferences" className="text-primary underline">
                    Cookie Preferences
                  </Link>{" "}
                  page. Note that disabling essential cookies may impact your ability to use certain features of our
                  platform.
                </p>
              </div>
            </div>
          </section>

          <Separator />

          <section>
            <h2 className="mb-4 font-bold text-2xl">Data Retention</h2>
            <p className="mb-4 text-muted-foreground leading-relaxed">
              We retain your personal information for as long as necessary to provide our services and fulfill the
              purposes outlined in this policy, unless a longer retention period is required or permitted by law.
            </p>
            <ul className="ml-6 list-disc space-y-2 text-muted-foreground">
              <li>
                <strong>Account Information:</strong> Retained while your account is active and for a reasonable period
                after account closure to comply with legal obligations and resolve disputes.
              </li>
              <li>
                <strong>Transaction Records:</strong> Retained for at least 7 years to comply with financial and tax
                regulations.
              </li>
              <li>
                <strong>Vehicle Listings:</strong> Retained while your account is active. Deleted upon account closure
                or at your request.
              </li>
              <li>
                <strong>Messages:</strong> Retained while your account is active. May be retained for a limited period
                after account closure for dispute resolution.
              </li>
              <li>
                <strong>Error Logs:</strong> Retained for up to 90 days (if you consent to error tracking).
              </li>
            </ul>
          </section>

          <Separator />

          <section>
            <h2 className="mb-4 font-bold text-2xl">Data Security</h2>
            <p className="mb-4 text-muted-foreground leading-relaxed">
              We implement appropriate technical and organizational measures to protect your personal information:
            </p>
            <ul className="ml-6 list-disc space-y-2 text-muted-foreground">
              <li>Encryption of data in transit using SSL/TLS</li>
              <li>Secure authentication and authorization systems</li>
              <li>Regular security assessments and updates</li>
              <li>Access controls limiting data access to authorized personnel</li>
              <li>Secure payment processing through PCI DSS compliant services</li>
            </ul>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive
              to protect your data, we cannot guarantee absolute security.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="mb-4 font-bold text-2xl">Your Rights and Choices</h2>
            <p className="mb-4 text-muted-foreground leading-relaxed">
              You have certain rights regarding your personal information:
            </p>
            <ul className="ml-6 list-disc space-y-2 text-muted-foreground">
              <li>
                <strong>Access:</strong> You can access and review your personal information through your account
                settings.
              </li>
              <li>
                <strong>Correction:</strong> You can update or correct your personal information at any time through
                your account settings.
              </li>
              <li>
                <strong>Deletion:</strong> You can request deletion of your account and associated data by contacting us.
                Note that we may retain certain information as required by law or for legitimate business purposes.
              </li>
              <li>
                <strong>Cookie Preferences:</strong> You can manage your cookie preferences{" "}
                <Link href="/cookie-preferences" className="text-primary underline">
                  here
                </Link>
                .
              </li>
              <li>
                <strong>Marketing Communications:</strong> You can opt-out of marketing emails by using the unsubscribe
                link in emails or updating your preferences in account settings.
              </li>
            </ul>
          </section>

          <Separator />

          <section>
            <h2 className="mb-4 font-bold text-2xl">Children's Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our service is not intended for individuals under the age of 13. We do not knowingly collect personal
              information from children under 13. If you believe we have collected information from a child under 13,
              please contact us immediately so we can delete such information.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="mb-4 font-bold text-2xl">Changes to This Privacy Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any material changes by
              posting the new Privacy Policy on this page and updating the "Last Updated" date. We encourage you to
              review this Privacy Policy periodically for any changes.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="mb-4 font-bold text-2xl">Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions about this Privacy Policy, wish to exercise your rights regarding your personal
              information, or have concerns about our data practices, please contact us at:
            </p>
            <div className="mt-4 space-y-2">
              <p className="font-medium">
                Email:{" "}
                <a className="text-primary underline" href="mailto:support@renegaderace.com">
                  support@renegaderace.com
                </a>
              </p>
              <p className="text-muted-foreground text-sm">
                RaceRentals, LLC
                <br />
                5540 Centerview Dr Ste 204
                <br />
                PMB 914045
                <br />
                Raleigh, North Carolina 27606-8012 US
              </p>
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  )
}
