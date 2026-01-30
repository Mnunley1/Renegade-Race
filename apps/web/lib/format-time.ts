export function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

  if (diffInHours < 1) {
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    return `${diffInMinutes}m ago`
  }
  if (diffInHours < 24) {
    return `${Math.floor(diffInHours)}h ago`
  }
  return date.toLocaleDateString()
}
