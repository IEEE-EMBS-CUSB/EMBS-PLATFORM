import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, desc, eq, ne } from "drizzle-orm";
import type { MembershipRole } from "@/lib/auth-helpers";
import { canPublishLeaderboard } from "@/lib/permissions";
import {
  calculateDraftMonthlySnapshot,
  type CalculatedSnapshotEntry,
  type MemberRef,
} from "@/services/hr.service";
import {
  isValidMonthKey,
  resolveActiveSeason,
  sanitizeDbError,
} from "./helpers";

interface PublishingActor {
  profile: { id?: string; role: MembershipRole };
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return monthKey;
  const date = new Date(Date.UTC(y, m - 1, 1));
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

interface StoredSnapshotPayload {
  monthLabel?: string;
  entries?: CalculatedSnapshotEntry[];
  overallEntries?: CalculatedSnapshotEntry[];
  committeeEntries?: Record<string, CalculatedSnapshotEntry[]>;
  headsEntries?: CalculatedSnapshotEntry[];
}

async function buildDraft(month: string, seasonId: string) {
  const dbMembers = await db
    .select({
      id: schema.rosterMemberships.id,
      personId: schema.rosterMemberships.personId,
      fullName: schema.persons.fullName,
      committeeId: schema.rosterMemberships.committeeId,
      role: schema.rosterMemberships.role,
    })
    .from(schema.rosterMemberships)
    .innerJoin(
      schema.persons,
      eq(schema.rosterMemberships.personId, schema.persons.id)
    )
    .where(
      and(
        eq(schema.rosterMemberships.seasonId, seasonId),
        eq(schema.rosterMemberships.isActive, true),
        eq(schema.persons.isActive, true),
        ne(schema.rosterMemberships.role, "attendee")
      )
    );

  const committees = await db
    .select()
    .from(schema.committees)
    .where(eq(schema.committees.seasonId, seasonId));
  const commMap = new Map(committees.map((c) => [c.id, c]));

  const members = dbMembers.map((m) => ({
    id: m.id,
    personId: m.personId,
    fullName: m.fullName,
    committeeId: m.committeeId,
    committeeSlug: m.committeeId ? commMap.get(m.committeeId)?.slug ?? null : null,
    committeeName: m.committeeId ? commMap.get(m.committeeId)?.name ?? null : null,
    role: m.role,
  }));

  const ledger = await db
    .select({
      membershipId: schema.scoreLedger.membershipId,
      personId: schema.rosterMemberships.personId,
      postingScope: schema.scoreLedger.postingScope,
      committeeId: schema.scoreLedger.committeeId,
      points: schema.scoreLedger.points,
    })
    .from(schema.scoreLedger)
    .innerJoin(
      schema.rosterMemberships,
      eq(schema.scoreLedger.membershipId, schema.rosterMemberships.id)
    )
    .where(
      and(
        eq(schema.scoreLedger.seasonId, seasonId),
        eq(schema.scoreLedger.month, month)
      )
    );
  const ledgerEntries = ledger.map((l) => ({
    membershipId: l.membershipId,
    personId: l.personId,
    postingScope: l.postingScope,
    committeeId: l.committeeId,
    points: l.points,
  }));

  const prevRows = await db
    .select()
    .from(schema.monthlySnapshots)
    .where(
      and(
        eq(schema.monthlySnapshots.seasonId, seasonId),
        eq(schema.monthlySnapshots.status, "published")
      )
    )
    .orderBy(desc(schema.monthlySnapshots.month));

  const previous = prevRows.find((r) => r.month < month);
  let previousSnapshot:
    | {
        overall?: { memberId: string; personId?: string; rank: number }[];
        committees?: Record<
          string,
          { memberId: string; personId?: string; rank: number }[]
        >;
        heads?: { memberId: string; personId?: string; rank: number }[];
      }
    | undefined;

  if (previous) {
    const json = previous.snapshotJson as StoredSnapshotPayload;
    const prevOverall = json.overallEntries ?? json.entries ?? [];
    const prevHeads = json.headsEntries ?? [];
    previousSnapshot = {
      overall: prevOverall.map((e) => ({
        memberId: e.memberId,
        personId: e.personId,
        rank: e.rank,
      })),
      committees: Object.fromEntries(
        Object.entries(json.committeeEntries ?? {}).map(([k, v]) => [
          k,
          (v ?? []).map((e) => ({
            memberId: e.memberId,
            personId: e.personId,
            rank: e.rank,
          })),
        ])
      ),
      heads: prevHeads.map((e) => ({
        memberId: e.memberId,
        personId: e.personId,
        rank: e.rank,
      })),
    };
  }

  const draft = calculateDraftMonthlySnapshot({
    month,
    members: members as MemberRef[],
    ledgerEntries,
    previousSnapshot,
  });
  return { draft, members };
}

export async function publishMonthlySnapshotAsActor(
  month: string,
  actor: PublishingActor
) {
  if (!canPublishLeaderboard(actor.profile.role)) {
    return {
      ok: false,
      error: "Unauthorized: only Master Admin or HR Admin can publish leaderboards.",
    };
  }
  if (!isValidMonthKey(month)) {
    return { ok: false, error: "Invalid month format. Expected YYYY-MM." };
  }

  try {
    const seasonRes = await resolveActiveSeason();
    if (!seasonRes.ok) return { ok: false, error: seasonRes.error };
    const seasonId = seasonRes.season.id;

    const existing = await db
      .select()
      .from(schema.monthlySnapshots)
      .where(
        and(
          eq(schema.monthlySnapshots.seasonId, seasonId),
          eq(schema.monthlySnapshots.month, month)
        )
      )
      .limit(1);

    if (existing.length > 0 && existing[0].status === "published") {
      return { ok: true };
    }

    const { draft } = await buildDraft(month, seasonId);

    const snapshotJson: StoredSnapshotPayload = {
      monthLabel: formatMonthLabel(month),
      entries: draft.overallEntries,
      overallEntries: draft.overallEntries,
      committeeEntries: draft.committeeEntries,
      headsEntries: draft.headsEntries,
    };

    if (existing.length > 0) {
      await db
        .update(schema.monthlySnapshots)
        .set({
          status: "published",
          publishedAt: new Date(),
          publishedBy: actor.profile.id ?? null,
          snapshotJson,
        })
        .where(eq(schema.monthlySnapshots.id, existing[0].id));
    } else {
      await db.insert(schema.monthlySnapshots).values({
        seasonId,
        month,
        status: "published",
        publishedAt: new Date(),
        publishedBy: actor.profile.id ?? null,
        snapshotJson,
      });
    }

    return { ok: true };
  } catch (err: unknown) {
    return {
      ok: false,
      error: sanitizeDbError(err, "Failed to publish monthly leaderboard."),
    };
  }
}

/**
 * Server-side query for the HR Publishing page.
 * Returns frozen snapshot entries when already published, or live draft entries otherwise.
 */
export async function getSnapshotForPublishingPage(month: string) {
  if (!isValidMonthKey(month)) return null;

  const seasonRes = await resolveActiveSeason();
  if (!seasonRes.ok) return null;
  const seasonId = seasonRes.season.id;

  const [existing] = await db
    .select()
    .from(schema.monthlySnapshots)
    .where(
      and(
        eq(schema.monthlySnapshots.seasonId, seasonId),
        eq(schema.monthlySnapshots.month, month)
      )
    )
    .limit(1);

  if (existing && existing.status === "published") {
    let publishedByName: string | undefined;
    if (existing.publishedBy) {
      const [publisher] = await db
        .select({ fullName: schema.persons.fullName })
        .from(schema.rosterMemberships)
        .innerJoin(
          schema.persons,
          eq(schema.rosterMemberships.personId, schema.persons.id)
        )
        .where(eq(schema.rosterMemberships.id, existing.publishedBy))
        .limit(1);
      publishedByName = publisher?.fullName;
    }

    const json = existing.snapshotJson as StoredSnapshotPayload;
    const overallEntries = json.overallEntries ?? json.entries ?? [];
    const committeeEntries = json.committeeEntries ?? {};
    const headsEntries =
      json.headsEntries ??
      overallEntries
        .filter((e) => e.role === "committee_head" || e.role === "Head")
        .map((e, idx) => ({ ...e, rank: idx + 1 }));
    return {
      month,
      status: "published" as const,
      publishedAt: existing.publishedAt
        ? existing.publishedAt.toISOString().slice(0, 10)
        : undefined,
      publishedByName,
      overallEntries,
      committeeEntries,
      headsEntries,
    };
  }

  const { draft } = await buildDraft(month, seasonId);
  return {
    month,
    status: "draft" as const,
    publishedAt: undefined,
    publishedByName: undefined,
    overallEntries: draft.overallEntries,
    committeeEntries: draft.committeeEntries,
    headsEntries: draft.headsEntries,
  };
}

export async function getPublishingMonthOptions(
  providedSeasonId?: string
): Promise<Array<{ month: string; status: "draft" | "published" }>> {
  let seasonId = providedSeasonId;
  if (!seasonId) {
    const seasonRes = await resolveActiveSeason();
    if (!seasonRes.ok) return [];
    seasonId = seasonRes.season.id;
  }

  const [ledgerRows, snapshotRows] = await Promise.all([
    db
      .selectDistinct({ month: schema.scoreLedger.month })
      .from(schema.scoreLedger)
      .where(eq(schema.scoreLedger.seasonId, seasonId)),
    db
      .select({
        month: schema.monthlySnapshots.month,
        status: schema.monthlySnapshots.status,
      })
      .from(schema.monthlySnapshots)
      .where(eq(schema.monthlySnapshots.seasonId, seasonId)),
  ]);

  const statusMap = new Map<string, "draft" | "published">();
  for (const r of ledgerRows) {
    if (!statusMap.has(r.month)) statusMap.set(r.month, "draft");
  }
  for (const r of snapshotRows) {
    statusMap.set(r.month, r.status === "published" ? "published" : "draft");
  }

  return Array.from(statusMap.entries())
    .map(([month, status]) => ({ month, status }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

export async function getAvailableMonthsForPublishingPage(): Promise<string[]> {
  const options = await getPublishingMonthOptions();
  return options.map((o) => o.month);
}
