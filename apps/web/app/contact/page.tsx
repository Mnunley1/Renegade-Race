"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { Handshake, Mail, Send } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle form submission
    // Form submission logic would go here
    setFormData({ name: "", email: "", subject: "", message: "" })
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const contactOptions = [
    {
      icon: Mail,
      title: "Email Us",
      description: "support@renegade.com",
      action: "mailto:support@renegade.com",
    },
  ]

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-12 text-center">
        <h1 className="mb-4 font-bold text-4xl md:text-5xl">Contact Us</h1>
        <p className="mx-auto max-w-2xl text-muted-foreground text-xl">
          Have a question or need assistance? We're here to help.
        </p>
      </div>

      {/* Customer Care Message */}
      <Card className="mb-12 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardContent className="p-8 text-center">
          <div className="mb-4 inline-flex items-center justify-center rounded-full bg-primary/10 p-3 text-primary">
            <Handshake className="size-6" />
          </div>
          <h2 className="mb-3 font-bold text-2xl">Your Experience Matters</h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            At Renegade, we're passionate about delivering exceptional track car rental experiences.
            Your satisfaction is our top priority, and we're committed to providing you with the
            support you need every step of the way. Whether you have questions about our vehicles,
            need booking assistance, or want to share feedback, we're here for you.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Send us a message</CardTitle>
              <CardDescription>
                Fill out the form below and we'll get back to you as soon as possible
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      name="name"
                      onChange={handleChange}
                      placeholder="John Doe"
                      required
                      value={formData.name}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      onChange={handleChange}
                      placeholder="john@example.com"
                      required
                      type="email"
                      value={formData.email}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    name="subject"
                    onChange={handleChange}
                    placeholder="What can we help with?"
                    required
                    value={formData.subject}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    className="min-h-32"
                    id="message"
                    name="message"
                    onChange={handleChange}
                    placeholder="Tell us more about your inquiry..."
                    required
                    value={formData.message}
                  />
                </div>
                <Button className="w-full gap-2" size="lg" type="submit">
                  Send Message
                  <Send className="size-4" />
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Get in Touch</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {contactOptions.map((option) => {
                const Icon = option.icon
                return (
                  <a
                    className="flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-accent"
                    href={option.action}
                    key={option.title}
                  >
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{option.title}</h3>
                      <p className="text-muted-foreground text-sm">{option.description}</p>
                    </div>
                  </a>
                )
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Need Help?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Check out our Help Center for answers to frequently asked questions.
              </p>
              <Link href="/help">
                <Button className="w-full" variant="outline">
                  Visit Help Center
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
