import { describe, expect, it } from "vitest";

import { formatSolveTime, formatTime, parseTimeInput } from "./time";

describe("formatTime", () => {
  it("formate sous la minute", () => {
    expect(formatTime(12340)).toBe("12.34");
    expect(formatTime(12345, { precision: 3 })).toBe("12.345");
  });
  it("formate avec minutes", () => {
    expect(formatTime(83450)).toBe("1:23.45");
    expect(formatTime(5000, { alwaysMinutes: true })).toBe("0:05.00");
  });
  it("gère les valeurs invalides", () => {
    expect(formatTime(-1)).toBe("—");
  });
  it("tronque au lieu d'arrondir (convention speedcubing)", () => {
    expect(formatTime(12648)).toBe("12.64"); // pas 12.65
    expect(formatTime(12648, { precision: 3 })).toBe("12.648");
    expect(formatTime(999)).toBe("0.99"); // pas 1.00
    expect(formatTime(83999)).toBe("1:23.99");
  });
});

describe("formatSolveTime", () => {
  it("affiche DNF", () => {
    expect(formatSolveTime(null, "dnf")).toBe("DNF");
  });
  it("affiche le suffixe +2", () => {
    expect(formatSolveTime(14340, "plus2")).toBe("14.34+");
  });
  it("affiche un temps normal", () => {
    expect(formatSolveTime(12340, "none")).toBe("12.34");
  });
});

describe("parseTimeInput", () => {
  it("parse SS.cc", () => {
    expect(parseTimeInput("12.34")).toBe(12340);
    expect(parseTimeInput("12.345")).toBe(12345);
    expect(parseTimeInput("83.2")).toBe(83200);
  });
  it("parse M:SS.cc", () => {
    expect(parseTimeInput("1:23.45")).toBe(83450);
    expect(parseTimeInput("1:02")).toBe(62000);
  });
  it("rejette les entrées invalides", () => {
    expect(parseTimeInput("abc")).toBeNull();
    expect(parseTimeInput("1:99")).toBeNull();
    expect(parseTimeInput("")).toBeNull();
  });
});
