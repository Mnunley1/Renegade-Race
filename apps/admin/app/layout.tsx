import { ClerkProvider } from "@clerk/nextjs"
import { ThemeProvider } from "@workspace/ui/components/theme-provider"
import { Lato } from "next/font/google"
import type { Metadata } from "next"
import "@workspace/ui/globals.css"
import "./globals.css"
import { Providers } from "@/components/providers"

const fontBody = Lato({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["300", "400", "700"] as const,
  preload: true,
  style: "normal",
})

export const metadata: Metadata = {
  title: "Renegade Rentals - Admin Portal",
  description: "Admin portal for managing Renegade Race Rentals platform",
  robots: {
    index: false,
    follow: false,
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/icon1.png",
    other: [
      {
        rel: "icon",
        type: "image/svg+xml",
        url: "/icon0.svg",
      },
    ],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={`${fontBody.variable} font-sans antialiased`}>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            disableTransitionOnChange
            enableColorScheme
            enableSystem
          >
            <Providers>{children}</Providers>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
