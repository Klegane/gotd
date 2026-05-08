import { describe, expect, it } from "vitest";

import { applyPreferenceMap, isPreferenceState } from "@/server/preferences";

describe("game preference helpers", () => {
  it("accepts only supported preference states", () => {
    expect(isPreferenceState("favorite")).toBe(true);
    expect(isPreferenceState("vetoed")).toBe(true);
    expect(isPreferenceState("blocked")).toBe(false);
  });

  it("adds current-user preference metadata to games", () => {
    const games = [
      { id: "a", name: "Azul" },
      { id: "b", name: "Catan" },
      { id: "c", name: "Heat" }
    ];

    expect(
      applyPreferenceMap(
        games,
        new Map([
          ["a", "favorite"],
          ["b", "vetoed"]
        ])
      )
    ).toEqual([
      { id: "a", name: "Azul", preference: "favorite" },
      { id: "b", name: "Catan", preference: "vetoed" },
      { id: "c", name: "Heat", preference: null }
    ]);
  });
});
