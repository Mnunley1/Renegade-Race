"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

interface DetailPageLayoutProps {
  title: string
  badges?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
}

export function DetailPageLayout({ title, badges, actions, children }: DetailPageLayoutProps) {
  const router = useRouter()

  return (
    <div>
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-2 mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="font-bold text-2xl tracking-tight">{title}</h1>
            {badges}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </div>
      {children}
    </div>
  )
}
