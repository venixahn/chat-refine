import { Controller, Get, Inject, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { peopleQuerySchema, type PeopleQuery } from "@chat-refine/shared";
import type { PublicProfile } from "../db/schema.ts";
import { ZodValidationPipe } from "../http/zod-validation.pipe.ts";
import { SessionAuthGuard } from "../auth/session.guard.ts";
import { RoomsService } from "./rooms.service.ts";

@Controller("users")
@UseGuards(SessionAuthGuard)
export class UsersController {
  constructor(@Inject(RoomsService) private readonly rooms: RoomsService) {}

  @Get()
  list(
    @Req() request: Request,
    @Query(new ZodValidationPipe(peopleQuerySchema)) query: PeopleQuery,
  ): PublicProfile[] {
    return this.rooms.listPeople((request.user as PublicProfile).id, query.q);
  }
}
