"use server";

import { revalidatePath } from "next/cache";
import { getActorContext, unauthorizedResult } from "@/lib/action-auth";
import { getServerSession } from "@/lib/session-cookie";
import {
  createTaskAsActor,
  gradeTaskSubmissionAsActor,
  submitMemberTask,
  type CreateTaskInput,
  type TaskTargetGroup,
  type TaskTargetType,
} from "@/services/hr-ops/tasks.service";

export type { CreateTaskInput, TaskTargetGroup, TaskTargetType };

function safeRevalidateTasks() {
  try {
    revalidatePath("/hr/tasks");
    revalidatePath("/hr");
    revalidatePath("/hr/ledger");
    revalidatePath("/hr/publishing");
    revalidatePath("/member/tasks");
    revalidatePath("/member/assignments");
    revalidatePath("/member");
    revalidatePath("/member/performance");
  } catch {
    // Outside Next.js request context
  }
}

export async function createTaskAction(input: CreateTaskInput) {
  const actor = await getActorContext();
  if (!actor) return unauthorizedResult();
  const res = await createTaskAsActor(input, actor);
  if (res.ok) safeRevalidateTasks();
  return res;
}

export async function gradeTaskSubmissionAction(input: {
  submissionId: string;
  effortScore: number;
  qualityScore: number;
  timelinessScore: number;
  notes?: string;
}) {
  const actor = await getActorContext();
  if (!actor) return unauthorizedResult();
  const res = await gradeTaskSubmissionAsActor(input, actor);
  if (res.ok) safeRevalidateTasks();
  return res;
}

export async function submitTaskAction(input: {
  taskId: string;
  submissionText?: string;
  submissionUrl?: string;
}) {
  const session = await getServerSession();
  if (!session) {
    return { ok: false, error: "Unauthorized: please sign in to submit deliverables." };
  }
  const res = await submitMemberTask(input, session.participantId);
  if (res.ok) safeRevalidateTasks();
  return res;
}
