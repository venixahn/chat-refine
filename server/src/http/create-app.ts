import { NestFactory } from "@nestjs/core";
import { WsAdapter } from "@nestjs/platform-ws";
import session from "express-session";
import passport from "passport";
import { AppModule } from "../app.module.ts";

export const createApp = async () => {
  const testing = process.env.VITEST === "true";
  const app = await NestFactory.create(AppModule, {
    logger: testing ? false : ["error", "warn", "log"],
  });
  app.useWebSocketAdapter(new WsAdapter(app));
  app.setGlobalPrefix("api");
  app.use(
    session({
      name: "chat.sid",
      secret: process.env.SESSION_SECRET ?? "dev-only-change-me",
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, sameSite: "lax" },
    }),
  );
  app.use(passport.initialize());
  app.use(passport.session());
  return app;
};
