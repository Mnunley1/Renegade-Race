import Link from "next/link"

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div>
            <h3 className="mb-4 font-bold text-lg">🏁 Renegade Rentals</h3>
            <p className="text-muted-foreground text-sm">
              The fastest way to rent track cars. Experience the thrill of racing on the track.
            </p>
          </div>

          <div>
            <h4 className="mb-4 font-semibold">For Renters</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link className="text-muted-foreground hover:text-primary" href="/vehicles">
                  Browse Vehicles
                </Link>
              </li>
              <li>
                <Link className="text-muted-foreground hover:text-primary" href="/vehicles">
                  How It Works
                </Link>
              </li>
              <li>
                <Link className="text-muted-foreground hover:text-primary" href="/profile">
                  My Trips
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-semibold">For Hosts</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link className="text-muted-foreground hover:text-primary" href="/host">
                  List Your Car
                </Link>
              </li>
              <li>
                <Link className="text-muted-foreground hover:text-primary" href="/host">
                  Host Resources
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-semibold">Support</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link className="text-muted-foreground hover:text-primary" href="/help">
                  Help Center
                </Link>
              </li>
              <li>
                <Link className="text-muted-foreground hover:text-primary" href="/contact">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link className="text-muted-foreground hover:text-primary" href="/safety">
                  Safety
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t pt-8">
          <p className="text-center text-muted-foreground text-sm">
            © {new Date().getFullYear()} Renegade Rentals. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
