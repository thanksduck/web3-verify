export interface TransactionDetails {
  contract: string | null;
  toWalletAddress: string;
  fromWalletAddress: string;
  amount: string;
  datetime: string;
  blockNumber: number;
  gasUsed: string;
  gasPrice: string;
  transactionFee: string;
  status: boolean;
  tokenSymbol?: string;
  tokenDecimals?: string;
  isUSDT: boolean;
  tokenMismatch: boolean;
  expectedContract: string;
}
