import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  CURRENT_SESSION_KEY_VERSION,
  createSessionForMember,
  decodeSessionToken,
  encodeSessionToken,
  renewSessionUser,
} from "@/services/session.service";

describe("session.service (HMAC-SHA256 signed cookies)", () => {
  const sampleMember = createSessionForMember({
    id: "11111111-1111-4111-8111-111111111111",
    personId: "22222222-2222-4222-8222-222222222222",
    fullName: "Salma El-Sayed",
    role: "committee_head",
  });

  it("encodes a signed v2 payload.signature token with personId and round-trips cleanly", () => {
    const token = encodeSessionToken(sampleMember);
    expect(token.split(".")).toHaveLength(2);

    const decoded = decodeSessionToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.participantId).toBe(sampleMember.participantId);
    expect(decoded?.personId).toBe("22222222-2222-4222-8222-222222222222");
    expect(decoded?.keyVersion).toBe(CURRENT_SESSION_KEY_VERSION);
    expect(decoded?.keyVersion).toBe(2);
    expect(decoded?.membershipRole).toBe("committee_head");
    expect(decoded?.participantType).toBe("member");
  });

  it("rejects legacy v1 signed tokens (pre-identity-split revocation)", () => {
    const secret =
      process.env.SESSION_SECRET ||
      process.env.BETTER_AUTH_SECRET ||
      "embs-cusb-local-dev-session-secret-do-not-use-in-prod";
    const legacyPayloadB64 = Buffer.from(
      JSON.stringify({
        sid: "legacy-sid",
        pid: "11111111-1111-4111-8111-111111111111",
        did: "11111111",
        name: "Salma El-Sayed",
        role: "member",
        mrole: "committee_head",
        kv: 1,
        iat: new Date().toISOString(),
        exp: new Date(Date.now() + 86_400_000).toISOString(),
      }),
      "utf8"
    ).toString("base64url");
    const sig = crypto
      .createHmac("sha256", secret)
      .update(legacyPayloadB64)
      .digest("base64url");

    expect(decodeSessionToken(`${legacyPayloadB64}.${sig}`)).toBeNull();
  });

  it("rejects unsigned base64url JSON tokens (forged master_admin cookie)", () => {
    const forgedPayload = JSON.stringify({
      sid: "forged-sid",
      pid: "11111111-1111-4111-8111-111111111111",
      did: "11111111",
      name: "Attacker",
      role: "member",
      mrole: "master_admin",
      kv: 1,
      iat: new Date().toISOString(),
      exp: new Date(Date.now() + 86_400_000).toISOString(),
    });
    const forgedToken = Buffer.from(forgedPayload, "utf8").toString("base64url");

    expect(decodeSessionToken(forgedToken)).toBeNull();
  });

  it("rejects tokens with tampered payload or tampered signature", () => {
    const token = encodeSessionToken(sampleMember);
    const [payloadB64, sigB64] = token.split(".");

    // Escalate role inside payload while reusing the original signature
    const raw = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    raw.mrole = "master_admin";
    const tamperedPayload = Buffer.from(JSON.stringify(raw), "utf8").toString("base64url");
    expect(decodeSessionToken(`${tamperedPayload}.${sigB64}`)).toBeNull();

    // Flip a character in the signature
    const flippedSig =
      (sigB64[0] === "A" ? "B" : "A") + sigB64.slice(1);
    expect(decodeSessionToken(`${payloadB64}.${flippedSig}`)).toBeNull();
    expect(decodeSessionToken("not-a-valid-token")).toBeNull();
  });

  it("rejects expired tokens and renews valid tokens forward", () => {
    const expired = {
      ...sampleMember,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    };
    const expiredToken = encodeSessionToken(expired);
    expect(decodeSessionToken(expiredToken)).toBeNull();

    const futureNow = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const renewed = renewSessionUser(sampleMember, futureNow);
    expect(new Date(renewed.expiresAt).getTime()).toBeGreaterThan(
      new Date(sampleMember.expiresAt).getTime()
    );
    const renewedDecoded = decodeSessionToken(encodeSessionToken(renewed), futureNow);
    expect(renewedDecoded?.participantId).toBe(sampleMember.participantId);
  });
});
