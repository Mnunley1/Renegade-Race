import Image from "next/image"
import Link from "next/link"
import { Facebook, Instagram, Twitter, Youtube } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="container mx-auto px-4 sm:px-6 py-12">
        <div className="flex flex-col items-center gap-8 md:flex-row md:justify-between">
          <div className="flex items-center gap-2.5">
            <Image
              alt="Renegade"
              className="rounded-full"
              height={24}
              src="/logo.png"
              width={24}
            />
            <h3 className="font-semibold text-foreground text-base tracking-tight">Renegade</h3>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-6 text-sm">
            <Link
              className="text-muted-foreground transition-colors hover:text-foreground"
              href="/vehicles"
            >
              Browse Vehicles
            </Link>
            <Link
              className="text-muted-foreground transition-colors hover:text-foreground"
              href="/help"
            >
              Help Center
            </Link>
            <Link
              className="text-muted-foreground transition-colors hover:text-foreground"
              href="/contact"
            >
              Contact Us
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <Link
              aria-label="Instagram"
              className="text-muted-foreground transition-colors hover:text-foreground"
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Instagram className="size-5" />
            </Link>
            <Link
              aria-label="Twitter"
              className="text-muted-foreground transition-colors hover:text-foreground"
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Twitter className="size-5" />
            </Link>
            <Link
              aria-label="Facebook"
              className="text-muted-foreground transition-colors hover:text-foreground"
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Facebook className="size-5" />
            </Link>
            <Link
              aria-label="YouTube"
              className="text-muted-foreground transition-colors hover:text-foreground"
              href="https://youtube.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Youtube className="size-5" />
            </Link>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-8">
          <p className="text-center text-muted-foreground text-sm">
            © {new Date().getFullYear()} Renegade. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
