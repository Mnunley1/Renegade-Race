import Image from "next/image"
import Link from "next/link"

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="container mx-auto px-4 sm:px-6 py-16">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-4">
          <div>
            <div className="mb-6 flex items-center gap-2.5">
              <Image
                alt="Renegade"
                className="rounded-full"
                height={28}
                src="/logo.png"
                width={28}
              />
              <h3 className="font-semibold text-foreground text-lg tracking-tight">Renegade</h3>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              The fastest way to rent track cars. Experience the thrill of racing on the track.
            </p>
          </div>

          <div>
            <h4 className="mb-6 text-sm font-semibold text-foreground">For Renters</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  href="/vehicles"
                >
                  Browse Vehicles
                </Link>
              </li>
              <li>
                <Link
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  href="/vehicles"
                >
                  How It Works
                </Link>
              </li>
              <li>
                <Link
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  href="/profile"
                >
                  My Trips
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-6 text-sm font-semibold text-foreground">For Hosts</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  href="/host"
                >
                  List Your Car
                </Link>
              </li>
              <li>
                <Link
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  href="/host"
                >
                  Host Resources
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-6 text-sm font-semibold text-foreground">Support</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  href="/help"
                >
                  Help Center
                </Link>
              </li>
              <li>
                <Link
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  href="/contact"
                >
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-8">
          <p className="text-center text-muted-foreground text-sm">
            © {new Date().getFullYear()} Renegade. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
