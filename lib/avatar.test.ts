import { describe, expect, it } from "vitest";
import { safeAvatarUrl } from "./avatar";

describe("safeAvatarUrl", () => {
  it("acepta las fotos de Google", () => {
    expect(safeAvatarUrl("https://lh3.googleusercontent.com/a/abc=s96-c")).toBe(
      "https://lh3.googleusercontent.com/a/abc=s96-c",
    );
  });

  it("rechaza cualquier otro origen o esquema", () => {
    expect(safeAvatarUrl("https://atacant.example/pixel.gif")).toBeNull();
    expect(safeAvatarUrl("http://lh3.googleusercontent.com/a/abc")).toBeNull();
    expect(safeAvatarUrl("https://lh3.googleusercontent.com.atacant.example/x")).toBeNull();
    expect(safeAvatarUrl("javascript:alert(1)")).toBeNull();
    expect(safeAvatarUrl(null)).toBeNull();
  });
});
