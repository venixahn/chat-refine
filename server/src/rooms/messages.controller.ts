import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request, Response } from "express";
import {
  postMessageSchema,
  type ChatMessage,
  type PostMessageInput,
} from "@chat-refine/shared";
import { SessionAuthGuard } from "../auth/session.guard.ts";
import type { PublicProfile } from "../db/schema.ts";
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

  @Post(":id/messages/upload")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: Number.MAX_SAFE_INTEGER } }),
  )
  upload(
    @Req() request: Request,
    @Param("id") id: string,
    @Body() body: { clientMessageId?: string; body?: string; createdAt?: string },
    @UploadedFile() file?: { originalname: string; mimetype: string; buffer: Buffer },
  ): Promise<ChatMessage> {
    return runRoomEffect(
      this.messages.postUpload(viewer(request).id, id, {
        clientMessageId: body.clientMessageId ?? "",
        body: body.body ?? "",
        createdAt: body.createdAt,
        file: file
          ? {
              name: file.originalname,
              mime: file.mimetype,
              buffer: file.buffer,
            }
          : undefined,
      }),
    );
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
    const payload = await runRoomEffect(
      this.messages.file(viewer(request).id, id, messageId),
    );
    this.sendFile(response, payload.attachment.name, payload.attachment.mime, payload.bytes);
  }

  private sendFile(
    response: Response,
    name: string,
    mime: string,
    bytes: Buffer,
  ): void {
    response.setHeader("Content-Type", mime);
    response.setHeader(
      "Content-Disposition",
      `inline; filename="${safeFilename(name)}"`,
    );
    response.send(bytes);
  }
}
