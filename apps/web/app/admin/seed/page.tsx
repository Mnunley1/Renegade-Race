"use client"

import { useState } from "react"
import { useMutation } from "convex/react"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Loader2, CheckCircle2, XCircle } from "lucide-react"
import { api } from "@/lib/convex"

export default function SeedPage() {
  const seedDatabase = useMutation(api.seed.seed)
  const [isSeeding, setIsSeeding] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    data?: any
    error?: string
  } | null>(null)

  const handleSeed = async () => {
    setIsSeeding(true)
    setResult(null)

    try {
      const data = await seedDatabase({})
      setResult({ success: true, data })
    } catch (error) {
      console.error("Seed error:", error)
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Failed to seed database",
      })
    } finally {
      setIsSeeding(false)
    }
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Seed Database</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="text-muted-foreground mb-4">
              This will populate the database with fake data for development:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-4">
              <li>3 test users</li>
              <li>4 racing tracks</li>
              <li>5 vehicles with images</li>
              <li>Platform settings</li>
            </ul>
          </div>

          <Button
            onClick={handleSeed}
            disabled={isSeeding}
            size="lg"
            className="w-full"
          >
            {isSeeding ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Seeding database...
              </>
            ) : (
              "Seed Database"
            )}
          </Button>

          {result && (
            <div
              className={`rounded-lg border p-4 ${
                result.success
                  ? "border-green-500 bg-green-50 dark:bg-green-950"
                  : "border-destructive bg-destructive/10"
              }`}
            >
              <div className="flex items-center gap-2">
                {result.success ? (
                  <>
                    <CheckCircle2 className="size-5 text-green-500" />
                    <div>
                      <h3 className="font-semibold text-green-900 dark:text-green-100">
                        Database seeded successfully!
                      </h3>
                      {result.data && (
                        <div className="mt-2 text-sm text-green-800 dark:text-green-200">
                          <p>Users: {result.data.usersCreated}</p>
                          <p>Tracks: {result.data.tracksCreated}</p>
                          <p>Vehicles: {result.data.vehiclesCreated}</p>
                          <p>Images: {result.data.imagesCreated}</p>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="size-5 text-destructive" />
                    <div>
                      <h3 className="font-semibold text-destructive">Error seeding database</h3>
                      <p className="text-sm text-muted-foreground mt-1">{result.error}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-blue-500 bg-blue-50 dark:bg-blue-950 p-4">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>Development Tool:</strong> This will populate your database with test data. The seed function
              checks for existing records to avoid duplicates on subsequent runs.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

