import type { Metadata } from "next"
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
                    processed securely by third-party payment processors like Stripe.
                  </li>
                  <li>
                    <strong>Communication Preferences:</strong> Opt-in/out preferences for marketing emails or
                    notifications about races/track days.
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
                    to enhance your experience, analyze traffic, and serve tailored content.
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
            </ul>
          </section>

          <Separator />

          <section>
            <h2 className="mb-4 font-bold text-2xl">Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <p className="mt-2 font-medium">
              Email:{" "}
              <a className="text-primary underline" href="mailto:support@renegaderace.com">
                support@renegaderace.com
              </a>
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  )
}
