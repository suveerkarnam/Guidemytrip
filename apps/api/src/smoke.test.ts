import { expect, it } from "vitest";
import { app } from "./app";

it("creates the API application", () => {
  expect(app).toBeDefined();
});
