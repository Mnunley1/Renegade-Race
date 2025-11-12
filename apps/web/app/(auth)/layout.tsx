import Image from "next/image"
import Link from "next/link"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white">
      <div className="w-full max-w-md px-8">
        {/* Logo centered above forms */}
        <div className="mb-8 flex justify-center">
          <Link
            className="transition-opacity hover:opacity-80"
            href="/"
          >
            <Image alt="Renegade Rentals" className="rounded-full" height={80} src="/logo.png" width={80} />
          </Link>
        </div>

        {children}
      </div>
    </div>
  )
}
