import { app } from "./app";
import { PORT } from "./env";

app.listen(PORT);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
