import { app } from "./app";
import { PORT } from "./env";

Bun.dns.prefetch("https://bsc-dataseed1.binance.org/");
Bun.dns.prefetch("https://bsc-dataseed2.binance.org/");
Bun.dns.prefetch("https://bsc-dataseed3.binance.org/");
Bun.dns.prefetch("https://bsc-dataseed4.binance.org/");
Bun.dns.prefetch("https://bsc-dataseed1.defibit.io/");
Bun.dns.prefetch("https://bsc-dataseed2.defibit.io/");

app.listen(PORT);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
