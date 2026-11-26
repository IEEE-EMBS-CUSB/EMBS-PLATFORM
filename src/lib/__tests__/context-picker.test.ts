import { describe, expect, it } from "vitest";
import {
  buildContextPickerModel,
  type ContextPickerOption,
} from "@/lib/context-picker";

describe("buildContextPickerModel", () => {
  it("never labels a committee head's personal view 'Member' and groups views under the Head heading", () => {
    const contexts: ContextPickerOption[] = [
      {
        membershipId: "m-head-pr",
        role: "committee_head",
        committeeName: "PR",
        trackedCommitteeName: null,
        managedTrackName: null,
      },
    ];

    const onPersonal = buildContextPickerModel({
      contexts,
      activeMembershipId: "m-head-pr",
      activePortal: "member",
    });

    expect(onPersonal.isInteractive).toBe(true);
    expect(onPersonal.activeHeading).toBe("PR · Head");
    expect(onPersonal.activeViewLabel).toBe("My work");
    expect(onPersonal.activeTriggerLabel).toBe("PR · Head · My work");
    expect(onPersonal.activeTriggerLabel).not.toMatch(/member/i);
    expect(onPersonal.groups).toHaveLength(1);
    expect(onPersonal.groups[0].heading).toBe("PR · Head");
    expect(onPersonal.groups[0].views.map((v) => [v.label, v.isActive])).toEqual([
      ["My work", true],
      ["Manage committee", false],
    ]);

    const onHr = buildContextPickerModel({
      contexts,
      activeMembershipId: "m-head-pr",
      activePortal: "hr",
    });
    expect(onHr.activeTriggerLabel).toBe("PR · Head · Manage committee");
    expect(onHr.groups[0].views.map((v) => [v.label, v.isActive])).toEqual([
      ["My work", false],
      ["Manage committee", true],
    ]);
  });

  it("gives hr_member both My work and Track <Committee> views under HR · Member", () => {
    const contexts: ContextPickerOption[] = [
      {
        membershipId: "m-hr-1",
        role: "hr_member",
        committeeName: "Human Resources",
        trackedCommitteeName: "AI and Machine Learning",
        managedTrackName: null,
      },
    ];

    const model = buildContextPickerModel({
      contexts,
      activeMembershipId: "m-hr-1",
      activePortal: "hr",
    });

    expect(model.isInteractive).toBe(true);
    expect(model.groups[0].heading).toBe("HR · Member");
    expect(model.activeTriggerLabel).toBe(
      "HR · Member · Track AI and Machine Learning"
    );
    expect(model.groups[0].views.map((v) => [v.label, v.viewMode, v.isActive])).toEqual([
      ["My work", "personal", false],
      ["Track AI and Machine Learning", "manage", true],
    ]);
  });

  it("handles multi-hat users (PR Head + AI Member + Robotics Attendee) with accurate active selection", () => {
    const contexts: ContextPickerOption[] = [
      {
        membershipId: "m-head-pr",
        role: "committee_head",
        committeeName: "PR",
        trackedCommitteeName: null,
        managedTrackName: null,
      },
      {
        membershipId: "m-mem-ai",
        role: "member",
        committeeName: "AI",
        trackedCommitteeName: null,
        managedTrackName: null,
      },
      {
        membershipId: "m-att-rob",
        role: "attendee",
        committeeName: "Robotics",
        trackedCommitteeName: null,
        managedTrackName: null,
      },
    ];

    const model = buildContextPickerModel({
      contexts,
      activeMembershipId: "m-mem-ai",
      activePortal: "member",
    });

    expect(model.isInteractive).toBe(true);
    expect(model.activeTriggerLabel).toBe("AI · Member · My work");
    expect(model.groups.map((g) => g.heading)).toEqual([
      "PR · Head",
      "AI · Member",
      "Robotics · Attendee",
    ]);
    expect(model.groups[0].views.every((v) => !v.isActive)).toBe(true);
    expect(model.groups[1].views[0].isActive).toBe(true);
    expect(model.groups[2].views[0].label).toBe("Attendee portal");
    expect(model.groups[2].views[0].isActive).toBe(false);
  });

  it("marks single-context users (member, attendee, master_admin, director, hr_admin) as non-interactive", () => {
    const singleMember = buildContextPickerModel({
      contexts: [
        {
          membershipId: "m-1",
          role: "member",
          committeeName: "Web Development",
          trackedCommitteeName: null,
          managedTrackName: null,
        },
      ],
      activeMembershipId: "m-1",
      activePortal: "member",
    });
    expect(singleMember.isInteractive).toBe(false);
    expect(singleMember.activeTriggerLabel).toBe("Web Development · Member");

    const singleDirector = buildContextPickerModel({
      contexts: [
        {
          membershipId: "m-dir",
          role: "director",
          committeeName: null,
          trackedCommitteeName: null,
          managedTrackName: "Technical",
        },
      ],
      activeMembershipId: "m-dir",
      activePortal: "hr",
    });
    expect(singleDirector.isInteractive).toBe(false);
    expect(singleDirector.activeTriggerLabel).toBe("Technical · Director");

    const singleMaster = buildContextPickerModel({
      contexts: [
        {
          membershipId: "m-master",
          role: "master_admin",
          committeeName: null,
          trackedCommitteeName: null,
          managedTrackName: null,
        },
      ],
      activeMembershipId: "m-master",
      activePortal: "hr",
    });
    expect(singleMaster.isInteractive).toBe(false);
    expect(singleMaster.activeTriggerLabel).toBe("Master Admin");

    const singleAttendee = buildContextPickerModel({
      contexts: [
        {
          membershipId: "m-att",
          role: "attendee",
          committeeName: null,
          trackedCommitteeName: null,
          managedTrackName: null,
        },
      ],
      activeMembershipId: "m-att",
      activePortal: "attendee",
    });
    expect(singleAttendee.isInteractive).toBe(false);
    expect(singleAttendee.activeTriggerLabel).toBe("Attendee");
  });

  it("renders one Track <Committee> hat per assigned committee under a single HR Member group", () => {
    const model = buildContextPickerModel({
      contexts: [
        {
          membershipId: "m-hr-1",
          role: "hr_member",
          committeeName: "Human Resources",
          trackedCommitteeId: "comm-ai",
          trackedCommitteeName: "AI & ML",
          trackedCommittees: [
            { id: "comm-ai", name: "AI & ML" },
            { id: "comm-robotics", name: "Robotics" },
          ],
          managedTrackName: null,
        },
      ],
      activeMembershipId: "m-hr-1",
      activeTrackedCommitteeId: "comm-robotics",
      activePortal: "hr",
    });

    expect(model.isInteractive).toBe(true);
    expect(model.groups).toHaveLength(1);
    expect(model.groups[0].heading).toBe("HR · Member");
    expect(model.groups[0].views.map((v) => v.label)).toEqual([
      "My work",
      "Track AI & ML",
      "Track Robotics",
    ]);
    expect(model.groups[0].views[0].isActive).toBe(false);
    expect(model.groups[0].views[1].isActive).toBe(false);
    expect(model.groups[0].views[1].trackedCommitteeId).toBe("comm-ai");
    expect(model.groups[0].views[2].isActive).toBe(true);
    expect(model.groups[0].views[2].trackedCommitteeId).toBe("comm-robotics");
    expect(model.activeTriggerLabel).toBe("HR · Member · Track Robotics");
  });
});
