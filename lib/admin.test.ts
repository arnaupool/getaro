import { describe, expect, it } from "vitest";
import { describeAudit, isAuditCategory, type AuditRow } from "./admin";
import { DICTIONARIES } from "./i18n/dictionaries";

const row = (action: string, details: AuditRow["details"], actor_id: string | null = "u1"): AuditRow => ({
  id: 1,
  at: "2026-10-13T10:00:00Z",
  actor_id,
  action,
  room_id: null,
  target_user_id: null,
  details,
});

describe("describeAudit", () => {
  const ca = DICTIONARIES.ca;
  const es = DICTIONARIES.es;

  it("rellena quién, a quién y dónde", () => {
    const r = row("member_removed", { actor_name: "Marta", target_name: "Laura", room_name: "Divendres" });
    expect(describeAudit(r, ca)).toBe("Marta ha tret Laura de «Divendres»");
    expect(describeAudit(r, es)).toBe("Marta ha sacado a Laura de «Divendres»");
  });

  it("usa 'El sistema' sin actor y 'Algú' si el actor ya no existe", () => {
    expect(describeAudit(row("room_deleted", { room_name: "X" }, null), ca)).toBe("El sistema ha esborrat la sala «X»");
    expect(describeAudit(row("room_deleted", { room_name: "X" }), ca)).toBe("Algú ha esborrat la sala «X»");
  });

  it("muestra la acción tal cual si no tiene texto", () => {
    expect(describeAudit(row("algo_nuevo", {}), ca)).toBe("Algo_nuevo");
  });

  it("isAuditCategory solo acepta las categorías conocidas", () => {
    expect(isAuditCategory("rooms")).toBe(true);
    expect(isAuditCategory("toString")).toBe(false);
    expect(isAuditCategory(undefined)).toBe(false);
  });
});
