import { describe, expect, it } from "vitest";
import { authErrorCode, describeAuthError } from "./authService";

describe("sign-in error messages", () => {
  it("shows the real Firebase error code for unexpected failures", () => {
    expect(describeAuthError({ code: "auth/invalid-api-key" })).toBe("Sign-in didn't work (auth/invalid-api-key). Please try again.");
    expect(describeAuthError(new Error("boom"))).toBe("Sign-in didn't work (unknown). Please try again.");
  });

  it("keeps the specific messages, and stays quiet when the user closes the popup", () => {
    expect(describeAuthError({ code: "auth/unauthorized-domain" })).toMatch(/Authorized domains/);
    expect(describeAuthError({ code: "auth/popup-closed-by-user" })).toBeNull();
  });

  it("reads only a string code", () => {
    expect(authErrorCode({ code: "auth/internal-error" })).toBe("auth/internal-error");
    expect(authErrorCode({ code: 42 })).toBe("unknown");
    expect(authErrorCode(null)).toBe("unknown");
  });

  it("names the error type when there is no Firebase code", () => {
    expect(authErrorCode(new TypeError("Failed to fetch"))).toBe("TypeError");
  });
});
