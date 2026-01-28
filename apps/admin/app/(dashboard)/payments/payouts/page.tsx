"use client";

import { useQuery } from "convex/react";
import { api } from "@renegade/backend/convex/_generated/api";
import { useState, useMemo } from "react";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { exportToCSV } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { UserAvatar } from "@/components/user-avatar";
import { LoadingState } from "@/components/loading-state";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { useRouter } from "next/navigation";
import {
  Users,
  CheckCircle,
  Clock,
  DollarSign,
  Download,
  Search,
  ExternalLink
} from "lucide-react";
import type { Column } from "@/components/data-table";

export default function PayoutsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const summary = useQuery(api.admin.getHostPayoutSummary, {
    limit: 100,
  });

  const hosts = summary ?? [];

  const filteredHosts = useMemo(() => {
    if (!search) return hosts;

    const searchLower = search.toLowerCase();
    return hosts.filter((h: { user?: { name?: string; email?: string; stripeAccountId?: string } }) => {
      const name = h.user?.name?.toLowerCase() || "";
      const email = h.user?.email?.toLowerCase() || "";
      const stripeId = h.user?.stripeAccountId?.toLowerCase() || "";

      return (
        name.includes(searchLower) ||
        email.includes(searchLower) ||
        stripeId.includes(searchLower)
      );
    });
  }, [hosts, search]);

  const stats = useMemo(() => {
    const totalHosts = hosts.length;
    const activeStripeAccounts = hosts.filter(
      (h: { stripeStatus: string }) => h.stripeStatus === "enabled"
    ).length;
    const pendingSetup = hosts.filter(
      (h: { stripeStatus: string; user?: { stripeAccountId?: string } }) => h.stripeStatus === "pending" || !h.user?.stripeAccountId
    ).length;
    const totalPaidOut = hosts.reduce((sum: number, h: { totalEarnings: number }) => sum + h.totalEarnings, 0);

    return {
      totalHosts,
      activeStripeAccounts,
      pendingSetup,
      totalPaidOut,
    };
  }, [hosts]);

  const columns: Column<typeof hosts[0]>[] = [
    {
      key: "host",
      header: "Host",
      sortable: true,
      sortValue: (row) => row.user?.name || "",
      cell: (row) => {
        if (!row.user) return <span className="text-muted-foreground">N/A</span>;
        return (
          <div className="flex items-center gap-2">
            <UserAvatar
              name={row.user.name}
              email={row.user.email}
            />
            <Button
              variant="link"
              className="p-0 h-auto"
              onClick={() => router.push(`/users/${row.user!._id}`)}
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        );
      },
    },
    {
      key: "totalEarnings",
      header: "Total Earnings",
      sortable: true,
      sortValue: (row) => row.totalEarnings,
      cell: (row) => (
        <span className="font-semibold text-green-600">
          ${(row.totalEarnings / 100).toFixed(2)}
        </span>
      ),
    },
    {
      key: "payoutCount",
      header: "Completed Payouts",
      sortable: true,
      sortValue: (row) => row.payoutCount,
      cell: (row) => <span className="font-medium">{row.payoutCount}</span>,
    },
    {
      key: "stripeStatus",
      header: "Stripe Status",
      sortable: true,
      sortValue: (row) => row.stripeStatus,
      cell: (row) => <StatusBadge status={row.stripeStatus} />,
    },
    {
      key: "stripeAccountId",
      header: "Stripe Account ID",
      cell: (row) => {
        const stripeId = row.user?.stripeAccountId;
        if (!stripeId) {
          return <span className="text-muted-foreground text-sm">Not connected</span>;
        }
        return (
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs">{stripeId.slice(0, 16)}...</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              asChild
            >
              <a
                href={`https://dashboard.stripe.com/connect/accounts/${stripeId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </div>
        );
      },
    },
  ];

  const handleExport = () => {
    type HostType = typeof filteredHosts[0];
    const exportColumns = [
      { key: "host", header: "Host", value: (h: HostType) => h.user?.name || "N/A" },
      { key: "email", header: "Email", value: (h: HostType) => h.user?.email || "N/A" },
      { key: "totalEarnings", header: "Total Earnings", value: (h: HostType) => (h.totalEarnings / 100).toFixed(2) },
      { key: "completedPayouts", header: "Completed Payouts", value: (h: HostType) => h.payoutCount },
      { key: "stripeStatus", header: "Stripe Status", value: (h: HostType) => h.stripeStatus },
      { key: "stripeAccountId", header: "Stripe Account ID", value: (h: HostType) => h.user?.stripeAccountId || "Not connected" },
    ];
    exportToCSV(filteredHosts, exportColumns, `host-payouts-${Date.now()}`);
  };

  if (!summary) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Host Payouts"
        description="Overview of host earnings and Stripe Connect status"
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Total Hosts"
          value={stats.totalHosts.toString()}
          icon={<Users className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          label="Active Stripe Accounts"
          value={stats.activeStripeAccounts.toString()}
          icon={<CheckCircle className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          label="Pending Setup"
          value={stats.pendingSetup.toString()}
          icon={<Clock className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          label="Total Paid Out"
          value={`$${(stats.totalPaidOut / 100).toFixed(2)}`}
          icon={<DollarSign className="h-5 w-5 text-muted-foreground" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Host Earnings Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by host name, email, or Stripe ID..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <Button onClick={handleExport} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>

            {filteredHosts.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No hosts found"
                description={
                  search
                    ? "Try adjusting your search criteria"
                    : "No hosts with earnings yet"
                }
              />
            ) : (
              <DataTable columns={columns} data={filteredHosts} getRowId={(row) => row.user?._id ?? row.totalEarnings.toString()} />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
