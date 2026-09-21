/**
 * Domain entities for the DeskFlow application.
 */

export interface SessionEntity {
  id: string;
  timestamp: Date;
  app: string;
  duration: number;
  category: string;
  productivityScore: number;
}

export interface GoalEntity {
  id: string;
  title: string;
  description: string;
  category: string;
  target: { type: string; targetSeconds: number; matchCategory: boolean };
  period: string;
  status: string;
  date: string;
  createdAt: string;
  progressPct?: number;
}

export interface FinanceTransactionEntity {
  id: number;
  amount: number;
  currency: string;
  category: string;
  date: string;
  note?: string;
  walletId?: number;
  accountId?: number;
  type: string;
}

export interface FinanceAccountEntity {
  id: number;
  name: string;
  type: string;
  balance: number;
  isArchived: boolean;
}

export interface FinanceWalletEntity {
  id: number;
  name: string;
  type: string;
  isArchived: boolean;
  transferFeeType?: string;
  transferFeeValue?: number;
}
