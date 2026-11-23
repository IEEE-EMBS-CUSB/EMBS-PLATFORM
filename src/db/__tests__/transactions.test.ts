import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, withTransaction } from "@/db";
import * as schema from "@/db/schema";

describe("Transactional multi-write atomicity (withTransaction)", () => {
  const createdPersonIds: string[] = [];

  afterEach(async () => {
    for (const id of createdPersonIds.splice(0)) {
      await db.delete(schema.persons).where(eq(schema.persons.id, id));
    }
  });

  it("rolls back all earlier writes when a later statement inside withTransaction fails", async () => {
    const email = `tx-rollback-${Date.now()}@cu.edu.eg`;

    await expect(
      withTransaction(async (tx) => {
        await tx.insert(schema.persons).values({
          email,
          fullName: "Rollback Test Person",
          mustChangePassword: true,
          isActive: true,
        });

        // Simulate a failure in step 2 (e.g., FK/network/constraint failure)
        throw new Error("Simulated second-step write failure");
      })
    ).rejects.toThrow("Simulated second-step write failure");

    const rows = await db
      .select()
      .from(schema.persons)
      .where(eq(schema.persons.email, email));
    expect(rows).toHaveLength(0);
  });

  it("commits all writes durably when withTransaction succeeds", async () => {
    const email = `tx-commit-${Date.now()}@cu.edu.eg`;

    const insertedId = await withTransaction(async (tx) => {
      const [row] = await tx
        .insert(schema.persons)
        .values({
          email,
          fullName: "Commit Test Person",
          mustChangePassword: true,
          isActive: true,
        })
        .returning({ id: schema.persons.id });
      return row.id;
    });
    createdPersonIds.push(insertedId);

    const [persisted] = await db
      .select()
      .from(schema.persons)
      .where(eq(schema.persons.id, insertedId));
    expect(persisted).toBeDefined();
    expect(persisted.email).toBe(email);
  });
});
