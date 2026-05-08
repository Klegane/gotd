import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Calendar } from "@/components/Calendar";

describe("Calendar", () => {
  it("shows a session count when a day has multiple sessions", () => {
    const today = new Date().toISOString().slice(0, 10);
    const onSelectDate = vi.fn();

    render(
      <Calendar
        selectedDate={null}
        onSelectDate={onSelectDate}
        sessions={[
          { id: "session_1", localDate: today, status: "open" },
          { id: "session_2", localDate: today, status: "closed" }
        ]}
      />
    );

    const dayButton = screen.getByRole("button", { name: `${today}, 2 sesiones` });

    expect(dayButton.textContent).toContain("2");

    fireEvent.click(dayButton);

    expect(onSelectDate).toHaveBeenCalledWith(today);
  });
});
