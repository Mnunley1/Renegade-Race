import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["convex/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@renegade/convex": path.resolve(__dirname, "./convex"),
    },
  },
})
