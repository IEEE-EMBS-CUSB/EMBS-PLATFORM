import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

import { db } from "./index";
import * as schema from "./schema";
import { normalizeEmail } from "@/lib/auth-helpers";
import { hashPassword } from "@/lib/password";

export async function seedDatabase() {
  console.log("🌱 Starting IEEE EMBS CUSB Database Seed...");

  // 1. Seasons: Active Season + Historical Archived Season
  const [activeSeason] = await db
    .insert(schema.seasons)
    .values({
      name: "Fall 2026",
      status: "active",
      startDate: new Date("2026-08-01"),
      endDate: new Date("2027-01-31"),
    })
    .onConflictDoNothing()
    .returning();

  await db
    .insert(schema.seasons)
    .values({
      name: "Spring 2026",
      status: "archived",
      startDate: new Date("2026-02-01"),
      endDate: new Date("2026-07-31"),
    })
    .onConflictDoNothing();

  let seasonId = activeSeason?.id;
  if (!seasonId) {
    const existing = await db.select().from(schema.seasons);
    seasonId = existing.find((s) => s.name === "Fall 2026")?.id ?? "";
  }

  if (!seasonId) {
    console.log("Season failed to create or be found. Exiting seed.");
    return;
  }

  // 2. All 12 Official Chapter Committees (6 Technical, 6 Non-Technical)
  const committeeData = [
    // Technical
    {
      name: "AI and Machine Learning",
      slug: "ai-and-machine-learning",
      category: "technical" as const,
    },
    {
      name: "Web Development",
      slug: "web-development",
      category: "technical" as const,
    },
    {
      name: "Robotics and Automation",
      slug: "robotics-and-automation",
      category: "technical" as const,
    },
    {
      name: "Medical Equipment and Planning",
      slug: "medical-equipment-and-planning",
      category: "technical" as const,
    },
    {
      name: "R&D",
      slug: "r-and-d",
      category: "technical" as const,
    },
    {
      name: "Game Development",
      slug: "game-development",
      category: "technical" as const,
    },
    // Non-Technical
    {
      name: "Marketing and Content Creation",
      slug: "marketing-and-content-creation",
      category: "non_technical" as const,
    },
    {
      name: "Graphic Design",
      slug: "graphic-design",
      category: "non_technical" as const,
    },
    {
      name: "Photography, Videography & Editing",
      slug: "photography-videography-editing",
      category: "non_technical" as const,
    },
    {
      name: "Human Resources",
      slug: "human-resources",
      category: "non_technical" as const,
    },
    {
      name: "Public Relations and Fund Raising",
      slug: "public-relations-and-fund-raising",
      category: "non_technical" as const,
    },
    {
      name: "Organizing and Logistics",
      slug: "organizing-and-logistics",
      category: "non_technical" as const,
    },
  ];

  let insertedCommittees = await db
    .insert(schema.committees)
    .values(
      committeeData.map((c) => ({
        ...c,
        seasonId,
        isActive: true,
      }))
    )
    .onConflictDoNothing()
    .returning();

  if (insertedCommittees.length === 0) {
    insertedCommittees = await db.select().from(schema.committees);
  }

  const committeeMap = new Map(
    insertedCommittees.map((c) => [c.slug, c.id])
  );

  // 3. Official Scoring Rubrics
  const rubricsData = [
    {
      name: "Attendance & Punctuality",
      maxPoints: 20,
      weight: "1.0",
      leadersOnly: false,
      sortOrder: 1,
    },
    {
      name: "Task Contribution",
      maxPoints: 25,
      weight: "1.0",
      leadersOnly: false,
      sortOrder: 2,
    },
    {
      name: "Workshops",
      maxPoints: 5,
      weight: "1.0",
      leadersOnly: false,
      sortOrder: 3,
    },
    {
      name: "Hands-on & Events",
      maxPoints: 20,
      weight: "1.0",
      leadersOnly: false,
      sortOrder: 4,
    },
    {
      name: "Communication & Teamwork",
      maxPoints: 10,
      weight: "1.0",
      leadersOnly: false,
      sortOrder: 5,
    },
    {
      name: "Initiative & Ownership",
      maxPoints: 10,
      weight: "1.0",
      leadersOnly: false,
      sortOrder: 6,
    },
    {
      name: "Leadership",
      maxPoints: 10,
      weight: "1.0",
      leadersOnly: true,
      sortOrder: 7,
    },
  ];

  await db
    .insert(schema.scoringRubrics)
    .values(
      rubricsData.map((r) => ({
        ...r,
        seasonId,
      }))
    )
    .onConflictDoNothing();

  // 4. Seed Whitelist Roster Memberships (Master, HR Admin, HR Member, Committee Heads, Members, Attendees)
  const rosterData = [
    {
      email: normalizeEmail("master@cu.edu.eg"),
      fullName: "Master Administrator",
      committeeId: null,
      role: "master_admin" as const,
    },
    {
      email: normalizeEmail("director@cu.edu.eg"),
      fullName: "Khaled Mansour",
      committeeId: null,
      role: "director" as const,
    },
    {
      email: normalizeEmail("hr.lead@cu.edu.eg"),
      fullName: "Sara Hassan",
      committeeId: committeeMap.get("human-resources") ?? null,
      role: "hr_admin" as const,
    },
    {
      email: normalizeEmail("hr.member@cu.edu.eg"),
      fullName: "Laila Amr",
      committeeId: committeeMap.get("human-resources") ?? null,
      trackedCommitteeId: committeeMap.get("ai-and-machine-learning") ?? null,
      role: "hr_member" as const,
    },
    {
      email: normalizeEmail("salma.elsayed@cu.edu.eg"),
      fullName: "Salma El-Sayed",
      committeeId: committeeMap.get("ai-and-machine-learning") ?? null,
      role: "committee_head" as const,
    },
    {
      email: normalizeEmail("ziad.hany@cu.edu.eg"),
      fullName: "Ziad Hany",
      committeeId: committeeMap.get("web-development") ?? null,
      role: "committee_head" as const,
    },
    {
      email: normalizeEmail("omar.tarek@cu.edu.eg"),
      fullName: "Omar Tarek",
      committeeId: committeeMap.get("robotics-and-automation") ?? null,
      role: "member" as const,
    },
    {
      email: normalizeEmail("nourhan.khaled@cu.edu.eg"),
      fullName: "Nourhan Khaled",
      committeeId: committeeMap.get("graphic-design") ?? null,
      role: "committee_head" as const,
    },
    {
      email: normalizeEmail("mariam.yassin@gmail.com"),
      fullName: "Mariam Yassin",
      committeeId: null,
      role: "attendee" as const,
    },
  ];

  const defaultInitialPasswordHash = hashPassword("EMBS2026!");

  // 4a. Seed Persons (cross-season identity + credentials)
  await db
    .insert(schema.persons)
    .values(
      rosterData.map((m) => ({
        email: m.email,
        fullName: m.fullName,
        passwordHash: defaultInitialPasswordHash,
        mustChangePassword: true,
        isActive: true,
      }))
    )
    .onConflictDoNothing();

  // Ensure all seeded persons have the initial password populated
  await db.update(schema.persons).set({
    passwordHash: defaultInitialPasswordHash,
    mustChangePassword: true,
  });

  const allPersons = await db.select().from(schema.persons);
  const personByEmail = new Map(allPersons.map((p) => [p.email, p]));

  // 4b. Seed Season-Scoped Roster Memberships linked to persons
  for (const m of rosterData) {
    const person = personByEmail.get(m.email);
    if (!person) continue;
    await db
      .insert(schema.rosterMemberships)
      .values({
        seasonId,
        personId: person.id,
        committeeId: m.committeeId,
        trackedCommitteeId:
          "trackedCommitteeId" in m ? m.trackedCommitteeId ?? null : null,
        role: m.role,
        isActive: true,
      })
      .onConflictDoNothing();
  }

  const insertedMemberships = await db.select().from(schema.rosterMemberships);

  const salmaPerson = personByEmail.get("salma.elsayed@cu.edu.eg");
  const hrAdminPerson = personByEmail.get("hr.lead@cu.edu.eg");
  const salmaMember = salmaPerson
    ? insertedMemberships.find(
        (m) => m.seasonId === seasonId && m.personId === salmaPerson.id
      )
    : undefined;
  const hrAdminMember = hrAdminPerson
    ? insertedMemberships.find(
        (m) => m.seasonId === seasonId && m.personId === hrAdminPerson.id
      )
    : undefined;

  // 5. Seed Historical Monthly Snapshots
  const { MOCK_LEADERBOARD_SNAPSHOTS } = await import("./leaderboard-snapshots");
  for (const snap of MOCK_LEADERBOARD_SNAPSHOTS) {
    await db
      .insert(schema.monthlySnapshots)
      .values({
        seasonId,
        month: snap.month,
        status: snap.status,
        publishedAt: snap.publishedAt ? new Date(snap.publishedAt) : null,
        publishedBy: hrAdminMember?.id ?? null,
        snapshotJson: {
          month: snap.month,
          monthLabel: snap.monthLabel,
          status: snap.status,
          publishedAt: snap.publishedAt,
          entries: snap.entries,
        },
      })
      .onConflictDoNothing();
  }

  // 6. Seed Branch Sessions
  let insertedSessions = await db
    .insert(schema.branchSessions)
    .values([
      {
        seasonId,
        committeeId: committeeMap.get("ai-and-machine-learning") ?? null,
        title: "Biomedical AI & PyTorch Workshop",
        startsAt: new Date("2026-10-15T18:00:00Z"),
        checkinCode: "847291",
        checkinOpen: false,
        punctualityCutoffMinutes: 15,
        basePoints: 15,
        punctualityBonus: 5,
      },
      {
        seasonId,
        committeeId: null, // Branch-wide
        title: "All-Hands Branch General Meeting",
        startsAt: new Date("2026-10-25T17:00:00Z"),
        checkinCode: "193824",
        checkinOpen: false,
        punctualityCutoffMinutes: 15,
        basePoints: 10,
        punctualityBonus: 5,
      },
    ])
    .onConflictDoNothing()
    .returning();

  if (insertedSessions.length === 0) {
    insertedSessions = await db.select().from(schema.branchSessions);
  }

  // 7. Seed Tasks
  let insertedTasks = await db
    .insert(schema.tasks)
    .values([
      {
        seasonId,
        committeeId: committeeMap.get("ai-and-machine-learning") ?? null,
        title: "ECG Classification Model Implementation",
        dueAt: new Date("2026-10-28T23:59:59Z"),
        maxPoints: 40,
      },
    ])
    .onConflictDoNothing()
    .returning();

  if (insertedTasks.length === 0) {
    insertedTasks = await db.select().from(schema.tasks);
  }

  // 8. Seed Submissions & Score Ledger (if memberships were inserted)
  if (salmaMember) {
    if (insertedSessions[0]) {
      await db
        .insert(schema.attendanceRecords)
        .values({
          sessionId: insertedSessions[0].id,
          membershipId: salmaMember.id,
          checkedInAt: new Date("2026-10-15T18:05:00Z"),
          isPunctual: true,
          pointsAwarded: 20,
        })
        .onConflictDoNothing();

      await db
        .insert(schema.scoreLedger)
        .values({
          seasonId,
          membershipId: salmaMember.id,
          month: "2026-10",
          sourceType: "attendance",
          sourceId: insertedSessions[0].id,
          points: 20,
          reason: "Attended Biomedical AI & PyTorch Workshop (on time bonus)",
          createdBy: hrAdminMember?.id ?? null,
        })
        .onConflictDoNothing();
    }

    if (insertedTasks[0]) {
      await db
        .insert(schema.taskSubmissions)
        .values({
          taskId: insertedTasks[0].id,
          membershipId: salmaMember.id,
          effortScore: 10,
          qualityScore: 14,
          timelinessScore: 13,
          totalPoints: 37,
          gradedBy: hrAdminMember?.id ?? null,
          gradedAt: new Date("2026-10-30T12:00:00Z"),
        })
        .onConflictDoNothing();

      await db
        .insert(schema.scoreLedger)
        .values({
          seasonId,
          membershipId: salmaMember.id,
          month: "2026-10",
          sourceType: "task",
          sourceId: insertedTasks[0].id,
          points: 37,
          reason: "ECG Classification Model Implementation (High Quality)",
          createdBy: hrAdminMember?.id ?? null,
        })
        .onConflictDoNothing();
    }

    // Manual Point Override
    await db
      .insert(schema.scoreLedger)
      .values({
        seasonId,
        membershipId: salmaMember.id,
        month: "2026-10",
        sourceType: "manual_override",
        points: 5,
        reason: "Special recognition for presenting at CUSB Annual Biomedical Symposium",
        createdBy: hrAdminMember?.id ?? null,
      })
      .onConflictDoNothing();

    // 9. Seed HR Feedback (Public Recognition vs. Private Warning)
    const feedbackAuthorId = hrAdminMember?.id ?? salmaMember.id;
    await db
      .insert(schema.hrFeedback)
      .values([
        {
          seasonId,
          membershipId: salmaMember.id,
          content: "Exceptional leadership delivering the biomedical AI hands-on workshop to 40+ members.",
          isPublished: true,
          isWarning: false,
          createdBy: feedbackAuthorId,
        },
        {
          seasonId,
          membershipId: salmaMember.id,
          content: "Internal HR note: Coordination sync was rescheduled once without prior notice.",
          isPublished: false,
          isWarning: true,
          createdBy: feedbackAuthorId,
        },
      ])
      .onConflictDoNothing();
  }

  if (salmaMember) {
    await db
      .insert(schema.memberActivities)
      .values([
        {
          seasonId,
          membershipId: salmaMember.id,
          month: "2026-10",
          date: "2026-10-18",
          category: "delivered_session",
          title: "Delivered PyTorch Workshop",
          role: "Lead Speaker",
          summary: "Delivered a 2-hour technical hands-on workshop covering attention heads for 45 members.",
          pointsAwarded: 5,
        },
        {
          seasonId,
          membershipId: salmaMember.id,
          month: "2026-10",
          date: "2026-10-15",
          category: "project",
          title: "Skin Lesion Classifier Deployment",
          role: "ML Architect",
          summary: "Published Dockerized inference API with ONNX runtime.",
          pointsAwarded: 15,
        },
      ])
      .onConflictDoNothing();

    await db
      .insert(schema.seasonalEvaluations)
      .values({
        seasonId,
        membershipId: salmaMember.id,
        seasonLabel: "Fall 2026",
        publishedAt: new Date("2026-10-25T12:00:00Z"),
        status: "complete",
        evaluatorRole: "Vice Chair",
        finalScore: 96,
        outOf: 100,
        bonusPoints: 4,
        grade: "Outstanding",
        criteria: [
          { id: "c1", label: "Technical Competence & Execution", earned: 25, max: 25, ratingOutOfFive: 5 },
          { id: "c2", label: "Committee Leadership & Mentorship", earned: 24, max: 25, ratingOutOfFive: 5 },
          { id: "c3", label: "Session Delivery & Knowledge Sharing", earned: 24, max: 25, ratingOutOfFive: 5 },
          { id: "c4", label: "Chapter Initiative & Cross-Team Support", earned: 23, max: 25, ratingOutOfFive: 5 },
        ],
      })
      .onConflictDoNothing();
  }

  console.log("✅ Seed completed successfully with snapshots, sessions, tasks, ledger, feedback, activities, and evaluations.");
}

// Allow direct execution via tsx/node if executed as main
if (process.argv[1]?.endsWith("seed.ts")) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Seed failed:", err);
      process.exit(1);
    });
}
