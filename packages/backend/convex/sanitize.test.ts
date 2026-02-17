import {
  escapeHtml,
  sanitizeText,
  sanitizeMessage,
  sanitizeReview,
  sanitizeShortText,
} from "./sanitize"

describe("escapeHtml", () => {
  it("escapes ampersand", () => {
    expect(escapeHtml("a&b")).toBe("a&amp;b")
  })

  it("escapes angle brackets", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;")
  })

  it("escapes double quotes", () => {
    expect(escapeHtml('"hello"')).toBe("&quot;hello&quot;")
  })

  it("escapes single quotes", () => {
    expect(escapeHtml("it's")).toBe("it&#x27;s")
  })

  it("escapes forward slashes", () => {
    expect(escapeHtml("a/b")).toBe("a&#x2F;b")
  })

  it("escapes backticks", () => {
    expect(escapeHtml("`code`")).toBe("&#x60;code&#x60;")
  })

  it("escapes equals signs", () => {
    expect(escapeHtml("a=b")).toBe("a&#x3D;b")
  })

  it("escapes all special chars in one string", () => {
    expect(escapeHtml('&<>"\'`=/')).toBe(
      "&amp;&lt;&gt;&quot;&#x27;&#x60;&#x3D;&#x2F;"
    )
  })

  it("passes through clean strings unchanged", () => {
    expect(escapeHtml("hello world")).toBe("hello world")
    expect(escapeHtml("abc123")).toBe("abc123")
  })

  it("returns empty string for empty input", () => {
    expect(escapeHtml("")).toBe("")
  })
})

describe("sanitizeText", () => {
  it("trims whitespace and escapes HTML", () => {
    expect(sanitizeText("  <b>hello</b>  ")).toBe("&lt;b&gt;hello&lt;&#x2F;b&gt;")
  })

  it("respects maxLength", () => {
    const result = sanitizeText("hello world", 5)
    expect(result).toBe("hello")
    expect(result.length).toBe(5)
  })

  it("returns full string when under maxLength", () => {
    expect(sanitizeText("hi", 100)).toBe("hi")
  })

  it("handles empty string", () => {
    expect(sanitizeText("")).toBe("")
  })

  it("handles whitespace-only string", () => {
    expect(sanitizeText("   ")).toBe("")
  })
})

describe("sanitizeMessage", () => {
  it("sanitizes and enforces 10k char limit", () => {
    const long = "a".repeat(11_000)
    const result = sanitizeMessage(long)
    expect(result.length).toBe(10_000)
  })

  it("passes through short messages", () => {
    expect(sanitizeMessage("hello")).toBe("hello")
  })
})

describe("sanitizeReview", () => {
  it("sanitizes and enforces 5k char limit", () => {
    const long = "a".repeat(6000)
    const result = sanitizeReview(long)
    expect(result.length).toBe(5000)
  })

  it("passes through short reviews", () => {
    expect(sanitizeReview("great rental!")).toBe("great rental!")
  })
})

describe("sanitizeShortText", () => {
  it("sanitizes and enforces 500 char limit", () => {
    const long = "a".repeat(600)
    const result = sanitizeShortText(long)
    expect(result.length).toBe(500)
  })

  it("passes through short text", () => {
    expect(sanitizeShortText("John")).toBe("John")
  })
})
