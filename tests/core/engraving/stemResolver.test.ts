import { describe, expect, it } from "vitest";

import { resolveStem } from "../../../src/core/engraving/index.js";

describe("stem resolver", () => {
  it("forces voice 1 stems up in multi-voice context", () => {
    const stem = resolveStem("n1", 3, 2, 1);
    expect(stem.direction).toBe("up");
  });

  it("forces voice 2 stems down in multi-voice context", () => {
    const stem = resolveStem("n2", 1, 2, 2);
    expect(stem.direction).toBe("down");
  });

  it("single voice follows pitch relative to center", () => {
    const low = resolveStem("n3", 1, 1, 1);
    const high = resolveStem("n4", 3, 1, 1);
    expect(low.direction).toBe("up");
    expect(high.direction).toBe("down");
  });
});
