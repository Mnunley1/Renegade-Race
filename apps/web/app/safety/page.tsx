import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { AlertTriangle, FileText, Shield, Wrench } from "lucide-react"

export default function SafetyPage() {
  const safetyCategories = [
    {
      icon: Shield,
      title: "Required Safety Equipment",
      items: [
        "DOT-approved or Snell-certified helmet (SA2015 or newer recommended)",
        "Long pants and long-sleeved shirt (cotton or fire-resistant material)",
        "Closed-toe shoes with non-slip soles",
        "Driving gloves (recommended)",
        "HANS device or neck restraint (required for some high-performance vehicles)",
        "Fire-resistant racing suit (required for certain track events)",
      ],
    },
    {
      icon: Wrench,
      title: "Vehicle Safety Standards",
      items: [
        "Current track inspection certificate or tech inspection within 30 days",
        "Properly functioning seat belts or racing harnesses (5-point or 6-point)",
        "Fire extinguisher mounted and accessible (2.5 lb minimum)",
        "Battery properly secured and terminals covered",
        "No fluid leaks (oil, coolant, brake fluid)",
        "Working brake lights and turn signals",
        "Tires with sufficient tread depth and no visible damage",
        "Brake pads with adequate material remaining",
      ],
    },
    {
      icon: AlertTriangle,
      title: "Emergency Procedures",
      items: [
        "Familiarize yourself with track safety personnel locations and emergency exits",
        "Know the flag signals: yellow (caution), red (stop), black (return to pits)",
        "In case of mechanical failure, safely exit the racing line and signal marshals",
        "For accidents, remain in vehicle unless fire or immediate danger exists",
        "Contact track officials immediately in any emergency situation",
        "Report all incidents to the host within 1 hour of occurrence",
        "Complete an incident report form before leaving the track facility",
      ],
    },
    {
      icon: FileText,
      title: "Insurance Information",
      items: [
        "Standard auto insurance typically does NOT cover track use or racing activities",
        "Track day insurance is strongly recommended for all rentals",
        "Coverage options include liability, collision, and comprehensive for on-track incidents",
        "Host vehicles may have specific insurance requirements listed in rental terms",
        "Purchase track insurance before your event (providers: Lockton, RLI, Motorsport Reg)",
        "Renters are financially responsible for all damage during rental period",
        "Review your rental agreement's damage waiver and liability sections carefully",
      ],
    },
  ]

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-16 text-center">
        <h1 className="mb-4 font-bold text-3xl md:text-4xl lg:text-5xl">Track Day Safety</h1>
        <p className="mx-auto max-w-2xl text-muted-foreground text-xl">
          Your safety is our top priority. Review these guidelines before your track day to ensure a
          safe and enjoyable experience
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {safetyCategories.map((category) => {
          const Icon = category.icon
          return (
            <Card key={category.title}>
              <CardHeader>
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Icon className="size-6" />
                  </div>
                  <CardTitle className="text-2xl">{category.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {category.items.map((item) => (
                    <li className="flex items-start gap-2" key={item}>
                      <span className="mt-1.5 size-1.5 flex-shrink-0 rounded-full bg-primary" />
                      <span className="text-muted-foreground text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="mt-12 border border-yellow-500/30 bg-yellow-500/5">
        <CardContent className="p-8">
          <div className="flex items-start gap-4">
            <AlertTriangle className="size-8 flex-shrink-0 text-yellow-600" />
            <div>
              <h3 className="mb-2 font-bold text-lg">Important Notice</h3>
              <p className="text-muted-foreground text-sm">
                Track driving involves inherent risks. All participants must sign a liability waiver
                before accessing the track. Renegade Rentals is not responsible for injuries,
                damage, or losses incurred during track events. By renting through our platform, you
                acknowledge and accept these risks. Always drive within your skill level and follow
                all track rules and regulations.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
