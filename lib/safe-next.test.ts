import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

const BACKSLASH = String.fromCharCode(92);

describe("safeNextPath", () => {
  it("deja pasar rutas internas con parámetros", () => {
    expect(safeNextPath("/rooms/abc?tab=chat")).toBe("/rooms/abc?tab=chat");
    expect(safeNextPath("/join/ABCD2345")).toBe("/join/ABCD2345");
  });

  it("devuelve / si falta o no es una ruta", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath("")).toBe("/");
    expect(safeNextPath("rooms")).toBe("/");
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("javascript:alert(1)")).toBe("/");
  });

  it("bloquea los trucos para salir a otro dominio", () => {
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath(`/${BACKSLASH}evil.com`)).toBe("/");
    expect(safeNextPath(`/${BACKSLASH}${BACKSLASH}evil.com`)).toBe("/");
    expect(safeNextPath("/\t/evil.com")).toBe("/");
    expect(safeNextPath("/\n/evil.com")).toBe("/");
  });
});
