import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import {
  postMessageSchema,
  type ChatMessage,
  type PostMessageInput,
} from "@chat-refine/shared";
import { SessionAuthGuard } from "../auth/session.guard.ts";
import type { PublicProfile, StoredAttachment } from "../db/schema.ts";
import { ZodValidationPipe } from "../http/zod-validation.pipe.ts";
import { MessagesService } from "./messages.service.ts";
import { runRoomEffect } from "./rooms.http.ts";

const viewer = (request: Request): PublicProfile =>
  request.user as PublicProfile;

const safeFilename = (name: string): string => {
  const cleaned = name.replace(/[^\w.\- ()]/g, "_").slice(0, 180);
  return cleaned.length > 0 ? cleaned : "file";
};

@Controller("rooms")
@UseGuards(SessionAuthGuard)
export class MessagesController {
  constructor(
    @Inject(MessagesService) private readonly messages: MessagesService,
  ) {}

  @Get(":id/messages")
  list(
    @Req() request: Request,
    @Param("id") id: string,
  ): Promise<ChatMessage[]> {
    return runRoomEffect(this.messages.list(viewer(request).id, id));
  }

  @Post(":id/messages")
  create(
    @Req() request: Request,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(postMessageSchema)) body: PostMessageInput,
  ): Promise<ChatMessage> {
    return runRoomEffect(this.messages.post(viewer(request).id, id, body));
  }

  @Post(":id/read")
  async markRead(
    @Req() request: Request,
    @Param("id") id: string,
  ): Promise<{ ok: true }> {
    await runRoomEffect(this.messages.markRead(viewer(request).id, id));
    return { ok: true };
  }

  @Get(":id/messages/:messageId/file")
  async file(
    @Req() request: Request,
    @Param("id") id: string,
    @Param("messageId") messageId: string,
    @Res() response: Response,
  ): Promise<void> {
    const attachment = await runRoomEffect(
      this.messages.file(viewer(request).id, id, messageId),
    );
    this.sendFile(response, attachment);
  }

  private sendFile(response: Response, attachment: StoredAttachment): void {
    const bytes = Buffer.from(attachment.data, "base64");
    response.setHeader("Content-Type", attachment.mime);
    response.setHeader(
      "Content-Disposition",
      `inline; filename="${safeFilename(attachment.name)}"`,
    );
    response.send(bytes);
  }
}
