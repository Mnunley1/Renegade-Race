import Image from "next/image"
import Link from "next/link"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
      {/* Background pattern/gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/5 dark:from-primary/10 dark:via-background dark:to-primary/10" />
      
      {/* Brand header */}
      <div className="absolute top-0 right-0 left-0 z-20">
        <Link
          className="flex items-center gap-2 px-8 py-6 transition-opacity hover:opacity-80"
          href="/"
        >
          <Image alt="Renegade" className="rounded-full" height={48} src="/logo.png" width={48} />
          <span className="font-bold text-2xl text-foreground">Renegade Rentals</span>
        </Link>
      </div>

      <div className="relative z-10 w-full max-w-md px-8">{children}</div>
    </div>
  )
}
