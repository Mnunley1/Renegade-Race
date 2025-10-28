import { ClerkProvider } from "@clerk/nextjs"
import { ThemeProvider } from "@workspace/ui/components/theme-provider"
import { Exo_2, Rubik } from "next/font/google"
import "@workspace/ui/globals.css"
import { Footer } from "@/components/footer"
import { Navigation } from "@/components/navigation"
import { Providers } from "@/components/providers"

const fontHeader = Exo_2({
  subsets: ["latin"],
  variable: "--font-header",
})

const fontBody = Rubik({
  subsets: ["latin"],
  variable: "--font-body",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={`${fontHeader.variable} ${fontBody.variable} font-sans antialiased`}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            disableTransitionOnChange
            enableColorScheme
            enableSystem
          >
            <Providers>
              <div className="flex min-h-screen flex-col">
                <Navigation />
                <main className="flex-1">{children}</main>
                <Footer />
              </div>
            </Providers>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
