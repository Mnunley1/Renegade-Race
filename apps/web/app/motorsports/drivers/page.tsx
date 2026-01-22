"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function DriversPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/motorsports?tab=drivers")
  }, [router])

  return null
}
