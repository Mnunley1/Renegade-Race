import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

export default function HelpPage() {
  const faqs = [
    {
      category: "Getting Started",
      questions: [
        {
          question: "How do I create an account?",
          answer:
            "Click 'Sign Up' in the top right corner. You'll need a valid email address and to complete our identity verification process.",
        },
        {
          question: "What are the age requirements?",
          answer:
            "Renters must be 18 years or older with a valid driver's license. Track requirements vary by location.",
        },
        {
          question: "How do I search for vehicles?",
          answer:
            "Use the search bar at the top or visit the Vehicles page. Filter by location, dates, and vehicle type to find your perfect track car.",
        },
      ],
    },
    {
      category: "Booking & Payments",
      questions: [
        {
          question: "How do I book a vehicle?",
          answer:
            "Browse available vehicles, select your dates, and click 'Book Now'. You'll need to provide payment information and accept our rental terms.",
        },
        {
          question: "What payment methods do you accept?",
          answer:
            "We accept all major credit cards, debit cards, and digital wallet payments through Stripe.",
        },
        {
          question: "Are there any booking fees?",
          answer:
            "The price you see includes the daily rental rate. Additional fees may apply for insurance, delivery, or special equipment.",
        },
        {
          question: "Can I cancel my booking?",
          answer:
            "Yes, cancellation policies vary by host and rental duration. Check the cancellation policy listed on each vehicle's details page.",
        },
      ],
    },
    {
      category: "Vehicle & Safety",
      questions: [
        {
          question: "What safety equipment is required?",
          answer:
            "All renters must have proper safety equipment including a DOT-approved helmet, appropriate clothing, and depending on the vehicle, additional safety gear may be required.",
        },
        {
          question: "Are vehicles track-ready?",
          answer:
            "All vehicles listed on Renegade have been verified as track-ready by their hosts. We require basic safety inspections before listing.",
        },
        {
          question: "What if the vehicle has mechanical issues?",
          answer:
            "Contact us immediately. We'll work with the host to provide a replacement vehicle or full refund depending on the circumstances.",
        },
        {
          question: "Is insurance included?",
          answer:
            "Track insurance is included with all rentals. We recommend reviewing the policy details and considering additional coverage for high-value vehicles.",
        },
      ],
    },
    {
      category: "Hosting",
      questions: [
        {
          question: "How do I become a host?",
          answer:
            "Visit our host signup page, complete the application process, and verify your vehicle. We'll guide you through the entire onboarding process.",
        },
        {
          question: "What are the requirements for hosting?",
          answer:
            "You need a track-ready vehicle that passes our safety inspection, valid insurance, and to complete our host verification process.",
        },
        {
          question: "How do I get paid?",
          answer:
            "Payments are processed through our secure platform and deposited to your linked bank account within 24-48 hours after each rental completes.",
        },
        {
          question: "How much can I earn?",
          answer:
            "Earnings vary based on your vehicle, location, and demand. Many hosts earn $500-$2000 per weekend rental.",
        },
      ],
    },
  ]

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-16 text-center">
        <h1 className="mb-4 font-bold text-4xl md:text-5xl">Help Center</h1>
        <p className="mx-auto max-w-2xl text-muted-foreground text-xl">
          Find answers to common questions and learn how to make the most of Renegade
        </p>
      </div>

      {/* FAQ by Category */}
      <div className="space-y-8">
        {faqs.map((category) => (
          <Card key={category.category}>
            <CardContent className="p-6">
              <h2 className="mb-6 font-bold text-2xl">{category.category}</h2>
              <Accordion className="w-full" collapsible type="single">
                {category.questions.map((faq, index) => (
                  <AccordionItem key={`${category.category}-${index}`} value={`item-${index}`}>
                    <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                    <AccordionContent>
                      <p className="text-muted-foreground">{faq.answer}</p>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Contact CTA */}
      <Card className="mt-16 border-2">
        <CardContent className="p-12 text-center">
          <h2 className="mb-4 font-bold text-2xl">Still need help?</h2>
          <p className="mb-6 text-muted-foreground">
            Can't find what you're looking for? Our support team is here to help.
          </p>
          <Link href="/contact">
            <Button className="gap-2" size="lg">
              Contact Support
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
