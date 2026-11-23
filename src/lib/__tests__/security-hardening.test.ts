import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/request-origin";
import { DELETE as deleteSession } from "@/app/api/session/route";
import { POST as postContext } from "@/app/api/session/context/route";
import nextConfig from "../../../next.config";

describe("Security hardening (CSRF Origin checks & HTTP security headers)", () => {
  it("allows same-origin requests and rejects cross-origin mutating requests", () => {
    const sameOriginReq = new NextRequest("https://portal.embs.org/api/session", {
      method: "DELETE",
      headers: { origin: "https://portal.embs.org" },
    });
    expect(isSameOriginRequest(sameOriginReq)).toBe(true);

    const noOriginReq = new NextRequest("https://portal.embs.org/api/session", {
      method: "DELETE",
    });
    expect(isSameOriginRequest(noOriginReq)).toBe(true);

    const crossOriginReq = new NextRequest("https://portal.embs.org/api/session", {
      method: "DELETE",
      headers: { origin: "https://evil.attacker.example" },
    });
    expect(isSameOriginRequest(crossOriginReq)).toBe(false);
  });

  it("blocks cross-origin DELETE /api/session and POST /api/session/context with HTTP 403", async () => {
    const badDelete = new NextRequest("https://portal.embs.org/api/session", {
      method: "DELETE",
      headers: { origin: "https://evil.attacker.example" },
    });
    const delRes = await deleteSession(badDelete);
    expect(delRes.status).toBe(403);

    const badPost = new NextRequest("https://portal.embs.org/api/session/context", {
      method: "POST",
      headers: {
        origin: "https://evil.attacker.example",
        "content-type": "application/json",
      },
      body: JSON.stringify({ membershipId: "any" }),
    });
    const postRes = await postContext(badPost);
    expect(postRes.status).toBe(403);
  });

  it("configures mandatory HTTP security headers and disables X-Powered-By in next.config.ts", async () => {
    expect(nextConfig.poweredByHeader).toBe(false);
    expect(typeof nextConfig.headers).toBe("function");

    const rules = await nextConfig.headers!();
    const globalRule = rules.find((r) => r.source === "/(.*)");
    expect(globalRule).toBeDefined();

    const headerMap = new Map(
      globalRule!.headers.map((h) => [h.key.toLowerCase(), h.value])
    );

    expect(headerMap.get("x-frame-options")).toBe("DENY");
    expect(headerMap.get("x-content-type-options")).toBe("nosniff");
    expect(headerMap.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(headerMap.get("strict-transport-security")).toContain("max-age=");
    expect(headerMap.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(headerMap.get("permissions-policy")).toContain("camera=()");
  });
});
