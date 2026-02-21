"use client"

import { AdminSidebar } from "./admin-sidebar"

export function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
        <div className="container mx-auto p-4 md:p-6">{children}</div>
      </main>
    </div>
  )
}
