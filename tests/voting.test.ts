import { describe, expect, it } from "vitest";

import {
  getBlockedCuratedGameRemovals,
  getDefaultSessionTitle,
  getLocalDateForTimeZone,
  InvalidSessionError,
  isSessionVisibleToUser,
  isValidLocalDate,
  isValidLocalTime,
  isVotableStatus,
  summarizeVoteRows,
  validateSessionMutationInput
} from "@/server/voting";

describe("daily voting helpers", () => {
  it("derives the configured local date", () => {
    const date = new Date("2026-04-16T22:30:00.000Z");

    expect(getLocalDateForTimeZone(date, "Europe/Madrid")).toBe("2026-04-17");
  });

  it("counts votes and selects a single leader", () => {
    const results = summarizeVoteRows([
      { gameId: "a", gameName: "Azul", thumbnailUrl: null },
      { gameId: "b", gameName: "Catan", thumbnailUrl: null },
      { gameId: "a", gameName: "Azul", thumbnailUrl: null }
    ]);

    expect(results.totalVotes).toBe(3);
    expect(results.leaders).toEqual([{ gameId: "a", gameName: "Azul", thumbnailUrl: null, votes: 2 }]);
  });

  it("keeps tied games when totals match", () => {
    const results = summarizeVoteRows([
      { gameId: "a", gameName: "Azul", thumbnailUrl: null },
      { gameId: "b", gameName: "Catan", thumbnailUrl: null }
    ]);

    expect(results.totalVotes).toBe(2);
    expect(results.leaders.map((leader) => leader.gameName)).toEqual(["Azul", "Catan"]);
  });

  it("does not choose a winner when no votes exist", () => {
    const results = summarizeVoteRows([]);

    expect(results.totalVotes).toBe(0);
    expect(results.leaders).toEqual([]);
    expect(results.items).toEqual([]);
  });

  it("validates session calendar dates and times", () => {
    expect(isValidLocalDate("2026-04-16")).toBe(true);
    expect(isValidLocalDate("2026-02-30")).toBe(false);
    expect(isValidLocalTime("19:30")).toBe(true);
    expect(isValidLocalTime("24:00")).toBe(false);
  });

  it("keeps draft sessions hidden from normal users", () => {
    expect(isSessionVisibleToUser("draft", false)).toBe(false);
    expect(isSessionVisibleToUser("draft", true)).toBe(true);
    expect(isSessionVisibleToUser("open", false)).toBe(true);
    expect(isVotableStatus("open")).toBe(true);
    expect(isVotableStatus("closed")).toBe(false);
  });

  it("normalizes scheduled session input", () => {
    expect(
      validateSessionMutationInput(
        {
          localDate: "2026-04-18",
          localStartTime: "20:00",
          localEndTime: "",
          title: "  Heavy games  ",
          notes: "  Bring snacks  ",
          status: "open"
        },
        true
      )
    ).toEqual({
      localDate: "2026-04-18",
      localStartTime: "20:00",
      localEndTime: null,
      title: "Heavy games",
      notes: "Bring snacks",
      status: "open"
    });

    expect(() => validateSessionMutationInput({ localDate: "tomorrow" }, true)).toThrow(InvalidSessionError);
  });

  it("uses a default title for daily sessions", () => {
    expect(getDefaultSessionTitle({ title: null, localDate: "2026-04-16" })).toBe("Jueves 16 de abril de 2026");
    expect(getDefaultSessionTitle({ title: "Friday night", localDate: "2026-04-16" })).toBe("Friday night");
  });

  it("blocks curated option removals when existing votes would be affected", () => {
    expect(getBlockedCuratedGameRemovals(["a", "b", "c"], ["a", "c"], ["b"])).toEqual(["b"]);
    expect(getBlockedCuratedGameRemovals(["a", "b"], ["a"], ["c"])).toEqual([]);
  });
});
