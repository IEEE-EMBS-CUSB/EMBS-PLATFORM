import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  attendanceRecords,
  committees,
  membershipRoleEnum,
  monthlySnapshots,
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

  it("enforces strict unique index on rosterMemberships (seasonId, email)", () => {
    const config = getTableConfig(rosterMemberships);
    const uniqueIndex = config.indexes.find(
      (idx) => idx.config.name === "roster_season_email_idx"
    );
    expect(uniqueIndex).toBeDefined();
    expect(uniqueIndex?.config.unique).toBe(true);
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
