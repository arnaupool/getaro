import { describe, expect, it } from "vitest";
import { bestWindows, dayLevel, nextStatus, selectableDays, summarize } from "./availability";
import { daysBetween, monthsInRange, weekdayMon0 } from "./dates";
import type { AvailabilityStatus } from "./types";

const rowsFor = (user_id: string, days: string[], status: AvailabilityStatus = "yes") =>
  days.map((day) => ({ user_id, day, status }));

describe("dates", () => {
  it("daysBetween incluye extremos, cruza meses y acepta orden inverso", () => {
    expect(daysBetween("2026-10-30", "2026-11-02")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(daysBetween("2026-11-02", "2026-11-01")).toEqual(["2026-11-01", "2026-11-02"]);
  });

  it("monthsInRange y weekdayMon0", () => {
    expect(monthsInRange("2026-10-15", "2026-12-01")).toEqual(["2026-10-01", "2026-11-01", "2026-12-01"]);
    expect(weekdayMon0("2026-10-05")).toBe(0); // lunes
    expect(weekdayMon0("2026-10-04")).toBe(6); // domingo
  });
});

describe("availability", () => {
  it("nextStatus rota vacío → sí → quizás → vacío", () => {
    expect(nextStatus(undefined)).toBe("yes");
    expect(nextStatus("yes")).toBe("maybe");
    expect(nextStatus("maybe")).toBeNull();
  });

  it("selectableDays recorta días pasados", () => {
    expect(selectableDays("2026-10-01", "2026-10-03", "2026-10-02")).toEqual(["2026-10-02", "2026-10-03"]);
    expect(selectableDays("2026-09-01", "2026-09-03", "2026-10-02")).toEqual([]);
  });

  it("dayLevel distingue todas sí / todas con quizás / parcial / nada", () => {
    const day = "2026-10-10";
    const level = (rows: { user_id: string; day: string; status: AvailabilityStatus }[]) =>
      dayLevel(summarize(rows, [day]).get(day), 2);
    expect(level([...rowsFor("a", [day]), ...rowsFor("b", [day])])).toBe("all-yes");
    expect(level([...rowsFor("a", [day]), ...rowsFor("b", [day], "maybe")])).toBe("all-maybe");
    expect(level(rowsFor("a", [day]))).toBe("partial");
    expect(level([])).toBe("none");
  });

  it("bestWindows prioriza la racha más larga donde pueden todas", () => {
    const days = daysBetween("2026-10-01", "2026-10-10");
    const shared = ["2026-10-02", "2026-10-03", "2026-10-04", "2026-10-07", "2026-10-08"];
    const rows = [...rowsFor("a", [...shared, "2026-10-10"]), ...rowsFor("b", shared)];
    const w = bestWindows(summarize(rows, days), days, 2);
    expect(w.map((x) => [x.start, x.end])).toEqual([
      ["2026-10-02", "2026-10-04"],
      ["2026-10-07", "2026-10-08"],
    ]);
    expect(w[0].minAvailable).toBe(2);
    expect(w[0].allYesDays).toBe(3);
  });

  it("bestWindows baja el umbral si nadie coincide del todo", () => {
    const days = daysBetween("2026-10-01", "2026-10-03");
    const rows = [...rowsFor("a", ["2026-10-01"]), ...rowsFor("b", ["2026-10-03"], "maybe")];
    const w = bestWindows(summarize(rows, days), days, 3);
    expect(w).toHaveLength(2);
    expect(w.every((x) => x.minAvailable === 1)).toBe(true);
  });

  it("bestWindows vacío si nadie ha marcado", () => {
    const days = daysBetween("2026-10-01", "2026-10-03");
    expect(bestWindows(summarize([], days), days, 3)).toEqual([]);
  });
});
