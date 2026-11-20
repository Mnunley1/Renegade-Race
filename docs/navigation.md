# Application navigation

The main navigation is **Rentals · Coaching · Paddock**, linking to `/vehicles`,
`/coaches`, and `/paddock`. Desktop and mobile use the same labels and order.
People and Deals are not primary tabs; existing profile and business routes
remain available through contextual links and account tools.

Signed-in tools live in the user dropdown on both desktop and mobile: My Trips,
Messages, Favorites, Hosting, Invoices, My Profile, Account Settings, and Sign Out.
Hosting keeps the existing onboarding-aware destination. Coach management remains
available in that menu. Messages retain their unread count, and notification
status remains visible in the header.

The mobile browse drawer contains primary navigation and guest authentication
links. Account tools use the same avatar menu across viewport sizes. Guest auth
links must preserve the active rental draft and validated checkout return path.

Keep the existing red-and-white racing identity. Broader page layouts, typography,
and invoice/community workflows are separate design work; navigation changes do
not establish payment or authorization readiness for REN-7.

## Workspace layout

Paddock and invoices use the shared `PageShell`/`PageHeader` treatment for
responsive width and heading spacing. Invoices opens on the sent/received list;
Create invoice explicitly reveals the form. Closing the form preserves entered
values, and only Send invoice calls the existing creation/send mutations. Invoice
amounts remain cents; zero due is displayed as zero. Invoice details link back to
Invoices without requiring the former Deals landing page.

These layouts preserve the existing payment methods and deposit rules. Card/ACH
settlement and Paddock following correctness still require REN-7 verification.
