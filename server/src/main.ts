import "reflect-metadata";
import { createApp } from "./http/create-app.ts";

const port = Number(process.env.PORT ?? 3000);

async function bootstrap(): Promise<void> {
  const app = await createApp();
  await app.listen(port);
}

void bootstrap();
