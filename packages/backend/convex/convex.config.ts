import { defineApp } from "convex/server"
import rateLimiter from "@convex-dev/rate-limiter/convex.config"
import crons from "@convex-dev/crons/convex.config"
import resend from "@convex-dev/resend/convex.config"
import r2 from "@convex-dev/r2/convex.config"
import stripe from "@convex-dev/stripe/convex.config"

const app = defineApp()
app.use(rateLimiter)
app.use(crons)
app.use(resend)
app.use(r2)
app.use(stripe)

export default app

