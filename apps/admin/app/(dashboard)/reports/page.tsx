"use client"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Textarea } from "@workspace/ui/components/textarea"
import { useMutation, useQuery } from "convex/react"
import { AlertCircle, Car, CheckCircle2, Clock, MessageSquare, Search, User } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { api } from "@/lib/convex"

export default function ReportsPage() {
  const [statusFilter, setStatusFilter] = useState<
    "pending" | "reviewed" | "resolved" | "dismissed" | undefined
  >(undefined)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedReport, setSelectedReport] = useState<any>(null)
  const [resolveStatus, setResolveStatus] = useState("")
  const [adminNotes, setAdminNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const reports = useQuery(api.reports.getReports, {
    status: statusFilter,
  })

  const resolveReport = useMutation(api.reports.resolveReport)

  const filteredReports = reports?.filter((report: any) => {
    if (!searchQuery) {
      return true
    }
    const query = searchQuery.toLowerCase()
    return (
      report.reporter?.name?.toLowerCase().includes(query) ||
      report.reason?.toLowerCase().includes(query) ||
      report.description?.toLowerCase().includes(query)
    )
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge className="gap-1" variant="default">
            <Clock className="size-3" />
            Pending
          </Badge>
        )
      case "reviewed":
        return (
          <Badge className="gap-1" variant="secondary">
            <AlertCircle className="size-3" />
            Under Review
          </Badge>
        )
      case "resolved":
        return (
          <Badge className="gap-1" variant="default">
            <CheckCircle2 className="size-3" />
            Resolved
          </Badge>
        )
      case "dismissed":
        return <Badge variant="outline">Dismissed</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case "user":
        return <User className="size-4 text-blue-500" />
      case "vehicle":
        return <Car className="size-4 text-purple-500" />
      case "review":
        return <MessageSquare className="size-4 text-green-500" />
      default:
        return <AlertCircle className="size-4 text-muted-foreground" />
    }
  }

  const handleResolve = async () => {
    if (!(selectedReport && resolveStatus)) {
      toast.error("Please select a resolution status")
      return
    }

    setIsSubmitting(true)

    try {
      await resolveReport({
        reportId: selectedReport._id,
        status: resolveStatus as "resolved" | "dismissed",
        adminNotes: adminNotes.trim() || undefined,
      })

      toast.success("Report resolved successfully")
      setSelectedReport(null)
      setResolveStatus("")
      setAdminNotes("")
    } catch (_error) {
      toast.error("Failed to resolve report")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (reports === undefined) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-muted-foreground">Loading reports...</div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-8">
        <div>
          <h1 className="font-bold text-2xl md:text-3xl">Reports Management</h1>
          <p className="mt-2 text-muted-foreground">Review and resolve user-reported content</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>All Reports</CardTitle>
                <CardDescription>{filteredReports?.length || 0} report(s) found</CardDescription>
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="-translate-y-1/2 absolute top-1/2 left-2 size-4 text-muted-foreground" />
                  <Input
                    className="w-64 pl-8"
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search reports..."
                    value={searchQuery}
                  />
                </div>
                <Select
                  onValueChange={(value) =>
                    setStatusFilter(value === "all" ? undefined : (value as any))
                  }
                  value={statusFilter || "all"}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="reviewed">Under Review</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="dismissed">Dismissed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredReports && filteredReports.length > 0 ? (
              <div className="space-y-3">
                {filteredReports.map((report: any) => (
                  <div
                    className="cursor-pointer rounded-lg border border-border p-4 transition-colors hover:bg-accent"
                    key={report._id}
                    onClick={() => setSelectedReport(report)}
                  >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            {getStatusBadge(report.status)}
                            <div className="flex items-center gap-1">
                              {getEntityIcon(report.reportedEntity)}
                              <span className="font-medium text-sm">
                                {report.reportedEntity} Report
                              </span>
                            </div>
                          </div>
                          <p className="text-muted-foreground text-sm">
                            <strong>Reason:</strong> {report.reason.replace(/_/g, " ")}
                          </p>
                          <p className="line-clamp-2 text-muted-foreground text-sm">
                            {report.description}
                          </p>
                          <div className="flex gap-4 text-muted-foreground text-xs">
                            <span>
                              <strong>Reporter:</strong> {report.reporter?.name || "Unknown"}
                            </span>
                            <span>
                              <strong>Created:</strong>{" "}
                              {new Date(report.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">No reports found</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog onOpenChange={(open) => !open && setSelectedReport(null)} open={!!selectedReport}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Resolve Report</DialogTitle>
            <DialogDescription>
              Review the report details and take appropriate action
            </DialogDescription>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex items-center gap-2">
                  {getStatusBadge(selectedReport.status)}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reported Entity</Label>
                <div className="flex items-center gap-2">
                  {getEntityIcon(selectedReport.reportedEntity)}
                  <span className="text-sm">{selectedReport.reportedEntity}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <p className="text-sm">{selectedReport.reason.replace(/_/g, " ")}</p>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <p className="text-muted-foreground text-sm">{selectedReport.description}</p>
              </div>
              <div className="space-y-2">
                <Label>Reporter</Label>
                <p className="text-sm">{selectedReport.reporter?.name || "Unknown"}</p>
              </div>
              <div className="space-y-2">
                <Label>Created</Label>
                <p className="text-sm">{new Date(selectedReport.createdAt).toLocaleString()}</p>
              </div>

              {selectedReport.status === "pending" || selectedReport.status === "reviewed" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="resolve-status">Resolution Status</Label>
                    <Select onValueChange={setResolveStatus} value={resolveStatus}>
                      <SelectTrigger id="resolve-status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="dismissed">Dismissed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-notes">Admin Notes</Label>
                    <Textarea
                      id="admin-notes"
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Add notes about the resolution..."
                      rows={3}
                      value={adminNotes}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      disabled={isSubmitting}
                      onClick={() => setSelectedReport(null)}
                      variant="outline"
                    >
                      Cancel
                    </Button>
                    <Button disabled={isSubmitting} onClick={handleResolve}>
                      {isSubmitting ? "Submitting..." : "Resolve Report"}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {selectedReport.adminNotes && (
                    <div className="space-y-2">
                      <Label>Admin Notes</Label>
                      <p className="text-muted-foreground text-sm">{selectedReport.adminNotes}</p>
                    </div>
                  )}
                  {selectedReport.resolvedAt && (
                    <div className="space-y-2">
                      <Label>Resolved At</Label>
                      <p className="text-sm">
                        {new Date(selectedReport.resolvedAt).toLocaleString()}
                      </p>
                    </div>
                  )}
                  <div className="flex justify-end">
                    <Button onClick={() => setSelectedReport(null)} variant="outline">
                      Close
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
