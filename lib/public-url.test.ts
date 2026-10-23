import { describe, expect, it } from "vitest";
import { normalizePublicUrl, shareLink } from "./public-url";

describe("normalizePublicUrl", () => {
  it("se queda solo con el origen", () => {
    expect(normalizePublicUrl("https://getaro.apool.dev")).toBe("https://getaro.apool.dev");
    expect(normalizePublicUrl("  https://Getaro.Apool.dev/rooms?x=1#a ")).toBe("https://getaro.apool.dev");
    expect(normalizePublicUrl("http://192.168.1.150:3010/")).toBe("http://192.168.1.150:3010");
  });

  it("sin protocolo supone https", () => {
    expect(normalizePublicUrl("getaro.apool.dev")).toBe("https://getaro.apool.dev");
  });

  it("vacía significa usar la del navegador", () => {
    expect(normalizePublicUrl("   ")).toBe("");
  });

  it("rechaza lo que no es una dirección web", () => {
    expect(normalizePublicUrl("javascript:alert(1)")).toBeNull();
    expect(normalizePublicUrl("ftp://getaro.apool.dev")).toBeNull();
    expect(normalizePublicUrl("https://user:pass@getaro.apool.dev")).toBeNull();
    expect(normalizePublicUrl("https://")).toBeNull();
  });
});

describe("shareLink", () => {
  it("usa la dirección pública si la hay", () => {
    expect(shareLink("https://getaro.apool.dev", "/join/ABCD2345")).toBe("https://getaro.apool.dev/join/ABCD2345");
    expect(shareLink(null, "/join/ABCD2345")).toBe("/join/ABCD2345");
  });
});
