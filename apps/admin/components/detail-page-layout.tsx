"use client"

import { Button } from "@workspace/ui/components/button"
import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"

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
        <Button className="mb-4 -ml-2" onClick={() => router.back()} size="sm" variant="ghost">
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
