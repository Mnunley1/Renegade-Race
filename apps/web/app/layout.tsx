import { ClerkProvider } from "@clerk/nextjs"
import { Geist, Geist_Mono } from "next/font/google"

import "@workspace/ui/globals.css"
import { Footer } from "@/components/footer"
import { Navigation } from "@/components/navigation"
import { Providers } from "@/components/providers"

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={`${fontSans.variable} ${fontMono.variable} font-sans antialiased`}>
          <Providers>
            <div className="flex min-h-screen flex-col">
              <Navigation />
              <main className="flex-1">{children}</main>
              <Footer />
            </div>
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  )
}
