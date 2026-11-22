import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  attendanceRecords,
  committees,
  membershipRoleEnum,
  monthlySnapshots,
  persons,
  rosterMemberships,
  scoreLedger,
  taskSubmissions,
} from "@/db/schema";
import { normalizeEmail } from "@/lib/auth-helpers";

describe("Database Schema Constraints & Table Naming", () => {
  it("enforces strict unique index on committees (seasonId, slug)", () => {
    const config = getTableConfig(committees);
    const uniqueIndex = config.indexes.find(
      (idx) => idx.config.name === "committees_season_slug_idx"
    );
    expect(uniqueIndex).toBeDefined();
    expect(uniqueIndex?.config.unique).toBe(true);
  });

  it("enforces unique normalized email on persons table", () => {
    const config = getTableConfig(persons);
    const colNames = config.columns.map((c) => c.name);
    expect(colNames).toEqual(
      expect.arrayContaining([
        "id",
        "email",
        "full_name",
        "password_hash",
        "must_change_password",
        "password_changed_at",
        "is_active",
        "created_at",
        "updated_at",
      ])
    );

    const uniqueEmailIdx = config.indexes.find(
      (idx) => idx.config.name === "persons_email_idx"
    );
    expect(uniqueEmailIdx).toBeDefined();
    expect(uniqueEmailIdx?.config.unique).toBe(true);
  });

  it("links rosterMemberships to persons with partial unique indexes per role class and no legacy auth columns", () => {
    const config = getTableConfig(rosterMemberships);
    const colNames = config.columns.map((c) => c.name);

    expect(colNames).toContain("person_id");
    expect(colNames).not.toContain("email");
    expect(colNames).not.toContain("full_name");
    expect(colNames).not.toContain("password_hash");
    expect(colNames).not.toContain("must_change_password");
    expect(colNames).not.toContain("password_changed_at");

    // Old one-role-per-season unique index must be gone
    expect(
      config.indexes.find((idx) => idx.config.name === "roster_season_email_idx")
    ).toBeUndefined();

    // Explicit partial unique indexes per role class
    const expectedPartialUniques = [
      "roster_global_role_uniq",
      "roster_director_global_uniq",
      "roster_director_track_uniq",
      "roster_committee_role_uniq",
      "roster_unassigned_role_uniq",
    ];
    for (const indexName of expectedPartialUniques) {
      const idx = config.indexes.find((i) => i.config.name === indexName);
      expect(idx, `Missing partial unique index ${indexName}`).toBeDefined();
      expect(idx?.config.unique).toBe(true);
      expect(idx?.config.where).toBeDefined();
    }

    // FK from roster_memberships.person_id -> persons.id with ON DELETE RESTRICT
    const personFk = config.foreignKeys.find(
      (fk) => fk.reference().foreignTable === persons
    );
    expect(personFk).toBeDefined();
    expect(personFk?.onDelete).toBe("restrict");
  });

  it("enforces strict unique index on attendanceRecords (sessionId, membershipId) preventing double check-in", () => {
    const config = getTableConfig(attendanceRecords);
    const uniqueIndex = config.indexes.find(
      (idx) => idx.config.name === "attendance_session_member_idx"
    );
    expect(uniqueIndex).toBeDefined();
    expect(uniqueIndex?.config.unique).toBe(true);
  });

  it("enforces strict unique index on taskSubmissions (taskId, membershipId)", () => {
    const config = getTableConfig(taskSubmissions);
    const uniqueIndex = config.indexes.find(
      (idx) => idx.config.name === "task_submissions_task_member_idx"
    );
    expect(uniqueIndex).toBeDefined();
    expect(uniqueIndex?.config.unique).toBe(true);
  });

  it("enforces strict unique index on monthlySnapshots (seasonId, month)", () => {
    const config = getTableConfig(monthlySnapshots);
    const uniqueIndex = config.indexes.find(
      (idx) => idx.config.name === "monthly_snapshots_season_month_idx"
    );
    expect(uniqueIndex).toBeDefined();
    expect(uniqueIndex?.config.unique).toBe(true);
  });

  it("enforces partial unique index on scoreLedger (membershipId, sourceType, sourceId) where sourceId is not null", () => {
    const config = getTableConfig(scoreLedger);
    const uniqueIndex = config.indexes.find(
      (idx) => idx.config.name === "score_ledger_source_unique_idx"
    );
    expect(uniqueIndex).toBeDefined();
    expect(uniqueIndex?.config.unique).toBe(true);
    expect(uniqueIndex?.config.where).toBeDefined();
  });

  it("includes all 7 RBAC membership roles in the database enum", () => {
    expect(membershipRoleEnum.enumValues).toEqual([
      "master_admin",
      "director",
      "hr_admin",
      "hr_member",
      "committee_head",
      "member",
      "attendee",
    ]);
  });
});

describe("normalizeEmail helper", () => {
  it("trims leading and trailing whitespace and downcases emails consistently", () => {
    expect(normalizeEmail("  Salma.ElSayed@CU.EDU.EG ")).toBe(
      "salma.elsayed@cu.edu.eg"
    );
    expect(normalizeEmail("HR_Admin@IEEE.ORG\n")).toBe("hr_admin@ieee.org");
    expect(normalizeEmail("\tMEMBER.TEST@gmail.com")).toBe(
      "member.test@gmail.com"
    );
  });
});
