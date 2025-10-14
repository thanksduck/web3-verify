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
      "0xe2c48053a3bf3b195a8580905a2810ee7bbf014a2f6045ea52d2ed2a1c9f9e12",
    ],
  }),
);
