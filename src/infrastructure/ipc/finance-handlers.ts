/**
 * Finance-related IPC handlers extracted from main.ts.
 * Registered via registerFinanceHandlers(db, deps).
 */

import { ipcMain, BrowserWindow } from 'electron';
import Database from 'better-sqlite3';

export interface FinanceHandlerDeps {
  db: Database.Database;
  mainWindow: BrowserWindow | null;
  userPreferences: Record<string, any>;
  financePasswordHash: string | null;
  financePasswordSalt: string | null;
  financeDataKey: Buffer | null;
  financeLocked: boolean;
  financeRememberDevice: boolean;
  financeRememberDeviceExpiry: number | null;
  financeLockTimeout: number;
  getLocalDateStr: (d?: Date) => string;
  toInt: (v: unknown) => number;
  financeDisplayCurrency: string;
}

const MAX_FINANCE_ATTEMPTS = 5;

export function registerFinanceHandlers(deps: FinanceHandlerDeps) {
  const { db, mainWindow, userPreferences, financePasswordHash, financePasswordSalt, financeDataKey, financeRememberDevice, financeRememberDeviceExpiry, getLocalDateStr, toInt } = deps;
  let financeLocked = deps.financeLocked;
  let financeDisplayCurrency = deps.financeDisplayCurrency;
  let financeLockTimeout = deps.financeLockTimeout;
  let financeAttemptsLeft = MAX_FINANCE_ATTEMPTS;

ipcMain.handle('finance:check-password-setup', async () => {
  return { hasPassword: !!financePasswordHash };
});
ipcMain.handle('finance:unlock', async (_event, password: string) => {
  if (verifyPassword(password)) {
    financeLocked = false;
    financeAttemptsLeft = MAX_FINANCE_ATTEMPTS;
    // Derive encryption data key from password
    if (financePasswordSalt) {
      financeDataKey = deriveFinanceDataKey(password, financePasswordSalt);
      console.log('[finance-enc] Data key derived from password');
      // If data was encrypted by previous migration, decrypt it all back to plaintext
      if (db) {
        try {
          const migrated = db.prepare("SELECT value FROM finance_settings WHERE key = 'encryption_migration_complete'").get() as any;
          if (migrated && migrated.value === 'true' && financeDataKey) {
            console.log('[finance-enc] Decrypting all encrypted data back to plaintext...');
            // Decrypt account balances
            const acctRows = db.prepare('SELECT id, balance FROM finance_accounts').all() as any[];
            for (const row of acctRows) {
              if (row.balance != null && isEncrypted(String(row.balance))) {
                const decrypted = decryptField(String(row.balance), financeDataKey);
                db.prepare('UPDATE finance_accounts SET balance = ? WHERE id = ?').run(decrypted, row.id);
              }
            }
            // Decrypt wallet fields
            const walletRows = db.prepare('SELECT id, balance, last_four, metadata, initial_balance FROM finance_wallets').all() as any[];
            for (const row of walletRows) {
              if (row.balance != null && isEncrypted(String(row.balance))) {
                db.prepare('UPDATE finance_wallets SET balance = ? WHERE id = ?').run(decryptField(String(row.balance), financeDataKey), row.id);
              }
              if (row.last_four && isEncrypted(row.last_four)) {
                db.prepare('UPDATE finance_wallets SET last_four = ? WHERE id = ?').run(decryptField(row.last_four, financeDataKey), row.id);
              }
              if (row.metadata && isEncrypted(row.metadata)) {
                db.prepare('UPDATE finance_wallets SET metadata = ? WHERE id = ?').run(decryptField(row.metadata, financeDataKey), row.id);
              }
              if (row.initial_balance != null && isEncrypted(String(row.initial_balance))) {
                db.prepare('UPDATE finance_wallets SET initial_balance = ? WHERE id = ?').run(decryptField(String(row.initial_balance), financeDataKey), row.id);
              }
            }
            // Decrypt transaction fields
            const txnRows = db.prepare('SELECT id, amount, description, note FROM finance_transactions').all() as any[];
            let decryptedCount = 0;
            for (const row of txnRows) {
              const updates: string[] = [];
              const vals: any[] = [];
              if (row.amount != null && isEncrypted(String(row.amount))) { updates.push('amount = ?'); vals.push(decryptField(String(row.amount), financeDataKey)); }
              if (row.description && isEncrypted(row.description)) { updates.push('description = ?'); vals.push(decryptField(row.description, financeDataKey)); }
              if (row.note && isEncrypted(row.note)) { updates.push('note = ?'); vals.push(decryptField(row.note, financeDataKey)); }
              if (updates.length > 0) { vals.push(row.id); db.prepare('UPDATE finance_transactions SET ' + updates.join(', ') + ' WHERE id = ?').run(...vals); decryptedCount++; }
            }
            db.prepare("DELETE FROM finance_settings WHERE key = 'encryption_migration_complete'").run();
            console.log('[finance-enc] Decrypted ' + acctRows.length + ' accounts, ' + walletRows.length + ' wallets, ' + decryptedCount + ' transactions');
          }
          financeDataKey = null; // Disable encryption — keep data as plaintext
        } catch (e) { console.error('[finance-enc] Decryption rollback error:', e); }
      }
    }
    if (db) {
      db.prepare("INSERT OR REPLACE INTO finance_settings (key, value) VALUES ('attempts_left', ?)").run(String(financeAttemptsLeft));
    }
    return { success: true };
  }
  financeAttemptsLeft = Math.max(0, financeAttemptsLeft - 1);
  if (db) {
    db.prepare("INSERT OR REPLACE INTO finance_settings (key, value) VALUES ('attempts_left', ?)").run(String(financeAttemptsLeft));
  }
  return { success: false, attemptsLeft: financeAttemptsLeft };
});

ipcMain.handle('finance:verify-password', async (_event, password: string) => {
  return { success: verifyPassword(password) };
});

ipcMain.handle('finance:set-password', async (_event, password: string) => {
  if (!db) return { success: false };
  try {
    if (financePasswordHash) {
      return { success: false, error: 'Password already exists' };
    }
    const { hash, salt } = hashPassword(password);
    db.prepare("INSERT OR REPLACE INTO finance_settings (key, value) VALUES ('password_hash', ?)").run(hash);
    db.prepare("INSERT OR REPLACE INTO finance_settings (key, value) VALUES ('password_salt', ?)").run(salt);
    financePasswordHash = hash;
    financePasswordSalt = salt;
    financeLocked = true;
    financeAttemptsLeft = MAX_FINANCE_ATTEMPTS;
    db.prepare("INSERT OR REPLACE INTO finance_settings (key, value) VALUES ('attempts_left', ?)").run(String(financeAttemptsLeft));
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('finance:change-password', async (_event, currentPassword: string, nextPassword: string) => {
  if (!db) return { success: false };
  try {
    if (!financePasswordHash || !financePasswordSalt) {
      return { success: false, error: 'No password is set' };
    }
    if (!verifyPassword(currentPassword)) {
      return { success: false, error: 'Current password is incorrect' };
    }
    const { hash, salt } = hashPassword(nextPassword);
    db.prepare("INSERT OR REPLACE INTO finance_settings (key, value) VALUES ('password_hash', ?)").run(hash);
    db.prepare("INSERT OR REPLACE INTO finance_settings (key, value) VALUES ('password_salt', ?)").run(salt);
    financePasswordHash = hash;
    financePasswordSalt = salt;
    financeLocked = true;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('finance:set-remember-device', async (_event, remember: boolean, days: number) => {
  if (!db) return { success: false };
  try {
    financeRememberDevice = remember;
    if (remember) {
      const expiry = Date.now() + (days * 24 * 60 * 60 * 1000);
      financeRememberDeviceExpiry = expiry;
      db.prepare("INSERT OR REPLACE INTO finance_settings (key, value) VALUES ('remember_device', ?)").run('true');
      db.prepare("INSERT OR REPLACE INTO finance_settings (key, value) VALUES ('remember_device_expiry', ?)").run(String(expiry));
      financeLocked = false;
    } else {
      financeRememberDevice = false;
      financeRememberDeviceExpiry = null;
      db.prepare("INSERT OR REPLACE INTO finance_settings (key, value) VALUES ('remember_device', ?)").run('false');
      db.prepare("DELETE FROM finance_settings WHERE key = 'remember_device_expiry'").run();
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('finance:set-lock-timeout', async (_event, timeoutMs: number) => {
  if (!db) return { success: false };
  try {
    financeLockTimeout = timeoutMs;
    db.prepare("INSERT OR REPLACE INTO finance_settings (key, value) VALUES ('lock_timeout', ?)").run(String(timeoutMs));
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('finance:biometric-unlock', async () => {
  financeLocked = false;
  return { success: true };
});

ipcMain.handle('finance:get-webauthn-credential', async () => {
  if (!db) return { credentialId: null };
  try {
    const row = db.prepare("SELECT value FROM finance_settings WHERE key = 'webauthn_credential_id'").get() as { value: string } | undefined;
    return { credentialId: row?.value || null };
  } catch {
    return { credentialId: null };
  }
});

ipcMain.handle('finance:store-webauthn-credential', async (_event, credentialId: string) => {
  if (!db) return { success: false };
  try {
    db.prepare("INSERT OR REPLACE INTO finance_settings (key, value) VALUES ('webauthn_credential_id', ?)").run(credentialId);
    return { success: true };
  } catch {
    return { success: false };
  }
});

ipcMain.handle('finance:get-display-currency', async () => {
  return { currency: financeDisplayCurrency };
});

ipcMain.handle('finance:set-display-currency', async (_event, currency: string) => {
  if (!db) return { success: false };
  try {
    db.prepare("INSERT OR REPLACE INTO finance_settings (key, value) VALUES ('display_currency', ?)").run(currency);
    financeDisplayCurrency = currency;
    return { success: true };
  } catch {
    return { success: false };
  }
});

// ── Monthly Recaps (finance:recap-*) ──
const RECAP_SYSTEM_PROMPT = `You are a financial biographer writing a monthly recap for the DeskFlow user.
Write in second person ("you spent", "your BCA wallet"), 180-300 words, warm and specific.
AVOID: clich�s ("journey," "stay on top of," "track," "you've got this"),
self-help platitudes, exclamation marks, judgmental framing of spending,
vague words ("significant," "notable" without specifics).

You have access to data about these features:
• Transactions (income, expenses, transfers) across categories
• Wallets (bank, cash, e-wallet, crypto) and their balance changes
• Subscriptions that renewed
• Fixed expenses (paid/pending/skipped)
• Budgets (set category limits)
• Follow-Through people (money with specific people)

From the structured stats below, CHOOSE what to highlight based on what's
significant: a large income event, a category that dominated spending,
wallets that grew or shrank sharply, subscriptions renewing, unusual
quiet months, or a big shift from last month.

Use exact numbers only from the stats. Never invent numbers or categories.
If income was zero, say so plainly. If one category took 60%+ of spending,
name it and quantify it. End with ONE short forward-looking sentence
about what this month's pattern suggests.

OUTPUT FORMAT — STRICT:
- Reply with ONLY the narrative. No preamble, no plan, no headings, no labels.
- Do NOT repeat the data list back, do NOT write "Month:", "Income:", or any stat line.
- Do NOT echo my instructions back. Start directly with the story.
- Write the narrative as 2-4 short paragraphs, not a bullet list.`;

function formatRecapTitle(month: string, stats: any): string {
  const d = new Date(`${month}-01T00:00:00`);
  const label = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  return `${label} Recap`;
}

function hydrateRecap(row: any): any {
  if (!row) return null;
  let stats = null;
  try { stats = JSON.parse(row.stats_json || 'null'); } catch { stats = null; }
  return {
    id: row.id,
    month: row.month,
    title: row.title,
    status: row.status,
    providerId: row.provider_id,
    incomeTotal: row.income_total ?? (stats?.income?.total ?? 0),
    expenseTotal: row.expense_total ?? (stats?.expense?.total ?? 0),
    net: row.net ?? (stats?.net ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    summary: row.summary,
    statsJson: row.stats_json,
    errorMessage: row.error_message,
    stats,
    apex: stats?.apex ?? null,
  };
}

function computeRecapStats(db: any, month: string): any | null {
  const monthStart = `${month}-01`;
  const nextMonth = (() => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    d.setMonth(d.getMonth() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();
  const nextMonthStart = `${nextMonth}-01`;
  const safe = (fn: () => any, fallback: any) => { try { return fn(); } catch (e: any) { console.log('[RECAP] query error:', e?.message); return fallback; } };

  const income = safe(() => db.prepare(`SELECT COALESCE(SUM(t.amount), 0) AS total, COUNT(*) AS count FROM finance_transactions t WHERE t.type = 'transfer' AND t.amount > 0 AND (t.is_adjustment IS NULL OR t.is_adjustment = 0) AND strftime('%Y-%m', t.date) = ?`).get(month), { total: 0, count: 0 });
  const expense = safe(() => db.prepare(`SELECT COALESCE(SUM(ABS(t.amount)), 0) AS total, COUNT(*) AS count FROM finance_transactions t WHERE t.type = 'expense' AND (t.is_adjustment IS NULL OR t.is_adjustment = 0) AND strftime('%Y-%m', t.date) = ?`).get(month), { total: 0, count: 0 });
  const activeDays = safe(() => (db.prepare(`SELECT COUNT(DISTINCT t.date) AS days FROM finance_transactions t WHERE (t.is_adjustment IS NULL OR t.is_adjustment = 0) AND strftime('%Y-%m', t.date) = ?`).get(month) as any)?.days || 0, 0);

  if (income.count === 0 && expense.count === 0) return null;

  const topCategories = safe(() => db.prepare(`SELECT c.id, c.name, c.color, c.icon, COALESCE(SUM(ABS(t.amount)), 0) AS amount, COUNT(t.id) AS count FROM finance_transactions t JOIN finance_categories c ON t.category_id = c.id WHERE t.type = 'expense' AND (t.is_adjustment IS NULL OR t.is_adjustment = 0) AND strftime('%Y-%m', t.date) = ? GROUP BY c.id ORDER BY amount DESC LIMIT 5`).all(month), []);
  const spendingByCategory = safe(() => db.prepare(`SELECT t.category_id AS categoryId, c.name AS name, c.color AS color, COALESCE(SUM(ABS(t.amount)), 0) AS amount, COUNT(t.id) AS count FROM finance_transactions t LEFT JOIN finance_categories c ON t.category_id = c.id WHERE t.type = 'expense' AND (t.is_adjustment IS NULL OR t.is_adjustment = 0) AND strftime('%Y-%m', t.date) = ? GROUP BY t.category_id ORDER BY amount DESC`).all(month).map((r: any) => ({ ...r, name: r.name || 'Uncategorized', color: r.color || '#888888' })), []);
  const walletSpend = safe(() => db.prepare(`SELECT w.id, w.name, w.type, COALESCE(SUM(ABS(t.amount)), 0) AS amount FROM finance_transactions t JOIN finance_wallets w ON t.wallet_id = w.id WHERE t.type = 'expense' AND (t.is_adjustment IS NULL OR t.is_adjustment = 0) AND strftime('%Y-%m', t.date) = ? GROUP BY w.id ORDER BY amount DESC`).all(month), []);
  const subscriptionsBilled = safe(() => db.prepare(`SELECT DISTINCT s.id, s.name, s.price, s.currency FROM finance_subscriptions s JOIN finance_transactions t ON t.wallet_id = s.wallet_id AND COALESCE(t.description, '') LIKE '%' || s.name || '%' WHERE strftime('%Y-%m', t.date) = ?`).all(month), []);
  const fixedExpenseRows = safe(() => db.prepare(`SELECT fe.id, fe.name, fe.amount AS expected, COALESCE(fep.amount_paid, 0) AS paid, COALESCE(fep.status, 'pending') AS status FROM finance_fixed_expenses fe LEFT JOIN finance_fixed_expense_payments fep ON fep.fixed_expense_id = fe.id AND fep.month = ? WHERE fe.is_active = 1`).all(month), []);
  const followThrough = safe(() => db.prepare(`SELECT p.id, p.name, COALESCE(SUM(CASE WHEN t.type = 'income' OR (t.type='transfer' AND t.amount>0) THEN t.amount ELSE -ABS(t.amount) END), 0) AS net, COUNT(t.id) AS count FROM finance_transactions t JOIN finance_ft_persons p ON t.ft_person_id = p.id WHERE strftime('%Y-%m', t.date) = ? AND (t.is_adjustment IS NULL OR t.is_adjustment = 0) GROUP BY p.id`).all(month), []);
  const walletRows = safe(() => db.prepare(`SELECT id, name, type, balance, is_archived FROM finance_wallets WHERE is_archived = 0 ORDER BY id`).all(), []);
  const walletBalanceDelta = walletRows.map((w: any) => {
    const start = safe(() => (db.prepare(`SELECT balance FROM finance_wallet_snapshots WHERE wallet_id = ? AND date <= ? ORDER BY date DESC LIMIT 1`).get(w.id, monthStart) as any)?.balance ?? null, null);
    const end = safe(() => (db.prepare(`SELECT balance FROM finance_wallet_snapshots WHERE wallet_id = ? AND date < ? ORDER BY date DESC LIMIT 1`).get(w.id, nextMonthStart) as any)?.balance ?? null, null);
    const startBalance = start ?? w.balance;
    const endBalance = end ?? w.balance;
    return { id: w.id, name: w.name, type: w.type, startBalance, endBalance, delta: endBalance - startBalance };
  });
  const biggestExpense = safe(() => db.prepare(`SELECT t.description, ABS(t.amount) AS amount, c.name AS category, t.date FROM finance_transactions t JOIN finance_categories c ON t.category_id = c.id WHERE t.type = 'expense' AND (t.is_adjustment IS NULL OR t.is_adjustment = 0) AND strftime('%Y-%m', t.date) = ? ORDER BY ABS(t.amount) DESC LIMIT 1`).get(month) || null, null);
  const biggestIncome = safe(() => db.prepare(`SELECT t.description, t.amount, c.name AS category, t.date FROM finance_transactions t JOIN finance_categories c ON t.category_id = c.id WHERE t.type = 'transfer' AND t.amount > 0 AND (t.is_adjustment IS NULL OR t.is_adjustment = 0) AND strftime('%Y-%m', t.date) = ? ORDER BY t.amount DESC LIMIT 1`).get(month) || null, null);

  // Previous month for MoM comparison
  const prev = (() => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();
  const prevIncome = safe(() => (db.prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM finance_transactions WHERE type = 'transfer' AND amount > 0 AND (is_adjustment IS NULL OR is_adjustment = 0) AND strftime('%Y-%m', date) = ?`).get(prev) as any)?.total || 0, 0);
  const prevExpense = safe(() => (db.prepare(`SELECT COALESCE(SUM(ABS(amount)), 0) AS total FROM finance_transactions WHERE type = 'expense' AND (is_adjustment IS NULL OR is_adjustment = 0) AND strftime('%Y-%m', date) = ?`).get(prev) as any)?.total || 0, 0);
  const previousMonth = { income: prevIncome, expense: prevExpense, net: prevIncome - prevExpense };
  const pct = (cur: number, pv: number) => pv === 0 ? 0 : Math.round(((cur - pv) / Math.abs(pv)) * 1000) / 10;

  const fixedExpenses = {
    total: fixedExpenseRows.length,
    paid: fixedExpenseRows.filter((r: any) => r.status === 'paid').length,
    pending: fixedExpenseRows.filter((r: any) => r.status === 'pending').length,
    skipped: fixedExpenseRows.filter((r: any) => r.status === 'skipped').length,
    items: fixedExpenseRows,
  };

  const incomeTotal = income.total, expenseTotal = expense.total;
  return {
    month,
    displayCurrency: financeDisplayCurrency || 'USD',
    generatedAt: new Date().toISOString(),
    income: { total: incomeTotal, count: income.count },
    expense: { total: expenseTotal, count: expense.count },
    net: incomeTotal - expenseTotal,
    activeDays,
    previousMonth,
    momDelta: {
      income: pct(incomeTotal, previousMonth.income),
      expense: pct(expenseTotal, previousMonth.expense),
      net: pct(incomeTotal - expenseTotal, previousMonth.net),
    },
    topCategories,
    spendingByCategory,
    walletSpend,
    walletBalanceDelta,
    subscriptionsBilled,
    fixedExpenses,
    followThrough,
    biggestExpense,
    biggestIncome,
  };
}

function buildRecapUserMessage(stats: any): string {
  const lines: string[] = [];
  lines.push(`Month: ${stats.month} (displayed in ${stats.displayCurrency})`);
  lines.push('');
  lines.push(`Income: ${stats.income.total} across ${stats.income.count} transaction(s).`);
  lines.push(`Expenses: ${stats.expense.total} across ${stats.expense.count} transaction(s) on ${stats.activeDays} active day(s).`);
  lines.push(`Net flow: ${stats.net} (previous month: ${stats.previousMonth ? stats.previousMonth.net : 'n/a'}, change: ${stats.momDelta.net}).`);
  lines.push('');
  lines.push('Top spending categories:');
  const recapCatLines = (stats.spendingByCategory && stats.spendingByCategory.length ? stats.spendingByCategory : stats.topCategories || []);
  recapCatLines.forEach((c: any) => lines.push(`• ${c.name || c.categoryName}: ${c.amount} (${c.count} txns)`));
  lines.push('');
  lines.push('Wallet balance changes:');
  (stats.walletBalanceDelta || []).filter((w: any) => w.delta !== 0).forEach((w: any) => lines.push(`• ${w.name} (${w.type}): ${w.startBalance} → ${w.endBalance} (${w.delta >= 0 ? '+' : ''}${w.delta})`));
  lines.push('');
  lines.push('Subscriptions billed this month:');
  lines.push(stats.subscriptionsBilled && stats.subscriptionsBilled.length ? stats.subscriptionsBilled.map((s: any) => `• ${s.name}: ${s.price} ${s.currency}`).join('\n') : '(none)');
  lines.push('');
  lines.push(`Fixed expenses: ${stats.fixedExpenses.paid} of ${stats.fixedExpenses.total} paid, ${stats.fixedExpenses.skipped} skipped.`);
  lines.push('');
  lines.push('Follow-Through people:');
  lines.push(stats.followThrough && stats.followThrough.length ? stats.followThrough.map((p: any) => `• ${p.name}: net ${p.net} (${p.count} txns)`).join('\n') : '(no activity)');
  lines.push('');
  lines.push(`Biggest single expense: ${stats.biggestExpense ? `${stats.biggestExpense.description}, ${stats.biggestExpense.amount} on ${stats.biggestExpense.date} (${stats.biggestExpense.category})` : 'none'}.`);
  lines.push(`Biggest income event: ${stats.biggestIncome ? `${stats.biggestIncome.description}, ${stats.biggestIncome.amount} on ${stats.biggestIncome.date}` : 'none'}.`);
  return lines.join('\n');
}

// One AI path for recap narrative: provider chain (reports used provider), then OpenRouter fallback. Key never reaches the renderer.
async function runMonthlyRecapAI(systemPrompt: string, userMsg: string): Promise<{ summary: string; providerId: string | null }> {
  const p = userPreferences || {};
  const pState = p.aiProviders ? JSON.parse(p.aiProviders) : null;
  const chain = pState ? buildChain(pState, 'monthlyRecap') : [];
  if (chain.length > 0) {
    const { result, usedProviderId } = await runWithFallback(chain, {
      systemPrompt,
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 700,
      temperature: 0.7,
    });
    return { summary: result.content, providerId: usedProviderId || 'chain' };
  }
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) throw new Error('No AI providers configured');
  const model = p.ai_briefModel || 'google/gemini-2.0-flash-001';
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }], max_tokens: 500 }),
    signal: AbortSignal.timeout(60000),
  });
  const data: any = await response.json();
  return { summary: data.choices?.[0]?.message?.content || '', providerId: 'openrouter' };
}

const RECAP_UPSERT = `
  INSERT INTO finance_monthly_recaps (month, title, summary, stats_json, status, provider_id, error_message)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(month) DO UPDATE SET
    title = excluded.title,
    summary = excluded.summary,
    stats_json = excluded.stats_json,
    status = excluded.status,
    provider_id = excluded.provider_id,
    error_message = excluded.error_message,
    updated_at = datetime('now','localtime')
`;

async function generateRecapInternal(db: any, month: string, force = false, onStage?: (stage: RecapStage) => void): Promise<{ ok: boolean; data?: any; error?: string }> {
  const emit = (stage: RecapStage) => { try { onStage?.(stage); } catch { /* noop */ } };
  try {
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return { ok: false, error: 'Invalid month format (YYYY-MM required)' };
    }
    const existing = db.prepare('SELECT * FROM finance_monthly_recaps WHERE month = ?').get(month) as any;
    if (existing && !force) {
      return { ok: true, data: hydrateRecap({ ...existing, income_total: undefined, expense_total: undefined, net: undefined }) };
    }

    emit('reading');
    const stats = computeRecapStats(db, month);
    if (!stats) {
      return { ok: false, error: 'No transaction data for this month' };
    }

    const systemPrompt = RECAP_SYSTEM_PROMPT;
    const userMsg = buildRecapUserMessage(stats);

    let summary = '';
    let status: 'generated' | 'failed' = 'generated';
    let providerId: string | null = null;
    let errorMessage: string | null = null;
    try {
      emit('analyzing');
      emit('writing');
      const res = await runMonthlyRecapAI(systemPrompt, userMsg);
      const cleaned = cleanRecapSummary(res.summary);
      summary = cleaned || '[AI unavailable � this month\'s narrative couldn\'t be generated. The financial stats below are still accurate.]';
      providerId = res.providerId;
      if (!cleaned) status = 'failed';
    } catch (e: any) {
      summary = '[AI unavailable � this month\'s narrative couldn\'t be generated. The financial stats below are still accurate.]';
      status = 'failed';
      errorMessage = (e?.message || String(e)).slice(0, 500);
    }

    emit('saving');
    const apex = computeApexInsight(stats);
    const statsJson = JSON.stringify({ ...stats, apex });
    const title = formatRecapTitle(month, stats);
    db.prepare(RECAP_UPSERT).run(month, title, summary, statsJson, status, providerId, errorMessage);

    emit('done');
    const saved = db.prepare('SELECT * FROM finance_monthly_recaps WHERE month = ?').get(month) as any;
    return { ok: true, data: hydrateRecap(saved) };
  } catch (err: any) {
    console.log('[RECAP] generate error:', err?.message);
    return { ok: false, error: err?.message || 'Unknown error' };
  }
}

// Auto-generation: runs at startup + every 6h; idempotent; ONLY the immediate previous calendar month.
function checkMonthlyRecaps(db: any) {
  try {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;

    const existing = db.prepare('SELECT id FROM finance_monthly_recaps WHERE month = ?').get(monthKey);
    if (existing) return;

    const { count } = db.prepare(`
      SELECT COUNT(*) as count FROM finance_transactions
      WHERE strftime('%Y-%m', date) = ?
        AND (is_adjustment IS NULL OR is_adjustment = 0)
    `).get(monthKey) as any;
    if (count === 0) return;

    generateRecapInternal(db, monthKey).catch((e: any) =>
      console.log('[RECAP] auto-gen failed:', e?.message?.slice(0, 120))
    );
  } catch (e: any) {
    console.log('[RECAP] check error:', e?.message?.slice(0, 120));
  }
}

ipcMain.handle('finance:recap-list', async () => {
  if (!db) return { ok: false, error: 'DB not ready' };
  try {
    const rows = db.prepare(`
      SELECT id, month, title, status, provider_id, created_at, updated_at,
             json_extract(stats_json, '$.income.total') AS income_total,
             json_extract(stats_json, '$.expense.total') AS expense_total,
             json_extract(stats_json, '$.net') AS net
      FROM finance_monthly_recaps
      ORDER BY month DESC
    `).all() as any[];
    return { ok: true, data: rows.map((r: any) => hydrateRecap(r)) };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Unknown error' };
  }
});

ipcMain.handle('finance:recap-get', async (_event, params: { month: string }) => {
  if (!db) return { ok: false, error: 'DB not ready' };
  try {
    const { month } = params || {};
    const row = db.prepare('SELECT * FROM finance_monthly_recaps WHERE month = ?').get(month) as any;
    return { ok: true, data: hydrateRecap(row) };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Unknown error' };
  }
});

ipcMain.handle('finance:recap-generate', async (_event, params: { month: string; force?: boolean }) => {
  if (!db) return { ok: false, error: 'DB not ready' };
  const { month, force = false } = params || {};
  return generateRecapInternal(db, month, force, (stage) => {
    try {
      const win = electron_1.BrowserWindow.getAllWindows()[0];
      win?.webContents.send('finance:recap-progress', { month, stage });
    } catch { /* noop */ }
  });
});

ipcMain.handle('finance:recap-delete', async (_event, params: { month: string }) => {
  if (!db) return { ok: false, error: 'DB not ready' };
  try {
    const { month } = params || {};
    db.prepare('DELETE FROM finance_monthly_recaps WHERE month = ?').run(month);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Unknown error' };
  }
});

ipcMain.handle('finance:recap-months-with-data', async () => {
  if (!db) return { ok: false, error: 'DB not ready' };
  try {
    const rows = db.prepare(`
      SELECT DISTINCT strftime('%Y-%m', date) AS month
      FROM finance_transactions
      WHERE (is_adjustment IS NULL OR is_adjustment = 0)
      ORDER BY month DESC
    `).all() as any[];
    return { ok: true, data: rows.map((r: any) => r.month) };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Unknown error' };
  }
});


ipcMain.handle('finance:get-auto-save', async () => {
  if (!db) return { enabled: true };
  try {
    const row = db.prepare("SELECT value FROM finance_settings WHERE key = 'auto_save'").get() as any;
    return { enabled: row ? row.value === 'true' : true };
  } catch { return { enabled: true }; }
});

ipcMain.handle('finance:set-auto-save', async (_event, enabled: boolean) => {
  if (!db) return { success: false };
  try {
    db.prepare("INSERT OR REPLACE INTO finance_settings (key, value) VALUES ('auto_save', ?)").run(String(enabled));
    return { success: true };
  } catch { return { success: false }; }
});

ipcMain.handle('finance:get-auto-recalc', async () => {
  if (!db) return { enabled: true };
  try {
    const row = db.prepare("SELECT value FROM finance_settings WHERE key = 'auto_recalc'").get() as any;
    return { enabled: row ? row.value === 'true' : true };
  } catch { return { enabled: true }; }
});

ipcMain.handle('finance:set-auto-recalc', async (_event, enabled: boolean) => {
  if (!db) return { success: false };
  try {
    db.prepare("INSERT OR REPLACE INTO finance_settings (key, value) VALUES ('auto_recalc', ?)").run(String(enabled));
    return { success: true };
  } catch { return { success: false }; }
});

ipcMain.handle('finance:get-security-settings', async () => {
  return {
    hasPassword: !!financePasswordHash,
    locked: financeLocked,
    rememberDevice: financeRememberDevice,
    rememberDeviceExpiry: financeRememberDeviceExpiry,
    lockTimeout: financeLockTimeout,
    displayCurrency: financeDisplayCurrency,
  };
});

ipcMain.handle('finance:get-lock-state', async () => {
  return { locked: financeLocked };
});

ipcMain.handle('finance:is-locked', async () => {
  return { locked: financeLocked };
});

ipcMain.handle('finance:lock', async () => {
  financeLocked = true;
  return { locked: true };
});

ipcMain.handle('finance:check-page-access', async () => {
  // Check if user can access the finance page
  if (!financePasswordHash) {
    // No password set - allow access
    return { canAccess: true, requiresSetup: true };
  }
  
  if (financeRememberDevice && financeRememberDeviceExpiry && Date.now() < financeRememberDeviceExpiry) {
    // Device is remembered and not expired - allow access
    return { canAccess: true, requiresSetup: false };
  }
  
  if (financeLocked) {
    // Locked - require unlock
    return { canAccess: false, requiresSetup: false, reason: 'locked' };
  }
  
  // Not locked and no remember device - allow access
  return { canAccess: true, requiresSetup: false };
});

// ── Accounts ──
ipcMain.handle('finance:get-accounts', async () => {
  if (!db) return [];
  try {
    const rows = db.prepare('SELECT * FROM finance_accounts WHERE is_archived = 0 ORDER BY name').all() as any[];
    return rows.map(r => {
      if (financeDataKey && r.balance != null && isEncrypted(r.balance)) {
        r.balance = Number(decryptField(String(r.balance), financeDataKey)) || 0;
      }
      return r;
    });
  } catch { return []; }
});

ipcMain.handle('finance:create-account', async (_event, data: any) => {
  if (!db) return null;
  try {
    const stmt = db.prepare(`
      INSERT INTO finance_accounts (name, type, description, icon, color, currency, balance)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const encBalance = financeDataKey ? encryptField(enc(data.balance || 0), financeDataKey) : String(data.balance || 0);
    const result = stmt.run(data.name, data.type, data.description || null, data.icon || 'Wallet', data.color || '#10b981', data.currency || 'USD', encBalance);
    const newId = Number(result.lastInsertRowid);
    logAuditEvent('account_created', 'account', newId, `Created account "${data.name}"`, {
      name: data.name, type: data.type, balance: data.balance || 0, currency: data.currency || 'USD'
    });
    return { id: newId, ...data };
  } catch (error: any) {
    console.error('[finance] create account error:', error);
    return null;
  }
});

ipcMain.handle('finance:update-account', async (_event, data: any) => {
  if (!db) return null;
  try {
    db.prepare(`
      UPDATE finance_accounts SET name=?, type=?, description=?, icon=?, color=?, currency=?, updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(data.name, data.type, data.description, data.icon, data.color, data.currency, data.id);
    return { success: true };
  } catch { return null; }
});

ipcMain.handle('finance:archive-account', async (_event, id: number) => {
  if (!db) return null;
  try {
    db.prepare("UPDATE finance_accounts SET is_archived=1 WHERE id=?").run(id);
    return { success: true };
  } catch { return null; }
});

/**
 * Records a snapshot of a wallet's balance for the current date.
 * If a snapshot for the given wallet and date already exists, it updates it.
 * @param walletId The ID of the wallet.
 * @param currentBalance The current balance of the wallet.
 */
function recordWalletSnapshot(walletId: number, currentBalance: number) {
  if (!db) return;
  const today = todayStr();
  try {
    const existing = db.prepare('SELECT id FROM finance_wallet_snapshots WHERE wallet_id = ? AND date = ?').get(walletId, today);
    if (existing) {
      db.prepare("UPDATE finance_wallet_snapshots SET balance = ?, created_at = datetime('now','localtime') WHERE id = ?").run(currentBalance, (existing as any).id);
    } else {
      db.prepare('INSERT INTO finance_wallet_snapshots (wallet_id, date, balance) VALUES (?, ?, ?)').run(walletId, today, currentBalance);
    }
    console.log(`[finance] Recorded wallet snapshot for wallet ${walletId} on ${today} with balance ${currentBalance}`);
  } catch (e: any) {
    console.error(`[finance] Failed to record wallet snapshot for wallet ${walletId}: ${e.message}`);
  }
}

function recordCryptoAssetHistory(walletId: number, coinId: string, amount: number, avgBuyPrice: number, currentPrice: number) {
  if (!db) return;
  const today = todayStr();
  const fiatValue = amount * currentPrice;
  try {
    db.prepare('INSERT INTO crypto_asset_history (wallet_id, coin_id, amount, avg_buy_price, fiat_value, date) VALUES (?, ?, ?, ?, ?, ?)').run(walletId, coinId.toLowerCase(), amount, avgBuyPrice, fiatValue, today);
    console.log(`[finance] Recorded crypto asset history: wallet ${walletId} coin ${coinId} amount=${amount} price=${currentPrice} fiat=${fiatValue}`);
  } catch (e: any) {
    console.error(`[finance] Failed to record crypto asset history: ${e.message}`);
  }
}

// ── Wallets ──
ipcMain.handle('finance:get-wallets', async (_event, accountId?: number) => {
  if (!db) return [];
  try {
    let rows: any[];
    if (accountId) {
      rows = db.prepare('SELECT * FROM finance_wallets WHERE account_id = ? AND is_archived = 0 ORDER BY name').all(accountId) as any[];
    } else {
      rows = db.prepare('SELECT * FROM finance_wallets WHERE is_archived = 0 ORDER BY name').all() as any[];
    }
    for (const row of rows) {
      // Decrypt sensitive fields if key available
      if (financeDataKey) {
        if (row.balance != null && isEncrypted(row.balance)) row.balance = Number(decryptField(String(row.balance), financeDataKey)) || 0;
        if (row.last_four && isEncrypted(row.last_four)) row.last_four = decryptField(row.last_four, financeDataKey);
        if (row.metadata && isEncrypted(row.metadata)) {
          try { row.metadata = JSON.parse(decryptField(row.metadata, financeDataKey)); } catch { row.metadata = null; }
        } else if (row.metadata) {
          try { row.metadata = JSON.parse(row.metadata); } catch { row.metadata = null; }
        }
        if (row.initial_balance != null && isEncrypted(row.initial_balance)) row.initial_balance = Number(decryptField(String(row.initial_balance), financeDataKey)) || 0;
      } else {
        if (row.metadata) {
          try { row.metadata = JSON.parse(row.metadata); } catch { row.metadata = null; }
        }
      }
    }
    return rows;
  } catch { return []; }
});

ipcMain.handle('finance:create-wallet', async (_event, data: any) => {
  if (!db) return null;
  try {
    const stmt = db.prepare(`
      INSERT INTO finance_wallets (account_id, name, type, provider, last_four, balance, currency, metadata, transfer_fee_type, transfer_fee_value, initial_balance)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const feeType = data.transfer_fee_type || 'none';
    const feeValue = Number(data.transfer_fee_value) || 0;
    const initBal = data.balance || 0;
    const isCrypto = data.type === 'crypto' || data.type === 'investment';
    const encBalance = financeDataKey ? encryptField(enc(data.balance || 0), financeDataKey) : String(data.balance || 0);
    const encLastFour = financeDataKey && data.last_four ? encryptField(data.last_four, financeDataKey) : (data.last_four || null);
    const rawMetadata = data.metadata ? JSON.stringify(data.metadata) : null;
    const encMetadata = financeDataKey && rawMetadata ? encryptField(rawMetadata, financeDataKey) : rawMetadata;
    const encInitBal = financeDataKey ? encryptField(enc(initBal), financeDataKey) : String(initBal);
    const result = stmt.run(data.account_id, data.name, data.type, data.provider || null, encLastFour, encBalance, data.currency || 'USD', encMetadata, feeType, feeValue, encInitBal);
    const newId = Number(result.lastInsertRowid);

    // For crypto wallets: wallet.balance and initial_balance are already correct from the INSERT.
    // No adjustment transaction needed — it caused recalculate to start from 0 and produce negative balances.

    const created = { id: newId, ...data, metadata: data.metadata || null, transfer_fee_type: feeType, transfer_fee_value: feeValue };
    logAuditEvent('wallet_created', 'wallet', newId, `Created wallet "${data.name}"`, {
      name: data.name, type: data.type, balance: data.balance || 0, currency: data.currency || 'USD',
      account_id: data.account_id, transfer_fee_type: feeType, transfer_fee_value: feeValue
    });
    recordWalletSnapshot(newId, data.balance || 0);
    return created;
  } catch (e: any) {
    console.error('[finance:create-wallet] ERROR:', e?.message);
    return null;
  }
});

ipcMain.handle('finance:update-wallet', async (_event, data: any) => {
  if (!db) return null;
  try {
    const hasBalance = typeof data.balance === 'number';
    const hasFeeType = data.transfer_fee_type !== undefined;
    const hasFeeValue = data.transfer_fee_value !== undefined;
    const hasInitBal = data.initial_balance !== undefined;
    const encBalance = financeDataKey && hasBalance ? encryptField(enc(data.balance), financeDataKey) : data.balance;
    const encLastFour = financeDataKey && data.last_four ? encryptField(data.last_four, financeDataKey) : data.last_four;
    const encInitBal = financeDataKey && hasInitBal ? encryptField(enc(data.initial_balance), financeDataKey) : data.initial_balance;
    if (hasBalance) {
      if (hasInitBal) {
        db.prepare(`
          UPDATE finance_wallets SET name=?, type=?, provider=?, last_four=?, balance=?, initial_balance=?, currency=?, updated_at=datetime('now','localtime')
          WHERE id=?
        `).run(data.name, data.type, data.provider, encLastFour, encBalance, encInitBal, data.currency, data.id);
      } else {
        db.prepare(`
          UPDATE finance_wallets SET name=?, type=?, provider=?, last_four=?, balance=?, currency=?, updated_at=datetime('now','localtime')
          WHERE id=?
        `).run(data.name, data.type, data.provider, encLastFour, encBalance, data.currency, data.id);
      }
    } else if (hasInitBal) {
      db.prepare(`
        UPDATE finance_wallets SET initial_balance=?, updated_at=datetime('now','localtime')
        WHERE id=?
      `).run(encInitBal, data.id);
    } else if (hasFeeType || hasFeeValue) {
      const feeType = data.transfer_fee_type || 'none';
      const feeValue = Number(data.transfer_fee_value) || 0;
      db.prepare(`
        UPDATE finance_wallets SET transfer_fee_type=?, transfer_fee_value=?, updated_at=datetime('now','localtime')
        WHERE id=?
      `).run(feeType, feeValue, data.id);
    } else {
      db.prepare(`
        UPDATE finance_wallets SET name=?, type=?, provider=?, last_four=?, currency=?, updated_at=datetime('now','localtime')
        WHERE id=?
      `).run(data.name, data.type, data.provider, encLastFour, data.currency, data.id);
    }
    logAuditEvent('wallet_updated', 'wallet', data.id, `Updated wallet "${data.name}"`, { name: data.name, type: data.type, balance: data.balance, initial_balance: data.initial_balance, currency: data.currency });
    // Record wallet snapshot if balance changed
    if (hasBalance) {
      recordWalletSnapshot(data.id, data.balance);
    }
    return { success: true };
  } catch { return null; }
});

ipcMain.handle('finance:update-wallet-fees', async (_event, { id, transfer_fee_type, transfer_fee_value }: { id: number; transfer_fee_type: string; transfer_fee_value: number }) => {
  if (!db) return { success: false };
  try {
    db.prepare("UPDATE finance_wallets SET transfer_fee_type=?, transfer_fee_value=?, updated_at=datetime('now','localtime') WHERE id=?").run(transfer_fee_type, transfer_fee_value, id);
    logAuditEvent('wallet_fee_updated', 'wallet', id, `Updated transfer fee to ${transfer_fee_type}=${transfer_fee_value}`);
    return { success: true };
  } catch { return { success: false }; }
});

ipcMain.handle('finance:adjust-balance', async (_event, { id, newBalance }: { id: number; newBalance: number }) => {
  if (!db) return { success: false };
  try {
    const old = db.prepare('SELECT balance FROM finance_wallets WHERE id = ?').get(id) as any;
    const oldBalance = financeDataKey && old?.balance && isEncrypted(old.balance) ? Number(decryptField(String(old.balance), financeDataKey)) || 0 : (old?.balance ?? 0);
    const encBal = financeDataKey ? encryptField(enc(newBalance), financeDataKey) : String(newBalance);
    db.prepare("UPDATE finance_wallets SET balance=?, updated_at=datetime('now','localtime') WHERE id=?").run(encBal, id);
    logAuditEvent('balance_adjusted', 'wallet', id, `Balance adjusted from ${oldBalance} to ${newBalance}`, {
      old_balance: oldBalance, new_balance: newBalance, difference: newBalance - oldBalance
    });
    return { success: true };
  } catch { return null; }
});

ipcMain.handle('finance:update-initial-balance', async (_event, { id, initialBalance, password }: { id: number; initialBalance: number; password: string }) => {
  if (!db) return { success: false, error: 'Database not ready' };
  try {
    if (!verifyPassword(password)) return { success: false, error: 'Wrong password' };
    const w = db.prepare('SELECT id, name, account_id, initial_balance, balance, metadata FROM finance_wallets WHERE id = ?').get(id) as any;
    if (!w) return { success: false, error: 'Wallet not found' };
    const oldInit = financeDataKey && isEncrypted(w.initial_balance) ? Number(decryptField(String(w.initial_balance), financeDataKey)) || 0 : (w.initial_balance || 0);
    const oldBal = financeDataKey && isEncrypted(w.balance) ? Number(decryptField(String(w.balance), financeDataKey)) || 0 : (w.balance || 0);
    // Recompute balance: new initial_balance + SUM(transfer amounts for this wallet)
    // Exclude crypto transfers — they don't affect fiat balance
    const txnSum = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM finance_transactions WHERE wallet_id = ? AND NOT (type = 'transfer' AND metadata IS NOT NULL AND (json_extract(metadata, '$.coinId') IS NOT NULL OR json_extract(metadata, '$.coin_id') IS NOT NULL))").get(id) as any;
    const txnTotal = financeDataKey && txnSum?.total && isEncrypted(String(txnSum.total)) ? Number(decryptField(String(txnSum.total), financeDataKey)) || 0 : Number(txnSum?.total) || 0;
    const newBal = Number(initialBalance) + txnTotal;
    // Update wallet
    const encInitBal = financeDataKey ? encryptField(enc(initialBalance), financeDataKey) : String(initialBalance);
    const encBal = financeDataKey ? encryptField(enc(newBal), financeDataKey) : String(newBal);
    db.prepare("UPDATE finance_wallets SET initial_balance=?, balance=?, updated_at=datetime('now','localtime') WHERE id=?").run(encInitBal, encBal, id);
    // Also recompute account balance
    if (w.account_id) {
      const acctTxns = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM finance_transactions WHERE account_id = ? AND NOT (type = 'transfer' AND metadata IS NOT NULL AND (json_extract(metadata, '$.coinId') IS NOT NULL OR json_extract(metadata, '$.coin_id') IS NOT NULL))").get(w.account_id) as any;
      const acctTxnSum = financeDataKey && acctTxns?.total && isEncrypted(String(acctTxns.total)) ? Number(decryptField(String(acctTxns.total), financeDataKey)) || 0 : Number(acctTxns?.total) || 0;
      const acctInits = db.prepare("SELECT COALESCE(SUM(initial_balance), 0) as total FROM finance_wallets WHERE account_id = ?").get(w.account_id) as any;
      const acctInitSum = financeDataKey && acctInits?.total && isEncrypted(String(acctInits.total)) ? Number(decryptField(String(acctInits.total), financeDataKey)) || 0 : Number(acctInits?.total) || 0;
      const newAcctBal = acctInitSum + acctTxnSum;
      const encAcctBal = financeDataKey ? encryptField(enc(newAcctBal), financeDataKey) : String(newAcctBal);
      db.prepare("UPDATE finance_accounts SET balance=?, updated_at=datetime('now','localtime') WHERE id=?").run(encAcctBal, w.account_id);
    }
    logAuditEvent('initial_balance_updated', 'wallet', id, `Initial balance changed from ${oldInit} to ${initialBalance}, balance ${oldBal} -> ${newBal} for ${w.name}`, {
      old_initial: oldInit, new_initial: initialBalance, old_balance: oldBal, new_balance: newBal, wallet_name: w.name
    });
    return { success: true, newBalance: newBal };
  } catch (e: any) { return { success: false, error: e.message }; }
});

ipcMain.handle('finance:archive-wallet', async (_event, id: number) => {
  if (!db) return null;
  try {
    const wallet = db.prepare('SELECT name FROM finance_wallets WHERE id = ?').get(id) as any;
    db.prepare("UPDATE finance_wallets SET is_archived=1, updated_at=datetime('now','localtime') WHERE id=?").run(id);
    logAuditEvent('wallet_archived', 'wallet', id, `Archived wallet "${wallet?.name || id}"`);
    return { success: true };
  } catch { return null; }
});

ipcMain.handle('finance:get-wallet', async (_event, id: number) => {
  if (!db) return null;
  try {
    const wallet = db.prepare('SELECT * FROM finance_wallets WHERE id = ?').get(id) as any;
    if (!wallet) return null;
    if (financeDataKey) {
      if (wallet.balance != null && isEncrypted(wallet.balance)) wallet.balance = Number(decryptField(String(wallet.balance), financeDataKey)) || 0;
      if (wallet.last_four && isEncrypted(wallet.last_four)) wallet.last_four = decryptField(wallet.last_four, financeDataKey);
      if (wallet.initial_balance != null && isEncrypted(wallet.initial_balance)) wallet.initial_balance = Number(decryptField(String(wallet.initial_balance), financeDataKey)) || 0;
      if (wallet.metadata && isEncrypted(wallet.metadata)) {
        try { wallet.metadata = JSON.parse(decryptField(wallet.metadata, financeDataKey)); } catch { wallet.metadata = null; }
      } else if (wallet.metadata) {
        try { wallet.metadata = JSON.parse(wallet.metadata); } catch { wallet.metadata = null; }
      }
    } else {
      if (wallet.metadata) {
        try { wallet.metadata = JSON.parse(wallet.metadata); } catch { wallet.metadata = null; }
      }
    }
    return wallet;
  } catch { return null; }
});

ipcMain.handle('finance:update-wallet-metadata', async (_event, { id, metadata }: { id: number; metadata: Record<string, any> }) => {
  if (!db) return null;
  try {
    const existing = db.prepare('SELECT metadata, name FROM finance_wallets WHERE id = ?').get(id) as any;
    if (!existing) return null;

    // DECRYPT existing metadata if encrypted (fixes read inconsistency)
    let merged: Record<string, any> = {};
    if (existing.metadata) {
      const rawMeta = safeDecrypt(existing.metadata);
      try { merged = JSON.parse(rawMeta); } catch { merged = {}; }
    }
    const oldAssets: any[] = Array.isArray(merged.assets) ? [...merged.assets] : [];
    Object.assign(merged, metadata);
    const newAssets: any[] = Array.isArray(merged.assets) ? [...merged.assets] : [];

    // ENCRYPT metadata if financeDataKey is set (fixes write inconsistency)
    const jsonPlain = JSON.stringify(merged);
    const jsonToWrite = financeDataKey ? encryptField(jsonPlain, financeDataKey) : jsonPlain;
    db.prepare("UPDATE finance_wallets SET metadata=?, updated_at=datetime('now','localtime') WHERE id=?").run(jsonToWrite, id);

    // Detailed audit for asset changes
    const walletName = existing.name || `Wallet #${id}`;
    const changes: string[] = [];
    const oldMap = new Map(oldAssets.map((a: any) => [(a.coin_id || a.coinId || a.asset || '').toLowerCase(), a]));
    const newMap = new Map(newAssets.map((a: any) => [(a.coin_id || a.coinId || a.asset || '').toLowerCase(), a]));

    // Removed coins
    for (const [cid, a] of oldMap) {
      if (!newMap.has(cid)) {
        changes.push(`Removed ${(a.symbol || cid).toUpperCase()}: ${Number(a.amount) || 0} coins`);
      }
    }
    // Added coins
    for (const [cid, a] of newMap) {
      if (!oldMap.has(cid)) {
        changes.push(`Added ${(a.symbol || cid).toUpperCase()}: ${Number(a.amount) || 0} coins @ ${Number(a.avg_buy_price || a.avgBuyPrice) || 0}`);
      }
    }
    // Changed coins
    for (const [cid, a] of newMap) {
      const old = oldMap.get(cid);
      if (old) {
        const oldAmt = Number(old.amount) || 0;
        const newAmt = Number(a.amount) || 0;
        const oldAvg = Number(old.avg_buy_price || old.avgBuyPrice) || 0;
        const newAvg = Number(a.avg_buy_price || a.avgBuyPrice) || 0;
        if (oldAmt !== newAmt) changes.push(`${(a.symbol || cid).toUpperCase()}: amount ${oldAmt} → ${newAmt}`);
        if (oldAvg !== newAvg) changes.push(`${(a.symbol || cid).toUpperCase()}: avg price ${oldAvg} → ${newAvg}`);
      }
    }
    // Other metadata changes (non-assets)
    for (const [k, v] of Object.entries(metadata)) {
      if (k !== 'assets' && JSON.stringify(merged[k]) !== JSON.stringify(merged[k])) {
        changes.push(`Set ${k} = ${JSON.stringify(v)}`);
      }
    }

    if (changes.length > 0) {
      logAuditEvent('wallet_metadata_updated', 'wallet', id, `${walletName} metadata: ${changes.join('; ')}`, {
        wallet_id: id, wallet_name: walletName, changes, old_assets: oldAssets, new_assets: newAssets
      });
      // Record asset history for any changed coins
      try {
        const priceRows = db.prepare('SELECT coin_id, current_price FROM finance_crypto_prices').all() as any[];
        const priceMap = new Map(priceRows.map((r: any) => [r.coin_id.toLowerCase(), Number(r.current_price) || 0]));
        for (const [cid, a] of newMap) {
          const oldAmt = oldMap.has(cid) ? Number(oldMap.get(cid)!.amount) || 0 : 0;
          const newAmt = Number(a.amount) || 0;
          if (oldAmt !== newAmt) {
            const curPrice = priceMap.get(cid) || Number(a.avg_buy_price || a.avgBuyPrice) || 0;
            recordCryptoAssetHistory(id, cid, newAmt, Number(a.avg_buy_price || a.avgBuyPrice) || 0, curPrice);
          }
        }
      } catch { /* best-effort */ }
    }

    const updated = db.prepare('SELECT * FROM finance_wallets WHERE id = ?').get(id) as any;
    if (updated?.metadata) {
      const rawMeta = safeDecrypt(updated.metadata);
      try { updated.metadata = JSON.parse(rawMeta); } catch { updated.metadata = null; }
    }
    return updated;
  } catch { return null; }
});

ipcMain.handle('finance:get-all-coins', async () => {
  try {
    const url = 'https://api.coingecko.com/api/v3/coins/list';
    const resp = await fetch(url);
    if (!resp.ok) return [];
    return await resp.json();
  } catch { return []; }
});

ipcMain.handle('finance:fetch-crypto-prices', async (_event, coinIds: string[], currency: string = 'usd') => {
  if (!db) return [];
  const ccy = currency.toLowerCase();
  try {
    const ids = coinIds.join(',');
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${ccy}&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true`;
    const res = await fetch(url);
    if (!res.ok) {
      const cached = db.prepare('SELECT * FROM finance_crypto_prices WHERE coin_id IN (' + coinIds.map(() => '?').join(',') + ')').all(...coinIds) as any[];
      return cached;
    }
    const data = await res.json();
    const results: any[] = [];
    const upsert = db.prepare(`
      INSERT OR REPLACE INTO finance_crypto_prices (coin_id, name, symbol, current_price, market_cap, total_volume, price_change_24h, price_change_percentage_24h, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    for (const [coinId, priceData] of Object.entries(data)) {
      const pd = priceData as any;
      const priceKey = ccy;
      const marketCapKey = `${ccy}_market_cap`;
      const volKey = `${ccy}_24h_vol`;
      const price = pd[priceKey] || 0;
      const marketCap = pd[marketCapKey] || 0;
      const vol = pd[volKey] || 0;
      const changePct = pd.usd_24h_change || 0;
      upsert.run(coinId, coinId, coinId.toUpperCase().slice(0, 10), price, marketCap, vol, changePct, changePct);
      results.push({
        coin_id: coinId,
        name: coinId,
        symbol: coinId.toUpperCase().slice(0, 10),
        current_price: price,
        market_cap: marketCap,
        total_volume: vol,
        price_change_24h: changePct,
        price_change_percentage_24h: changePct,
        last_updated: new Date().toISOString()
      });
    }
    return results;
  } catch {
    try {
      if (!coinIds.length) return [];
      const cached = db.prepare('SELECT * FROM finance_crypto_prices WHERE coin_id IN (' + coinIds.map(() => '?').join(',') + ')').all(...coinIds) as any[];
      return cached;
    } catch { return []; }
  }
});

ipcMain.handle('finance:get-crypto-history', async (_event, coinId: string, days: number = 30, currency: string = 'usd') => {
  if (!db) return [];
  try {
    const cutoff = Math.floor(Date.now() / 1000) - days * 86400;
    const cached = db.prepare('SELECT timestamp, price FROM finance_crypto_history WHERE coin_id = ? AND timestamp >= ? ORDER BY timestamp ASC').all(coinId, cutoff) as any[];
    if (cached.length > 1) return cached.map(r => ({ timestamp: r.timestamp, price: r.price }));
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=${currency.toLowerCase()}&days=${days}`;
    const res = await fetch(url);
    if (!res.ok) return cached;
    const data = await res.json();
    const points = (data.prices || []).map((p: [number, number]) => ({ timestamp: Math.floor(p[0] / 1000), price: p[1] }));
    const insert = db.prepare('INSERT OR IGNORE INTO finance_crypto_history (coin_id, timestamp, price) VALUES (?, ?, ?)');
    const insertMany = db.transaction((pts: { timestamp: number; price: number }[]) => {
      for (const pt of pts) insert.run(coinId, pt.timestamp, pt.price);
    });
    insertMany(points);
    return points;
  } catch { return []; }
});

ipcMain.handle('finance:get-crypto-asset-history', async (_event, walletId: number, coinId: string) => {
  if (!db) return [];
  try {
    const cid = coinId.toLowerCase();
    // Get the wallet's current asset info for this coin
    const walletRow = db.prepare('SELECT metadata FROM finance_wallets WHERE id = ?').get(walletId) as any;
    if (!walletRow?.metadata) return [];
    let meta: any = {};
    try {
      const raw = financeDataKey && isEncrypted(walletRow.metadata) ? decryptField(String(walletRow.metadata), financeDataKey) : walletRow.metadata;
      meta = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch { return []; }
    const assets: any[] = Array.isArray(meta.assets) ? meta.assets : [];
    const coinAsset = assets.find((a: any) => String(a.coin_id || a.coinId || a.asset || '').toLowerCase() === cid);
    if (!coinAsset) return [];
    const currentAmount = Number(coinAsset.amount) || 0;
    const avgBuyPrice = Number(coinAsset.avg_buy_price || coinAsset.avgBuyPrice) || 0;

    // Get ALL transactions for this wallet that involve this coin
    const allTxns = db.prepare(`
      SELECT id, type, amount, date, metadata, from_wallet_id, to_wallet_id
      FROM finance_transactions
      WHERE (wallet_id = ? OR from_wallet_id = ? OR to_wallet_id = ?)
        AND metadata IS NOT NULL
        AND date IS NOT NULL
      ORDER BY date ASC, id ASC
    `).all(walletId, walletId, walletId) as any[];

    // Get price data for this coin from cache
    const priceRows = db.prepare('SELECT timestamp, price FROM finance_crypto_history WHERE coin_id = ? ORDER BY timestamp ASC').all(coinId) as any[];

    // Reconstruct quantity timeline from transactions
    // Start: find the earliest transaction date involving this coin on this wallet
    const coinTxns: { date: string; delta: number }[] = [];
    for (const txn of allTxns) {
      if (!txn.metadata) continue;
      try {
        const m = typeof txn.metadata === 'string' ? JSON.parse(txn.metadata) : txn.metadata;
        const txnCoinId = (m.coinId || m.coin_id || '').toLowerCase();
        if (txnCoinId !== cid) continue;

        const qty = Number(m.qty) || 0;
        if (qty <= 0) continue;

        let delta = 0;
        if (txn.type === 'transfer') {
          // Sent from this wallet
          if (Number(txn.amount) < 0) delta = -qty;
          // Received by this wallet
          else if (Number(txn.amount) > 0) delta = qty;
        } else if (txn.type === 'expense') {
          // Bought crypto (received)
          delta = qty;
        } else if (txn.type === 'income') {
          // Sold crypto (sent)
          delta = -qty;
        }

        if (delta !== 0) {
          coinTxns.push({ date: txn.date, delta });
        }
      } catch { /* skip */ }
    }

    if (coinTxns.length === 0 && currentAmount <= 0) return [];

    // Get price lookup helper
    const getPriceAtDate = (dateStr: string): number => {
      const targetTime = new Date(dateStr).getTime() / 1000;
      let closest = 0;
      for (const pr of priceRows) {
        if (pr.timestamp <= targetTime) closest = Number(pr.price);
        else break;
      }
      return closest || avgBuyPrice;
    };

    // Build history: work backwards from current amount
    // Current amount = sum of all deltas from genesis
    // Genesis amount = currentAmount - sum(all deltas)
    const totalDelta = coinTxns.reduce((s, t) => s + t.delta, 0);
    let running = currentAmount - totalDelta;

    const result: { coinId: string; amount: number; avgBuyPrice: number; fiatValue: number; date: string }[] = [];

    // Add a starting point at the date BEFORE the first transaction
    if (coinTxns.length > 0) {
      const firstDate = coinTxns[0].date;
      const genesisDate = new Date(firstDate);
      genesisDate.setDate(genesisDate.getDate() - 1);
      const genesisDateStr = genesisDate.toISOString().split('T')[0];
      const genesisPrice = getPriceAtDate(genesisDateStr);
      result.push({ coinId: cid, amount: running, avgBuyPrice, fiatValue: running * genesisPrice, date: genesisDateStr });
    }

    // Add a point for each transaction date
    for (const ct of coinTxns) {
      running += ct.delta;
      const price = getPriceAtDate(ct.date);
      result.push({ coinId: cid, amount: running, avgBuyPrice, fiatValue: running * price, date: ct.date });
    }

    // Add a final point for today if the last date isn't today
    const today = todayStr();
    if (result.length > 0 && result[result.length - 1].date !== today) {
      const todayPrice = getPriceAtDate(today);
      result.push({ coinId: cid, amount: currentAmount, avgBuyPrice, fiatValue: currentAmount * todayPrice, date: today });
    } else if (result.length > 0) {
      // Update today's point with exact current amount
      result[result.length - 1].amount = currentAmount;
      result[result.length - 1].fiatValue = currentAmount * getPriceAtDate(today);
    }

    return result;
  } catch (e: any) { console.error('[finance] get-crypto-asset-history error:', e?.message); return []; }
});

// ── Universal Asset Search (crypto + commodities + stocks via CoinGecko) ──
ipcMain.handle('finance:search-assets', async (_event, searchTerm: string, assetTypes?: string[]) => {
  if (!searchTerm || searchTerm.length < 2) return [];
  try {
    // Search CoinGecko for coins
    const url = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(searchTerm)}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const results = (data.coins || []).slice(0, 25).map((c: any) => ({
      id: c.id,
      symbol: c.symbol,
      name: c.name,
      thumb: c.thumb,
      market_cap_rank: c.market_cap_rank,
      asset_type: 'crypto',
    }));
    // Add well-known commodity tokens
    const commodities = [
      { id: 'pax-gold', symbol: 'PAXG', name: 'Pax Gold (XAU)', thumb: '', market_cap_rank: 999, asset_type: 'commodity' },
      { id: 'tether-gold', symbol: 'XAUT', name: 'Tether Gold (XAU)', thumb: '', market_cap_rank: 999, asset_type: 'commodity' },
      { id: 'tether-gold-xaut', symbol: 'XAU', name: 'Gold (via XAUT)', thumb: '', market_cap_rank: 999, asset_type: 'commodity' },
    ];
    const query = searchTerm.toLowerCase();
    const matchedCommodities = commodities.filter(c =>
      c.name.toLowerCase().includes(query) || c.symbol.toLowerCase().includes(query) || c.id.includes(query)
    );
    return [...matchedCommodities, ...results];
  } catch { return []; }
});

// ── Fetch Asset Prices (crypto + commodities via CoinGecko) ──
ipcMain.handle('finance:fetch-asset-prices', async (_event, coinIds: string[], assetType: string = 'crypto', currency: string = 'usd') => {
  if (!db) return [];
  const ccy = currency.toLowerCase();
  try {
    const ids = coinIds.join(',');
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${ccy}&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true`;
    const res = await fetch(url);
    if (!res.ok) {
      // Fall back to cache
      const cached = db.prepare('SELECT * FROM finance_crypto_prices WHERE coin_id IN (' + coinIds.map(() => '?').join(',') + ')').all(...coinIds) as any[];
      return cached.map(r => ({
        coin_id: r.coin_id, name: r.name, symbol: r.symbol,
        current_price: r.current_price, market_cap: r.market_cap,
        total_volume: r.total_volume, price_change_24h: r.price_change_24h,
        price_change_percentage_24h: r.price_change_percentage_24h,
        last_updated: r.last_updated,
      }));
    }
    const data = await res.json();
    const insert = db.prepare('INSERT OR REPLACE INTO finance_crypto_prices (coin_id, name, symbol, current_price, market_cap, total_volume, price_change_24h, price_change_percentage_24h, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const results: any[] = [];
    for (const id of coinIds) {
      const p = data[id];
      if (p) {
        const price = p[ccy] ?? 0;
        const mc = p[`${ccy}_market_cap`] ?? 0;
        const vol = p[`${ccy}_24h_vol`] ?? 0;
        const chg = p[`${ccy}_24h_change`] ?? 0;
        const name = id;
        const symbol = id.substring(0, 6);
        insert.run(id, name, symbol, price, mc, vol, chg * price / 100, chg, new Date().toISOString());
        results.push({
          coin_id: id, name, symbol,
          current_price: price, market_cap: mc,
          total_volume: vol, price_change_24h: chg * price / 100,
          price_change_percentage_24h: chg,
          last_updated: new Date().toISOString(),
        });
      }
    }
    return results;
  } catch { return []; }
});

// ── Fetch Asset History (crypto + commodities via CoinGecko) ──
ipcMain.handle('finance:get-asset-history', async (_event, coinId: string, assetType: string = 'crypto', days: number = 30, currency: string = 'usd') => {
  if (!db) return [];
  try {
    const cutoff = Math.floor(Date.now() / 1000) - days * 86400;
    const cached = db.prepare('SELECT timestamp, price FROM finance_crypto_history WHERE coin_id = ? AND timestamp >= ? ORDER BY timestamp ASC').all(coinId, cutoff) as any[];
    if (cached.length > 1) return cached.map(r => ({ timestamp: r.timestamp, price: r.price }));
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=${currency.toLowerCase()}&days=${days}`;
    const res = await fetch(url);
    if (!res.ok) return cached;
    const data = await res.json();
    const points = (data.prices || []).map((p: [number, number]) => ({ timestamp: Math.floor(p[0] / 1000), price: p[1] }));
    const insert = db.prepare('INSERT OR IGNORE INTO finance_crypto_history (coin_id, timestamp, price) VALUES (?, ?, ?)');
    const insertMany = db.transaction((pts: { timestamp: number; price: number }[]) => {
      for (const pt of pts) insert.run(coinId, pt.timestamp, pt.price);
    });
    insertMany(points);
    return points;
  } catch { return []; }
});

// ── Categories ──
ipcMain.handle('finance:get-categories', async () => {
  if (!db) return [];
  try {
    const categories = db.prepare('SELECT * FROM finance_categories WHERE is_archived = 0 ORDER BY sort_order').all() as any[];
    // Compute total spent per category from transactions
    const txns = db.prepare('SELECT category_id, amount FROM finance_transactions WHERE type = \'expense\'').all() as any[];
    const catAmounts = new Map<number, number>();
    for (const t of txns) {
      const amt = financeDataKey && isEncrypted(t.amount) ? Number(decryptField(String(t.amount), financeDataKey)) || 0 : Number(t.amount) || 0;
      const catId = t.category_id;
      catAmounts.set(catId, (catAmounts.get(catId) || 0) + Math.abs(amt));
    }
    for (const c of categories) {
      c.amount = catAmounts.get(c.id) || 0;
    }
    return categories;
  } catch { return []; }
});

ipcMain.handle('finance:create-category', async (_event, data: any) => {
  if (!db) return null;
  try {
    const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM finance_categories').get() as any;
    const stmt = db.prepare(`
      INSERT INTO finance_categories (name, type, icon, color, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(data.name, data.type, data.icon || 'CircleDollarSign', data.color || '#10b981', maxOrder?.next || 1);
    logAuditEvent('category_created', 'category', result.lastInsertRowid as number, `Created ${data.type} category "${data.name}"`, { name: data.name, type: data.type, color: data.color });
    return { id: result.lastInsertRowid, ...data };
  } catch (error: any) {
    console.error('[finance] create category error:', error);
    return null;
  }
});

ipcMain.handle('finance:update-category', async (_event, data: any) => {
  if (!db) return null;
  try {
    db.prepare(`
      UPDATE finance_categories SET name=?, type=?, icon=?, color=? WHERE id=?
    `).run(data.name, data.type, data.icon, data.color, data.id);
    logAuditEvent('category_updated', 'category', data.id, `Updated category "${data.name}"`, { name: data.name, type: data.type, color: data.color });
    return { success: true };
  } catch { return null; }
});

// ── Transactions ──
ipcMain.handle('finance:get-transactions', async (_event, filters?: any) => {
  if (!db) return [];
  try {
    let query = `
      SELECT t.*, COALESCE(t.on_behalf_of_label, fp.name) as on_behalf_of_label, a.name as account_name, c.name as category_name, c.color as category_color, c.icon as category_icon, w.name as wallet_name
      FROM finance_transactions t
      LEFT JOIN finance_ft_persons fp ON t.ft_person_id = fp.id
      LEFT JOIN finance_accounts a ON t.account_id = a.id
      LEFT JOIN finance_categories c ON t.category_id = c.id
      LEFT JOIN finance_wallets w ON t.wallet_id = w.id
    `;
    const conditions: string[] = [];
    const params: any[] = [];
    if (filters?.type) { conditions.push('t.type = ?'); params.push(filters.type); }
    if (filters?.account_id) { conditions.push('t.account_id = ?'); params.push(filters.account_id); }
    if (filters?.category_id) { conditions.push('t.category_id = ?'); params.push(filters.category_id); }
    if (filters?.date_from) { conditions.push('t.date >= ?'); params.push(filters.date_from); }
    if (filters?.date_to) { conditions.push('t.date <= ?'); params.push(filters.date_to); }
    if (filters?.search) {
      conditions.push('(t.description LIKE ? OR t.note LIKE ?)');
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }
    if (filters?.wallet_id) {
      conditions.push('(t.wallet_id = ? OR t.from_wallet_id = ? OR t.to_wallet_id = ?)');
      params.push(filters.wallet_id, filters.wallet_id, filters.wallet_id);
    }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY t.date DESC, t.id DESC';
    if (filters?.limit) { query += ' LIMIT ?'; params.push(filters.limit); }
    const rows = db.prepare(query).all(...params) as any[];
    // Decrypt sensitive fields if key available
    if (financeDataKey) {
      for (const row of rows) {
        if (row.amount != null && isEncrypted(row.amount)) row.amount = Number(decryptField(String(row.amount), financeDataKey)) || 0;
        if (row.description && isEncrypted(row.description)) row.description = decryptField(row.description, financeDataKey);
        if (row.note && isEncrypted(row.note)) row.note = decryptField(row.note, financeDataKey);
        if (row.metadata && isEncrypted(row.metadata)) {
          try { row.metadata = JSON.parse(decryptField(row.metadata, financeDataKey)); } catch { /* leave as-is */ }
        }
      }
    }
    return rows;
  } catch (error: any) {
    console.error('[finance] get transactions error:', error);
    return [];
  }
});

ipcMain.handle('finance:create-transaction', async (_event, data: any) => {
  if (!db) return { error: 'Database not initialized' };
  try {
    const fee = Math.abs(Number(data.fee) || 0);
    const merchant = data.merchant || null;
    const isAdjustment = data.is_adjustment ? 1 : 0;

    // Historical (is_adjustment) transactions always use 1900-01-01 as date
    const txnDate = isAdjustment ? '1900-01-01' : (data.date || todayStr());

    // Parse metadata early (used by category resolution + crypto logic)
    let parsedMeta: any = null;
    if (data.metadata) {
      try { parsedMeta = typeof data.metadata === 'string' ? JSON.parse(data.metadata) : data.metadata; } catch {}
    }

    // === CATEGORY RESOLUTION (fixes hardcoded category_id:1) ===
    let resolvedCategoryId = data.category_id;

    // Auto-assign Investment category for crypto buy transactions
    if (parsedMeta && (parsedMeta.coinId || parsedMeta.coin_id) && data.type === 'expense' && !data.category_id) {
      const invCat = db.prepare("SELECT id FROM finance_categories WHERE name = 'Investment' AND type = 'expense' LIMIT 1").get() as any;
      if (invCat) resolvedCategoryId = invCat.id;
    }

    const catExists = db.prepare('SELECT id FROM finance_categories WHERE id = ?').get(resolvedCategoryId) as any;
    if (!catExists) {
      const fallback = db.prepare(
        `SELECT id FROM finance_categories WHERE type = ? OR type IS NULL ORDER BY id LIMIT 1`
      ).get(data.type) as any;
      if (fallback) {
        resolvedCategoryId = fallback.id;
      } else {
        const anyCat = db.prepare('SELECT id FROM finance_categories ORDER BY id LIMIT 1').get() as any;
        if (anyCat) resolvedCategoryId = anyCat.id;
        else resolvedCategoryId = 0;
      }
      console.warn(`[finance] category_id ${data.category_id} not found, fell back to ${resolvedCategoryId}`);
    }

    // Enforce sign convention server-side: expenses always negative, income always positive
    const safeAmount = data.type === 'expense'
      ? -Math.abs(data.amount)
      : data.type === 'income'
        ? Math.abs(data.amount)
        : data.amount;

    // Balance delta accounts for fee
    const balanceDelta = data.type === 'expense'
      ? safeAmount - fee
      : data.type === 'income'
        ? safeAmount - fee
        : safeAmount;

    const sortOrder = isAdjustment && data.wallet_id ? ((db.prepare('SELECT COALESCE(MAX(sort_order), 0) as max FROM finance_transactions WHERE wallet_id = ?').get(data.wallet_id) as any)?.max || 0) + 1 : 0;
    const stmt = db.prepare(`
      INSERT INTO finance_transactions (account_id, wallet_id, category_id, type, amount, fee, merchant, description, note, "date", "time", is_adjustment, on_behalf_of, on_behalf_of_label, ft_person_id, metadata, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    // Encrypt sensitive fields if key available
    const encAmount = financeDataKey ? encryptField(enc(safeAmount), financeDataKey) : String(safeAmount);
    const encDesc = financeDataKey && data.description ? encryptField(data.description, financeDataKey) : (data.description || null);
    const encNote = financeDataKey && data.note ? encryptField(data.note, financeDataKey) : (data.note || null);
    const encMetadata = financeDataKey && data.metadata ? encryptField(JSON.stringify(data.metadata), financeDataKey) : (data.metadata ? JSON.stringify(data.metadata) : null);
    const result = stmt.run(
      data.account_id, data.wallet_id || null, resolvedCategoryId,
      data.type, encAmount, fee, merchant, encDesc, encNote,
      txnDate, data.time || null, isAdjustment, data.on_behalf_of ? 1 : 0, data.on_behalf_of_label || null, data.ft_person_id || null, encMetadata, sortOrder
    );

    const newId = Number(result.lastInsertRowid);

    // === CRYPTO BUY: Update wallet metadata + balance atomically ===
    if (parsedMeta && (parsedMeta.coinId || parsedMeta.coin_id) && data.wallet_id && data.type === 'expense') {
      const wallet = db.prepare('SELECT * FROM finance_wallets WHERE id = ?').get(data.wallet_id) as any;
      if (wallet) {
        let meta: any = {};
        if (wallet.metadata) {
          const rawMeta = safeDecrypt(wallet.metadata);
          try { meta = JSON.parse(rawMeta); } catch { meta = {}; }
        }
        const assets: any[] = Array.isArray(meta.assets) ? meta.assets : [];
        const newAsset = {
          coin_id: parsedMeta.coinId || parsedMeta.coin_id,
          symbol: parsedMeta.symbol || '',
          name: parsedMeta.name || '',
          amount: Number(parsedMeta.qty) || 0,
          avg_buy_price: Number(parsedMeta.price) || 0,
          asset_type: 'crypto',
          txn_id: newId,
        };
        // Fix #4: Merge same-coin entries instead of always pushing duplicates
        const existingIdx = assets.findIndex(a => (a.coin_id || a.coinId) === newAsset.coin_id);
        if (existingIdx >= 0) {
          const existing = assets[existingIdx];
          const oldAmt = Number(existing.amount) || 0;
          const newAmt = oldAmt + newAsset.amount;
          const oldAvg = Number(existing.avg_buy_price || existing.avgBuyPrice) || 0;
          existing.amount = newAmt;
          existing.avg_buy_price = newAmt > 0 ? ((oldAmt * oldAvg) + (newAsset.amount * newAsset.avg_buy_price)) / newAmt : newAsset.avg_buy_price;
        } else {
          assets.push(newAsset);
        }
        meta.assets = assets;

        // Write metadata — ENCRYPT if financeDataKey is set
        const metaToWrite = financeDataKey ? encryptField(JSON.stringify(meta), financeDataKey) : JSON.stringify(meta);

        // Decrypt current balance if encrypted
        let curBalance = safeDecrypt(wallet.balance);
        const newBalance = Number(curBalance) || 0;
        const balToWrite = financeDataKey ? encryptField(String(newBalance - Math.abs(data.amount)), financeDataKey) : String(newBalance - Math.abs(data.amount));

        db.prepare(
          `UPDATE finance_wallets SET metadata = ?, balance = ?, updated_at = datetime('now','localtime') WHERE id = ?`
        ).run(metaToWrite, balToWrite, data.wallet_id);

        // Fix #5: Account balance must also reflect the fiat spent on crypto
        if (data.account_id) {
          const acctRow = db.prepare('SELECT balance FROM finance_accounts WHERE id = ?').get(data.account_id) as any;
          const curAcctBal = financeDataKey && isEncrypted(acctRow?.balance)
            ? Number(decryptField(String(acctRow.balance), financeDataKey)) || 0
            : Number(acctRow?.balance) || 0;
          const newAcctBal = curAcctBal + (data.amount || 0);
          const encAcctBal = financeDataKey ? encryptField(enc(newAcctBal), financeDataKey) : String(newAcctBal);
          db.prepare("UPDATE finance_accounts SET balance = ?, updated_at = datetime('now','localtime') WHERE id = ?")
            .run(encAcctBal, data.account_id);
        }
      }
    }

    // If paying from person's balance, deduct from ft_person instead of wallet
    if (data.use_person_balance && data.ft_person_id) {
      const person = db.prepare('SELECT id, name, balance FROM finance_ft_persons WHERE id = ?').get(data.ft_person_id) as any;
      if (person) {
        const deductAmount = Math.abs(safeAmount);
        const personBal = Number(person.balance) || 0;
        const newPersonBal = personBal - deductAmount;
        db.prepare('UPDATE finance_ft_persons SET balance = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(newPersonBal, data.ft_person_id);
        logAuditEvent('ft_person_deduct', 'transaction', newId, `Deducted $${deductAmount} from "${person.name}" balance for transaction #${newId}: ${data.description || ''}`, { amount: deductAmount, person_id: data.ft_person_id, new_balance: newPersonBal, transaction_id: newId });
      }
    } else if (!parsedMeta || !(parsedMeta.coinId || parsedMeta.coin_id)) {
      // Normal path (non-crypto): update account + wallet balances
      if (financeDataKey) {
        const acctRow = db.prepare('SELECT balance FROM finance_accounts WHERE id = ?').get(data.account_id) as any;
        const curBal = acctRow && isEncrypted(acctRow.balance) ? Number(decryptField(String(acctRow.balance), financeDataKey)) || 0 : Number(acctRow?.balance) || 0;
        const newBal = curBal + balanceDelta;
        db.prepare('UPDATE finance_accounts SET balance = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(encryptField(enc(newBal), financeDataKey), data.account_id);
        if (data.wallet_id) {
          const wRow = db.prepare('SELECT balance FROM finance_wallets WHERE id = ?').get(data.wallet_id) as any;
          const wBal = wRow && isEncrypted(wRow.balance) ? Number(decryptField(String(wRow.balance), financeDataKey)) || 0 : Number(wRow?.balance) || 0;
          db.prepare('UPDATE finance_wallets SET balance = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(encryptField(enc(wBal + balanceDelta), financeDataKey), data.wallet_id);
        }
      } else {
        db.prepare('UPDATE finance_accounts SET balance = balance + ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(balanceDelta, data.account_id);
        if (data.wallet_id) {
          db.prepare('UPDATE finance_wallets SET balance = balance + ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(balanceDelta, data.wallet_id);
        }
      }
    }

    // === PHYSICAL WALLET: Update denomination metadata ===
    if (data.wallet_id && parsedMeta && parsedMeta.denomination_after) {
      try {
        const pwRow = db.prepare('SELECT type, metadata FROM finance_wallets WHERE id = ?').get(data.wallet_id) as any;
        if (pwRow && (pwRow.type === 'physical' || pwRow.type === 'cash')) {
          let wMeta: any = {};
          if (pwRow.metadata) {
            const raw = safeDecrypt(pwRow.metadata);
            try { wMeta = JSON.parse(raw); } catch { wMeta = {}; }
          }
          wMeta.denominations = parsedMeta.denomination_after;
          if (parsedMeta.change_kept !== undefined) {
            wMeta.last_change = parsedMeta.change_kept;
          }
          const wMetaToWrite = financeDataKey ? encryptField(JSON.stringify(wMeta), financeDataKey) : JSON.stringify(wMeta);
          db.prepare("UPDATE finance_wallets SET metadata = ?, updated_at = datetime('now','localtime') WHERE id = ?")
            .run(wMetaToWrite, data.wallet_id);
        }
      } catch (e: any) {
        console.error('[finance] physical wallet denomination update error:', e?.message);
      }
    }

    // Read back the actual created_at from the DB
    const created = db.prepare('SELECT created_at FROM finance_transactions WHERE id = ?').get(newId) as any;
    const actualCreatedAt = created?.created_at || '';

    logAuditEvent('transaction_created', 'transaction', newId, `${data.type} $${Math.abs(data.amount)}: ${data.description || 'no description'}`,
      Object.assign({}, data, { safe_amount: safeAmount, actual_created_at: actualCreatedAt, transaction_id: newId })
    );

    // Capture finance episode into context brain
    try {
      const catRow = db.prepare('SELECT name FROM finance_categories WHERE id = ?').get(resolvedCategoryId) as any;
      episodeWriters.writeFinanceEpisode('transaction', {
        id: newId,
        description: data.description,
        category: catRow?.name || 'uncategorized',
        amount: Math.abs(data.amount),
        currency: data.currency || 'IDR',
        type: data.type,
      }, 'created');
    } catch {}

    return { id: newId, ...data };
  } catch (error: any) {
    const errMsg = error?.message || String(error) || 'Unknown error';
    const errCode = error?.code || '';
    const sqlMsg = error?.sqlMessage || '';
    console.error('[finance] create transaction error:', error);
    return { error: `Transaction failed: ${errMsg}${errCode ? ` [code: ${errCode}]` : ''}${sqlMsg ? ` [SQL: ${sqlMsg}]` : ''}` };
  }
});

// Balance adjustment transaction (historical data / correction)
ipcMain.handle('finance:create-adjustment', async (_event, data: any) => {
  if (!db) return null;
  try {
    const amount = Number(data.amount) || 0;
    const walletId = data.wallet_id || null;
    const accountId = data.account_id || null;
    const subCatId = getSubCategoryId();
    const txnDate = '1900-01-01'; // Historical adjustments always use 1900-01-01
    const description = data.description || 'Balance adjustment';

    const result = db.prepare(`
      INSERT INTO finance_transactions (account_id, wallet_id, category_id, type, amount, fee, merchant, description, note, "date", "time", is_adjustment, on_behalf_of, on_behalf_of_label, metadata, sort_order)
      VALUES (?, ?, ?, 'expense', ?, 0, ?, ?, ?, ?, ?, 1, 0, NULL, ?, ?)
    `).run(accountId, walletId, subCatId, Math.abs(amount), null, description, data.note || 'Historical balance correction', txnDate, null, data.metadata || null, (() => {
      const maxSort = walletId ? (db.prepare('SELECT COALESCE(MAX(sort_order), 0) as max FROM finance_transactions WHERE wallet_id = ?').get(walletId) as any)?.max || 0 : 0;
      return maxSort + 1;
    })());

    const newId = Number(result.lastInsertRowid);

    // Update wallet + account balance (adjustment is a real transaction, just chronologically earliest)
    const balanceDelta = -Math.abs(amount); // expense → subtract
    if (walletId) {
      if (financeDataKey) {
        const wRow = db.prepare('SELECT balance FROM finance_wallets WHERE id = ?').get(walletId) as any;
        const wBal = wRow && isEncrypted(wRow.balance) ? Number(decryptField(String(wRow.balance), financeDataKey)) || 0 : Number(wRow?.balance) || 0;
        db.prepare('UPDATE finance_wallets SET balance = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?')
          .run(encryptField(enc(wBal + balanceDelta), financeDataKey), walletId);
      } else {
        db.prepare('UPDATE finance_wallets SET balance = balance + ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?')
          .run(balanceDelta, walletId);
      }
    }
    if (accountId) {
      if (financeDataKey) {
        const aRow = db.prepare('SELECT balance FROM finance_accounts WHERE id = ?').get(accountId) as any;
        const aBal = aRow && isEncrypted(aRow.balance) ? Number(decryptField(String(aRow.balance), financeDataKey)) || 0 : Number(aRow?.balance) || 0;
        db.prepare('UPDATE finance_accounts SET balance = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?')
          .run(encryptField(enc(aBal + balanceDelta), financeDataKey), accountId);
      } else {
        db.prepare('UPDATE finance_accounts SET balance = balance + ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?')
          .run(balanceDelta, accountId);
      }
    }

    return { id: newId, is_adjustment: true };
  } catch (error: any) {
    console.error('[finance] create adjustment error:', error);
    return null;
  }
});

// ── Two-legged atomic transfer ──
ipcMain.handle('finance:create-transfer', async (_event, data: any) => {
  if (!db) return null;
  const transferId = `txfer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const isAdjustment = data.is_adjustment ? 1 : 0;
  const insert = db.prepare(`
    INSERT INTO finance_transactions (account_id, wallet_id, category_id, type, amount, fee, merchant, description, note, "date", "time", transfer_id, from_wallet_id, to_wallet_id, on_behalf_of, on_behalf_of_label, metadata, is_adjustment, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateSrcWallet = db.prepare('UPDATE finance_wallets SET balance = balance + ?, updated_at = ? WHERE id = ?');
  const updateDstWallet = db.prepare('UPDATE finance_wallets SET balance = balance + ?, updated_at = ? WHERE id = ?');
  const updateSrcAccount = db.prepare('UPDATE finance_accounts SET balance = balance + ?, updated_at = ? WHERE id = ?');
  const updateDstAccount = db.prepare('UPDATE finance_accounts SET balance = balance + ?, updated_at = ? WHERE id = ?');

  const srcWalletId = data.wallet_id;
  const dstWalletId = data.to_wallet_id;
  const srcAccountId = data.account_id;

  if (!srcAccountId) return { success: false, error: 'Source wallet has no account' };
  if (!dstWalletId) return { success: false, error: 'No destination wallet selected' };

  // Get destination wallet's account_id AND type
  const dstWallet = db.prepare('SELECT account_id, currency, type FROM finance_wallets WHERE id = ?').get(dstWalletId) as any;
  if (!dstWallet) return { success: false, error: 'Destination wallet not found' };
  const dstAccountId = dstWallet.account_id;
  const dstIsCrypto = dstWallet.type === 'crypto' || dstWallet.type === 'investment';

  // Ensure date is never empty; historical transfers use 1900-01-01
  const txnDate = data.is_adjustment ? '1900-01-01' : (data.date || todayStr());
  const sortOrder = isAdjustment ? ((db.prepare('SELECT COALESCE(MAX(sort_order), 0) as max FROM finance_transactions WHERE wallet_id = ?').get(srcWalletId) as any)?.max || 0) + 1 : 0;

  // Resolve fee: use data.fee if provided (crypto transfers), otherwise from DB columns
  const baseAmt = Math.abs(data.amount);
  if (!baseAmt || baseAmt <= 0) return { success: false, error: 'Transfer amount must be greater than zero' };
  let feeAmount = 0;
  let feeType = 'none';
  if (typeof data.fee === 'number' && data.fee > 0) {
    feeAmount = data.fee;
    feeType = 'explicit';
  } else {
    const srcWalletRow = db.prepare('SELECT transfer_fee_type, transfer_fee_value FROM finance_wallets WHERE id = ?').get(srcWalletId) as any;
    feeType = srcWalletRow?.transfer_fee_type || 'none';
    const feeValue = Number(srcWalletRow?.transfer_fee_value) || 0;
    if (feeType !== 'none' && feeValue > 0) {
      feeAmount = feeType === 'percentage' ? (baseAmt * feeValue / 100) : feeValue;
    }
  }

  // Resolve transfer amount
  const srcAmt = -baseAmt;
  // Fee reduces what the destination receives (unless dest_amount is explicit — crypto→fiat)
  const dstAmt = typeof data.dest_amount === 'number' && data.dest_amount > 0 ? data.dest_amount : baseAmt - feeAmount;

  // Detect crypto transfer (metadata with coinId present)
  const isCryptoTransfer = !!(data.metadata && data.metadata.coinId && data.metadata.qty);
  // Determine the actual transfer type based on wallet types
  // crypto→crypto: source is crypto, dest is crypto → move crypto only
  // crypto→fiat: source is crypto, dest is fiat → move fiat only
  // For now we detect source type from metadata presence
  const srcIsCrypto = isCryptoTransfer; // if it has crypto metadata, source is crypto
  const isCryptoToCrypto = isCryptoTransfer && dstIsCrypto;
  const isCryptoToFiat = isCryptoTransfer && !dstIsCrypto;

  const description = data.description?.trim() || 'Transfer';
  const srcDesc = `Transfer to ${data.toWalletName || 'another wallet'}`;
  const dstDesc = `Transfer from ${data.fromWalletName || 'another wallet'}`;

  try {
    // Resolve category_id
    let catId = data.category_id;
    if (!catId) {
      const transferCat = db.prepare("SELECT id FROM finance_categories WHERE type = 'transfer' LIMIT 1").get() as any;
      if (transferCat) {
        catId = transferCat.id;
      } else {
        db.prepare("INSERT INTO finance_categories (name, type, icon, color, sort_order) VALUES ('Transfer', 'transfer', 'ArrowLeftRight', '#f59e0b', 15)").run();
        catId = db.prepare("SELECT id FROM finance_categories WHERE type = 'transfer' LIMIT 1").get() as any;
        catId = catId?.id;
      }
    }

    const runTransfer = db.transaction(() => {
      // Encrypt sensitive fields for INSERT
      const encSrcAmt = financeDataKey ? encryptField(enc(srcAmt), financeDataKey) : String(srcAmt);
      const encSrcDesc = financeDataKey ? encryptField(srcDesc, financeDataKey) : srcDesc;
      const encDstDesc = financeDataKey ? encryptField(dstDesc, financeDataKey) : dstDesc;
      const encNote = financeDataKey && data.note ? encryptField(data.note, financeDataKey) : (data.note || null);

      // Prepare crypto metadata for transaction rows
      const srcMetadata = data.metadata ? JSON.stringify(data.metadata) : null;
      const dstMetadataStr = data.dest_metadata ? JSON.stringify(data.dest_metadata) : null;

      // Leg 1: debit from source
      const r1 = insert.run(srcAccountId, srcWalletId, catId, 'transfer', encSrcAmt, 0, null, encSrcDesc, encNote, txnDate, data.time || null, transferId, srcWalletId, dstWalletId, 0, null, srcMetadata, isAdjustment, sortOrder);
      if (!r1.lastInsertRowid) throw new Error('Failed to create source leg');

      // Leg 2: credit to destination (reduced by fee)
      // For crypto transfers, fee is 0 on dest leg (captured in source metadata)
      const dstFeeAmount = isCryptoTransfer ? 0 : feeAmount;
      const encDstAmt = financeDataKey ? encryptField(enc(dstAmt), financeDataKey) : String(dstAmt);
      const r2 = insert.run(dstAccountId, dstWalletId, catId, 'transfer', encDstAmt, dstFeeAmount, null, encDstDesc, encNote, txnDate, data.time || null, transferId, srcWalletId, dstWalletId, 0, null, dstMetadataStr, isAdjustment, sortOrder);
      if (!r2.lastInsertRowid) throw new Error('Failed to create destination leg');

      if (isCryptoTransfer) {
        // ── Crypto→crypto: move assets between wallet metadata, skip fiat balance updates ──
        const coinId = data.metadata.coinId;
        const symbol = data.metadata.symbol || coinId;
        const sendQty = Number(data.metadata.qty) || 0;
        const feeQty = Number(data.metadata.fee) || 0;
        const recvQty = sendQty - feeQty;
        const price = Number(data.metadata.price) || 0;

        console.log(`[finance] CRYPTO TRANSFER START: coinId="${coinId}" symbol="${symbol}" sendQty=${sendQty} feeQty=${feeQty} recvQty=${recvQty} price=${price}`);

        // Helper to read wallet metadata safely
        const readMeta = (wid: number): Record<string, any> => {
          const row = db.prepare('SELECT metadata FROM finance_wallets WHERE id = ?').get(wid) as any;
          console.log(`[finance] readMeta wallet ${wid}: raw_metadata_type=${typeof row?.metadata}, isEncrypted=${row?.metadata ? isEncrypted(row.metadata) : 'N/A'}, raw_preview=${String(row?.metadata)?.substring(0, 100)}`);
          if (!row?.metadata) { console.log(`[finance] readMeta wallet ${wid}: NO METADATA, returning empty`); return { assets: [] }; }
          try {
            const raw = isEncrypted(row.metadata) ? decryptField(String(row.metadata), financeDataKey) : row.metadata;
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            console.log(`[finance] readMeta wallet ${wid}: parsed OK, assets=${JSON.stringify(parsed.assets)?.substring(0, 200)}`);
            return parsed;
          } catch (e: any) { console.error(`[finance] readMeta wallet ${wid}: PARSE FAILED:`, e?.message); return { assets: [] }; }
        };

        // Helper to write wallet metadata safely
        const writeMeta = (wid: number, meta: Record<string, any>) => {
          const json = JSON.stringify(meta);
          console.log(`[finance] writeMeta wallet ${wid}: writing ${meta.assets?.length ?? 0} assets: ${JSON.stringify(meta.assets)?.substring(0, 200)}`);
          try {
            if (financeDataKey) {
              db.prepare('UPDATE finance_wallets SET metadata = ?, updated_at = ? WHERE id = ?')
                .run(encryptField(json, financeDataKey), now, wid);
            } else {
              db.prepare('UPDATE finance_wallets SET metadata = ?, updated_at = ? WHERE id = ?')
                .run(json, now, wid);
            }
            console.log(`[finance] writeMeta OK: wallet ${wid}`);
          } catch (e: any) {
            console.error(`[finance] writeMeta FAILED: wallet ${wid}`, e?.message);
          }
        };

        // Source wallet: reduce/remove the coin
        const srcMeta = readMeta(srcWalletId);
        const srcAssets: any[] = Array.isArray(srcMeta.assets) ? srcMeta.assets : [];
        console.log(`[finance] SOURCE wallet ${srcWalletId}: ${srcAssets.length} assets, looking for coinId="${coinId}"`);
        for (const a of srcAssets) {
          const key = a.coin_id || a.coinId || a.asset || '(no key)';
          console.log(`[finance]   asset: key="${key}" amount=${a.amount} symbol=${a.symbol}`);
        }
        const srcIdx = srcAssets.findIndex((a: any) => String(a.coin_id || a.coinId || a.asset || '').toLowerCase() === String(coinId).toLowerCase());
        console.log(`[finance] SOURCE findIndex result: srcIdx=${srcIdx}`);
        if (srcIdx >= 0) {
          const oldAmt = Number(srcAssets[srcIdx].amount) || 0;
          srcAssets[srcIdx].amount = oldAmt - sendQty;
          console.log(`[finance] SOURCE: reduced ${coinId} from ${oldAmt} to ${srcAssets[srcIdx].amount}`);
          if (srcAssets[srcIdx].amount <= 0) {
            srcAssets.splice(srcIdx, 1);
            console.log(`[finance] SOURCE: removed ${coinId} (amount <= 0)`);
          }
        } else {
          console.log(`[finance] SOURCE: COIN NOT FOUND in source wallet! Will NOT reduce.`);
        }
        srcMeta.assets = srcAssets;
        writeMeta(srcWalletId, srcMeta);

        // Destination wallet: add/merge the coin (received qty = sent - fee)
        const dstMeta = readMeta(dstWalletId);
        const dstAssets: any[] = Array.isArray(dstMeta.assets) ? dstMeta.assets : [];
        const dstIdx = dstAssets.findIndex((a: any) => String(a.coin_id || a.coinId || a.asset || '').toLowerCase() === String(coinId).toLowerCase());
        let dstPrevAvgBuyPrice = 0;
        if (dstIdx >= 0) {
          // Merge: increase amount, recalc avg_buy_price weighted
          const existing = dstAssets[dstIdx];
          const oldAmt = Number(existing.amount) || 0;
          const oldAvg = Number(existing.avg_buy_price || existing.avgBuyPrice) || 0;
          dstPrevAvgBuyPrice = oldAvg; // store pre-transfer avg for delete reversal
          const newAmt = oldAmt + recvQty;
          existing.amount = newAmt;
          existing.avg_buy_price = newAmt > 0 ? ((oldAmt * oldAvg) + (recvQty * price)) / newAmt : price;
          console.log(`[finance] DEST: merged ${coinId} ${oldAmt}+${recvQty}=${newAmt}`);
        } else {
          dstPrevAvgBuyPrice = price; // new coin — pre-transfer avg is the price itself
          dstAssets.push({ coin_id: coinId, symbol: symbol.toUpperCase(), amount: recvQty, avg_buy_price: price });
          console.log(`[finance] DEST: added new ${coinId} ${recvQty} @ ${price}`);
        }
        dstMeta.assets = dstAssets;
        writeMeta(dstWalletId, dstMeta);

        // Store dstPrevAvgBuyPrice in source leg metadata for delete reversal
        if (dstPrevAvgBuyPrice > 0 && srcMetadata) {
          try {
            const parsed = JSON.parse(srcMetadata);
            parsed.dstPrevAvgBuyPrice = dstPrevAvgBuyPrice;
            db.prepare('UPDATE finance_transactions SET metadata = ? WHERE id = ?').run(JSON.stringify(parsed), Number(r1.lastInsertRowid));
          } catch { /* best-effort */ }
        }

        console.log(`[finance] crypto transfer DONE: moved ${sendQty} ${symbol} from wallet ${srcWalletId} to ${dstWalletId} (fee: ${feeQty}, received: ${recvQty})`);
        // Record asset history for both wallets
        const srcAfterAmt = srcMeta.assets.find((a: any) => String(a.coin_id || a.coinId || a.asset || '').toLowerCase() === String(coinId).toLowerCase());
        const dstAfterAmt = dstMeta.assets.find((a: any) => String(a.coin_id || a.coinId || a.asset || '').toLowerCase() === String(coinId).toLowerCase());
        recordCryptoAssetHistory(srcWalletId, coinId, srcAfterAmt ? Number(srcAfterAmt.amount) : 0, srcAfterAmt ? Number(srcAfterAmt.avg_buy_price || srcAfterAmt.avgBuyPrice) || 0 : 0, price);
        recordCryptoAssetHistory(dstWalletId, coinId, dstAfterAmt ? Number(dstAfterAmt.amount) : 0, dstAfterAmt ? Number(dstAfterAmt.avg_buy_price || dstAfterAmt.avgBuyPrice) || 0 : 0, price);
      }

      // Fiat balance updates
      // RULE: Crypto transfers NEVER touch fiat balances EXCEPT crypto→fiat on the destination wallet.
      // Crypto→crypto: NO fiat changes (assets tracked in metadata only).
      // Crypto→fiat: only destination wallet + account get fiat added.
      // Fiat→fiat: both source and destination updated (standard transfer).
      if (!isCryptoTransfer) {
        // ── Standard fiat→fiat transfer: update both wallets ──
        const srcDeduction = srcAmt - feeAmount;
        if (financeDataKey) {
          if (srcWalletId) {
            const wRow = db.prepare('SELECT balance FROM finance_wallets WHERE id = ?').get(srcWalletId) as any;
            const wBal = wRow && isEncrypted(wRow.balance) ? Number(decryptField(String(wRow.balance), financeDataKey)) || 0 : Number(wRow?.balance) || 0;
            db.prepare('UPDATE finance_wallets SET balance = ?, updated_at = ? WHERE id = ?').run(encryptField(enc(wBal + srcDeduction), financeDataKey), now, srcWalletId);
          }
          if (dstWalletId) {
            const wRow = db.prepare('SELECT balance FROM finance_wallets WHERE id = ?').get(dstWalletId) as any;
            const wBal = wRow && isEncrypted(wRow.balance) ? Number(decryptField(String(wRow.balance), financeDataKey)) || 0 : Number(wRow?.balance) || 0;
            db.prepare('UPDATE finance_wallets SET balance = ?, updated_at = ? WHERE id = ?').run(encryptField(enc(wBal + dstAmt), financeDataKey), now, dstWalletId);
          }
          const srcAcctRow = db.prepare('SELECT balance FROM finance_accounts WHERE id = ?').get(srcAccountId) as any;
          const srcAcctBal = srcAcctRow && isEncrypted(srcAcctRow.balance) ? Number(decryptField(String(srcAcctRow.balance), financeDataKey)) || 0 : Number(srcAcctRow?.balance) || 0;
          db.prepare('UPDATE finance_accounts SET balance = ?, updated_at = ? WHERE id = ?').run(encryptField(enc(srcAcctBal + srcDeduction), financeDataKey), now, srcAccountId);
          const dstAcctRow = db.prepare('SELECT balance FROM finance_accounts WHERE id = ?').get(dstAccountId) as any;
          const dstAcctBal = dstAcctRow && isEncrypted(dstAcctRow.balance) ? Number(decryptField(String(dstAcctRow.balance), financeDataKey)) || 0 : Number(dstAcctRow?.balance) || 0;
          db.prepare('UPDATE finance_accounts SET balance = ?, updated_at = ? WHERE id = ?').run(encryptField(enc(dstAcctBal + dstAmt), financeDataKey), now, dstAccountId);
        } else {
          if (srcWalletId) updateSrcWallet.run(srcDeduction, now, srcWalletId);
          if (dstWalletId) updateDstWallet.run(dstAmt, now, dstWalletId);
          updateSrcAccount.run(srcDeduction, now, srcAccountId);
          updateDstAccount.run(dstAmt, now, dstAccountId);
        }
      } else if (isCryptoToFiat) {
        // ── Crypto→fiat: only update destination wallet + account fiat ──
        // Source is crypto — its fiat balance is NOT touched.
        if (financeDataKey) {
          if (dstWalletId) {
            const wRow = db.prepare('SELECT balance FROM finance_wallets WHERE id = ?').get(dstWalletId) as any;
            const wBal = wRow && isEncrypted(wRow.balance) ? Number(decryptField(String(wRow.balance), financeDataKey)) || 0 : Number(wRow?.balance) || 0;
            db.prepare('UPDATE finance_wallets SET balance = ?, updated_at = ? WHERE id = ?').run(encryptField(enc(wBal + dstAmt), financeDataKey), now, dstWalletId);
          }
          const dstAcctRow = db.prepare('SELECT balance FROM finance_accounts WHERE id = ?').get(dstAccountId) as any;
          const dstAcctBal = dstAcctRow && isEncrypted(dstAcctRow.balance) ? Number(decryptField(String(dstAcctRow.balance), financeDataKey)) || 0 : Number(dstAcctRow?.balance) || 0;
          db.prepare('UPDATE finance_accounts SET balance = ?, updated_at = ? WHERE id = ?').run(encryptField(enc(dstAcctBal + dstAmt), financeDataKey), now, dstAccountId);
        } else {
          if (dstWalletId) updateDstWallet.run(dstAmt, now, dstWalletId);
          updateDstAccount.run(dstAmt, now, dstAccountId);
        }
        console.log(`[finance] crypto→fiat: added ${dstAmt} fiat to wallet #${dstWalletId}`);
      } else {
        // ── Crypto→crypto: ZERO fiat changes. Assets tracked in metadata only. ──
        console.log(`[finance] crypto→crypto: no fiat balance changes for wallets #${srcWalletId} → #${dstWalletId}`);
      }
    });

    runTransfer();
    if (isCryptoTransfer) {
      const coinSymbol = data.metadata?.symbol || data.metadata?.coinId || '?';
      const sendQty = Number(data.metadata?.qty) || 0;
      const feeQty = Number(data.metadata?.fee) || 0;
      const recvQty = sendQty - feeQty;
      logAuditEvent('transfer_created', 'transfer', 0, `Crypto transfer: ${sendQty} ${coinSymbol} from wallet #${srcWalletId} to #${dstWalletId}${feeQty > 0 ? ` (fee: ${feeQty} ${coinSymbol})` : ''} → received ${recvQty} ${coinSymbol}`, {
        transfer_id: transferId, coin: coinSymbol, send_qty: sendQty, fee_qty: feeQty, recv_qty: recvQty,
        from_wallet_id: srcWalletId, to_wallet_id: dstWalletId
      });
    } else {
      logAuditEvent('transfer_created', 'transfer', 0, `Transfer ${baseAmt} from wallet #${srcWalletId} to #${dstWalletId}${feeAmount > 0 ? ` (fee ${feeAmount})` : ''}`, {
        transfer_id: transferId, amount: baseAmt, fee_amount: feeAmount, fee_type: feeType,
        from_wallet_id: srcWalletId, to_wallet_id: dstWalletId
      });
    }
    return { transferId, success: true, feeAmount };
  } catch (error: any) {
    console.error('[finance] transfer error:', error);
    return { success: false, error: error?.message || 'Unknown transfer error' };
  }
});

ipcMain.handle('finance:update-transaction', async (_event, data: any) => {
  if (!db) return null;
  try {
    const id = data.id;
    if (!id) return null;
    const ALLOWED = ['account_id', 'wallet_id', 'category_id', 'type', 'amount', 'description', 'note', 'date', 'time', 'on_behalf_of', 'on_behalf_of_label', 'ft_person_id', 'tags', 'fee', 'is_recurring', 'recurring_interval', 'merchant', 'merchant_id', 'is_adjustment'];
    const fields: string[] = [];
    const values: any[] = [];
    for (const k of ALLOWED) {
      if (data[k] !== undefined) {
        if (k === 'on_behalf_of') {
          fields.push(`"${k}"=?`);
          values.push(data[k] ? 1 : 0);
        } else {
          fields.push(`"${k}"=?`);
          values.push(data[k]);
        }
      }
    }
    if (fields.length === 0) return { success: false, reason: 'no fields' };

    // Read current transaction before update for diff
    const oldTxn = db.prepare('SELECT * FROM finance_transactions WHERE id = ?').get(id) as any;
    if (financeDataKey && oldTxn) {
      if (oldTxn.amount != null && isEncrypted(oldTxn.amount)) oldTxn.amount = Number(decryptField(String(oldTxn.amount), financeDataKey)) || 0;
      if (oldTxn.description && isEncrypted(oldTxn.description)) oldTxn.description = decryptField(oldTxn.description, financeDataKey);
      if (oldTxn.note && isEncrypted(oldTxn.note)) oldTxn.note = decryptField(oldTxn.note, financeDataKey);
    }

    fields.push(`updated_at=datetime('now','localtime')`);
    values.push(id);
    db.prepare(`UPDATE finance_transactions SET ${fields.join(', ')} WHERE id=?`).run(...values);

    // Build field-level diff for audit log
    if (oldTxn) {
      const changes = diffFields(oldTxn, data, ALLOWED);
      const changeSummary = formatAuditChanges(changes);
      logAuditEvent('transaction_updated', 'transaction', id,
        changeSummary ? `Transaction #${id} updated: ${changeSummary}` : `Updated transaction #${id}`,
        { changes, transactionId: id, previous: Object.fromEntries(ALLOWED.map(k => [k, oldTxn[k] ?? null])) });
    } else {
      logAuditEvent('transaction_updated', 'transaction', id, `Updated transaction #${id}`, data);
    }
    return { success: true };
  } catch { return null; }
});

ipcMain.handle('finance:batch-update-category', async (_event, { ids, categoryId }: { ids: number[]; categoryId: number }) => {
  if (!db) return { success: false, error: 'no db' };
  if (!ids?.length) return { success: false, error: 'no ids' };
  try {
    const run = db.transaction((list: number[]) => {
      const stmt = db.prepare(`
        UPDATE finance_transactions SET category_id = ?, updated_at = datetime('now','localtime') WHERE id = ?
      `);
      for (const id of list) stmt.run(categoryId, id);
    });
    run(ids);
    return { success: true, updated: ids.length };
  } catch (e: any) {
    return { success: false, error: String(e) };
  }
});

ipcMain.handle('finance:delete-transaction', async (_event, id: number) => {
  if (!db) return { success: false };
  try {
    const txn = db.prepare('SELECT * FROM finance_transactions WHERE id = ?').get(id) as any;
    if (!txn) return { success: false };

    const doDelete = db.transaction(() => {
      if (txn.transfer_id) {
        const allLegs = db.prepare('SELECT id, account_id, wallet_id, amount, metadata FROM finance_transactions WHERE transfer_id = ?').all(txn.transfer_id) as any[];

        // Check if this is a crypto transfer by looking at metadata
        let cryptoInfo: { coinId: string; symbol: string; sendQty: number; recvQty: number; srcWalletId: number; dstWalletId: number } | null = null;
        for (const leg of allLegs) {
          if (leg.metadata) {
            try {
              const m = typeof leg.metadata === 'string' ? JSON.parse(leg.metadata) : leg.metadata;
              if (m.coinId || m.coin_id) {
                const coinId = m.coinId || m.coin_id;
                const symbol = (m.symbol || coinId).toUpperCase();
                if (Number(leg.amount) < 0) {
                  // Source leg
                  const sendQty = Number(m.qty) || 0;
                  const recvQty = Number(m.cryptoReceived) || (sendQty - (Number(m.fee) || 0));
                  cryptoInfo = { coinId, symbol, sendQty, recvQty, srcWalletId: leg.wallet_id, dstWalletId: allLegs.find(l => l.id !== leg.id)?.wallet_id || 0 };
                }
              }
            } catch { /* ignore */ }
          }
        }

        if (cryptoInfo) {
          // Reverse crypto assets between wallets
          const readMeta = (wid: number): Record<string, any> => {
            const row = db.prepare('SELECT metadata FROM finance_wallets WHERE id = ?').get(wid) as any;
            if (!row?.metadata) return { assets: [] };
            try {
              const raw = isEncrypted(row.metadata) ? decryptField(String(row.metadata), financeDataKey) : row.metadata;
              return typeof raw === 'string' ? JSON.parse(raw) : raw;
            } catch { return { assets: [] }; }
          };
          const writeMeta = (wid: number, meta: Record<string, any>) => {
            const json = JSON.stringify(meta);
            if (financeDataKey) {
              db.prepare('UPDATE finance_wallets SET metadata = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(encryptField(json, financeDataKey), wid);
            } else {
              db.prepare('UPDATE finance_wallets SET metadata = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(json, wid);
            }
          };

          // Extract dstPrevAvgBuyPrice from source leg metadata (stored during create-transfer)
          let dstPrevAvgBuyPrice = 0;
          for (const leg of allLegs) {
            if (Number(leg.amount) < 0 && leg.metadata) {
              try {
                const m = typeof leg.metadata === 'string' ? JSON.parse(leg.metadata) : leg.metadata;
                if (m.dstPrevAvgBuyPrice) dstPrevAvgBuyPrice = Number(m.dstPrevAvgBuyPrice) || 0;
              } catch { /* ignore */ }
            }
          }

          // Source wallet: add back the sent qty (avg_buy_price is preserved on source — we only reduced amount during transfer)
          const srcMeta = readMeta(cryptoInfo.srcWalletId);
          const srcAssets: any[] = Array.isArray(srcMeta.assets) ? srcMeta.assets : [];
          const srcIdx = srcAssets.findIndex((a: any) => String(a.coin_id || a.coinId || a.asset || '').toLowerCase() === String(cryptoInfo.coinId).toLowerCase());
          if (srcIdx >= 0) {
            srcAssets[srcIdx].amount = (Number(srcAssets[srcIdx].amount) || 0) + cryptoInfo.sendQty;
          } else {
            // Coin was fully removed — re-add with avg_buy_price from the send price in metadata
            const sendPrice = (() => {
              for (const leg of allLegs) {
                if (Number(leg.amount) < 0 && leg.metadata) {
                  try { const m = typeof leg.metadata === 'string' ? JSON.parse(leg.metadata) : leg.metadata; return Number(m.price) || 0; } catch { /* */ }
                }
              }
              return 0;
            })();
            srcAssets.push({ coin_id: cryptoInfo.coinId, symbol: cryptoInfo.symbol, amount: cryptoInfo.sendQty, avg_buy_price: sendPrice });
          }
          srcMeta.assets = srcAssets;
          writeMeta(cryptoInfo.srcWalletId, srcMeta);

          // Destination wallet: remove the received qty, restore avg_buy_price
          const dstMeta = readMeta(cryptoInfo.dstWalletId);
          const dstAssets: any[] = Array.isArray(dstMeta.assets) ? dstMeta.assets : [];
          const dstIdx = dstAssets.findIndex((a: any) => String(a.coin_id || a.coinId || a.asset || '').toLowerCase() === String(cryptoInfo.coinId).toLowerCase());
          if (dstIdx >= 0) {
            const dstAsset = dstAssets[dstIdx];
            const curAmt = Number(dstAsset.amount) || 0;
            const newAmt = curAmt - cryptoInfo.recvQty;
            if (newAmt <= 0) {
              dstAssets.splice(dstIdx, 1);
            } else {
              dstAsset.amount = newAmt;
              // Reverse weighted average: (curAmt * curAvg - recvQty * sendPrice) / newAmt
              const curAvg = Number(dstAsset.avg_buy_price || dstAsset.avgBuyPrice) || 0;
              const sendPrice = (() => {
                for (const leg of allLegs) {
                  if (Number(leg.amount) < 0 && leg.metadata) {
                    try { const m = typeof leg.metadata === 'string' ? JSON.parse(leg.metadata) : leg.metadata; return Number(m.price) || 0; } catch { /* */ }
                  }
                }
                return 0;
              })();
              if (dstPrevAvgBuyPrice > 0) {
                dstAsset.avg_buy_price = dstPrevAvgBuyPrice;
              } else if (sendPrice > 0 && newAmt > 0) {
                dstAsset.avg_buy_price = ((curAmt * curAvg) - (cryptoInfo.recvQty * sendPrice)) / newAmt;
              }
              if (dstAsset.avg_buy_price) dstAsset.avgBuyPrice = dstAsset.avg_buy_price;
            }
          }
          dstMeta.assets = dstAssets;
          writeMeta(cryptoInfo.dstWalletId, dstMeta);

          console.log(`[finance] crypto transfer deleted: reversed ${cryptoInfo.sendQty} ${cryptoInfo.symbol} from wallet ${cryptoInfo.srcWalletId} to ${cryptoInfo.dstWalletId}`);
        }

        // Reverse fiat balances for each leg (skip if crypto — balances weren't changed)
        for (const leg of allLegs) {
          const isLegCrypto = cryptoInfo && (leg.wallet_id === cryptoInfo.srcWalletId || leg.wallet_id === cryptoInfo.dstWalletId);
          if (isLegCrypto) continue; // Don't touch fiat balances for crypto wallets
          const legAmount = financeDataKey && isEncrypted(leg.amount) ? Number(decryptField(String(leg.amount), financeDataKey)) || 0 : Number(leg.amount);
          if (financeDataKey) {
            const acctRow = db.prepare('SELECT balance FROM finance_accounts WHERE id = ?').get(leg.account_id) as any;
            const acctBal = acctRow && isEncrypted(acctRow.balance) ? Number(decryptField(String(acctRow.balance), financeDataKey)) || 0 : Number(acctRow?.balance) || 0;
            db.prepare('UPDATE finance_accounts SET balance = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(encryptField(enc(acctBal - legAmount), financeDataKey), leg.account_id);
            if (leg.wallet_id) {
              const wRow = db.prepare('SELECT balance FROM finance_wallets WHERE id = ?').get(leg.wallet_id) as any;
              const wBal = wRow && isEncrypted(wRow.balance) ? Number(decryptField(String(wRow.balance), financeDataKey)) || 0 : Number(wRow?.balance) || 0;
              db.prepare('UPDATE finance_wallets SET balance = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(encryptField(enc(wBal - legAmount), financeDataKey), leg.wallet_id);
            }
          } else {
            db.prepare('UPDATE finance_accounts SET balance = balance + ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(-legAmount, leg.account_id);
            if (leg.wallet_id) {
              db.prepare('UPDATE finance_wallets SET balance = balance + ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(-legAmount, leg.wallet_id);
            }
          }
        }
        db.prepare('DELETE FROM finance_transactions WHERE transfer_id = ?').run(txn.transfer_id);
      } else {
        const txnAmount = financeDataKey && isEncrypted(txn.amount) ? Number(decryptField(String(txn.amount), financeDataKey)) || 0 : Number(txn.amount);
        if (financeDataKey) {
          const acctRow = db.prepare('SELECT balance FROM finance_accounts WHERE id = ?').get(txn.account_id) as any;
          const acctBal = acctRow && isEncrypted(acctRow.balance) ? Number(decryptField(String(acctRow.balance), financeDataKey)) || 0 : Number(acctRow?.balance) || 0;
          db.prepare('UPDATE finance_accounts SET balance = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(encryptField(enc(acctBal - txnAmount), financeDataKey), txn.account_id);
          if (txn.wallet_id) {
            const wRow = db.prepare('SELECT balance FROM finance_wallets WHERE id = ?').get(txn.wallet_id) as any;
            const wBal = wRow && isEncrypted(wRow.balance) ? Number(decryptField(String(wRow.balance), financeDataKey)) || 0 : Number(wRow?.balance) || 0;
            db.prepare('UPDATE finance_wallets SET balance = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(encryptField(enc(wBal - txnAmount), financeDataKey), txn.wallet_id);
          }
        } else {
          db.prepare('UPDATE finance_accounts SET balance = balance + ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(-txnAmount, txn.account_id);
          if (txn.wallet_id) {
            db.prepare('UPDATE finance_wallets SET balance = balance + ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(-txnAmount, txn.wallet_id);
          }
        }
        // Safety net: reverse crypto assets for single-leg crypto transactions
        if (txn.metadata && txn.wallet_id) {
          try {
            const m = typeof txn.metadata === 'string' ? JSON.parse(txn.metadata) : txn.metadata;
            const coinId = m.coinId || m.coin_id;
            if (coinId && m.qty) {
              const qty = Number(m.qty) || 0;
              const walletRow = db.prepare('SELECT metadata FROM finance_wallets WHERE id = ?').get(txn.wallet_id) as any;
              if (walletRow?.metadata) {
                const raw = isEncrypted(walletRow.metadata) ? decryptField(String(walletRow.metadata), financeDataKey) : walletRow.metadata;
                const meta = typeof raw === 'string' ? JSON.parse(raw) : raw;
                const assets: any[] = Array.isArray(meta.assets) ? meta.assets : [];
                const idx = assets.findIndex((a: any) => String(a.coin_id || a.coinId || a.asset || '').toLowerCase() === String(coinId).toLowerCase());
                if (idx >= 0) {
                  // Negative amount = sent (add back), positive = received (remove)
                  const isSent = Number(txn.amount) < 0;
                  if (isSent) {
                    assets[idx].amount = (Number(assets[idx].amount) || 0) + qty;
                  } else {
                    assets[idx].amount = (Number(assets[idx].amount) || 0) - qty;
                    if (assets[idx].amount <= 0) assets.splice(idx, 1);
                  }
                }
                meta.assets = assets;
                const json = JSON.stringify(meta);
                if (financeDataKey) {
                  db.prepare('UPDATE finance_wallets SET metadata = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(encryptField(json, financeDataKey), txn.wallet_id);
                } else {
                  db.prepare('UPDATE finance_wallets SET metadata = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(json, txn.wallet_id);
                }
              }
            }
          } catch { /* best-effort */ }
        }
        db.prepare('DELETE FROM finance_transactions WHERE id = ?').run(id);
      }
    });

    doDelete();
    logAuditEvent('transaction_deleted', 'transaction', id, `Deleted ${txn.type} transaction #${id}: ${txn.description || ''} ($${Math.abs(txn.amount)})`,
      { id, type: txn.type, amount: txn.amount, description: txn.description, transfer_id: txn.transfer_id, wallet_id: txn.wallet_id }
    );
    return { success: true };
  } catch (error: any) {
    console.error('[finance] delete transaction error:', error);
    return { success: false, error: error.message };
  }
});

// ── Summary / Analytics ──
ipcMain.handle('finance:get-summary', async () => {
  if (!db) return { totalIncome: 0, totalExpense: 0, netBalance: 0 };
  try {
    // INCOME: Sum positive transfer amounts (these are correct)
    const incomeRow = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM finance_transactions WHERE type = 'transfer' AND amount > 0 AND (is_adjustment IS NULL OR is_adjustment = 0)").get() as any;
    const totalIncome = Number(incomeRow.total);

    // EXPENSE: Sum actual expense transactions (exclude historical adjustments from spending totals)
    const expenseRow = db.prepare("SELECT COALESCE(SUM(ABS(amount)), 0) as total FROM finance_transactions WHERE type = 'expense' AND (is_adjustment IS NULL OR is_adjustment = 0)").get() as any;
    const totalExpense = Number(expenseRow.total);

    // NET WORTH: Sum of all wallet balances
    const netWorthRow = db.prepare("SELECT COALESCE(SUM(balance), 0) as total FROM finance_wallets WHERE is_archived = 0").get() as any;
    const netBalance = Number(netWorthRow.total);

    return { totalIncome, totalExpense, netBalance };
  } catch {
    return { totalIncome: 0, totalExpense: 0, netBalance: 0 };
  }
});

ipcMain.handle('finance:get-spending-by-category', async () => {
  if (!db) return [];
  try {
    const walletSpending = computeDerivedExpenseByWallet(db);
    const categoryRows = db.prepare(`
      SELECT t.category_id, c.name as categoryName, c.color as categoryColor, c.icon as categoryIcon,
        COUNT(t.id) as txn_count, SUM(CASE WHEN t.amount != 0 THEN ABS(t.amount) ELSE 0 END) as known_amount
      FROM finance_transactions t
      LEFT JOIN finance_categories c ON t.category_id = c.id
      WHERE t.type = 'expense' AND (t.is_adjustment IS NULL OR t.is_adjustment = 0)
      GROUP BY t.category_id
    `).all() as any[];
    const result = [];
    for (const row of categoryRows) {
      let amount = Number(row.known_amount) || 0;
      if (amount === 0) {
        const walletRows = db.prepare("SELECT DISTINCT wallet_id FROM finance_transactions WHERE type = 'expense' AND (is_adjustment IS NULL OR is_adjustment = 0) AND category_id = ?").all(row.category_id) as any[];
        for (const wr of walletRows) {
          const walletTotal = walletSpending.get(wr.wallet_id) || 0;
          const totalWalletExpenses = (db.prepare("SELECT COUNT(*) as count FROM finance_transactions WHERE type = 'expense' AND (is_adjustment IS NULL OR is_adjustment = 0) AND wallet_id = ?").get(wr.wallet_id) as any)?.count || 1;
          const categoryInWallet = (db.prepare("SELECT COUNT(*) as count FROM finance_transactions WHERE type = 'expense' AND (is_adjustment IS NULL OR is_adjustment = 0) AND wallet_id = ? AND category_id = ?").get(wr.wallet_id, row.category_id) as any)?.count || 0;
          amount += (walletTotal / totalWalletExpenses) * categoryInWallet;
        }
      }
      result.push({ categoryId: row.category_id, categoryName: row.categoryName || 'Uncategorized', categoryColor: row.categoryColor || '#888888', categoryIcon: row.categoryIcon || 'Circle', amount: Math.round(amount * 100) / 100, count: row.txn_count });
    }
    return result.sort((a: any, b: any) => b.amount - a.amount);
  } catch { return []; }
});

ipcMain.handle('finance:get-monthly-trends', async () => {
  if (!db) return [];
  try {
    // Monthly income from transfers (correct data)
    const monthlyIncomeRows = db.prepare(`
      SELECT strftime('%Y-%m', date) as month, COALESCE(SUM(amount), 0) as total
      FROM finance_transactions WHERE type = 'transfer' AND amount > 0 AND (is_adjustment IS NULL OR is_adjustment = 0)
      GROUP BY month ORDER BY month DESC LIMIT 12
    `).all() as any[];
    // Monthly expense from actual transactions (exclude historical adjustments)
    const monthlyExpenseRows = db.prepare(`
      SELECT strftime('%Y-%m', date) as month, COALESCE(SUM(ABS(amount)), 0) as total
      FROM finance_transactions WHERE type = 'expense' AND (is_adjustment IS NULL OR is_adjustment = 0)
      GROUP BY month ORDER BY month DESC LIMIT 12
    `).all() as any[];
    // Build monthly expense map
    const monthlyExpenseMap = new Map<string, number>();
    for (const me of monthlyExpenseRows) {
      monthlyExpenseMap.set(me.month, Number(me.total) || 0);
    }
    // Merge and sort
    const allMonths = new Set<string>();
    monthlyIncomeRows.forEach((r: any) => allMonths.add(r.month));
    monthlyExpenseRows.forEach((r: any) => allMonths.add(r.month));
    const sortedMonths = Array.from(allMonths).sort().reverse();
    return sortedMonths.map(month => {
      const incomeVal = monthlyIncomeRows.find((r: any) => r.month === month)?.total || 0;
      const expenseVal = monthlyExpenseMap.get(month) || 0;
      return { month, income: Number(incomeVal), expense: Math.round(expenseVal * 100) / 100, net: Number(incomeVal) - expenseVal };
    });
  } catch { return []; }
});

// ── On Behalf Of Summary ──
ipcMain.handle('finance:get-on-behalf-of-summary', async () => {
  if (!db) return { totalExpense: 0 };
  try {
    if (financeDataKey) {
      const rows = db.prepare(`SELECT t.amount, COALESCE(t.on_behalf_of_label, fp.name) as on_behalf_of_label
        FROM finance_transactions t
        LEFT JOIN finance_ft_persons fp ON t.ft_person_id = fp.id
        WHERE t.type='expense' AND t.on_behalf_of = 1 AND (t.is_adjustment IS NULL OR t.is_adjustment = 0)`).all() as any[];
      let totalExpense = 0;
      const breakdownMap = new Map<string, { label: string; total: number; count: number }>();
      for (const r of rows) {
        const amt = isEncrypted(r.amount) ? Math.abs(Number(decryptField(String(r.amount), financeDataKey)) || 0) : Math.abs(Number(r.amount) || 0);
        totalExpense += amt;
        const label = r.on_behalf_of_label || 'Someone';
        const existing = breakdownMap.get(label);
        if (existing) { existing.total += amt; existing.count++; }
        else breakdownMap.set(label, { label, total: amt, count: 1 });
      }
      const breakdown = [...breakdownMap.values()].sort((a, b) => b.total - a.total);
      return { totalExpense, breakdown };
    }
    const expense = db.prepare("SELECT COALESCE(ABS(SUM(t.amount)),0) as total FROM finance_transactions t WHERE t.type='expense' AND t.on_behalf_of = 1 AND (t.is_adjustment IS NULL OR t.is_adjustment = 0)").get() as any;
    const breakdown = db.prepare(`
      SELECT COALESCE(t.on_behalf_of_label, fp.name, 'Someone') as label, COALESCE(ABS(SUM(t.amount)),0) as total, COUNT(*) as count
      FROM finance_transactions t
      LEFT JOIN finance_ft_persons fp ON t.ft_person_id = fp.id
      WHERE t.type='expense' AND t.on_behalf_of = 1 AND (t.is_adjustment IS NULL OR t.is_adjustment = 0)
      GROUP BY COALESCE(t.on_behalf_of_label, fp.name, 'Someone') ORDER BY total DESC
    `).all();
    return { totalExpense: expense.total, breakdown };
  } catch {
    return { totalExpense: 0, breakdown: [] };
  }
});

// ── Last Transaction Date ──
ipcMain.handle('finance:last-transaction-date', async () => {
  if (!db) return null;
  try {
    const row = db.prepare(`SELECT MAX(updated_at) as last_updated, MAX(date) as last_date FROM finance_transactions`).get() as any;
    return row ? { lastUpdated: row.last_updated, lastDate: row.last_date } : null;
  } catch { return null; }
});

// ── Follow-Through Persons ──
ipcMain.handle('finance:get-ft-persons', async () => {
  if (!db) return [];
  try {
    // Create table if not exists
    db.exec(`CREATE TABLE IF NOT EXISTS finance_ft_persons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      email TEXT, phone TEXT, notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      updated_at DATETIME DEFAULT (datetime('now','localtime'))
    )`);
    try { db.exec("ALTER TABLE finance_ft_persons ADD COLUMN balance REAL DEFAULT 0"); } catch { /* already exists */ }
    try { db.exec("ALTER TABLE finance_ft_persons ADD COLUMN wallet_id INTEGER REFERENCES finance_wallets(id) ON DELETE SET NULL"); } catch { /* already exists */ }
    const persons = db.prepare('SELECT * FROM finance_ft_persons ORDER BY name').all() as any[];
    // Enrich with transaction counts and repayment totals
    for (const p of persons) {
      const stats = db.prepare(`
        SELECT COUNT(*) as transaction_count, COALESCE(ABS(SUM(amount)),0) as total_owed
        FROM finance_transactions WHERE on_behalf_of = 1 AND (on_behalf_of_label = ? OR ft_person_id = ?)
      `).get(p.name, p.id) as any;
      p.transaction_count = stats?.transaction_count || 0;
      p.total_owed = stats?.total_owed || 0;
      // Compute total_paid from repayment transactions (income flagged as on_behalf_of)
      const paidStats = db.prepare(`
        SELECT COALESCE(ABS(SUM(amount)), 0) as total_paid
        FROM finance_transactions
        WHERE on_behalf_of = 1 AND (on_behalf_of_label = ? OR ft_person_id = ?) AND type = 'income'
      `).get(p.name, p.id) as any;
      p.total_paid = paidStats?.total_paid || 0;
    }
    return persons;
  } catch { return []; }
});

ipcMain.handle('finance:create-ft-person', async (_event, data: { name: string; email?: string; phone?: string; notes?: string }) => {
  if (!db) return null;
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS finance_ft_persons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      email TEXT, phone TEXT, notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      updated_at DATETIME DEFAULT (datetime('now','localtime'))
    )`);
    try { db.exec("ALTER TABLE finance_ft_persons ADD COLUMN balance REAL DEFAULT 0"); } catch { /* already exists */ }
    try { db.exec("ALTER TABLE finance_ft_persons ADD COLUMN wallet_id INTEGER REFERENCES finance_wallets(id) ON DELETE SET NULL"); } catch { /* already exists */ }
    const result = db.prepare('INSERT INTO finance_ft_persons (name, email, phone, notes) VALUES (?, ?, ?, ?)').run(
      data.name, data.email || null, data.phone || null, data.notes || null
    );
    logAuditEvent('ft_person_created', 'ft_person', result.lastInsertRowid as number, `Created follow-through person "${data.name}"`);
    return { id: result.lastInsertRowid, name: data.name };
  } catch { return null; }
});

// ── FT Person Balance: Top-up ──
ipcMain.handle('finance:ft-person-topup', async (_event, data: { personId: number; walletId: number; amount: number; description?: string; date?: string }) => {
  if (!db) return { success: false };
  try {
    const person = db.prepare('SELECT id, name, balance FROM finance_ft_persons WHERE id = ?').get(data.personId) as any;
    if (!person) return { success: false, error: 'Person not found' };
    if (!data.amount || data.amount <= 0) return { success: false, error: 'Amount must be positive' };

    const wallet = db.prepare('SELECT id, account_id, balance FROM finance_wallets WHERE id = ?').get(data.walletId) as any;
    if (!wallet) return { success: false, error: 'Wallet not found' };

    // Deduct from wallet
    if (financeDataKey) {
      const wBal = isEncrypted(wallet.balance) ? Number(decryptField(String(wallet.balance), financeDataKey)) || 0 : Number(wallet.balance) || 0;
      db.prepare('UPDATE finance_wallets SET balance = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(encryptField(enc(wBal - data.amount), financeDataKey), data.walletId);
      const aRow = db.prepare('SELECT balance FROM finance_accounts WHERE id = ?').get(wallet.account_id) as any;
      const aBal = aRow && isEncrypted(aRow.balance) ? Number(decryptField(String(aRow.balance), financeDataKey)) || 0 : Number(aRow?.balance) || 0;
      db.prepare('UPDATE finance_accounts SET balance = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(encryptField(enc(aBal - data.amount), financeDataKey), wallet.account_id);
    } else {
      db.prepare('UPDATE finance_wallets SET balance = balance - ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(data.amount, data.walletId);
      db.prepare('UPDATE finance_accounts SET balance = balance - ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(data.amount, wallet.account_id);
    }

    // Add to person balance
    const newBalance = (Number(person.balance) || 0) + data.amount;
    db.prepare('UPDATE finance_ft_persons SET balance = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(newBalance, data.personId);

    // Create tracking transaction (expense from wallet)
    const subCatId = getSubCategoryId();
    const desc = data.description || `Top-up for ${person.name}`;
    db.prepare(`INSERT INTO finance_transactions (account_id, wallet_id, category_id, type, amount, fee, merchant, description, note, "date", "time", on_behalf_of, on_behalf_of_label)
      VALUES (?, ?, ?, 'expense', ?, 0, ?, ?, ?, ?, ?, 0, ?)`).run(
      wallet.account_id, data.walletId, subCatId, -data.amount, person.name, desc, `Balance top-up for ${person.name}`, data.date || todayStr(), null, person.name
    );

    logAuditEvent('ft_person_topup', 'ft_person', data.personId, `Top-up ${data.amount} for "${person.name}" from wallet ${data.walletId}`, { amount: data.amount, wallet_id: data.walletId, new_balance: newBalance });
    return { success: true, balance: newBalance };
  } catch (err: any) {
    console.error('[finance] ft-person-topup error:', err);
    return { success: false, error: err.message };
  }
});

// ── FT Person Balance: Deduct (when follow-through expense is paid from balance) ──
ipcMain.handle('finance:ft-person-deduct', async (_event, data: { personId: number; amount: number; description?: string }) => {
  if (!db) return { success: false };
  try {
    const person = db.prepare('SELECT id, name, balance FROM finance_ft_persons WHERE id = ?').get(data.personId) as any;
    if (!person) return { success: false, error: 'Person not found' };
    if (!data.amount || data.amount <= 0) return { success: false, error: 'Amount must be positive' };
    const newBalance = (Number(person.balance) || 0) - data.amount;
    db.prepare('UPDATE finance_ft_persons SET balance = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(newBalance, data.personId);
    // Create a tracking transaction so sync/recalculate picks up this deduction
    const desc = data.description || `Balance deduction for ${person.name}`;
    const catId = getSubCategoryId();
    db.prepare(`
      INSERT INTO finance_transactions (account_id, wallet_id, category_id, type, amount, fee, merchant, description, note, "date", "time", on_behalf_of, on_behalf_of_label, ft_person_id)
      VALUES (?, NULL, ?, 'expense', ?, 0, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      null, catId, -data.amount, person.name, desc,
      `Balance deduction for ${person.name}`, todayStr(), null, person.name, person.id
    );
    logAuditEvent('ft_person_deduct', 'ft_person', data.personId, `Deducted ${data.amount} from "${person.name}" balance`, { amount: data.amount, new_balance: newBalance });
    return { success: true, balance: newBalance };
  } catch (err: any) {
    console.error('[finance] ft-person-deduct error:', err);
    return { success: false, error: err.message };
  }
});

// ── FT Person: Set wallet ──
ipcMain.handle('finance:ft-person-set-wallet', async (_event, data: { personId: number; walletId: number | null }) => {
  if (!db) return { success: false };
  try {
    db.prepare('UPDATE finance_ft_persons SET wallet_id = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(data.walletId, data.personId);
    return { success: true };
  } catch { return { success: false }; }
});

// ── FT Person: Edit ──
ipcMain.handle('finance:ft-person-edit', async (_event, data: { personId: number; name?: string; email?: string; phone?: string; notes?: string }) => {
  if (!db) return { success: false };
  try {
    const person = db.prepare('SELECT id, name FROM finance_ft_persons WHERE id = ?').get(data.personId) as any;
    if (!person) return { success: false, error: 'Person not found' };
    const updates: string[] = [];
    const params: any[] = [];
    if (data.name !== undefined && data.name.trim()) { updates.push('name = ?'); params.push(data.name.trim()); }
    if (data.email !== undefined) { updates.push('email = ?'); params.push(data.email || null); }
    if (data.phone !== undefined) { updates.push('phone = ?'); params.push(data.phone || null); }
    if (data.notes !== undefined) { updates.push('notes = ?'); params.push(data.notes || null); }
    if (updates.length === 0) return { success: false, error: 'No fields to update' };
    updates.push("updated_at = datetime('now','localtime')");
    params.push(data.personId);
    db.prepare(`UPDATE finance_ft_persons SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    // If name changed, update all related transactions
    if (data.name && data.name.trim() !== person.name) {
      db.prepare('UPDATE finance_transactions SET on_behalf_of_label = ? WHERE on_behalf_of_label = ?').run(data.name.trim(), person.name);
    }
    logAuditEvent('ft_person_edited', 'ft_person', data.personId, `Edited person "${person.name}"`, data);
    return { success: true };
  } catch (err: any) {
    console.error('[finance] ft-person-edit error:', err);
    return { success: false, error: err.message };
  }
});

// ── FT Person: Delete ──
ipcMain.handle('finance:ft-person-delete', async (_event, data: { personId: number }) => {
  if (!db) return { success: false };
  try {
    const person = db.prepare('SELECT id, name FROM finance_ft_persons WHERE id = ?').get(data.personId) as any;
    if (!person) return { success: false, error: 'Person not found' };
    // Unlink transactions by ft_person_id (may fail if column missing on old DB)
    try {
      db.prepare('UPDATE finance_transactions SET ft_person_id = NULL, on_behalf_of = 0, on_behalf_of_label = NULL WHERE ft_person_id = ?').run(data.personId);
    } catch { /* column may not exist on old databases */ }
    // Unlink transactions by on_behalf_of_label (always works)
    db.prepare('UPDATE finance_transactions SET on_behalf_of = 0, on_behalf_of_label = NULL WHERE on_behalf_of_label = ?').run(person.name);
    // Delete person
    db.prepare('DELETE FROM finance_ft_persons WHERE id = ?').run(data.personId);
    logAuditEvent('ft_person_deleted', 'ft_person', data.personId, `Deleted person "${person.name}"`);
    return { success: true };
  } catch (err: any) {
    console.error('[finance] ft-person-delete error:', err);
    return { success: false, error: err.message };
  }
});

// ── FT Person: Sync all balances from transactions ──
ipcMain.handle('finance:ft-person-sync-balances', async () => {
  if (!db) return { success: false };
  try {
    const persons = db.prepare('SELECT id, name, balance FROM finance_ft_persons').all() as any[];
    let synced = 0;
    let backfilled = 0;

    for (const p of persons) {
      // Check if person has any transactions (use ft_person_id first, fallback to label)
      const txnCount = db.prepare(`
        SELECT COUNT(*) as cnt FROM finance_transactions
        WHERE ft_person_id = ? OR on_behalf_of_label = ?
      `).get(p.id, p.name) as any;

      const hasTransactions = (txnCount?.cnt || 0) > 0;
      const hasBalance = (Number(p.balance) || 0) > 0;

      // If person has balance but NO transactions, backfill an initial balance transaction
      if (hasBalance && !hasTransactions) {
        const wallet = db.prepare('SELECT id, account_id FROM finance_wallets WHERE is_archived = 0 LIMIT 1').get() as any;
        if (wallet) {
          const desc = `Initial balance for ${p.name}`;
          db.prepare(`
            INSERT INTO finance_transactions (account_id, wallet_id, category_id, type, amount, fee, merchant, description, note, "date", "time", on_behalf_of, on_behalf_of_label, ft_person_id)
            VALUES (?, ?, NULL, 'income', ?, 0, ?, ?, ?, ?, ?, 1, ?, ?)
          `).run(
            wallet.account_id, wallet.id, Number(p.balance), p.name, desc,
            `Backfilled initial balance for ${p.name}`, todayStr(), null, p.name, p.id
          );
          backfilled++;
          console.log(`[finance] Backfilled initial balance transaction for "${p.name}": ${p.balance}`);
        }
      }

      // Recalculate stored balance from transactions if person has transactions
      if (hasTransactions) {
        // Top-ups: income transactions credited to this person (adds to stored balance)
        const topups = db.prepare(`
          SELECT COALESCE(ABS(SUM(amount)), 0) as total
          FROM finance_transactions
          WHERE (ft_person_id = ? OR on_behalf_of_label = ?)
          AND type = 'income'
          AND on_behalf_of = 0
        `).get(p.id, p.name) as any;

        // Repayments: income transactions flagged as follow-through (subtracts from stored balance)
        const repayments = db.prepare(`
          SELECT COALESCE(ABS(SUM(amount)), 0) as total
          FROM finance_transactions
          WHERE (ft_person_id = ? OR on_behalf_of_label = ?)
          AND type = 'income' AND on_behalf_of = 1
        `).get(p.id, p.name) as any;

        // Deductions: expense transactions flagged as follow-through (subtracts from stored balance)
        const deductions = db.prepare(`
          SELECT COALESCE(ABS(SUM(amount)), 0) as total
          FROM finance_transactions
          WHERE (ft_person_id = ? OR on_behalf_of_label = ?)
          AND type = 'expense' AND on_behalf_of = 1
        `).get(p.id, p.name) as any;

        // stored balance = topups received + repayments made - deductions made
        const computedBalance = (topups?.total || 0) + (repayments?.total || 0) - (deductions?.total || 0);
        if (Math.abs(computedBalance - (Number(p.balance) || 0)) > 0.01) {
          db.prepare('UPDATE finance_ft_persons SET balance = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?')
            .run(computedBalance, p.id);
          console.log(`[finance] Corrected balance for "${p.name}": ${p.balance} -> ${computedBalance}`);
        }

        // Fix repayment dates — set to the original expense's date, not the insertion date
        const repayTxns = db.prepare(`
          SELECT id, date, metadata FROM finance_transactions
          WHERE (ft_person_id = ? OR on_behalf_of_label = ?)
          AND type = 'income' AND on_behalf_of = 1
        `).all(p.id, p.name) as any[];
        for (const rt of repayTxns) {
          try {
            const meta = rt.metadata ? JSON.parse(rt.metadata) : null;
            if (meta?.repayment_for) {
              const origTx = db.prepare('SELECT date FROM finance_transactions WHERE id = ?').get(meta.repayment_for) as any;
              if (origTx && origTx.date !== rt.date) {
                db.prepare('UPDATE finance_transactions SET date = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(origTx.date, rt.id);
                console.log(`[finance] Fixed repayment date: txn ${rt.id} ${rt.date} -> ${origTx.date}`);
              }
            }
          } catch {}
        }
      }

      synced++;
    }

    logAuditEvent('ft_persons_synced', 'ft_person', 0, `Synced ${synced} persons, backfilled ${backfilled} initial transactions`);
    return { success: true, synced, backfilled };
  } catch (err: any) {
    console.error('[finance] ft-person-sync error:', err);
    return { success: false, error: err.message };
  }
});

// ── FT Person: Record Repayment ──
ipcMain.handle('finance:ft-person-record-repayment', async (_event, data: { originalTxId: number; personId?: number; amount: number; date: string; walletId?: number; accountId?: number; description?: string; isOverpayment?: boolean }) => {
  if (!db) return { success: false };
  try {
    const originalTx = db.prepare('SELECT * FROM finance_transactions WHERE id = ?').get(data.originalTxId) as any;
    if (!originalTx) return { success: false, error: 'Original transaction not found' };

    // Get person info
    let personName = '';
    let personId = data.personId;
    let personBalance = 0;
    if (personId) {
      const person = db.prepare('SELECT id, name, balance FROM finance_ft_persons WHERE id = ?').get(personId) as any;
      personName = person?.name || '';
      personBalance = Number(person?.balance) || 0;
    } else {
      // Try to find person from on_behalf_of_label
      personName = originalTx.on_behalf_of_label || '';
      if (personName) {
        const person = db.prepare('SELECT id FROM finance_ft_persons WHERE name = ?').get(personName) as any;
        personId = person?.id;
      }
    }

    // Determine wallet/account to credit
    const walletId = data.walletId || originalTx.wallet_id;
    const wallet = walletId ? db.prepare('SELECT id, account_id, balance FROM finance_wallets WHERE id = ?').get(walletId) as any : null;
    const accountId = data.accountId || wallet?.account_id || originalTx.account_id;

    // Create repayment transaction (income to wallet)
    const desc = data.description || `Repayment from ${personName}`;
    const result = db.prepare(`
      INSERT INTO finance_transactions (account_id, wallet_id, category_id, type, amount, fee, merchant, description, note, "date", "time", on_behalf_of, on_behalf_of_label, metadata)
      VALUES (?, ?, NULL, 'income', ?, 0, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      accountId, walletId, Math.abs(data.amount), personName, desc,
      `Repayment for ${personName}`, data.date || todayStr(), null, personName,
      JSON.stringify({ repayment_for: data.originalTxId, is_overpayment: data.isOverpayment || false })
    );

    const repaymentTxId = Number(result.lastInsertRowid);

    // Write tags so renderer's getRepaymentStatus can detect this repayment
    const rTags = [`ft_repaid:${data.originalTxId}`];
    if (data.isOverpayment) rTags.push(`ft_overpayment:${data.originalTxId}`);
    db.prepare('UPDATE finance_transactions SET tags = ? WHERE id = ?').run(rTags.join(','), repaymentTxId);

    // Update person balance — repayment reduces debt
    if (personId) {
      const newPersonBal = personBalance + Math.abs(data.amount);
      db.prepare('UPDATE finance_ft_persons SET balance = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(newPersonBal, personId);
    }

    // Update wallet balance
    if (wallet) {
      const wBal = financeDataKey && isEncrypted(wallet.balance) ? Number(decryptField(String(wallet.balance), financeDataKey)) || 0 : Number(wallet.balance) || 0;
      const newBal = wBal + Math.abs(data.amount);
      const balToWrite = financeDataKey ? encryptField(enc(newBal), financeDataKey) : String(newBal);
      db.prepare("UPDATE finance_wallets SET balance = ?, updated_at = datetime('now','localtime') WHERE id = ?").run(balToWrite, walletId);
    }

    // Update account balance
    if (accountId) {
      const aRow = db.prepare('SELECT balance FROM finance_accounts WHERE id = ?').get(accountId) as any;
      const aBal = aRow && isEncrypted(aRow.balance) ? Number(decryptField(String(aRow.balance), financeDataKey)) || 0 : Number(aRow?.balance) || 0;
      const newAcctBal = aBal + Math.abs(data.amount);
      const encAcctBal = financeDataKey ? encryptField(enc(newAcctBal), financeDataKey) : String(newAcctBal);
      db.prepare("UPDATE finance_accounts SET balance = ?, updated_at = datetime('now','localtime') WHERE id = ?").run(encAcctBal, accountId);
    }

    // Tag original transaction as repaid
    try {
      const existingMeta = originalTx.metadata ? (safeDecrypt(originalTx.metadata)) : null;
      const meta = existingMeta ? JSON.parse(existingMeta) : {};
      meta.ft_repaid = true;
      meta.ft_repayment_tx_id = repaymentTxId;
      const metaToWrite = financeDataKey ? encryptField(JSON.stringify(meta), financeDataKey) : JSON.stringify(meta);
      db.prepare('UPDATE finance_transactions SET metadata = ? WHERE id = ?').run(metaToWrite, data.originalTxId);
    } catch { /* ignore metadata update errors */ }

    logAuditEvent('ft_person_repayment', 'ft_person', personId || 0, `Recorded repayment of ${data.amount} from "${personName}"`, { amount: data.amount, original_tx_id: data.originalTxId, repayment_tx_id: repaymentTxId });
    return { success: true, repaymentTxId };
  } catch (err: any) {
    console.error('[finance] ft-person-record-repayment error:', err);
    return { success: false, error: err.message };
  }
});

// ── Archived Items ──
ipcMain.handle('finance:get-archived-accounts', async () => {
  if (!db) return [];
  try {
    return db.prepare('SELECT * FROM finance_accounts WHERE is_archived = 1 ORDER BY name').all();
  } catch { return []; }
});

ipcMain.handle('finance:get-archived-wallets', async () => {
  if (!db) return [];
  try {
    const rows = db.prepare('SELECT * FROM finance_wallets WHERE is_archived = 1 ORDER BY name').all() as any[];
    for (const row of rows) {
      if (row.metadata) {
        try { row.metadata = JSON.parse(row.metadata); } catch { row.metadata = null; }
      }
    }
    return rows;
  } catch { return []; }
});

ipcMain.handle('finance:unarchive-account', async (_event, id: number) => {
  if (!db) return { success: false };
  try {
    db.prepare("UPDATE finance_accounts SET is_archived=0, updated_at=datetime('now','localtime') WHERE id=?").run(id);
    return { success: true };
  } catch { return { success: false }; }
});

ipcMain.handle('finance:unarchive-wallet', async (_event, id: number) => {
  if (!db) return { success: false };
  try {
    db.prepare("UPDATE finance_wallets SET is_archived=0, updated_at=datetime('now','localtime') WHERE id=?").run(id);
    return { success: true };
  } catch { return { success: false }; }
});

// ── Delete Account / Wallet ──
ipcMain.handle('finance:delete-account', async (_event, id: number) => {
  if (!db) return { success: false };
  try {
    const wallets = db.prepare('SELECT id FROM finance_wallets WHERE account_id = ?').all(id) as any[];
    for (const w of wallets) {
      db.prepare('DELETE FROM finance_transactions WHERE wallet_id = ?').run(w.id);
    }
    db.prepare('DELETE FROM finance_transactions WHERE account_id = ?').run(id);
    db.prepare('DELETE FROM finance_wallets WHERE account_id = ?').run(id);
    db.prepare('DELETE FROM finance_accounts WHERE id = ?').run(id);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('finance:delete-wallet', async (_event, id: number) => {
  if (!db) return { success: false };
  try {
    const wallet = db.prepare('SELECT name, type FROM finance_wallets WHERE id = ?').get(id) as any;

    // Delete every transaction leg tied to this wallet in any role
    db.prepare('DELETE FROM finance_transactions WHERE wallet_id = ?').run(id);
    db.prepare('DELETE FROM finance_transactions WHERE from_wallet_id = ?').run(id);
    db.prepare('DELETE FROM finance_transactions WHERE to_wallet_id = ?').run(id);

    // Null out foreign-key references in other wallets' transactions
    db.prepare('UPDATE finance_transactions SET from_wallet_id = NULL WHERE from_wallet_id = ?').run(id);
    db.prepare('UPDATE finance_transactions SET to_wallet_id = NULL WHERE to_wallet_id = ?').run(id);

    db.prepare('DELETE FROM finance_wallets WHERE id = ?').run(id);
    logAuditEvent('wallet_deleted', 'wallet', id, `Deleted wallet "${wallet?.name || id}" (type: ${wallet?.type || 'unknown'})`);

    // Recalculate balances for all surviving wallets
    const remainingWallets = db.prepare('SELECT id FROM finance_wallets').all() as any[];
    for (const w of remainingWallets) {
      await recalculateSingleWallet(w.id, false);
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// ── Password Requirements ──
// ========== Agent Prompts ==========
ipcMain.handle('prompts:list', async (_event, params: { sessionId?: string; projectId?: string }) => {
  if (!db) return { success: false, error: 'No database' };
  try {
    let query = 'SELECT p.*, s.topic as session_topic FROM agent_prompts p LEFT JOIN terminal_sessions s ON p.session_id = s.id';
    const conditions: string[] = [];
    const values: any[] = [];
    if (params?.sessionId) { conditions.push('p.session_id = ?'); values.push(params.sessionId); }
    if (params?.projectId) { conditions.push('s.project_id = ?'); values.push(params.projectId); }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY p.created_at DESC';
    const rows = db.prepare(query).all(...values) as any[];
    return { success: true, data: rows.map(r => ({
      id: r.id, sessionId: r.session_id, projectId: r.project_id, content: r.content, title: r.title,
      status: r.status, progress: r.progress, category: r.category,
      tags: JSON.parse(r.tags || '[]'), resultSummary: r.result_summary,
      sessionTopic: r.session_topic,
      createdAt: r.created_at, updatedAt: r.updated_at,
    })) };
  } catch (err: any) { return { success: false, error: err.message }; }
});

ipcMain.handle('prompts:get', async (_event, params: { id: string }) => {
  if (!db) return { success: false, error: 'No database' };
  try {
    const r = db.prepare('SELECT p.*, s.topic as session_topic FROM agent_prompts p LEFT JOIN terminal_sessions s ON p.session_id = s.id WHERE p.id = ?').get(params.id) as any;
    if (!r) return { success: false, error: 'Prompt not found' };
    return { success: true, data: {
      id: r.id, sessionId: r.session_id, projectId: r.project_id, content: r.content, title: r.title,
      status: r.status, progress: r.progress, category: r.category,
      tags: JSON.parse(r.tags || '[]'), resultSummary: r.result_summary,
      sessionTopic: r.session_topic,
      createdAt: r.created_at, updatedAt: r.updated_at,
    } };
  } catch (err: any) { return { success: false, error: err.message }; }
});

ipcMain.handle('prompts:create', async (_event, params: { sessionId?: string; projectId?: string; content: string; title?: string; category?: string; tags?: string[] }) => {
  if (!db) return { success: false, error: 'No database' };
  try {
    const id = `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    db.prepare('INSERT INTO agent_prompts (id, session_id, project_id, content, title, category, tags) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      id, params.sessionId || null, params.projectId || null, params.content, params.title || null,
      params.category || 'general', JSON.stringify(params.tags || [])
    );
    return { success: true, id };
  } catch (err: any) { return { success: false, error: err.message }; }
});

ipcMain.handle('prompts:update', async (_event, params: { id: string; status?: string; progress?: number; resultSummary?: string; title?: string; category?: string; tags?: string[] }) => {
  if (!db) return { success: false, error: 'No database' };
  try {
    const sets: string[] = [];
    const values: any[] = [];
    if (params.status !== undefined) { sets.push('status = ?'); values.push(params.status); }
    if (params.progress !== undefined) { sets.push('progress = ?'); values.push(params.progress); }
    if (params.resultSummary !== undefined) { sets.push('result_summary = ?'); values.push(params.resultSummary); }
    if (params.title !== undefined) { sets.push('title = ?'); values.push(params.title); }
    if (params.category !== undefined) { sets.push('category = ?'); values.push(params.category); }
    if (params.tags !== undefined) { sets.push('tags = ?'); values.push(JSON.stringify(params.tags)); }
    sets.push('updated_at = CURRENT_TIMESTAMP');
    values.push(params.id);
    db.prepare(`UPDATE agent_prompts SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return { success: true };
  } catch (err: any) { return { success: false, error: err.message }; }
});

ipcMain.handle('prompts:delete', async (_event, params: { id: string }) => {
  if (!db) return { success: false, error: 'No database' };
  try {
    db.prepare('DELETE FROM agent_prompts WHERE id = ?').run(params.id);
    return { success: true };
  } catch (err: any) { return { success: false, error: err.message }; }
});

ipcMain.handle('finance:get-password-requirements', async () => {
  if (!db) return {};
  try {
    const rows = db.prepare("SELECT key, value FROM finance_settings WHERE key LIKE 'password_req_%'").all() as any[];
    const reqs: Record<string, boolean> = {};
    for (const r of rows) {
      reqs[r.key] = r.value === '1';
    }
    return reqs;
  } catch { return {}; }
});

ipcMain.handle('finance:set-password-requirement', async (_event, key: string, value: boolean) => {
  if (!db) return { success: false };
  try {
    db.prepare("INSERT OR REPLACE INTO finance_settings (key, value) VALUES (?, ?)").run(key, value ? '1' : '0');
    return { success: true };
  } catch { return { success: false }; }
});

// ========== Subscriptions ==========
// Helper: Convert Date to local YYYY-MM-DD (avoids toISOString UTC shift)
function toLocalDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// Helper: Get today as local YYYY-MM-DD
function todayStr() { return toLocalDateStr(new Date()); }
// Helper: Compute next renewal date from start_date + billing_cycle
function computeNextRenewal(startDate, billingCycle, interval = 1) {
  const d = new Date(startDate);
  const day = d.getDate();
  switch (billingCycle) {
    case 'daily': d.setDate(d.getDate() + interval); break;
    case 'weekly': d.setDate(d.getDate() + (7 * interval)); break;
    case 'monthly': case 'quarterly': {
      const monthsToAdd = billingCycle === 'quarterly' ? 3 * interval : interval;
      const nextMonth = d.getMonth() + monthsToAdd;
      const nextYear = d.getFullYear() + Math.floor(nextMonth / 12);
      const monthMod = nextMonth % 12;
      const maxDay = new Date(nextYear, monthMod + 1, 0).getDate();
      d.setFullYear(nextYear, monthMod, Math.min(day, maxDay));
      break;
    }
    case 'yearly': {
      d.setFullYear(d.getFullYear() + interval);
      const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(day, maxDay));
      break;
    }
    default: {
      const nextMonth = d.getMonth() + interval;
      const nextYear = d.getFullYear() + Math.floor(nextMonth / 12);
      const monthMod = nextMonth % 12;
      const maxDay = new Date(nextYear, monthMod + 1, 0).getDate();
      d.setFullYear(nextYear, monthMod, Math.min(day, maxDay));
    }
  }
  return toLocalDateStr(d);
}

// Helper: Get all billing dates from start_date to today
function getBillingDates(startDate, billingCycle, interval = 1) {
  const dates = [];
  const start = new Date(startDate);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  let current = new Date(start);
  const startDay = start.getDate();
  while (current <= today) {
    dates.push(toLocalDateStr(current));
    switch (billingCycle) {
      case 'daily': current.setDate(current.getDate() + interval); break;
      case 'weekly': current.setDate(current.getDate() + (7 * interval)); break;
      case 'monthly': case 'quarterly': {
        const monthsToAdd = billingCycle === 'quarterly' ? 3 * interval : interval;
        const nextMonth = current.getMonth() + monthsToAdd;
        const nextYear = current.getFullYear() + Math.floor(nextMonth / 12);
        const monthMod = nextMonth % 12;
        const maxDay = new Date(nextYear, monthMod + 1, 0).getDate();
        current = new Date(nextYear, monthMod, Math.min(startDay, maxDay));
        break;
      }
      case 'yearly': {
        current.setFullYear(current.getFullYear() + interval);
        const maxDay = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
        current.setDate(Math.min(startDay, maxDay));
        break;
      }
      default: {
        const nextMonth = current.getMonth() + interval;
        const nextYear = current.getFullYear() + Math.floor(nextMonth / 12);
        const monthMod = nextMonth % 12;
        const maxDay = new Date(nextYear, monthMod + 1, 0).getDate();
        current = new Date(nextYear, monthMod, Math.min(startDay, maxDay));
      }
    }
  }
  return dates;
}

// Helper: Check wallet balance (handles encryption)
function checkSubWalletBalance(walletId, requiredAmount) {
  if (!db) return { sufficient: false, currentBalance: 0 };
  const wRow = db.prepare('SELECT balance FROM finance_wallets WHERE id = ?').get(walletId);
  if (!wRow) return { sufficient: false, currentBalance: 0 };
  let balance;
  if (financeDataKey && isEncrypted(wRow.balance)) {
    balance = Number(decryptField(String(wRow.balance), financeDataKey)) || 0;
  } else {
    balance = Number(wRow.balance) || 0;
  }
  return { sufficient: balance >= requiredAmount, currentBalance: balance };
}

// Helper: Deduct from wallet (handles encryption)
function deductSubFromWallet(walletId, amount) {
  const check = checkSubWalletBalance(walletId, amount);
  if (!check.sufficient) return false;
  const newBalance = check.currentBalance - amount;
  if (financeDataKey) {
    db.prepare('UPDATE finance_wallets SET balance = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?')
      .run(encryptField(enc(newBalance), financeDataKey), walletId);
  } else {
    db.prepare('UPDATE finance_wallets SET balance = balance - ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?')
      .run(amount, walletId);
  }
  return true;
}

// Helper: Add to wallet (for reversals)
function addSubToWallet(walletId, amount) {
  if (!db) return false;
  const wRow = db.prepare('SELECT balance FROM finance_wallets WHERE id = ?').get(walletId);
  if (!wRow) return false;
  let balance;
  if (financeDataKey && isEncrypted(wRow.balance)) {
    balance = Number(decryptField(String(wRow.balance), financeDataKey)) || 0;
  } else {
    balance = Number(wRow.balance) || 0;
  }
  const newBalance = balance + amount;
  if (financeDataKey) {
    db.prepare('UPDATE finance_wallets SET balance = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?')
      .run(encryptField(enc(newBalance), financeDataKey), walletId);
  } else {
    db.prepare('UPDATE finance_wallets SET balance = balance + ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?')
      .run(amount, walletId);
  }
  return true;
}

// Helper: Resolve account_id
function resolveSubAccountId(walletId) {
  if (!db) return null;
  if (walletId) {
    const w = db.prepare('SELECT account_id FROM finance_wallets WHERE id = ?').get(walletId);
    if (w?.account_id) return w.account_id;
  }
  const acct = db.prepare("SELECT id FROM finance_accounts WHERE type = 'personal' LIMIT 1").get();
  return acct?.id || null;
}

// Helper: Get or create subscription category
function getSubCategoryId() {
  if (!db) return null;
  let cat = db.prepare("SELECT id FROM finance_categories WHERE name = 'Subscriptions' LIMIT 1").get();
  if (cat) return cat.id;
  const result = db.prepare("INSERT INTO finance_categories (name, type, icon, color, sort_order) VALUES ('Subscriptions', 'expense', 'Bell', '#8b5cf6', 16)").run();
  return Number(result.lastInsertRowid);
}
ipcMain.handle('subscriptions:list', async (_event, walletId?: number) => {
  if (!db) return [];
  try {
    if (walletId) {
      return db.prepare('SELECT * FROM finance_subscriptions WHERE wallet_id = ? ORDER BY next_renewal_date ASC').all(walletId);
    }
    return db.prepare('SELECT * FROM finance_subscriptions ORDER BY next_renewal_date ASC').all();
  } catch { return []; }
});

ipcMain.handle('subscriptions:create', async (_event, data: any) => {
  if (!db) return null;
  try {
    const today = todayStr();
    const startDate = data.start_date || today;
    const nextRenewal = data.next_renewal_date || computeNextRenewal(startDate, data.billing_cycle || 'monthly', data.billing_interval || 1);

    const result = db.prepare(`
      INSERT INTO finance_subscriptions (wallet_id, name, description, price, currency, billing_cycle, billing_interval, start_date, next_renewal_date, cancel_url, cancel_reminder_days, reminder_note, status, category_id, payment_status, autodebet)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.wallet_id, data.name, data.description || '', data.price, data.currency || 'USD',
      data.billing_cycle || 'monthly', data.billing_interval || 1,
      startDate, nextRenewal,
      data.cancel_url || '', data.cancel_reminder_days ?? 7, data.reminder_note || '',
      data.status || 'active', data.category_id || null,
      'pending', data.autodebet ?? 1
    );
    const subId = Number(result.lastInsertRowid);
    const accountId = resolveSubAccountId(data.wallet_id);
    if (!accountId) return { id: subId, ...data, start_date: startDate, next_renewal_date: nextRenewal };
    const subCatId = getSubCategoryId();

    // Check if this is an OLD subscription (start_date is in the past)
    const isOldSubscription = new Date(startDate) < new Date(today);
    if (isOldSubscription) {
      // For old subscriptions, don't auto-create — user will use Sync to backfill
      return { id: subId, ...data, start_date: startDate, next_renewal_date: nextRenewal, isOldSubscription: true, message: 'Subscription created. Use "Sync Payments" to backfill past months.' };
    }

    // For NEW subscriptions: check balance and create transaction for today
    let hasBalance = true;
    if (data.wallet_id && data.price > 0) {
      const check = checkSubWalletBalance(data.wallet_id, data.price);
      if (!check.sufficient) {
        hasBalance = false;
        db.prepare(`UPDATE finance_subscriptions SET payment_status = 'failed' WHERE id = ?`).run(subId);
      }
    }
    let txnId = null;
    if (hasBalance && data.wallet_id && data.price > 0) {
      const txnResult = db.prepare(`
        INSERT INTO finance_transactions (account_id, wallet_id, category_id, type, amount, fee, merchant, description, note, "date", "time", on_behalf_of, on_behalf_of_label)
        VALUES (?, ?, ?, 'expense', ?, 0, ?, ?, ?, ?, ?, ?, ?)
      `).run(accountId, data.wallet_id || null, subCatId, data.price, data.name, data.name,
        `Subscription: ${data.name} (${data.billing_cycle || 'monthly'})`,
        startDate, null, data.on_behalf_of ? 1 : 0, data.on_behalf_of_label || null);
      txnId = Number(txnResult.lastInsertRowid);
      deductSubFromWallet(data.wallet_id, data.price);
      db.prepare(`UPDATE finance_subscriptions SET payment_status = 'paid', last_payment_date = ?, last_payment_txn_id = ? WHERE id = ?`).run(startDate, txnId, subId);
    }
    return { id: subId, ...data, start_date: startDate, next_renewal_date: nextRenewal, hasBalance, txnId };
  } catch (err) {
    console.error('[finance] create subscription error:', err);
    return null;
  }
});

ipcMain.handle('subscriptions:update', async (_event, data: any) => {
  if (!db) return { success: false };
  try {
    const oldSub = db.prepare('SELECT * FROM finance_subscriptions WHERE id = ?').get(data.id) as any;
    db.prepare(`
      UPDATE finance_subscriptions SET name=?, description=?, price=?, currency=?, billing_cycle=?, billing_interval=?,
      start_date=?, next_renewal_date=?, cancel_url=?, cancel_reminder_days=?, reminder_note=?, status=?, category_id=?,
      updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(
      data.name, data.description || '', data.price, data.currency || 'USD',
      data.billing_cycle || 'monthly', data.billing_interval || 1,
      data.start_date || null, data.next_renewal_date || null,
      data.cancel_url || '', data.cancel_reminder_days ?? 7, data.reminder_note || '',
      data.status || 'active', data.category_id || null, data.id
    );
    if (oldSub) {
      const subFields = ['name', 'description', 'price', 'currency', 'billing_cycle', 'billing_interval', 'start_date', 'next_renewal_date', 'cancel_url', 'cancel_reminder_days', 'reminder_note', 'status', 'category_id'];
      const changes = diffFields(oldSub, data, subFields);
      const changeSummary = formatAuditChanges(changes);
      logAuditEvent('subscription_updated', 'subscription', data.id,
        changeSummary ? `Subscription "${data.name}" updated: ${changeSummary}` : `Updated subscription "${data.name}"`,
        { changes, subscriptionId: data.id, previous: Object.fromEntries(subFields.map(k => [k, oldSub[k] ?? null])) });
    } else {
      logAuditEvent('subscription_updated', 'subscription', data.id, `Updated subscription "${data.name}" — ${data.price} ${data.currency || 'USD'}/${data.billing_cycle || 'monthly'}`, { name: data.name, price: data.price, status: data.status });
    }
    return { success: true };
  } catch { return { success: false }; }
});

ipcMain.handle('subscriptions:delete', async (_event, id: number) => {
  if (!db) return { success: false };
  try {
    const sub = db.prepare('SELECT name FROM finance_subscriptions WHERE id = ?').get(id) as any;
    db.prepare('DELETE FROM finance_subscriptions WHERE id = ?').run(id);
    logAuditEvent('subscription_deleted', 'subscription', id, `Deleted subscription "${sub?.name || id}"`);
    return { success: true };
  } catch { return { success: false }; }
});

ipcMain.handle('subscriptions:get-upcoming-renewals', async (_event, days: number = 7) => {
  if (!db) return [];
  try {
    const future = new Date();
    future.setDate(future.getDate() + days);
    const cutoff = future.toISOString().replace('T', ' ').slice(0, 19);
    return db.prepare(`
      SELECT * FROM finance_subscriptions
      WHERE status = 'active' AND next_renewal_date IS NOT NULL
      AND next_renewal_date <= ?
      AND next_renewal_date >= datetime('now', 'localtime')
      ORDER BY next_renewal_date ASC
    `).all(cutoff);
  } catch { return []; }
});

ipcMain.handle('subscriptions:generate-due-transactions', async () => {
  if (!db) return { created: 0, subscriptions: [] };
  try {
    const today = todayStr();
    const due = db.prepare(`
      SELECT * FROM finance_subscriptions
      WHERE status = 'active' AND (autodebet IS NULL OR autodebet = 1)
      AND (subscription_type IS NULL OR subscription_type != 'one_time')
      ORDER BY next_renewal_date ASC
    `).all() as any[];
    const created: { subId: number; txnId: number; name: string; amount: number; date: string }[] = [];

    for (const sub of due) {
      // Resolve account_id
      let accountId = null;
      if (sub.wallet_id) {
        const w = db.prepare('SELECT account_id FROM finance_wallets WHERE id = ?').get(sub.wallet_id) as any;
        accountId = w?.account_id || null;
      }
      if (!accountId) {
        const acct = db.prepare("SELECT id FROM finance_accounts WHERE type = 'personal' LIMIT 1").get() as any;
        accountId = acct?.id;
      }
      if (!accountId) continue;

      // Resolve category
      let subCatId = sub.category_id || null;
      if (!subCatId) {
        const cat = db.prepare("SELECT id FROM finance_categories WHERE name = 'Subscriptions' AND type = 'expense' LIMIT 1").get() as any;
        if (cat) { subCatId = cat.id; }
        else {
          db.prepare("INSERT INTO finance_categories (name, type, icon, color, sort_order) VALUES ('Subscriptions', 'expense', 'Bell', '#8b5cf6', 16)").run();
          const newCat = db.prepare("SELECT id FROM finance_categories WHERE name = 'Subscriptions' AND type = 'expense' LIMIT 1").get() as any;
          subCatId = newCat?.id;
        }
      }

      // Find all dates that should have been paid: from start_date to today, one per billing cycle
      const startDate = sub.start_date ? new Date(sub.start_date) : new Date();
      const todayDate = new Date(today);
      const interval = sub.billing_interval || 1;

      // Find existing transaction dates for this subscription to avoid duplicates
      // Use consistent description format (match subscriptions:create)
      const subDesc = `Subscription: ${sub.name} (${sub.billing_cycle || 'monthly'})`;
      const existingTxns = db.prepare(`
        SELECT id, date FROM finance_transactions
        WHERE (description = ? OR note = ?) AND type = 'expense'
        AND (account_id = ? OR (account_id IS NULL AND ? IS NULL))
        ORDER BY date ASC
      `).all(subDesc, subDesc, accountId, accountId) as any[];
      const existingDates = new Set(existingTxns.map(t => t.date));

      // Read failed_dates from metadata
      let failedDates: string[] = [];
      try { failedDates = JSON.parse(sub.metadata || '{}').failed_dates || []; } catch { failedDates = []; }
      const failedDateSet = new Set(failedDates);

      // Clean up duplicate transactions (same date, same subscription)
      const dateCounts = new Map<string, number[]>();
      for (const txn of existingTxns) {
        const ids = dateCounts.get(txn.date) || [];
        ids.push(txn.id);
        dateCounts.set(txn.date, ids);
      }
      for (const [date, ids] of dateCounts) {
        if (ids.length > 1) {
          // Keep the first, delete the rest
          for (let i = 1; i < ids.length; i++) {
            db.prepare('DELETE FROM finance_transactions WHERE id = ?').run(ids[i]);
          }
        }
      }

      // Generate all expected payment dates from start_date to today
      // Use the start_date's day-of-month for consistency (e.g., 15th of each month)
      const startDay = startDate.getDate();
      let checkDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDay);
      let failedDueToBalance = false;

      while (checkDate <= todayDate) {
        const txnDate = toLocalDateStr(checkDate);

        if (!existingDates.has(txnDate) && !failedDueToBalance && !failedDateSet.has(txnDate)) {
          // Check wallet balance BEFORE creating transaction
          if (sub.wallet_id) {
            const wRow = db.prepare('SELECT balance FROM finance_wallets WHERE id = ?').get(sub.wallet_id) as any;
            const walletBal = wRow && financeDataKey && isEncrypted(wRow.balance)
              ? Number(decryptField(String(wRow.balance), financeDataKey)) || 0
              : Number(wRow?.balance) || 0;
            if (walletBal < sub.price) {
              // Not enough balance — record this specific failed date, stop creating more
              failedDueToBalance = true;
              failedDates.push(txnDate);
              const meta = JSON.stringify({ failed_dates: failedDates });
              db.prepare(`UPDATE finance_subscriptions SET payment_status = 'failed', metadata = ?, updated_at = datetime('now','localtime') WHERE id = ?`).run(meta, sub.id);
              continue;
            }
          }

          // Create the missing transaction
          const txnResult = db.prepare(`
            INSERT INTO finance_transactions (account_id, wallet_id, category_id, type, amount, fee, merchant, description, note, "date", "time", on_behalf_of, on_behalf_of_label)
            VALUES (?, ?, ?, 'expense', ?, 0, ?, ?, ?, ?, ?, 0, NULL)
          `).run(
            accountId, sub.wallet_id || null, subCatId,
            sub.price, sub.name, sub.name, subDesc,
            txnDate, null
          );
          const txnId = Number(txnResult.lastInsertRowid);

          // Deduct from wallet
          if (sub.wallet_id) {
            db.prepare('UPDATE finance_wallets SET balance = balance - ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(sub.price, sub.wallet_id);
          }
          db.prepare('UPDATE finance_accounts SET balance = balance - ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(sub.price, accountId);

          created.push({ subId: sub.id, txnId, name: sub.name, amount: sub.price, date: txnDate });
        }

        // Advance to next cycle, preserving day-of-month
        const nextMonth = checkDate.getMonth() + interval;
        const nextYear = checkDate.getFullYear() + Math.floor(nextMonth / 12);
        const nextMonthMod = nextMonth % 12;
        // Handle months with fewer days (e.g., 31st → 28th in Feb)
        const maxDay = new Date(nextYear, nextMonthMod + 1, 0).getDate();
        checkDate = new Date(nextYear, nextMonthMod, Math.min(startDay, maxDay));
      }

      // Update subscription: set payment_status + next_renewal_date
      const lastCreated = created.filter(c => c.subId === sub.id).pop();
      // Calculate next renewal date (first date after today, preserving day-of-month)
      let nextMonth = todayDate.getMonth() + interval;
      let nextYear = todayDate.getFullYear() + Math.floor(nextMonth / 12);
      nextMonth = nextMonth % 12;
      const nextMaxDay = new Date(nextYear, nextMonth + 1, 0).getDate();
      const nextRenewal = new Date(nextYear, nextMonth, Math.min(startDay, nextMaxDay));
      const nextDate = toLocalDateStr(nextRenewal);

      // Check which failed_dates still don't have transactions (after sync)
      const stillFailedDates = failedDates.filter(fd => {
        // Re-check: does a transaction exist for this date now?
        const txnExists = db.prepare(`
          SELECT id FROM finance_transactions
          WHERE (description = ? OR note = ?) AND type = 'expense' AND "date" = ? AND wallet_id = ?
        `).get(subDesc, subDesc, fd, sub.wallet_id) as any;
        return !txnExists;
      });

      const meta = JSON.stringify({ failed_dates: stillFailedDates });
      const finalStatus = stillFailedDates.length > 0 ? 'failed' : 'paid';

      if (lastCreated) {
        db.prepare(`UPDATE finance_subscriptions SET next_renewal_date = ?, payment_status = ?, last_payment_date = ?, last_payment_txn_id = ?, metadata = ?, updated_at = datetime('now','localtime') WHERE id = ?`)
          .run(nextDate, finalStatus, lastCreated.date, lastCreated.txnId, meta, sub.id);
      } else {
        // All months already have transactions
        db.prepare(`UPDATE finance_subscriptions SET next_renewal_date = ?, payment_status = ?, metadata = ?, updated_at = datetime('now','localtime') WHERE id = ?`)
          .run(nextDate, finalStatus, meta, sub.id);
      }
    }
    return { created: created.length, subscriptions: created };
  } catch (err) {
    console.error('[finance] generate subscription transactions error:', err);
    return { created: 0, subscriptions: [] };
  }
});

ipcMain.handle('subscriptions:skip-renewal', async (_event, id: number) => {
  if (!db) return { success: false };
  try {
    const sub = db.prepare('SELECT id, next_renewal_date, billing_cycle, billing_interval FROM finance_subscriptions WHERE id = ?').get(id) as any;
    if (!sub) return { success: false, error: 'Subscription not found' };
    const current = sub.next_renewal_date ? new Date(sub.next_renewal_date) : new Date();
    let interval = sub.billing_interval || 1;
    switch (sub.billing_cycle) {
      case 'weekly': current.setDate(current.getDate() + 7 * interval); break;
      case 'monthly': current.setMonth(current.getMonth() + interval); break;
      case 'quarterly': current.setMonth(current.getMonth() + 3 * interval); break;
      case 'yearly': current.setFullYear(current.getFullYear() + interval); break;
      default: current.setMonth(current.getMonth() + interval); break;
    }
    const nextDate = toLocalDateStr(current);
    db.prepare('UPDATE finance_subscriptions SET next_renewal_date = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(nextDate, id);
    logAuditEvent('subscription_renewal_skipped', 'subscription', id,
      `Skipped renewal for subscription #${id} — next renewal moved from ${sub.next_renewal_date || '(none)'} to ${nextDate}`,
      { oldNextRenewal: sub.next_renewal_date, newNextRenewal: nextDate });
    return { success: true };
  } catch (err) {
    console.error('[finance] skip renewal error:', err);
    return { success: false, error: String(err) };
  }
});

// Move the most recent subscription transaction to a different wallet
ipcMain.handle('subscriptions:move-transaction', async (_event, data: { subscriptionId: number; newWalletId: number }) => {
  if (!db) return { success: false };
  try {
    const sub = db.prepare('SELECT id, wallet_id, name, price FROM finance_subscriptions WHERE id = ?').get(data.subscriptionId) as any;
    if (!sub) return { success: false, error: 'Subscription not found' };

    // Find the most recent transaction for this subscription (by description match)
    const txn = db.prepare(`
      SELECT id, wallet_id, account_id, amount FROM finance_transactions
      WHERE description = ? AND type = 'expense'
      ORDER BY date DESC, id DESC LIMIT 1
    `).get(sub.name) as any;
    if (!txn) return { success: false, error: 'No transactions found for this subscription' };

    const oldWalletId = txn.wallet_id;
    const newWalletId = data.newWalletId;
    if (oldWalletId === newWalletId) return { success: true, moved: false };

    // Get account_ids for both wallets
    const oldWallet = db.prepare('SELECT account_id FROM finance_wallets WHERE id = ?').get(oldWalletId) as any;
    const newWallet = db.prepare('SELECT account_id FROM finance_wallets WHERE id = ?').get(newWalletId) as any;
    if (!newWallet) return { success: false, error: 'New wallet not found' };

    const amount = Math.abs(txn.amount);

    // Update the transaction's wallet_id
    db.prepare('UPDATE finance_transactions SET wallet_id = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(newWalletId, txn.id);

    // Adjust balances: refund old wallet, charge new wallet
    if (oldWalletId) {
      db.prepare('UPDATE finance_wallets SET balance = balance + ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(amount, oldWalletId);
    }
    db.prepare('UPDATE finance_wallets SET balance = balance - ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(amount, newWalletId);

    // Also adjust account balances if different accounts
    if (oldWallet && newWallet && oldWallet.account_id !== newWallet.account_id) {
      db.prepare('UPDATE finance_accounts SET balance = balance + ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(amount, oldWallet.account_id);
      db.prepare('UPDATE finance_accounts SET balance = balance - ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(amount, newWallet.account_id);
    }

    // Update the subscription's default wallet for future renewals
    db.prepare('UPDATE finance_subscriptions SET wallet_id = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(newWalletId, data.subscriptionId);

    logAuditEvent('subscription_payment_moved', 'subscription', data.subscriptionId,
      `Moved last payment for "${sub.name}" from wallet ${oldWalletId} to wallet ${newWalletId}`,
      { txnId: txn.id, oldWalletId, newWalletId, amount });

    return { success: true, moved: true, txnId: txn.id };
  } catch (err) {
    console.error('[finance] move subscription transaction error:', err);
    return { success: false, error: String(err) };
  }
});

// Retry a failed subscription payment from a (potentially different) wallet
ipcMain.handle('subscriptions:retry-payment', async (_event, data: { subscriptionId: number; walletId?: number; date?: string }) => {
  if (!db) return { success: false };
  try {
    const sub = db.prepare('SELECT id, wallet_id, name, price, billing_cycle, billing_interval, last_payment_date, metadata, start_date FROM finance_subscriptions WHERE id = ?').get(data.subscriptionId) as any;
    if (!sub) return { success: false, error: 'Subscription not found' };

    const walletId = data.walletId || sub.wallet_id;
    if (!walletId) return { success: false, error: 'No wallet selected' };

    const accountId = resolveSubAccountId(walletId);
    if (!accountId) return { success: false, error: 'No account found' };

    // Read failed_dates from metadata
    let failedDates: string[] = [];
    try { failedDates = JSON.parse(sub.metadata || '{}').failed_dates || []; } catch { failedDates = []; }

    // Determine retry date: explicit > first failed date > today
    let retryDate = data.date || (failedDates.length > 0 ? failedDates[0] : null) || sub.last_payment_date || sub.start_date || todayStr();

    // Check for duplicate transaction on same date
    const subDesc = `Subscription: ${sub.name} (${sub.billing_cycle || 'monthly'})`;
    const existing = db.prepare(`
      SELECT id FROM finance_transactions
      WHERE (description = ? OR note = ?) AND type = 'expense' AND "date" = ? AND wallet_id = ?
    `).get(subDesc, subDesc, retryDate, walletId) as any;
    if (existing) {
      // Transaction already exists for this date — just clear it from failed_dates
      const cleanedDates = failedDates.filter(d => d !== retryDate);
      const meta = JSON.stringify({ failed_dates: cleanedDates });
      db.prepare(`UPDATE finance_subscriptions SET metadata = ?, payment_status = CASE WHEN ? = 'failed' AND ? = 0 THEN 'paid' ELSE payment_status END, updated_at = datetime('now','localtime') WHERE id = ?`)
        .run(meta, sub.payment_status, cleanedDates.length, data.subscriptionId);
      return { success: true, txnId: existing.id, date: retryDate, message: 'Transaction already existed' };
    }

    // Check balance
    const check = checkSubWalletBalance(walletId, sub.price);
    if (!check.sufficient) {
      return { success: false, error: `Insufficient balance — need ${sub.price}, have ${check.currentBalance}` };
    }

    const subCatId = getSubCategoryId();

    // Create transaction
    const txnResult = db.prepare(`
      INSERT INTO finance_transactions (account_id, wallet_id, category_id, type, amount, fee, merchant, description, note, "date", "time", on_behalf_of, on_behalf_of_label)
      VALUES (?, ?, ?, 'expense', ?, 0, ?, ?, ?, ?, ?, 0, NULL)
    `).run(accountId, walletId, subCatId, sub.price, sub.name, sub.name, subDesc, retryDate, null);
    const txnId = Number(txnResult.lastInsertRowid);

    deductSubFromWallet(walletId, sub.price);
    db.prepare('UPDATE finance_accounts SET balance = balance - ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(sub.price, accountId);

    // Clear retried date from failed_dates
    const cleanedDates = failedDates.filter(d => d !== retryDate);
    const meta = JSON.stringify({ failed_dates: cleanedDates });

    const nextRenewal = computeNextRenewal(retryDate, sub.billing_cycle || 'monthly', sub.billing_interval || 1);
    // Only mark 'paid' if no more failed dates remain
    const newStatus = cleanedDates.length === 0 ? 'paid' : 'failed';
    db.prepare(`UPDATE finance_subscriptions SET next_renewal_date = ?, payment_status = ?, last_payment_date = ?, last_payment_txn_id = ?, wallet_id = ?, metadata = ?, updated_at = datetime('now','localtime') WHERE id = ?`)
      .run(nextRenewal, newStatus, retryDate, txnId, walletId, meta, data.subscriptionId);

    logAuditEvent('subscription_payment_retried', 'subscription', data.subscriptionId,
      `Retry payment for "${sub.name}": $${sub.price} on ${retryDate} via wallet #${walletId} (txn #${txnId}) → status: ${newStatus}`,
      { subscriptionId: data.subscriptionId, txnId, amount: sub.price, walletId, date: retryDate, previousStatus: sub.payment_status, newStatus, nextRenewal });

    return { success: true, txnId, date: retryDate, nextRenewal };
  } catch (err) {
    console.error('[finance] retry subscription payment error:', err);
    return { success: false, error: String(err) };
  }
});

// Toggle autodebet for a subscription
ipcMain.handle('subscriptions:toggle-autodebet', async (_event, id: number) => {
  if (!db) return { success: false };
  try {
    const sub = db.prepare('SELECT id, autodebet FROM finance_subscriptions WHERE id = ?').get(id) as any;
    if (!sub) return { success: false };
    const newVal = sub.autodebet ? 0 : 1;
    db.prepare('UPDATE finance_subscriptions SET autodebet = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(newVal, id);
    logAuditEvent('subscription_autodebet_toggled', 'subscription', id,
      `Auto-debit ${newVal ? 'enabled' : 'disabled'} for subscription #${id}`,
      { autodebet: newVal, previous: sub.autodebet ? 1 : 0 });
    return { success: true, autodebet: newVal };
  } catch { return { success: false }; }
});

// Record a manual payment for a subscription
ipcMain.handle('subscriptions:record-payment', async (_event, data: { subscriptionId: number; walletId?: number; amount?: number; date?: string }) => {
  if (!db) return { success: false };
  try {
    const sub = db.prepare('SELECT id, wallet_id, name, price, billing_cycle, billing_interval FROM finance_subscriptions WHERE id = ?').get(data.subscriptionId) as any;
    if (!sub) return { success: false, error: 'Subscription not found' };

    const walletId = data.walletId || sub.wallet_id;
    const amount = data.amount || sub.price;
    const txnDate = data.date || todayStr();

    // Resolve account_id
    const accountId = resolveSubAccountId(walletId);
    if (!accountId) return { success: false, error: 'No account found' };

    const subCatId = getSubCategoryId();
    const subDesc = `Subscription: ${sub.name} (${sub.billing_cycle || 'monthly'})`;

    // Check if this month is already paid (duplicate check)
    const existing = db.prepare(`
      SELECT id FROM finance_transactions
      WHERE (description = ? OR note = ?) AND type = 'expense' AND "date" = ?
      AND (account_id = ? OR (account_id IS NULL AND ? IS NULL))
    `).get(subDesc, subDesc, txnDate, accountId, accountId);
    if (existing) {
      return { success: false, error: `Payment for ${txnDate} already recorded`, alreadyPaid: true };
    }

    // Check balance
    if (walletId && amount > 0) {
      const check = checkSubWalletBalance(walletId, amount);
      if (!check.sufficient) {
        db.prepare(`UPDATE finance_subscriptions SET payment_status = 'failed' WHERE id = ?`).run(sub.id);
        return { success: false, error: `Insufficient balance — need ${amount}, have ${check.currentBalance}`, insufficientBalance: true };
      }
    }

    // Create transaction
    const txnResult = db.prepare(`
      INSERT INTO finance_transactions (account_id, wallet_id, category_id, type, amount, fee, merchant, description, note, "date", "time", on_behalf_of, on_behalf_of_label)
      VALUES (?, ?, ?, 'expense', ?, 0, ?, ?, ?, ?, ?, 0, NULL)
    `).run(accountId, walletId || null, subCatId, amount, sub.name, sub.name, subDesc, txnDate, null);
    const txnId = Number(txnResult.lastInsertRowid);

    // Deduct from wallet
    if (walletId) deductSubFromWallet(walletId, amount);
    db.prepare('UPDATE finance_accounts SET balance = balance - ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(amount, accountId);

    // Update subscription + next_renewal_date
    const nextRenewal = computeNextRenewal(txnDate, sub.billing_cycle || 'monthly', sub.billing_interval || 1);

    // Clear failed_dates from metadata so generate-due-transactions doesn't flip status back to 'failed'
    let failedDates: string[] = [];
    try { failedDates = JSON.parse(sub.metadata || '{}').failed_dates || []; } catch { failedDates = []; }
    const cleanedDates = failedDates.filter(fd => fd !== txnDate);
    const meta = JSON.stringify({ failed_dates: cleanedDates });

    db.prepare(`UPDATE finance_subscriptions SET next_renewal_date = ?, payment_status = 'paid', last_payment_date = ?, last_payment_txn_id = ?, metadata = ?, updated_at = datetime('now','localtime') WHERE id = ?`)
      .run(nextRenewal, txnDate, txnId, meta, data.subscriptionId);

    logAuditEvent('subscription_payment_recorded', 'subscription', data.subscriptionId,
      `Recorded payment for "${sub.name}": $${amount} on ${txnDate} via wallet #${walletId} (txn #${txnId})`,
      { subscriptionId: data.subscriptionId, txnId, amount, walletId, date: txnDate, nextRenewal });

    return { success: true, txnId, date: txnDate, nextRenewal };
  } catch (err) {
    console.error('[finance] record subscription payment error:', err);
    return { success: false, error: String(err) };
  }
});

// NEW: Get payment history for a subscription
ipcMain.handle('subscriptions:get-payment-history', async (_event, subscriptionId) => {
  if (!db) return { success: false, error: 'Database not available' };
  try {
    const sub = db.prepare('SELECT * FROM finance_subscriptions WHERE id = ?').get(subscriptionId);
    if (!sub) return { success: false, error: 'Subscription not found' };
    const subDesc = `Subscription: ${sub.name} (${sub.billing_cycle || 'monthly'})`;
    const transactions = db.prepare(`
      SELECT t.id, t.amount, t.date, t.type, t.note, t.created_at, w.name as wallet_name
      FROM finance_transactions t
      LEFT JOIN finance_wallets w ON t.wallet_id = w.id
      WHERE t.description = ? OR t.note LIKE ?
      ORDER BY t.date DESC, t.created_at DESC
    `).all(subDesc, `%${sub.name}%`);
    const startDate = sub.start_date || sub.created_at?.slice(0, 10);
    const allDates = getBillingDates(startDate, sub.billing_cycle || 'monthly', sub.billing_interval || 1);
    const futureDates = [];
    let lastDate = new Date(allDates[allDates.length - 1] || startDate);
    for (let i = 0; i < 12; i++) {
      const nextDate = computeNextRenewal(toLocalDateStr(lastDate), sub.billing_cycle || 'monthly', sub.billing_interval || 1);
      futureDates.push(nextDate);
      lastDate = new Date(nextDate);
    }
    const allExpectedDates = [...allDates, ...futureDates];
    const paymentHistory = allExpectedDates.map(date => {
      const txn = transactions.find(t => t.date === date && t.type === 'expense');
      const reversal = transactions.find(t => t.date === date && t.type === 'income');
      if (reversal && !txn) return { date, status: 'cancelled', amount: Math.abs(reversal.amount), txnId: reversal.id };
      if (txn && reversal) return { date, status: 'cancelled', amount: Math.abs(txn.amount), txnId: txn.id, reversalId: reversal.id };
      if (txn) return { date, status: 'paid', amount: Math.abs(txn.amount), txnId: txn.id };
      if (new Date(date) > new Date()) return { date, status: 'upcoming', amount: sub.price };
      return { date, status: 'unpaid', amount: sub.price };
    });
    return {
      success: true,
      subscription: { id: sub.id, name: sub.name, price: sub.price },
      paymentHistory,
      transactions: transactions.map(t => ({ id: t.id, date: t.date, amount: Math.abs(t.amount), type: t.type, wallet: t.wallet_name, note: t.note })),
    };
  } catch (err) {
    console.error('[finance] get subscription payment history error:', err);
    return { success: false, error: String(err) };
  }
});

// NEW: Cancel/reverse a subscription payment
ipcMain.handle('subscriptions:cancel-payment', async (_event, data) => {
  if (!db) return { success: false, error: 'Database not available' };
  try {
    const sub = db.prepare('SELECT * FROM finance_subscriptions WHERE id = ?').get(data.subscriptionId);
    if (!sub) return { success: false, error: 'Subscription not found' };
    const txn = db.prepare('SELECT * FROM finance_transactions WHERE id = ?').get(data.transactionId);
    if (!txn) return { success: false, error: 'Transaction not found' };
    const expectedDesc = `Subscription: ${sub.name} (${sub.billing_cycle || 'monthly'})`;
    if (txn.description !== expectedDesc && !txn.note?.includes(sub.name)) {
      return { success: false, error: 'Transaction does not match subscription' };
    }
    const accountId = resolveSubAccountId(sub.wallet_id);
    const reversalAmount = Math.abs(Number(txn.amount));
    const reversalResult = db.prepare(`
      INSERT INTO finance_transactions (account_id, wallet_id, category_id, type, amount, fee, merchant, description, note, "date", "time", on_behalf_of, on_behalf_of_label)
      VALUES (?, ?, ?, 'income', ?, 0, ?, ?, ?, ?, ?, ?, ?)
    `).run(accountId, txn.wallet_id, txn.category_id, reversalAmount, sub.name, sub.name,
      `Reversal: ${txn.description}`, `Cancelled payment for ${sub.name} — ${data.reason || 'User cancelled'}`,
      todayStr(), null, 0, null);
    const reversalId = Number(reversalResult.lastInsertRowid);
    addSubToWallet(txn.wallet_id, reversalAmount);
    db.prepare(`UPDATE finance_subscriptions SET payment_status = 'cancelled', last_payment_date = NULL, last_payment_txn_id = NULL WHERE id = ?`).run(sub.id);
    return { success: true, reversalId, originalTxnId: txn.id, amount: reversalAmount };
  } catch (err) {
    console.error('[finance] cancel subscription payment error:', err);
    return { success: false, error: String(err) };
  }
});

// ========== Fixed Expenses ==========

function getFixedExpenseCategoryId() {
  if (!db) return null;
  let cat = db.prepare("SELECT id FROM finance_categories WHERE name = 'Fixed Expenses' LIMIT 1").get();
  if (cat) return (cat as any).id;
  const result = db.prepare("INSERT INTO finance_categories (name, type, icon, color, sort_order) VALUES ('Fixed Expenses', 'expense', 'Receipt', '#f59e0b', 17)").run();
  return Number(result.lastInsertRowid);
}

ipcMain.handle('fixed-expenses:list', async (_event, month?: string) => {
  if (!db) return [];
  try {
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    return db.prepare(`
      SELECT fe.*, c.name as category_name, c.color as category_color, c.icon as category_icon,
        w.name as wallet_name, w.currency as wallet_currency,
        fp.status as current_month_status, fp.amount_paid as current_month_amount_paid,
        fp.transaction_id as current_month_transaction_id, fp.paid_date as current_month_paid_date
      FROM finance_fixed_expenses fe
      LEFT JOIN finance_categories c ON fe.category_id = c.id
      LEFT JOIN finance_wallets w ON fe.wallet_id = w.id
      LEFT JOIN finance_fixed_expense_payments fp ON fe.id = fp.fixed_expense_id AND fp.month = ?
      WHERE fe.is_active = 1
      ORDER BY fe.billing_day ASC, fe.name ASC
    `).all(targetMonth);
  } catch (err) { console.error('fixed-expenses:list error:', err); return []; }
});

ipcMain.handle('fixed-expenses:create', async (_event, data: any) => {
  if (!db) return null;
  try {
    if (!data.wallet_id) {
      const defaultWallet = db.prepare('SELECT id FROM finance_wallets ORDER BY id LIMIT 1').get() as any;
      data.wallet_id = defaultWallet?.id || 0;
    }
    const result = db.prepare(`
      INSERT INTO finance_fixed_expenses (wallet_id, name, description, amount, currency, category_id, billing_day, frequency, type, next_due_date, is_active, auto_create_transaction, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(data.wallet_id, data.name, data.description || '', data.amount, data.currency || 'USD',
      data.category_id || null, data.billing_day || 1, data.frequency || 'monthly', data.type || 'expense',
      data.next_due_date || null, data.is_active !== undefined ? data.is_active : 1,
      data.auto_create_transaction || 0, data.metadata || null);
    const id = Number(result.lastInsertRowid);
    const currentMonth = new Date().toISOString().slice(0, 7);
    db.prepare("INSERT OR IGNORE INTO finance_fixed_expense_payments (fixed_expense_id, month, status) VALUES (?, ?, 'pending')").run(id, currentMonth);
    logAuditEvent('fixed_expense_created', 'fixed_expense', id, `Created fixed expense: ${data.name}`);
    return { id, ...data };
  } catch (err) { console.error('fixed-expenses:create error:', err); return null; }
});

ipcMain.handle('fixed-expenses:update', async (_event, data: any) => {
  if (!db) return null;
  try {
    db.prepare(`
      UPDATE finance_fixed_expenses SET wallet_id=COALESCE(?,wallet_id), name=COALESCE(?,name),
        description=COALESCE(?,description), amount=COALESCE(?,amount), currency=COALESCE(?,currency),
        category_id=COALESCE(?,category_id), billing_day=COALESCE(?,billing_day),
        frequency=COALESCE(?,frequency), type=COALESCE(?,type), next_due_date=COALESCE(?,next_due_date),
        is_active=COALESCE(?,is_active), auto_create_transaction=COALESCE(?,auto_create_transaction),
        metadata=COALESCE(?,metadata), updated_at=datetime('now','localtime') WHERE id=?
    `).run(data.wallet_id, data.name, data.description, data.amount, data.currency,
      data.category_id, data.billing_day, data.frequency, data.type, data.next_due_date,
      data.is_active, data.auto_create_transaction, data.metadata, data.id);
    logAuditEvent('fixed_expense_updated', 'fixed_expense', data.id, `Updated fixed expense: ${data.name}`);
    return { success: true };
  } catch (err) { console.error('fixed-expenses:update error:', err); return null; }
});

ipcMain.handle('fixed-expenses:delete', async (_event, id: number) => {
  if (!db) return null;
  try {
    const expense = db.prepare('SELECT name FROM finance_fixed_expenses WHERE id = ?').get(id) as any;
    db.prepare('DELETE FROM finance_fixed_expenses WHERE id = ?').run(id);
    logAuditEvent('fixed_expense_deleted', 'fixed_expense', id, `Deleted fixed expense: ${expense?.name}`);
    return { success: true };
  } catch (err) { console.error('fixed-expenses:delete error:', err); return null; }
});

ipcMain.handle('fixed-expenses:mark-paid', async (_event, data: any) => {
  if (!db) return { success: false };
  const { fixed_expense_id, month, amount, note, paid_by = 'manual' } = data;
  try {
    const expense = db.prepare('SELECT * FROM finance_fixed_expenses WHERE id = ?').get(fixed_expense_id) as any;
    if (!expense) return { success: false, error: 'Not found' };
    const wallet = db.prepare('SELECT * FROM finance_wallets WHERE id = ?').get(expense.wallet_id) as any;
    if (!wallet) return { success: false, error: 'Wallet not found' };
    const payAmount = amount || expense.amount;
    const today = new Date().toISOString().slice(0, 10);
    const txnResult = db.prepare(`
      INSERT INTO finance_transactions (account_id, wallet_id, category_id, type, amount, fee, merchant, description, note, "date", "time", on_behalf_of, is_adjustment)
      VALUES (?, ?, ?, 'expense', ?, 0, ?, ?, ?, ?, ?, 0, 0)
    `).run(wallet.account_id, expense.wallet_id, expense.category_id, -Math.abs(payAmount), expense.name,
      `Fixed: ${expense.name} (${month})`, note || '', today, new Date().toTimeString().slice(0, 5));
    const txnId = Number(txnResult.lastInsertRowid);
    // Deduct from wallet
    if (financeDataKey) {
      const wRow = db.prepare('SELECT balance FROM finance_wallets WHERE id = ?').get(expense.wallet_id) as any;
      const wBal = wRow && isEncrypted(wRow.balance) ? Number(decryptField(String(wRow.balance), financeDataKey)) || 0 : Number(wRow?.balance) || 0;
      db.prepare('UPDATE finance_wallets SET balance = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(encryptField(enc(wBal - Math.abs(payAmount)), financeDataKey), expense.wallet_id);
    } else {
      db.prepare('UPDATE finance_wallets SET balance = balance - ? WHERE id = ?').run(Math.abs(payAmount), expense.wallet_id);
    }
    db.prepare('UPDATE finance_accounts SET balance = balance - ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(Math.abs(payAmount), wallet.account_id);
    db.prepare(`INSERT INTO finance_fixed_expense_payments (fixed_expense_id, month, status, amount_paid, transaction_id, paid_date, paid_by, note)
      VALUES (?, ?, 'paid', ?, ?, ?, ?, ?)
      ON CONFLICT(fixed_expense_id, month) DO UPDATE SET status='paid', amount_paid=excluded.amount_paid,
        transaction_id=excluded.transaction_id, paid_date=excluded.paid_date, paid_by=excluded.paid_by, note=excluded.note, updated_at=datetime('now','localtime')
    `).run(fixed_expense_id, month, payAmount, txnId, today, paid_by, note || '');
    logAuditEvent('fixed_expense_paid', 'fixed_expense', fixed_expense_id, `Marked ${expense.name} paid for ${month}: ${payAmount}`);
    return { success: true, transaction_id: txnId, amount: payAmount };
  } catch (err) { console.error('fixed-expenses:mark-paid error:', err); return { success: false, error: String(err) }; }
});

ipcMain.handle('fixed-expenses:skip-month', async (_event, data: any) => {
  if (!db) return { success: false };
  try {
    db.prepare(`INSERT INTO finance_fixed_expense_payments (fixed_expense_id, month, status, note) VALUES (?, ?, 'skipped', ?)
      ON CONFLICT(fixed_expense_id, month) DO UPDATE SET status='skipped', transaction_id=NULL, amount_paid=NULL, paid_date=NULL, note=excluded.note, updated_at=datetime('now','localtime')
    `).run(data.fixed_expense_id, data.month, data.note || '');
    return { success: true };
  } catch (err) { console.error('fixed-expenses:skip-month error:', err); return { success: false }; }
});

ipcMain.handle('fixed-expenses:unmark-paid', async (_event, data: any) => {
  if (!db) return { success: false };
  try {
    const payment = db.prepare('SELECT * FROM finance_fixed_expense_payments WHERE fixed_expense_id = ? AND month = ?').get(data.fixed_expense_id, data.month) as any;
    if (!payment || payment.status !== 'paid') return { success: false, error: 'Not paid' };
    if (payment.transaction_id) {
      const txn = db.prepare('SELECT amount, wallet_id, account_id FROM finance_transactions WHERE id = ?').get(payment.transaction_id) as any;
      if (txn) {
        // Reverse wallet balance
        if (financeDataKey) {
          const wRow = db.prepare('SELECT balance FROM finance_wallets WHERE id = ?').get(txn.wallet_id) as any;
          const wBal = wRow && isEncrypted(wRow.balance) ? Number(decryptField(String(wRow.balance), financeDataKey)) || 0 : Number(wRow?.balance) || 0;
          db.prepare('UPDATE finance_wallets SET balance = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(encryptField(enc(wBal + Math.abs(txn.amount)), financeDataKey), txn.wallet_id);
        } else {
          db.prepare('UPDATE finance_wallets SET balance = balance + ? WHERE id = ?').run(Math.abs(txn.amount), txn.wallet_id);
        }
        db.prepare('UPDATE finance_accounts SET balance = balance + ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(Math.abs(txn.amount), txn.account_id);
        db.prepare('DELETE FROM finance_transactions WHERE id = ?').run(payment.transaction_id);
      }
    }
    db.prepare(`UPDATE finance_fixed_expense_payments SET status='pending', amount_paid=NULL, transaction_id=NULL, paid_date=NULL, paid_by='manual', updated_at=datetime('now','localtime')
      WHERE fixed_expense_id = ? AND month = ?`).run(data.fixed_expense_id, data.month);
    return { success: true };
  } catch (err) { console.error('fixed-expenses:unmark-paid error:', err); return { success: false }; }
});

ipcMain.handle('fixed-expenses:payment-history', async (_event, id: number) => {
  if (!db) return [];
  try {
    return db.prepare(`SELECT fp.*, fe.name as expense_name, fe.amount as expected_amount
      FROM finance_fixed_expense_payments fp JOIN finance_fixed_expenses fe ON fp.fixed_expense_id = fe.id
      WHERE fp.fixed_expense_id = ? ORDER BY fp.month DESC`).all(id);
  } catch { return []; }
});

ipcMain.handle('fixed-expenses:summary', async (_event, month?: string) => {
  if (!db) return null;
  const targetMonth = month || new Date().toISOString().slice(0, 7);
  try {
    const totalFixed = db.prepare('SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM finance_fixed_expenses WHERE is_active = 1').get() as any;
    const paidSummary = db.prepare(`SELECT COALESCE(SUM(fe.amount), 0) as total_paid, COUNT(*) as paid_count
      FROM finance_fixed_expenses fe JOIN finance_fixed_expense_payments fp ON fe.id = fp.fixed_expense_id AND fp.month = ? AND fp.status = 'paid'
      WHERE fe.is_active = 1`).get(targetMonth) as any;
    const byCategory = db.prepare(`SELECT fe.category_id, c.name as category_name, c.color as category_color,
      SUM(fe.amount) as total_amount, SUM(CASE WHEN fp.status = 'paid' THEN fe.amount ELSE 0 END) as paid_amount, COUNT(*) as count
      FROM finance_fixed_expenses fe LEFT JOIN finance_categories c ON fe.category_id = c.id
      LEFT JOIN finance_fixed_expense_payments fp ON fe.id = fp.fixed_expense_id AND fp.month = ?
      WHERE fe.is_active = 1 GROUP BY fe.category_id`).all(targetMonth);
    return {
      totalMonthlyFixed: totalFixed.total, totalPaid: paidSummary.total_paid,
      totalRemaining: totalFixed.total - paidSummary.total_paid,
      percentagePaid: totalFixed.total > 0 ? (paidSummary.total_paid / totalFixed.total) * 100 : 0,
      byCategory, overdueCount: 0, upcomingCount: totalFixed.count - paidSummary.paid_count
    };
  } catch (err) { console.error('fixed-expenses:summary error:', err); return null; }
});

ipcMain.handle('fixed-expenses:detect-recurring', async () => {
  if (!db) return [];
  try {
    const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const cutoff = sixMonthsAgo.toISOString().slice(0, 10);
    const candidates = db.prepare(`SELECT LOWER(TRIM(description)) as normalized_desc, merchant, category_id,
      COUNT(*) as frequency, AVG(ABS(amount)) as avg_amount, MAX(date) as last_seen
      FROM finance_transactions WHERE type = 'expense' AND date >= ? AND is_adjustment = 0
      GROUP BY normalized_desc HAVING frequency >= 3 ORDER BY frequency DESC LIMIT 20`).all(cutoff) as any[];
    const suggestions = [];
    for (const c of candidates) {
      const existing = db.prepare('SELECT 1 FROM finance_fixed_expenses WHERE LOWER(name) LIKE ? LIMIT 1').get(`%${c.normalized_desc}%`);
      if (existing) continue;
      const cat = db.prepare('SELECT name FROM finance_categories WHERE id = ?').get(c.category_id) as any;
      suggestions.push({ suggestedName: c.merchant || c.normalized_desc, avgAmount: Math.round(c.avg_amount * 100) / 100,
        frequency: c.frequency, lastSeen: c.last_seen, category: cat?.name || 'Other', categoryId: c.category_id,
        confidence: Math.min(1, c.frequency / 6) });
    }
    return suggestions.sort((a: any, b: any) => b.confidence - a.confidence).slice(0, 10);
  } catch { return []; }
});

// ========== Budgets ==========

ipcMain.handle('budgets:list', async () => {
  if (!db) return [];
  try {
    return db.prepare(`SELECT b.*, c.name as category_name, c.color as category_color, c.icon as category_icon
      FROM finance_budgets b LEFT JOIN finance_categories c ON b.category_id = c.id
      ORDER BY b.type ASC, b.name ASC`).all();
  } catch { return []; }
});

ipcMain.handle('budgets:create', async (_event, data: any) => {
  if (!db) return null;
  try {
    const result = db.prepare(`INSERT INTO finance_budgets (name, type, category_id, amount, currency, period, alert_threshold, is_active, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(data.name, data.type,
      data.type === 'category' ? data.category_id : null, data.amount, data.currency || 'USD',
      data.period || 'monthly', data.alert_threshold || 80, data.is_active !== undefined ? data.is_active : 1, data.metadata || null);
    const id = Number(result.lastInsertRowid);
    logAuditEvent('budget_created', 'budget', id, `Created budget: ${data.name}`);
    return { id, ...data };
  } catch (err) { console.error('budgets:create error:', err); return null; }
});

ipcMain.handle('budgets:update', async (_event, data: any) => {
  if (!db) return null;
  try {
    db.prepare(`UPDATE finance_budgets SET name=COALESCE(?,name), type=COALESCE(?,type),
      category_id=COALESCE(?,category_id), amount=COALESCE(?,amount), currency=COALESCE(?,currency),
      period=COALESCE(?,period), alert_threshold=COALESCE(?,alert_threshold),
      is_active=COALESCE(?,is_active), metadata=COALESCE(?,metadata),
      updated_at=datetime('now','localtime') WHERE id=?`).run(
      data.name, data.type, data.type === 'category' ? data.category_id : null,
      data.amount, data.currency, data.period, data.alert_threshold, data.is_active, data.metadata, data.id);
    return { success: true };
  } catch (err) { console.error('budgets:update error:', err); return null; }
});

ipcMain.handle('budgets:delete', async (_event, id: number) => {
  if (!db) return null;
  try {
    const b = db.prepare('SELECT name FROM finance_budgets WHERE id = ?').get(id) as any;
    db.prepare('DELETE FROM finance_budgets WHERE id = ?').run(id);
    logAuditEvent('budget_deleted', 'budget', id, `Deleted budget: ${b?.name}`);
    return { success: true };
  } catch { return null; }
});

ipcMain.handle('budgets:get-status', async (_event, month?: string) => {
  if (!db) return null;
  const targetMonth = month || new Date().toISOString().slice(0, 7);
  const [year, mon] = targetMonth.split('-').map(Number);
  const startDate = `${targetMonth}-01`;
  const endDate = new Date(year, mon, 0).toISOString().slice(0, 10);
  try {
    const budgets = db.prepare(`SELECT b.*, c.name as category_name, c.color as category_color, c.icon as category_icon
      FROM finance_budgets b LEFT JOIN finance_categories c ON b.category_id = c.id WHERE b.is_active = 1`).all() as any[];
    let totalBudget = 0, totalSpent = 0, overBudgetCount = 0, warningCount = 0;
    const budgetStatuses = budgets.map((budget: any) => {
      let spent = 0;
      if (budget.type === 'total') {
        const r = db.prepare(`SELECT COALESCE(SUM(ABS(amount)), 0) as spent FROM finance_transactions
          WHERE type='expense' AND date>=? AND date<=? AND is_adjustment=0 AND (on_behalf_of=0 OR on_behalf_of IS NULL)`).get(startDate, endDate) as any;
        spent = r.spent;
      } else {
        const r = db.prepare(`SELECT COALESCE(SUM(ABS(amount)), 0) as spent FROM finance_transactions
          WHERE type='expense' AND category_id=? AND date>=? AND date<=? AND is_adjustment=0 AND (on_behalf_of=0 OR on_behalf_of IS NULL)`).get(budget.category_id, startDate, endDate) as any;
        spent = r.spent;
      }
      const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
      const remaining = Math.max(0, budget.amount - spent);
      let status: 'ok' | 'warning' | 'over' = 'ok';
      if (percentage >= 100) { status = 'over'; overBudgetCount++; }
      else if (percentage >= budget.alert_threshold) { status = 'warning'; warningCount++; }
      totalBudget += budget.amount; totalSpent += spent;
      return { id: budget.id, name: budget.name, type: budget.type, limit: budget.amount, spent,
        remaining, percentage: Math.round(percentage * 10) / 10, status,
        category: budget.category_id ? { id: budget.category_id, name: budget.category_name, color: budget.category_color, icon: budget.category_icon } : undefined };
    });
    return { budgets: budgetStatuses, totalBudget, totalSpent, totalRemaining: Math.max(0, totalBudget - totalSpent),
      overallPercentage: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0, overBudgetCount, warningCount };
  } catch (err) { console.error('budgets:get-status error:', err); return null; }
});

// ========== Person Balance Tracking ==========
// Get all person balances for a wallet
ipcMain.handle('finance:get-person-balances', async (_event, walletId: number) => {
  if (!db) return [];
  try {
    return db.prepare('SELECT * FROM finance_person_balances WHERE wallet_id = ? ORDER BY person_name').all(walletId);
  } catch { return []; }
});

// Add/update a person's balance when a transaction is attributed to them
ipcMain.handle('finance:attribute-transaction', async (_event, data: { txnId: number; personName: string; walletId: number }) => {
  if (!db) return { success: false };
  try {
    const txn = db.prepare('SELECT id, amount, type, wallet_id FROM finance_transactions WHERE id = ?').get(data.txnId) as any;
    if (!txn) return { success: false, error: 'Transaction not found' };

    const amount = Math.abs(txn.amount);
    const isIncome = txn.type === 'income';

    // Upsert person balance: income adds to paid, expense adds to spent
    const existing = db.prepare('SELECT id, total_paid, total_spent FROM finance_person_balances WHERE wallet_id = ? AND person_name = ?').get(data.walletId, data.personName) as any;

    if (existing) {
      const newPaid = existing.total_paid + (isIncome ? amount : 0);
      const newSpent = existing.total_spent + (!isIncome ? amount : 0);
      db.prepare('UPDATE finance_person_balances SET total_paid = ?, total_spent = ?, net_balance = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?')
        .run(newPaid, newSpent, newPaid - newSpent, existing.id);
    } else {
      const paid = isIncome ? amount : 0;
      const spent = !isIncome ? amount : 0;
      db.prepare('INSERT INTO finance_person_balances (wallet_id, person_name, total_paid, total_spent, net_balance) VALUES (?, ?, ?, ?, ?)')
        .run(data.walletId, data.personName, paid, spent, paid - spent);
    }

    // Tag the transaction with the person name
    const tags = txn.tags ? JSON.parse(txn.tags || '[]') : [];
    const personTag = `person:${data.personName}`;
    if (!tags.includes(personTag)) {
      tags.push(personTag);
      db.prepare('UPDATE finance_transactions SET tags = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?')
        .run(JSON.stringify(tags), data.txnId);
    }

    return { success: true };
  } catch (err) {
    console.error('[finance] attribute transaction error:', err);
    return { success: false, error: String(err) };
  }
});

// Remove person attribution from a transaction
ipcMain.handle('finance:unattribute-transaction', async (_event, data: { txnId: number; personName: string; walletId: number }) => {
  if (!db) return { success: false };
  try {
    const txn = db.prepare('SELECT id, amount, type, tags FROM finance_transactions WHERE id = ?').get(data.txnId) as any;
    if (!txn) return { success: false };

    const amount = Math.abs(txn.amount);
    const isIncome = txn.type === 'income';

    // Update person balance (subtract the attribution)
    const existing = db.prepare('SELECT id, total_paid, total_spent FROM finance_person_balances WHERE wallet_id = ? AND person_name = ?').get(data.walletId, data.personName) as any;
    if (existing) {
      const newPaid = existing.total_paid - (isIncome ? amount : 0);
      const newSpent = existing.total_spent - (!isIncome ? amount : 0);
      if (newPaid <= 0 && newSpent <= 0) {
        db.prepare('DELETE FROM finance_person_balances WHERE id = ?').run(existing.id);
      } else {
        db.prepare('UPDATE finance_person_balances SET total_paid = ?, total_spent = ?, net_balance = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?')
          .run(newPaid, newSpent, newPaid - newSpent, existing.id);
      }
    }

    // Remove person tag from transaction
    const tags = txn.tags ? JSON.parse(txn.tags || '[]') : [];
    const personTag = `person:${data.personName}`;
    const newTags = tags.filter((t: string) => t !== personTag);
    db.prepare('UPDATE finance_transactions SET tags = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?')
      .run(JSON.stringify(newTags), data.txnId);

    return { success: true };
  } catch (err) {
    console.error('[finance] unattribute transaction error:', err);
    return { success: false };
  }
});

// Get all unique person names used in a wallet's transactions
ipcMain.handle('finance:get-persons-in-wallet', async (_event, walletId: number) => {
  if (!db) return [];
  try {
    const txns = db.prepare('SELECT tags FROM finance_transactions WHERE wallet_id = ? AND tags IS NOT NULL').all(walletId) as any[];
    const persons = new Set<string>();
    for (const txn of txns) {
      try {
        const tags = JSON.parse(txn.tags || '[]');
        for (const tag of tags) {
          if (tag.startsWith('person:')) persons.add(tag.slice(7));
        }
      } catch {}
    }
    return Array.from(persons).sort();
  } catch { return []; }
});

// ========== Derived Expense Helper ==========
function computeDerivedExpenseByWallet(database: any): Map<number, number> {
  const wallets = database.prepare("SELECT id, initial_balance, balance FROM finance_wallets WHERE is_archived = 0").all() as Array<{ id: number; initial_balance: number; balance: number }>;
  const result = new Map<number, number>();
  for (const w of wallets) {
    const initBal = financeDataKey && isEncrypted(String(w.initial_balance)) ? Number(decryptField(String(w.initial_balance), financeDataKey)) || 0 : Number(w.initial_balance) || 0;
    const curBal = financeDataKey && isEncrypted(String(w.balance)) ? Number(decryptField(String(w.balance), financeDataKey)) || 0 : Number(w.balance) || 0;
    result.set(w.id, Math.max(0, initBal - curBal));
  }
  return result;
}

// ========== Balance Recalculation ==========
// Extracted helper so delete-wallet can reuse single-wallet recalculation
async function recalculateSingleWallet(walletId: number, preview?: boolean): Promise<any> {
  if (!db) return { success: false };
  const wallet = db.prepare('SELECT * FROM finance_wallets WHERE id = ?').get(walletId) as any;
  if (!wallet) return { error: 'Wallet not found' };

  const isCryptoWallet = wallet.type === 'crypto' || wallet.type === 'investment';
  const isPhysicalWallet = wallet.type === 'physical' || wallet.type === 'cash';

  // Fetch ALL transactions sorted by date, time, id (strict chronological)
  const txns = db.prepare('SELECT * FROM finance_transactions WHERE wallet_id = ? ORDER BY date ASC, time ASC, id ASC').all(walletId) as any[];

  // Find the "initial" transaction (description contains "initial", is_adjustment=1)
  const initialTxIdx = txns.findIndex(t => {
    if (t.is_adjustment !== 1) return false;
    const desc = financeDataKey && t.description && isEncrypted(t.description) ? decryptField(t.description, financeDataKey) : (t.description || '');
    return /initial/i.test(desc);
  });

  let startingBalance = 0;
  let breakdown: any[] = [];
  let processedTxns = [...txns];

  if (initialTxIdx >= 0) {
    const initialTx = txns[initialTxIdx];
    const initialAmt = financeDataKey && isEncrypted(initialTx.amount) ? Number(decryptField(String(initialTx.amount), financeDataKey)) || 0 : Number(initialTx.amount) || 0;
    startingBalance = Math.abs(initialAmt);
    const desc = financeDataKey && initialTx.description && isEncrypted(initialTx.description) ? decryptField(initialTx.description, financeDataKey) : (initialTx.description || 'Initial Balance');
    breakdown.push({
      transactionId: initialTx.id, description: desc,
      amount: startingBalance, date: initialTx.date, type: 'income',
      runningBalance: startingBalance, is_adjustment: 1,
    });
    processedTxns.splice(initialTxIdx, 1);
  } else {
    // Fallback to wallet.initial_balance
    const rawInitBal = wallet.initial_balance || 0;
    startingBalance = financeDataKey && isEncrypted(rawInitBal) ? Number(decryptField(String(rawInitBal), financeDataKey)) || 0 : Number(rawInitBal) || 0;
    breakdown.push({
      transactionId: 0, description: 'Initial Balance (from wallet)',
      amount: startingBalance, date: wallet.created_at?.slice(0, 10) || todayStr(), type: 'income',
      runningBalance: startingBalance, is_adjustment: 1,
    });
  }

  // Process remaining transactions
  let balance = startingBalance;
  const assetsMap = new Map<string, any>();
  let walletMeta: any = {};
  if (wallet.metadata) {
    try {
      const raw = financeDataKey && isEncrypted(wallet.metadata) ? decryptField(String(wallet.metadata), financeDataKey) : wallet.metadata;
      walletMeta = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch { walletMeta = {}; }
  }

  for (const t of processedTxns) {
    let tMeta: any = null;
    if (t.metadata) {
      try {
        const raw = financeDataKey && isEncrypted(t.metadata) ? decryptField(String(t.metadata), financeDataKey) : t.metadata;
        tMeta = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch { tMeta = null; }
    }
    const isCryptoTxn = tMeta && (tMeta.coinId || tMeta.coin_id) && tMeta.qty != null;
    const txnDesc = financeDataKey && t.description && isEncrypted(t.description) ? decryptField(t.description, financeDataKey) : (t.description || `Transaction #${t.id}`);
    const txnAmt = financeDataKey && isEncrypted(t.amount) ? Number(decryptField(String(t.amount), financeDataKey)) || 0 : Number(t.amount) || 0;

    let isCryptoToCrypto = false;
    if (isCryptoWallet && isCryptoTxn && t.type === 'transfer') {
      const partnerId = t.from_wallet_id === walletId ? t.to_wallet_id : t.from_wallet_id;
      if (partnerId) {
        const partner = db.prepare('SELECT type FROM finance_wallets WHERE id = ?').get(partnerId) as any;
        if (partner && (partner.type === 'crypto' || partner.type === 'investment')) isCryptoToCrypto = true;
      }
    }

    if (isCryptoWallet && isCryptoTxn) {
      const coinId = tMeta.coinId || tMeta.coin_id;
      let delta = Number(tMeta.qty) || 0;
      if (t.type === 'income' || (t.type === 'transfer' && t.amount < 0)) delta = -Math.abs(delta);
      else delta = Math.abs(delta);

      if (!assetsMap.has(coinId)) {
        assetsMap.set(coinId, { coin_id: coinId, symbol: tMeta.symbol || '', name: tMeta.name || '', amount: 0, avg_buy_price: 0, total_cost: 0 });
      }
      const asset = assetsMap.get(coinId);
      const oldQty = asset.amount;
      const newQty = oldQty + delta;
      if (delta > 0) {
        const cost = delta * (Number(tMeta.price) || 0);
        asset.total_cost = (asset.total_cost || 0) + cost;
        if (newQty > 0) asset.avg_buy_price = asset.total_cost / newQty;
      }
      asset.amount = newQty;

      if (!isCryptoToCrypto) {
        if (t.type === 'income') balance += Math.abs(txnAmt);
        else if (t.type === 'expense') balance -= Math.abs(txnAmt);
        else if (t.type === 'transfer') {
          if (t.amount < 0) { balance -= Math.abs(txnAmt); balance -= (t.fee || 0); }
          else balance += Math.abs(txnAmt);
        }
      }
      breakdown.push({ transactionId: t.id, description: txnDesc, amount: txnAmt, date: t.date, type: t.type, runningBalance: balance, is_adjustment: t.is_adjustment, cryptoQty: delta, cryptoSymbol: tMeta.symbol || '' });
      if (isCryptoToCrypto) continue;
    } else {
      if (t.type === 'income') balance += Math.abs(txnAmt);
      else if (t.type === 'expense') balance -= Math.abs(txnAmt);
      else if (t.type === 'transfer') {
        if (t.amount < 0) { balance -= Math.abs(txnAmt); balance -= (t.fee || 0); }
        else balance += Math.abs(txnAmt);
      }

      // Track denomination changes for physical wallets
      let denomsUsed: Record<number, number> | undefined;
      let changeKept: number | undefined;
      if (isPhysicalWallet && tMeta) {
        if (tMeta.denomination_after) {
          walletMeta.denominations = tMeta.denomination_after;
        }
        if (tMeta.denominations) denomsUsed = tMeta.denominations;
        if (tMeta.change_kept !== undefined) changeKept = tMeta.change_kept;
      }

      breakdown.push({ transactionId: t.id, description: txnDesc, amount: txnAmt, date: t.date, type: t.type, runningBalance: balance, is_adjustment: t.is_adjustment, ...(denomsUsed ? { denomsUsed, changeKept } : {}) });
    }
  }

  const newWalBal = balance;
  const rawOldBal = (db.prepare('SELECT balance FROM finance_wallets WHERE id = ?').get(walletId) as any)?.balance ?? 0;
  const oldWalBal = financeDataKey && isEncrypted(rawOldBal) ? Number(decryptField(String(rawOldBal), financeDataKey)) || 0 : Number(rawOldBal) || 0;

  // Reconstruct metadata.assets for crypto wallets
  let metaToWrite: string | null = null;
  if (isCryptoWallet) {
    walletMeta.assets = Array.from(assetsMap.values())
      .filter(a => a.amount > 0.00000001)
      .map(a => ({ coin_id: a.coin_id, symbol: a.symbol, name: a.name, amount: a.amount, avg_buy_price: a.avg_buy_price, asset_type: 'crypto' }));
    const jsonPlain = JSON.stringify(walletMeta);
    metaToWrite = financeDataKey ? encryptField(jsonPlain, financeDataKey) : jsonPlain;
  } else if (isPhysicalWallet) {
    const jsonPlain = JSON.stringify(walletMeta);
    metaToWrite = financeDataKey ? encryptField(jsonPlain, financeDataKey) : jsonPlain;
  }

  if (!preview) {
    const balToWrite = financeDataKey ? encryptField(String(newWalBal), financeDataKey) : String(newWalBal);
    if (metaToWrite) {
      db.prepare("UPDATE finance_wallets SET balance = ?, metadata = ?, updated_at = datetime('now','localtime') WHERE id = ?").run(balToWrite, metaToWrite, walletId);
    } else {
      db.prepare("UPDATE finance_wallets SET balance = ?, updated_at = datetime('now','localtime') WHERE id = ?").run(balToWrite, walletId);
    }
    recordWalletSnapshot(walletId, newWalBal);

    // Recalculate account balance
    const acctTxns = db.prepare("SELECT amount FROM finance_transactions WHERE account_id = ? AND NOT (type = 'transfer' AND metadata IS NOT NULL AND (json_extract(metadata, '$.coinId') IS NOT NULL OR json_extract(metadata, '$.coin_id') IS NOT NULL))").all(wallet.account_id) as any[];
    let acctBalSum = 0;
    for (const t of acctTxns) {
      acctBalSum += financeDataKey && isEncrypted(t.amount) ? Number(decryptField(String(t.amount), financeDataKey)) || 0 : Number(t.amount) || 0;
    }
    const acctInitRows = db.prepare('SELECT initial_balance FROM finance_wallets WHERE account_id = ?').all(wallet.account_id) as any[];
    let initBal = 0;
    for (const ir of acctInitRows) {
      initBal += financeDataKey && isEncrypted(ir.initial_balance) ? Number(decryptField(String(ir.initial_balance), financeDataKey)) || 0 : Number(ir.initial_balance) || 0;
    }
    const newAcctBal = initBal + acctBalSum;
    const encAcctBal = financeDataKey ? encryptField(enc(newAcctBal), financeDataKey) : String(newAcctBal);
    db.prepare("UPDATE finance_accounts SET balance = ?, updated_at = datetime('now','localtime') WHERE id = ?").run(encAcctBal, wallet.account_id);
    logAuditEvent('balance_recalculated', 'wallet', walletId, `Recalculated wallet ${walletId} balance: ${oldWalBal} → ${newWalBal}`, { wallet_id: walletId, old_balance: oldWalBal, new_balance: newWalBal, account_id: wallet.account_id });
  }

  return { success: true, breakdown, walletName: wallet.name, initialBalance: startingBalance, oldBalance: oldWalBal, newBalance: newWalBal };
}

ipcMain.handle('finance:recalculate-balances', async (_event, walletId?: number, preview?: boolean) => {
  if (!db) return { success: false };
  try {
    if (walletId) {
      return await recalculateSingleWallet(walletId, preview);
    } else {
      // ── Retroactively apply fees to old transfers that never had them ──
      try {
        const feeCat = db.prepare("SELECT id FROM finance_categories WHERE name = 'Transfer Fee' AND type = 'expense' LIMIT 1").get() as any;
        const feeCatId = feeCat?.id;
        if (feeCatId) {
          const orphans = db.prepare(`
            SELECT DISTINCT t.transfer_id, t.from_wallet_id, t.to_wallet_id, t.account_id, t.amount, t.date, t.time,
              (SELECT name FROM finance_wallets WHERE id = t.from_wallet_id) as from_wallet_name,
              (SELECT name FROM finance_wallets WHERE id = t.to_wallet_id) as to_wallet_name
            FROM finance_transactions t
            WHERE t.type = 'transfer' AND t.amount < 0 AND t.transfer_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM finance_transactions f WHERE f.transfer_id = t.transfer_id AND f.type = 'expense' AND f.category_id = ?)
          `).all(feeCatId) as any[];
          if (orphans.length > 0) {
            console.log(`[finance] Found ${orphans.length} old transfers missing fee transactions`);
            const insFee = db.prepare(`
              INSERT INTO finance_transactions (account_id, wallet_id, category_id, type, amount, description, note, "date", "time", transfer_id, from_wallet_id, to_wallet_id, on_behalf_of, on_behalf_of_label)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)
            `);
            let feeCount = 0;
            for (const tx of orphans) {
              const srcW = db.prepare('SELECT transfer_fee_type, transfer_fee_value FROM finance_wallets WHERE id = ?').get(tx.from_wallet_id) as any;
              const feeType = srcW?.transfer_fee_type || 'none';
              const feeVal = Number(srcW?.transfer_fee_value) || 0;
              if (feeType === 'none' || feeVal <= 0) continue;
              const baseAmt = Math.abs(tx.amount);
              const feeAmt = feeType === 'percentage' ? (baseAmt * feeVal / 100) : feeVal;
              if (feeAmt <= 0) continue;
              const feeDesc = `Transfer fee${feeType === 'percentage' ? ` (${feeVal}%)` : ''}`;
              const feeNote = `Auto-charged for transfer ${tx.transfer_id} (${tx.from_wallet_name || tx.from_wallet_id} → ${tx.to_wallet_name || tx.to_wallet_id})`;
              insFee.run(tx.account_id, tx.from_wallet_id, feeCatId, 'expense', -feeAmt, feeDesc, feeNote, tx.date, tx.time || null, tx.transfer_id, tx.from_wallet_id, tx.to_wallet_id);
              feeCount++;
            }
            if (feeCount > 0) {
              console.log(`[finance] Created ${feeCount} retroactive fee transactions`);
              logAuditEvent('retroactive_fees_applied', 'transfer', null, `Applied ${feeCount} retroactive transfer fees across ${orphans.length} eligible transfers`, {
                total_eligible: orphans.length, created: feeCount
              });
            }
          }
        }
      } catch (e: any) { console.error('[finance] retroactive fee error:', e); }

      const wallets = db.prepare('SELECT id, account_id, type, balance, COALESCE(initial_balance, 0) as init_bal FROM finance_wallets').all() as any[];
      for (const w of wallets) {
        const rawInit = w.init_bal || 0;
        const initBal = financeDataKey && isEncrypted(rawInit) ? Number(decryptField(String(rawInit), financeDataKey)) || 0 : Number(rawInit) || 0;
        const txnRows = db.prepare('SELECT amount, type, metadata FROM finance_transactions WHERE wallet_id = ? ORDER BY date ASC, sort_order ASC, id ASC').all(w.id) as any[];
        const wIsCrypto = w.type === 'crypto' || w.type === 'investment';
        let running = initBal;
        for (const t of txnRows) {
          const amt = financeDataKey && isEncrypted(t.amount) ? Number(decryptField(String(t.amount), financeDataKey)) || 0 : Number(t.amount) || 0;
          // Skip crypto transfers — they don't affect fiat balance
          if (wIsCrypto && t.type === 'transfer' && t.metadata) {
            try {
              const m = typeof t.metadata === 'string' ? JSON.parse(t.metadata) : t.metadata;
              if (m.coinId || m.coin_id) continue;
            } catch { /* not crypto metadata */ }
          }
          if (t.type === 'income') running += Math.abs(amt);
          else if (t.type === 'expense') running -= Math.abs(amt);
          else running += amt;
        }
        const encNewBal = financeDataKey ? encryptField(enc(running), financeDataKey) : String(running);
        db.prepare("UPDATE finance_wallets SET balance = ?, updated_at = datetime('now','localtime') WHERE id = ?").run(encNewBal, w.id);
      }
      const accounts = db.prepare('SELECT id FROM finance_accounts').all() as any[];
      for (const a of accounts) {
        const acctTxns = db.prepare("SELECT amount, type FROM finance_transactions WHERE account_id = ? AND NOT (type = 'transfer' AND metadata IS NOT NULL AND (json_extract(metadata, '$.coinId') IS NOT NULL OR json_extract(metadata, '$.coin_id') IS NOT NULL))").all(a.id) as any[];
        let acctSum = 0;
        for (const t of acctTxns) {
          const amt = financeDataKey && isEncrypted(t.amount) ? Number(decryptField(String(t.amount), financeDataKey)) || 0 : Number(t.amount) || 0;
          acctSum += amt;
        }
        const acctInitRows = db.prepare('SELECT COALESCE(SUM(initial_balance), 0) as ibal FROM finance_wallets WHERE account_id = ?').get(a.id) as any;
        const rawInit = acctInitRows?.ibal || 0;
        const initBal = financeDataKey && isEncrypted(rawInit) ? Number(decryptField(String(rawInit), financeDataKey)) || 0 : Number(rawInit) || 0;
        const newAcctBal = initBal + acctSum;
        const encAcctBal = financeDataKey ? encryptField(enc(newAcctBal), financeDataKey) : String(newAcctBal);
        db.prepare("UPDATE finance_accounts SET balance = ?, updated_at = datetime('now','localtime') WHERE id = ?").run(encAcctBal, a.id);
      }
      // Backfill crypto asset history for all wallets
      try {
        db.prepare('DELETE FROM crypto_asset_history').run();
        const cryptoWallets = db.prepare("SELECT id, metadata FROM finance_wallets WHERE type = 'crypto' OR type = 'investment'").all() as any[];
        const priceRows = db.prepare('SELECT coin_id, current_price FROM finance_crypto_prices').all() as any[];
        const priceMap = new Map(priceRows.map((r: any) => [r.coin_id.toLowerCase(), Number(r.current_price) || 0]));
        for (const cw of cryptoWallets) {
          if (!cw.metadata) continue;
          let meta: any = {};
          try {
            const raw = financeDataKey && isEncrypted(cw.metadata) ? decryptField(String(cw.metadata), financeDataKey) : cw.metadata;
            meta = typeof raw === 'string' ? JSON.parse(raw) : raw;
          } catch { continue; }
          const assets: any[] = Array.isArray(meta.assets) ? meta.assets : [];
          for (const a of assets) {
            const cid = String(a.coin_id || a.coinId || a.asset || '').toLowerCase();
            if (!cid) continue;
            const amt = Number(a.amount) || 0;
            const avg = Number(a.avg_buy_price || a.avgBuyPrice) || 0;
            const curPrice = priceMap.get(cid) || avg;
            recordCryptoAssetHistory(cw.id, cid, amt, avg, curPrice);
          }
        }
        console.log(`[finance] Backfilled crypto asset history for ${cryptoWallets.length} wallets`);
      } catch (e: any) { console.error('[finance] Crypto history backfill error:', e?.message); }
      logAuditEvent('all_balances_recalculated', 'wallet', null, `Recalculated all ${wallets.length} wallets and ${accounts.length} accounts`, {
        wallet_count: wallets.length, account_count: accounts.length
      });
    }
    return { success: true };
  } catch (e: any) { console.error('[finance] recalculate error:', e); return { success: false }; }
});

// ── Fix historical transaction dates to 1900-01-01 ──
ipcMain.handle('finance:fix-historical-dates', async () => {
  if (!db) return { success: false, fixed: 0 };
  try {
    const result = db.prepare("UPDATE finance_transactions SET date = '1900-01-01' WHERE is_adjustment = 1 AND date != '1900-01-01'").run();
    const fixed = result.changes;
    if (fixed > 0) {
      logAuditEvent('fix_historical_dates', 'transaction', null, `Fixed ${fixed} historical transaction dates to 1900-01-01`, { fixed_count: fixed });
    }
    return { success: true, fixed };
  } catch (e: any) {
    console.error('[finance] fix-historical-dates error:', e?.message);
    return { success: false, fixed: 0 };
  }
});

// Apply computed balance — same logic as preview but writes to DB
ipcMain.handle('finance:apply-recalculated-balance', async (_event, walletId: number) => {
  if (!db) return { error: 'No database' };
  try {
    // Simply call recalculateSingleWallet with preview=false — same logic as preview
    const result = await recalculateSingleWallet(walletId, false);
    return result;
  } catch (e: any) {
    console.error('[finance] apply-recalculated-balance error:', e.message);
    return { error: e.message };
  }
});

// ========== Update Transaction Sort Order (for historical reordering) ==========
ipcMain.handle('finance:update-transaction-sort-order', async (_event, updates: { id: number; sort_order: number }[]) => {
  if (!db) return { success: false };
  try {
    const stmt = db.prepare('UPDATE finance_transactions SET sort_order = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?');
    const updateMany = db.transaction((rows: { id: number; sort_order: number }[]) => {
      for (const row of rows) {
        stmt.run(row.sort_order, row.id);
      }
    });
    updateMany(updates);
    return { success: true };
  } catch (e: any) {
    console.error('[finance] update-transaction-sort-order error:', e.message);
    return { success: false, error: e.message };
  }
});

// ========== Audit Log IPC Handlers ==========
ipcMain.handle('audit:list', async (_event, { limit = 50, offset = 0, entity_type, entity_id }: { limit?: number; offset?: number; entity_type?: string; entity_id?: number }) => {
  if (!db) return { rows: [], total: 0 };
  try {
    let query = 'SELECT id, event_type, entity_type, entity_id, description, created_at FROM audit_log';
    let countQuery = 'SELECT COUNT(*) as count FROM audit_log';
    const params: any[] = [];
    const countParams: any[] = [];
    const conditions: string[] = [];
    if (entity_type) { conditions.push('entity_type = ?'); params.push(entity_type); countParams.push(entity_type); }
    if (entity_id !== undefined) { conditions.push('entity_id = ?'); params.push(entity_id); countParams.push(entity_id); }
    if (conditions.length) {
      const where = ' WHERE ' + conditions.join(' AND ');
      query += where;
      countQuery += where;
    }
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const rows = db.prepare(query).all(...params);
    const { count } = db.prepare(countQuery).get(...countParams) as any;
    return { rows, total: count };
  } catch (e: any) { console.error('[audit:list]', e?.message); return { rows: [], total: 0 }; }
});

ipcMain.handle('audit:get', async (_event, id: number) => {
  if (!db) return null;
  try {
    const row = db.prepare('SELECT * FROM audit_log WHERE id = ?').get(id) as any;
    if (!row) return null;
    if (row.encrypted_data && row.iv && row.auth_tag) {
      row.decrypted_data = decryptAuditData(row.encrypted_data, row.iv, row.auth_tag);
    }
    return row;
  } catch { return null; }
});

ipcMain.handle('audit:get-for-entity', async (_event, entityType: string, entityId: number, limit = 20) => {
  if (!db) return [];
  try {
    const rows = db.prepare(`
      SELECT id, event_type, entity_type, entity_id, description, created_at FROM audit_log
      WHERE entity_type = ? AND entity_id = ?
      ORDER BY created_at DESC LIMIT ?
    `).all(entityType, entityId, limit) as any[];
    return rows;
  } catch { return []; }
});

// ========== Finance Dashboard Enhancement Handlers ==========

// FEATURE 1: Crypto-Fiat Unified Portfolio
ipcMain.handle('finance:get-crypto-unified-portfolio', async (_event, walletId: number) => {
  if (!db) return { success: false, error: 'Database not ready' };
  try {
    const wallet = db.prepare(`
      SELECT id, name, balance, currency, metadata, type
      FROM finance_wallets WHERE id = ? AND (type = 'crypto' OR type = 'investment') AND is_archived = 0
    `).get(walletId) as { id: number; name: string; balance: number; currency: string; metadata: string | null } | undefined;
    if (!wallet) return { success: false, error: 'Crypto wallet not found' };
    let assets: Array<{ coin_id: string; symbol: string; name: string; amount: number; avg_buy_price: number; current_price?: number }> = [];
    if (wallet.metadata) {
      try {
        const raw = isEncrypted(wallet.metadata) ? decryptField(String(wallet.metadata), financeDataKey) : wallet.metadata;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        assets = parsed?.assets || [];
      } catch { assets = []; }
    }
    const coinIds = assets.map(a => a.coin_id).filter(Boolean);
    let prices: Record<string, number> = {};
    if (coinIds.length > 0) {
      try {
        const ids = coinIds.join(',');
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
        const resp = await fetch(url);
        if (resp.ok) { const data = await resp.json() as Record<string, { usd: number }>; for (const [k, v] of Object.entries(data)) { if (v?.usd) prices[k] = v.usd; } }
      } catch { /* fallback to stored prices */ }
    }
    let cryptoPortfolioValue = 0, costBasis = 0;
    const enrichedAssets = [];
    for (const asset of assets) {
      const currentPrice = prices[asset.coin_id] || asset.current_price || asset.avg_buy_price;
      const assetValue = asset.amount * currentPrice;
      const assetCost = asset.amount * asset.avg_buy_price;
      cryptoPortfolioValue += assetValue; costBasis += assetCost;
      enrichedAssets.push({ ...asset, current_price: currentPrice, value: Math.round(assetValue * 100) / 100, cost_basis: Math.round(assetCost * 100) / 100, pnl: Math.round((assetValue - assetCost) * 100) / 100, pnl_percentage: assetCost > 0 ? Math.round(((assetValue - assetCost) / assetCost) * 10000) / 100 : 0 });
    }
    const fiatBalance = wallet.balance;
    const totalValue = fiatBalance + cryptoPortfolioValue;
    const unrealizedPnL = cryptoPortfolioValue - costBasis;
    return { success: true, data: { walletId: wallet.id, walletName: wallet.name, currency: wallet.currency, fiatBalance: Math.round(fiatBalance * 100) / 100, cryptoPortfolioValue: Math.round(cryptoPortfolioValue * 100) / 100, totalValue: Math.round(totalValue * 100) / 100, costBasis: Math.round(costBasis * 100) / 100, unrealizedPnL: Math.round(unrealizedPnL * 100) / 100, pnlPercentage: costBasis > 0 ? Math.round((unrealizedPnL / costBasis) * 10000) / 100 : 0, fiatAllocation: totalValue > 0 ? Math.round((fiatBalance / totalValue) * 10000) / 100 : 0, cryptoAllocation: totalValue > 0 ? Math.round((cryptoPortfolioValue / totalValue) * 10000) / 100 : 0, assets: enrichedAssets } };
  } catch (error) { console.error('Error in finance:get-crypto-unified-portfolio:', error); return { success: false, error: String(error) }; }
});

// FEATURE 2: Liquidity Waterfall Breakdown
ipcMain.handle('finance:get-liquidity-breakdown', async () => {
  if (!db) return { success: false, error: 'Database not ready' };
  try {
    const tiers = [
      { name: 'Immediate', types: ['cash', 'physical', 'ewallet', 'prepaid_card'], color: '#10b981', icon: 'cash' },
      { name: 'Same Day', types: ['bank', 'debit_card'], color: '#3b82f6', icon: 'bank' },
      { name: '1-3 Days', types: ['credit_card', 'other'], color: '#f59e0b', icon: 'credit' },
      { name: 'Locked', types: ['crypto'], color: '#8b5cf6', icon: 'lock' },
    ];
    const wallets = db.prepare('SELECT id, name, type, balance, currency, metadata FROM finance_wallets WHERE is_archived = 0 ORDER BY balance DESC').all() as Array<{ id: number; name: string; type: string; balance: number; currency: string; metadata: string | null }>;
    const tierData: any[] = [];
    let totalNetWorth = 0;
    for (const tier of tiers) {
      const tierWallets = wallets.filter(w => tier.types.includes(w.type));
      let tierAmount = 0;
      const walletDetails: any[] = [];
      for (const w of tierWallets) { tierAmount += w.balance; walletDetails.push({ id: w.id, name: w.name, balance: Math.round(w.balance * 100) / 100, currency: w.currency }); }
      totalNetWorth += tierAmount;
      tierData.push({ name: tier.name, amount: Math.round(tierAmount * 100) / 100, color: tier.color, icon: tier.icon, wallets: walletDetails, percentage: 0 });
    }
    for (const tier of tierData) { tier.percentage = totalNetWorth > 0 ? Math.round((tier.amount / totalNetWorth) * 10000) / 100 : 0; }
    const liquidAmount = (tierData[0]?.amount || 0) + (tierData[1]?.amount || 0);
    const liquidityScore = totalNetWorth > 0 ? Math.round((liquidAmount / totalNetWorth) * 10000) / 100 : 0;
    const transferSpeeds = db.prepare(`
      SELECT fw1.name as from_wallet, fw2.name as to_wallet,
        AVG((julianday(t2.date) - julianday(t1.date)) * 24 * 60) as avg_minutes
      FROM finance_transactions t1
      JOIN finance_transactions t2 ON t1.transfer_id = t2.transfer_id
      JOIN finance_wallets fw1 ON t1.from_wallet_id = fw1.id
      JOIN finance_wallets fw2 ON t2.to_wallet_id = fw2.id
      WHERE t1.type = 'transfer' AND t1.amount < 0 AND t2.type = 'transfer' AND t2.amount > 0 AND t1.transfer_id IS NOT NULL
      GROUP BY fw1.name, fw2.name HAVING avg_minutes IS NOT NULL ORDER BY avg_minutes ASC LIMIT 20
    `).all() as Array<{ from_wallet: string; to_wallet: string; avg_minutes: number }>;
    return { success: true, data: { tiers: tierData, totalNetWorth: Math.round(totalNetWorth * 100) / 100, liquidityScore, liquidAmount: Math.round(liquidAmount * 100) / 100, lockedAmount: Math.round((totalNetWorth - liquidAmount) * 100) / 100, transferSpeeds: transferSpeeds.map(s => ({ from: s.from_wallet, to: s.to_wallet, avgMinutes: Math.round(s.avg_minutes * 100) / 100 })) } };
  } catch (error) { console.error('Error in finance:get-liquidity-breakdown:', error); return { success: false, error: String(error) }; }
});

// FEATURE 3: Subscription Intelligence
ipcMain.handle('finance:get-subscription-intelligence', async () => {
  if (!db) return { success: false, error: 'Database not ready' };
  try {
    const BILLING_DAYS: Record<string, number> = { daily: 1, weekly: 7, monthly: 30.44, quarterly: 91.31, yearly: 365.25 };
    const subscriptions = db.prepare("SELECT id, name, price, currency, billing_cycle, billing_interval, next_renewal_date, status, cancel_reminder_days FROM finance_subscriptions WHERE status = 'active' ORDER BY next_renewal_date ASC").all() as Array<{ id: number; name: string; price: number; currency: string; billing_cycle: string; billing_interval: number; next_renewal_date: string; status: string; cancel_reminder_days: number }>;
    let totalMonthlyCost = 0;
    const subDetails: any[] = [];
    for (const sub of subscriptions) {
      const days = BILLING_DAYS[sub.billing_cycle] || (sub.billing_interval * 30.44);
      const monthlyEquivalent = (sub.price / days) * 30.44;
      totalMonthlyCost += monthlyEquivalent;
      const nextRenewal = new Date(sub.next_renewal_date);
      const today = new Date();
      const daysUntil = Math.ceil((nextRenewal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      subDetails.push({ id: sub.id, name: sub.name, price: sub.price, currency: sub.currency, billingCycle: sub.billing_cycle, monthlyEquivalent: Math.round(monthlyEquivalent * 100) / 100, nextRenewalDate: sub.next_renewal_date, daysUntilRenewal: daysUntil, isUrgent: daysUntil <= 7, isWarning: daysUntil <= sub.cancel_reminder_days && daysUntil > 7 });
    }
    const incomeRow = db.prepare("SELECT COALESCE(AVG(monthly_total), 0) as avg_income FROM (SELECT strftime('%Y-%m', date) as month, SUM(amount) as monthly_total FROM finance_transactions WHERE type = 'transfer' AND amount > 0 AND (is_adjustment IS NULL OR is_adjustment = 0) GROUP BY month ORDER BY month DESC LIMIT 3)").get() as { avg_income: number };
    const monthlyIncome = Number(incomeRow.avg_income);
    const burdenPercentage = monthlyIncome > 0 ? (totalMonthlyCost / monthlyIncome) * 100 : 0;
    const upcomingRenewals = subDetails.filter(s => s.daysUntilRenewal <= 30);
    const urgentRenewals = upcomingRenewals.filter(s => s.isUrgent);
    const radarData = { axes: ['Burden %', 'Growth Trend', 'Upcoming', 'Cancellation Opp', 'Price/Value'], values: [Math.min(100, burdenPercentage), 0, Math.min(100, upcomingRenewals.length * 10), Math.min(100, subscriptions.length * 5), 50], colors: ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6'] };
    return { success: true, data: { totalMonthlyCost: Math.round(totalMonthlyCost * 100) / 100, burdenPercentage: Math.round(burdenPercentage * 100) / 100, monthlyIncome: Math.round(monthlyIncome * 100) / 100, subscriptionCount: subscriptions.length, growthTrend: 0, upcomingRenewals: upcomingRenewals.length, urgentRenewals: urgentRenewals.length, radarData, subscriptions: subDetails } };
  } catch (error) { console.error('Error in finance:get-subscription-intelligence:', error); return { success: false, error: String(error) }; }
});

// FEATURE 4: Cash Flow Runway
ipcMain.handle('finance:get-cashflow-runway', async () => {
  if (!db) return { success: false, error: 'Database not ready' };
  try {
    const dailyExpenses = db.prepare("SELECT date, SUM(CASE WHEN amount != 0 THEN ABS(amount) ELSE 0 END) as daily_total FROM finance_transactions WHERE type = 'expense' AND (is_adjustment IS NULL OR is_adjustment = 0) AND date >= date('now', '-90 days') GROUP BY date ORDER BY date ASC").all() as Array<{ date: string; daily_total: number }>;
    const expenseValues = dailyExpenses.map(d => d.daily_total);
    const meanExpense = expenseValues.length > 0 ? expenseValues.reduce((a, b) => a + b, 0) / expenseValues.length : 0;
    const stdDev = expenseValues.length > 0 ? Math.sqrt(expenseValues.reduce((sq, n) => sq + Math.pow(n - meanExpense, 2), 0) / expenseValues.length) : 0;
    const filteredExpenses = expenseValues.filter(v => v <= meanExpense + 2 * stdDev);
    const dailyBurnRate = filteredExpenses.length > 0 ? filteredExpenses.reduce((a, b) => a + b, 0) / filteredExpenses.length : 0;
    const monthlyBurnRate = dailyBurnRate * 30.44;
    const liquidWallets = db.prepare("SELECT COALESCE(SUM(balance), 0) as total FROM finance_wallets WHERE is_archived = 0 AND type NOT IN ('crypto', 'credit_card')").get() as { total: number };
    const liquidNetWorth = Number(liquidWallets.total);
    const subs = db.prepare("SELECT price, billing_cycle, billing_interval FROM finance_subscriptions WHERE status = 'active'").all() as Array<{ price: number; billing_cycle: string; billing_interval: number }>;
    const BILLING_DAYS: Record<string, number> = { daily: 1, weekly: 7, monthly: 30.44, quarterly: 91.31, yearly: 365.25 };
    let committedMonthly = 0;
    for (const sub of subs) { const days = BILLING_DAYS[sub.billing_cycle] || (sub.billing_interval * 30.44); committedMonthly += (sub.price / days) * 30.44; }
    const totalMonthlyBurn = monthlyBurnRate + committedMonthly;
    const runwayMonths = totalMonthlyBurn > 0 ? liquidNetWorth / totalMonthlyBurn : 999;
    const projectedBalances = [];
    for (let month = 1; month <= 12; month++) { const projectedBalance = liquidNetWorth - (totalMonthlyBurn * month); projectedBalances.push({ month, projectedBalance: Math.round(projectedBalance * 100) / 100, isNegative: projectedBalance < 0 }); }
    const breakEvenMonth = projectedBalances.find(b => b.isNegative)?.month || null;
    const last30 = db.prepare("SELECT COALESCE(SUM(CASE WHEN amount != 0 THEN ABS(amount) ELSE 0 END), 0) as total FROM finance_transactions WHERE type = 'expense' AND (is_adjustment IS NULL OR is_adjustment = 0) AND date >= date('now', '-30 days')").get() as { total: number };
    const prev30 = db.prepare("SELECT COALESCE(SUM(CASE WHEN amount != 0 THEN ABS(amount) ELSE 0 END), 0) as total FROM finance_transactions WHERE type = 'expense' AND (is_adjustment IS NULL OR is_adjustment = 0) AND date >= date('now', '-60 days') AND date < date('now', '-30 days')").get() as { total: number };
    const trendDirection = prev30.total > 0 ? ((last30.total - prev30.total) / prev30.total) * 100 : 0;
    return { success: true, data: { runwayMonths: Math.round(runwayMonths * 100) / 100, dailyBurnRate: Math.round(dailyBurnRate * 100) / 100, monthlyBurnRate: Math.round(monthlyBurnRate * 100) / 100, committedMonthly: Math.round(committedMonthly * 100) / 100, totalMonthlyBurn: Math.round(totalMonthlyBurn * 100) / 100, liquidNetWorth: Math.round(liquidNetWorth * 100) / 100, breakEvenMonth, trendDirection: Math.round(trendDirection * 100) / 100, projectedBalances, dailyExpenseHistory: dailyExpenses.map(d => ({ date: d.date, amount: Math.round(d.daily_total * 100) / 100 })) } };
  } catch (error) { console.error('Error in finance:get-cashflow-runway:', error); return { success: false, error: String(error) }; }
});

// FEATURE 5: Wallet Health Scorecards
ipcMain.handle('finance:get-wallet-health', async () => {
  if (!db) return { success: false, error: 'Database not ready' };
  try {
    const wallets = db.prepare("SELECT id, name, type, balance, initial_balance, currency, transfer_fee_type, transfer_fee_value, metadata FROM finance_wallets WHERE is_archived = 0 ORDER BY balance DESC").all() as Array<{ id: number; name: string; type: string; balance: number; initial_balance: number; currency: string; transfer_fee_type: string; transfer_fee_value: number; metadata: string | null }>;
    const healthData: any[] = [];
    for (const wallet of wallets) {
      const txns = db.prepare("SELECT amount, fee, date, type, is_adjustment FROM finance_transactions WHERE wallet_id = ? AND date >= date('now', '-30 days') ORDER BY date DESC").all(wallet.id) as Array<{ amount: number; fee: number; date: string; type: string; is_adjustment: number | null }>;
      const txnCount = txns.length;
      const totalVolume = txns.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const totalFees = txns.reduce((sum, t) => sum + (t.fee || 0), 0);
      const feeBurden = totalVolume > 0 ? (totalFees / totalVolume) * 100 : 0;
      const expenseTotal = txns.reduce((sum, t) => sum + ((t.type === 'expense' && (t.is_adjustment == null || t.is_adjustment === 0)) ? Math.abs(t.amount) : 0), 0);
      const avgDailySpend = Math.round((expenseTotal / 30) * 100) / 100;
      const lastActivity = txns.length > 0 ? txns[0].date : null;
      const balanceDrift = wallet.initial_balance !== 0 ? ((wallet.balance - wallet.initial_balance) / Math.abs(wallet.initial_balance)) * 100 : 0;
      let driftScore = 0;
      if (wallet.type === 'credit_card') { driftScore = wallet.balance <= 0 ? Math.min(100, Math.abs(balanceDrift)) : Math.max(0, 100 - balanceDrift); }
      else if (wallet.type === 'crypto') { driftScore = 50; }
      else { driftScore = Math.max(0, 100 - Math.abs(balanceDrift)); }
      const frequencyScore = Math.min(100, txnCount * 10);
      const feeScore = Math.max(0, 100 - feeBurden * 5);
      const healthScore = Math.round((driftScore * 0.4) + (frequencyScore * 0.3) + (feeScore * 0.3));
      const balanceHistory = db.prepare("SELECT date, SUM(CASE WHEN type = 'income' OR (type = 'transfer' AND amount > 0) THEN amount WHEN type = 'expense' OR (type = 'transfer' AND amount < 0) THEN -ABS(amount) ELSE 0 END) as net_change FROM finance_transactions WHERE wallet_id = ? AND date >= date('now', '-30 days') GROUP BY date ORDER BY date ASC").all(wallet.id) as Array<{ date: string; net_change: number }>;
      let runningBalance = wallet.balance;
      const sparklineData = [];
      for (let i = balanceHistory.length - 1; i >= 0; i--) { sparklineData.unshift({ date: balanceHistory[i].date, balance: Math.round(runningBalance * 100) / 100 }); runningBalance -= balanceHistory[i].net_change; }
      const alerts: any[] = [];
      if ((wallet.type === 'physical' || wallet.type === 'cash') && wallet.metadata) {
        try { const meta = JSON.parse(wallet.metadata); const denoms = meta.denomination || meta.denominations || []; const calcTotal = denoms.reduce((s: number, d: any) => s + (d.value || 0) * (d.count || 0), 0); if (Math.abs(calcTotal - wallet.balance) > 0.01) alerts.push({ type: 'mismatch', message: `Denomination count (${calcTotal.toLocaleString()}) doesn't match balance (${wallet.balance.toLocaleString()})`, severity: 'warning' }); } catch { /* skip */ }
      }
      if (feeBurden > 5) alerts.push({ type: 'high_fees', message: `Fee burden is ${feeBurden.toFixed(1)}% of transaction volume`, severity: 'warning' });
      if (wallet.balance < 0 && wallet.type !== 'credit_card') alerts.push({ type: 'negative_balance', message: 'Wallet balance is negative', severity: 'critical' });
      healthData.push({ walletId: wallet.id, name: wallet.name, type: wallet.type, balance: Math.round(wallet.balance * 100) / 100, currency: wallet.currency, healthScore, balanceDrift: Math.round(balanceDrift * 100) / 100, transactionFrequency: Math.round((txnCount / 30) * 100) / 100, feeBurden: Math.round(feeBurden * 100) / 100, avgDailySpend, lastActivity, sparklineData, alerts });
    }
    const overallScore = healthData.length > 0 ? Math.round(healthData.reduce((s, w) => s + w.healthScore, 0) / healthData.length) : 0;
    const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0);
    return { success: true, data: { wallets: healthData, overallScore, totalBalance } };
  } catch (error) { console.error('Error in finance:get-wallet-health:', error); return { success: false, error: String(error) }; }
});

// FEATURE 6: Transfer Cost Matrix
ipcMain.handle('finance:get-transfer-cost-matrix', async () => {
  if (!db) return { success: false, error: 'Database not ready' };
  try {
    const wallets = db.prepare("SELECT id, name, type, transfer_fee_type, transfer_fee_value FROM finance_wallets WHERE is_archived = 0 ORDER BY name").all() as Array<{ id: number; name: string; type: string; transfer_fee_type: string; transfer_fee_value: number }>;
    const historicalTransfers = db.prepare("SELECT t1.from_wallet_id, t2.to_wallet_id, ABS(t1.amount) as transfer_amount, t1.fee as fee_paid, t1.date FROM finance_transactions t1 JOIN finance_transactions t2 ON t1.transfer_id = t2.transfer_id WHERE t1.type = 'transfer' AND t1.amount < 0 AND t1.transfer_id IS NOT NULL ORDER BY t1.date DESC").all() as Array<{ from_wallet_id: number; to_wallet_id: number; transfer_amount: number; fee_paid: number; date: string }>;
    const matrix: any[] = [];
    const optimalRoutes: any[] = [];
    const sampleAmount = 1000000;
    for (const fromWallet of wallets) {
      for (const toWallet of wallets) {
        if (fromWallet.id === toWallet.id) continue;
        let estimatedFee = 0;
        const feeType = fromWallet.transfer_fee_type || 'none';
        const feeValue = fromWallet.transfer_fee_value || 0;
        switch (feeType) { case 'fixed': estimatedFee = feeValue; break; case 'percentage': estimatedFee = sampleAmount * feeValue; break; case 'tiered': estimatedFee = feeValue; break; default: estimatedFee = 0; }
        const routeHistory = historicalTransfers.filter(t => t.from_wallet_id === fromWallet.id && t.to_wallet_id === toWallet.id);
        const historicalAvgFee = routeHistory.length > 0 ? routeHistory.reduce((sum, t) => sum + (t.fee_paid || 0), 0) / routeHistory.length : 0;
        const historicalAvgAmount = routeHistory.length > 0 ? routeHistory.reduce((sum, t) => sum + t.transfer_amount, 0) / routeHistory.length : 0;
        const efficiencyScore = historicalAvgAmount > 0 ? Math.max(0, 1 - (historicalAvgFee / historicalAvgAmount)) * 100 : (estimatedFee > 0 ? Math.max(0, 1 - (estimatedFee / sampleAmount)) * 100 : 100);
        matrix.push({ fromWalletId: fromWallet.id, fromWalletName: fromWallet.name, toWalletId: toWallet.id, toWalletName: toWallet.name, estimatedFee: Math.round(estimatedFee * 100) / 100, historicalAvgFee: Math.round(historicalAvgFee * 100) / 100, historicalAvgAmount: Math.round(historicalAvgAmount * 100) / 100, transferCount: routeHistory.length, efficiencyScore: Math.round(efficiencyScore * 100) / 100, feeType, feeValue });
      }
    }
    // Build optimal routes
    const seen = new Set<string>();
    for (const cell of matrix) {
      const key = `${cell.fromWalletId}-${cell.toWalletId}`;
      if (!seen.has(key)) { seen.add(key); optimalRoutes.push({ from: cell.fromWalletName, to: cell.toWalletName, path: [cell.fromWalletName, cell.toWalletName], totalFee: cell.estimatedFee, efficiencyScore: cell.efficiencyScore }); }
    }
    return { success: true, data: { matrix, optimalRoutes: optimalRoutes.sort((a: any, b: any) => b.efficiencyScore - a.efficiencyScore).slice(0, 10), walletCount: wallets.length } };
  } catch (error) { console.error('Error in finance:get-transfer-cost-matrix:', error); return { success: false, error: String(error) }; }
});

}
