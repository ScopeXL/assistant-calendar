import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Chip } from "./Chip";
import { Field, FormSection } from "./Field";
import { LengthField, lengthWords } from "./LengthField";
import { ChoiceRow, ValueRow } from "./ValueRow";

afterEach(cleanup);

describe("a row that shows its choice on its face (ADR 0030)", () => {
  it("is a label and one button named for both, with its picker closed", () => {
    const onToggle = vi.fn();
    render(
      <ValueRow label="Time" value="2:30 PM" expanded={false} onToggle={onToggle}>
        <p>the hours</p>
      </ValueRow>,
    );
    const button = screen.getByRole("button", { name: "Time: 2:30 PM" });
    expect(button.textContent).toBe("2:30 PM");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.hasAttribute("aria-controls")).toBe(false);
    expect(screen.queryByText("the hours")).toBeNull();
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("opens its picker in place under the row, tied to the button", () => {
    render(
      <ValueRow label="Time" value="2:30 PM" expanded onToggle={vi.fn()} hint="In your zone.">
        <p>the hours</p>
      </ValueRow>,
    );
    const button = screen.getByRole("button", { name: "Time: 2:30 PM" });
    const picker = screen.getByText("the hours").parentElement;
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.getAttribute("aria-controls")).toBe(picker?.id);
    expect(screen.getByText("In your zone.")).toBeTruthy();
  });

  it("a list of choices closes when one is picked", () => {
    function Remind() {
      const [value, setValue] = useState<number | null>(null);
      return (
        <ChoiceRow
          label="Remind"
          choices={[
            { value: null, label: "None" },
            { value: 10, label: "10 min before" },
            { value: 60, label: "1 hour before" },
          ]}
          value={value}
          onChange={setValue}
        />
      );
    }
    render(<Remind />);
    fireEvent.click(screen.getByRole("button", { name: "Remind: None" }));
    const list = screen.getByRole("radiogroup", { name: "Remind" });
    expect(
      within(list)
        .getAllByRole("radio")
        .map((choice) => choice.getAttribute("aria-checked")),
    ).toEqual(["true", "false", "false"]);
    fireEvent.click(within(list).getByRole("radio", { name: "1 hour before" }));
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.getByRole("button", { name: "Remind: 1 hour before" })).toBeTruthy();
  });
});

describe("how long something lasts (ADR 0030)", () => {
  function Length({ start }: { start: number }) {
    const [minutes, setMinutes] = useState(start);
    return <LengthField value={minutes} onChange={setMinutes} />;
  }

  it("says lengths the family's way", () => {
    expect([30, 45, 60, 90, 120, 135].map(lengthWords)).toEqual([
      "30 min",
      "45 min",
      "1 hour",
      "1½ hours",
      "2 hours",
      "2 h 15 min",
    ]);
  });

  it("offers the usual lengths as a list, and closes on one", () => {
    render(<Length start={60} />);
    fireEvent.click(screen.getByRole("button", { name: "How long: 1 hour" }));
    const list = screen.getByRole("radiogroup", { name: "How long" });
    expect(
      within(list)
        .getAllByRole("radio")
        .map((choice) => choice.textContent),
    ).toEqual(["30 min", "1 hour", "1½ hours", "2 hours", "3 hours"]);
    fireEvent.click(within(list).getByRole("radio", { name: "2 hours" }));
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.getByRole("button", { name: "How long: 2 hours" })).toBeTruthy();
  });

  it("shows an odd length as it is, and steps Other by quarter hours", () => {
    render(<Length start={50} />);
    const button = screen.getByRole("button", { name: "How long: 50 min" });
    fireEvent.click(button);
    // None of the usual ones is it.
    expect(
      screen
        .getAllByRole("radio")
        .filter((choice) => choice.getAttribute("aria-checked") === "true"),
    ).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "How long: other: more" }));
    expect(screen.getByRole("button", { name: "How long: 1 hour" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "How long: other: less" }));
    fireEvent.click(screen.getByRole("button", { name: "How long: other: less" }));
    expect(screen.getByRole("button", { name: "How long: 30 min" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "How long: other: less" }));
    // A quarter of an hour is as short as it goes.
    expect(screen.getByRole("button", { name: "How long: 15 min" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "How long: other: less" }).hasAttribute("disabled"),
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });
});

describe("a form's labels, sections and openers (ADR 0030)", () => {
  it("a field is a quiet label over its control, with a hint under it", () => {
    render(
      <Field label="Who" hint="Tap everyone it's for.">
        <button type="button">Mia</button>
      </Field>,
    );
    expect(screen.getByText("Who").className).toContain("text-ink-soft");
    expect(screen.getByText("Tap everyone it's for.")).toBeTruthy();
  });

  it("a section is named by its heading, drawn or not", () => {
    render(
      <>
        <FormSection title="What and Who" quiet>
          <p>the field</p>
        </FormSection>
        <FormSection title="When">
          <p>the day</p>
        </FormSection>
      </>,
    );
    expect(screen.getByRole("region", { name: "What and Who" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "What and Who" }).className).toBe("sr-only");
    expect(screen.getByRole("heading", { name: "When" }).className).not.toContain("sr-only");
  });

  it("a chip that opens something is never pressed, open or shut", () => {
    const { rerender } = render(
      <Chip opener expanded={false} onClick={vi.fn()}>
        More…
      </Chip>,
    );
    const chip = screen.getByRole("button", { name: "More…" });
    expect(chip.hasAttribute("aria-pressed")).toBe(false);
    expect(chip.getAttribute("aria-expanded")).toBe("false");
    rerender(
      <Chip opener expanded onClick={vi.fn()}>
        More…
      </Chip>,
    );
    expect(chip.hasAttribute("aria-pressed")).toBe(false);
    expect(chip.getAttribute("aria-expanded")).toBe("true");
    // A chip that is a choice still fills.
    rerender(
      <Chip on onClick={vi.fn()}>
        All day
      </Chip>,
    );
    expect(screen.getByRole("button", { name: "All day" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });
});
