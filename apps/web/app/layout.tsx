import { ClerkProvider } from "@clerk/nextjs"
import { ThemeProvider } from "@workspace/ui/components/theme-provider"
import { Lato, Oxanium } from "next/font/google"
import "@workspace/ui/globals.css"
import { LayoutWrapper } from "@/components/layout-wrapper"
import { Providers } from "@/components/providers"

const fontHeader = Oxanium({
  subsets: ["latin"],
  variable: "--font-header",
  weight: "400",
  display: "swap",
  preload: true,
  style: "normal",
})

const fontBody = Lato({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["300", "400", "700"] as const,
  preload: true,
  style: "normal",
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
            defaultTheme="light"
            disableTransitionOnChange
            enableColorScheme
            enableSystem
          >
            <Providers>
              <LayoutWrapper>{children}</LayoutWrapper>
            </Providers>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
