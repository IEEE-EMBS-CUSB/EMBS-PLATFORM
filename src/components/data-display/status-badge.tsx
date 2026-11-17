import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  ActivityCategory,
  ArrivalStatus,
  AttendanceStatus,
  AttendeeAssignmentStatus,
  MemberTaskStatus,
  ReviewType,
} from "@/types";

const ATTENDANCE_STYLES: Record<
  AttendanceStatus,
  { label: string; className: string }
> = {
  attended: {
    label: "Attended",
    className: "bg-[#eaf5dd] text-[#2f600b] border-[#78be20]/30",
  },
  excused: {
    label: "Excused",
    className: "bg-[#ebf3f8] text-[#004c7a] border-[#00629b]/25",
  },
  absent: {
    label: "Absent",
    className: "bg-[#fdebed] text-[#9b0b27] border-[#ba0c2f]/25",
  },
};

const LATE_STYLE = {
  label: "Late",
  className: "bg-[#fff6dc] text-[#7a5400] border-[#ffc627]/50",
};

const MEMBER_TASK_STYLES: Record<
  MemberTaskStatus,
  { label: string; className: string }
> = {
  completed: {
    label: "Completed",
    className: "bg-[#eaf5dd] text-[#2f600b] border-[#78be20]/30",
  },
  in_progress: {
    label: "In progress",
    className: "bg-[#ebf3f8] text-[#004c7a] border-[#00629b]/25",
  },
  not_started: {
    label: "Not started",
    className: "bg-muted text-muted-foreground border-border",
  },
};

const ATTENDEE_ASSIGNMENT_STYLES: Record<
  AttendeeAssignmentStatus,
  { label: string; className: string }
> = {
  graded: {
    label: "Graded",
    className: "bg-[#eaf5dd] text-[#2f600b] border-[#78be20]/30",
  },
  submitted: {
    label: "Submitted",
    className: "bg-[#ebf3f8] text-[#004c7a] border-[#00629b]/25",
  },
  pending: {
    label: "Pending",
    className: "bg-[#fff6dc] text-[#7a5400] border-[#ffc627]/50",
  },
  missed: {
    label: "Missed",
    className: "bg-[#fdebed] text-[#9b0b27] border-[#ba0c2f]/25",
  },
};

const ACTIVITY_STYLES: Record<
  ActivityCategory,
  { label: string; className: string }
> = {
  project: {
    label: "Project",
    className: "bg-[#ebf3f8] text-[#002855] border-[#00629b]/25",
  },
  hackathon: {
    label: "Hackathon",
    className: "bg-[#f5edf7] text-[#5a1b63] border-[#772583]/25",
  },
  delivered_session: {
    label: "Delivered session",
    className: "bg-[#e3f5f6] text-[#005b5e] border-[#009ca6]/30",
  },
  bonus: {
    label: "Bonus",
    className: "bg-[#eaf5dd] text-[#2f600b] border-[#78be20]/35",
  },
};

const REVIEW_TYPE_STYLES: Record<
  ReviewType,
  { label: string; className: string }
> = {
  recognition: {
    label: "Recognition",
    className: "bg-[#eaf5dd] text-[#2f600b] border-[#78be20]/35",
  },
  performance_review: {
    label: "Performance review",
    className: "bg-[#f5edf7] text-[#5a1b63] border-[#772583]/25",
  },
  score_correction: {
    label: "Score correction",
    className: "bg-[#ebf3f8] text-[#002855] border-[#00629b]/25",
  },
  excused_absence: {
    label: "Excused absence",
    className: "bg-[#e3f5f6] text-[#005b5e] border-[#009ca6]/30",
  },
  warning: {
    label: "Warning",
    className: "bg-[#fdebed] text-[#9b0b27] border-[#ba0c2f]/25",
  },
  appeal: {
    label: "Appeal",
    className: "bg-[#fff6dc] text-[#7a5400] border-[#ffc627]/50",
  },
  other: {
    label: "HR note",
    className: "bg-muted text-foreground border-border",
  },
};

export function AttendanceStatusBadge({
  status,
  arrival,
}: {
  status: AttendanceStatus;
  arrival?: ArrivalStatus;
}) {
  const style =
    status === "attended" && arrival === "late"
      ? LATE_STYLE
      : ATTENDANCE_STYLES[status];

  return (
    <Badge
      variant="outline"
      className={cn("font-semibold border", style.className)}
    >
      {style.label}
    </Badge>
  );
}

export function MemberTaskStatusBadge({
  status,
}: {
  status: MemberTaskStatus;
}) {
  const style = MEMBER_TASK_STYLES[status];
  return (
    <Badge
      variant="outline"
      className={cn("font-semibold border", style.className)}
    >
      {style.label}
    </Badge>
  );
}

export function TaskStatusBadge({
  status,
}: {
  status: AttendeeAssignmentStatus;
}) {
  const style = ATTENDEE_ASSIGNMENT_STYLES[status];
  return (
    <Badge
      variant="outline"
      className={cn("font-semibold border", style.className)}
    >
      {style.label}
    </Badge>
  );
}

export function ActivityCategoryBadge({
  category,
}: {
  category: ActivityCategory;
}) {
  const style = ACTIVITY_STYLES[category];
  return (
    <Badge
      variant="outline"
      className={cn("font-semibold border", style.className)}
    >
      {style.label}
    </Badge>
  );
}

export function ReviewTypeBadge({ reviewType }: { reviewType: ReviewType }) {
  const style = REVIEW_TYPE_STYLES[reviewType];
  return (
    <Badge
      variant="outline"
      className={cn("font-semibold border", style.className)}
    >
      {style.label}
    </Badge>
  );
}
