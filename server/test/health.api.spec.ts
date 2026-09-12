import { describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { AppModule } from "../src/app.module.ts";

describe("GET /api/health", () => {
  it("returns ok", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    await app.init();

    const response = await request(app.getHttpServer()).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });

    await app.close();
  });
});
