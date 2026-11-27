import { describe, expect, it } from "vitest";
import { environmentSchema } from "./index";

describe("shared environment contract", () => {
  it("provides safe development defaults", () => {
    expect(environmentSchema.parse({}).API_PORT).toBe(4000);
  });
});
