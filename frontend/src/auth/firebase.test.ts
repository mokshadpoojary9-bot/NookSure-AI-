import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Firebase config", () => {
  it("trims stray spaces and line breaks from every value", async () => {
    vi.stubEnv("VITE_FIREBASE_API_KEY", "key-123\n");
    vi.stubEnv("VITE_FIREBASE_AUTH_DOMAIN", " nooksure-ai.firebaseapp.com\r\n");
    vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "nooksure-ai\n");
    vi.stubEnv("VITE_FIREBASE_STORAGE_BUCKET", "nooksure-ai.appspot.com\n");
    vi.stubEnv("VITE_FIREBASE_MESSAGING_SENDER_ID", "123\n");
    vi.stubEnv("VITE_FIREBASE_APP_ID", "1:123:web:abc\n");
    vi.stubEnv("VITE_FIREBASE_MEASUREMENT_ID", "\n");
    vi.resetModules();
    const { firebaseConfig, isFirebaseConfigured } = await import("./firebase");
    expect(firebaseConfig).toEqual({
      apiKey: "key-123",
      authDomain: "nooksure-ai.firebaseapp.com",
      projectId: "nooksure-ai",
      storageBucket: "nooksure-ai.appspot.com",
      messagingSenderId: "123",
      appId: "1:123:web:abc",
    });
    expect(isFirebaseConfigured).toBe(true);
  });

  it("treats whitespace-only values as missing", async () => {
    vi.stubEnv("VITE_FIREBASE_API_KEY", " \n");
    vi.stubEnv("VITE_FIREBASE_AUTH_DOMAIN", "nooksure-ai.firebaseapp.com");
    vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "nooksure-ai");
    vi.stubEnv("VITE_FIREBASE_APP_ID", "1:123:web:abc");
    vi.resetModules();
    expect((await import("./firebase")).isFirebaseConfigured).toBe(false);
  });
});
