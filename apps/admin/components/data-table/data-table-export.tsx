export function exportToCSV<T>(
  data: T[],
  columns: { key: string; header: string; value: (row: T) => string | number }[],
  filename: string
) {
  const headers = columns.map((c) => c.header).join(",")
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const val = col.value(row)
        const str = String(val)
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      })
      .join(",")
  )

  const csv = [headers, ...rows].join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.setAttribute("href", url)
  link.setAttribute("download", `${filename}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
