import "@testing-library/jest-dom/vitest"

globalThis.ResizeObserver = class ResizeObserver {
  observe(): void {
    /* jsdom stub for Radix UI */
  }
  unobserve(): void {
    /* jsdom stub for Radix UI */
  }
  disconnect(): void {
    /* jsdom stub for Radix UI */
  }
}
