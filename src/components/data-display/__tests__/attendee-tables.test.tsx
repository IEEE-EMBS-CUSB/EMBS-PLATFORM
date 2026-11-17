import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AttendeeAssignmentTable } from "@/components/data-display/attendee-assignment-table";
import { AttendeeSessionTable } from "@/components/data-display/attendee-session-table";
import type { AttendeeAssignment, AttendeeSessionRecord } from "@/types";

const SAMPLE_SESSIONS: AttendeeSessionRecord[] = [
  {
    id: "s1",
    date: "2026-10-17",
    sessionTitle: "Intro to Biomedical Signal Filtering",
    committeeName: "AI and Machine Learning",
    deliveredBy: "Salma El-Sayed",
    status: "attended",
    arrival: "on_time",
  },
];

const SAMPLE_ASSIGNMENTS: AttendeeAssignment[] = [
  {
    id: "a1",
    title: "Assignment 3: Notch & Bandpass ECG Filter",
    sessionTitle: "Intro to Biomedical Signal Filtering",
    dueDate: "2026-10-23",
    submittedAt: "2026-10-22",
    status: "graded",
    mark: 19,
    maxMark: 20,
    instructorNote: "Clean baseline wander removal.",
  },
  {
    id: "a2",
    title: "Assignment 4: Confusion Matrix Lab",
    sessionTitle: "Evaluating Medical Image Classifiers",
    dueDate: "2026-11-05",
    status: "pending",
    mark: null,
    maxMark: 20,
  },
];

describe("Attendee tables", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders session attendance history with presenter, committee, and status across mobile and desktop views", () => {
    render(<AttendeeSessionTable sessions={SAMPLE_SESSIONS} />);

    expect(
      screen.getAllByText("Intro to Biomedical Signal Filtering").length
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/AI and Machine Learning/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Salma El-Sayed/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Attended").length).toBeGreaterThanOrEqual(1);
  });

  it("renders empty state when attendee has no recorded sessions", () => {
    render(<AttendeeSessionTable sessions={[]} />);
    expect(screen.getByText(/no sessions recorded yet/i)).toBeInTheDocument();
  });

  it("renders assignment marks, pending state, and instructor notes without member-only metrics", () => {
    render(<AttendeeAssignmentTable assignments={SAMPLE_ASSIGNMENTS} />);

    expect(
      screen.getAllByText("Assignment 3: Notch & Bandpass ECG Filter").length
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("19 / 20").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Clean baseline wander removal.").length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Assignment 4: Confusion Matrix Lab").length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.queryByText(/monthly score|bonus|rank/i)
    ).not.toBeInTheDocument();
  });

  it("renders empty state when attendee has no assignments", () => {
    render(<AttendeeAssignmentTable assignments={[]} />);
    expect(screen.getByText(/no assignments posted yet/i)).toBeInTheDocument();
  });
});
