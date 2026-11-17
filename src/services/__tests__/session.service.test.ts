import { describe, expect, it } from "vitest";
import {
  decodeSessionToken,
  encodeSessionToken,
  renewSessionUser,
  verifyAccessKey,
} from "@/services/session.service";

describe("session.service", () => {
  it("resolves a valid member access key automatically and never leaks the key in SessionUser", async () => {
    const rawKey = "EMBS-MEM-2026-SALMA";
    const result = await verifyAccessKey(rawKey);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.redirectTo).toBe("/member");
    expect(result.user.participantType).toBe("member");
    expect(result.user.participantId).toBe("mem-101");
    expect(result.user.displayId).toBe("M001");
    expect(JSON.stringify(result)).not.toContain(rawKey);
  });

  it("resolves a valid attendee access key automatically without manual role selection", async () => {
    const rawKey = "  embs-att-2026-mariam  ";
    const result = await verifyAccessKey(rawKey);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.redirectTo).toBe("/attendee");
    expect(result.user.participantType).toBe("attendee");
    expect(result.user.participantId).toBe("att-201");
    expect(result.user.displayId).toBe("A001");
    expect(JSON.stringify(result)).not.toContain("EMBS-ATT-2026-MARIAM");
  });

  it("refuses a revoked access key distinctly from an unknown key", async () => {
    const revoked = await verifyAccessKey("EMBS-MEM-2026-REVOKED");
    expect(revoked.ok).toBe(false);
    if (!revoked.ok) {
      expect(revoked.code).toBe("REVOKED_KEY");
    }

    const unknown = await verifyAccessKey("EMBS-DOES-NOT-EXIST");
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) {
      expect(unknown.code).toBe("INVALID_KEY");
    }

    const empty = await verifyAccessKey("   ");
    expect(empty.ok).toBe(false);
    if (!empty.ok) {
      expect(empty.code).toBe("EMPTY_KEY");
    }
  });

  it("encodes and decodes opaque session tokens and invalidates stale key versions", async () => {
    const verified = await verifyAccessKey("EMBS-MEM-2026-SALMA");
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;

    const token = encodeSessionToken(verified.user);
    expect(token).not.toContain("EMBS-MEM-2026-SALMA");

    const decoded = decodeSessionToken(token);
    expect(decoded?.participantId).toBe("mem-101");
    expect(decoded?.displayId).toBe("M001");

    // Simulate a session issued against an older, revoked keyVersion (v1 vs active v2)
    const staleToken = encodeSessionToken({
      ...verified.user,
      keyVersion: 1,
    });
    expect(decodeSessionToken(staleToken)).toBeNull();

    // Malformed token is rejected
    expect(decodeSessionToken("not-a-valid-token")).toBeNull();

    // Sliding renewal extends expiration forward
    const futureNow = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const renewed = renewSessionUser(verified.user, futureNow);
    expect(new Date(renewed.expiresAt).getTime()).toBeGreaterThan(
      new Date(verified.user.expiresAt).getTime()
    );
  });
});
