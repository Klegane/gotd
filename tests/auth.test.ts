import { describe, expect, it } from "vitest";

import { isAdminEmail, isSessionAuthenticated, resolveUserRole } from "@/server/auth";

describe("authentication helpers", () => {
  it("rejects missing sessions", () => {
    expect(isSessionAuthenticated(null)).toBe(false);
  });

  it("rejects sessions without a user id", () => {
    expect(
      isSessionAuthenticated({
        expires: new Date().toISOString(),
        user: {
          name: "Ada"
        }
      } as never)
    ).toBe(false);
  });

  it("accepts sessions with a stable local user id", () => {
    expect(
      isSessionAuthenticated({
        expires: new Date().toISOString(),
        user: {
          id: "user_123",
          email: "ada@example.com"
        }
      } as never)
    ).toBe(true);
  });

  it("matches admin emails case-insensitively", () => {
    expect(isAdminEmail("Ada@Example.com", ["ada@example.com"])).toBe(true);
    expect(isAdminEmail("grace@example.com", ["ada@example.com"])).toBe(false);
  });

  it("promotes configured admin emails without demoting existing admins", () => {
    expect(resolveUserRole("ada@example.com", "user", ["ada@example.com"])).toBe("admin");
    expect(resolveUserRole("grace@example.com", "admin", [])).toBe("admin");
    expect(resolveUserRole("grace@example.com", "user", [])).toBe("user");
  });
});
