import { describe, expect, it } from "vitest";
import { googleMapsUrl } from "./maps";

describe("googleMapsUrl", () => {
  it("busca el lugar escrito, codificado", () => {
    expect(googleMapsUrl(" Bar Tío Pepe, C/ Major 3 & 4 ")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Bar%20T%C3%ADo%20Pepe%2C%20C%2F%20Major%203%20%26%204",
    );
  });
});
