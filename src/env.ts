import { env } from "bun";

/** Whether the enviornment is development or not */
export const isDev = env.NODE_ENV === "development";
/** Whether the enviornment is production or not
 * ```typescript
 * process.env.NODE_ENV==="production"
 * ```
 */
export const isProd = env.NODE_ENV === "production";

/** Other enviornment variables */
export const PORT = env.PORT ?? 7000;

// export const

export const RPC_URL1 = process.env.RPC_URL1 || "https://bsc.blockrazor.xyz";
export const RPC_URL2 =
  process.env.RPC_URL2 || "https://bsc-dataseed1.binance.org/";
export const RPC_URL3 =
  process.env.RPC_URL3 || "https://bsc-dataseed2.binance.org/";
export const RPC_URL4 =
  process.env.RPC_URL4 || "https://bsc-dataseed3.binance.org/";
export const RPC_URL5 =
  process.env.RPC_URL5 || "https://bsc-dataseed4.binance.org/";
