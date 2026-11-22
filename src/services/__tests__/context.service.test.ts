import { describe, expect, it } from "vitest";
import {
  filterEligibleSeasonContexts,
  resolveContextSwitch,
  resolveDestinationForContext,
  selectInitialLoginContext,
  type RawContextCandidate,
} from "@/services/context.service";
import {
  createSessionForMember,
  switchSessionMembership,
} from "@/services/session.service";

const makeCandidate = (
  overrides: Partial<RawContextCandidate>
): RawContextCandidate => ({
  membershipId: "mem-1",
  personId: "person-1",
  seasonId: "season-active",
  seasonName: "Fall 2026",
  seasonStatus: "active",
  seasonStartDate: new Date("2026-09-01T00:00:00Z"),
  role: "member",
  committeeId: "comm-ai",
  committeeName: "AI and Machine Learning",
  committeeSlug: "ai-and-machine-learning",
  managedTrackId: null,
  managedTrackName: null,
  isActive: true,
  createdAt: new Date("2026-09-02T00:00:00Z"),
  ...overrides,
});

describe("context.service (multi-role context selection & ownership validation)", () => {
  it("lists only active memberships from the active season and sorts by role precedence", () => {
    const candidates: RawContextCandidate[] = [
      makeCandidate({
        membershipId: "mem-archived",
        seasonId: "season-2025",
        seasonStatus: "archived",
        seasonStartDate: new Date("2025-09-01T00:00:00Z"),
        role: "master_admin",
      }),
      makeCandidate({
        membershipId: "mem-draft",
        seasonId: "season-2027",
        seasonStatus: "draft",
        seasonStartDate: new Date("2027-09-01T00:00:00Z"),
        role: "director",
      }),
      makeCandidate({
        membershipId: "mem-ai-member",
        role: "member",
        committeeId: "comm-ai",
        createdAt: new Date("2026-09-02T00:00:00Z"),
      }),
      makeCandidate({
        membershipId: "mem-pr-hr",
        role: "hr_member",
        committeeId: "comm-pr",
        createdAt: new Date("2026-09-03T00:00:00Z"),
      }),
      makeCandidate({
        membershipId: "mem-inactive-head",
        role: "committee_head",
        isActive: false,
      }),
    ];

    const eligible = filterEligibleSeasonContexts(candidates);
    expect(eligible.map((c) => c.membershipId)).toEqual([
      "mem-pr-hr",
      "mem-ai-member",
    ]);
  });

  it("blocks archived-only non-master accounts while keeping master_admin exempt across season rollover", () => {
    const archivedNonMaster = filterEligibleSeasonContexts([
      makeCandidate({
        membershipId: "mem-old-head",
        seasonId: "season-2025",
        seasonStatus: "archived",
        seasonStartDate: new Date("2025-09-01T00:00:00Z"),
        role: "committee_head",
      }),
      makeCandidate({
        membershipId: "mem-old-hr",
        seasonId: "season-2025",
        seasonStatus: "archived",
        seasonStartDate: new Date("2025-09-01T00:00:00Z"),
        role: "hr_admin",
      }),
    ]);
    expect(archivedNonMaster).toEqual([]);

    const archivedMaster = filterEligibleSeasonContexts([
      makeCandidate({
        membershipId: "mem-old-master-2024",
        seasonId: "season-2024",
        seasonStatus: "archived",
        seasonStartDate: new Date("2024-09-01T00:00:00Z"),
        role: "master_admin",
        committeeId: null,
        committeeName: null,
        committeeSlug: null,
      }),
      makeCandidate({
        membershipId: "mem-old-master-2025",
        seasonId: "season-2025",
        seasonStatus: "archived",
        seasonStartDate: new Date("2025-09-01T00:00:00Z"),
        role: "master_admin",
        committeeId: null,
        committeeName: null,
        committeeSlug: null,
      }),
    ]);
    expect(archivedMaster.map((c) => c.membershipId)).toEqual([
      "mem-old-master-2025",
    ]);
  });

  it("refuses switching to a membership owned by another person even when that membership exists", () => {
    const aliceHat = makeCandidate({
      membershipId: "mem-alice-1",
      personId: "person-alice",
      role: "member",
    });
    const bobHeadHat = makeCandidate({
      membershipId: "mem-bob-head",
      personId: "person-bob",
      role: "committee_head",
    });

    // Bob's hat exists in the system, but Alice's eligible list only contains Alice's memberships
    const aliceEligible = filterEligibleSeasonContexts([aliceHat]);
    expect(bobHeadHat.isActive).toBe(true);

    const refusal = resolveContextSwitch(aliceEligible, bobHeadHat.membershipId);
    expect(refusal.ok).toBe(false);
    if (!refusal.ok) {
      expect(refusal.code).toBe("FORBIDDEN");
      expect(refusal.error).toMatch(/unauthorized|do not hold/i);
    }
  });

  it("refuses switching to an inactive or archived hat when active-season hats exist, and allows valid owned hats", () => {
    const activeHead = makeCandidate({
      membershipId: "mem-head-pr",
      role: "committee_head",
      committeeId: "comm-pr",
    });
    const activeMember = makeCandidate({
      membershipId: "mem-member-ai",
      role: "member",
      committeeId: "comm-ai",
    });
    const inactiveHat = makeCandidate({
      membershipId: "mem-inactive",
      role: "hr_member",
      isActive: false,
    });

    const eligible = filterEligibleSeasonContexts([
      activeHead,
      activeMember,
      inactiveHat,
    ]);

    const okSwitch = resolveContextSwitch(eligible, "mem-member-ai");
    expect(okSwitch.ok).toBe(true);
    if (okSwitch.ok) {
      expect(okSwitch.context.membershipId).toBe("mem-member-ai");
      expect(okSwitch.context.role).toBe("member");
    }

    const blockedInactive = resolveContextSwitch(eligible, "mem-inactive");
    expect(blockedInactive.ok).toBe(false);
  });

  it("honors last-used preferredMembershipId on login only if still owned and eligible, otherwise falls back cleanly", () => {
    const headHat = makeCandidate({
      membershipId: "mem-head",
      role: "committee_head",
    });
    const memberHat = makeCandidate({
      membershipId: "mem-member",
      role: "member",
    });

    // Preferred valid hat wins over default role precedence
    const resumed = selectInitialLoginContext([headHat, memberHat], "mem-member");
    expect(resumed?.membershipId).toBe("mem-member");

    // Stale/foreign preferredMembershipId falls back to highest-precedence eligible hat
    const fallback = selectInitialLoginContext([headHat, memberHat], "mem-foreign");
    expect(fallback?.membershipId).toBe("mem-head");
  });

  it("resolves authoritative destination paths per role and requested view", () => {
    expect(
      resolveDestinationForContext(
        makeCandidate({ role: "committee_head" }),
        "personal"
      )
    ).toBe("/member");
    expect(
      resolveDestinationForContext(
        makeCandidate({ role: "hr_member" }),
        "personal"
      )
    ).toBe("/member");
    expect(
      resolveDestinationForContext(
        makeCandidate({ role: "hr_member" }),
        "manage"
      )
    ).toBe("/hr");
    expect(
      resolveDestinationForContext(
        makeCandidate({ role: "director" }),
        "personal"
      )
    ).toBe("/hr");
    expect(
      resolveDestinationForContext(makeCandidate({ role: "attendee" }))
    ).toBe("/attendee");
  });

  it("preserves sessionId, personId, and original issuedAt when switching active membership", () => {
    const original = createSessionForMember({
      id: "11111111-1111-4111-8111-111111111111",
      personId: "22222222-2222-4222-8222-222222222222",
      fullName: "Salma El-Sayed",
      role: "committee_head",
    });

    const later = new Date(Date.parse(original.issuedAt) + 60_000);
    const switched = switchSessionMembership(
      original,
      {
        id: "33333333-3333-4333-8333-333333333333",
        fullName: "Salma El-Sayed",
        role: "attendee",
      },
      later
    );

    expect(switched.sessionId).toBe(original.sessionId);
    expect(switched.personId).toBe(original.personId);
    expect(switched.issuedAt).toBe(original.issuedAt);
    expect(switched.participantId).toBe("33333333-3333-4333-8333-333333333333");
    expect(switched.membershipRole).toBe("attendee");
    expect(switched.participantType).toBe("attendee");
    expect(Date.parse(switched.expiresAt)).toBeGreaterThan(
      Date.parse(original.expiresAt)
    );
  });
});
