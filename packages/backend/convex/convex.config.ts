import { defineApp } from "convex/server"
// TODO: Uncomment after running `pnpm install` to install @convex-dev/rate-limiter
// import rateLimiter from "@convex-dev/rate-limiter/convex.config.js"
import resend from "@convex-dev/resend/convex.config.js"
import r2 from "@convex-dev/r2/convex.config.js"
import stripe from "@convex-dev/stripe/convex.config.js"

const app = defineApp()
// TODO: Uncomment after running `pnpm install`
// app.use(rateLimiter)
app.use(resend)
app.use(r2)
app.use(stripe)

export default app

