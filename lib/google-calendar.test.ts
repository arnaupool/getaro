import { describe, expect, it } from "vitest";
import { googleCalendarUrl } from "./google-calendar";

const base = { title: "Sopar d'octubre", location: null, details: "Quedada" };
const param = (url: string, name: string) => new URL(url).searchParams.get(name);

describe("googleCalendarUrl", () => {
  it("un día sin hora es de día completo, con el final al día siguiente", () => {
    const url = googleCalendarUrl({ ...base, start: "2026-10-18", end: "2026-10-18", time: null });
    expect(url.startsWith("https://calendar.google.com/calendar/render?action=TEMPLATE")).toBe(true);
    expect(param(url, "dates")).toBe("20261018/20261019");
    expect(param(url, "ctz")).toBeNull();
  });

  it("un rango sin hora cubre todos los días, cruzando de mes", () => {
    const url = googleCalendarUrl({ ...base, start: "2026-10-30", end: "2026-11-01", time: null });
    expect(param(url, "dates")).toBe("20261030/20261102");
  });

  it("con hora dura 2 horas y lleva la zona horaria de España", () => {
    const url = googleCalendarUrl({ ...base, start: "2026-10-18", end: "2026-10-18", time: "21:30:00" });
    expect(param(url, "dates")).toBe("20261018T213000/20261018T233000");
    expect(param(url, "ctz")).toBe("Europe/Madrid");
  });

  it("si pasa de medianoche, termina al día siguiente", () => {
    const url = googleCalendarUrl({ ...base, start: "2026-12-31", end: "2026-12-31", time: "23:00" });
    expect(param(url, "dates")).toBe("20261231T230000/20270101T010000");
  });

  it("rango con hora: empieza el primer día y acaba el último", () => {
    const url = googleCalendarUrl({ ...base, start: "2026-10-17", end: "2026-10-18", time: "10:00" });
    expect(param(url, "dates")).toBe("20261017T100000/20261018T120000");
  });

  it("codifica título, lugar y detalles con acentos y símbolos", () => {
    const url = googleCalendarUrl({
      ...base,
      title: "Sopar & copes: «Ca la Núria»",
      location: "Plaça de l'Ajuntament, 3",
      details: "Línia 1\nhttps://getaro.apool.dev/rooms/a/events/b",
      start: "2026-10-18",
      end: "2026-10-18",
      time: null,
    });
    expect(param(url, "text")).toBe("Sopar & copes: «Ca la Núria»");
    expect(param(url, "location")).toBe("Plaça de l'Ajuntament, 3");
    expect(param(url, "details")).toBe("Línia 1\nhttps://getaro.apool.dev/rooms/a/events/b");
    expect(url).not.toContain(" ");
  });
});
