"use client"

import { useUser } from "@clerk/nextjs"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { useQuery } from "convex/react"
import { api } from "@/lib/convex"
import { Authenticated } from "convex/react"

export default function DebugPage() {
  const { user, isLoaded } = useUser()
  const isAdmin = useQuery(api.admin.isAdmin)

  if (!isLoaded) {
    return <div>Loading...</div>
  }

  return (
    <Authenticated>
      <div className="container mx-auto p-6 space-y-6">
        <h1 className="font-bold text-3xl">Debug Info</h1>

        <Card>
          <CardHeader>
            <CardTitle>Clerk User Info</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-auto rounded bg-muted p-4 text-sm">
              {JSON.stringify(
                {
                  id: user?.id,
                  email: user?.emailAddresses?.[0]?.emailAddress,
                  publicMetadata: user?.publicMetadata,
                  unsafeMetadata: user?.unsafeMetadata,
                  organizationMemberships: user?.organizationMemberships,
                },
                null,
                2
              )}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Convex Admin Check</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>
              <strong>Is Admin (from Convex):</strong>{" "}
              {isAdmin === undefined ? "Loading..." : String(isAdmin)}
            </p>
            <p>
              <strong>Role from Clerk publicMetadata:</strong>{" "}
              {(user?.publicMetadata as Record<string, unknown>)?.role || "Not found"}
            </p>
            <p>
              <strong>Org Role:</strong>{" "}
              {user?.organizationMemberships?.[0]?.role || "Not found"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Important: Clerk Session Token Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              For the admin role to work, you need to configure your Clerk session token to include
              the public metadata. This is required for Convex to access the role.
            </p>
            <div className="rounded-lg border bg-muted p-4 space-y-3">
              <div>
                <p className="font-medium mb-2">Step 1: Configure Session Token</p>
                <ol className="list-decimal list-inside space-y-1 text-sm ml-2">
                  <li>Go to Clerk Dashboard → <strong>Sessions</strong></li>
                  <li>Click <strong>"Edit"</strong> in the "Customize session token" section</li>
                  <li>Paste this JSON into the editor:</li>
                </ol>
                <pre className="mt-2 p-2 bg-background rounded text-xs overflow-x-auto">
{`{
  "metadata": "{{user.public_metadata}}"
}`}
                </pre>
                <p className="text-xs mt-2 ml-2">Click <strong>Save</strong></p>
              </div>
              <div>
                <p className="font-medium mb-2">Step 2: Set Admin Role on User</p>
                <ol className="list-decimal list-inside space-y-1 text-sm ml-2">
                  <li>Go to Clerk Dashboard → <strong>Users</strong></li>
                  <li>Select your user account</li>
                  <li>Scroll to <strong>Metadata</strong> section</li>
                  <li>Click <strong>"Edit"</strong> on public metadata</li>
                  <li>Add: <code className="bg-background px-1 rounded text-xs">{"{ \"role\": \"admin\" }"}</code></li>
                  <li>Click <strong>Save</strong></li>
                </ol>
              </div>
              <div>
                <p className="font-medium mb-2">Step 3: Refresh Authentication</p>
                <p className="text-sm ml-2">Sign out and sign back in to refresh the token with the new metadata.</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Reference:{" "}
              <a
                href="https://clerk.com/blog/build-a-waitlist-with-clerk-user-metadata"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Clerk Blog: Build a waitlist with Clerk user metadata
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </Authenticated>
  )
}

