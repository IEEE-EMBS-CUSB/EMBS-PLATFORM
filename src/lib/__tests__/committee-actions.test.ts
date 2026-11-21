import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  addCommitteeAsActor,
  removeCommitteeAsActor,
} from "@/services/hr-ops/committees.service";

describe("Committee Master Actions", () => {
  const createdCommitteeIds: string[] = [];

  afterEach(async () => {
    for (const id of createdCommitteeIds.splice(0)) {
      await db.delete(schema.committees).where(eq(schema.committees.id, id));
    }
  });

  it("allows master_admin to add and remove a committee in the database", async () => {
    const commName = `Test Committee ${Date.now()}`;

    const unauthAdd = await addCommitteeAsActor(
      { name: commName, category: "technical" },
      { profile: { role: "hr_admin" } }
    );
    expect(unauthAdd.ok).toBe(false);
    expect(unauthAdd.error).toMatch(/unauthorized/i);

    const addResult = await addCommitteeAsActor(
      { name: commName, category: "technical" },
      { profile: { role: "master_admin" } }
    );
    expect(addResult.ok).toBe(true);
    expect(addResult.committeeId).toBeDefined();
    createdCommitteeIds.push(addResult.committeeId!);

    const [inserted] = await db
      .select()
      .from(schema.committees)
      .where(eq(schema.committees.id, addResult.committeeId!));
    expect(inserted).toBeDefined();
    expect(inserted.category).toBe("technical");
    expect(inserted.slug).toMatch(/^test-committee-/);

    const unauthRemove = await removeCommitteeAsActor(inserted.id, {
      profile: { role: "hr_admin" },
    });
    expect(unauthRemove.ok).toBe(false);
    expect(unauthRemove.error).toMatch(/unauthorized/i);

    const removeResult = await removeCommitteeAsActor(inserted.id, {
      profile: { role: "master_admin" },
    });
    expect(removeResult.ok).toBe(true);

    const checkDeleted = await db
      .select()
      .from(schema.committees)
      .where(eq(schema.committees.id, inserted.id));
    expect(checkDeleted).toHaveLength(1);
    expect(checkDeleted[0].isActive).toBe(false);
  });
});
