import { describe, expect, it } from "vitest";

import { isActiveParticipantStatus, isParticipantStatus } from "@/server/participants";

describe("participant helpers", () => {
  it("recognizes supported statuses", () => {
    expect(isParticipantStatus("invited")).toBe(true);
    expect(isParticipantStatus("accepted")).toBe(true);
    expect(isParticipantStatus("declined")).toBe(true);
    expect(isParticipantStatus("waiting")).toBe(false);
  });

  it("treats declined and absent users as inactive for veto fallback", () => {
    expect(isActiveParticipantStatus("invited")).toBe(true);
    expect(isActiveParticipantStatus("accepted")).toBe(true);
    expect(isActiveParticipantStatus("maybe")).toBe(true);
    expect(isActiveParticipantStatus("attended")).toBe(true);
    expect(isActiveParticipantStatus("declined")).toBe(false);
    expect(isActiveParticipantStatus("absent")).toBe(false);
  });
});
