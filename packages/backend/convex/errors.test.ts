import { throwError, parseErrorCode, hasErrorCode, ErrorCode } from "./errors"

describe("throwError", () => {
  it('throws with "CODE: message" format', () => {
    expect(() => throwError(ErrorCode.NOT_FOUND, "User not found")).toThrow(
      "NOT_FOUND: User not found"
    )
  })

  it("throws with just the code when no message provided", () => {
    expect(() => throwError(ErrorCode.AUTH_REQUIRED)).toThrow("AUTH_REQUIRED")
  })

  it("throws an Error instance", () => {
    try {
      throwError(ErrorCode.FORBIDDEN, "Access denied")
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toBe("FORBIDDEN: Access denied")
    }
  })

  it("logs details to console.error when provided", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {
      // no-op mock
    })
    try {
      throwError(ErrorCode.NOT_FOUND, "User not found", { userId: "123" })
    } catch {
      // expected
    }
    expect(spy).toHaveBeenCalledWith("Error NOT_FOUND:", "User not found", { userId: "123" })
    spy.mockRestore()
  })
})

describe("parseErrorCode", () => {
  it("extracts a known error code from a formatted message", () => {
    expect(parseErrorCode("AUTH_REQUIRED: Not authenticated")).toBe("AUTH_REQUIRED")
  })

  it("extracts code when message is just the code", () => {
    expect(parseErrorCode("FORBIDDEN")).toBe("FORBIDDEN")
  })

  it("returns null for unknown error codes", () => {
    expect(parseErrorCode("UNKNOWN_CODE: something")).toBeNull()
  })

  it("returns null for empty string", () => {
    expect(parseErrorCode("")).toBeNull()
  })

  it("extracts various error codes correctly", () => {
    expect(parseErrorCode("PAYMENT_FAILED: Card declined")).toBe("PAYMENT_FAILED")
    expect(parseErrorCode("RATE_LIMITED")).toBe("RATE_LIMITED")
    expect(parseErrorCode("INVALID_INPUT: Bad data")).toBe("INVALID_INPUT")
  })
})

describe("hasErrorCode", () => {
  it("returns true when error has the specified code", () => {
    expect(hasErrorCode("AUTH_REQUIRED: Please log in", ErrorCode.AUTH_REQUIRED)).toBe(true)
  })

  it("returns false when error has a different code", () => {
    expect(hasErrorCode("AUTH_REQUIRED: Please log in", ErrorCode.FORBIDDEN)).toBe(false)
  })

  it("returns false for unstructured error messages", () => {
    expect(hasErrorCode("Something went wrong", ErrorCode.INTERNAL_ERROR)).toBe(false)
  })

  it("works with code-only messages", () => {
    expect(hasErrorCode("NOT_FOUND", ErrorCode.NOT_FOUND)).toBe(true)
  })
})
