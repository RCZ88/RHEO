/**
 * Repository interfaces for the DeskFlow domain layer.
 */

import Database from 'better-sqlite3';

export interface GoalRepository {
  getByDate(date: string): Promise<any[]>;
  getBatch(startDate: string, endDate: string): Promise<any[]>;
  getHabits(startDate: string, endDate: string): Promise<any[]>;
  save(goal: any): Promise<void>;
  delete(goalId: string): Promise<void>;
  getLongterm(): Promise<any[]>;
  getReview(date: string): Promise<any>;
  saveReview(date: string, reviewSummary: string): Promise<void>;
  getSuggestion(date: string): Promise<any>;
  getById(goalId: string): Promise<any>;
  getChildGoals(parentId: string): Promise<any[]>;
  saveBatch(goals: any[]): Promise<void>;
  linkToEntity(goalId: string, link: { type: 'problem' | 'request'; id: string; label?: string }): Promise<void>;
  unlinkFromEntity(goalId: string, type: 'problem' | 'request', entityId: string): Promise<void>;
  getDailyProgress(date: string, goals: any[]): Promise<any>;
  getTimeline(date: string): Promise<any>;
  getContext(date: string): Promise<any>;
}

export interface FinanceRepository {
  getAccounts(): Promise<any[]>;
  createAccount(data: any): Promise<void>;
  updateAccount(data: any): Promise<void>;
  archiveAccount(id: number): Promise<void>;
  getWallets(accountId?: number): Promise<any[]>;
  createWallet(data: any): Promise<void>;
  updateWallet(data: any): Promise<void>;
  updateWalletFees(data: { id: number; transfer_fee_type: string; transfer_fee_value: number }): Promise<void>;
  adjustBalance(data: { id: number; newBalance: number }): Promise<void>;
  updateInitialBalance(data: { id: number; initialBalance: number; password: string }): Promise<void>;
  archiveWallet(id: number): Promise<void>;
  getWallet(id: number): Promise<any>;
  updateWalletMetadata(data: { id: number; metadata: Record<string, any> }): Promise<void>;
  getTransactions(filters?: any): Promise<any[]>;
  createTransaction(data: any): Promise<void>;
  updateTransaction(data: any): Promise<void>;
  deleteTransaction(id: number): Promise<void>;
  getSummary(): Promise<any>;
  getSpendingByCategory(): Promise<any>;
  getMonthlyTrends(): Promise<any>;
  getCryptoPortfolio(walletId: number): Promise<any>;
  getLiquidityBreakdown(): Promise<any>;
  getWalletHealth(): Promise<any>;
}

export interface AppRepository {
  db: Database.Database;
}
