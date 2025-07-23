import { t } from "elysia";

export const transactionHashField = t.Lowercase(
  t.String({
    minLength: 66,
    maxLength: 66,
    title: "Transaction Hash",
    description: "Enter the transaction hash",
    error: "Invalid transaction hash",
    pattern: "^0x[0-9a-fA-F]{64}$",
    examples: [
      "0x392d23bf9b35ff64220a8defdd80f68ac81ff4959b225a77eab40ce3d8d5700b",
    ],
  }),
);
