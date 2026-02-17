import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["convex/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@renegade/convex": path.resolve(import.meta.dirname, "./convex"),
    },
  },
})
