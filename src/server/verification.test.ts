import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => {
  const tokens = new Map<string, { id: string; identifier: string; token: string; expiresAt: Date }>();
  const users = new Map<string, { id: string; email: string; emailVerified: Date | null }>();

  return {
    db: {
      verificationToken: {
        deleteMany: vi.fn(async ({ where }: { where: { identifier: string } }) => {
          for (const [key, val] of tokens.entries()) {
            if (val.identifier === where.identifier) tokens.delete(key);
          }
          return { count: 1 };
        }),
        create: vi.fn(async ({ data }: { data: { identifier: string; token: string; expiresAt: Date } }) => {
          const rec = { id: "tok_" + Date.now(), ...data };
          tokens.set(data.token, rec);
          return rec;
        }),
        findUnique: vi.fn(async ({ where }: { where: { token: string } }) => {
          return tokens.get(where.token) || null;
        }),
        delete: vi.fn(async ({ where }: { where: { id: string } }) => {
          for (const [key, val] of tokens.entries()) {
            if (val.id === where.id) tokens.delete(key);
          }
          return { id: where.id };
        }),
      },
      user: {
        updateMany: vi.fn(async ({ where, data }: { where: { email: string }; data: { emailVerified: Date } }) => {
          const u = users.get(where.email);
          if (u) u.emailVerified = data.emailVerified;
          return { count: u ? 1 : 0 };
        }),
      },
    },
  };
});

describe("Verification Service", () => {
  it("generates a token and verifies an email address", async () => {
    const { sendVerificationToken, verifyTokenAndEmail } = await import("./verification");
    const testEmail = "runner@example.com";

    const res = await sendVerificationToken(testEmail, "http://localhost:3000");
    expect(res.simulated).toBe(true);
    expect(res.token).toBeDefined();

    // Verify with valid token
    const verificationResult = await verifyTokenAndEmail(res.token!, testEmail);
    expect(verificationResult.success).toBe(true);

    // Using the same token again should fail because it was deleted after use
    const reVerification = await verifyTokenAndEmail(res.token!, testEmail);
    expect(reVerification.success).toBe(false);
    expect(reVerification.error).toMatch(/Invalid or expired/i);
  });

  it("fails verification if email mismatch", async () => {
    const { sendVerificationToken, verifyTokenAndEmail } = await import("./verification");
    const testEmail = "athlete@example.com";

    const res = await sendVerificationToken(testEmail);
    const verificationResult = await verifyTokenAndEmail(res.token!, "someoneelse@example.com");
    expect(verificationResult.success).toBe(false);
    expect(verificationResult.error).toMatch(/does not match/i);
  });
});
