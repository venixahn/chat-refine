import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  status(): { ok: true } {
    return { ok: true };
  }
}
