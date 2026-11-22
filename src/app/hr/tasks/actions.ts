"use server";

import { revalidatePath } from "next/cache";
import { getActorContext, unauthorizedResult } from "@/lib/action-auth";
import { getServerSession } from "@/lib/session-cookie";
import {
  createTaskAsActor,
  gradeTaskSubmissionAsActor,
  submitMemberTask,
  toggleMemberTaskCompletion,
  toggleTaskCompletionAsActor,
  type CreateTaskInput,
  type TaskTargetGroup,
  type TaskTargetType,
} from "@/services/hr-ops/tasks.service";

export type { CreateTaskInput, TaskTargetGroup, TaskTargetType };

function safeRevalidateTasks() {
  try {
    revalidatePath("/hr", "layout");
    revalidatePath("/member", "layout");
    revalidatePath("/attendee", "layout");
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

export async function toggleTaskCompletionAction(input: {
  taskId: string;
  completed: boolean;
}) {
  const session = await getServerSession();
  if (!session) {
    return { ok: false, error: "Unauthorized: please sign in to update tasks." };
  }
  const res = await toggleMemberTaskCompletion(input, session.participantId);
  if (res.ok) safeRevalidateTasks();
  return res;
}

export async function hrToggleTaskCompletionAction(input: {
  submissionId: string;
  completed: boolean;
}) {
  const actor = await getActorContext();
  if (!actor) return unauthorizedResult();
  const res = await toggleTaskCompletionAsActor(input, actor);
  if (res.ok) safeRevalidateTasks();
  return res;
}
