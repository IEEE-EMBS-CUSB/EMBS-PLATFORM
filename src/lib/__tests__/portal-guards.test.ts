import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  requireAttendeeSession,
  requireMemberSession,
  requireOperationalSession,
} from "@/lib/portal-guards";
import type { SessionUser } from "@/types";
import type { OperationalUserProfile } from "@/services/member.service";

const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    mockRedirect(path);
    throw new Error(`REDIRECT:${path}`);
  },
}));

let mockSession: SessionUser | null = null;
vi.mock("@/lib/session-cookie", () => ({
  getServerSession: vi.fn(async () => mockSession),
}));

let mockOperationalProfile: OperationalUserProfile | null = null;
vi.mock("@/services/member.service", () => ({
  getOperationalUserProfile: vi.fn(async () => mockOperationalProfile),
}));

describe("portal-guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession = null;
    mockOperationalProfile = null;
  });

  describe("requireMemberSession", () => {
    it("redirects to /login when no session exists", async () => {
      mockSession = null;
      await expect(requireMemberSession()).rejects.toThrow("REDIRECT:/login");
      expect(mockRedirect).toHaveBeenCalledWith("/login");
    });

    it("redirects to /attendee when participant is attendee", async () => {
      mockSession = {
        sessionId: "s-1",
        participantId: "att-1",
        displayId: "A001",
        fullName: "Attendee User",
        participantType: "attendee",
        keyVersion: 1,
        issuedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      };
      await expect(requireMemberSession()).rejects.toThrow("REDIRECT:/attendee");
      expect(mockRedirect).toHaveBeenCalledWith("/attendee");
    });

    it("returns session user when valid member session exists", async () => {
      mockSession = {
        sessionId: "s-1",
        participantId: "mem-1",
        displayId: "M001",
        fullName: "Member User",
        participantType: "member",
        keyVersion: 1,
        issuedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      };
      const session = await requireMemberSession();
      expect(session.participantId).toBe("mem-1");
    });
  });

  describe("requireAttendeeSession", () => {
    it("redirects to /login when no session exists", async () => {
      mockSession = null;
      await expect(requireAttendeeSession()).rejects.toThrow("REDIRECT:/login");
      expect(mockRedirect).toHaveBeenCalledWith("/login");
    });

    it("redirects to /member when participant is member", async () => {
      mockSession = {
        sessionId: "s-1",
        participantId: "mem-1",
        displayId: "M001",
        fullName: "Member User",
        participantType: "member",
        keyVersion: 1,
        issuedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      };
      await expect(requireAttendeeSession()).rejects.toThrow("REDIRECT:/member");
      expect(mockRedirect).toHaveBeenCalledWith("/member");
    });
  });

  describe("requireOperationalSession", () => {
    it("redirects to /login when no session exists", async () => {
      mockSession = null;
      await expect(requireOperationalSession()).rejects.toThrow("REDIRECT:/login");
      expect(mockRedirect).toHaveBeenCalledWith("/login");
    });

    it("redirects to /attendee when participant is attendee", async () => {
      mockSession = {
        sessionId: "s-1",
        participantId: "att-1",
        displayId: "A001",
        fullName: "Attendee User",
        participantType: "attendee",
        keyVersion: 1,
        issuedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      };
      await expect(requireOperationalSession()).rejects.toThrow("REDIRECT:/attendee");
      expect(mockRedirect).toHaveBeenCalledWith("/attendee");
    });

    it("redirects to /login if operational profile cannot be found", async () => {
      mockSession = {
        sessionId: "s-1",
        participantId: "mem-unknown",
        displayId: "M999",
        fullName: "Unknown User",
        participantType: "member",
        keyVersion: 1,
        issuedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      };
      mockOperationalProfile = null;
      await expect(requireOperationalSession()).rejects.toThrow("REDIRECT:/login");
      expect(mockRedirect).toHaveBeenCalledWith("/login");
    });

    it("redirects plain member to /member (non-operational role)", async () => {
      mockSession = {
        sessionId: "s-1",
        participantId: "mem-1",
        displayId: "M001",
        fullName: "General Member",
        participantType: "member",
        keyVersion: 1,
        issuedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      };
      mockOperationalProfile = {
        id: "mem-1",
        fullName: "General Member",
        email: "member@cu.edu.eg",
        role: "member",
        committeeId: "com-1",
        committeeName: "Robotics",
      };
      await expect(requireOperationalSession()).rejects.toThrow("REDIRECT:/member");
      expect(mockRedirect).toHaveBeenCalledWith("/member");
    });

    it("allows access and returns session + profile for authorized operational roles", async () => {
      mockSession = {
        sessionId: "s-1",
        participantId: "mem-dir",
        displayId: "MDIR",
        fullName: "Khaled Mansour",
        participantType: "member",
        keyVersion: 1,
        issuedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      };
      mockOperationalProfile = {
        id: "mem-dir",
        fullName: "Khaled Mansour",
        email: "director@cu.edu.eg",
        role: "director",
        committeeId: null,
      };

      const result = await requireOperationalSession();
      expect(result.session.participantId).toBe("mem-dir");
      expect(result.profile.role).toBe("director");
      expect(result.profile.fullName).toBe("Khaled Mansour");
    });
  });
});
