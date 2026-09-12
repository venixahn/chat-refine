import { describe, expect, it } from "vitest";
import { HealthController } from "./health.controller.ts";

describe("HealthController", () => {
  it("reports ok", () => {
    const controller = new HealthController();
    expect(controller.status()).toEqual({ ok: true });
  });
});
