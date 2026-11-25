import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MemberCombobox,
  MemberMultiCombobox,
  type MemberComboboxOption,
} from "@/components/ui/member-combobox";

const SAMPLE_MEMBERS: MemberComboboxOption[] = [
  {
    id: "m-1",
    fullName: "Salma El-Sayed",
    email: "salma@cu.edu.eg",
    committeeName: "AI and Machine Learning",
    roleLabel: "Head",
  },
  {
    id: "m-2",
    fullName: "Omar Tarek",
    email: "omar@cu.edu.eg",
    phoneNumber: "+201019716969",
    committeeName: "Robotics and Automation",
    roleLabel: "Member",
  },
  {
    id: "m-3",
    fullName: "Nourhan Khaled",
    email: "nourhan@cu.edu.eg",
    committeeName: "Graphic Design",
    roleLabel: "Member",
  },
];

describe("CP3 UI Primitives — Card padding & MemberCombobox", () => {
  it("renders Card without outer py-(--card-spacing) white top/bottom strips", () => {
    const { container } = render(
      <Card>
        <CardHeader className="border-b bg-[#fafafa]">
          <CardTitle>Flush Header</CardTitle>
        </CardHeader>
        <CardContent className="p-0">Table Body</CardContent>
      </Card>
    );

    const cardEl = container.querySelector('[data-slot="card"]');
    expect(cardEl).not.toBeNull();
    expect(cardEl?.className).not.toContain("py-(--card-spacing)");
    expect(cardEl?.className).not.toContain("gap-(--card-spacing)");
  });

  it("filters member suggestions by name, email, or committee and selects with click or keyboard", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <MemberCombobox
        id="test-member-picker"
        options={SAMPLE_MEMBERS}
        value=""
        onChange={onChange}
        placeholder="Type a member name..."
      />
    );

    const input = screen.getByPlaceholderText("Type a member name...");
    await user.click(input);
    await user.type(input, "omar");

    expect(screen.getByText("Omar Tarek")).toBeInTheDocument();
    expect(screen.queryByText("Salma El-Sayed")).not.toBeInTheDocument();

    await user.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith("m-2");
  });

  it("filters by committee name and allows clearing selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <MemberCombobox
        id="test-member-picker-2"
        options={SAMPLE_MEMBERS}
        value="m-3"
        onChange={onChange}
      />
    );

    const input = screen.getByRole("combobox");
    expect(input).toHaveValue("Nourhan Khaled");

    const clearBtn = screen.getByRole("button", { name: /clear selection/i });
    await user.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("filters member suggestions by local phone number digits", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <MemberCombobox
        id="test-member-picker-phone"
        options={SAMPLE_MEMBERS}
        value=""
        onChange={onChange}
      />
    );

    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.type(input, "01019716969");

    expect(screen.getByText("Omar Tarek")).toBeInTheDocument();
    expect(screen.queryByText("Salma El-Sayed")).not.toBeInTheDocument();

    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("m-2");
  });

  it("portals the dropdown listbox to document.body with fixed positioning so overflow-hidden cards cannot clip it", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Card>
        <CardContent className="p-4">
          <MemberCombobox
            id="card-clipped-combobox"
            options={SAMPLE_MEMBERS}
            value=""
            onChange={() => {}}
          />
        </CardContent>
      </Card>
    );

    const cardEl = container.querySelector('[data-slot="card"]')!;
    const input = screen.getByRole("combobox");
    await user.click(input);

    const listbox = screen.getByRole("listbox");
    expect(cardEl.contains(listbox)).toBe(false);
    expect(document.body.contains(listbox)).toBe(true);
    expect(listbox.className).toContain("fixed");
  });

  it("supports selecting and removing multiple people using MemberMultiCombobox backed by MemberCombobox", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    const { rerender } = render(
      <MemberMultiCombobox
        id="multi-instructor-picker"
        options={SAMPLE_MEMBERS}
        values={[]}
        onChange={onChange}
        ariaLabel="Select session instructors"
        placeholder="Search instructors..."
      />
    );

    const input = screen.getByRole("combobox", {
      name: /select session instructors/i,
    });
    await user.click(input);
    await user.type(input, "salma");
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenLastCalledWith(["m-1"]);

    // Rerender with m-1 selected: chip appears and m-1 is excluded from dropdown options
    rerender(
      <MemberMultiCombobox
        id="multi-instructor-picker"
        options={SAMPLE_MEMBERS}
        values={["m-1"]}
        onChange={onChange}
        ariaLabel="Select session instructors"
        placeholder="Search instructors..."
      />
    );

    expect(screen.getByText("Salma El-Sayed")).toBeInTheDocument();
    await user.click(input);
    expect(screen.queryByRole("option", { name: /salma el-sayed/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: /omar tarek/i }));
    expect(onChange).toHaveBeenLastCalledWith(["m-1", "m-2"]);

    // Rerender with both selected and remove Salma
    rerender(
      <MemberMultiCombobox
        id="multi-instructor-picker"
        options={SAMPLE_MEMBERS}
        values={["m-1", "m-2"]}
        onChange={onChange}
        ariaLabel="Select session instructors"
        placeholder="Search instructors..."
      />
    );

    await user.click(
      screen.getByRole("button", { name: /remove salma el-sayed/i })
    );
    expect(onChange).toHaveBeenLastCalledWith(["m-2"]);
  });
});
