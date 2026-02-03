"use client"

import { useCallback, useEffect, useState } from "react"

type RecentlyViewedItem = {
  id: string
  name: string
  image: string
  imageKey?: string
  pricePerDay: number
  viewedAt: number
}

const STORAGE_KEY = "renegade-recently-viewed"
const MAX_ITEMS = 10

export function useRecentlyViewed() {
  const [items, setItems] = useState<RecentlyViewedItem[]>([])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setItems(JSON.parse(stored))
      }
    } catch {
      // Ignore storage errors
    }
  }, [])

  const addItem = useCallback((item: Omit<RecentlyViewedItem, "viewedAt">) => {
    setItems((prev) => {
      const filtered = prev.filter((i) => i.id !== item.id)
      const updated = [{ ...item, viewedAt: Date.now() }, ...filtered].slice(0, MAX_ITEMS)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      } catch {
        // Ignore storage errors
      }
      return updated
    })
  }, [])

  const clearItems = useCallback(() => {
    setItems([])
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Ignore storage errors
    }
  }, [])

  return { items, addItem, clearItems }
}
