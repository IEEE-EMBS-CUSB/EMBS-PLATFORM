import { describe, expect, it } from "vitest";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  addCommitteeAction,
  removeCommitteeAction,
} from "@/app/hr/committees/actions";

describe("Committee Master Actions", () => {
  it("allows master_admin to add and remove a committee in the database", async () => {
    const commName = `Test Committee ${Date.now()}`;

    // 1. Unauthorized attempt by a non-master role
    const unauthAdd = await addCommitteeAction(
      {
        name: commName,
        category: "technical",
      },
      "hr_admin"
    );
    expect(unauthAdd.ok).toBe(false);
    expect(unauthAdd.error).toMatch(/unauthorized/i);

    // 2. Authorized addition by master_admin
    const addResult = await addCommitteeAction(
      {
        name: commName,
        category: "technical",
      },
      "master_admin"
    );
    expect(addResult.ok).toBe(true);
    expect(addResult.committeeId).toBeDefined();

    // Verify row in DB
    const [inserted] = await db
      .select()
      .from(schema.committees)
      .where(eq(schema.committees.name, commName));
    expect(inserted).toBeDefined();
    expect(inserted.category).toBe("technical");
    expect(inserted.slug).toMatch(/^test-committee-/);

    // 3. Unauthorized deletion attempt
    const unauthRemove = await removeCommitteeAction(inserted.id, "hr_admin");
    expect(unauthRemove.ok).toBe(false);
    expect(unauthRemove.error).toMatch(/unauthorized/i);

    // 4. Authorized deletion by master_admin
    const removeResult = await removeCommitteeAction(inserted.id, "master_admin");
    expect(removeResult.ok).toBe(true);

    // Verify row removed from DB
    const checkDeleted = await db
      .select()
      .from(schema.committees)
      .where(eq(schema.committees.id, inserted.id));
    expect(checkDeleted).toHaveLength(0);
  });
});
