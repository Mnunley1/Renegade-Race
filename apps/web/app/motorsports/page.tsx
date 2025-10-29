import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Plus } from "lucide-react"
import Link from "next/link"
import { DriverCard } from "@/components/driver-card"
import { TeamCard } from "@/components/team-card"

export default function MotorsportsPage() {
  // Mock teams data
  const teams = [
    {
      id: "1",
      name: "Precision Racing Team",
      logoUrl: "https://images.unsplash.com/photo-1593998066526-65fcab3021a2?w=400",
      location: "Daytona Beach, FL",
      specialties: ["GT3", "Endurance", "Time Attack"],
      availableSeats: 2,
      requirements: ["FIA License", "5+ years experience"],
      description: "Professional endurance racing team with championship wins",
      contactInfo: {
        phone: "+1 (555) 123-4567",
        email: "contact@precisionracing.com",
        website: "www.precisionracing.com",
      },
    },
    {
      id: "2",
      name: "Velocity Motorsports",
      logoUrl: "https://images.unsplash.com/photo-1541364983171-a8ba01e95cfc?w=400",
      location: "Miami, FL",
      specialties: ["Formula", "Open Wheel"],
      availableSeats: 1,
      requirements: ["Racing License", "Pro-level skills"],
      description: "Top-tier open wheel racing team",
      contactInfo: {
        phone: "+1 (555) 234-5678",
        email: "join@velocityms.com",
      },
    },
    {
      id: "3",
      name: "Track Warriors",
      location: "Orlando, FL",
      specialties: ["Drifting", "Time Attack", "Track Days"],
      availableSeats: 3,
      requirements: ["Valid Driver License", "Track experience"],
      description: "Growing team focused on track performance",
      contactInfo: {
        email: "recruit@trackwarriors.com",
      },
    },
    {
      id: "4",
      name: "Elite Racing Collective",
      logoUrl: "https://images.unsplash.com/photo-1617654116429-5da33150a27d?w=400",
      location: "Tampa, FL",
      specialties: ["GT3", "GT4", "Cup Series"],
      availableSeats: 1,
      requirements: ["Advanced license", "Competitive background"],
      description: "Competitive GT racing with factory support",
      contactInfo: {
        website: "www.eliteracing.com",
        email: "drivers@eliteracing.com",
      },
    },
    {
      id: "5",
      name: "Speed Syndicate",
      location: "Jacksonville, FL",
      specialties: ["Vintage Racing", "Historic Series"],
      availableSeats: 2,
      requirements: ["Classic car experience"],
      description: "Historic racing enthusiasts and competitive vintage racing",
      contactInfo: {
        email: "info@speedsyndicate.com",
      },
    },
    {
      id: "6",
      name: "Thunderbolt Racing",
      location: "Naples, FL",
      specialties: ["Club Racing", "SCCA", "NASA"],
      availableSeats: 4,
      requirements: ["Club membership", "Safety equipment"],
      description: "Grassroots racing team supporting local drivers",
      contactInfo: {
        email: "join@thunderboltracing.com",
      },
    },
  ]

  // Mock drivers data
  const drivers = [
    {
      id: "1",
      name: "Alex Thompson",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex",
      location: "Miami, FL",
      experience: "advanced" as const,
      licenses: ["FIA", "NASA", "SCCA"],
      preferredCategories: ["GT3", "Endurance"],
      bio: "Experienced endurance racer with multiple podium finishes in GT3 series. Looking for a competitive team with professional setup.",
    },
    {
      id: "2",
      name: "Sarah Mitchell",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
      location: "Orlando, FL",
      experience: "professional" as const,
      licenses: ["FIA Super License", "F1", "GP2"],
      preferredCategories: ["Formula", "Open Wheel"],
      bio: "Professional open wheel driver with championship experience. Seeking opportunities in competitive formula racing.",
    },
    {
      id: "3",
      name: "Mike Johnson",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mike",
      location: "Tampa, FL",
      experience: "intermediate" as const,
      licenses: ["NASA", "SCCA"],
      preferredCategories: ["Time Attack", "Track Days"],
      bio: "Track day enthusiast with solid fundamentals. Looking to join a team for competitive track events and time attack competitions.",
    },
    {
      id: "4",
      name: "Emma Rodriguez",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Emma",
      location: "Daytona Beach, FL",
      experience: "advanced" as const,
      licenses: ["FIA", "IMSA"],
      preferredCategories: ["GT4", "Endurance"],
      bio: "Multi-championship winning driver in GT4 and endurance racing. Seeking factory-backed or professional team opportunities.",
    },
    {
      id: "5",
      name: "James Chen",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=James",
      location: "Naples, FL",
      experience: "beginner" as const,
      licenses: ["SCCA"],
      preferredCategories: ["Club Racing", "Track Days"],
      bio: "New to racing but passionate about track performance. Eager to learn and grow with an experienced team.",
    },
    {
      id: "6",
      name: "Lisa Park",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Lisa",
      location: "Jacksonville, FL",
      experience: "intermediate" as const,
      licenses: ["NASA", "HPDE"],
      preferredCategories: ["Drifting", "Time Attack"],
      bio: "Skilled drift and time attack competitor. Looking for a team that values consistency and technical feedback.",
    },
  ]

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="mb-2 font-bold text-3xl">Motorsports</h1>
          <p className="text-muted-foreground">Connect with racing teams and drivers</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/motorsports/profile/driver">
            <Button className="w-full sm:w-auto" variant="outline">
              <Plus className="mr-2 size-4" />
              Create Driver Profile
            </Button>
          </Link>
          <Link href="/motorsports/profile/team">
            <Button className="w-full sm:w-auto">
              <Plus className="mr-2 size-4" />
              Create Team Profile
            </Button>
          </Link>
        </div>
      </div>

      {/* Hero/Info Section */}
      <div className="mb-12 space-y-8">
        <Card className="overflow-hidden border-2 bg-gradient-to-br from-primary/5 via-background to-background">
          <CardContent className="p-8 md:p-12">
            <div className="grid gap-8 md:grid-cols-2 md:items-center">
              <div className="space-y-4">
                <Badge className="px-4 py-1 text-sm">🏎️ Motorsports Network</Badge>
                <h2 className="font-bold text-3xl md:text-4xl">
                  Connect Drivers with Racing Teams
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Renegade Motorsports is the premier platform connecting talented drivers with
                  professional racing teams. Whether you're a seasoned professional or an
                  up-and-coming driver, find your perfect match and accelerate your racing career.
                </p>
              </div>
              <div className="hidden md:block">
                <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5">
                  <span className="text-9xl">🏁</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Benefits Section */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-primary/10">
                🏁
              </div>
              <CardTitle>For Drivers</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-muted-foreground text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Discover racing opportunities with verified teams</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Showcase your experience and achievements</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Connect directly with team owners</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-primary/10">
                ⚡
              </div>
              <CardTitle>For Teams</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-muted-foreground text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Find qualified drivers matching your requirements</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Review driver profiles and credentials</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Streamline your recruitment process</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-primary/10">
                🔄
              </div>
              <CardTitle>How It Works</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2 text-muted-foreground text-sm">
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-primary">1.</span>
                  <span>Create your profile (driver or team)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-primary">2.</span>
                  <span>Browse available opportunities or candidates</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-primary">3.</span>
                  <span>Connect and take your racing to the next level</span>
                </li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs className="w-full" defaultValue="teams">
        <TabsList className="mb-8">
          <TabsTrigger value="teams">Teams Looking for Drivers ({teams.length})</TabsTrigger>
          <TabsTrigger value="drivers">Drivers Looking for Teams ({drivers.length})</TabsTrigger>
        </TabsList>

        <TabsContent className="mt-8" value="teams">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-muted-foreground text-sm">Showing {teams.length} teams</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {teams.map((team) => (
              <TeamCard key={team.id} {...team} />
            ))}
          </div>
        </TabsContent>

        <TabsContent className="mt-8" value="drivers">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-muted-foreground text-sm">Showing {drivers.length} drivers</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {drivers.map((driver) => (
              <DriverCard key={driver.id} {...driver} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
