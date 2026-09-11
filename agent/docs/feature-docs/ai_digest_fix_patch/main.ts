"use strict";
 var __importDefault = function (mod) {
        return (mod && mod.__importDefault) ? mod : { "default": mod };
    };
Object.defineProperty(exports, "__esModule", { value: true });
// Load environment variables from .env file
require('dotenv').config();
const electron_1 = require("electron");
// Set Windows App User Model ID so Task Manager groups/names the app as "DeskFlow" not "Electron"
electron_1.app.setAppUserModelId('com.deskflow.app');
const path_1 = __importDefault(require("path"));
const { pathToFileURL } = require('node:url');
const fs_1 = __importDefault(require("fs"));
const child_process_1 = require("child_process");
const active_win_1 = __importDefault(require("active-win"));
const http_1 = __importDefault(require("http"));
const ProblemsServiceModule = require("./services/ProblemsService.cjs");
const ProblemsService = ProblemsServiceModule.ProblemsService || ProblemsServiceModule;
const RequestsServiceModule = require("./services/RequestsService.cjs");
const RequestsService = RequestsServiceModule.RequestsService || RequestsServiceModule;
const SkillsServiceModule = require("./services/SkillsService.cjs");
const SkillsService = SkillsServiceModule.SkillsService || SkillsServiceModule;
const AgentHostServiceModule = require("./services/AgentHostService.cjs");
const { agentHostService } = AgentHostServiceModule.AgentHostService || AgentHostServiceModule;
const GameDetectionModule = require("./gameDetection.cjs");
const { resolveForegroundApp, buildInstalledGameIndex, rescanGames } = GameDetectionModule;

// --- Global shortcut for DevTools ---
const { globalShortcut } = require('electron');
electron_1.protocol.registerSchemesAsPrivileged([
    { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);
// --- Storage (SQLite with JSON fallback) ---
const userDataPath = electron_1.app.getPath('userData');
const dbPath = path_1.default.join(userDataPath, 'deskflow-data.db');
const jsonPath = path_1.default.join(userDataPath, 'deskflow-data.json');
const sleepStatePath = path_1.default.join(userDataPath, 'deskflow-sleep-state.json');
const sleepPatternPath = path_1.default.join(userDataPath, 'deskflow-sleep-pattern.json');
const windowStatePath = path_1.default.join(userDataPath, 'deskflow-window-state.json');
// --- Sleep tracking state (for morning prompt) ---
let lastCloseTime: number | null = null;
let lastCloseType: 'normal' | 'force' | null = null;
let lastFocusTime: number | null = null;

interface SleepPatternEntry {
  date: string;
  sleepStart: number;
  sleepEnd: number;
  durationMinutes: number;
}

function loadSleepPatterns(): SleepPatternEntry[] {
  try {
    if (fs_1.default.existsSync(sleepPatternPath)) {
      return JSON.parse(fs_1.default.readFileSync(sleepPatternPath, 'utf-8'));
    }
  } catch (err) { console.error('[DeskFlow] Failed to load sleep patterns:', err); }
  return [];
}

function saveSleepPattern(entry: SleepPatternEntry) {
  try {
    const patterns = loadSleepPatterns();
    patterns.push(entry);
    // Keep last 14 entries
    const trimmed = patterns.slice(-14);
    fs_1.default.writeFileSync(sleepPatternPath, JSON.stringify(trimmed, null, 2));
  } catch (err) { console.error('[DeskFlow] Failed to save sleep pattern:', err); }
}

const SLEEP_DETECTION_MIN_GAP_MS = 45 * 60 * 1000; // 45 min gap to trigger detection
const SLEEP_HOUR_START = 21; // 9 PM
const SLEEP_HOUR_END = 10; // 10 AM next day

function isWithinSleepHours(timestamp: number): boolean {
  const h = new Date(timestamp).getHours();
  return h >= SLEEP_HOUR_START || h <= SLEEP_HOUR_END;
}

function detectSleepGap(gapStart: number, gapEnd: number): { isSleep: boolean; suggestedStart: string; suggestedEnd: string; durationMinutes: number } | null {
  const gapMs = gapEnd - gapStart;
  const gapMinutes = gapMs / (1000 * 60);
  
  if (gapMinutes < 45) return null; // Too short to be sleep
  if (!isWithinSleepHours(gapStart) && !isWithinSleepHours(gapEnd)) {
    // Check if gap extends through sleep hours
    const startH = new Date(gapStart).getHours();
    const endH = new Date(gapEnd).getHours();
    if (gapMinutes < 120) return null; // Short daytime gap, not sleep
  }
  
  // Pattern recognition: check if this aligns with past sleep times
  const patterns = loadSleepPatterns();
  const gapStartHour = new Date(gapStart).getHours();
  const gapStartMin = new Date(gapStart).getMinutes();
  const gapStartTotalMin = gapStartHour * 60 + gapStartMin;
  
  let patternScore = 0;
  if (patterns.length >= 2) {
    for (const p of patterns.slice(-5)) {
      const pStart = new Date(p.sleepStart);
      const pStartTotalMin = pStart.getHours() * 60 + pStart.getMinutes();
      const diff = Math.abs(gapStartTotalMin - pStartTotalMin);
      if (diff <= 120) patternScore++; // Within 2 hours of past sleep time
    }
  }
  
  const suggestedStart = new Date(gapStart).toISOString();
  const suggestedEnd = new Date(gapEnd).toISOString();
  
  return {
    isSleep: patternScore >= 1 || gapMinutes >= 180 || (isWithinSleepHours(gapStart) && isWithinSleepHours(gapEnd) && gapMinutes >= 60),
    suggestedStart,
    suggestedEnd,
    durationMinutes: Math.round(gapMinutes),
  };
}

function loadSleepState() {
    try {
        if (fs_1.default.existsSync(sleepStatePath)) {
            const data = JSON.parse(fs_1.default.readFileSync(sleepStatePath, 'utf-8'));
            lastCloseTime = data.lastCloseTime || null;
            lastCloseType = data.lastCloseType || null;
        }
        // Also load last focus time from separate file
        const focusPath = path_1.default.join(userDataPath, 'deskflow-last-focus.json');
        if (fs_1.default.existsSync(focusPath)) {
            const focusData = JSON.parse(fs_1.default.readFileSync(focusPath, 'utf-8'));
            lastFocusTime = focusData.lastFocusTime || null;
        }
    } catch (err) { console.error('[DeskFlow] Failed to load sleep state:', err); }
}

function saveSleepState() {
    try {
        fs_1.default.writeFileSync(sleepStatePath, JSON.stringify({
            lastCloseTime: lastCloseTime,
            lastCloseType: lastCloseType
        }, null, 2));
    } catch (err) { console.error('[DeskFlow] Failed to save sleep state:', err); }
}

function checkMorningPrompt() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    // Morning window: 5:00 AM - 10:00 AM (300-600 minutes)
    const isMorning = currentMinutes >= 300 && currentMinutes <= 600;
    
    // If no close time recorded, skip
    if (!lastCloseTime) {
        console.log('[DeskFlow] No last close time, skipping morning prompt');
        return;
    }
    
    const timeSinceClose = now.getTime() - lastCloseTime;
    const hoursSinceClose = timeSinceClose / (1000 * 60 * 60);
    
    // Check conditions:
    // 1. App was closed for at least 4 hours
    // 2. Current time is in morning window (5am-10am)
    // 3. Last close was in sleep window (10pm-3am)
    const lastCloseHour = new Date(lastCloseTime).getHours();
    const wasSleepTime = lastCloseHour >= 22 || lastCloseHour <= 3;
    
    if (isMorning && hoursSinceClose >= 4 && wasSleepTime) {
        console.log('[DeskFlow] 🌤️ Morning prompt conditions met:', {
            hoursSinceClose: hoursSinceClose.toFixed(1),
            lastCloseHour,
            currentHour
        });
        // Set flag to show morning prompt - will be checked by renderer
        // Store in a file that the renderer can read
        try {
            fs_1.default.writeFileSync(
                path_1.default.join(userDataPath, 'show-morning-prompt.json'),
                JSON.stringify({ show: true, lastCloseTime, lastCloseType }, null, 2)
            );
        } catch (err) { console.error('[DeskFlow] Failed to write morning prompt flag:', err); }
    }
    
    // Reset close time after checking
    lastCloseTime = null;
    lastCloseType = null;
    saveSleepState();
}
// --- Category Configuration ---
const categoryConfigPath = path_1.default.join(userDataPath, 'deskflow-categories.json');
const DEFAULT_CATEGORIES = [
    'IDE', 'AI Tools', 'Browser', 'Entertainment', 'Communication',
    'Design', 'Productivity', 'Tools', 'Education', 'Developer Tools',
    'Search Engine', 'News', 'Shopping', 'Social Media', 'Uncategorized', 'Other'
];
const DEFAULT_TIER_ASSIGNMENTS = {
    productive: ['IDE', 'AI Tools', 'Developer Tools', 'Education', 'Productivity', 'Tools'],
    neutral: ['Communication', 'Design', 'Search Engine', 'News', 'Uncategorized', 'Other'],
    distracting: ['Entertainment', 'Social Media', 'Shopping', 'Gaming']
};
const DEFAULT_APP_CATEGORIES = {
    // IDEs
    'code': 'IDE', 'pycharm': 'IDE', 'intellij': 'IDE', 'visual studio': 'IDE', 'obsidian': 'IDE',
    'vs code': 'IDE', 'vscode': 'IDE', 'webstorm': 'IDE', 'phpstorm': 'IDE', 'rubymine': 'IDE',
    'goland': 'IDE', 'clion': 'IDE', 'rider': 'IDE', 'datagrip': 'IDE', 'appcode': 'IDE',
    'sublime': 'IDE', 'atom': 'IDE', 'vim': 'IDE', 'neovim': 'IDE', 'emacs': 'IDE',
    'notepad++': 'IDE', 'textmate': 'IDE', 'bbedit': 'IDE', 'brackets': 'IDE',
    'android studio': 'IDE', 'xcode': 'IDE', 'flutter': 'IDE', 'dart': 'IDE',
    // Browsers
    'chrome': 'Browser', 'firefox': 'Browser', 'safari': 'Browser', 'edge': 'Browser',
    'brave': 'Browser', 'opera': 'Browser', 'vivaldi': 'Browser', 'arc': 'Browser',
    'comet': 'Browser', 'google chrome': 'Browser', 'microsoft edge': 'Browser',
    // AI Tools
    'claude': 'AI Tools', 'chatgpt': 'AI Tools', 'gpt': 'AI Tools', 'copilot': 'AI Tools',
    'perplexity': 'AI Tools', 'gemini': 'AI Tools', 'bard': 'AI Tools', 'mistral': 'AI Tools',
    'anthropic': 'AI Tools', 'openai': 'AI Tools', 'cursor': 'AI Tools',
    // Entertainment
    'youtube': 'Entertainment', 'netflix': 'Entertainment', 'spotify': 'Entertainment',
    'twitch': 'Entertainment', 'hulu': 'Entertainment', 'disney': 'Entertainment',
    'prime video': 'Entertainment', 'apple tv': 'Entertainment', 'hbo': 'Entertainment',
    'vimeo': 'Entertainment', 'soundcloud': 'Entertainment', 'vlc': 'Entertainment',
    // Gaming
    'minecraft': 'Gaming', 'fortnite': 'Gaming', 'valorant': 'Gaming', 'league': 'Gaming',
    'dota': 'Gaming', 'csgo': 'Gaming', 'counter-strike': 'Gaming', 'rocket league': 'Gaming',
    'apex': 'Gaming', 'overwatch': 'Gaming', 'pubg': 'Gaming', 'warzone': 'Gaming',
    'genshin': 'Gaming', 'steam': 'Gaming', 'epic': 'Gaming', 'battle.net': 'Gaming',
    'blizzard': 'Gaming', 'riot': 'Gaming', 'ubisoft': 'Gaming', 'origin': 'Gaming',
    'xbox': 'Gaming', 'playstation': 'Gaming', 'nintendo': 'Gaming',
    'godot': 'Gaming',
    'wuthering': 'Gaming', 'honkai': 'Gaming', 'star rail': 'Gaming',
    'elden ring': 'Gaming', 'cyberpunk': 'Gaming', 'baldur': 'Gaming',
    'call of duty': 'Gaming', 'gta': 'Gaming', 'v rising': 'Gaming',
    // Communication
    'slack': 'Communication', 'discord': 'Communication', 'teams': 'Communication',
    'zoom': 'Communication', 'skype': 'Communication', 'telegram': 'Communication',
    'whatsapp': 'Communication', 'signal': 'Communication', 'messenger': 'Communication',
    'mail': 'Communication', 'outlook': 'Communication', 'thunderbird': 'Communication',
    // Design
    'figma': 'Design', 'photoshop': 'Design', 'illustrator': 'Design',
    'sketch': 'Design', 'adobe xd': 'Design', 'indesign': 'Design', 'affinity': 'Design',
    'canva': 'Design', 'dribbble': 'Design', 'behance': 'Design',
    'invision': 'Design', 'zeplin': 'Design', 'miro': 'Design',
    // Productivity
    'terminal': 'Productivity', 'powershell': 'Productivity', 'cmd': 'Productivity',
    'explorer': 'Productivity', 'file explorer': 'Productivity', 'finder': 'Productivity',
    'notion': 'Productivity', 'evernote': 'Productivity', 'bear': 'Productivity',
    'apple notes': 'Productivity', 'todoist': 'Productivity', 'asana': 'Productivity',
    'trello': 'Productivity', 'linear': 'Productivity',
    'logseq': 'Productivity', 'craft': 'Productivity',
    // Developer Tools
    'git': 'Developer Tools', 'github': 'Developer Tools', 'gitlab': 'Developer Tools',
    'bitbucket': 'Developer Tools', 'docker': 'Developer Tools', 'kubernetes': 'Developer Tools',
    'postman': 'Developer Tools', 'insomnia': 'Developer Tools', 'dbeaver': 'Developer Tools',
    'tableplus': 'Developer Tools', 'sequel pro': 'Developer Tools', 'mysql': 'Developer Tools',
    'mongodb': 'Developer Tools', 'redis': 'Developer Tools', 'nginx': 'Developer Tools',
    'apache': 'Developer Tools', 'xampp': 'Developer Tools', 'wamp': 'Developer Tools',
    // Tools
    'wispr': 'Tools', '1password': 'Tools', 'lastpass': 'Tools', 'bitwarden': 'Tools',
    'keepass': 'Tools', 'dropbox': 'Tools', 'google drive': 'Tools', 'onedrive': 'Tools',
    'icloud': 'Tools', 'box': 'Tools', 'syncthing': 'Tools',
    // Windows Apps
    'windows shell': 'Other', 'shell experience': 'Other', 
    'credential manager': 'Tools', 'cloudflare warp': 'Tools',
    'searchhost': 'Productivity', 'snipping': 'Productivity',
    'lenovo': 'Tools', 'vantage': 'Tools',
    'foxit': 'Productivity', 'pdf reader': 'Productivity',
    'terminal host': 'Productivity',
    'krsdk': 'Other',
    // System
    'windows': 'Other', 'macos': 'Other', 'linux': 'Other', 'ubuntu': 'Other',
    'system settings': 'Other', 'control panel': 'Other', 'task manager': 'Other',
    'activity monitor': 'Other', 'device manager': 'Other', 'disk utility': 'Other',
    // News & Reading
    'reddit': 'News', 'medium': 'News', 'substack': 'News', 'news': 'News',
    // Shopping
    'amazon': 'Shopping', 'ebay': 'Shopping', 'etsy': 'Shopping', 'shopify': 'Shopping',
    'walmart': 'Shopping', 'aliexpress': 'Shopping', 'target': 'Shopping',
    // Social Media
    'twitter': 'Social Media', 'x': 'Social Media', 'facebook': 'Social Media',
    'instagram': 'Social Media', 'linkedin': 'Social Media', 'tiktok': 'Social Media',
    'snapchat': 'Social Media', 'pinterest': 'Social Media', 'threads': 'Social Media',
    // Search
    'google': 'Search Engine', 'bing': 'Search Engine', 'duckduckgo': 'Search Engine',
    'yahoo': 'Search Engine', 'yandex': 'Search Engine', 'ecosia': 'Search Engine',
};
const DEFAULT_DOMAIN_CATEGORIES = {
    'youtube.com': 'Entertainment',
    'github.com': 'Developer Tools', 'gitlab.com': 'Developer Tools', 'stackoverflow.com': 'Developer Tools',
    'npmjs.com': 'Developer Tools', 'pypi.org': 'Developer Tools', 'dev.to': 'Developer Tools',
    'mdn.io': 'Developer Tools', 'w3schools.com': 'Developer Tools', 'codepen.io': 'Developer Tools',
    'chatgpt.com': 'AI Tools', 'claude.ai': 'AI Tools', 'bard.google.com': 'AI Tools',
    'perplexity.ai': 'AI Tools', 'copilot.microsoft.com': 'AI Tools', 'gemini.google.com': 'AI Tools',
    'twitter.com': 'Social Media', 'x.com': 'Social Media', 'facebook.com': 'Social Media',
    'instagram.com': 'Social Media', 'linkedin.com': 'Social Media', 'reddit.com': 'Social Media',
    'tiktok.com': 'Social Media', 'snapchat.com': 'Social Media',
    'netflix.com': 'Entertainment', 'twitch.tv': 'Entertainment', 'disney.com': 'Entertainment',
    'hulu.com': 'Entertainment', 'vimeo.com': 'Entertainment', 'soundcloud.com': 'Entertainment',
    'bbc.com': 'News', 'cnn.com': 'News', 'reuters.com': 'News', 'bloomberg.com': 'News',
    'medium.com': 'News', 'substack.com': 'News', 'theverge.com': 'News', 'arstechnica.com': 'News',
    'amazon.com': 'Shopping', 'ebay.com': 'Shopping', 'etsy.com': 'Shopping',
    'shopify.com': 'Shopping', 'walmart.com': 'Shopping', 'aliexpress.com': 'Shopping',
    'docs.google.com': 'Productivity', 'drive.google.com': 'Productivity', 'notion.so': 'Productivity',
    'trello.com': 'Productivity', 'asana.com': 'Productivity', 'calendar.google.com': 'Productivity',
    'figma.com': 'Design', 'canva.com': 'Design', 'dribbble.com': 'Design',
    'behance.net': 'Design', 'unsplash.com': 'Design',
    'google.com': 'Search Engine', 'bing.com': 'Search Engine', 'duckduckgo.com': 'Search Engine',
    'yahoo.com': 'Search Engine'
};

// ============================================
// AI AGENT PLUGIN SYSTEM
// Generalized tracking for AI coding assistants
// ============================================

interface ParsedSession {
    sessionId: string;
    timestamp: Date;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    reasoningTokens?: number;
    model?: string;
    provider?: string;
    durationMs?: number;
    projectPath?: string;
    messageCount?: number;
    cost?: number;
}

interface AIAgentPlugin {
    id: string;
    name: string;
    color: string;
    detect(): Promise<boolean>;
    getStoragePaths(): string[];
    parse(filePath: string): Promise<ParsedSession[]>;
    parseDir(dirPath: string): Promise<ParsedSession[]>;
    extractTokensFromRow?: (row: any) => { inputTokens: number; outputTokens: number; cacheReadTokens?: number; cacheWriteTokens?: number };
    parseSQLite?: (dbPath: string) => Promise<ParsedSession[]>;
    parseJson?: (filePath: string) => Promise<ParsedSession[]>;
}

const MODEL_PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
    'claude-opus-4': { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
    'claude-sonnet-4-5': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
    'claude-sonnet-4': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
    'claude-haiku-3-5': { input: 0.8, output: 4, cacheRead: 0.08, cacheWrite: 1 },
    'claude-haiku-3': { input: 0.8, output: 4, cacheRead: 0.08, cacheWrite: 1 },
    'gpt-5': { input: 5, output: 15, cacheRead: 0.125, cacheWrite: 0.55 },
    'gpt-4o': { input: 2.5, output: 10, cacheRead: 0.525, cacheWrite: 10.5 },
    'o3': { input: 10, output: 40, cacheRead: 0, cacheWrite: 0 },
    'gemini-2-5-pro': { input: 1.25, output: 5, cacheRead: 0.16, cacheWrite: 5 },
    'gemini-2-5-flash': { input: 0.075, output: 0.3, cacheRead: 0.01, cacheWrite: 0.15 },
    'default': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2 },
};

function getModelPricing(model?: string): { input: number; output: number; cacheRead: number; cacheWrite: number } {
    if (!model) return MODEL_PRICING['default'];
    const key = Object.keys(MODEL_PRICING).find(k => model.toLowerCase().includes(k.toLowerCase()));
    return MODEL_PRICING[key || 'default'];
}

// Shared helpers for token parsing (REQUIRED - see §0.3 of RESULT.md)
function toInt(v: unknown): number {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function readTextFileSafe(p: string): string | null {
    try {
        const buf = fs_1.default.readFileSync(p);
        const start = buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF ? 3 : 0;
        return buf.slice(start).toString('utf8');
    } catch (e: any) {
        if (e?.code === 'EACCES' || e?.code === 'EBUSY' || e?.code === 'EPERM') return null;
        throw e;
    }
}

function* iterJsonl(text: string): Generator<any> {
    for (const raw of text.split(/\r\n|\n|\r/)) {
        const line = raw.trim();
        if (!line) continue;
        try { yield JSON.parse(line); } catch { /* skip corrupt line */ }
    }
}

function calculateCost(session: ParsedSession): number {
    const pricing = getModelPricing(session.model);
    let cost = 0;
    cost += (session.inputTokens / 1_000_000) * pricing.input;
    cost += (session.outputTokens / 1_000_000) * pricing.output;
    if (session.cacheReadTokens) cost += (session.cacheReadTokens / 1_000_000) * pricing.cacheRead;
    if (session.cacheWriteTokens) cost += (session.cacheWriteTokens / 1_000_000) * pricing.cacheWrite;
    return Math.round(cost * 10000) / 10000;
}

// Claude Code Plugin
const ClaudeCodePlugin: AIAgentPlugin = {
    id: 'claude-code',
    name: 'Claude Code',
    color: '#f97316',

    async detect(): Promise<boolean> {
        const homedir = require('os').homedir();
        const projectsPath = path_1.default.join(homedir, '.claude', 'projects');
        return fs_1.default.existsSync(projectsPath);
    },

    getStoragePaths(): string[] {
        const homedir = require('os').homedir();
        return [path_1.default.join(homedir, '.claude', 'projects')];
    },

    async parse(filePath: string): Promise<ParsedSession[]> {
        const sessions: ParsedSession[] = [];
        try {
            const content = fs_1.default.readFileSync(filePath, 'utf8');
            const lines = content.split('\n').filter(Boolean);

            let totalInput = 0;
            let totalOutput = 0;
            let totalCacheRead = 0;
            let totalCacheWrite = 0;
            let lastModel = '';
            let sessionId = '';
            let timestamp: Date | null = null;
            let messageCount = 0;
            let projectPath: string | undefined;

            for (const line of lines) {
                try {
                    const entry = JSON.parse(line);

                    if (!sessionId && entry.sessionId) sessionId = entry.sessionId;
                    if (!timestamp && entry.timestamp) timestamp = new Date(entry.timestamp);
                    if (!timestamp && entry.uuid) timestamp = new Date();
                    if (!projectPath && entry.cwd) projectPath = entry.cwd;

                    const entryType = entry.type;
                    // Count actual message exchanges
                    if (entryType === 'user' || entryType === 'assistant') {
                        messageCount++;
                    }

                    let inputTokens = 0;
                    let outputTokens = 0;
                    let cacheRead = 0;
                    let cacheWrite = 0;
                    let model = '';

                    if (entryType === 'assistant') {
                        const message = entry.message || entry;
                        const usage = message?.usage || message?.tokenUsage;
                        if (usage) {
                            totalInput += toInt(usage.input_tokens) + toInt(usage.inputTokens) + toInt(usage.server_tool_use?.input_tokens);
                            totalOutput += toInt(usage.output_tokens) + toInt(usage.outputTokens) + toInt(usage.server_tool_use?.output_tokens);
                            totalCacheRead += toInt(usage.cache_read_input_tokens) + toInt(usage.cacheReadTokens);
                            totalCacheWrite += toInt(usage.cache_creation_input_tokens) + toInt(usage.cacheWriteTokens);
                        }
                        if (message?.model) lastModel = message.model;
                    }
                } catch {}
            }

            if (totalInput > 0 || totalOutput > 0 || messageCount > 0) {
                // If no cwd found in entries, derive from file path
                if (!projectPath) {
                    const homedir = require('os').homedir();
                    const projectsPrefix = path_1.default.join(homedir, '.claude', 'projects') + path_1.default.sep;
                    if (filePath.startsWith(projectsPrefix)) {
                        const relativePath = filePath.substring(projectsPrefix.length);
                        const projectDir = relativePath.split(path_1.default.sep)[0];
                        projectPath = projectDir;
                    }
                }

                sessions.push({
                    sessionId: sessionId || path_1.default.basename(filePath, '.jsonl'),
                    timestamp: timestamp || new Date(),
                    inputTokens: totalInput,
                    outputTokens: totalOutput,
                    cacheReadTokens: totalCacheRead || undefined,
                    cacheWriteTokens: totalCacheWrite || undefined,
                    model: lastModel || undefined,
                    provider: 'anthropic',
                    projectPath,
                    messageCount: messageCount > 0 ? messageCount : undefined,
                });
            }
        } catch {}
        return sessions;
    },

    async parseDir(dirPath: string): Promise<ParsedSession[]> {
        const sessions: ParsedSession[] = [];
        const collectJsonlFiles = (currentDir: string): string[] => {
            const files: string[] = [];
            try {
                const entries = fs_1.default.readdirSync(currentDir);
                for (const entry of entries) {
                    const fullPath = path_1.default.join(currentDir, entry);
                    const stat = fs_1.default.statSync(fullPath);
                    if (stat.isDirectory()) {
                        files.push(...collectJsonlFiles(fullPath));
                    } else if (entry.endsWith('.jsonl')) {
                        files.push(fullPath);
                    }
                }
            } catch {}
            return files;
        };
        try {
            const allFiles = collectJsonlFiles(dirPath);
            for (let i = 0; i < allFiles.length; i++) {
                const sessionsFromFile = await this.parse(allFiles[i]);
                sessions.push(...sessionsFromFile);
                // Yield every 10 files to prevent UI freeze
                if (i % 10 === 0) {
                    await new Promise<void>(resolve => setImmediate(resolve));
                }
            }
        } catch {}
        return sessions;
    }
};

// OpenCode Plugin
const OpenCodePlugin: AIAgentPlugin = {
    id: 'opencode',
    name: 'OpenCode',
    color: '#3b82f6',

    async detect(): Promise<boolean> {
        const homedir = require('os').homedir();
        const dbPath = path_1.default.join(homedir, '.local', 'share', 'opencode', 'opencode.db');
        return fs_1.default.existsSync(dbPath);
    },

    getStoragePaths(): string[] {
        const homedir = require('os').homedir();
        return [
            path_1.default.join(homedir, '.local', 'share', 'opencode'),
            path_1.default.join(homedir, '.local', 'share', 'opencode', 'storage', 'session_diff'),
        ];
    },

    async parse(filePath: string): Promise<ParsedSession[]> {
        if (filePath.endsWith('.db')) {
            return this.parseSQLite ? this.parseSQLite(filePath) : Promise.resolve([]);
        }
        return Promise.resolve([]);
    },

    async parseSQLite(dbPath: string): Promise<ParsedSession[]> {
        const sessions: ParsedSession[] = [];
        try {
            const Database = require('better-sqlite3');
            const db = new Database(dbPath, { readonly: true });

            const sessionRows = db.prepare("SELECT id, directory, title, time_created, time_updated FROM session").all() as any[];
            const messageRows = db.prepare("SELECT session_id, data FROM message").all() as any[];

            const sessionMap = new Map<string, { directory?: string; title?: string; time_created?: number }>();
            for (const s of sessionRows) {
                sessionMap.set(s.id, { directory: s.directory, title: s.title, time_created: s.time_created });
            }

            const grouped = new Map<string, { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; reasoningTokens: number; model?: string; provider?: string; cost: number; count: number }>();

            for (const msg of messageRows) {
                try {
                    const data = typeof msg.data === 'string' ? JSON.parse(msg.data) : msg.data;
                    if (!data || !data.tokens) continue;

                    const tokens = data.tokens;
                    if (!tokens.input && !tokens.output) continue;

                    const sid = msg.session_id;
                    if (!grouped.has(sid)) {
                        grouped.set(sid, { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, model: data.modelID, provider: data.providerID, cost: 0, count: 0 });
                    }
                    const g = grouped.get(sid)!;
                    g.inputTokens += tokens.input || 0;
                    g.outputTokens += tokens.output || 0;
                    g.cacheReadTokens += tokens.cache?.read || 0;
                    g.cacheWriteTokens += tokens.cache?.write || 0;
                    g.reasoningTokens += tokens.reasoning || 0;
                    if (!g.model && data.modelID) g.model = data.modelID;
                    if (!g.provider && data.providerID) g.provider = data.providerID;
                    g.cost += data.cost || 0;
                    g.count++;
                } catch {}
            }

            for (const [sid, g] of grouped) {
                if (g.inputTokens === 0 && g.outputTokens === 0) continue;
                const sessionInfo = sessionMap.get(sid);
                sessions.push({
                    sessionId: sid,
                    timestamp: sessionInfo?.time_created ? new Date(sessionInfo.time_created) : new Date(),
                    inputTokens: g.inputTokens,
                    outputTokens: g.outputTokens,
                    cacheReadTokens: g.cacheReadTokens || undefined,
                    cacheWriteTokens: g.cacheWriteTokens || undefined,
                    reasoningTokens: g.reasoningTokens || undefined,
                    model: g.model,
                    provider: g.provider,
                    durationMs: undefined,
                    projectPath: sessionInfo?.directory,
                    messageCount: g.count > 0 ? g.count : undefined,
                });
            }

            db.close();
        } catch {}
        return sessions;
    },

    async parseDir(dirPath: string): Promise<ParsedSession[]> {
        const sessions: ParsedSession[] = [];
        try {
            const dbPath = path_1.default.join(dirPath, 'opencode.db');
            if (fs_1.default.existsSync(dbPath)) {
                const fromDb = await this.parse(dbPath);
                sessions.push(...fromDb);
            }
        } catch {}
        return sessions;
    }
};

// Gemini CLI Plugin
const GeminiPlugin: AIAgentPlugin = {
    id: 'gemini',
    name: 'Gemini CLI',
    color: '#22c55e',

    async detect(): Promise<boolean> {
        const homedir = require('os').homedir();
        // Check both possible locations: tmp/ and history/
        const tmpPath = path_1.default.join(homedir, '.gemini', 'tmp');
        const historyPath = path_1.default.join(homedir, '.gemini', 'history');
        return fs_1.default.existsSync(tmpPath) || fs_1.default.existsSync(historyPath);
    },

    getStoragePaths(): string[] {
        const homedir = require('os').homedir();
        const explicit = (global as any).__aiAgentCustomPaths?.['gemini'];
        if (explicit) return [explicit];
        return [
            path_1.default.join(homedir, '.gemini', 'tmp'),
            path_1.default.join(homedir, '.gemini', 'history'),
        ];
    },

    async parse(filePath: string): Promise<ParsedSession[]> {
        const sessions: ParsedSession[] = [];
        try {
            const content = fs_1.default.readFileSync(filePath, 'utf8');

            if (filePath.endsWith('.jsonl')) {
                const lines = content.split('\n').filter(Boolean);

                // Find session header (first line with sessionId, no $set, no type field)
                let sessionId: string | null = null;
                let sessionTime: string | null = null;
                let projectPath: string | null = null;
                for (const line of lines) {
                    try {
                        const entry = JSON.parse(line);
                        if (entry.$set) continue;
                        if (entry.sessionId && !entry.type) {
                            sessionId = entry.sessionId;
                            sessionTime = entry.startTime || null;
                            projectPath = entry.cwd || null;
                            break;
                        }
                    } catch {}
                }
                if (!sessionId) return sessions;

                let inputTokens = 0, outputTokens = 0, cacheReadTokens = 0;
                let model = 'gemini';
                let messageCount = 0;

                for (const line of lines) {
                    try {
                        const entry = JSON.parse(line);
                        if (entry.$set) continue;
                        if (entry.type !== 'gemini') continue;
                        messageCount++;
                        if (entry.tokens) {
                            inputTokens += entry.tokens.input || 0;
                            outputTokens += entry.tokens.output || 0;
                            cacheReadTokens += entry.tokens.cached || 0;
                        }
                        if (entry.model) model = entry.model;
                    } catch {}
                }

                if (messageCount > 0) {
                    sessions.push({
                        sessionId,
                        timestamp: new Date(sessionTime || Date.now()),
                        inputTokens,
                        outputTokens,
                        cacheReadTokens,
                        model,
                        provider: 'google',
                        projectPath: projectPath || undefined,
                        messageCount,
                    });
                }
            } else if (filePath.endsWith('.json')) {
                try {
                    const data = JSON.parse(content);

                    if (Array.isArray(data)) {
                        // Flat array format (logs.json)
                        const sessionMap = new Map<string, {
                            sessionId: string;
                            timestamp: Date;
                            inputTokens: number;
                            outputTokens: number;
                            cacheReadTokens: number;
                            model: string;
                            provider: string;
                            messageCount: number;
                        }>();
                        for (const entry of data) {
                            if (!entry.sessionId || entry.type !== 'gemini') continue;
                            const tokens = entry.tokens;
                            if (!tokens) continue;

                            let existing = sessionMap.get(entry.sessionId);
                            if (!existing) {
                                existing = {
                                    sessionId: entry.sessionId,
                                    timestamp: new Date(entry.timestamp || Date.now()),
                                    inputTokens: 0,
                                    outputTokens: 0,
                                    cacheReadTokens: 0,
                                    model: entry.model || 'gemini',
                                    provider: 'google',
                                    messageCount: 0,
                                };
                                sessionMap.set(entry.sessionId, existing);
                            }
                            existing.inputTokens += tokens.input || 0;
                            existing.outputTokens += tokens.output || 0;
                            existing.cacheReadTokens += tokens.cached || 0;
                            existing.messageCount++;
                        }
                        for (const vals of sessionMap.values()) {
                            sessions.push({
                                sessionId: vals.sessionId,
                                timestamp: vals.timestamp,
                                inputTokens: vals.inputTokens,
                                outputTokens: vals.outputTokens,
                                cacheReadTokens: vals.cacheReadTokens,
                                model: vals.model,
                                provider: vals.provider,
                                messageCount: vals.messageCount,
                            });
                        }
                    } else if (data.messages && Array.isArray(data.messages)) {
                        // Session file format: {sessionId, messages: [{id, type, content, tokens, model}]}
                        const sid = data.sessionId || data.id || String(Date.now());
                        const timestamp = new Date(data.startTime || data.createdAt || Date.now());

                        let inputTokens = 0, outputTokens = 0, cacheReadTokens = 0;
                        let model = data.model || 'gemini';
                        let messageCount = 0;

                        for (const msg of data.messages) {
                            if (msg.type && msg.type !== 'gemini') continue;
                            messageCount++;
                            const usage = msg.usage || msg.tokens;
                            if (usage) {
                                inputTokens += usage.input || usage.inputTokens || 0;
                                outputTokens += usage.output || usage.outputTokens || 0;
                                cacheReadTokens += usage.cached || usage.cacheReadTokens || 0;
                            }
                            if (msg.model) model = msg.model;
                        }

                        if (messageCount > 0) {
                            sessions.push({
                                sessionId: sid,
                                timestamp,
                                inputTokens,
                                outputTokens,
                                cacheReadTokens,
                                model,
                                provider: 'google',
                                projectPath: data.cwd,
                                messageCount,
                            });
                        }
                    }
                } catch {}
            }
        } catch {}
        return sessions;
    },

async parseDir(dirPath: string): Promise<ParsedSession[]> {
        const sessions: ParsedSession[] = [];
        let i = 0;
        const exts = new Set(['.json', '.jsonl']);
        const walk = async (d: string, project?: string) => {
            let entries: { name: string; isDirectory: () => boolean; isFile: () => boolean }[] = [];
            try { entries = fs_1.default.readdirSync(d, { withFileTypes: true }) as any; } catch { return; }
            for (const ent of entries) {
                const p = path_1.default.join(d, ent.name);
                if (ent.isDirectory()) {
                    const proj = project ?? (path_1.default.dirname(d) === dirPath ? ent.name : undefined);
                    await walk(p, proj);
                } else if (ent.isFile() && exts.has(path_1.default.extname(ent.name).toLowerCase())) {
                    const parsed = await this.parse(p);
                    for (const s of parsed) { if (!s.projectPath && project) s.projectPath = project; }
                    sessions.push(...parsed);
                    if (++i % 10 === 0) await new Promise(r => setImmediate(r));
                }
            }
        };
        await walk(dirPath);
        return sessions;
    }
};

// Codex CLI Plugin
const CodexPlugin: AIAgentPlugin = {
    id: 'codex',
    name: 'Codex CLI',
    color: '#10b981',

    async detect(): Promise<boolean> {
        const homedir = require('os').homedir();
        // Check multiple possible locations
        const paths = [
            path_1.default.join(homedir, '.codex'),
            path_1.default.join(homedir, '.codex', 'sessions'),
            path_1.default.join(homedir, '.codex', 'storage'),
        ];
        return paths.some(p => fs_1.default.existsSync(p));
    },

    getStoragePaths(): string[] {
        const homedir = require('os').homedir();
        const explicit = (global as any).__aiAgentCustomPaths?.['codex'];
        if (explicit) return [explicit];
        return [
            path_1.default.join(homedir, '.codex'),
            path_1.default.join(homedir, '.codex', 'sessions'),
            path_1.default.join(homedir, '.codex', 'storage'),
        ];
    },

    async parse(filePath: string): Promise<ParsedSession[]> {
        const sessions: ParsedSession[] = [];
        try {
            if (filePath.endsWith('.sqlite') || filePath.endsWith('.db')) {
                return this.parseSQLite ? this.parseSQLite(filePath) : sessions;
            }

            if (!filePath.endsWith('.jsonl') && !filePath.endsWith('.json')) return sessions;

            const content = fs_1.default.readFileSync(filePath, 'utf8');

            if (filePath.endsWith('.jsonl')) {
                // history.jsonl format: {"session_id":"...","ts":...,"text":"..."}
                // No token data in this file. Group by session_id to count messages.
                const lines = content.split('\n').filter(Boolean);
                const sessionGroups = new Map<string, { ts: number; count: number }>();
                for (const line of lines) {
                    try {
                        const entry = JSON.parse(line);
                        const sid = entry.session_id || String(Date.now());
                        const existing = sessionGroups.get(sid);
                        if (existing) {
                            existing.count++;
                            if (entry.ts > existing.ts) existing.ts = entry.ts;
                        } else {
                            sessionGroups.set(sid, { ts: entry.ts || Date.now(), count: 1 });
                        }
                    } catch {}
                }
                for (const [sid, info] of sessionGroups) {
                    sessions.push({
                        sessionId: sid,
                        timestamp: new Date(info.ts * 1000),
                        inputTokens: 0,
                        outputTokens: 0,
                        model: 'codex',
                        provider: 'openai',
                        messageCount: info.count,
                    });
                }
            } else {
                try {
                    const data = JSON.parse(content);
                    const usage = data.usage || data.tokens;
                    if (usage && (usage.input_tokens || usage.output_tokens || usage.input || usage.output)) {
                        sessions.push({
                            sessionId: data.id || String(Date.now()),
                            timestamp: new Date(data.timestamp || data.created_at || Date.now()),
                            inputTokens: usage.input_tokens || usage.input || 0,
                            outputTokens: usage.output_tokens || usage.output || 0,
                            cacheReadTokens: usage.cached_tokens || usage.cache_read_tokens || 0,
                            model: data.model || 'codex',
                            provider: 'openai',
                            projectPath: data.cwd,
                            messageCount: 1,
                        });
                    }
                } catch {}
            }
        } catch {}
        return sessions;
    },

    async parseSQLite(dbPath: string): Promise<ParsedSession[]> {
        const sessions: ParsedSession[] = [];
        try {
            const homedir = require('os').homedir();
            const logDbPath = path_1.default.join(homedir, '.codex', 'logs_2.sqlite');
            if (!fs_1.default.existsSync(logDbPath)) return sessions;

            const Database = require('better-sqlite3');
            const db = new Database(logDbPath, { readonly: true });

            const rows = db.prepare(`
                SELECT feedback_log_body, ts
                FROM logs
                WHERE feedback_log_body LIKE '%response.completed%'
                ORDER BY ts ASC
            `).all() as any[];

            const convMap = new Map<string, {
                inputTokens: number;
                outputTokens: number;
                cacheReadTokens: number;
                model: string;
                messageCount: number;
                timestamp: Date;
            }>();

            for (const row of rows) {
                try {
                    const body: string = row.feedback_log_body || '';
                    let convId = '';
                    let inputTokens = 0;
                    let outputTokens = 0;
                    let cacheReadTokens = 0;
                    let model = 'codex';
                    let ts = row.ts || 0;

                    // Try JSON format: "Received message {...}"
                    if (body.startsWith('Received message ')) {
                        const jsonStr = body.substring('Received message '.length);
                        const data = JSON.parse(jsonStr);
                        const resp = data.response || {};
                        convId = resp.id || '';
                        model = resp.model || model;
                        const usage = resp.usage || {};
                        inputTokens = usage.input_tokens || 0;
                        outputTokens = usage.output_tokens || 0;
                        cacheReadTokens = usage.input_tokens_details?.cached_tokens || 0;
                    }

                    // Try key=value format
                    if (!convId) {
                        const pairs: Record<string, string> = {};
                        for (const part of body.split(' ')) {
                            const eqIdx = part.indexOf('=');
                            if (eqIdx > 0) {
                                pairs[part.substring(0, eqIdx)] = part.substring(eqIdx + 1);
                            }
                        }
                        if (pairs['event.kind'] === 'response.completed') {
                            convId = pairs['conversation.id'] || '';
                            inputTokens = parseInt(pairs['input_token_count']) || 0;
                            outputTokens = parseInt(pairs['output_token_count']) || 0;
                            cacheReadTokens = parseInt(pairs['cached_token_count']) || 0;
                            model = pairs['model'] || model;
                            if (pairs['event.timestamp']) {
                                const parsed = new Date(pairs['event.timestamp']);
                                if (!isNaN(parsed.getTime())) ts = parsed.getTime() / 1000;
                            }
                        }
                    }

                    if (!convId) continue;
                    const existing = convMap.get(convId);
                    if (existing) {
                        existing.inputTokens += inputTokens;
                        existing.outputTokens += outputTokens;
                        existing.cacheReadTokens += cacheReadTokens;
                        existing.messageCount++;
                    } else {
                        convMap.set(convId, {
                            inputTokens,
                            outputTokens,
                            cacheReadTokens,
                            model,
                            messageCount: 1,
                            timestamp: new Date(ts * 1000),
                        });
                    }
                } catch {}
            }

            db.close();

            for (const [convId, info] of convMap) {
                if (info.inputTokens > 0 || info.outputTokens > 0) {
                    sessions.push({
                        sessionId: convId,
                        timestamp: info.timestamp,
                        inputTokens: info.inputTokens,
                        outputTokens: info.outputTokens,
                        cacheReadTokens: info.cacheReadTokens || undefined,
                        model: info.model,
                        provider: 'openai',
                        messageCount: info.messageCount,
                    });
                }
            }

            console.log(`[Codex] SQLite: parsed ${sessions.length} sessions from ${rows.length} events`);
        } catch (e: any) {
            console.error(`[Codex] SQLite parse error: ${e.message}`);
        }
        return sessions;
    },

    async parseDir(dirPath: string): Promise<ParsedSession[]> {
        const sessions: ParsedSession[] = [];
        try {
            if (!fs_1.default.existsSync(dirPath)) return sessions;

            const walkDir = async (dir: string) => {
                const items = fs_1.default.readdirSync(dir);
                for (const item of items) {
                    const fullPath = path_1.default.join(dir, item);
                    try {
                        const stat = fs_1.default.statSync(fullPath);
                        if (stat.isDirectory()) {
                            await walkDir(fullPath);
                        } else if (item.endsWith('.jsonl') || item.endsWith('.json') || item.endsWith('.sqlite') || item.endsWith('.db')) {
                            const parsed = await this.parse(fullPath);
                            sessions.push(...parsed);
                        }
                    } catch {}
                }
            };

            await walkDir(dirPath);
        } catch {}
        return sessions;
    }
};

// Qwen CLI Plugin
const QwenPlugin: AIAgentPlugin = {
    id: 'qwen',
    name: 'Qwen CLI',
    color: '#f59e0b',

    async detect(): Promise<boolean> {
        const homedir = require('os').homedir();
        const projectsPath = path_1.default.join(homedir, '.qwen', 'projects');
        return fs_1.default.existsSync(projectsPath);
    },

    getStoragePaths(): string[] {
        const homedir = require('os').homedir();
        return [path_1.default.join(homedir, '.qwen', 'projects')];
    },

    async parse(filePath: string): Promise<ParsedSession[]> {
        const sessions: ParsedSession[] = [];
        try {
            if (!filePath.endsWith('.jsonl')) return sessions;
            const content = fs_1.default.readFileSync(filePath, 'utf8');
            const lines = content.split('\n').filter(Boolean);
            
            // Group by sessionId to handle multiple sessions per file
            const sessionMap = new Map<string, {
                sessionId: string;
                timestamp: Date;
                inputTokens: number;
                outputTokens: number;
                cachedTokens: number;
                thoughtsTokens: number;
                model: string;
                provider: string;
                projectPath?: string;
                messageCount: number;
            }>();

            for (const line of lines) {
                try {
                    const entry = JSON.parse(line);
                    if (!entry.sessionId) continue;
                    
                    const sessionId = entry.sessionId;
                    let existing = sessionMap.get(sessionId);
                    if (!existing) {
                        const timestamp = entry.timestamp ? new Date(entry.timestamp) : new Date();
                        existing = {
                            sessionId,
                            timestamp,
                            inputTokens: 0,
                            outputTokens: 0,
                            cachedTokens: 0,
                            thoughtsTokens: 0,
                            model: entry.model || '',
                            provider: 'alibaba',
                            projectPath: entry.cwd,
                            messageCount: 0,
                        };
                        sessionMap.set(sessionId, existing);
                    }

                    // Count actual messages (user + assistant exchanges)
                    if (entry.type === 'user' || entry.type === 'assistant') {
                        existing.messageCount++;
                    }

                    if (entry.type === 'assistant' && entry.usageMetadata) {
                        const usage = entry.usageMetadata;
                        // promptTokenCount and cachedContentTokenCount are CUMULATIVE (total so far in session), not per-message
                        // Using = (not +=) gives the correct cumulative total from the last assistant message
                        existing.inputTokens = toInt(usage.promptTokenCount);
                        existing.cachedTokens = toInt(usage.cachedContentTokenCount);
                        // candidatesTokenCount and thoughtsTokenCount are per-message, so accumulate them
                        existing.outputTokens += toInt(usage.candidatesTokenCount);
                        existing.thoughtsTokens += toInt(usage.thoughtsTokenCount);
                    }
                } catch {}
            }

            // Convert map to sessions array
            for (const vals of sessionMap.values()) {
                if (vals.inputTokens > 0 || vals.outputTokens > 0 || vals.messageCount > 0) {
                    sessions.push({
                        sessionId: vals.sessionId,
                        timestamp: vals.timestamp,
                        inputTokens: vals.inputTokens,
                        outputTokens: vals.outputTokens,
                        cacheReadTokens: vals.cachedTokens || undefined,
                        reasoningTokens: vals.thoughtsTokens || undefined,
                        model: vals.model,
                        provider: vals.provider,
                        projectPath: vals.projectPath,
                        messageCount: vals.messageCount > 0 ? vals.messageCount : undefined,
                    });
                }
            }
        } catch {}
        return sessions;
    },

    async parseDir(dirPath: string): Promise<ParsedSession[]> {
        const sessions: ParsedSession[] = [];
        try {
            if (!fs_1.default.existsSync(dirPath)) return sessions;
            const projectDirs = fs_1.default.readdirSync(dirPath);
            let fileCount = 0;
            for (const projectDir of projectDirs) {
                const projectPath = path_1.default.join(dirPath, projectDir);
                if (!fs_1.default.statSync(projectPath).isDirectory()) continue;
                const chatsPath = path_1.default.join(projectPath, 'chats');
                if (!fs_1.default.existsSync(chatsPath)) continue;
                const files = fs_1.default.readdirSync(chatsPath);
                for (const file of files) {
                    if (file.endsWith('.jsonl')) {
                        const fromFile = await this.parse(path_1.default.join(chatsPath, file));
                        sessions.push(...fromFile);
                        fileCount++;
                        // Yield every 10 files to prevent UI freeze
                        if (fileCount % 10 === 0) {
                            await new Promise<void>(resolve => setImmediate(resolve));
                        }
                    }
                }
            }
        } catch {}
        return sessions;
    }
};

// Aider Plugin
const AiderPlugin: AIAgentPlugin = {
    id: 'aider',
    name: 'Aider',
    color: '#ec4899',

    async detect(): Promise<boolean> {
        const homedir = require('os').homedir();
        const analyticsPath = path_1.default.join(homedir, '.oobo', 'aider-analytics.jsonl');
        return fs_1.default.existsSync(analyticsPath);
    },

    getStoragePaths(): string[] {
        const homedir = require('os').homedir();
        return [
            path_1.default.join(homedir, '.oobo', 'aider-analytics.jsonl'),
        ];
    },

    async parse(filePath: string): Promise<ParsedSession[]> {
        const sessions: ParsedSession[] = [];
        try {
            if (!fs_1.default.existsSync(filePath)) return sessions;

            const content = fs_1.default.readFileSync(filePath, 'utf8');
            const lines = content.split('\n').filter(Boolean);

            for (const line of lines) {
                try {
                    const entry = JSON.parse(line);
                    if (entry.event === 'message_send' || entry.event === 'api_call') {
                        sessions.push({
                            sessionId: entry.session_id || String(Date.now()),
                            timestamp: new Date(entry.timestamp || Date.now()),
                            inputTokens: entry.prompt_tokens || entry.input_tokens || 0,
                            outputTokens: entry.completion_tokens || entry.output_tokens || 0,
                            model: entry.model,
                            provider: entry.provider || 'openai',
                        });
                    }
                } catch {}
            }
        } catch {}
        return sessions;
    },

    async parseDir(dirPath: string): Promise<ParsedSession[]> {
        return this.parse(dirPath);
    }
};

// Cursor AI Plugin (VS Code extension-based)
const CursorPlugin: AIAgentPlugin = {
    id: 'cursor',
    name: 'Cursor AI',
    color: '#a855f7',

    async detect(): Promise<boolean> {
        let cursorStatePath: string;

        if (process.platform === 'win32') {
            cursorStatePath = path_1.default.join(process.env.APPDATA || '', 'Cursor', 'User', 'globalStorage', 'state.vscdb');
        } else {
            const homedir = require('os').homedir();
            cursorStatePath = path_1.default.join(homedir, 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'state.vscdb');
        }

        return fs_1.default.existsSync(cursorStatePath);
    },

    getStoragePaths(): string[] {
        if (process.platform === 'win32') {
            return [path_1.default.join(process.env.APPDATA || '', 'Cursor', 'User', 'globalStorage', 'state.vscdb')];
        } else {
            const homedir = require('os').homedir();
            return [path_1.default.join(homedir, 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'state.vscdb')];
        }
    },

    async parse(filePath: string): Promise<ParsedSession[]> {
        const sessions: ParsedSession[] = [];
        try {
            if (!filePath.endsWith('.vscdb')) return sessions;

            const Database = require('better-sqlite3');
            const cursorDb = new Database(filePath, { readonly: true });

            // Check if cursorDiskKV table exists (newer format)
            const tableCheck = cursorDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cursorDiskKV'").all();
            
            if (tableCheck.length > 0) {
                // New format: cursorDiskKV table
                // Keys like: 'bubbleId:xxx', 'composerData:xxx', 'agentKv:xxx'
                const bubbleData = cursorDb.prepare("SELECT key, value FROM cursorDiskKV WHERE key LIKE 'bubbleId:%'").all() as any[];
                console.log(`[Cursor] Found ${bubbleData.length} bubble entries`);

                for (const row of bubbleData) {
                    try {
                        const data = JSON.parse(row.value);
                        // Token count is in data.tokenCount
                        const tokenCount = data.tokenCount || data.usage;
                        if (tokenCount) {
                            const inputTokens = tokenCount.inputTokens || tokenCount.input_tokens || 0;
                            const outputTokens = tokenCount.outputTokens || tokenCount.output_tokens || 0;

                            if (inputTokens > 0 || outputTokens > 0) {
                                sessions.push({
                                    sessionId: row.key,
                                    timestamp: new Date(data.createdAt || Date.now()),
                                    inputTokens,
                                    outputTokens,
                                    model: data.modelInfo?.modelName || data.model || 'claude-sonnet',
                                    provider: 'anthropic',
                                });
                                console.log(`[Cursor] Found session: ${inputTokens} in / ${outputTokens} out`);
                            }
                        }
                    } catch {}
                }
            } else {
                // Fallback: Check ItemTable (older format)
                const aiData = cursorDb.prepare("SELECT key, value FROM ItemTable WHERE key LIKE 'aiService.%'").all() as any[];

                for (const row of aiData) {
                    try {
                        const value = JSON.parse(row.value);
                        if (value && typeof value === 'object') {
                            const inputTokens = value.inputTokens || value.input_tokens || value.promptTokens || 0;
                            const outputTokens = value.outputTokens || value.output_tokens || value.completionTokens || 0;

                            if (inputTokens > 0 || outputTokens > 0) {
                                sessions.push({
                                    sessionId: row.key || String(Date.now()),
                                    timestamp: new Date(),
                                    inputTokens,
                                    outputTokens,
                                    model: value.model || 'cursor',
                                    provider: 'cursor',
                                });
                            }
                        }
                    } catch {}
                }
            }

            cursorDb.close();
            console.log(`[Cursor] Total sessions found: ${sessions.length}`);
        } catch (e) {
            console.error(`[Cursor] Parse error: ${e.message}`);
        }
        return sessions;
    },

    async parseDir(dirPath: string): Promise<ParsedSession[]> {
        return this.parse(dirPath);
    }
};

// ---------------------------------------------------------------------------
// KiloCode Plugin (Continue fork — task files at ~/.kilocode/.../tasks/)
// ---------------------------------------------------------------------------
const KiloCodePlugin: AIAgentPlugin = {
    id: 'kilocode',
    name: 'KiloCode',
    color: '#22c55e',

    async detect(): Promise<boolean> {
        const kiloCodePath = path_1.default.join(
            require('os').homedir(),
            '.kilocode', 'globalStorage', 'kilo code.kilo-code', 'tasks'
        );
        return fs_1.default.existsSync(kiloCodePath);
    },

    getStoragePaths(): string[] {
        const home = require('os').homedir();
        const explicit = (global as any).__aiAgentCustomPaths?.['kilocode'];
        if (explicit) return [explicit];
        return [path_1.default.join(home, '.kilocode', 'globalStorage', 'kilo code.kilo-code', 'tasks')];
    },

async parse(filePath: string): Promise<ParsedSession[]> {
        const sessions: ParsedSession[] = [];
        const base = path_1.default.basename(filePath).toLowerCase();
        if (base !== 'api_conversation_history.json') return sessions;
        const text = readTextFileSafe(filePath);
        if (!text) return sessions;
        let arr: any[];
        try { arr = JSON.parse(text); } catch { return sessions; }
        if (!Array.isArray(arr) || arr.length === 0) return sessions;
        const taskDir = path_1.default.basename(path_1.default.dirname(filePath));
        const firstTs = typeof arr[0]?.ts === 'number' ? arr[0].ts : 0;
        let cost: number | undefined;
        let totalInput = 0;
        let totalOutput = 0;
        let lastModel: string | undefined;
        const re = /Current Cost:\s*\$([0-9]+(?:\.[0-9]+)?)/g;
        for (const msg of arr) {
            const content = Array.isArray(msg?.content) ? msg.content : [];
            const role = msg?.role || '';
            let msgChars = 0;
            for (const c of content) {
                if (typeof c?.text === 'string') {
                    msgChars += c.text.length;
                    let m: RegExpExecArray | null;
                    while ((m = re.exec(c.text)) !== null) {
                        const n = parseFloat(m[1]);
                        if (Number.isFinite(n)) cost = n;
                    }
                }
            }
            // Estimate tokens from character count (~4 chars per token for English)
            const estTokens = Math.round(msgChars / 4);
            if (role === 'user') totalInput += estTokens;
            else if (role === 'assistant') totalOutput += estTokens;
            // Try to extract model from assistant content
            if (typeof msg?.model === 'string') lastModel = msg.model;
        }
        return [{
            sessionId: taskDir,
            timestamp: firstTs ? new Date(firstTs) : new Date(),
            inputTokens: totalInput || undefined,
            outputTokens: totalOutput || undefined,
            messageCount: arr.length,
            projectPath: path_1.default.dirname(filePath),
            cost,
            model: lastModel,
            provider: 'kilocode',
        }];
    },

    async parseDir(dirPath: string): Promise<ParsedSession[]> {
        const sessions: ParsedSession[] = [];
        let i = 0;
        const walk = async (d: string) => {
            let entries: any[] = [];
            try { entries = fs_1.default.readdirSync(d, { withFileTypes: true }); }
            catch (e: any) { if (e?.code === 'EACCES' || e?.code === 'EBUSY' || e?.code === 'EPERM') return; throw e; }
            for (const ent of entries) {
                const p = path_1.default.join(d, ent.name);
                if (ent.isDirectory()) { await walk(p); continue; }
                if (ent.isFile() && ent.name.toLowerCase() === 'api_conversation_history.json') {
                    const parsed = await this.parse(p);
                    sessions.push(...parsed);
                    if (++i % 10 === 0) await new Promise(r => setImmediate(r));
                }
            }
        };
        try { await walk(dirPath); } catch {}
        return sessions;
    }
};

// Register all plugins
const AI_AGENT_PLUGINS: AIAgentPlugin[] = [
    ClaudeCodePlugin,
    CursorPlugin,
    OpenCodePlugin,
    GeminiPlugin,
    CodexPlugin,
    KiloCodePlugin,
    QwenPlugin,
    AiderPlugin,
];

// Yield control back to the event loop to prevent UI freezing
const yieldToEventLoop = () => new Promise<void>(resolve => setImmediate(resolve));

// Recursively scan a directory for relevant AI agent data files and return
// the count and latest mtime. Used for accurate cache invalidation — directories
// alone don't update their mtime when files inside subdirectories change.
function getDirDataSignature(dirPath: string): { fileCount: number; latestMtime: number } {
    let fileCount = 0;
    let latestMtime = 0;
    const RELEVANT_EXTS = new Set(['.jsonl', '.json', '.db', '.sqlite']);
    function walk(currentDir: string) {
        try {
            const entries = fs_1.default.readdirSync(currentDir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.name === '.' || entry.name === '..') continue;
                const fullPath = path_1.default.join(currentDir, entry.name);
                if (entry.isDirectory()) {
                    walk(fullPath);
                } else if (entry.isFile()) {
                    const ext = path_1.default.extname(entry.name).toLowerCase();
                    if (RELEVANT_EXTS.has(ext)) {
                        fileCount++;
                        try {
                            const stat = fs_1.default.statSync(fullPath);
                            if (stat.mtimeMs > latestMtime) latestMtime = stat.mtimeMs;
                        } catch {}
                    }
                }
            }
        } catch {}
    }
    walk(dirPath);
    return { fileCount, latestMtime };
}

// Unified sync function using plugins
async function syncAllAIAgents(db: any): Promise<Record<string, number>> {
    const results: Record<string, number> = {};
    const syncState = loadAISyncState();

    for (const plugin of AI_AGENT_PLUGINS) {
        try {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('ai-sync-progress', { agent: plugin.id, name: plugin.name, status: 'detecting' });
            }

            // Yield between plugins so UI stays responsive
            await yieldToEventLoop();

            const isDetected = await plugin.detect();
            console.log(`[DeskFlow] ${plugin.name} detected: ${isDetected}`);

            if (!isDetected) continue;

            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('ai-sync-progress', { agent: plugin.id, name: plugin.name, status: 'parsing' });
            }

            const paths = plugin.getStoragePaths();
            console.log(`[DeskFlow] ${plugin.name} paths:`, paths);

            let hasChanges = false;
            const newPathStates: Record<string, { mtime: number; fileCount: number }> = {};

            for (const pluginPath of paths) {
                if (!fs_1.default.existsSync(pluginPath)) {
                    console.log(`[DeskFlow] ${plugin.name} path not found: ${pluginPath}`);
                    continue;
                }

                const stat = fs_1.default.statSync(pluginPath);
                let currentMtime = stat.mtimeMs;
                const prevState = syncState.paths?.[plugin.id]?.[pluginPath];
                let currentFileCount = 0;

                if (stat.isDirectory()) {
                    // For directories, recursively scan for relevant files (.jsonl, .json, .db).
                    // A simple readdirSync on the parent directory misses changes nested in
                    // subdirectories (e.g. ~/.claude/projects/<name>/chats/*.jsonl)
                    const sig = getDirDataSignature(pluginPath);
                    currentFileCount = sig.fileCount;
                    currentMtime = sig.latestMtime;
                } else {
                    currentFileCount = 1;
                }

                newPathStates[pluginPath] = { mtime: currentMtime, fileCount: currentFileCount };

                // Skip if path mtime and file count haven't changed
                if (prevState && prevState.mtime === currentMtime && prevState.fileCount === currentFileCount) {
                    console.log(`[DeskFlow] ${plugin.name}: ${pluginPath} unchanged, skipping`);
                    continue;
                }

                hasChanges = true;
                console.log(`[DeskFlow] ${plugin.name} path changed: ${pluginPath}`);

                let sessions: ParsedSession[] = [];

                if (stat.isDirectory()) {
                    sessions = await plugin.parseDir(pluginPath);
                } else {
                    sessions = await plugin.parse(pluginPath);
                }

                console.log(`[DeskFlow] ${plugin.name} parsed ${sessions.length} sessions`);

                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('ai-sync-progress', { agent: plugin.id, name: plugin.name, status: 'saving', count: sessions.length });
                }

                if (sessions.length === 0) continue;

                // Batch inserts in a transaction for massive speedup
                const insertBatch = db!.prepare(`
                    INSERT OR IGNORE INTO ai_usage (id, tool, date, input_tokens, output_tokens, cache_write_tokens, cache_read_tokens, cost_usd, model, message_count, project_path)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);

                const batchSize = 100;
                for (let i = 0; i < sessions.length; i += batchSize) {
                    const batch = sessions.slice(i, i + batchSize);

                    try {
                        db!.transaction(() => {
                            for (const session of batch) {
                                const id = `${plugin.id}-${session.sessionId}`;
                                const date = session.timestamp.toISOString().split('T')[0];
                                const cost = calculateCost(session);

                                insertBatch.run(
                                    id,
                                    plugin.id,
                                    date,
                                    session.inputTokens,
                                    session.outputTokens,
                                    session.cacheWriteTokens || 0,
                                    session.cacheReadTokens || 0,
                                    cost,
                                    session.model || null,
                                    session.messageCount || 0,
                                    session.projectPath || null
                                );
                                results[plugin.id] = (results[plugin.id] || 0) + 1;
                            }
                        })();
                    } catch (dbErr: any) {
                        if (!dbErr.message.includes('UNIQUE constraint')) {
                            console.error(`[DeskFlow] ${plugin.name} DB insert error:`, dbErr.message);
                        }
                    }

                    // Yield every batch so the UI doesn't freeze
                    await yieldToEventLoop();
                }
            }

            // Update sync state for this agent if paths were checked
            if (Object.keys(newPathStates).length > 0) {
                syncState.paths[plugin.id] = { ...(syncState.paths[plugin.id] || {}), ...newPathStates };
            }
            if (hasChanges || !syncState.agentLastRun[plugin.id]) {
                syncState.agentLastRun[plugin.id] = new Date().toISOString();
            }

            console.log(`[DeskFlow] ${plugin.name}: synced ${results[plugin.id] || 0} usage records`);
        } catch (err: any) {
            console.error(`[DeskFlow] ${plugin.name} sync error:`, err.message);
        }
    }

    // Update global last run
    syncState.lastRunAt = new Date().toISOString();
    saveAISyncState(syncState);

    // Resolve project_id from project_path for all unmatched records
    try {
        const updateStmt = db!.prepare(`
            UPDATE ai_usage SET project_id = (
                SELECT p.id FROM projects p
                WHERE p.path = ai_usage.project_path OR ai_usage.project_path LIKE p.path || '/%'
                LIMIT 1
            )
            WHERE project_id IS NULL AND project_path IS NOT NULL
        `);
        const info = updateStmt.run();
        if (info.changes > 0) {
            console.log(`[DeskFlow] Resolved project_id for ${info.changes} ai_usage records`);
        }
    } catch (err: any) {
        console.error('[DeskFlow] Failed to resolve project_id from project_path:', err.message);
    }

    // Deduplicate ai_usage rows that were duplicated by old random-ID sync (prior to deterministic IDs)
    try {
        const dupInfo = db!.prepare(`
            DELETE FROM ai_usage WHERE rowid NOT IN (
                SELECT MIN(rowid) FROM ai_usage
                GROUP BY tool, date, input_tokens, output_tokens, IFNULL(project_path, ''), IFNULL(model, '')
            )
        `).run();
        if (dupInfo.changes > 0) {
            console.log(`[DeskFlow] 🧹 Deduplicated ${dupInfo.changes} ai_usage rows (old random-ID duplicates)`);
        }
    } catch (err: any) {
        console.error('[DeskFlow] Failed to deduplicate ai_usage:', err.message);
    }

    return results;
}
let categoryConfig = {
    version: 2,
    appCategoryMap: {},
    domainCategoryMap: {},
    appTierMap: {},
    domainTierMap: {},
    tierAssignments: { ...DEFAULT_TIER_ASSIGNMENTS },
    detectedDomains: {},
    detectedApps: {},
    // Keyword-based productivity rules per domain
    domainKeywordRules: {},
    // Per-domain default categories (when keywords don't match)
    domainDefaultCategories: {},
    customCategories: []
};

// Default keyword rules for YouTube - NEW structure: array of { category, keywords }
const DEFAULT_KEYWORD_RULES: Record<string, { category: string; keywords: string[] }[]> = {
    'youtube.com': [
        { 
            category: 'Education', 
            keywords: ['tutorial', 'course', 'lecture', 'learn', 'class', 'university',
            'physics', 'mathematics', 'chemistry', 'biology', 'science',
            'programming', 'coding', 'javascript', 'python', 'typescript', 'react',
            'algorithm', 'data structure', 'web development',
            'crash course', 'lesson', 'study', 'exam', 'revision',
            'masterclass', 'workshop', 'training', 'how to build', 'from scratch']
        },
        { 
            category: 'Entertainment', 
            keywords: ['gaming', 'game', 'stream', 'minecraft', 'fortnite', 'valheim',
            'call of duty', 'dota', 'league', 'esports', 'walkthrough', 'playthrough',
            'funny', 'compilation', 'montage', 'music video']
        },
        { 
            category: 'News', 
            keywords: ['news', 'breaking', 'cnn', 'bbc', ' msn', 'fox', 'politics',
            'election', 'trump', 'biden', 'war', 'climate']
        }
    ]
};

// Default category when keywords don't match (per domain) - now falls back to Category Overrides
function loadCategoryConfig() {
    try {
        if (fs_1.default.existsSync(categoryConfigPath)) {
            const data = fs_1.default.readFileSync(categoryConfigPath, 'utf-8');
            const loaded = JSON.parse(data);
            categoryConfig = {
                ...{
                    version: 2,
                    appCategoryMap: {},
                    domainCategoryMap: {},
                    appTierMap: {},
                    domainTierMap: {},
                    tierAssignments: { ...DEFAULT_TIER_ASSIGNMENTS },
                    detectedDomains: {},
                    detectedApps: {},
                    domainKeywordRules: {},
                    domainDefaultCategories: {},
                    customCategories: []
                },
                ...loaded,
                domainKeywordRules: loaded?.domainKeywordRules || {},
                domainDefaultCategories: loaded?.domainDefaultCategories || {},
                customCategories: loaded?.customCategories || []
            };
            console.log('[DeskFlow] ✅ Loaded category config');
        }
        else {
            // Initialize with defaults on first run
            categoryConfig.domainKeywordRules = { ...DEFAULT_KEYWORD_RULES };
            categoryConfig.domainDefaultCategories = {};
            categoryConfig.customCategories = [];
            saveCategoryConfig();
            console.log('[DeskFlow] ✅ Created default category config');
        }
    }
    catch (err) {
        console.warn('[DeskFlow] Failed to load category config:', err);
        categoryConfig = {
            version: 2,
            appCategoryMap: {},
            domainCategoryMap: {},
            appTierMap: {},
            domainTierMap: {},
            tierAssignments: { ...DEFAULT_TIER_ASSIGNMENTS },
            detectedDomains: {},
            detectedApps: {},
            domainKeywordRules: { ...DEFAULT_KEYWORD_RULES },
            domainDefaultCategories: {},
            customCategories: []
        };
    }
}
function saveCategoryConfig() {
    try {
        fs_1.default.writeFileSync(categoryConfigPath, JSON.stringify(categoryConfig, null, 2));
    }
    catch (err) {
        console.error('[DeskFlow] Failed to save category config:', err);
    }
}
function getTierForCategory(category) {
    const { tierAssignments } = categoryConfig;
    if (tierAssignments.productive.includes(category))
        return 'productive';
    if (tierAssignments.distracting.includes(category))
        return 'distracting';
    return 'neutral';
}
let db = null;
let useJson = false;
let storageError = null;
let jsonLogs = [];
// Initialize storage with robust fallback
function initializeStorage() {
    // Ensure userData directory exists
    try {
        if (!fs_1.default.existsSync(userDataPath)) {
            fs_1.default.mkdirSync(userDataPath, { recursive: true });
        }
    }
    catch (err) {
        console.error('[DeskFlow] Failed to create userData directory:', err.message);
        storageError = `Cannot create data directory: ${err.message}`;
        useJson = true;
        jsonLogs = [];
        return;
    }
    // Try SQLite first
    try {
        const Database = require('better-sqlite3');
        db = new Database(dbPath);
        // Enable WAL mode for concurrent access + busy timeout to survive transient locks
        db.pragma('journal_mode = WAL');
        db.pragma('busy_timeout = 5000');
        db.exec(`
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        app TEXT NOT NULL,
        category TEXT NOT NULL,
        duration_ms INTEGER NOT NULL,
        title TEXT,
        project TEXT,
        keystrokes INTEGER DEFAULT 0,
        clicks INTEGER DEFAULT 0,
        window_switches INTEGER DEFAULT 0,
        url TEXT,
        domain TEXT,
        tab_id INTEGER,
        is_browser_tracking INTEGER DEFAULT 0
      )
    `);
        // Add columns if they don't exist (migration for existing databases)
        try {
            db.exec('ALTER TABLE logs ADD COLUMN url TEXT');
        }
        catch { /* column exists */ }
        try {
            db.exec('ALTER TABLE logs ADD COLUMN domain TEXT');
        }
        catch { /* column exists */ }
        try {
            db.exec('ALTER TABLE logs ADD COLUMN tab_id INTEGER');
        }
        catch { /* column exists */ }
        try {
            db.exec('ALTER TABLE logs ADD COLUMN is_browser_tracking INTEGER DEFAULT 0');
        }
        catch { /* column exists */ }
        // Add productivity columns to daily_stats if they don't exist
        try {
            db.exec('ALTER TABLE daily_stats ADD COLUMN productivity_type TEXT DEFAULT \'unknown\'');
        }
        catch { /* column exists */ }
        try {
            db.exec('ALTER TABLE daily_stats ADD COLUMN total_time_sec INTEGER DEFAULT 0');
        }
        catch { /* column exists */ }
        try {
            db.exec('ALTER TABLE daily_stats ADD COLUMN focus_time_sec INTEGER DEFAULT 0');
        }
        catch { /* column exists */ }
        // Daily stats aggregation table with productivity tracking
        db.exec(`
      CREATE TABLE IF NOT EXISTS daily_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        app TEXT NOT NULL,
        category TEXT NOT NULL,
        total_sec INTEGER NOT NULL DEFAULT 0,
        sessions INTEGER NOT NULL DEFAULT 0,
        avg_session_sec REAL NOT NULL DEFAULT 0,
        keystrokes INTEGER DEFAULT 0,
        clicks INTEGER DEFAULT 0,
        focus_score REAL DEFAULT 0,
        productivity_type TEXT DEFAULT 'unknown',
        total_time_sec INTEGER DEFAULT 0,
        focus_time_sec INTEGER DEFAULT 0,
        UNIQUE(date, app)
      )
    `);
        // New sessions table - tracks active sessions with UPDATE instead of INSERT
        db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app TEXT NOT NULL,
        category TEXT,
        start_time TEXT,
        end_time TEXT,
        duration_sec INTEGER DEFAULT 0,
        domain TEXT,
        url TEXT,
        title TEXT,
        is_active INTEGER DEFAULT 1
      )
    `);
        // New daily_aggregates table - pre-computed for heatmap/planets
        db.exec(`
      CREATE TABLE IF NOT EXISTS daily_aggregates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        app TEXT NOT NULL,
        category TEXT,
        total_sec INTEGER DEFAULT 0,
        session_count INTEGER DEFAULT 0,
        UNIQUE(date, app)
      )
    `);
        // New browser_sessions table - aggregated browser data
        db.exec(`
      CREATE TABLE IF NOT EXISTS browser_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        domain TEXT NOT NULL,
        category TEXT,
        total_sec INTEGER DEFAULT 0,
        session_count INTEGER DEFAULT 0,
        UNIQUE(date, domain)
      )
    `);

        // ========== IDE Projects Tables ==========
        // IDE installations
        db.exec(`
      CREATE TABLE IF NOT EXISTS ides (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        version TEXT,
        install_path TEXT,
        last_opened DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Extensions for each IDE
        db.exec(`
      CREATE TABLE IF NOT EXISTS extensions (
        id TEXT PRIMARY KEY,
        ide_id TEXT REFERENCES ides(id),
        publisher TEXT,
        name TEXT NOT NULL,
        version TEXT,
        enabled INTEGER DEFAULT 1,
        install_date DATETIME
      )
    `);

        // Detected development tools
        db.exec(`
      CREATE TABLE IF NOT EXISTS tools (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        version TEXT,
        install_path TEXT,
        detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        detection_method TEXT
      )
    `);

        // Tracked projects
        db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        repository_url TEXT,
        vcs_type TEXT,
        primary_language TEXT,
        default_ide TEXT,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_activity_at DATETIME,
        deleted_at DATETIME
      )
    `);

        // Project-Tool relationship
        db.exec(`
      CREATE TABLE IF NOT EXISTS project_tools (
        project_id TEXT REFERENCES projects(id),
        tool_id TEXT REFERENCES tools(id),
        PRIMARY KEY (project_id, tool_id)
      )
    `);

        // AI Usage tracking
        db.exec(`
      CREATE TABLE IF NOT EXISTS ai_usage (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id),
        tool TEXT NOT NULL,
        date DATE NOT NULL,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        cache_write_tokens INTEGER DEFAULT 0,
        cache_read_tokens INTEGER DEFAULT 0,
        cost_usd REAL DEFAULT 0,
        model TEXT,
        message_count INTEGER DEFAULT 0,
        project_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // Safe migration for existing databases
        try { db.exec('ALTER TABLE ai_usage ADD COLUMN message_count INTEGER DEFAULT 0'); } catch {}
        try { db.exec('ALTER TABLE ai_usage ADD COLUMN project_path TEXT'); } catch {}
        db.exec('CREATE INDEX IF NOT EXISTS idx_ai_usage_date ON ai_usage(date)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_ai_usage_tool ON ai_usage(tool)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_ai_usage_project_path ON ai_usage(project_path)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_ai_usage_tool_date ON ai_usage(tool, date)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_ai_usage_date_tool ON ai_usage(date, tool)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_ai_usage_tool_project ON ai_usage(tool, project_path)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_ai_usage_tool_model ON ai_usage(tool, model)');

        // AI Features: briefs cache
        db.exec(`
      CREATE TABLE IF NOT EXISTS ai_briefs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        date TEXT NOT NULL,
        content TEXT,
        model_used TEXT,
        tokens_used INTEGER,
        created_at TEXT NOT NULL,
        UNIQUE(type, date)
      )
    `);

        // AI Features: user interest topics
        db.exec(`
      CREATE TABLE IF NOT EXISTS ai_interests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic TEXT NOT NULL UNIQUE,
        enabled INTEGER DEFAULT 1,
        created_at TEXT NOT NULL
      )
    `);

        // AI Features: token/cost tracking
        db.exec(`
      CREATE TABLE IF NOT EXISTS ai_feature_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        feature TEXT NOT NULL,
        model TEXT NOT NULL,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        cost_usd REAL DEFAULT 0,
        success INTEGER DEFAULT 1,
        created_at TEXT NOT NULL
      )
    `);
        db.exec('CREATE INDEX IF NOT EXISTS idx_ai_feature_date ON ai_feature_usage(date)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_ai_feature_feature ON ai_feature_usage(feature)');

        // Commit metrics
        db.exec(`
      CREATE TABLE IF NOT EXISTS commits (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id),
        sha TEXT NOT NULL,
        author TEXT,
        author_email TEXT,
        date DATETIME NOT NULL,
        message TEXT,
        additions INTEGER DEFAULT 0,
        deletions INTEGER DEFAULT 0,
        files_changed INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
        db.exec('CREATE INDEX IF NOT EXISTS idx_commits_project ON commits(project_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_commits_date ON commits(date)');

        // AI attribution for commits
        db.exec(`
      CREATE TABLE IF NOT EXISTS ai_attribution (
        commit_id TEXT PRIMARY KEY REFERENCES commits(id),
        tool TEXT,
        lines_ai_added INTEGER DEFAULT 0,
        lines_ai_deleted INTEGER DEFAULT 0,
        lines_human_added INTEGER DEFAULT 0
      )
    `);

        // DORA metrics
        db.exec(`
      CREATE TABLE IF NOT EXISTS dora_metrics (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id),
        period TEXT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        deployment_frequency REAL,
        lead_time_hours REAL,
        change_failure_rate REAL,
        mean_time_to_recovery_hours REAL,
        level TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
        db.exec('CREATE INDEX IF NOT EXISTS idx_dora_project ON dora_metrics(project_id)');

        // Terminal layouts
        db.exec(`
            CREATE TABLE IF NOT EXISTS terminal_layouts (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              project_id TEXT,
              layout_data TEXT,
              is_active INTEGER DEFAULT 0,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Terminal presets
        db.exec(`
            CREATE TABLE IF NOT EXISTS terminal_presets (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              command TEXT NOT NULL,
              project_id TEXT,
              working_directory TEXT,
              category TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Terminal sessions
        db.exec(`
            CREATE TABLE IF NOT EXISTS terminal_sessions (
              id TEXT PRIMARY KEY,
              preset_id TEXT,
              project_id TEXT,
              agent TEXT,
              resume_id TEXT,
              topic TEXT,
              working_directory TEXT,
              terminal_id TEXT,
              total_tokens INTEGER DEFAULT 0,
              total_cost REAL DEFAULT 0,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Safe migrations for existing databases
        try { db.exec('ALTER TABLE terminal_presets ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP'); } catch {}
        try { db.exec('ALTER TABLE terminal_sessions ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP'); } catch {}
        try { db.exec('ALTER TABLE terminal_sessions ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP'); } catch {}
        try { db.exec('ALTER TABLE terminal_sessions ADD COLUMN total_tokens INTEGER DEFAULT 0'); } catch {}
        try { db.exec('ALTER TABLE terminal_sessions ADD COLUMN total_cost REAL DEFAULT 0'); } catch {}
        try { db.exec('ALTER TABLE terminal_sessions ADD COLUMN terminal_id TEXT'); } catch {}
        // Session categorization columns (v3.3+)
        try { db.exec("ALTER TABLE terminal_sessions ADD COLUMN category TEXT DEFAULT 'other'"); } catch {}
        try { db.exec("ALTER TABLE terminal_sessions ADD COLUMN status TEXT DEFAULT 'active'"); } catch {}
        try { db.exec("ALTER TABLE terminal_sessions ADD COLUMN product_area TEXT DEFAULT ''"); } catch {}
        try { db.exec("ALTER TABLE terminal_sessions ADD COLUMN description TEXT DEFAULT ''"); } catch {}
        try { db.exec("ALTER TABLE terminal_sessions ADD COLUMN auto_tags TEXT DEFAULT '[]'"); } catch {}
        try { db.exec('ALTER TABLE terminal_sessions ADD COLUMN category_confirmed INTEGER DEFAULT 0'); } catch {}
        try { db.exec("ALTER TABLE terminal_sessions ADD COLUMN subpage TEXT DEFAULT 'work/sessions'"); } catch {}
        try { db.exec('ALTER TABLE workspace_problems ADD COLUMN session_id TEXT'); } catch {}

        // Collaborative Debugging System — Bug Reports
        db.exec(`
            CREATE TABLE IF NOT EXISTS bug_reports (
              id TEXT PRIMARY KEY,
              project_id TEXT NOT NULL,
              title TEXT DEFAULT '',
              error_text TEXT NOT NULL,
              status TEXT DEFAULT 'pending' CHECK(status IN ('pending','investigating','identified','not_my_issue','fixed','ignored')),
              agent_responses TEXT DEFAULT '[]',
              linked_problem_id TEXT,
              flow_type TEXT DEFAULT 'manual' CHECK(flow_type IN ('manual','auto-consult','research')),
              root_cause_report TEXT,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Session parsed items (decisions, action items, references)
        db.exec(`
            CREATE TABLE IF NOT EXISTS session_parsed_items (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              session_id TEXT NOT NULL,
              item_type TEXT NOT NULL CHECK(item_type IN ('decision', 'action_item', 'status_change', 'reference')),
              content TEXT NOT NULL,
              source_message_id INTEGER,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Terminal messages (chat history for terminal sessions)
        db.exec(`
            CREATE TABLE IF NOT EXISTS terminal_messages (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              session_id TEXT NOT NULL,
              role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
              content TEXT NOT NULL,
              status TEXT DEFAULT 'completed',
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        try { db.exec(`ALTER TABLE terminal_messages ADD COLUMN status TEXT DEFAULT 'completed'`); } catch (_e) {}

        // Workspace state persistence (v2: supports named instances)
        db.exec(`
            CREATE TABLE IF NOT EXISTS workspace_state (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              project_id TEXT NOT NULL,
              name TEXT NOT NULL DEFAULT 'default',
              is_active INTEGER DEFAULT 0,
              scope TEXT DEFAULT 'project',
              sidebar_width INTEGER DEFAULT 400,
              active_tab TEXT DEFAULT 'presets',
              terminal_tabs TEXT DEFAULT '[]',
              state_json TEXT,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(project_id, name)
            )
        `);
        try { db.exec(`ALTER TABLE workspace_state ADD COLUMN scope TEXT DEFAULT 'project'`); } catch (_e) {}
        try { db.exec(`ALTER TABLE workspace_state ADD COLUMN state_json TEXT`); } catch (_e) {}
        try { db.exec(`ALTER TABLE workspace_state ADD COLUMN name TEXT NOT NULL DEFAULT 'default'`); } catch (_e) {}
        try { db.exec(`ALTER TABLE workspace_state ADD COLUMN is_active INTEGER DEFAULT 0`); } catch (_e) {}
        // If the old UNIQUE(project_id) schema exists, migrate to new schema
        try {
            // Remove any rows without a name (legacy from old schema)
            db.exec(`UPDATE workspace_state SET name = 'default', is_active = 1 WHERE name IS NULL OR name = ''`);
            // Drop the old UNIQUE constraint by recreating — since we can't ALTER DROP in SQLite,
            // we just proceed with the new table. The old UNIQUE(project_id) is silently replaced.
            try { db.exec(`DROP INDEX IF EXISTS sqlite_autoindex_workspace_state_1`); } catch (_e) {}
        } catch (_e) {}

        // Terminal bindings (terminal → project/agent/problem association)
        db.exec(`
            CREATE TABLE IF NOT EXISTS terminal_bindings (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              terminal_id TEXT NOT NULL UNIQUE,
              project_id TEXT,
              agent_type TEXT,
              session_id TEXT,
              active_problem_id TEXT,
              active_request_id TEXT,
              status TEXT DEFAULT 'active',
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // ========== Workspace Problems & Requests Tables ==========
        db.exec(`
          CREATE TABLE IF NOT EXISTS workspace_problems (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            status TEXT DEFAULT 'NEW',
            priority TEXT DEFAULT 'medium',
            category TEXT DEFAULT 'other',
            user_notes TEXT,
            fix_description TEXT,
            root_cause TEXT,
            files TEXT DEFAULT '[]',
            project_id TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
          )
        `);
        db.exec(`
          CREATE TABLE IF NOT EXISTS workspace_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'Pending',
            priority TEXT DEFAULT 'Medium',
            category TEXT DEFAULT 'Feature',
            linked_problems TEXT DEFAULT '[]',
            project_id TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
          )
        `);

        // ========== External Activities Tables ==========
        // External activities definition table
        db.exec(`
          CREATE TABLE IF NOT EXISTS external_activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('stopwatch', 'sleep', 'checkin')),
            color TEXT DEFAULT '#6366f1',
            icon TEXT DEFAULT 'Clock',
            default_duration INTEGER DEFAULT 30,
            is_default INTEGER DEFAULT 0,
            is_visible INTEGER DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // External sessions tracking table
        db.exec(`
          CREATE TABLE IF NOT EXISTS external_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            activity_id INTEGER NOT NULL,
            started_at TEXT NOT NULL,
            ended_at TEXT,
            duration_seconds INTEGER DEFAULT 0,
            notes TEXT,
            device_off_to_sleep_seconds INTEGER DEFAULT 0,
            wake_up_to_app_seconds INTEGER DEFAULT 0,
            FOREIGN KEY (activity_id) REFERENCES external_activities(id)
          )
        `);
        
        // Add extra columns to existing tables if they don't exist
        try { db.exec('ALTER TABLE external_sessions ADD COLUMN device_off_to_sleep_seconds INTEGER DEFAULT 0'); } catch {}
        try { db.exec('ALTER TABLE external_sessions ADD COLUMN wake_up_to_app_seconds INTEGER DEFAULT 0'); } catch {}

        // Productivity sessions tracking table
        db.exec(`
          CREATE TABLE IF NOT EXISTS productivity_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            started_at TEXT NOT NULL,
            ended_at TEXT,
            duration_seconds INTEGER DEFAULT 0,
            app_name TEXT,
            category TEXT,
            is_streak INTEGER DEFAULT 0,
            day INTEGER,
            week_number INTEGER,
            month INTEGER,
            created_at TEXT DEFAULT (datetime('now'))
          )
        `);
        try { db.exec('CREATE INDEX IF NOT EXISTS idx_productivity_sessions_started ON productivity_sessions(started_at)'); } catch {}

        // External tracker settings
        db.exec(`
          CREATE TABLE IF NOT EXISTS external_settings (
            key TEXT PRIMARY KEY,
            value TEXT
          )
        `);

        // Activity log for tracking who changed what and when
        db.exec(`
          CREATE TABLE IF NOT EXISTS activity_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_type TEXT NOT NULL CHECK(entity_type IN ('problem', 'request', 'session', 'checklist', 'skill')),
            entity_id TEXT NOT NULL,
            entity_title TEXT,
            action TEXT NOT NULL,
            actor TEXT NOT NULL,
            summary TEXT NOT NULL,
            details TEXT,
            created_at TEXT DEFAULT (datetime('now'))
          )
        `);
        try { db.exec('CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id)'); } catch {}
        try { db.exec('CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at)'); } catch {}

        // ═══════════════════════════════════════════════════════════════════════
        // PRE-AGGREGATED STATS TABLES (Performance optimization)
        // ═══════════════════════════════════════════════════════════════════════

        db.exec(`
          CREATE TABLE IF NOT EXISTS stats_hourly (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            hour INTEGER NOT NULL,
            app_name TEXT NOT NULL,
            app_type TEXT,
            category TEXT,
            total_seconds REAL DEFAULT 0,
            session_count INTEGER DEFAULT 0,
            UNIQUE(date, hour, app_name)
          )
        `);

        db.exec(`
          CREATE TABLE IF NOT EXISTS stats_daily (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            app_name TEXT NOT NULL,
            app_type TEXT,
            category TEXT,
            total_seconds REAL DEFAULT 0,
            session_count INTEGER DEFAULT 0,
            UNIQUE(date, app_name)
          )
        `);

        db.exec(`
          CREATE TABLE IF NOT EXISTS app_totals (
            app_name TEXT PRIMARY KEY,
            app_type TEXT,
            category TEXT,
            total_seconds REAL DEFAULT 0,
            session_count INTEGER DEFAULT 0,
            last_seen TEXT
          )
        `);

        // Routing costs table (auto-assign infrastructure tracking)
        db.exec(`
          CREATE TABLE IF NOT EXISTS routing_costs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL DEFAULT (datetime('now')),
            call_type TEXT NOT NULL,
            model TEXT NOT NULL,
            input_tokens INTEGER DEFAULT 0,
            output_tokens INTEGER DEFAULT 0,
            cost_usd REAL DEFAULT 0,
            session_id TEXT,
            prompt_preview TEXT
          )
        `);
        db.exec('CREATE INDEX IF NOT EXISTS idx_routing_costs_timestamp ON routing_costs(timestamp)');

        // Goals table (AI goal tracking)
        db.exec(`
          CREATE TABLE IF NOT EXISTS goals (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            category TEXT NOT NULL DEFAULT 'work',
            target_type TEXT NOT NULL DEFAULT 'time',
            target_seconds INTEGER,
            match_category TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            period TEXT NOT NULL DEFAULT 'daily',
            source TEXT NOT NULL DEFAULT 'manual',
            links TEXT DEFAULT '[]',
            progress_seconds INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            completed_at TEXT
          )
        `);
        db.exec('CREATE INDEX IF NOT EXISTS idx_goals_date ON goals(date)');
        try { db.exec('ALTER TABLE goals ADD COLUMN priority INTEGER DEFAULT 0'); } catch {} // may already exist
        try { db.exec('ALTER TABLE goals ADD COLUMN parent_id TEXT'); } catch {} // goal hierarchy

        // Category overrides table (for tier mapping)
        db.exec(`
          CREATE TABLE IF NOT EXISTS category_overrides (
            app TEXT PRIMARY KEY,
            category TEXT NOT NULL
          )
        `);

        // Goal reviews table
        db.exec(`
          CREATE TABLE IF NOT EXISTS goal_reviews (
            date TEXT PRIMARY KEY,
            review_summary TEXT,
            suggestions TEXT DEFAULT '[]',
            created_at TEXT DEFAULT (datetime('now'))
          )
        `);

        db.exec(`
          CREATE TABLE IF NOT EXISTS touched_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            terminal_id TEXT NOT NULL,
            session_id TEXT,
            file_path TEXT NOT NULL,
            action TEXT NOT NULL DEFAULT 'edit',
            project_path TEXT,
            timestamp TEXT DEFAULT (datetime('now'))
          )
        `);
        db.exec('CREATE INDEX IF NOT EXISTS idx_touched_files_terminal ON touched_files(terminal_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_touched_files_path ON touched_files(file_path)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_touched_files_timestamp ON touched_files(timestamp)');

        // ========== Finance Tables ==========
        db.exec(`
          CREATE TABLE IF NOT EXISTS finance_accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('personal','joint','custodial','business')),
            description TEXT,
            icon TEXT DEFAULT 'Wallet',
            color TEXT DEFAULT '#10b981',
            currency TEXT DEFAULT 'USD',
            balance REAL DEFAULT 0.0,
            is_archived INTEGER DEFAULT 0,
            parent_account_id INTEGER,
            created_at DATETIME DEFAULT (datetime('now','localtime')),
            updated_at DATETIME DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (parent_account_id) REFERENCES finance_accounts(id)
          )
        `);
        db.exec(`
          CREATE TABLE IF NOT EXISTS finance_wallets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('bank','debit_card','credit_card','crypto','cash','ewallet','other')),
            provider TEXT,
            last_four TEXT,
            balance REAL DEFAULT 0.0,
            currency TEXT DEFAULT 'USD',
            is_archived INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT (datetime('now','localtime')),
            updated_at DATETIME DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (account_id) REFERENCES finance_accounts(id)
          )
        `);
        db.exec(`
          CREATE TABLE IF NOT EXISTS finance_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('income','expense','transfer')),
            icon TEXT DEFAULT 'CircleDollarSign',
            color TEXT DEFAULT '#10b981',
            sort_order INTEGER DEFAULT 0,
            is_archived INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT (datetime('now','localtime'))
          )
        `);
        db.exec(`
          CREATE TABLE IF NOT EXISTS finance_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            wallet_id INTEGER,
            category_id INTEGER NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('income','expense','transfer')),
            amount REAL NOT NULL,
            description TEXT,
            note TEXT,
            date TEXT NOT NULL,
            time TEXT,
            is_recurring INTEGER DEFAULT 0,
            recurring_interval TEXT,
            tags TEXT,
            created_at DATETIME DEFAULT (datetime('now','localtime')),
            updated_at DATETIME DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (account_id) REFERENCES finance_accounts(id),
            FOREIGN KEY (wallet_id) REFERENCES finance_wallets(id),
            FOREIGN KEY (category_id) REFERENCES finance_categories(id)
          )
        `);
        db.exec(`
          CREATE TABLE IF NOT EXISTS finance_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
          )
        `);
        db.exec('CREATE INDEX IF NOT EXISTS idx_finance_txn_account ON finance_transactions(account_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_finance_txn_date ON finance_transactions(date)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_finance_txn_category ON finance_transactions(category_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_finance_txn_type ON finance_transactions(type)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_finance_wallet_account ON finance_wallets(account_id)');

        // Safe migrations for existing databases
        try { db.exec('ALTER TABLE finance_wallets ADD COLUMN metadata TEXT'); } catch { /* column exists */ }
        // Add 'physical' to finance_wallets type CHECK constraint (old tables missing it)
        try {
          const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='finance_wallets'").get() as any;
          if (row?.sql && !row.sql.includes("'physical'")) {
            db.exec('ALTER TABLE finance_wallets RENAME TO finance_wallets_old');
            db.exec(`
              CREATE TABLE finance_wallets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                type TEXT NOT NULL CHECK(type IN ('bank','debit_card','credit_card','crypto','cash','physical','ewallet','other')),
                provider TEXT, last_four TEXT, balance REAL DEFAULT 0.0,
                currency TEXT DEFAULT 'USD', is_archived INTEGER DEFAULT 0,
                metadata TEXT,
                created_at DATETIME DEFAULT (datetime('now','localtime')),
                updated_at DATETIME DEFAULT (datetime('now','localtime')),
                FOREIGN KEY (account_id) REFERENCES finance_accounts(id)
              )
            `);
            db.exec('INSERT INTO finance_wallets SELECT id,account_id,name,type,provider,last_four,balance,currency,is_archived,metadata,created_at,updated_at FROM finance_wallets_old');
            db.exec('DROP TABLE finance_wallets_old');
            console.log('[DB MIGRATION] finance_wallets CHECK constraint updated to include physical');
          }
        } catch (e: any) { console.log('[DB MIGRATION] wallets CHECK skip:', e?.message); }

        db.exec(`
          CREATE TABLE IF NOT EXISTS finance_crypto_prices (
            coin_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            symbol TEXT NOT NULL,
            current_price REAL NOT NULL,
            market_cap REAL,
            total_volume REAL,
            price_change_24h REAL,
            price_change_percentage_24h REAL,
            last_updated TEXT NOT NULL
          )
        `);
        db.exec(`
          CREATE TABLE IF NOT EXISTS finance_crypto_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            coin_id TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            price REAL NOT NULL,
            UNIQUE(coin_id, timestamp)
          )
        `);
        db.exec('CREATE INDEX IF NOT EXISTS idx_finance_crypto_history_coin ON finance_crypto_history(coin_id)');

        // Seed default categories (only if empty)
        const existingCats = db.prepare('SELECT COUNT(*) as count FROM finance_categories').get() as { count: number };
        if (existingCats.count === 0) {
          const insertCat = db.prepare('INSERT INTO finance_categories (name, type, icon, color, sort_order) VALUES (?, ?, ?, ?, ?)');
          const seedCats: [string, string, string, string, number][] = [
            ['Salary', 'income', 'CircleDollarSign', '#10b981', 1],
            ['Freelance', 'income', 'CircleDollarSign', '#34d399', 2],
            ['Gift', 'income', 'CircleDollarSign', '#6ee7b7', 3],
            ['Interest', 'income', 'CircleDollarSign', '#a7f3d0', 4],
            ['Refund', 'income', 'CircleDollarSign', '#6ee7b7', 5],
            ['Food & Groceries', 'expense', 'TrendingDown', '#ef4444', 6],
            ['Transport', 'expense', 'TrendingDown', '#f97316', 7],
            ['Housing', 'expense', 'TrendingDown', '#f59e0b', 8],
            ['Utilities', 'expense', 'TrendingDown', '#eab308', 9],
            ['Entertainment', 'expense', 'TrendingDown', '#ec4899', 10],
            ['Shopping', 'expense', 'TrendingDown', '#d946ef', 11],
            ['Health', 'expense', 'TrendingDown', '#8b5cf6', 12],
            ['Education', 'expense', 'TrendingDown', '#6366f1', 13],
            ['Other', 'expense', 'TrendingDown', '#52525b', 14],
            ['Transfer', 'transfer', 'ArrowLeftRight', '#f59e0b', 15],
          ];
          const insertMany = db.transaction((cats: [string, string, string, string, number][]) => {
            for (const c of cats) insertCat.run(...c);
          });
          insertMany(seedCats);
        }

        // Safe migration for auto_named column
        try { db.exec("ALTER TABLE terminal_sessions ADD COLUMN auto_named INTEGER DEFAULT 0"); } catch {}
        try { db.exec("ALTER TABLE terminal_sessions ADD COLUMN subpage TEXT DEFAULT 'work/sessions'"); } catch {}

        // Indexes for fast queries
        db.exec('CREATE INDEX IF NOT EXISTS idx_stats_hourly_date ON stats_hourly(date)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_stats_daily_date ON stats_daily(date)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_stats_hourly_app ON stats_hourly(app_name)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_stats_daily_app ON stats_daily(app_name)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_stats_daily_date_apptype ON stats_daily(date, app_type)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_stats_hourly_date_hour ON stats_hourly(date, hour)');
        // Covering index for get-dashboard-data hourly query (includes app_type + total_seconds to avoid table access)
        db.exec('CREATE INDEX IF NOT EXISTS idx_stats_hourly_date_hour_type_sec ON stats_hourly(date, hour, app_type, total_seconds)');
        // Covering index for get-dashboard-data top-apps/top-domains queries
        db.exec('CREATE INDEX IF NOT EXISTS idx_stats_daily_date_type_name_sec ON stats_daily(date, app_type, app_name, total_seconds, session_count)');
        // Covering index for get-dashboard-aggregates weekly heatmap (date + app_name + total_seconds)
        db.exec('CREATE INDEX IF NOT EXISTS idx_stats_daily_date_app_sec ON stats_daily(date, app_name, total_seconds)');

        // Triggers for auto-aggregation
        db.exec(`
          CREATE TRIGGER IF NOT EXISTS trg_update_hourly
          AFTER INSERT ON logs
          WHEN NEW.duration_ms > 0
          BEGIN
            INSERT OR REPLACE INTO stats_hourly (date, hour, app_name, app_type, category, total_seconds, session_count)
            SELECT 
              DATE(NEW.timestamp),
              CAST(STRFTIME('%H', NEW.timestamp) AS INTEGER),
              COALESCE(NEW.domain, NEW.app),
              CASE WHEN NEW.domain IS NOT NULL THEN 'domain' ELSE 'app' END,
              NEW.category,
              COALESCE((
                SELECT total_seconds FROM stats_hourly 
                WHERE date = DATE(NEW.timestamp) 
                  AND hour = CAST(STRFTIME('%H', NEW.timestamp) AS INTEGER)
                  AND app_name = COALESCE(NEW.domain, NEW.app)
              ), 0) + (CAST(NEW.duration_ms AS REAL) / 1000.0),
              COALESCE((
                SELECT session_count FROM stats_hourly 
                WHERE date = DATE(NEW.timestamp) 
                  AND hour = CAST(STRFTIME('%H', NEW.timestamp) AS INTEGER)
                  AND app_name = COALESCE(NEW.domain, NEW.app)
              ), 0) + 1;
          END
        `);

        db.exec(`
          CREATE TRIGGER IF NOT EXISTS trg_update_daily
          AFTER INSERT ON logs
          WHEN NEW.duration_ms > 0
          BEGIN
            INSERT OR REPLACE INTO stats_daily (date, app_name, app_type, category, total_seconds, session_count)
            VALUES (
              DATE(NEW.timestamp),
              COALESCE(NEW.domain, NEW.app),
              CASE WHEN NEW.domain IS NOT NULL THEN 'domain' ELSE 'app' END,
              NEW.category,
              COALESCE((SELECT SUM(total_seconds) FROM stats_daily 
               WHERE date = DATE(NEW.timestamp) AND app_name = COALESCE(NEW.domain, NEW.app)), 0) + (CAST(NEW.duration_ms AS REAL) / 1000.0),
              COALESCE((SELECT SUM(session_count) FROM stats_daily 
               WHERE date = DATE(NEW.timestamp) AND app_name = COALESCE(NEW.domain, NEW.app)), 0) + 1
            );
            INSERT OR REPLACE INTO app_totals (app_name, app_type, category, total_seconds, session_count, last_seen)
            VALUES (
              COALESCE(NEW.domain, NEW.app),
              CASE WHEN NEW.domain IS NOT NULL THEN 'domain' ELSE 'app' END,
              NEW.category,
              COALESCE((SELECT total_seconds FROM app_totals WHERE app_name = COALESCE(NEW.domain, NEW.app)), 0) + (CAST(NEW.duration_ms AS REAL) / 1000.0),
              COALESCE((SELECT session_count FROM app_totals WHERE app_name = COALESCE(NEW.domain, NEW.app)), 0) + 1,
              NEW.timestamp
            );
          END
        `);

        // Seed default external activities if table is empty
        const activityCount = db.prepare('SELECT COUNT(*) as count FROM external_activities').get();
        if (activityCount.count === 0) {
          const defaultActivities = [
            { name: 'AFK', type: 'stopwatch', color: '#6b7280', icon: 'Coffee', default_duration: 60, sort_order: 0 },
            { name: 'Studying (Paper)', type: 'stopwatch', color: '#8b5cf6', icon: 'BookOpen', sort_order: 1 },
            { name: 'Exercise', type: 'stopwatch', color: '#10b981', icon: 'Dumbbell', sort_order: 2 },
            { name: 'Gym', type: 'stopwatch', color: '#f59e0b', icon: 'Activity', sort_order: 3 },
            { name: 'Commute', type: 'stopwatch', color: '#6366f1', icon: 'Bus', sort_order: 4 },
            { name: 'Reading', type: 'stopwatch', color: '#ec4899', icon: 'Book', sort_order: 5 },
            { name: 'Sleep', type: 'sleep', color: '#3b82f6', icon: 'Moon', sort_order: 6 },
            { name: 'Eating', type: 'stopwatch', color: '#ef4444', icon: 'Utensils', default_duration: 30, sort_order: 7 },
            { name: 'Short Break', type: 'stopwatch', color: '#14b8a6', icon: 'Coffee', default_duration: 15, sort_order: 8 },
          ];
          const insertStmt = db.prepare(`
            INSERT INTO external_activities (name, type, color, icon, default_duration, is_default, sort_order)
            VALUES (?, ?, ?, ?, ?, 1, ?)
          `);
          for (const act of defaultActivities) {
            insertStmt.run(act.name, act.type, act.color, act.icon, act.default_duration || 30, act.sort_order);
          }
          console.log('[DeskFlow] ✅ Seeded', defaultActivities.length, 'default external activities');
        }

        console.log('[DeskFlow] ✅ SQLite database initialized at', dbPath);

        // Backfill stats tables from existing logs (runs once)
        backfillStatsTables(db);

        storageError = null;
    }
    catch (err) {
        console.warn('[DeskFlow] ⚠️ SQLite failed, falling back to JSON:', err.message);
        storageError = `SQLite error: ${err.message}. Using JSON fallback.`;
        useJson = true;
        // Initialize JSON storage
        try {
            if (fs_1.default.existsSync(jsonPath)) {
                const data = fs_1.default.readFileSync(jsonPath, 'utf-8');
                jsonLogs = JSON.parse(data);
                console.log('[DeskFlow] 📄 Loaded', jsonLogs.length, 'logs from JSON');
            }
            else {
                // Create fresh JSON file
                jsonLogs = [];
                fs_1.default.writeFileSync(jsonPath, JSON.stringify([], null, 2));
                console.log('[DeskFlow] 📄 Created new JSON storage file');
            }
        }
        catch (e) {
            console.error('[DeskFlow] ❌ Failed to initialize JSON storage:', e.message);
            storageError = `JSON storage error: ${e.message}. Data will NOT persist!`;
            jsonLogs = [];
        }
    }
}
function saveJsonLogs() {
    if (useJson) {
        try {
            fs_1.default.writeFileSync(jsonPath, JSON.stringify(jsonLogs, null, 2));
        }
        catch (err) {
            console.error('[DeskFlow] Failed to save JSON logs:', err);
        }
    }
}
// --- Helper functions ---
function backfillStatsTables(db: any) {
    try {
        const logCount = db.prepare("SELECT COUNT(*) as cnt FROM logs WHERE duration_ms > 0").get() as any;
        if (logCount.cnt === 0) {
            console.log('[Backfill] No logs to backfill from, skipping.');
            return;
        }
        console.log(`[Backfill] Rebuilding stats_daily and stats_hourly from ${logCount.cnt} logs...`);
        db.exec("DELETE FROM stats_daily");
        db.exec("DELETE FROM stats_hourly");
        db.exec(`
            INSERT INTO stats_hourly (date, hour, app_name, app_type, category, total_seconds, session_count)
            SELECT 
                DATE(timestamp),
                CAST(STRFTIME('%H', timestamp) AS INTEGER),
                COALESCE(domain, app),
                CASE WHEN domain IS NOT NULL THEN 'domain' ELSE 'app' END,
                category,
                SUM(CAST(duration_ms AS REAL) / 1000.0),
                COUNT(*)
            FROM logs
            WHERE duration_ms > 0
            GROUP BY DATE(timestamp), CAST(STRFTIME('%H', timestamp) AS INTEGER), COALESCE(domain, app)
        `);
        db.exec(`
            INSERT INTO stats_daily (date, app_name, app_type, category, total_seconds, session_count)
            SELECT 
                DATE(timestamp),
                COALESCE(domain, app),
                CASE WHEN domain IS NOT NULL THEN 'domain' ELSE 'app' END,
                category,
                SUM(CAST(duration_ms AS REAL) / 1000.0),
                COUNT(*)
            FROM logs
            WHERE duration_ms > 0
            GROUP BY DATE(timestamp), COALESCE(domain, app)
        `);
        // Aggregate per-day totals for the configured browser app (synthetic entry)
        if (userPreferences?.browserWithExtension) {
            const browserApp = userPreferences.browserWithExtension.replace(/'/g, "''"); // escape single quotes
            db.exec(`
                INSERT INTO stats_daily (date, app_name, app_type, category, total_seconds, session_count)
                SELECT 
                    DATE(timestamp) as date,
                    '${browserApp}' as app_name,
                    'app' as app_type,
                    'Browser' as category,
                    SUM(CAST(duration_ms AS REAL) / 1000.0) as total_seconds,
                    COUNT(*) as session_count
                FROM logs
                WHERE is_browser_tracking = 1 AND domain IS NOT NULL AND duration_ms > 0
                GROUP BY DATE(timestamp)
            `);
        }
        console.log('[Backfill] Complete.');
    }
    catch (err: any) {
        console.warn('[Backfill] Failed:', err.message);
    }
}

function addLog(timestamp, app, category, duration_ms, title, project, url?, domain?, tab_id?, is_browser_tracking?) {
    let effectiveBrowserTracking = is_browser_tracking;
    let safeDuration = Math.min(duration_ms, MAX_LOGGED_SESSION_MS);

    // Skip logging browser entries without valid domains (prevents "browser" app in stats)
    if (effectiveBrowserTracking && (!domain || domain.trim() === '')) {
        console.log(`[DeskFlow] ?? Skipped logging browser entry without domain for app: ${app}`);
        return;
    }

    // On-view mode guard: skip app entry persistence when dashboard isn't visible
    if (!is_browser_tracking && appRecordingMode === 'on-view' && !dashboardPageVisible) {
        return;
    }

    if (useJson) {
        const newLog = {
            id: Date.now(),
            timestamp,
            app,
            category,
            duration_ms: safeDuration,
            title,
            project,
            url,
            domain,
            tab_id,
            is_browser_tracking
        };
        jsonLogs.unshift(newLog);
        if (jsonLogs.length > 50000)
            jsonLogs = jsonLogs.slice(0, 50000); // Increased from 1000 to 50000
        saveJsonLogs();
        console.log(`[DeskFlow] ✅ Logged: ${app} → ${Math.floor(safeDuration / 1000)}s`);
    }
    else {
        try {
            ensureDb();
            const stmt = db.prepare(`
        INSERT INTO logs (timestamp, app, category, duration_ms, title, project, url, domain, tab_id, is_browser_tracking)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
            stmt.run(timestamp, app, category, safeDuration, title, project, url || null, domain || null, tab_id || null, is_browser_tracking ? 1 : 0);
            console.log(`[DeskFlow] ✅ Logged: ${app} → ${Math.floor(safeDuration / 1000)}s`);
        }
        catch (err) {
            console.error('[DeskFlow] SQLite insert failed:', err);
        }
    }
    // Update aggregated tables after inserting a log
    updateAggregates(timestamp, app, category, safeDuration, domain, is_browser_tracking);
}
function updateAggregates(timestamp, app, category, duration_ms, domain, is_browser_tracking) {
    if (useJson)
        return; // Skip for JSON storage
    if (!ensureDb()) return;
    const date = timestamp.split('T')[0];
    const duration_sec = Math.floor(duration_ms / 1000);
    try {
        // Update daily_stats
        const existingDaily = db.prepare(`SELECT id, total_sec, sessions FROM daily_stats WHERE date = ? AND app = ?`).get(date, app);
        if (existingDaily) {
            db.prepare(`UPDATE daily_stats SET total_sec = total_sec + ?, sessions = sessions + 1 WHERE date = ? AND app = ?`)
                .run(duration_sec, date, app);
        }
        else {
            db.prepare(`INSERT INTO daily_stats (date, app, category, total_sec, sessions) VALUES (?, ?, ?, ?, 1)`)
                .run(date, app, category, duration_sec);
        }
        // Update sessions table (active sessions tracking)
        const existingSession = db.prepare(`SELECT id, duration_sec FROM sessions WHERE app = ? AND is_active = 1 ORDER BY start_time DESC LIMIT 1`).get(app);
        if (existingSession) {
            db.prepare(`UPDATE sessions SET duration_sec = duration_sec + ? WHERE id = ?`).run(duration_sec, existingSession.id);
        }
        else {
            db.prepare(`INSERT INTO sessions (app, category, start_time, end_time, duration_sec, is_active) VALUES (?, ?, ?, ?, ?, 1)`)
                .run(app, category, timestamp, timestamp, duration_sec);
        }
        // Update daily_aggregates
        const existingAgg = db.prepare(`SELECT id, total_sec, session_count FROM daily_aggregates WHERE date = ? AND app = ?`).get(date, app);
        if (existingAgg) {
            db.prepare(`UPDATE daily_aggregates SET total_sec = total_sec + ?, session_count = session_count + 1 WHERE date = ? AND app = ?`)
                .run(duration_sec, date, app);
        }
        else {
            db.prepare(`INSERT INTO daily_aggregates (date, app, category, total_sec, session_count) VALUES (?, ?, ?, ?, 1)`)
                .run(date, app, category, duration_sec);
        }
        // Update browser_sessions if browser tracking
        if (is_browser_tracking && domain) {
            const existingBrowser = db.prepare(`SELECT id, total_sec, session_count FROM browser_sessions WHERE date = ? AND domain = ?`).get(date, domain);
            if (existingBrowser) {
                db.prepare(`UPDATE browser_sessions SET total_sec = total_sec + ?, session_count = session_count + 1 WHERE date = ? AND domain = ?`)
                    .run(duration_sec, date, domain);
            }
            else {
                db.prepare(`INSERT INTO browser_sessions (date, domain, category, total_sec, session_count) VALUES (?, ?, ?, ?, 1)`)
                    .run(date, domain, category, duration_sec);
            }
        }
        // Update stats_daily (used by Dashboard get-dashboard-aggregates)
        const statsName = domain || app;
        const statsType = domain ? 'domain' : 'app';
        db.prepare(`
            INSERT INTO stats_daily (date, app_name, app_type, category, total_seconds, session_count)
            VALUES (?, ?, ?, ?, ?, 1)
            ON CONFLICT(date, app_name) DO UPDATE SET
                total_seconds = total_seconds + ?,
                session_count = session_count + 1
        `).run(date, statsName, statsType, category, duration_sec, duration_sec);
        // Add synthetic browser-app entry when logging a domain (browser tracking)
        if (is_browser_tracking && userPreferences?.browserWithExtension) {
            const browserAppName = userPreferences.browserWithExtension;
            db.prepare(`
                INSERT INTO stats_daily (date, app_name, app_type, category, total_seconds, session_count)
                VALUES (?, ?, 'app', 'Browser', ?, 1)
                ON CONFLICT(date, app_name) DO UPDATE SET
                    total_seconds = total_seconds + ?,
                    session_count = session_count + 1
            `).run(date, browserAppName, duration_sec, duration_sec);
        }
        markStatsDirty();
        console.log('[DeskFlow] ✅ Aggregates updated for', app);
    }
    catch (err) {
        console.error('[DeskFlow] Aggregate update failed:', err);
    }
}
function getLogs(limit?: number): any[] {
    console.log('[DeskFlow getLogs] Called with limit:', limit);
    if (useJson) {
        console.log('[DeskFlow getLogs] Returning jsonLogs:', jsonLogs.length);
        return limit ? jsonLogs.slice(0, limit) : jsonLogs;
    }
    try {
        if (limit) {
            const stmt = db.prepare(`SELECT * FROM logs ORDER BY id DESC LIMIT ${limit}`);
            const results = stmt.all();
            console.log('[DeskFlow getLogs] SQLite with limit:', results.length);
            return results;
        }
        // Return up to 100k rows — enough for years of tracking data without frontend freeze
        const stmt = db.prepare("SELECT * FROM logs ORDER BY id DESC LIMIT 100000");
        const results = stmt.all();
        console.log('[DeskFlow getLogs] SQLite capped to 5000 rows (730 day window):', results.length);
        return results;
    }
    catch (err) {
        console.error('[DeskFlow] SQLite select failed:', err);
        return [];
    }
}
function getStats() {
    if (useJson) {
        const stats = new Map();
        jsonLogs.forEach((log) => {
            if (log.is_browser_tracking)
                return;
            const appName = log.app;
            const existing = stats.get(appName) || { total_ms: 0, sessions: 0 };
            existing.total_ms += log.duration_ms;
            existing.sessions += 1;
            stats.set(appName, existing);
        });
        return Array.from(stats.entries()).map(([app, data]) => ({
            app,
            total_ms: data.total_ms,
            sessions: data.sessions
        })).sort((a, b) => b.total_ms - a.total_ms);
    }
    try {
        const stmt = db.prepare(`
      SELECT
        app,
        SUM(duration_ms) as total_ms,
        COUNT(*) as sessions
      FROM logs
      WHERE is_browser_tracking = 0 OR is_browser_tracking IS NULL
      GROUP BY app
      ORDER BY total_ms DESC
    `);
        return stmt.all();
    }
    catch (err) {
        console.error('[DeskFlow] SQLite stats failed:', err);
        return [];
    }
}
// --- Tracking state ---
let currentApp = null;
let sessionStart = Date.now();
let trackingInterval = null;
let isTracking = true;
let lastPollTime = Date.now();
let consecutiveNullPolls = 0;
let MAX_SESSION_MS = 120 * 60 * 1000; // 120 minutes — cap for long sessions (was 30min)
const MAX_LOGGED_SESSION_MS = 3600000; // 1 hour - cap logged sessions to prevent heatmap inflation
let SLEEP_GAP_MS = 30000; // 30 seconds — gap threshold to detect system sleep (was 10s)
const BROWSER_MAX_DELTA_MS = 10 * 60 * 1000; // 10 minutes — separate cap for browser delta (extension sends ~5s normally)
const IDLE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes — OS-level idle before pausing tracking
let lastCheckpointTime = Date.now();
const CHECKPOINT_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes — checkpoint interval for long sessions (was 5min)
const TRANSIENT_APPS = [
    'explorer', 'task switching', 'taskbar', 'start menu',
    'system', 'shellexperiencehost', 'searchui', 'peopleexperiencehost',
    'application frame', 'console window host',
    'screen snip', 'snipping tool',
];
// --- Browser tracking state ---
let browserServer = null;
let browserServerPort = 54321;
let isBrowserTrackingEnabled = true;
let browserRecordingMode = 'always'; // 'always' | 'on-view'
let appRecordingMode = 'always'; // 'always' | 'on-view'
let browserPageVisible = false;
let dashboardPageVisible = false;
// FIX 1: Use a Map keyed by domain to track all active browser sessions (not just one)
let activeBrowserSessions = new Map();
let browserExcludedDomains = [];

// Cache for tierMap to avoid re-scanning stats_daily on every request
let cachedTierMap = null;
let tierMapLastRefresh = 0;
const TIER_MAP_CACHE_TTL_MS = 30000; // 30 seconds

function invalidateTierMapCache() {
    cachedTierMap = null;
    tierMapLastRefresh = 0;
}
// Track only the MOST RECENTLY active browser domain (only one active at a time)
let lastActiveBrowserDomain = null;
let lastActiveBrowserTimestamp = 0;
function categorizeApp(appName, opts?: { isResolvedGame?: boolean }) {
    if (opts?.isResolvedGame) return 'Gaming';
    const lower = appName.toLowerCase();
    if (categoryConfig.appCategoryMap[appName]) {
        return categoryConfig.appCategoryMap[appName];
    }
    if (categoryConfig.detectedApps[lower]) {
        return categoryConfig.detectedApps[lower];
    }
    for (const [keyword, category] of Object.entries(DEFAULT_APP_CATEGORIES)) {
        if (lower.includes(keyword)) {
            categoryConfig.detectedApps[lower] = category;
            saveCategoryConfig();
            return category;
        }
    }
    return 'Uncategorized';
}

// Check if the given app name is the browser that has the DeskFlow extension installed
// When true, app tracking should skip logging (extension handles website data instead)
function isBrowserWithExtension(appName: string): boolean {
    if (!isBrowserTrackingEnabled || !userPreferences?.browserWithExtension) return false;
    return isAppMatchingBrowser(appName, userPreferences.browserWithExtension);
}
// Calculate productivity score based on daily activity
// Returns: { score: 0-100, productive_sec: number, neutral_sec: number, distracting_sec: number, total_sec: number }
function calculateProductivityScore(dayLogs) {
    const { tierAssignments } = categoryConfig;
    let productiveSec = 0;
    let neutralSec = 0;
    let distractingSec = 0;
    const breakdown = {};
    for (const log of dayLogs) {
        const durationSec = Math.floor((log.duration_ms || 0) / 1000);
        const category = log.category || 'Uncategorized';
        const tier = getTierForCategory(category);
        // Track breakdown (floor to remove decimals)
        breakdown[category] = (breakdown[category] || 0) + durationSec;
        // Classify time based on tier
        if (tier === 'productive') {
            productiveSec += durationSec;
        }
        else if (tier === 'distracting') {
            distractingSec += durationSec;
        }
        else {
            neutralSec += durationSec;
        }
    }
    const totalSec = productiveSec + neutralSec + distractingSec;
    // Calculate score (0-100)
    // Productive time = 100%, Neutral = 50%, Distracting = 0%
    let score = 0;
    if (totalSec > 0) {
        score = ((productiveSec + (neutralSec * 0.5)) / totalSec) * 100;
    }
    return {
        score: Math.floor(Math.min(100, Math.max(0, score))),
        productive_sec: Math.floor(productiveSec),
        neutral_sec: Math.floor(neutralSec),
        distracting_sec: Math.floor(distractingSec),
        total_sec: Math.floor(totalSec),
        breakdown
    };
}
// Domain categorization for browser tracking (conservative smart detection)
function categorizeDomain(domain, title, url) {
    const lower = domain.toLowerCase();
    const titleLower = (title || '').toLowerCase();
    const urlLower = (url || '').toLowerCase();
    const combinedContext = `${titleLower} ${urlLower}`;
    
    console.log('[DeskFlow] categorizeDomain called:', { domain: lower, title: title?.substring(0, 50), url: url?.substring(0, 50) });
    console.log('[DeskFlow] domainKeywordRules:', JSON.stringify(Object.keys(categoryConfig.domainKeywordRules || {})));
    console.log('[DeskFlow] domainDefaultCategories:', JSON.stringify(categoryConfig.domainDefaultCategories));
    console.log('[DeskFlow] detectedDomains:', JSON.stringify(categoryConfig.detectedDomains));
    
    // Check excluded domains first
    if (browserExcludedDomains.some(excluded => lower.includes(excluded))) {
        console.log('[DeskFlow] categorizeDomain result: Excluded');
        return 'Excluded';
    }
    
    // 1. Check user override (manual category assignment)
    if (categoryConfig.domainCategoryMap[lower]) {
        console.log('[DeskFlow] categorizeDomain result (override):', categoryConfig.domainCategoryMap[lower]);
        return categoryConfig.domainCategoryMap[lower];
    }
    
    // 2. Check detected domains cache
    if (categoryConfig.detectedDomains[lower]) {
        console.log('[DeskFlow] categorizeDomain result (detected):', categoryConfig.detectedDomains[lower]);
        return categoryConfig.detectedDomains[lower];
    }
    
    // 3. Use keyword-based categorization rules (configurable per domain)
    // New structure: { category: string; keywords: string[] }[]
    for (const [domainPattern, keywordSets] of Object.entries(categoryConfig.domainKeywordRules || {})) {
        if (lower.includes(domainPattern)) {
            console.log('[DeskFlow] Found keyword rule for:', domainPattern, 'keywordSets:', JSON.stringify(keywordSets));
            const sets = keywordSets as { category: string; keywords: string[] }[];
            for (const set of sets) {
                const keywordsArray = set.keywords || [];
                const matched = keywordsArray.some(keyword => 
                    combinedContext.includes(keyword.toLowerCase())
                );
                if (matched) {
                    console.log('[DeskFlow] categorizeDomain result (keyword match):', set.category);
                    return set.category;
                }
            }
            // No keywords matched - fall back to Category Overrides (domainCategoryMap)
            // This will be checked at step 1 on next call since domainCategoryMap is checked first
            const fallbackFromOverrides = categoryConfig.domainCategoryMap?.[domainPattern];
            if (fallbackFromOverrides) {
                console.log('[DeskFlow] categorizeDomain result (fallback to overrides):', fallbackFromOverrides);
                return fallbackFromOverrides;
            }
            // No keywords matched - also check DEFAULT_DOMAIN_CATEGORIES
            if (DEFAULT_DOMAIN_CATEGORIES[domainPattern]) {
                console.log('[DeskFlow] categorizeDomain result (default categories):', DEFAULT_DOMAIN_CATEGORIES[domainPattern]);
                return DEFAULT_DOMAIN_CATEGORIES[domainPattern];
            }
            console.log('[DeskFlow] categorizeDomain result (no match):', 'Entertainment');
            return 'Entertainment';
        }
    }
    
    // 4. Final fallback: check DEFAULT_DOMAIN_CATEGORIES for any domain
    for (const [defaultDomain, defaultCategory] of Object.entries(DEFAULT_DOMAIN_CATEGORIES)) {
        if (lower.includes(defaultDomain) || defaultDomain.includes(lower)) {
            console.log('[DeskFlow] categorizeDomain result (final fallback):', defaultCategory);
            return defaultCategory;
        }
    }
    
    // 5. Last resort — treat unknown domains as Entertainment (distracting)
    // instead of Uncategorized (neutral), so they don't inflate the score
    console.log('[DeskFlow] categorizeDomain result (truly uncategorized):', 'Entertainment');
    return 'Entertainment';
}

// 🎮 Game-mode poll skip counter: reduces active-win calls during gameplay to prevent stutter
let gameModePollCount = 0;
const GAME_POLL_SKIP = 6; // Only call active-win every 6th poll (30s) during games

// Real window polling using active-win
async function pollForeground() {
    if (!isTracking)
        return;
    const now = Date.now();
    try {
        // 🎮 Game optimization: skip active-win for 5 out of 6 polls during fullscreen games
        const isInGame = currentApp && categorizeApp(currentApp) === 'Gaming';
        if (isInGame) {
            gameModePollCount++;
            if (gameModePollCount < GAME_POLL_SKIP) {
                lastPollTime = now;
                // Still checkpoint long game sessions even without active-win
                if (now - lastCheckpointTime > CHECKPOINT_INTERVAL_MS) {
                    const checkpointDuration = now - sessionStart;
                    if (checkpointDuration > 5000 && currentApp !== 'DeskFlow' && currentApp !== 'Electron') {
                        const duration = Math.min(checkpointDuration, MAX_SESSION_MS);
                        const category = categorizeApp(currentApp, { isResolvedGame: true });
                        addLog(new Date(sessionStart).toISOString(), currentApp, category, duration, `${currentApp} Window`, null);
                        console.log(`[DeskFlow] 📝 Game checkpoint: ${currentApp} → ${Math.round(duration / 1000)}s`);
                        sessionStart = now;
                    }
                    lastCheckpointTime = now;
                }
                return;
            }
            gameModePollCount = 0;
        } else {
            gameModePollCount = 0;
        }

        const result = await (0, active_win_1.default)();
        const timeSinceLastPoll = now - lastPollTime;
        lastPollTime = now;
        const resolved = await resolveForegroundApp(result ?? null);

        // --- Sleep / gap detection ---
        if (!result) {
            consecutiveNullPolls++;
            if (consecutiveNullPolls >= 30) {
                if (currentApp) {
                    // Keep-alive: null poll during a known game keeps session alive
                    if (resolved && resolved.source === 'keepalive') {
                        consecutiveNullPolls = 0;
                        sessionStart = sessionStart ?? now;
                        return;
                    }
                    // Never reset session for games (fullscreen games don't report windows due to anti-cheat)
                    if (categorizeApp(currentApp) === 'Gaming') {
                        sessionStart = now;
                        return;
                    }
                    // Give browser sessions extra slack before assuming sleep
                    if (isBrowserWithExtension(currentApp)) {
                        if (consecutiveNullPolls >= 60) {
                            const knownDuration = (now - timeSinceLastPoll) - sessionStart;
                            if (knownDuration > 5000) {
                                const duration = Math.min(knownDuration, MAX_SESSION_MS);
                                const category = categorizeApp(currentApp);
                                addLog(new Date(sessionStart).toISOString(), currentApp, category, duration, `${currentApp} Window`, null);
                                console.log(`[DeskFlow] System appears asleep (60+ browser null polls), resetting session for: ${currentApp}`);
                                currentApp = null;
                            }
                            sessionStart = now;
                        }
                        return;
                    }
                    // Normal apps — existing logic
                    const knownDuration = (now - timeSinceLastPoll) - sessionStart;
                    if (knownDuration > 5000 && currentApp !== 'DeskFlow' && currentApp !== 'Electron') {
                        const duration = Math.min(knownDuration, MAX_SESSION_MS);
                        const category = categorizeApp(currentApp);
                        addLog(new Date(sessionStart).toISOString(), currentApp, category, duration, `${currentApp} Window`, null);
                        console.log(`[DeskFlow] System appears asleep (30+ null polls), resetting session for: ${currentApp}`);
                        currentApp = null;
                    }
                    sessionStart = now;
                }
                return;
            }
        }
        // If we get a result after a gap, check if the gap was large enough to indicate sleep
        if (timeSinceLastPoll > SLEEP_GAP_MS) {
            console.log(`[DeskFlow] 💤 Sleep gap detected (${Math.round(timeSinceLastPoll / 1000)}s). Resetting session.`);
            if (currentApp && currentApp !== 'DeskFlow' && currentApp !== 'Electron') {
                const previousPollTime = now - timeSinceLastPoll;
                const knownDuration = previousPollTime - sessionStart;
                if (knownDuration > 5000) {
                    const duration = Math.min(knownDuration, MAX_SESSION_MS);
                    const category = categorizeApp(currentApp);
                    addLog(new Date(sessionStart).toISOString(), currentApp, category, duration, `${currentApp} Window`, null);
                }
            }
            currentApp = null;
            sessionStart = now;
            consecutiveNullPolls = 0;
            return;
        }

        // Handle resolved result
        if (!resolved) {
            consecutiveNullPolls++;
            return;
        }

        consecutiveNullPolls = 0;
        const isResolvedGame = ['map', 'index', 'scan', 'keepalive', 'title'].includes(resolved.source);

        // Handle keepalive for fullscreen/anti-cheat games (no window)
        if (resolved.source === 'keepalive') {
            sessionStart = sessionStart ?? now; // do NOT reset ongoing session
        }

        const appName = resolved.name;
        const windowTitle = result?.title ?? '';
        const appLower = appName.toLowerCase();
        const isTransientApp = TRANSIENT_APPS.some(t => appLower.includes(t));

        // Debug: Log all detected apps including games
        console.log(`[DeskFlow] active-win: ${appName} | Title: ${windowTitle.substring(0, 60)} | Source: ${resolved.source}`);

        // Ignore transient/system apps entirely
        const filterEnabled = userPreferences.filterTransientApps !== false;
        if (filterEnabled && isTransientApp) {
            return;
        }

        // For DeskFlow/Electron, notify renderer but don't log sessions
        if (appLower.includes('electron') || appLower.includes('deskflow')) {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('foreground-changed', {
                    app: appName,
                    title: windowTitle,
                    category: categorizeApp(appName, { isResolvedGame }),
                    timestamp: new Date().toISOString(),
                    isReal: true
                });
            }
            return;
        }

        // Only log if app changed
        if (appName !== currentApp) {
            const rawDuration = now - sessionStart;
            if (currentApp && rawDuration > 5000 && currentApp !== 'DeskFlow' && currentApp !== 'Electron') {
                const duration = Math.min(rawDuration, MAX_SESSION_MS);
                if (rawDuration > MAX_SESSION_MS) {
                    console.log(`[DeskFlow] ⚠️ Session capped: ${currentApp} had ${Math.round(rawDuration / 1000)}s, capped to ${Math.round(duration / 1000)}s (likely sleep artifact)`);
                }
                const category = categorizeApp(currentApp);
                addLog(new Date(sessionStart).toISOString(), currentApp, category, duration, `${currentApp} Window`, null);
            }
            // Start new session
            currentApp = appName || null;
            sessionStart = now;
            // Send to renderer
            if (mainWindow && !mainWindow.isDestroyed()) {
                const isReal = !!appName;
                mainWindow.webContents.send('foreground-changed', {
                    app: appName || '',
                    title: isReal ? windowTitle : '',
                    category: isReal ? categorizeApp(appName, { isResolvedGame }) : '',
                    timestamp: new Date().toISOString(),
                    isReal
                });
            }
        }

        // Periodic checkpointing
        if (currentApp && (now - lastCheckpointTime > CHECKPOINT_INTERVAL_MS)) {
            const checkpointDuration = now - sessionStart;
            if (checkpointDuration > 5000 && currentApp !== 'DeskFlow' && currentApp !== 'Electron') {
                const duration = Math.min(checkpointDuration, MAX_SESSION_MS);
                const category = categorizeApp(currentApp, { isResolvedGame: true });
                addLog(new Date(sessionStart).toISOString(), currentApp, category, duration, `${currentApp} Window`, null);
                console.log(`[DeskFlow] 📝 Checkpoint: ${currentApp} → ${Math.round(duration / 1000)}s`);
                sessionStart = now;
            }
            lastCheckpointTime = now;
        }
    }
    catch (err) {
        console.error('[DeskFlow] active-win error:', err.message);
        consecutiveNullPolls++;
    }
}
// --- Window ---
let mainWindow = null;
let tray = null;
let startMinimized = false;
function ensureWindow() {
    if (!mainWindow || mainWindow.isDestroyed()) {
        createWindow();
    }
    if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
    }
}
function createTray() {
    // Use the custom icon for the tray
    const iconPath = path_1.default.join(__dirname, '..', 'DeskFlow_AppIcon.png');
    let trayIcon;
    
    try {
        trayIcon = electron_1.nativeImage.createFromPath(iconPath);
        // Resize for tray (16x16)
        if (!trayIcon.isEmpty()) {
            trayIcon = trayIcon.resize({ width: 16, height: 16 });
        }
    } catch (e) {
        console.warn('[DeskFlow] Failed to load tray icon, using fallback');
        // Fallback: create a simple icon programmatically
        const size = 16;
        const canvas = Buffer.alloc(size * size * 4);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const idx = (y * size + x) * 4;
                const cx = x - size / 2 + 0.5;
                const cy = y - size / 2 + 0.5;
                const dist = Math.sqrt(cx * cx + cy * cy);
                if (dist < 6) {
                    canvas[idx] = 0x3b;
                    canvas[idx + 1] = 0x82;
                    canvas[idx + 2] = 0xf6;
                    canvas[idx + 3] = 255;
                } else {
                    canvas[idx] = 0;
                    canvas[idx + 1] = 0;
                    canvas[idx + 2] = 0;
                    canvas[idx + 3] = 0;
                }
            }
        }
        trayIcon = electron_1.nativeImage.createFromBuffer(canvas, { width: size, height: size });
    }
    
    tray = new electron_1.Tray(trayIcon);
    const contextMenu = electron_1.Menu.buildFromTemplate([
        {
            label: 'Show DeskFlow',
            click: () => {
                ensureWindow();
            }
        },
        {
            label: 'Toggle Tracking',
            click: () => {
                isTracking = !isTracking;
                console.log('[DeskFlow] Tracking:', isTracking ? 'ON' : 'OFF');
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('tracking-heartbeat', { isTracking, currentApp, uptime: Date.now() });
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                electron_1.app.quit();
            }
        }
    ]);
    tray.setToolTip('DeskFlow - Time Tracker');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
        ensureWindow();
    });
    console.log('[DeskFlow] ✅ System tray created');
}
// --- Window state persistence ---
interface WindowState {
    x?: number;
    y?: number;
    width: number;
    height: number;
    maximized: boolean;
}
function loadWindowState(): WindowState | null {
    try {
        if (fs_1.default.existsSync(windowStatePath)) {
            return JSON.parse(fs_1.default.readFileSync(windowStatePath, 'utf-8'));
        }
    } catch (e) {
        console.warn('[DeskFlow] Failed to load window state:', e);
    }
    return null;
}
function saveWindowState(state: WindowState): void {
    try {
        fs_1.default.writeFileSync(windowStatePath, JSON.stringify(state, null, 2));
    } catch (e) {
        console.warn('[DeskFlow] Failed to save window state:', e);
    }
}
function createWindow() {
    electron_1.Menu.setApplicationMenu(null);
    console.log('BUILD MARKER v4');
    const preloadPath = path_1.default.join(__dirname, 'preload.cjs');
    console.log('[DeskFlow] Preload path:', preloadPath);
    console.log('[DeskFlow] __dirname:', __dirname);
    
    const savedState = loadWindowState();
    const primaryDisplay = electron_1.screen.getPrimaryDisplay();
    const { x: workX, y: workY, width: workWidth, height: workHeight } = primaryDisplay.workArea;
    
    const defaultBounds = { x: workX, y: workY, width: workWidth, height: workHeight };
    const bounds = savedState && !savedState.maximized ? {
        x: savedState.x ?? defaultBounds.x,
        y: savedState.y ?? defaultBounds.y,
        width: Math.min(savedState.width, primaryDisplay.workAreaSize.width),
        height: Math.min(savedState.height, primaryDisplay.workAreaSize.height),
    } : defaultBounds;
    
    mainWindow = new electron_1.BrowserWindow({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        minWidth: 1024,
        minHeight: 700,
        title: 'DeskFlow',
        icon: path_1.default.join(__dirname, '..', 'DeskFlow_AppIcon.png'),
        webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: true,
        },
        titleBarStyle: 'default',
        backgroundColor: '#0a0a0a',
    });
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    }
    else {
        const dist = path_1.default.join(__dirname, '../dist');
        const mimeTypes = {
            '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
            '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
            '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
            '.woff': 'font/woff', '.woff2': 'font/woff2', '.map': 'application/json',
        };
        const server = http_1.default.createServer((req, res) => {
            let rel = (req.url || '').split('?')[0].split('#')[0];
            if (rel === '/') rel = '/index.html';
            const filePath = path_1.default.join(dist, rel);
            const ext = path_1.default.extname(filePath);
            fs_1.default.readFile(filePath, (err, data) => {
                if (err) {
                    fs_1.default.readFile(path_1.default.join(dist, 'index.html'), (err2, data2) => {
                        if (err2) { res.writeHead(500); res.end('Internal Server Error'); return; }
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(data2);
                    });
                    return;
                }
                res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
                res.end(data);
            });
        });
        server.listen(0, '127.0.0.1', () => {
            const addr = server.address();
            const port = addr && typeof addr === 'object' ? addr.port : 38123;
            console.log('[DeskFlow] Serving on http://localhost:' + port);
            mainWindow.loadURL('http://localhost:' + port + '/index.html');
        });
    }
    // Log loading errors
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('[DeskFlow] Failed to load:', errorCode, errorDescription);
    });
    mainWindow.webContents.on('did-finish-load', () => {
        console.log('[DeskFlow] Page loaded successfully');
    });
    
    // Handle window close — ask renderer if unsaved changes exist first
    let closingAllowed = false;
    mainWindow.on('close', (event) => {
        if (closingAllowed) return; // already confirmed
        event.preventDefault();
        mainWindow?.webContents.send('workspace-request-save');
    });
    // Listen for renderer saying "ok, close now"
    electron_1.ipcMain.on('workspace-allow-close', () => {
        closingAllowed = true;
        mainWindow?.close();
    });
    
    // CRITICAL: Call pollForeground ONCE immediately on startup to detect current app
    pollForeground();
    
    // Start polling (every 5 seconds)
    trackingInterval = setInterval(pollForeground, 5000);
    // Send tracking heartbeat to renderer every 5 seconds
    const heartbeatInterval = setInterval(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            const systemIdleSeconds = electron_1.powerMonitor.getSystemIdleTime();
            mainWindow.webContents.send('tracking-heartbeat', {
                isTracking,
                currentApp,
                uptime: Date.now(),
                systemIdleSeconds
            });
        }
    }, 5000);
    // --- Window state persistence ---
    const saveWindowStateDebounced = () => {
        try {
            if (!mainWindow || mainWindow.isDestroyed()) return;
            const maximized = mainWindow.isMaximized();
            if (maximized) {
                saveWindowState({ width: workWidth, height: workHeight, maximized: true });
            } else {
                const [x, y] = mainWindow.getPosition();
                const [width, height] = mainWindow.getSize();
                saveWindowState({ x, y, width, height, maximized: false });
            }
        } catch (e) { /* ignore */ }
    };
    mainWindow.on('resize', saveWindowStateDebounced);
    mainWindow.on('move', saveWindowStateDebounced);
    mainWindow.on('maximize', saveWindowStateDebounced);
    mainWindow.on('unmaximize', saveWindowStateDebounced);
    
    if (savedState?.maximized) {
        mainWindow.maximize();
    }
    
    mainWindow.on('closed', () => {
        if (trackingInterval)
            clearInterval(trackingInterval);
        if (heartbeatInterval)
            clearInterval(heartbeatInterval);
        mainWindow = null;
    });
    mainWindow.on('close', (event) => {
        saveWindowStateDebounced();
        if (!electron_1.app.isQuitting) {
            event.preventDefault();
            mainWindow?.hide();
        }
    });
    // Extract sleep gap check into a reusable function
    function checkSleepGap(gapStart: number, gapEnd: number): void {
        const gapMs = gapEnd - gapStart;
        const gapMinutes = Math.round(gapMs / (1000 * 60));
        if (gapMs < SLEEP_DETECTION_MIN_GAP_MS) return;
        // Max reasonable sleep: 16 hours. Longer gaps = user just didn't open app for a while
        if (gapMs > 16 * 60 * 60 * 1000) {
            console.log(`[DeskFlow] Skipping sleep detection — gap ${gapMinutes}min exceeds 16h max`);
            return;
        }
        // Require at least one end to be within sleep hours (21:00-10:00)
        // e.g., 20:00→08:00 passes (end is in sleep hours), 14:00→16:00 fails (neither is)
        if (!isWithinSleepHours(gapStart) && !isWithinSleepHours(gapEnd)) {
            console.log(`[DeskFlow] Skipping sleep detection — neither gap end is within sleep hours (start=${new Date(gapStart).getHours()}:${new Date(gapStart).getMinutes()}, end=${new Date(gapEnd).getHours()}:${new Date(gapEnd).getMinutes()})`);
            return;
        }
        // Check OS-level idle time to prevent false positives for short gaps
        // For very large gaps (> 2h), skip idle check — user was clearly not at computer
        if (gapMs < 120 * 60 * 1000) {
            const systemIdleSec = electron_1.powerMonitor.getSystemIdleTime();
            if (systemIdleSec < 300) {
                console.log(`[DeskFlow] Skipping sleep detection — system idle only ${systemIdleSec}s (user actively using other apps)`);
                return;
            }
        }
        console.log(`[DeskFlow] 💤 Potential sleep gap detected: ${gapMinutes}min since last focus`);
        try {
            fs_1.default.writeFileSync(
                path_1.default.join(userDataPath, 'deskflow-sleep-detection.json'),
                JSON.stringify({
                    detected: true,
                    gapStart,
                    gapEnd,
                    gapMinutes,
                    checked: false,
                }, null, 2)
            );
        } catch (err) { console.error('[DeskFlow] Failed to write sleep detection:', err); }
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('sleep-detection', { gapStart, gapEnd, gapMinutes });
        }
    }

    // Track window focus/blur for sleep detection
    mainWindow.on('focus', () => {
        const now = Date.now();
        if (lastFocusTime) {
            checkSleepGap(lastFocusTime, now);
        }
        lastFocusTime = now;
        try {
            fs_1.default.writeFileSync(
                path_1.default.join(userDataPath, 'deskflow-last-focus.json'),
                JSON.stringify({ lastFocusTime: now }, null, 2)
            );
        } catch (err) { /* ignore */ }
    });
    mainWindow.on('blur', () => {
        lastFocusTime = Date.now();
    });

    // Also check for sleep gap on startup (focus event won't fire if window already focused)
    if (lastFocusTime) {
        checkSleepGap(lastFocusTime, Date.now());
    }

    // Toggle DevTools with Ctrl+Shift+I
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (input.key === 'I' && input.control && input.shift) {
                event.preventDefault();
                if (mainWindow.webContents.isDevToolsOpened()) {
                    mainWindow.webContents.closeDevTools();
                } else {
                    mainWindow.webContents.openDevTools();
                }
            }
        }
    });
}
// --- IPC handlers ---
electron_1.ipcMain.removeHandler('get-logs');
electron_1.ipcMain.handle('get-logs', () => {
    try {
        return getLogs();
    }
    catch (err) {
        console.error('[DeskFlow] get-logs error:', err);
        return [];
    }
});
electron_1.ipcMain.handle('update-app-log', (_event, id, data) => {
    try {
        if (useJson) {
            const idx = jsonLogs.findIndex(l => l.id === id);
            if (idx === -1) return { success: false, error: 'Log not found' };
            jsonLogs[idx] = { ...jsonLogs[idx], ...data };
            saveJsonLogs();
            return { success: true };
        }
        const stmt = db.prepare('UPDATE logs SET timestamp = ?, duration_ms = ?, title = ? WHERE id = ?');
        stmt.run(data.timestamp, data.duration_ms, data.title, id);
        return { success: true };
    }
    catch (err) {
        console.error('[DeskFlow] update-app-log error:', err);
        return { success: false, error: err.message };
    }
});

// Game detection - rescan Steam library
electron_1.ipcMain.handle('rescan-games', () => {
    try {
        rescanGames();
        return { success: true, count: require('./gameDetection.js').installedGameIndex.size };
    } catch (err) {
        console.error('[DeskFlow] rescan-games error:', err);
        return { success: false, error: err.message };
    }
});
electron_1.ipcMain.handle('delete-app-log', (_event, id) => {
    try {
        if (useJson) {
            jsonLogs = jsonLogs.filter(l => l.id !== id);
            saveJsonLogs();
        }
        else {
            db.prepare('DELETE FROM logs WHERE id = ?').run(id);
        }
        return { success: true };
    }
    catch (err) {
        console.error('[DeskFlow] delete-app-log error:', err);
        return { success: false, error: String(err) };
    }
});
// App control IPC handlers
electron_1.ipcMain.handle('quit-app', () => {
    electron_1.app.isQuitting = true;
    electron_1.app.quit();
});
electron_1.ipcMain.handle('show-window', () => {
    ensureWindow();
});
electron_1.ipcMain.handle('get-auto-start-status', () => {
    return electron_1.app.getLoginItemSettings().openAtLogin;
});
electron_1.ipcMain.handle('set-auto-start', (_event, enabled) => {
    const exePath = electron_1.app.isPackaged 
        ? process.execPath 
        : electron_1.app.getPath('exe');
    
    const args: string[] = [];
    if (enabled) {
        if (!electron_1.app.isPackaged) {
            args.push(electron_1.app.getAppPath());
        }
        args.push('--minimized');
    }
    
    electron_1.app.setLoginItemSettings({
        openAtLogin: enabled,
        openAsHidden: true,
        path: exePath,
        args: args
    });
    return enabled;
});
// Migrate old logs to new schema (daily_aggregates)
electron_1.ipcMain.handle('migrate-to-aggregates', () => {
    if (useJson) {
        return { success: false, message: 'JSON mode - migration not needed' };
    }
    try {
        // Aggregate logs into daily_aggregates
        const result = db.prepare(`
      INSERT INTO daily_aggregates (date, app, category, total_sec, session_count)
      SELECT 
        date(timestamp) as date,
        app,
        category,
        SUM(duration_ms / 1000) as total_sec,
        COUNT(*) as session_count
      FROM logs
      WHERE timestamp IS NOT NULL
      GROUP BY date(timestamp), app, category
      ON CONFLICT(date, app) DO UPDATE SET
        total_sec = excluded.total_sec,
        session_count = excluded.session_count
    `).run();
        // Also aggregate browser sessions
        const browserResult = db.prepare(`
      INSERT INTO browser_sessions (date, domain, category, total_sec, session_count)
      SELECT 
        date(timestamp) as date,
        domain,
        category,
        SUM(duration_ms / 1000) as total_sec,
        COUNT(*) as session_count
      FROM logs
      WHERE is_browser_tracking = 1 AND domain IS NOT NULL
      GROUP BY date(timestamp), domain
      ON CONFLICT(date, domain) DO UPDATE SET
        total_sec = excluded.total_sec,
        session_count = excluded.session_count
    `).run();
        console.log('[DeskFlow] ✅ Migration complete:', result.changes, 'aggregates updated');
        return {
            success: true,
            aggregatesUpdated: result.changes,
            browserAggregatesUpdated: browserResult.changes
        };
    }
    catch (err) {
        console.error('[DeskFlow] Migration error:', err);
        return { success: false, message: err.message };
    }
});
// Get data from new tables
electron_1.ipcMain.handle('get-daily-aggregates', () => {
    if (useJson)
        return [];
    try {
        return db.prepare('SELECT * FROM daily_aggregates ORDER BY date DESC, total_sec DESC LIMIT 3650').all();
    }
    catch (err) {
        console.error('[DeskFlow] get-daily-aggregates error:', err);
        return [];
    }
});
electron_1.ipcMain.handle('get-browser-sessions', () => {
    if (useJson)
        return [];
    try {
        return db.prepare('SELECT * FROM browser_sessions ORDER BY date DESC, total_sec DESC').all();
    }
    catch (err) {
        console.error('[DeskFlow] get-browser-sessions error:', err);
        return [];
    }
});
electron_1.ipcMain.handle('get-sessions', () => {
    if (useJson)
        return [];
    try {
        return db.prepare('SELECT * FROM sessions WHERE is_active = 1 ORDER BY start_time DESC').all();
    }
    catch (err) {
        console.error('[DeskFlow] get-sessions error:', err);
        return [];
    }
});
electron_1.ipcMain.handle('get-table-schema', (event, tableName) => {
    if (useJson)
        return { error: 'JSON mode' };
    try {
        const stmt = db.prepare(`PRAGMA table_info(${tableName})`);
        return stmt.all();
    }
    catch (err) {
        console.error('[DeskFlow] get-table-schema error:', err);
        return { error: err.message };
    }
});
electron_1.ipcMain.handle('get-database-tables', () => {
    if (useJson)
        return { tables: [], type: 'json' };
    try {
        const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
        return { tables: stmt.all().map((t) => t.name), type: 'sqlite' };
    }
    catch (err) {
        console.error('[DeskFlow] get-database-tables error:', err);
        return { tables: [], error: err.message };
    }
});
electron_1.ipcMain.handle('get-table-data', (event, tableName, limit = 50) => {
    if (useJson)
        return { error: 'JSON mode' };
    try {
        const stmt = db.prepare(`SELECT * FROM ${tableName} ORDER BY ROWID DESC LIMIT ?`);
        return stmt.all(limit);
    }
    catch (err) {
        console.error('[DeskFlow] get-table-data error:', err);
        return { error: err.message };
    }
});

electron_1.ipcMain.handle('update-categories-from-overrides', (event, appOverrides, domainOverrides) => {
    if (useJson) {
        try {
            let updatedCount = 0;
            jsonLogs = jsonLogs.map(log => {
                // Check app overrides
                const appKey = log.app?.toLowerCase();
                if (appKey && appOverrides[appKey]) {
                    log.category = appOverrides[appKey];
                    updatedCount++;
                }
                // Check domain overrides for browser-tracked logs
                else if (log.is_browser_tracking && log.domain) {
                    const domainKey = log.domain.toLowerCase();
                    if (domainOverrides[domainKey]) {
                        log.category = domainOverrides[domainKey];
                        updatedCount++;
                    }
                }
                return log;
            });
            saveJsonLogs();
            console.log('[DeskFlow] Updated categories for', updatedCount, 'logs');
            return { success: true, updatedCount };
        }
        catch (err) {
            console.error('[DeskFlow] update-categories-from-overrides error:', err);
            return { success: false, updatedCount: 0, error: err.message };
        }
    }
    try {
        let updatedCount = 0;
        // Update app categories
        for (const [appName, category] of Object.entries(appOverrides)) {
            const stmt = db.prepare('UPDATE logs SET category = ? WHERE LOWER(app) = ?');
            const result = stmt.run(category, appName.toLowerCase());
            updatedCount += result.changes;
        }
        // Update domain categories for browser-tracked logs
        for (const [domain, category] of Object.entries(domainOverrides)) {
            const stmt = db.prepare('UPDATE logs SET category = ? WHERE LOWER(domain) = ? AND is_browser_tracking = 1');
            const result = stmt.run(category, domain.toLowerCase());
            updatedCount += result.changes;
        }
        console.log('[DeskFlow] Updated categories for', updatedCount, 'logs');
        return { success: true, updatedCount };
    }
    catch (err) {
        console.error('[DeskFlow] update-categories-from-overrides error:', err);
        return { success: false, updatedCount: 0, error: err.message };
    }
});

electron_1.ipcMain.handle('get-stats', () => {
    try {
        return getStats();
    }
    catch (err) {
        console.error('[DeskFlow] get-stats error:', err);
        return [];
    }
});
electron_1.ipcMain.handle('toggle-tracking', () => {
    isTracking = !isTracking;
    console.log('[DeskFlow] Tracking:', isTracking ? 'ON' : 'OFF');
    return isTracking;
});
electron_1.ipcMain.handle('set-tracking', (event, enabled) => {
    isTracking = !!enabled;
    console.log('[DeskFlow] Tracking set:', isTracking ? 'ON' : 'OFF');
    return isTracking;
});
electron_1.ipcMain.handle('clear-data', () => {
    try {
        if (useJson) {
            jsonLogs = [];
            saveJsonLogs();
        }
        else {
            db.exec('DELETE FROM logs');
        }
        console.log('[DeskFlow] Data cleared');
        return true;
    }
    catch (err) {
        console.error('[DeskFlow] clear-data error:', err);
        return false;
    }
});
// Clear only today's logs (preserve historical data)
electron_1.ipcMain.handle('clear-today', () => {
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        if (useJson) {
            jsonLogs = jsonLogs.filter(l => !l.timestamp.startsWith(todayStr));
            saveJsonLogs();
        }
        else {
            db.prepare(`DELETE FROM logs WHERE timestamp >= ?`).run(`${todayStr}T00:00:00`);
        }
        console.log('[DeskFlow] Today\'s data cleared');
        return true;
    }
    catch (err) {
        console.error('[DeskFlow] clear-today error:', err);
        return false;
    }
});
electron_1.ipcMain.handle('get-db-path', () => dbPath);
// Storage health check
electron_1.ipcMain.handle('get-storage-status', () => {
    return {
        type: useJson ? 'json' : 'sqlite',
        working: db !== null || useJson,
        path: useJson ? jsonPath : dbPath,
        error: storageError,
        logCount: useJson ? jsonLogs.length : (db ? db.prepare('SELECT COUNT(*) as count FROM logs').get().count : 0)
    };
});
// Get/set user preferences (category overrides, custom colors)
interface UserPreferences {
    browserTrackingPort?: number;
    browserTrackingEnabled?: boolean;
    browserExcludedDomains?: string[];
    browserWithExtension?: string;
    browserProcessNames?: string[];
    mainBrowser?: string;
    [key: string]: any;
}

// Map browser brand names to OS process names (what active-win returns)
// Key = browser brand name, values = possible process names (without .exe)
// Handles cases where the UA brand name differs from the executable name
const BROWSER_PROCESS_NAMES: Record<string, string[]> = {
    'comet': ['chrome', 'comet', 'chromium'],
    'chrome': ['chrome', 'chromium'],
    'brave': ['brave', 'chrome'],
    'edge': ['msedge', 'edge'],
    'opera': ['opera'],
    'vivaldi': ['vivaldi'],
    'firefox': ['firefox'],
    'arc': ['arc'],
    'safari': ['safari'],
};

// Set of known game process names (lowercase, without .exe).
// When a known game is the last currentApp and null polls start,
// we never assume sleep � fullscreen games don't report windows.
const KNOWN_GAME_APPS = new Set<string>([
    'minecraft',
    'minecraft-windows',
    'fortniteclient',
    'fortnite',
    'valorant',
    'leagueclient',
    'league of legends',
    'csgo',
    'cs2',
    'dota2',
    'rocketleague',
    'r5apex',
    'overwatch',
    'steam',
    'epicgameslauncher',
    'battle.net',
]);

function getBrowserProcessNames(browserName: string): string[] {
    const key = browserName.toLowerCase();
    return BROWSER_PROCESS_NAMES[key] || [key];
}

function isAppMatchingBrowser(appName: string, browserName: string): boolean {
    if (!appName || !browserName) return false;
    const appLower = appName.toLowerCase().replace(/\.exe$/i, '');
    const browserLower = browserName.toLowerCase();
    // Direct match (both directions) + process name alias matching
    return appLower.includes(browserLower) ||
        browserLower.includes(appLower) ||
        getBrowserProcessNames(browserName).some(p => appLower.includes(p));
}

let userPreferences: UserPreferences = {};
const prefsPath = path_1.default.join(userDataPath, 'deskflow-prefs.json');
function loadPreferences() {
    try {
        if (fs_1.default.existsSync(prefsPath)) {
            const data = fs_1.default.readFileSync(prefsPath, 'utf-8');
            userPreferences = JSON.parse(data);
            console.log('[DeskFlow] 📄 Loaded preferences');
        }
    }
    catch (err) {
        console.warn('[DeskFlow] Failed to load preferences:', err);
        userPreferences = {};
    }
}
function savePreferences() {
    try {
        fs_1.default.writeFileSync(prefsPath, JSON.stringify(userPreferences, null, 2));
    }
    catch (err) {
        console.error('[DeskFlow] Failed to save preferences:', err);
    }
}
// Load preferences on startup
loadPreferences();
(global as any).__aiAgentCustomPaths = userPreferences.aiAgentCustomPaths || {};
electron_1.ipcMain.handle('get-preferences', () => {
    return userPreferences;
});
electron_1.ipcMain.handle('set-preference', (event, key, value) => {
    userPreferences[key] = value;
    savePreferences();
    return true;
});

// Custom AI agent storage paths (overrides for plugins)
electron_1.ipcMain.handle('get-ai-agent-custom-paths', () => {
    return userPreferences.aiAgentCustomPaths || {};
});
electron_1.ipcMain.handle('set-ai-agent-custom-path', (event, pluginId: string, dirPath: string) => {
    if (!userPreferences.aiAgentCustomPaths) userPreferences.aiAgentCustomPaths = {};
    if (dirPath) {
        userPreferences.aiAgentCustomPaths[pluginId] = dirPath;
    } else {
        delete userPreferences.aiAgentCustomPaths[pluginId];
    }
    (global as any).__aiAgentCustomPaths = { ...userPreferences.aiAgentCustomPaths };
    savePreferences();
    return true;
});

// AI Sync state tracking for efficiency (file mtime tracking) + last sync display
const SYNC_STATE_VERSION = 2;
interface AISyncState {
    version?: number;
    lastRunAt: string | null;
    agentLastRun: Record<string, string>;
    paths: Record<string, Record<string, { mtime: number; fileCount: number }>>;
}
function loadAISyncState(): AISyncState {
    const stored = userPreferences.aiSyncState;
    if (stored && typeof stored === 'object' && stored.version === SYNC_STATE_VERSION) {
        return {
            version: stored.version,
            lastRunAt: stored.lastRunAt || null,
            agentLastRun: stored.agentLastRun || {},
            paths: stored.paths || {},
        };
    }
    return { version: SYNC_STATE_VERSION, lastRunAt: null, agentLastRun: {}, paths: {} };
}
function saveAISyncState(state: AISyncState) {
    state.version = SYNC_STATE_VERSION;
    userPreferences.aiSyncState = state;
    savePreferences();
}
electron_1.ipcMain.handle('get-ai-sync-status', () => {
    return loadAISyncState();
});
electron_1.ipcMain.handle('clear-ai-sync-state', () => {
    userPreferences.aiSyncState = null;
    saveAISyncState({ version: SYNC_STATE_VERSION, lastRunAt: null, agentLastRun: {}, paths: {} });
    return { success: true };
});
// Category Configuration IPC Handlers
electron_1.ipcMain.handle('get-category-config', () => {
    return categoryConfig;
});
electron_1.ipcMain.handle('set-app-category', (event, appName, category) => {
    categoryConfig.appCategoryMap[appName] = category;
    saveCategoryConfig();
    return true;
});
electron_1.ipcMain.handle('set-domain-category', (event, domain, category) => {
    categoryConfig.domainCategoryMap[domain.toLowerCase()] = category;
    saveCategoryConfig();
    return true;
});
electron_1.ipcMain.handle('set-app-tier', (event, appName, tier) => {
    categoryConfig.appTierMap[appName] = tier;
    saveCategoryConfig();
    return true;
});
electron_1.ipcMain.handle('set-domain-tier', (event, domain, tier) => {
    categoryConfig.domainTierMap[domain.toLowerCase()] = tier;
    saveCategoryConfig();
    return true;
});

// NEW: Set keyword rules for a domain (for keyword-based productivity categorization)
// Now takes array of { category: string; keywords: string[] }
electron_1.ipcMain.handle('set-domain-keyword-rules', (event, domain, keywordSets) => {
    categoryConfig.domainKeywordRules = categoryConfig.domainKeywordRules || {};
    categoryConfig.domainKeywordRules[domain.toLowerCase()] = keywordSets;
    saveCategoryConfig();
    console.log(`[DeskFlow] Updated keyword rules for ${domain}:`, JSON.stringify(keywordSets));
    return true;
});

// NEW: Get keyword rules for a domain
electron_1.ipcMain.handle('get-domain-keyword-rules', (event, domain) => {
    return categoryConfig.domainKeywordRules?.[domain.toLowerCase()] || 
           DEFAULT_KEYWORD_RULES[domain.toLowerCase()] || [];
});

// NEW: Set default category for a domain (when keywords don't match)
electron_1.ipcMain.handle('set-domain-default-category', (event, domain, category) => {
    categoryConfig.domainDefaultCategories = categoryConfig.domainDefaultCategories || {};
    categoryConfig.domainDefaultCategories[domain.toLowerCase()] = category;
    saveCategoryConfig();
    console.log(`[DeskFlow] Updated default category for ${domain}: ${category}`);
    return true;
});

// NEW: Get default category for a domain (legacy - now falls back to Category Overrides)
electron_1.ipcMain.handle('get-domain-default-category', (event, domain) => {
    return categoryConfig.domainDefaultCategories?.[domain.toLowerCase()] || 'Entertainment';
});

// NEW: Get all domains with keyword rules enabled
electron_1.ipcMain.handle('get-keyword-enabled-domains', () => {
    return Object.keys(categoryConfig.domainKeywordRules || {});
});

// NEW: Add a new domain with keyword sets (array of { category, keywords })
// This replaces the old add-keyword-domain that took keywords + defaultCategory
electron_1.ipcMain.handle('add-keyword-domain', (event, domain, keywordSets) => {
    categoryConfig.domainKeywordRules = categoryConfig.domainKeywordRules || {};
    categoryConfig.domainKeywordRules[domain.toLowerCase()] = keywordSets;
    saveCategoryConfig();
    console.log(`[DeskFlow] Added keyword domain: ${domain} with`, JSON.stringify(keywordSets));
    return true;
});

// NEW: Remove keyword rules for a domain (revert to default categorization)
electron_1.ipcMain.handle('remove-keyword-domain', (event, domain) => {
    if (categoryConfig.domainKeywordRules) {
        delete categoryConfig.domainKeywordRules[domain.toLowerCase()];
    }
    if (categoryConfig.domainDefaultCategories) {
        delete categoryConfig.domainDefaultCategories[domain.toLowerCase()];
    }
    saveCategoryConfig();
    console.log(`[DeskFlow] Removed keyword domain: ${domain}`);
    return true;
});

electron_1.ipcMain.handle('set-tier-assignments', (event, assignments) => {
    categoryConfig.tierAssignments = assignments;
    saveCategoryConfig();
    invalidateTierMapCache();
    return true;
});

// Apply category changes to historical data
electron_1.ipcMain.handle('apply-category-to-historical', async (event, tierAssignments) => {
    if (useJson) {
        return { success: false, message: 'Not available in JSON mode' };
    }
    try {
        console.log('[DeskFlow] Applying category changes to historical data...');
        
        // For each category, find all logs that match and update their category
        // This is done by recalculating categories based on app/domain names
        let updatedCount = 0;
        
        // Get all logs
        const allLogs = db.prepare('SELECT * FROM logs').all();
        
        for (const log of allLogs) {
            const appName = log.app;
            const domain = log.domain;
            
            // Determine new category based on app/domain name
            let newCategory = categorizeApp(appName);
            
            // If browser tracking, check domain
            if (log.is_browser_tracking && domain) {
                newCategory = categorizeDomain(domain, log.title, log.url);
            }
            
            // Update if different
            if (log.category !== newCategory) {
                db.prepare('UPDATE logs SET category = ? WHERE id = ?').run(newCategory, log.id);
                updatedCount++;
            }
        }
        
        // Update aggregated tables
        updateAllAggregates();
        
        // Invalidate tier map cache since categories changed
        invalidateTierMapCache();
        
        console.log(`[DeskFlow] Updated ${updatedCount} historical log categories`);
        return { success: true, updatedCount };
    } catch (err: any) {
        console.error('[DeskFlow] Error applying to historical:', err);
        return { success: false, message: err.message };
    }
});

// Helper function to update all aggregate tables
function updateAllAggregates() {
    try {
        // Clear and rebuild daily_stats
        db.exec('DELETE FROM daily_stats');
        
        const logs = db.prepare('SELECT * FROM logs ORDER BY timestamp').all();
        for (const log of logs) {
            const date = log.timestamp.split('T')[0];
            const duration_sec = Math.floor(log.duration_ms / 1000);
            const app = log.app;
            const category = log.category;
            
            const existing = db.prepare('SELECT id FROM daily_stats WHERE date = ? AND app = ?').get(date, app);
            if (existing) {
                db.prepare('UPDATE daily_stats SET total_sec = total_sec + ?, sessions = sessions + 1 WHERE date = ? AND app = ?')
                    .run(duration_sec, date, app);
            } else {
                db.prepare('INSERT INTO daily_stats (date, app, category, total_sec, sessions) VALUES (?, ?, ?, ?, 1)')
                    .run(date, app, category, duration_sec);
            }
        }
        
        // Clear and rebuild daily_aggregates
        db.exec('DELETE FROM daily_aggregates');
        
        for (const log of logs) {
            const date = log.timestamp.split('T')[0];
            const duration_sec = Math.floor(log.duration_ms / 1000);
            const app = log.app;
            const category = log.category;
            
            const existing = db.prepare('SELECT id FROM daily_aggregates WHERE date = ? AND app = ?').get(date, app);
            if (existing) {
                db.prepare('UPDATE daily_aggregates SET total_sec = total_sec + ?, session_count = session_count + 1 WHERE date = ? AND app = ?')
                    .run(duration_sec, date, app);
            } else {
                db.prepare('INSERT INTO daily_aggregates (date, app, category, total_sec, session_count) VALUES (?, ?, ?, ?, 1)')
                    .run(date, app, category, duration_sec);
            }
        }
        
        // Clear and rebuild browser_sessions
        db.exec('DELETE FROM browser_sessions');
        
        const browserLogs = logs.filter(l => l.is_browser_tracking && l.domain);
        for (const log of browserLogs) {
            const date = log.timestamp.split('T')[0];
            const duration_sec = Math.floor(log.duration_ms / 1000);
            const domain = log.domain;
            const category = log.category;
            
            const existing = db.prepare('SELECT id FROM browser_sessions WHERE date = ? AND domain = ?').get(date, domain);
            if (existing) {
                db.prepare('UPDATE browser_sessions SET total_sec = total_sec + ?, session_count = session_count + 1 WHERE date = ? AND domain = ?')
                    .run(duration_sec, date, domain);
            } else {
                db.prepare('INSERT INTO browser_sessions (date, domain, category, total_sec, session_count) VALUES (?, ?, ?, ?, 1)')
                    .run(date, domain, category, duration_sec);
            }
        }
        
        console.log('[DeskFlow] ✅ All aggregate tables rebuilt');
    } catch (err) {
        console.error('[DeskFlow] Error rebuilding aggregates:', err);
    }
}

// ═══════════════════════════════════════════════════════════════════════
// DURATION ROUNDING & DATE HELPERS (Performance & Consistency)
// ═══════════════════════════════════════════════════════════════════════

function roundDuration(seconds) {
    return Math.round(seconds * 100) / 100;
}

function roundToSeconds(seconds) {
    return Math.floor(seconds);
}

function computeDateRange(period, dateOffset = 0) {
    const now = new Date();
    let startDate, endDate;

    if (period === 'today') {
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - dateOffset);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);
    } else if (period === 'week') {
        const currentWeekStart = new Date(now);
        currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());
        currentWeekStart.setHours(0, 0, 0, 0);
        startDate = new Date(currentWeekStart);
        startDate.setDate(startDate.getDate() - (dateOffset * 7));
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
    } else if (period === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth() - dateOffset, 1);
        endDate = new Date(now.getFullYear(), now.getMonth() - dateOffset + 1, 0, 23, 59, 59, 999);
    } else {
        // 'all'
        startDate = new Date(0);
        endDate = new Date(8640000000000000);
    }

    return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
    };
}

// ═══════════════════════════════════════════════════════════════════════
// DASHBOARD DATA IPC HANDLER - Single call replaces multiple fetches
// ═══════════════════════════════════════════════════════════════════════

electron_1.ipcMain.handle('get-dashboard-data', async (_, { period, dateOffset = 0 }) => {
    if (useJson) {
        return { success: false, error: 'Not available in JSON mode' };
    }
    ensureDb();
    try {
        const { startDate, endDate } = computeDateRange(period, dateOffset);

        // better-sqlite3 uses synchronous .prepare().all() pattern
        const hourlyStats = db.prepare(`
            SELECT hour, 
                   SUM(CASE WHEN app_type = 'app' THEN total_seconds ELSE 0 END) as app_seconds,
                   SUM(CASE WHEN app_type = 'domain' THEN total_seconds ELSE 0 END) as domain_seconds
            FROM stats_hourly
            WHERE date BETWEEN ? AND ?
            GROUP BY hour
            ORDER BY hour
        `).all(startDate, endDate);

        const dailyStats = db.prepare(`
            SELECT date, 
                   SUM(total_seconds) as total_seconds,
                   COUNT(DISTINCT app_name) as unique_apps
            FROM stats_daily
            WHERE date BETWEEN ? AND ?
            GROUP BY date
            ORDER BY date
        `).all(startDate, endDate);

        const topApps = db.prepare(`
            SELECT app_name, app_type, category, 
                   SUM(total_seconds) as total_seconds,
                   SUM(session_count) as session_count
            FROM stats_daily
            WHERE date BETWEEN ? AND ? AND (app_type IS NULL OR app_type = 'app')
            GROUP BY app_name
            ORDER BY total_seconds DESC
            LIMIT 20
        `).all(startDate, endDate);

        const topDomains = db.prepare(`
            SELECT app_name as domain, category,
                   SUM(total_seconds) as total_seconds,
                   SUM(session_count) as session_count
            FROM stats_daily
            WHERE date BETWEEN ? AND ? AND app_type = 'domain'
            GROUP BY app_name
            ORDER BY total_seconds DESC
            LIMIT 20
        `).all(startDate, endDate);

        const recentSessions = db.prepare(`
            SELECT * FROM (
              SELECT * FROM logs 
              WHERE is_browser_tracking IS NULL OR is_browser_tracking = 0
              ORDER BY timestamp DESC LIMIT 10
            )
            UNION ALL
            SELECT * FROM (
              SELECT * FROM logs 
              WHERE is_browser_tracking = 1
              ORDER BY timestamp DESC LIMIT 5
            )
            ORDER BY timestamp DESC
        `).all();

        return {
            success: true,
            data: {
                period,
                startDate,
                endDate,
                hourly: hourlyStats || [],
                daily: dailyStats || [],
                topApps: topApps || [],
                topDomains: topDomains || [],
                recentSessions: recentSessions || []
            }
        };
    } catch (err) {
        console.error('[DeskFlow] get-dashboard-data error:', err);
        return { success: false, error: err.message };
    }
});

// ── Helpers for dashboard aggregation ──────────────────────────────

function formatLocalDate(d: Date): string {
    return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
}

interface PeriodBounds {
    startDate: string;
    endDate: string;
    startISO: string;
    endISO: string;
    label: string;
    days: number;
}

const PERIOD_DAY_COUNT: Record<string, number> = {
    today: 1,
    week: 7,
    '7day': 7,
    month: 30,
    '30day': 30,
};

function resolvePeriodBounds(period: string, dateOffset = 0, weekOffset = 0): PeriodBounds {
    const now = new Date();
    let start: Date, end: Date;
    let label: string;
    const days = PERIOD_DAY_COUNT[period] || 90;

    switch (period) {
        case 'today': {
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            start.setDate(start.getDate() - dateOffset);
            end = new Date(start);
            end.setDate(end.getDate() + 1);
            const d = new Date(start);
            label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            break;
        }
        case 'week': {
            const day = now.getDay();
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day - dateOffset * 7);
            end = new Date(start);
            end.setDate(end.getDate() + 7);
            label = dateOffset === 0
                ? 'This Week'
                : `Week of ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
            break;
        }
        case '7day': {
            const end7 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            end7.setDate(end7.getDate() - dateOffset * 7 + 1);
            start = new Date(end7);
            start.setDate(start.getDate() - 6);
            end = new Date(end7);
            label = dateOffset === 0
                ? 'Last 7 Days'
                : `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
            break;
        }
        case 'month': {
            start = new Date(now.getFullYear(), now.getMonth() - dateOffset, 1);
            end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
            label = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            break;
        }
        case '30day': {
            const end30 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            end30.setDate(end30.getDate() - dateOffset * 30);
            start = new Date(end30);
            start.setDate(start.getDate() - 29);
            end = new Date(end30);
            label = dateOffset === 0
                ? 'Last 30 Days'
                : `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
            break;
        }
        case 'all':
        default: {
            start = new Date(2000, 0, 1);
            end = new Date(8640000000000000);
            label = 'All Time';
            break;
        }
    }

    return {
        startDate: formatLocalDate(start),
        endDate: formatLocalDate(end),
        startISO: start.toISOString(),
        endISO: end.toISOString(),
        label,
        days,
    };
}

function computePeriodRange(period: string, dateOffset: number = 0): { start: string; end: string } {
    const now = new Date();
    let start: Date, end: Date;
    switch (period) {
        case 'today':
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            break;
        case 'week': {
            const day = now.getDay();
            const diff = day === 0 ? 6 : day - 1;
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
            end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
            break;
        }
        case 'month':
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            break;
        case 'all':
        default:
            start = new Date(2000, 0, 1);
            end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            break;
    }
    if (dateOffset > 0 && period !== 'all') {
        const periodDays = period === 'today' ? 1 : period === 'week' ? 7 : 30;
        const shiftMs = dateOffset * periodDays * 86400000;
        start = new Date(start.getTime() - shiftMs);
        end = new Date(end.getTime() - shiftMs);
    }
    return { start: formatLocalDate(start), end: formatLocalDate(end) };
}

function computeWeekRange(period: string, dateOffset: number = 0, weekOffset: number = 0): { start: string; end: string } {
    const now = new Date();
    if (period === 'today') {
        // For today, only fetch 1 day of raw logs
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        start.setDate(start.getDate() - dateOffset);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        return { start: start.toISOString(), end: end.toISOString() };
    }
    // For week/month/all, use the full 7-day window centered on current week
    const day = now.getDay();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
    start.setDate(start.getDate() - weekOffset * 7);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    return { start: start.toISOString(), end: end.toISOString() };
}

function getTierMap(db: any): Map<string, string> {
    const now = Date.now();
    if (cachedTierMap && (now - tierMapLastRefresh) < TIER_MAP_CACHE_TTL_MS) {
        return cachedTierMap;
    }
    try {
        const map = new Map<string, string>();
        // Use DEFAULT_TIER_ASSIGNMENTS always, fall back to config's if non-empty
        const tierAssignments = (categoryConfig?.tierAssignments && typeof categoryConfig.tierAssignments === 'object' && Object.keys(categoryConfig.tierAssignments).length > 0)
            ? categoryConfig.tierAssignments
            : DEFAULT_TIER_ASSIGNMENTS;
        // Build reverse lookup: category → tier
        const catTier = new Map<string, string>();
        for (const t of ['productive', 'neutral', 'distracting'] as const) {
            if (Array.isArray(tierAssignments[t])) {
                for (const cat of tierAssignments[t]) catTier.set(cat, t);
            }
        }
        // Get all unique app_name + category pairs from stats_daily (or fall back to daily_aggregates, then logs)
        let rows = db.prepare('SELECT DISTINCT app_name, category FROM stats_daily WHERE category IS NOT NULL').all() as any[];
        let src = 'stats_daily';
        if (rows.length === 0) {
            rows = db.prepare('SELECT DISTINCT app as app_name, category FROM daily_aggregates WHERE category IS NOT NULL').all() as any[];
            src = 'daily_aggregates';
        }
        if (rows.length === 0) {
            rows = db.prepare('SELECT DISTINCT COALESCE(domain, app) as app_name, category FROM logs WHERE category IS NOT NULL').all() as any[];
            src = 'logs';
        }
        console.log(`[TierMap] source=${src} rows=${rows.length} catTier=${catTier.size} cats=${JSON.stringify([...catTier.keys()])}`);
        if (rows.length > 0) {
            console.log(`[TierMap] sample: app=${rows[0].app_name} cat=${rows[0].category} tier=${catTier.get(rows[0].category)}`);
        }
        for (const row of rows) {
            if (map.has(row.app_name)) continue;
            map.set(row.app_name, catTier.get(row.category) || 'neutral');
        }
        // Override with category_overrides if present
        const overrides = db.prepare('SELECT app, category FROM category_overrides').all() as any[];
        for (const row of overrides) {
            map.set(row.app, catTier.get(row.category) || 'neutral');
        }
        cachedTierMap = map;
        tierMapLastRefresh = now;
        return map;
    }
    catch (err) {
        console.error('[TierMap] Error building tier map:', err);
        // Emergency fallback: try using DEFAULT_TIER_ASSIGNMENTS directly
        try {
            const map = new Map<string, string>();
            const catTier = new Map<string, string>();
            for (const t of ['productive', 'neutral', 'distracting'] as const) {
                if (Array.isArray(DEFAULT_TIER_ASSIGNMENTS[t])) {
                    for (const cat of DEFAULT_TIER_ASSIGNMENTS[t]) catTier.set(cat, t);
                }
            }
            const rows = db.prepare('SELECT DISTINCT COALESCE(domain, app) as app_name, category FROM logs WHERE category IS NOT NULL').all() as any[];
            for (const row of rows) {
                if (map.has(row.app_name)) continue;
                map.set(row.app_name, catTier.get(row.category) || 'neutral');
            }
            console.log(`[TierMap] Emergency fallback: rows=${rows.length}`);
            cachedTierMap = map;
            tierMapLastRefresh = now;
            return map;
        }
        catch { return new Map(); }
    }
}

function computeElapsed(timestamp: string): string {
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function buildWeeklyHeatmap(rows: any[], tierMap: Map<string, string>): any[] {
    const byDate = new Map<string, { total: number; productive: number; neutral: number; distracting: number }>();
    for (const row of rows) {
        const existing = byDate.get(row.date) || { total: 0, productive: 0, neutral: 0, distracting: 0 };
        existing.total += row.total_seconds;
        const tier = tierMap.get(row.app_name) || 'neutral';
        if (tier === 'productive') existing.productive += row.total_seconds;
        else if (tier === 'distracting') existing.distracting += row.total_seconds;
        else existing.neutral += row.total_seconds;
        byDate.set(row.date, existing);
    }
    const result: any[] = [];
    for (const [date, data] of byDate) {
        const d = new Date(date + 'T12:00:00');
        result.push({
            date,
            dayLabel: d.toLocaleDateString('en', { weekday: 'short' }),
            totalDuration: data.total,
            productiveHours: +(data.productive / 3600).toFixed(1),
            neutralHours: +(data.neutral / 3600).toFixed(1),
            distractingHours: +(data.distracting / 3600).toFixed(1),
        });
    }
    return result;
}

function buildHourlyHeatmap(logs: any[], tierMap: Map<string, string>, weekRange: { start: string; end: string }): any {
    const grid: any = {};
    const startDate = new Date(weekRange.start);
    const endDate = new Date(weekRange.end);
    const dayCount = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)));
    for (let d = 0; d < dayCount; d++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + d);
        const dateKey = formatLocalDate(date);
        grid[dateKey] = {};
        for (let h = 0; h < 24; h++) {
            grid[dateKey][h] = { appSeconds: 0, domainSeconds: 0, productive: 0, neutral: 0, distracting: 0, apps: {} };
        }
    }
    for (const log of logs) {
        const sessionStart = new Date(log.timestamp);
        const sessionEndMs = sessionStart.getTime() + log.duration_ms;
        const sessionEnd = new Date(sessionEndMs);
        const appName = log.domain || log.app;
        const tier = tierMap.get(appName) || 'neutral';
        const isDomain = log.app_type === 'domain' || !!log.domain;
        let current = new Date(sessionStart);
        while (current < sessionEnd) {
            const hourEnd = new Date(current);
            hourEnd.setHours(hourEnd.getHours() + 1, 0, 0, 0);
            const chunkEnd = sessionEnd < hourEnd ? sessionEnd : hourEnd;
            const chunkSeconds = (chunkEnd.getTime() - current.getTime()) / 1000;
            const dateKey = formatLocalDate(current);
            const hour = current.getHours();
            if (grid[dateKey] && grid[dateKey][hour] !== undefined) {
                const cell = grid[dateKey][hour];
                if (isDomain) cell.domainSeconds += chunkSeconds;
                else cell.appSeconds += chunkSeconds;
                if (tier === 'productive') cell.productive += chunkSeconds;
                else if (tier === 'distracting') cell.distracting += chunkSeconds;
                else cell.neutral += chunkSeconds;
                if (!cell.apps[appName]) cell.apps[appName] = { seconds: 0, tier };
                cell.apps[appName].seconds += chunkSeconds;
            }
            current = hourEnd;
        }
    }
    return grid;
}

// ── Freeze-resistant terminal logging ──────────────────────────────
function frozenLog(...args: any[]) {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a).substring(0,200) : String(a)).join(' ');
  process.stderr.write(`[FROZEN-DBG] ${msg}\n`);
  console.log(`[FROZEN-DBG] ${msg}`);
}

electron_1.ipcMain.handle('terminal:log', async (_, ...args: any[]) => {
  frozenLog(...args);
  return { success: true };
});

// ── Dashboard cache (period→data, invalidated on stats_daily write) ──
let dashboardCache: { key: string; data: any; builtAt: number } | null = null;
let statsDirty = true;
const DASHBOARD_TTL_MS = 60_000;
function markStatsDirty() { statsDirty = true; }

// In-flight dedupe for overlapping requests
const dashboardInFlight = new Map<string, Promise<any>>();

// ── IPC: get-dashboard-aggregates ───────────────────────────────────
electron_1.ipcMain.handle('get-dashboard-aggregates', async (_, request: { period: string; dateOffset?: number; weekOffset?: number }) => {
    ensureDb();
    const { period, dateOffset = 0, weekOffset = 0 } = request;
    const cacheKey = `${period}|${dateOffset}|${weekOffset}`;
    const t0 = Date.now();
    frozenLog('get-dashboard-aggregates START', period, dateOffset, weekOffset);

    // In-flight dedupe — share the same promise for identical in-flight requests
    const existing = dashboardInFlight.get(cacheKey);
    if (existing) {
        frozenLog('get-dashboard-aggregates REUSING IN-FLIGHT');
        return existing;
    }

    // Fresh cache check
    const fresh = dashboardCache
        && dashboardCache.key === cacheKey
        && !statsDirty
        && (Date.now() - dashboardCache.builtAt) < DASHBOARD_TTL_MS;
    if (fresh) {
        frozenLog('get-dashboard-aggregates CACHE HIT after', Date.now() - t0, 'ms');
        return dashboardCache.data;
    }
    frozenLog('get-dashboard-aggregates CACHE MISS — running queries');

    const pInner = (async () => {
        try {
            const t1 = Date.now();
            const periodRange = computePeriodRange(period, dateOffset);
            frozenLog('computePeriodRange done in', Date.now() - t1, 'ms range:', periodRange.start, periodRange.end);
            const weekRange = computeWeekRange(period, dateOffset, weekOffset);
            const tierMap = getTierMap(db);

            // 1. Weekly heatmap (single-pass — tier breakdown merged into this loop)
            const tQ1 = Date.now();
            const weeklyRows = db.prepare(`
                SELECT date, app_name, total_seconds FROM stats_daily
                WHERE date >= ? AND date <= ?
                ORDER BY date
            `).all(periodRange.start, periodRange.end) as any[];
            frozenLog('Q1 (stats_daily weekly) took', Date.now() - tQ1, 'ms rows:', weeklyRows.length);
            const weeklyHeatmap = buildWeeklyHeatmap(weeklyRows, tierMap);

            // 2. Hourly heatmap (raw logs for target week)
            const tQ2 = Date.now();
            const hourlyLogs = db.prepare(`
                SELECT timestamp, app, category, duration_ms, domain
                FROM logs WHERE timestamp >= ? AND timestamp < ? AND duration_ms > 0
                ORDER BY timestamp
            `).all(weekRange.start, weekRange.end) as any[];
            frozenLog('Q2 (logs hourly) took', Date.now() - tQ2, 'ms rows:', hourlyLogs.length);

            const hourlyHeatmap = buildHourlyHeatmap(hourlyLogs, tierMap, weekRange);

            // 3. Website stats
            const tQ3 = Date.now();
            const websiteStats = db.prepare(`
                SELECT app_name as domain, category,
                       SUM(total_seconds) as totalSeconds,
                       SUM(session_count) as sessions
                FROM stats_daily
                WHERE date >= ? AND date < ? AND app_type = 'domain'
                GROUP BY app_name, category
                ORDER BY totalSeconds DESC
            `).all(periodRange.start, periodRange.end);

            // 4. App stats
            const appStatsRaw = db.prepare(`
                SELECT app_name as app, category,
                       SUM(total_seconds) as totalSeconds,
                       SUM(session_count) as sessions
                FROM stats_daily
                WHERE date >= ? AND date < ? AND app_type = 'app'
                GROUP BY app_name, category
                ORDER BY totalSeconds DESC
            `).all(periodRange.start, periodRange.end) as any[];
            const appStats = appStatsRaw.map((row: any) => ({ ...row, tier: tierMap.get(row.app) || 'neutral' }));
            frozenLog('Q3-4 (stats_daily group) took', Date.now() - tQ3, 'ms');

            // 5. Overview stats
            const overviewBase = db.prepare(`
                SELECT SUM(total_seconds) as totalSeconds
                FROM stats_daily
                WHERE date >= ? AND date < ?
            `).get(periodRange.start, periodRange.end) as any;

            let productiveSeconds = 0, neutralSeconds = 0, distractingSeconds = 0;
            for (const row of weeklyRows) {
                const tier = tierMap.get(row.app_name) || 'neutral';
                if (tier === 'productive') productiveSeconds += row.total_seconds;
                else if (tier === 'distracting') distractingSeconds += row.total_seconds;
                else neutralSeconds += row.total_seconds;
            }

            // 6. Recent sessions — group consecutive same-app logs into sessions (LIMIT 20)
            const t6 = Date.now();
            const recentLogsRaw = db.prepare(`
                SELECT id, timestamp, app, title, duration_ms, category, is_browser_tracking, domain, url
                FROM logs ORDER BY id DESC LIMIT 200
            `).all() as any[];
            frozenLog('query 6 (recent logs 200) done in', Date.now() - t6, 'ms');

            // Group consecutive same-app entries (within 10s gap) into sessions
            const sessions: any[] = [];
            for (const log of recentLogsRaw) {
                const appName = log.is_browser_tracking ? (log.domain || log.app) : log.app;
                const lastSession = sessions.length > 0 ? sessions[sessions.length - 1] : null;
                const logTime = new Date(log.timestamp).getTime();

                if (lastSession && lastSession.app === appName && lastSession.isBrowser === !!log.is_browser_tracking) {
                    const gap = lastSession.startTime - logTime;
                    if (gap < 10000) {
                        lastSession.durationSeconds += Math.round((log.duration_ms || 0) / 1000);
                        lastSession.startTime = logTime;
                        lastSession.id = log.id;
                        continue;
                    }
                }
                sessions.push({
                    id: log.id,
                    timestamp: log.timestamp,
                    app: appName,
                    title: log.title || '',
                    durationSeconds: Math.round((log.duration_ms || 0) / 1000),
                    category: log.category || 'Other',
                    isBrowser: !!log.is_browser_tracking,
                    domain: log.domain,
                    url: log.url,
                    startTime: logTime,
                });
                if (sessions.length >= 15) break;
            }
            const recentSessions = sessions.map((s: any) => ({
                ...s,
                elapsed: computeElapsed(new Date(s.startTime).toISOString()),
            }));

            // 7. Fallback: if stats_daily is empty but logs have data, aggregate directly
            const totalSeconds = overviewBase?.totalSeconds || 0;
            if (totalSeconds === 0 || weeklyRows.length === 0) {
                const logTotal = db.prepare(`
                    SELECT SUM(CAST(duration_ms AS REAL) / 1000.0) as totalSeconds
                    FROM logs WHERE duration_ms > 0 AND timestamp >= ? AND timestamp < ?
                `).get(periodRange.start, periodRange.end) as any;
                if (logTotal?.totalSeconds) {
                    const fallbackRows = db.prepare(`
                        SELECT DATE(timestamp) as date, COALESCE(domain, app) as app_name,
                               SUM(CAST(duration_ms AS REAL) / 1000.0) as total_seconds
                        FROM logs WHERE duration_ms > 0 AND timestamp >= ? AND timestamp <= ?
                        GROUP BY DATE(timestamp), COALESCE(domain, app)
                        ORDER BY date
                    `).all(periodRange.start, periodRange.end) as any[];
                    let fbProductive = 0, fbNeutral = 0, fbDistracting = 0;
                    let fbSample = '';
                    for (const row of fallbackRows) {
                        const tier = tierMap.get(row.app_name) || 'neutral';
                        if (!fbSample) fbSample = `app=${row.app_name} tier=${tier} secs=${row.total_seconds}`;
                        if (tier === 'productive') fbProductive += row.total_seconds;
                        else if (tier === 'distracting') fbDistracting += row.total_seconds;
                        else fbNeutral += row.total_seconds;
                    }
                    console.log(`[DashFallback] rows=${fallbackRows.length} total=${logTotal.totalSeconds} productive=${fbProductive} neutral=${fbNeutral} distracting=${fbDistracting} sample="${fbSample}"`);
                    const fallbackWebsite = db.prepare(`
                        SELECT domain, category,
                               SUM(CAST(duration_ms AS REAL) / 1000.0) as totalSeconds,
                               COUNT(*) as sessions
                        FROM logs WHERE domain IS NOT NULL AND duration_ms > 0 AND timestamp >= ? AND timestamp < ?
                        GROUP BY domain, category
                        ORDER BY totalSeconds DESC
                    `).all(periodRange.start, periodRange.end);
                    const fallbackApps = db.prepare(`
                        SELECT app, category,
                               SUM(CAST(duration_ms AS REAL) / 1000.0) as totalSeconds,
                               COUNT(*) as sessions
                        FROM logs WHERE domain IS NULL AND duration_ms > 0 AND timestamp >= ? AND timestamp < ?
                        GROUP BY app, category
                        ORDER BY totalSeconds DESC
                    `).all(periodRange.start, periodRange.end) as any[];
                    return {
                        weeklyHeatmap: buildWeeklyHeatmap(fallbackRows, tierMap),
                        hourlyHeatmap,
                        websiteStats: fallbackWebsite,
                        appStats: fallbackApps.map((row: any) => ({ ...row, tier: tierMap.get(row.app) || 'neutral' })),
                        overview: {
                            totalSeconds: logTotal.totalSeconds,
                            productiveSeconds: fbProductive,
                            neutralSeconds: fbNeutral,
                            distractingSeconds: fbDistracting,
                        },
                        recentSessions,
                    };
                }
            }

            const totalMs = Date.now() - t0;
            frozenLog('get-dashboard-aggregates TOTAL in', totalMs, 'ms');
            return {
                weeklyHeatmap,
                hourlyHeatmap,
                websiteStats,
                appStats,
                overview: {
                    totalSeconds,
                    productiveSeconds,
                    neutralSeconds,
                    distractingSeconds,
                },
                recentSessions,
            };
        }
        catch (err: any) {
            frozenLog('get-dashboard-aggregates ERROR:', err.message);
            console.error('[DeskFlow] get-dashboard-aggregates error:', err);
            return { error: err.message };
        }
    })();

    pInner.then((response) => {
        frozenLog('dashboard cache stored for', cacheKey);
        dashboardCache = { key: cacheKey, data: response, builtAt: Date.now() };
        if (period === 'all') statsDirty = false;
        dashboardInFlight.delete(cacheKey);
    }).catch(() => {
        dashboardInFlight.delete(cacheKey);
    });
    dashboardInFlight.set(cacheKey, pInner);
    return pInner;
});

// ── IPC: get-app-stats ──────────────────────────────────────────────
electron_1.ipcMain.handle('get-app-stats', async (_, request: { period: string; dateOffset?: number }) => {
    ensureDb();
    try {
        const { period, dateOffset = 0 } = request;
        const range = computePeriodRange(period, dateOffset);
        const tierMap = getTierMap(db);
        const rows = db.prepare(`
            SELECT app_name as app, category, app_type,
                   SUM(total_seconds) as totalSeconds,
                   SUM(session_count) as sessions
            FROM stats_daily
            WHERE date >= ? AND date < ?
            GROUP BY app_name, category, app_type
            ORDER BY totalSeconds DESC
        `).all(range.start, range.end) as any[];
        return rows.map((row: any) => ({ ...row, tier: tierMap.get(row.app) || 'neutral' }));
    }
    catch (err: any) {
        console.error('[DeskFlow] get-app-stats error:', err);
        return [];
    }
});

// ═══════════════════════════════════════════════════════════════════════
// PAGE STATS IPC HANDLER - Pre-computed stats per page
// ═══════════════════════════════════════════════════════════════════════

electron_1.ipcMain.handle('get-page-stats', async (_, { page, period, dateOffset = 0 }) => {
    if (useJson) {
        return { success: false, error: 'Not available in JSON mode' };
    }
    try {
        const { startDate, endDate } = computeDateRange(period, dateOffset);

        if (page === 'stats') {
            const hourlyDistribution = db.prepare(`
                SELECT hour, 
                       ROUND(SUM(total_seconds) / 3600.0, 2) as hours,
                       GROUP_CONCAT(app_name || ':' || CAST(ROUND(total_seconds) AS INTEGER)) as app_breakdown
                FROM stats_hourly
                WHERE date BETWEEN ? AND ?
                GROUP BY hour
                ORDER BY hour
            `).all(startDate, endDate);

            const categoryBreakdown = db.prepare(`
                SELECT category, SUM(total_seconds) as total_seconds
                FROM stats_daily
                WHERE date BETWEEN ? AND ? AND category IS NOT NULL
                GROUP BY category
                ORDER BY total_seconds DESC
            `).all(startDate, endDate);

            const appLeaderboard = db.prepare(`
                SELECT app_name, app_type, 
                       ROUND(SUM(total_seconds) / 3600.0, 2) as hours,
                       SUM(session_count) as sessions
                FROM stats_daily
                WHERE date BETWEEN ? AND ?
                GROUP BY app_name
                ORDER BY total_seconds DESC
                LIMIT 50
            `).all(startDate, endDate);

            return {
                success: true,
                data: {
                    hourlyDistribution: hourlyDistribution || [],
                    categoryBreakdown: categoryBreakdown || [],
                    appLeaderboard: appLeaderboard || []
                }
            };
        }

        if (page === 'browser') {
            const domains = db.prepare(`
                SELECT app_name as domain, 
                       ROUND(SUM(total_seconds) / 3600.0, 2) as hours,
                       SUM(session_count) as visits
                FROM stats_daily
                WHERE date BETWEEN ? AND ? AND app_type = 'domain'
                GROUP BY app_name
                ORDER BY total_seconds DESC
                LIMIT 100
            `).all(startDate, endDate);

            const categories = db.prepare(`
                SELECT category, 
                       ROUND(SUM(total_seconds) / 3600.0, 2) as hours
                FROM stats_daily
                WHERE date BETWEEN ? AND ? AND app_type = 'domain' AND category IS NOT NULL
                GROUP BY category
                ORDER BY total_seconds DESC
            `).all(startDate, endDate);

            const hourlyDistribution = db.prepare(`
                SELECT hour, ROUND(SUM(total_seconds) / 60.0, 1) as minutes
                FROM stats_hourly
                WHERE date BETWEEN ? AND ? AND app_type = 'domain'
                GROUP BY hour
                ORDER BY hour
            `).all(startDate, endDate);

            return {
                success: true,
                data: {
                    domains: domains || [],
                    categories: categories || [],
                    hourlyDistribution: hourlyDistribution || []
                }
            };
        }

        return { success: false, error: 'Unknown page' };
    } catch (err) {
        console.error('[DeskFlow] get-page-stats error:', err);
        return { success: false, error: err.message };
    }
});

// ═══════════════════════════════════════════════════════════════════════
// BACKFILL AGGREGATIONS - For existing data migration
// ═══════════════════════════════════════════════════════════════════════

electron_1.ipcMain.handle('backfill-aggregations', async () => {
    if (useJson) {
        return { success: false, message: 'Not available in JSON mode' };
    }
    try {
        console.log('[DeskFlow] Backfilling aggregations...');

        db.exec('DELETE FROM stats_hourly');
        db.run(`
            INSERT OR REPLACE INTO stats_hourly (date, hour, app_name, app_type, category, total_seconds, session_count)
            SELECT 
              DATE(timestamp) as date,
              CAST(STRFTIME('%H', timestamp) AS INTEGER) as hour,
              COALESCE(domain, app) as app_name,
              CASE WHEN domain IS NOT NULL THEN 'domain' ELSE 'app' END as app_type,
              category,
              SUM(CAST(duration_ms AS REAL) / 1000.0) as total_seconds,
              COUNT(*) as session_count
            FROM logs
            WHERE duration_ms > 0
            GROUP BY date, hour, app_name
        `);

        db.exec('DELETE FROM stats_daily');
        db.run(`
            INSERT OR REPLACE INTO stats_daily (date, app_name, app_type, category, total_seconds, session_count)
            SELECT 
              DATE(timestamp) as date,
              COALESCE(domain, app) as app_name,
              CASE WHEN domain IS NOT NULL THEN 'domain' ELSE 'app' END as app_type,
              category,
              SUM(CAST(duration_ms AS REAL) / 1000.0) as total_seconds,
              COUNT(*) as session_count
            FROM logs
            WHERE duration_ms > 0
            GROUP BY date, app_name
        `);

        db.exec('DELETE FROM app_totals');
        db.run(`
            INSERT OR REPLACE INTO app_totals (app_name, app_type, category, total_seconds, session_count, last_seen)
            SELECT 
              COALESCE(domain, app) as app_name,
              CASE WHEN domain IS NOT NULL THEN 'domain' ELSE 'app' END as app_type,
              category,
              SUM(CAST(duration_ms AS REAL) / 1000.0) as total_seconds,
              COUNT(*) as session_count,
              MAX(timestamp) as last_seen
            FROM logs
            WHERE duration_ms > 0
            GROUP BY app_name
        `);

        console.log('[DeskFlow] Backfill complete');
        return { success: true };
    } catch (err) {
        console.error('[DeskFlow] backfill error:', err);
        return { success: false, message: err.message };
    }
});

electron_1.ipcMain.handle('get-default-categories', () => {
    return DEFAULT_CATEGORIES;
});
electron_1.ipcMain.handle('add-category', (event, name) => {
    categoryConfig.customCategories = categoryConfig.customCategories || [];
    if (categoryConfig.customCategories.includes(name)) return false;
    if (DEFAULT_CATEGORIES.includes(name)) return false;
    categoryConfig.customCategories.push(name);
    categoryConfig.tierAssignments.neutral.push(name);
    saveCategoryConfig();
    return true;
});
electron_1.ipcMain.handle('remove-category', (event, name) => {
    categoryConfig.customCategories = (categoryConfig.customCategories || []).filter(c => c !== name);
    categoryConfig.tierAssignments.productive = categoryConfig.tierAssignments.productive.filter(c => c !== name);
    categoryConfig.tierAssignments.neutral = categoryConfig.tierAssignments.neutral.filter(c => c !== name);
    categoryConfig.tierAssignments.distracting = categoryConfig.tierAssignments.distracting.filter(c => c !== name);
    saveCategoryConfig();
    return true;
});
electron_1.ipcMain.handle('get-tier-assignments', () => {
    return categoryConfig.tierAssignments;
});
// Get logs filtered by period
electron_1.ipcMain.handle('get-logs-by-period', (event, params) => {
    ensureDb();
    try {
        const period = typeof params === 'string' ? params : params.period;
        const dateOffset = typeof params === 'string' ? 0 : (params.dateOffset || 0);
        if (useJson) {
            const bounds = resolvePeriodBounds(period, dateOffset);
            const cutoff = bounds.startISO;
            return jsonLogs.filter(l => new Date(l.timestamp) >= new Date(cutoff));
        }
        const bounds = resolvePeriodBounds(period, dateOffset);
        const stmt = db.prepare(`SELECT * FROM logs WHERE timestamp >= ? ORDER BY id DESC`);
        return stmt.all(bounds.startISO);
    }
    catch (err) {
        console.error('[DeskFlow] get-logs-by-period error:', err);
        return [];
    }
});
// Get daily stats for a period
electron_1.ipcMain.handle('get-daily-stats', (event, period) => {
    try {
        if (useJson) {
            // Compute from JSON logs
            const now = new Date();
            let filtered = jsonLogs.filter(l => !l.is_browser_tracking);
            if (period === 'week') {
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                filtered = filtered.filter(l => new Date(l.timestamp) >= weekAgo);
            }
            else if (period === 'month') {
                const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                filtered = filtered.filter(l => new Date(l.timestamp) >= monthAgo);
            }
            const grouped = {};
            for (const log of filtered) {
                const date = log.timestamp.split('T')[0];
                const appName = log.app;
                if (!grouped[date])
                    grouped[date] = {};
                if (!grouped[date][appName])
                    grouped[date][appName] = { total_sec: 0, sessions: 0, app: appName, category: log.category };
                grouped[date][appName].total_sec += Math.floor(log.duration_ms / 1000);
                grouped[date][appName].sessions += 1;
            }
            return grouped;
        }
        const days = period === 'week' ? 7 : period === 'month' ? 30 : 365;
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const stmt = db.prepare(`
      SELECT
        date(timestamp) as day,
        CASE
          WHEN is_browser_tracking = 1 AND domain IS NOT NULL AND domain != '' THEN domain
          ELSE app
        END as app,
        category,
        SUM(duration_ms) / 1000 as total_sec,
        COUNT(*) as sessions,
        AVG(duration_ms) / 1000 as avg_session_sec
      FROM logs
      WHERE date(timestamp) >= ?
      GROUP BY day,
        CASE
          WHEN is_browser_tracking = 1 AND domain IS NOT NULL AND domain != '' THEN domain
          ELSE app
        END
      ORDER BY day DESC, total_sec DESC
    `);
        return stmt.all(cutoff);
    }
    catch (err) {
        console.error('[DeskFlow] get-daily-stats error:', err);
        return [];
    }
});
// Get daily productivity data
electron_1.ipcMain.handle('get-daily-productivity', (event, date) => {
    try {
        const dayStart = `${date}T00:00:00`;
        const dayEnd = `${date}T23:59:59`;
        let dayLogs;
        if (useJson) {
            dayLogs = jsonLogs.filter(l => l.timestamp >= dayStart &&
                l.timestamp <= dayEnd);
        }
        else {
            const stmt = db.prepare(`
        SELECT * FROM logs
        WHERE timestamp >= ? AND timestamp <= ?
        ORDER BY timestamp
      `);
            dayLogs = stmt.all(dayStart, dayEnd);
        }
        const productivity = calculateProductivityScore(dayLogs);
        // Calculate wall-clock time (first log to last log)
        let wallClockSec = 0;
        if (dayLogs.length > 0) {
            const timestamps = dayLogs.map(l => new Date(l.timestamp).getTime());
            const first = Math.min(...timestamps);
            const last = Math.max(...timestamps);
            wallClockSec = Math.floor(Math.max(0, (last - first) / 1000));
        }
        return {
            date,
            ...productivity,
            wall_clock_sec: wallClockSec,
            total_sessions: dayLogs.length,
            first_activity: dayLogs.length > 0 ? dayLogs[0].timestamp : null,
            last_activity: dayLogs.length > 0 ? dayLogs[dayLogs.length - 1].timestamp : null
        };
    }
    catch (err) {
        console.error('[DeskFlow] get-daily-productivity error:', err);
        return null;
    }
});
// Get productivity data for a date range
electron_1.ipcMain.handle('get-productivity-range', (event, startDate, endDate) => {
    try {
        let allLogs;
        if (useJson) {
            allLogs = jsonLogs.filter(l => l.timestamp >= `${startDate}T00:00:00` &&
                l.timestamp <= `${endDate}T23:59:59`);
        }
        else {
            const stmt = db.prepare(`
        SELECT * FROM logs
        WHERE timestamp >= ? AND timestamp <= ?
        ORDER BY timestamp
      `);
            allLogs = stmt.all(`${startDate}T00:00:00`, `${endDate}T23:59:59`);
        }
        // Group by date
        const groupedByDate: Record<string, any[]> = {};
        for (const log of allLogs) {
            const date = log.timestamp.split('T')[0];
            if (!groupedByDate[date])
                groupedByDate[date] = [];
            groupedByDate[date].push(log);
        }
        // Calculate productivity for each date
        const results = Object.entries(groupedByDate).map(([date, logs]: [string, any[]]) => {
            const productivity = calculateProductivityScore(logs);
            let wallClockSec = 0;
            if (logs.length > 0) {
                const timestamps = logs.map(l => new Date(l.timestamp).getTime());
                const first = Math.min(...timestamps);
                const last = Math.max(...timestamps);
                wallClockSec = Math.floor(Math.max(0, (last - first) / 1000));
            }
            return {
                date,
                ...productivity,
                wall_clock_sec: wallClockSec,
                total_sessions: logs.length
            };
        });
        return results.sort((a, b) => a.date.localeCompare(b.date));
    }
    catch (err) {
        console.error('[DeskFlow] get-productivity-range error:', err);
        return [];
    }
});
// --- Browser Tracking IPC Handlers ---
// Get browser logs - with optional period filtering and dateOffset
electron_1.ipcMain.handle('get-browser-logs', (event, period = 'week', dateOffset = 0) => {
    try {
        return getBrowserLogs(period, dateOffset);
    }
    catch (err) {
        console.error('[DeskFlow] get-browser-logs error:', err);
        return [];
    }
});
// Get browser stats grouped by domain - with optional period filtering and dateOffset
electron_1.ipcMain.handle('get-browser-domain-stats', (event, period = 'week', dateOffset = 0) => {
    try {
        return getBrowserDomainStats(period, dateOffset);
    }
    catch (err) {
        console.error('[DeskFlow] get-browser-domain-stats error:', err);
        return [];
    }
});
electron_1.ipcMain.handle('get-browser-category-stats', (event, period = 'week', dateOffset = 0) => {
    try {
        return getBrowserCategoryStats(period, dateOffset);
    }
    catch (err) {
        console.error('[DeskFlow] get-browser-category-stats error:', err);
        return [];
    }
});
electron_1.ipcMain.handle('get-available-browsers', async () => {
    const browsers: string[] = [];
    const platform = process.platform;
    
    try {
        if (platform === 'win32') {
            const browserPaths: Record<string, string> = {
                'chrome': path_1.default.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
                'firefox': path_1.default.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Mozilla Firefox', 'firefox.exe'),
                'edge': path_1.default.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
                'brave': path_1.default.join(process.env.LOCALAPPDATA || '', 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
                'opera': path_1.default.join(process.env.APPDATA || '', 'Opera Software', 'Opera Stable', 'opera.exe'),
                'vivaldi': path_1.default.join(process.env.LOCALAPPDATA || '', 'Vivaldi', 'Application', 'vivaldi.exe'),
                'comet': path_1.default.join(process.env.LOCALAPPDATA || '', 'Programs', 'comet', 'Comet.exe'),
            };
            
            for (const [browser, browserPath] of Object.entries(browserPaths)) {
                try {
                    await fs_1.default.promises.access(browserPath);
                    browsers.push(browser);
                } catch {
                    // Browser not found at that path
                }
            }
        } else if (platform === 'darwin') {
            const macBrowserPaths: Record<string, string> = {
                'chrome': '/Applications/Google Chrome.app',
                'firefox': '/Applications/Firefox.app',
                'safari': '/Applications/Safari.app',
                'brave': '/Applications/Brave Browser.app',
                'arc': '/Applications/Arc.app',
                'edge': '/Applications/Microsoft Edge.app',
                'opera': '/Applications/Opera.app',
                'vivaldi': '/Applications/Vivaldi.app',
                'comet': '/Applications/Comet.app',
            };
            
            for (const [browser, browserPath] of Object.entries(macBrowserPaths)) {
                try {
                    await fs_1.default.promises.access(browserPath);
                    browsers.push(browser);
                } catch {
                    // Browser not found
                }
            }
        } else {
            // Linux
            browsers.push('chrome', 'firefox', 'brave', 'edge', 'chromium', 'comet');
        }
    } catch (err) {
        console.error('[DeskFlow] Error detecting browsers:', err);
    }
    
    // Always include Chrome as fallback if none found
    if (browsers.length === 0) {
        browsers.push('chrome', 'firefox', 'edge', 'comet');
    }
    
    console.log('[DeskFlow] Detected browsers:', browsers);
    return browsers;
});

const KNOWN_BROWSERS = ['chrome', 'firefox', 'safari', 'edge', 'brave', 'opera', 'vivaldi', 'arc', 'comet'];

electron_1.ipcMain.handle('get-tracked-browsers', async () => {
    const browsers: string[] = [];
    try {
        // Get ALL apps categorized as "Browser" from the database
        if (db) {
            const rows = db.prepare(`
                SELECT DISTINCT app FROM logs 
                WHERE LOWER(category) = 'browser'
            `).all() as { app: string }[];
            rows.forEach(row => {
                if (row.app && !browsers.includes(row.app)) {
                    browsers.push(row.app);
                }
            });
        } else if (useJson && jsonLogs.length > 0) {
            const seen = new Set<string>();
            jsonLogs.forEach(log => {
                const cat = (log.category || '').toLowerCase();
                if (cat === 'browser' && !seen.has(log.app)) {
                    seen.add(log.app);
                    browsers.push(log.app);
                }
            });
        }
        // Also check category config for apps mapped to "Browser" category
        if (categoryConfig?.appCategoryMap) {
            for (const [app, cat] of Object.entries(categoryConfig.appCategoryMap)) {
                if (cat === 'Browser' && !browsers.includes(app)) {
                    browsers.push(app);
                }
            }
        }
    } catch (err) {
        console.error('[DeskFlow] Error getting tracked browsers:', err);
    }
    // The browser with the extension should appear first in the list
    const extensionBrowser = userPreferences.browserWithExtension;
    if (extensionBrowser) {
        const idx = browsers.findIndex(b => b.toLowerCase() === extensionBrowser.toLowerCase());
        if (idx > 0) {
            browsers.splice(idx, 1);
            browsers.unshift(extensionBrowser);
        } else if (idx === -1) {
            // Add the extension browser even if not in DB yet
            browsers.unshift(extensionBrowser);
        }
    }
    console.log('[DeskFlow] Tracked browser apps:', browsers);
    return browsers;
});

electron_1.ipcMain.handle('get-browser-tracking', () => {
    return isBrowserTrackingEnabled;
});
electron_1.ipcMain.handle('set-browser-tracking', (event, enabled) => {
    isBrowserTrackingEnabled = enabled;
    userPreferences.browserTrackingEnabled = enabled;
    savePreferences();
    console.log(`[DeskFlow] Browser tracking: ${enabled ? 'ON' : 'OFF'}`);
    // Restart server if needed
    if (enabled && !browserServer) {
        startBrowserTrackingServer();
    }
    else if (!enabled && browserServer) {
        browserServer.close();
        browserServer = null;
        stopBrowserSessionFlushTimer(); // FIX 2: Stop the flush timer too
        console.log('[DeskFlow] 🚫 Browser tracking server stopped');
    }
    return enabled;
});
electron_1.ipcMain.handle('get-browser-tracking-status', () => {
    return {
        enabled: isBrowserTrackingEnabled,
        serverRunning: browserServer !== null,
        port: browserServerPort,
        excludedDomains: browserExcludedDomains
    };
});
electron_1.ipcMain.handle('set-recording-mode', (event, { type, mode }) => {
    if (type === 'browser') {
        browserRecordingMode = mode;
        userPreferences.browserRecordingMode = mode;
    } else if (type === 'app') {
        appRecordingMode = mode;
        userPreferences.appRecordingMode = mode;
    }
    savePreferences();
    console.log(`[DeskFlow] ${type} recording mode: ${mode}`);
    return true;
});
electron_1.ipcMain.handle('get-recording-modes', () => ({
    browser: browserRecordingMode,
    app: appRecordingMode,
    browserPageVisible,
    dashboardPageVisible
}));
electron_1.ipcMain.handle('set-page-visibility', (event, { page, visible }) => {
    if (page === 'browser') {
        browserPageVisible = visible;
        console.log(`[DeskFlow] Browser page visibility: ${visible ? 'VISIBLE' : 'HIDDEN'}`);
    } else if (page === 'dashboard') {
        dashboardPageVisible = visible;
        console.log(`[DeskFlow] Dashboard page visibility: ${visible ? 'VISIBLE' : 'HIDDEN'}`);
    }
    return true;
});
electron_1.ipcMain.handle('set-browser-excluded-domains', (event, domains) => {
    browserExcludedDomains = domains;
    userPreferences.browserExcludedDomains = domains;
    savePreferences();
    return true;
});
electron_1.ipcMain.handle('set-browser-with-extension', (event, browser: string) => {
    userPreferences.browserWithExtension = browser;
    savePreferences();
    console.log(`[DeskFlow] Browser with extension set to: ${browser}`);
    return true;
});
// Clean corrupted data - improved detection for multiple error types
electron_1.ipcMain.handle('clean-corrupted-data', () => {
    try {
        let deletedCount = 0;
        const cutoffDuration = MAX_LOGGED_SESSION_MS; // 1 hour (3600000ms)
        const now = new Date().toISOString();
        if (useJson) {
            // For JSON: filter out corrupted entries with multiple criteria
            const beforeCount = jsonLogs.length;
            jsonLogs = jsonLogs.filter(log => {
                const durationSec = (log.duration_ms || 0) / 1000;
                const logTime = new Date(log.timestamp);
                const nowDate = new Date();
                // 1. Duration > 1 hour (corrupted)
                if (log.duration_ms > cutoffDuration)
                    return false;
                // 2. Impossible timestamps (start > end would mean negative duration, checked above)
                // 3. Future dates
                if (logTime > nowDate)
                    return false;
                // 4. Zero or negative duration
                if (durationSec <= 0)
                    return false;
                return true;
            });
            deletedCount = beforeCount - jsonLogs.length;
            saveJsonLogs();
            console.log(`[DeskFlow] 🧹 Cleaned ${deletedCount} corrupted entries from JSON`);
        }
        else {
            // For SQLite: delete entries with multiple criteria
            // 1. Duration > 1 hour
            const result1 = db.prepare(`DELETE FROM logs WHERE duration_ms > ?`).run(cutoffDuration);
            // 2. Future timestamps
            const result2 = db.prepare(`DELETE FROM logs WHERE timestamp > ?`).run(now);
            // 3. Zero or negative duration
            const result3 = db.prepare(`DELETE FROM logs WHERE duration_ms <= 0`).run();
            // 4. Null timestamps
            const result4 = db.prepare(`DELETE FROM logs WHERE timestamp IS NULL OR timestamp = ''`).run();
            deletedCount = result1.changes + result2.changes + result3.changes + result4.changes;
            // Also clean the new aggregate tables
            const aggResult = db.prepare(`DELETE FROM daily_aggregates WHERE total_sec > 86400`).run(); // > 24 hours
            const browserResult = db.prepare(`DELETE FROM browser_sessions WHERE total_sec > 86400`).run();
            console.log(`[DeskFlow] 🧹 Cleaned ${deletedCount} corrupted entries from SQLite`);
        }
        return { success: true, deletedCount };
    }
    catch (err) {
        console.error('[DeskFlow] clean-corrupted-data error:', err);
        return { success: false, deletedCount: 0, error: err.message };
    }
});
// Deep cleanup - removes all raw logs and rebuilds aggregates from scratch
electron_1.ipcMain.handle('deep-clean-and-rebuild', () => {
    try {
        if (useJson) {
            return { success: false, message: 'JSON mode - use clear-data instead' };
        }

        // Clear all raw logs
        const logsCleared = db.prepare(`DELETE FROM logs`).run();
        // Clear aggregate tables
        const aggCleared = db.prepare(`DELETE FROM daily_aggregates`).run();
        const browserCleared = db.prepare(`DELETE FROM browser_sessions`).run();
        const sessionsCleared = db.prepare(`DELETE FROM sessions`).run();
        // Reset auto-increment counters
        db.exec(`DELETE FROM sqlite_sequence WHERE name IN ('logs', 'daily_aggregates', 'browser_sessions', 'sessions')`);
        console.log(`[DeskFlow] 🔥 Deep clean complete: ${logsCleared.changes} logs, ${aggCleared.changes} aggregates cleared`);
        return {
            success: true,
            logsCleared: logsCleared.changes,
            aggregatesCleared: aggCleared.changes
        };
    }
    catch (err) {
        console.error('[DeskFlow] deep-clean error:', err);
        return { success: false, message: err.message };
    }
});

// ========== IDE Projects IPC Handlers ==========

// Async exec with timeout helper
function execAsync(cmd: string, timeout = 5000): Promise<{ stdout: string; stderr: string } | null> {
    return new Promise((resolve) => {
        const { exec } = require('child_process');
        const child = exec(cmd, { timeout }, (err: any, stdout: string, stderr: string) => {
            if (err) resolve(null);
            else resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
        });
        setTimeout(() => {
            child.kill();
            resolve(null);
        }, timeout);
    });
}

// Expand environment variables in path (safe, no shell exec)
function expandPath(p: string): string {
    if (process.platform !== 'win32') return p;
    return p.replace(/%([^%]+)%/g, (_, key: string) => process.env[key] || '');
}
// Prevent path traversal — ensure resolved path stays within base
function isPathWithin(base: string, target: string): boolean {
    const resolved = path_1.default.resolve(base, target);
    const baseResolved = path_1.default.resolve(base);
    return resolved === baseResolved || resolved.startsWith(baseResolved + path_1.default.sep);
}

// Check if path exists (handles expanded env vars)
function pathExists(p: string): boolean {
    try {
        return fs_1.default.existsSync(p);
    } catch {
        return false;
    }
}

// Detect installed IDEs
electron_1.ipcMain.handle('detect-ides', async () => {
    const { execSync } = require('child_process');
    const ides = [];
    const idSet = new Set<string>();

    // Helper to add IDE (avoid duplicates)
    const addIde = (ide: { id: string; name: string; version: string; installPath: string }) => {
        if (!idSet.has(ide.id)) {
            idSet.add(ide.id);
            ides.push(ide);
        }
    };

    // Detect VS Code
    try {
        const vscodePath = process.platform === 'win32'
            ? execSync('where code 2>nul', { encoding: 'utf8' }).trim().split('\n')[0]
            : execSync('which code', { encoding: 'utf8' }).trim();

        let version = '';
        try {
            version = execSync('code --version 2>/dev/null', { encoding: 'utf8' }).trim().split('\n')[0];
        } catch {}

        addIde({
            id: 'vscode',
            name: 'VS Code',
            version,
            installPath: vscodePath
        });

        // Get VS Code extensions (async, don't block)
        setTimeout(() => {
            try {
                const extOutput = execSync('code --list-extensions 2>/dev/null', { encoding: 'utf8', timeout: 10000 });
                const extensions = extOutput.trim().split('\n').filter(Boolean).map(ext => {
                    const [publisher, ...nameParts] = ext.split('.');
                    return {
                        id: ext,
                        ideId: 'vscode',
                        publisher,
                        name: nameParts.join('.'),
                        enabled: true
                    };
                });

                if (!useJson && db) {
                    for (const ext of extensions) {
                        try {
                            db.prepare(`
                                INSERT OR REPLACE INTO extensions (id, ide_id, publisher, name, enabled)
                                VALUES (?, ?, ?, ?, ?)
                            `).run(ext.id, ext.ideId, ext.publisher, ext.name, ext.enabled ? 1 : 0);
                        } catch {}
                    }
                }
            } catch {}
        }, 0);
    } catch {}

    // Detect Cursor IDE
    const cursorPaths = process.platform === 'win32'
        ? [path_1.default.join(process.env.LOCALAPPDATA || '', 'Programs', 'cursor', 'Cursor.exe'),
           path_1.default.join(process.env.APPDATA || '', 'Cursor')]
        : ['/Applications/Cursor.app', path_1.default.join(require('os').homedir(), 'Library/Application Support/Cursor')];

    for (const cursorPath of cursorPaths) {
        if (pathExists(cursorPath)) {
            let version = '';
            try {
                version = execSync('cursor --version 2>/dev/null', { encoding: 'utf8', timeout: 3000 }).trim();
            } catch {}
            addIde({
                id: 'cursor',
                name: 'Cursor',
                version,
                installPath: cursorPath
            });
            break;
        }
    }

    // Detect JetBrains IDEs using 'where' command (like VS Code)
    const jetbrainsCommands = [
        { cmd: 'idea', name: 'IntelliJ IDEA', id: 'intellij' },
        { cmd: 'idea64', name: 'IntelliJ IDEA', id: 'intellij' },
        { cmd: 'pycharm', name: 'PyCharm', id: 'pycharm' },
        { cmd: 'pycharm64', name: 'PyCharm', id: 'pycharm' },
        { cmd: 'webstorm', name: 'WebStorm', id: 'webstorm' },
        { cmd: 'webstorm64', name: 'WebStorm', id: 'webstorm' },
        { cmd: 'goland', name: 'GoLand', id: 'goland' },
        { cmd: 'goland64', name: 'GoLand', id: 'goland' },
        { cmd: 'rider', name: 'Rider', id: 'rider' },
        { cmd: 'rider64', name: 'Rider', id: 'rider' },
    ];

    for (const { cmd, name, id } of jetbrainsCommands) {
        try {
            const jetbrainsPath = process.platform === 'win32'
                ? execSync(`where ${cmd} 2>nul`, { encoding: 'utf8' }).trim().split('\n')[0]
                : execSync(`which ${cmd} 2>/dev/null`, { encoding: 'utf8' }).trim();
            if (jetbrainsPath) {
                let version = '';
                try {
                    version = execSync(`${cmd} --version 2>/dev/null`, { encoding: 'utf8', timeout: 3000 }).trim().split('\n')[0];
                } catch {}
                addIde({
                    id,
                    name,
                    version,
                    installPath: jetbrainsPath
                });
            }
        } catch {}
    }

    // Detect JetBrains IDEs via Toolbox (multiple formats supported)
    const toolboxBase = path_1.default.join(process.env.APPDATA || '', 'JetBrains', 'Toolbox', 'apps');
    if (pathExists(toolboxBase)) {
        try {
            const appDirs = fs_1.default.readdirSync(toolboxBase);
            const jetbrainsMap: Record<string, { name: string; id: string; exe: string }> = {
                'IDEA-U': { name: 'IntelliJ IDEA', id: 'intellij', exe: 'idea64.exe' },
                'IDEA-CE': { name: 'IntelliJ IDEA Community', id: 'intellij-ce', exe: 'idea64.exe' },
                'PyCharm-P': { name: 'PyCharm Professional', id: 'pycharm', exe: 'pycharm64.exe' },
                'PyCharm-C': { name: 'PyCharm Community', id: 'pycharm-ce', exe: 'pycharm64.exe' },
                'GoLand': { name: 'GoLand', id: 'goland', exe: 'goland64.exe' },
                'WebStorm': { name: 'WebStorm', id: 'webstorm', exe: 'webstorm64.exe' },
                'Rider': { name: 'Rider', id: 'rider', exe: 'rider64.exe' },
                'AndroidStudio': { name: 'Android Studio', id: 'android-studio', exe: 'studio64.exe' },
            };

            for (const appDir of appDirs) {
                const appPath = path_1.default.join(toolboxBase, appDir);
                if (!fs_1.default.statSync(appPath).isDirectory()) continue;

                const ideInfo = jetbrainsMap[appDir];
                if (!ideInfo) continue;

                let installPath = '';

                // Try to find install location from various sources
                try {
                    const channels = fs_1.default.readdirSync(appPath);
                    for (const channel of channels) {
                        const channelPath = path_1.default.join(appPath, channel);
                        if (!fs_1.default.statSync(channelPath).isDirectory()) continue;

                        // Try .env.project (old format)
                        const envProjectPath = path_1.default.join(channelPath, '.env.project');
                        if (pathExists(envProjectPath)) {
                            try {
                                const envContent = fs_1.default.readFileSync(envProjectPath, 'utf8');
                                const match = envContent.match(/IDE_INSTALL_LOCATION=(.+)/);
                                if (match && match[1]) {
                                    installPath = match[1].trim();
                                    break;
                                }
                            } catch {}
                        }

                        // Try .env.vars (newer format)
                        const envVarsPath = path_1.default.join(channelPath, '.env.vars');
                        if (pathExists(envVarsPath)) {
                            try {
                                const envContent = fs_1.default.readFileSync(envVarsPath, 'utf8');
                                const match = envContent.match(/IDE_INSTALL_LOCATION=(.+)/);
                                if (match && match[1]) {
                                    installPath = match[1].trim();
                                    break;
                                }
                            } catch {}
                        }

                        // Try to find the IDE executable directly in subdirectories
                        const findExe = (dir: string, depth = 0): string | null => {
                            if (depth > 3) return null;
                            try {
                                const items = fs_1.default.readdirSync(dir);
                                for (const item of items) {
                                    const itemPath = path_1.default.join(dir, item);
                                    const stat = fs_1.default.statSync(itemPath);
                                    if (stat.isDirectory()) {
                                        if (item.endsWith('.exe') || item === 'bin') {
                                            const found = findExe(itemPath, depth + 1);
                                            if (found) return found;
                                        }
                                    } else if (item === ideInfo.exe && itemPath.includes('bin')) {
                                        return path_1.default.dirname(itemPath);
                                    }
                                }
                            } catch {}
                            return null;
                        };

                        const foundPath = findExe(channelPath);
                        if (foundPath) {
                            installPath = foundPath;
                            break;
                        }
                    }
                } catch {}

                if (installPath && pathExists(installPath)) {
                    let version = '';
                    try {
                        const productInfoPath = path_1.default.join(installPath, 'product-info.json');
                        if (pathExists(productInfoPath)) {
                            const productInfo = JSON.parse(fs_1.default.readFileSync(productInfoPath, 'utf8'));
                            version = productInfo.version || '';
                        }
                    } catch {}
                    addIde({
                        id: ideInfo.id,
                        name: ideInfo.name,
                        version,
                        installPath
                    });
                }
            }
        } catch {}
    }

    // Also detect JetBrains IDEs installed directly (not via Toolbox)
    const directJetbrainsPaths = [
        { base: path_1.default.join(process.env.LOCALAPPDATA || '', 'JetBrains'), exe: 'idea64.exe', name: 'IntelliJ IDEA', id: 'intellij' },
        { base: path_1.default.join(process.env.LOCALAPPDATA || '', 'JetBrains'), exe: 'pycharm64.exe', name: 'PyCharm', id: 'pycharm' },
        { base: path_1.default.join(process.env.LOCALAPPDATA || '', 'JetBrains'), exe: 'webstorm64.exe', name: 'WebStorm', id: 'webstorm' },
        { base: path_1.default.join(process.env.LOCALAPPDATA || '', 'JetBrains'), exe: 'goland64.exe', name: 'GoLand', id: 'goland' },
        { base: path_1.default.join(process.env.LOCALAPPDATA || '', 'JetBrains'), exe: 'rider64.exe', name: 'Rider', id: 'rider' },
    ];

    for (const { base, exe, name, id } of directJetbrainsPaths) {
        try {
            // Search in subdirectories of the base path
            const searchDirs = fs_1.default.existsSync(base) ? fs_1.default.readdirSync(base) : [];
            for (const dir of searchDirs) {
                const candidatePath = path_1.default.join(base, dir, 'bin', exe);
                if (pathExists(candidatePath)) {
                    let version = '';
                    try {
                        version = execSync(`${path_1.default.join(base, dir, 'bin', exe.split('.')[0] + '.sh')} --version 2>/dev/null`, { encoding: 'utf8', timeout: 3000 }).trim().split('\n')[0];
                    } catch {}
                    addIde({
                        id,
                        name,
                        version,
                        installPath: path_1.default.dirname(candidatePath)
                    });
                    break;
                }
            }
        } catch {}
    }

    // Detect Android Studio (standalone installation)
    const androidPaths = process.platform === 'win32' ? [
        path_1.default.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk'),
        path_1.default.join(process.env.PROGRAMFILES || '', 'Android', 'Android Studio'),
        path_1.default.join(process.env.LOCALAPPDATA || '', 'Programs', 'Android Studio'),
    ] : ['/Applications/Android Studio.app'];

    for (const androidPath of androidPaths) {
        if (pathExists(androidPath)) {
            // Verify it's actually Android Studio by checking for studio.exe or similar
            const studioPath = process.platform === 'win32'
                ? path_1.default.join(androidPath, 'bin', 'studio64.exe')
                : path_1.default.join(androidPath, 'Contents', 'MacOS', 'studio');
            if (pathExists(studioPath) || pathExists(androidPath)) {
                addIde({
                    id: 'android-studio',
                    name: 'Android Studio',
                    version: '',
                    installPath: androidPath
                });
                break;
            }
        }
    }

    // Detect Google Antigravity IDE
    const antigravityPaths = process.platform === 'win32' ? [
        path_1.default.join(process.env.LOCALAPPDATA || '', 'Programs', 'Antigravity', 'Antigravity.exe'),
        path_1.default.join(process.env.PROGRAMFILES || '', 'Google', 'Antigravity', 'Antigravity.exe'),
        path_1.default.join(process.env.APPDATA || '', 'Antigravity'),
    ] : ['/Applications/Antigravity.app', path_1.default.join(require('os').homedir(), '.antigravity')];

    for (const agPath of antigravityPaths) {
        if (pathExists(agPath)) {
            let version = '';
            try {
                version = execSync('agy --version 2>/dev/null', { encoding: 'utf8', timeout: 3000 }).trim();
            } catch {}
            addIde({
                id: 'antigravity',
                name: 'Google Antigravity',
                version,
                installPath: agPath
            });
            break;
        }
    }

    // Try to detect agy CLI directly
    try {
        const agyPath = process.platform === 'win32'
            ? execSync('where agy 2>nul', { encoding: 'utf8' }).trim().split('\n')[0]
            : execSync('which agy', { encoding: 'utf8' }).trim();
        if (agyPath && !idSet.has('antigravity')) {
            addIde({
                id: 'antigravity',
                name: 'Google Antigravity',
                version: '',
                installPath: agyPath
            });
        }
    } catch {}

    // Store IDEs in DB
    if (!useJson && db) {
        for (const ide of ides) {
            try {
                db.prepare(`
                    INSERT OR REPLACE INTO ides (id, name, version, install_path, last_opened)
                    VALUES (?, ?, ?, ?, ?)
                `).run(ide.id, ide.name, ide.version || null, ide.installPath || null, new Date().toISOString());
            } catch {}
        }
    }

    console.log('[DeskFlow] IDEs detected:', ides.map(i => i.name).join(', '));
    return ides;
});

// Get stored IDEs
electron_1.ipcMain.handle('get-ides', () => {
    if (useJson) return [];
    try {
        return db.prepare('SELECT * FROM ides ORDER BY name').all();
    } catch {
        return [];
    }
});

// Get extensions for an IDE
electron_1.ipcMain.handle('get-extensions', (event, ideId) => {
    if (useJson) return [];
    try {
        if (ideId) {
            return db.prepare('SELECT * FROM extensions WHERE ide_id = ? ORDER BY name').all(ideId);
        }
        return db.prepare('SELECT * FROM extensions ORDER BY ide_id, name').all();
    } catch {
        return [];
    }
});

// Scan for development tools (async with progress)
electron_1.ipcMain.handle('scan-tools', async () => {
    const { exec } = require('child_process');
    const tools: any[] = [];

    const execPromise = (cmd: string, timeout = 3000): Promise<{ stdout: string } | null> => {
        return new Promise((resolve) => {
            const child = exec(cmd, { timeout }, (err: any, stdout: string) => {
                resolve(err ? null : { stdout: stdout.trim() });
            });
            setTimeout(() => {
                child.kill();
                resolve(null);
            }, timeout);
        });
    };

    const execSyncSafe = (cmd: string, fallback: string = ''): string => {
        try {
            const { execSync } = require('child_process');
            return execSync(cmd, { encoding: 'utf8', timeout: 3000 }).trim();
        } catch {
            return fallback;
        }
    };

    // Common development tools to detect
    const TOOL_CATEGORIES: Record<string, string[]> = {
        versionControl: ['git', 'hg', 'svn'],
        runtimes: ['node', 'python', 'python3', 'ruby', 'go', 'java', 'rustc'],
        packageManagers: ['npm', 'yarn', 'pnpm', 'pip', 'pip3', 'cargo', 'brew', 'bundle'],
        containers: ['docker', 'podman', 'kubectl', 'helm'],
        buildTools: ['make', 'cmake', 'maven', 'gradle', 'webpack', 'vite'],
        databases: ['psql', 'mysql', 'mongosh', 'redis-cli'],
        cloud: ['aws', 'gcloud', 'az', 'terraform', 'ansible']
    };

    const detectCommand = process.platform === 'win32' ? 'where' : 'which';
    const allCmds = Object.entries(TOOL_CATEGORIES).flatMap(([cat, cmds]) => cmds.map(cmd => ({ cmd, category: cat })));

    // Run detection in batches to avoid overwhelming the system
    const BATCH_SIZE = 5;
    for (let i = 0; i < allCmds.length; i += BATCH_SIZE) {
        const batch = allCmds.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
            batch.map(({ cmd, category }) => execPromise(`${detectCommand} ${cmd} 2>nul`))
        );

        for (let j = 0; j < batch.length; j++) {
            const { cmd, category } = batch[j];
            const result = results[j];
            if (result && result.stdout) {
                const version = execSyncSafe(`${cmd} --version 2>nul`).split('\n')[0] || '';
                tools.push({
                    id: `${cmd}-${Date.now()}`,
                    name: cmd,
                    category,
                    version,
                    installPath: result.stdout.split('\n')[0],
                    detectedAt: new Date().toISOString(),
                    detectionMethod: 'path'
                });
            }
        }
    }

    // Detect npm global packages (run in background, don't block)
    setTimeout(() => {
        try {
            const { execSync } = require('child_process');
            const npmOutput = execSync('npm list -g --depth=0 --json 2>nul', { encoding: 'utf8', timeout: 10000 });
            const npmData = JSON.parse(npmOutput);
            const globalDeps = npmData.dependencies || {};
            for (const [name, info] of Object.entries(globalDeps)) {
                const toolInfo = info as any;
                tools.push({
                    id: `npm-${name}-${Date.now()}`,
                    name,
                    category: 'npm-package',
                    version: toolInfo.version || '',
                    installPath: toolInfo.path || '',
                    detectedAt: new Date().toISOString(),
                    detectionMethod: 'package-manager'
                });
            }

            // Store additional tools in DB
            if (!useJson && db) {
                for (const tool of tools) {
                    if (tool.category === 'npm-package') {
                        try {
                            db.prepare(`
                                INSERT OR REPLACE INTO tools (id, name, category, version, install_path, detected_at, detection_method)
                                VALUES (?, ?, ?, ?, ?, ?, ?)
                            `).run(tool.id, tool.name, tool.category, tool.version, tool.installPath, tool.detectedAt, tool.detectionMethod);
                        } catch {}
                    }
                }
            }
        } catch {}
    }, 100);

    // Store tools in DB
    if (!useJson && db) {
        for (const tool of tools) {
            try {
                db.prepare(`
                    INSERT OR REPLACE INTO tools (id, name, category, version, install_path, detected_at, detection_method)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(tool.id, tool.name, tool.category, tool.version, tool.installPath, tool.detectedAt, tool.detectionMethod);
            } catch {}
        }
    }

    console.log('[DeskFlow] Tools scanned:', tools.length, 'detected');
    return {
        tools,
        message: `Found ${tools.length} tools`
    };
});

// Reset all tools (clear DB + re-scan)
electron_1.ipcMain.handle('reset-tools', async () => {
    try {
        if (!useJson && db) {
            db.prepare('DELETE FROM project_tools').run();
            db.prepare('DELETE FROM tools').run();
        }
        console.log('[DeskFlow] Tools cleared, re-scanning...');
        const { exec } = require('child_process');
        const tools: any[] = [];

        const execPromise = (cmd: string, timeout = 3000): Promise<{ stdout: string } | null> => {
            return new Promise((resolve) => {
                const child = exec(cmd, { timeout }, (err: any, stdout: string) => {
                    resolve(err ? null : { stdout: stdout.trim() });
                });
                setTimeout(() => { child.kill(); resolve(null); }, timeout);
            });
        };

        const execSyncSafe = (cmd: string, fallback = ''): string => {
            try {
                const { execSync } = require('child_process');
                return execSync(cmd, { encoding: 'utf8', timeout: 3000 }).trim();
            } catch { return fallback; }
        };

        const TOOL_CATEGORIES: Record<string, string[]> = {
            versionControl: ['git', 'hg', 'svn'],
            runtimes: ['node', 'python', 'python3', 'ruby', 'go', 'java', 'rustc'],
            packageManagers: ['npm', 'yarn', 'pnpm', 'pip', 'pip3', 'cargo', 'brew', 'bundle'],
            containers: ['docker', 'podman', 'kubectl', 'helm'],
            buildTools: ['make', 'cmake', 'maven', 'gradle', 'webpack', 'vite'],
            databases: ['psql', 'mysql', 'mongosh', 'redis-cli'],
            cloud: ['aws', 'gcloud', 'az', 'terraform', 'ansible']
        };

        const detectCommand = process.platform === 'win32' ? 'where' : 'which';
        const allCmds = Object.entries(TOOL_CATEGORIES).flatMap(([cat, cmds]) => cmds.map(cmd => ({ cmd, category: cat })));

        const BATCH_SIZE = 5;
        for (let i = 0; i < allCmds.length; i += BATCH_SIZE) {
            const batch = allCmds.slice(i, i + BATCH_SIZE);
            const results = await Promise.all(
                batch.map(({ cmd, category }) => execPromise(`${detectCommand} ${cmd} 2>nul`))
            );
            for (let j = 0; j < batch.length; j++) {
                const { cmd, category } = batch[j];
                const result = results[j];
                if (result && result.stdout) {
                    const version = execSyncSafe(`${cmd} --version 2>nul`).split('\n')[0] || '';
                    tools.push({
                        id: `${cmd}-${Date.now()}`,
                        name: cmd, category, version,
                        installPath: result.stdout.split('\n')[0],
                        detectedAt: new Date().toISOString(),
                        detectionMethod: 'path'
                    });
                }
            }
        }

        if (!useJson && db) {
            for (const tool of tools) {
                try {
                    db.prepare(`INSERT OR REPLACE INTO tools (id, name, category, version, install_path, detected_at, detection_method) VALUES (?, ?, ?, ?, ?, ?, ?)`)
                        .run(tool.id, tool.name, tool.category, tool.version, tool.installPath, tool.detectedAt, tool.detectionMethod);
                } catch {}
            }
        }

        console.log('[DeskFlow] Tools reset complete:', tools.length, 'detected');
        return { success: true, message: `Tools reset and rescanned: ${tools.length} found` };
    } catch (err) {
        console.error('[DeskFlow] Failed to reset tools:', err);
        return { success: false, message: `Failed to reset tools: ${err}` };
    }
});

// Get stored tools
electron_1.ipcMain.handle('get-tools', (event, category) => {
    if (useJson) return [];
    try {
        if (category) {
            return db.prepare('SELECT * FROM tools WHERE category = ? ORDER BY name').all(category);
        }
        return db.prepare('SELECT * FROM tools ORDER BY category, name').all();
    } catch {
        return [];
    }
});

// ---- MCP & Design Library IPC Handlers ----
// Full JSON-RPC MCP protocol implementation

interface MCPServerInstance {
  proc: any;
  status: 'starting' | 'running' | 'error' | 'stopped';
  tools: any[];
  requestCounter: number;
  buffer: string;
  initPromise: Promise<void>;
  initResolve: (() => void) | null;
  pendingRequests: Map<number, { resolve: (v: any) => void; reject: (e: any) => void; timeout: NodeJS.Timeout }>;
  startTime: number;
}

const mcpServers = new Map<string, MCPServerInstance>();

function sendMCPRequest(serverId: string, method: string, params?: any): Promise<any> {
  const server = mcpServers.get(serverId);
  if (!server || server.status !== 'running') {
    return Promise.reject(new Error('Server not running'));
  }
  const id = ++server.requestCounter;
  const request = { jsonrpc: '2.0', id, method, params: params || {} };
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.pendingRequests.delete(id);
      reject(new Error('MCP request timeout'));
    }, 30000);
    server.pendingRequests.set(id, { resolve, reject, timeout });
    server.proc.stdin.write(JSON.stringify(request) + '\n');
  });
}

function handleMCPStdout(serverId: string, data: Buffer) {
  const server = mcpServers.get(serverId);
  if (!server) return;
  server.buffer += data.toString();
  const lines = server.buffer.split('\n');
  server.buffer = lines.pop() || '';
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id !== undefined && server.pendingRequests.has(msg.id)) {
        const pending = server.pendingRequests.get(msg.id)!;
        clearTimeout(pending.timeout);
        server.pendingRequests.delete(msg.id);
        if (msg.error) {
          pending.reject(new Error(msg.error.message || 'MCP error'));
        } else {
          pending.resolve(msg.result);
        }
      }
    } catch (e) {
      console.error(`[MCP:${serverId}] Failed to parse response:`, line);
    }
  }
}

electron_1.ipcMain.handle('mcp-start-server', async (_, serverId: string) => {
  if (mcpServers.has(serverId)) {
    const existing = mcpServers.get(serverId)!;
    if (existing.status === 'running') return { success: true, status: 'already_running' };
    existing.proc.kill();
    mcpServers.delete(serverId);
  }
  try {
    const configPath = path_1.default.join(__dirname, '..', 'opencode.json');
    let serverCfg: any = null;
    try {
      const config = JSON.parse(require('fs').readFileSync(configPath, 'utf8'));
      serverCfg = config.mcp?.[serverId];
    } catch { /* opencode.json may not exist */ }
    
    // Fallback default configs
    if (!serverCfg) {
      const defaultConfigs: Record<string, { command: string[] }> = {
        '21st-dev': { command: ['npx', '-y', '@21st-dev/magic@latest'] },
        'aceternity': { command: ['npx', '-y', '@aceternity-ui/mcp@latest'] },
        'refero': { command: ['npx', '-y', '@refero/mcp@latest'] },
      };
      const dc = defaultConfigs[serverId];
      if (!dc) return { success: false, error: `No config found for server: ${serverId}` };
      serverCfg = { command: dc.command, environment: {} };
    }

    let initResolve: (() => void) | null = null;
    const initPromise = new Promise<void>(resolve => { initResolve = resolve; });

    const instance: MCPServerInstance = {
      proc: null,
      status: 'starting',
      tools: [],
      requestCounter: 0,
      buffer: '',
      initPromise,
      initResolve,
      pendingRequests: new Map(),
      startTime: Date.now(),
    };
    
    mcpServers.set(serverId, instance);
    
    const proc = child_process_1.spawn(serverCfg.command[0], serverCfg.command.slice(1), {
      env: { ...process.env, ...serverCfg.environment },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    instance.proc = proc;

    proc.stdout.on('data', (data: Buffer) => handleMCPStdout(serverId, data));
    
    proc.stderr.on('data', (data: Buffer) => {
      console.error(`[MCP:${serverId}] stderr:`, data.toString());
    });

    proc.on('exit', (code: number) => {
      console.error(`[MCP:${serverId}] exited with code ${code}`);
      const entry = mcpServers.get(serverId);
      if (entry) {
        entry.status = 'stopped';
        // Reject all pending requests
        for (const [id, pending] of entry.pendingRequests) {
          clearTimeout(pending.timeout);
          pending.reject(new Error('Server process exited'));
        }
        entry.pendingRequests.clear();
      }
    });

    proc.on('error', (err: Error) => {
      console.error(`[MCP:${serverId}] error:`, err.message);
      const entry = mcpServers.get(serverId);
      if (entry) entry.status = 'error';
    });

    // Send JSON-RPC initialize
    const initMsg = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: { name: 'deskflow', version: '1.0.0' }
      }
    };
    
    // Setup one-time handler for init response
    const initId = 1;
    const initTimeout = setTimeout(() => {
      instance.status = 'error';
      if (instance.initResolve) instance.initResolve();
    }, 15000);
    
    instance.pendingRequests.set(initId, {
      resolve: () => { clearTimeout(initTimeout); },
      reject: () => { clearTimeout(initTimeout); instance.status = 'error'; },
      timeout: initTimeout,
    });
    
    proc.stdin.write(JSON.stringify(initMsg) + '\n');
    
    // Wait for handshake
    await new Promise<void>((resolve, reject) => {
      const checkServer = setInterval(() => {
        const entry = mcpServers.get(serverId);
        if (entry?.status === 'running' || entry?.status === 'error') {
          clearInterval(checkServer);
          if (entry.status === 'running') resolve();
          else reject(new Error('Server failed to start'));
        }
      }, 100);
      setTimeout(() => { clearInterval(checkServer); reject(new Error('Server start timeout')); }, 20000);
    });

    // Send initialized notification
    proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    
    // Discover tools
    try {
      const toolsResult = await sendMCPRequest(serverId, 'tools/list');
      instance.tools = toolsResult?.tools || [];
    } catch (e) {
      console.error(`[MCP:${serverId}] tools/list failed:`, e);
      instance.tools = [];
    }
    
    return { success: true, tools: instance.tools };
  } catch (e) {
    console.error('[MCP] start error', e);
    const entry = mcpServers.get(serverId);
    if (entry) entry.status = 'error';
    return { success: false, error: String(e) };
  }
});

electron_1.ipcMain.handle('mcp-server-status', async (_, data: { serverId: string }) => {
  const serverId = typeof data === 'string' ? data : data?.serverId;
  const entry = mcpServers.get(serverId);
  if (!entry) return { status: 'stopped' };
  return {
    status: entry.status,
    toolCount: entry.tools.length,
    uptime: Date.now() - entry.startTime,
  };
});

electron_1.ipcMain.handle('mcp-stop-server', async (_, serverId: string) => {
  const entry = mcpServers.get(serverId);
  if (entry) {
    entry.proc.kill();
    for (const [id, pending] of entry.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Server stopped'));
    }
    entry.pendingRequests.clear();
    mcpServers.delete(serverId);
    return { success: true };
  }
  return { success: false, error: 'Server not running' };
});

electron_1.ipcMain.handle('mcp-list-tools', async (_, serverId: string) => {
  const entry = mcpServers.get(serverId);
  if (!entry) return { success: false, error: 'Server not started' };
  if (entry.status !== 'running') return { success: false, error: `Server status: ${entry.status}` };
  return { success: true, tools: entry.tools };
});

electron_1.ipcMain.handle('mcp-call-tool', async (_, serverId: string, toolName: string, args: any) => {
  const entry = mcpServers.get(serverId);
  if (!entry) return { success: false, error: 'Server not started' };
  if (entry.status !== 'running') return { success: false, error: `Server status: ${entry.status}` };
  try {
    const result = await sendMCPRequest(serverId, 'tools/call', { name: toolName, arguments: args });
    return { success: true, result };
  } catch (e) {
    return { success: false, error: String(e) };
  }
});

// Aceternity UI registry fetch
electron_1.ipcMain.handle('aceternity-fetch-registry', async () => {
  try {
    const https = require('https');
    const urls = [
      'https://ui.aceternity.com/registry.json',
      'https://aceternityui.com/registry.json',
    ];
    for (const url of urls) {
      try {
        const data = await new Promise<string>((resolve, reject) => {
          https.get(url, (res: any) => {
            let d = '';
            res.on('data', (chunk: any) => (d += chunk));
            res.on('end', () => resolve(d));
          }).on('error', reject);
        });
        const parsed = JSON.parse(data);
        const components = (parsed.components || parsed).map((c: any) => ({
          slug: c.slug || c.name,
          name: c.name,
          description: c.description || '',
          category: c.category || 'General',
          tags: c.tags || [],
          dependencyCount: (c.dependencies || []).length,
          source: 'aceternity',
        }));
        return { success: true, components, total: components.length };
      } catch { continue; }
    }
    return { success: false, components: [], total: 0, error: 'Failed to fetch from all registry URLs' };
  } catch (e) {
    console.error('[Aceternity] fetch error', e);
    return { success: false, components: [], total: 0, error: String(e) };
  }
});

// Aceternity UI: fetch individual component detail
electron_1.ipcMain.handle('aceternity-fetch-component', async (_, params: { slug: string }) => {
  try {
    const https = require('https');
    const urls = [
      `https://ui.aceternity.com/registry/${params.slug}.json`,
      `https://aceternityui.com/registry/${params.slug}.json`,
    ];
    for (const url of urls) {
      try {
        const data = await new Promise<string>((resolve, reject) => {
          https.get(url, (res: any) => {
            let d = '';
            res.on('data', (chunk: any) => (d += chunk));
            res.on('end', () => resolve(d));
          }).on('error', reject);
        });
        const parsed = JSON.parse(data);
        const component = {
          slug: parsed.slug || params.slug,
          name: parsed.name,
          description: parsed.description || '',
          category: parsed.category || 'General',
          tags: parsed.tags || [],
          code: parsed.files?.[0]?.content || '',
          dependencies: parsed.dependencies || [],
          files: parsed.files || [],
          source: 'aceternity',
        };
        return { success: true, component };
      } catch { continue; }
    }
    return { success: false, error: `Component ${params.slug} not found in any registry` };
  } catch (e) {
    return { success: false, error: String(e) };
  }
});

// Aceternity UI component install via CLI
electron_1.ipcMain.handle('aceternity-install-component', async (_, slug: string, cwd: string) => {
  try {
    const { execSync } = require('child_process');
    const cmds = [`npx -y aceternity-ui install ${slug}`, `npx -y aceternity-ui@latest add ${slug}`];
    let lastError: any = null;
    for (const cmd of cmds) {
      try {
        const output = execSync(cmd, { cwd, stdio: 'pipe', encoding: 'utf-8' });
        const filesWritten = (output.match(/created.*?:?\s*(.+)/gi) || []).map((m: string) => m.replace(/created.*?:?\s*/i, '').trim());
        return { success: true, filesWritten };
      } catch (e) { lastError = e; continue; }
    }
    throw lastError || new Error('All install methods failed');
  } catch (e) {
    console.error('[Aceternity] install error', e);
    return { success: false, error: String(e) };
  }
});

// Refero: fetch catalog (MCP first, then HTTP fallback)
electron_1.ipcMain.handle('fetch-refero-catalog', async (_, params: { forceRefresh?: boolean; query?: string }) => {
  try {
    // Try MCP first
    const referoServer = mcpServers.get('refero');
    if (referoServer && referoServer.status === 'running') {
      try {
        const result = await sendMCPRequest('refero', 'list_design_systems', { category: params?.query || undefined });
        const systems = (result?.systems || result?.content?.[0]?.text ? JSON.parse(result.content[0].text) : []).map((s: any) => ({
          slug: s.slug || s.id,
          name: s.name,
          description: s.description || '',
          category: s.category || 'General',
          tags: s.tags || [],
          componentCount: s.componentCount || 0,
          source: 'refero',
        }));
        return { success: true, systems, total: systems.length };
      } catch { /* fall through to HTTP */ }
    }
    // HTTP fallback
    const https = require('https');
    const urls = [
      'https://styles.refero.design/api/v1/systems',
      'https://refero.design/api/systems',
    ];
    for (const url of urls) {
      try {
        const data = await new Promise<string>((resolve, reject) => {
          https.get(url, (res: any) => {
            let d = '';
            res.on('data', (chunk: any) => (d += chunk));
            res.on('end', () => resolve(d));
          }).on('error', reject);
        });
        const parsed = JSON.parse(data);
        const items = parsed.systems || parsed.data || parsed || [];
        const systems = (Array.isArray(items) ? items : []).map((s: any) => ({
          slug: s.slug || s.id,
          name: s.name,
          description: s.description || '',
          category: s.category || 'General',
          tags: s.tags || [],
          componentCount: s.componentCount || 0,
          source: 'refero',
        }));
        return { success: true, systems, total: systems.length };
      } catch { continue; }
    }
    return { success: false, systems: [], total: 0, error: 'Refero catalog unavailable' };
  } catch (e) {
    return { success: false, systems: [], total: 0, error: String(e) };
  }
});

// Refero: fetch individual system detail
electron_1.ipcMain.handle('fetch-refero-system', async (_, params: { slug: string }) => {
  try {
    const referoServer = mcpServers.get('refero');
    if (referoServer && referoServer.status === 'running') {
      try {
        const result = await sendMCPRequest('refero', 'get_design_system', { slug: params.slug });
        const text = result?.content?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          return { success: true, system: { ...parsed, source: 'refero' } };
        }
      } catch { /* fall through */ }
    }
    return { success: false, error: 'Refero system detail unavailable' };
  } catch (e) {
    return { success: false, error: String(e) };
  }
});

// Refero: search systems
electron_1.ipcMain.handle('search-refero-systems', async (_, params: { query: string }) => {
  try {
    const referoServer = mcpServers.get('refero');
    if (referoServer && referoServer.status === 'running') {
      try {
        const result = await sendMCPRequest('refero', 'search_design_systems', { query: params.query });
        const text = result?.content?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          const systems = (parsed.systems || parsed).map((s: any) => ({
            slug: s.slug || s.id,
            name: s.name,
            description: s.description || '',
            category: s.category || 'General',
            tags: s.tags || [],
            componentCount: s.componentCount || 0,
            source: 'refero',
          }));
          return { success: true, systems, total: systems.length };
        }
      } catch { /* fall through */ }
    }
    return { success: false, systems: [], total: 0, error: 'Search unavailable' };
  } catch (e) {
    return { success: false, systems: [], total: 0, error: String(e) };
  }
});

// Design library config storage
electron_1.ipcMain.handle('get-design-library-config', async () => {
  try {
    const configPath = path_1.default.join(require('os').homedir(), '.deskflow', 'design-library-config.json');
    if (fs_1.default.existsSync(configPath)) {
      return JSON.parse(fs_1.default.readFileSync(configPath, 'utf-8'));
    }
  } catch (e) {
    console.error('[DesignConfig] read error', e);
  }
  // Return default config
  return {
    version: 1,
    sources: {
      '21st-dev': { enabled: true, autoStart: true },
      aceternity: { enabled: true, registryUrl: 'https://ui.aceternity.com/registry', mcpEnabled: false },
      refero: { enabled: false, autoStart: false },
    },
  };
});

electron_1.ipcMain.handle('set-design-library-config', async (_, config: any) => {
  try {
    const configDir = path_1.default.join(require('os').homedir(), '.deskflow');
    if (!fs_1.default.existsSync(configDir)) fs_1.default.mkdirSync(configDir, { recursive: true });
    const configPath = path_1.default.join(configDir, 'design-library-config.json');
    fs_1.default.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return { success: true };
  } catch (e) {
    console.error('[DesignConfig] write error', e);
    return { success: false, error: String(e) };
  }
});

// Design cache service
const DESIGN_CACHE_DIR = path_1.default.join(require('os').homedir(), '.deskflow', 'design-caches');

function ensureCacheDir() {
  if (!fs_1.default.existsSync(DESIGN_CACHE_DIR)) {
    fs_1.default.mkdirSync(DESIGN_CACHE_DIR, { recursive: true });
  }
}

electron_1.ipcMain.handle('get-design-cached-data', async (_, params: { key: string }) => {
  try {
    ensureCacheDir();
    const filePath = path_1.default.join(DESIGN_CACHE_DIR, `${params.key}.json`);
    if (!fs_1.default.existsSync(filePath)) {
      return { success: false, stale: true };
    }
    const raw = fs_1.default.readFileSync(filePath, 'utf-8');
    const entry = JSON.parse(raw);
    const stale = Date.now() - entry.timestamp > entry.ttl;
    return { success: true, data: entry.data, timestamp: entry.timestamp, stale };
  } catch {
    return { success: false };
  }
});

// Test design library connection
electron_1.ipcMain.handle('test-design-library-connection', async (_, params: { serverId: string }) => {
  const start = Date.now();
  try {
    // Check if already running
    const existing = mcpServers.get(params.serverId);
    if (existing && existing.status === 'running') {
      return {
        success: true,
        latency: Date.now() - start,
        toolCount: existing.tools.length,
      };
    }
    // Start the server
    const configPath = path_1.default.join(__dirname, '..', 'opencode.json');
    let serverCfg: any = null;
    try {
      const config = JSON.parse(require('fs').readFileSync(configPath, 'utf8'));
      serverCfg = config.mcp?.[params.serverId];
    } catch { /* ignore */ }
    if (!serverCfg) {
      return { success: false, error: `No config found for ${params.serverId}` };
    }
    const proc = child_process_1.spawn(serverCfg.command[0], serverCfg.command.slice(1), {
      env: { ...process.env, ...serverCfg.environment },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    // Kill the test server after a brief check
    setTimeout(() => { try { proc.kill(); } catch {} }, 5000);
    return { success: true, latency: Date.now() - start, toolCount: 0 };
  } catch (e) {
    return { success: false, error: String(e), latency: Date.now() - start };
  }
});


// Scan common IDE default project directories for quick-add
electron_1.ipcMain.handle('scan-ide-default-projects', async () => {
    const homedir = require('os').homedir();
    const isWin = process.platform === 'win32';

    const ideDefaultDirs = [
        { label: 'PyCharm', dir: path_1.default.join(homedir, isWin ? 'PyCharmProjects' : 'PyCharmProjects') },
        { label: 'IntelliJ IDEA', dir: path_1.default.join(homedir, isWin ? 'IdeaProjects' : 'IdeaProjects') },
        { label: 'WebStorm', dir: path_1.default.join(homedir, isWin ? 'WebStormProjects' : 'WebStormProjects') },
        { label: 'GoLand', dir: path_1.default.join(homedir, isWin ? 'GoLandProjects' : 'GoLandProjects') },
        { label: 'Rider', dir: path_1.default.join(homedir, isWin ? 'RiderProjects' : 'RiderProjects') },
        { label: 'Android Studio', dir: path_1.default.join(homedir, isWin ? 'AndroidStudioProjects' : 'AndroidStudioProjects') },
    ];

    const results: { ide: string; projects: { name: string; path: string }[] }[] = [];

    for (const { label, dir } of ideDefaultDirs) {
        if (!fs_1.default.existsSync(dir)) continue;

        try {
            const entries = fs_1.default.readdirSync(dir, { withFileTypes: true });
            const projects = entries
                .filter(e => e.isDirectory())
                .map(e => ({ name: e.name, path: path_1.default.join(dir, e.name) }));

            if (projects.length > 0) {
                results.push({ ide: label, projects });
            }
        } catch {}
    }

    return results;
});

// Scan a user-specified custom directory for project folders containing code files
electron_1.ipcMain.handle('scan-custom-directory', async (_, rootDir) => {
    const EXT_TO_LANG_SCAN = {
        '.ts': 'TypeScript', '.tsx': 'TypeScript', '.js': 'JavaScript', '.jsx': 'JavaScript',
        '.mjs': 'JavaScript', '.cjs': 'JavaScript', '.py': 'Python', '.rs': 'Rust',
        '.go': 'Go', '.java': 'Java', '.kt': 'Kotlin', '.kts': 'Kotlin',
        '.swift': 'Swift', '.rb': 'Ruby', '.php': 'PHP', '.c': 'C', '.h': 'C',
        '.cpp': 'C++', '.hpp': 'C++', '.cc': 'C++', '.cxx': 'C++',
        '.cs': 'C#', '.scala': 'Scala', '.r': 'R', '.dart': 'Dart',
        '.sh': 'Shell', '.bash': 'Shell', '.zsh': 'Shell', '.ps1': 'PowerShell',
        '.lua': 'Lua', '.pl': 'Perl', '.pm': 'Perl', '.hs': 'Haskell',
        '.elm': 'Elm', '.clj': 'Clojure', '.cljs': 'Clojure', '.erl': 'Erlang',
        '.ex': 'Elixir', '.exs': 'Elixir', '.vue': 'Vue', '.svelte': 'Svelte',
        '.astro': 'Astro', '.css': 'CSS', '.scss': 'Sass/SCSS', '.less': 'Less',
        '.html': 'HTML', '.sql': 'SQL', '.graphql': 'GraphQL', '.gql': 'GraphQL',
        '.yaml': 'YAML', '.yml': 'YAML', '.json': 'JSON', '.xml': 'XML',
        '.toml': 'TOML', '.md': 'Markdown', '.zig': 'Zig', '.nim': 'Nim',
        '.cr': 'Crystal', '.coffee': 'CoffeeScript', '.d': 'D',
        '.f': 'Fortran', '.f90': 'Fortran', '.v': 'V',
    };
    const SKIP_DIRS = new Set(['node_modules', '.git', '.svn', 'dist', 'build',
        '.next', '.nuxt', 'out', 'target', 'bin', 'obj', 'venv', '.venv',
        '__pycache__', '.cache', 'vendor', 'bower_components', 'tmp', 'coverage',
        '.nyc_output', '.svelte-kit', '.vercel', '.netlify']);

    if (!fs_1.default.existsSync(rootDir)) return { success: false, message: 'Directory does not exist' };

    try {
        const entries = fs_1.default.readdirSync(rootDir, { withFileTypes: true });
        const results = [];

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            if (SKIP_DIRS.has(entry.name)) continue;

            const dirPath = path_1.default.join(rootDir, entry.name);
            const foundLangs = new Set();
            let scannedFiles = 0;
            let foundAny = false;

            function quickScan(dirPathInner, depth = 0) {
                if (depth > 2 || scannedFiles > 200) return;
                try {
                    const items = fs_1.default.readdirSync(dirPathInner, { withFileTypes: true });
                    for (const item of items) {
                        if (scannedFiles > 200) return;
                        const fullPath = path_1.default.join(dirPathInner, item.name);
                        if (item.isDirectory()) {
                            if (!SKIP_DIRS.has(item.name)) {
                                quickScan(fullPath, depth + 1);
                            }
                        } else if (item.isFile()) {
                            scannedFiles++;
                            const ext = path_1.default.extname(item.name).toLowerCase();
                            if (ext && EXT_TO_LANG_SCAN[ext]) {
                                foundLangs.add(EXT_TO_LANG_SCAN[ext]);
                                foundAny = true;
                            }
                        }
                    }
                } catch { }
            }

            quickScan(dirPath);

            if (foundAny) {
                results.push({
                    name: entry.name,
                    path: dirPath,
                    languages: Array.from(foundLangs),
                    fileCount: scannedFiles,
                });
            }
        }

        return { success: true, projects: results };
    } catch (err) {
        return { success: false, message: 'Error scanning directory' };
    }
});

// Add a project to track
electron_1.ipcMain.handle('add-project', (event, projectData) => {
    if (useJson) return { success: false, message: 'Projects require SQLite' };

    const { name, path, repositoryUrl, vcsType, primaryLanguage, defaultIde } = projectData;
    const id = `proj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
        db.prepare(`
            INSERT INTO projects (id, name, path, repository_url, vcs_type, primary_language, default_ide, last_activity_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, name, path, repositoryUrl || null, vcsType || null, primaryLanguage || null, defaultIde || null, new Date().toISOString());

        // Scan for project-specific tools
        scanProjectTools(id, path);

        console.log('[DeskFlow] Project added:', name, 'with IDE:', defaultIde);
        return { success: true, id, name };
    } catch (err: any) {
        console.error('[DeskFlow] Failed to add project:', err);
        return { success: false, message: err.message };
    }
});

// Update project details
electron_1.ipcMain.handle('update-project', (event, projectId: string, updates: {
    name?: string;
    path?: string;
    repositoryUrl?: string;
    vcsType?: string;
    primaryLanguage?: string;
    defaultIde?: string;
}) => {
    if (useJson) return { success: false, message: 'Projects require SQLite' };

    try {
        const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as any;
        if (!project) {
            return { success: false, message: 'Project not found' };
        }

        const fields: string[] = [];
        const values: any[] = [];

        if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
        if (updates.path !== undefined) { fields.push('path = ?'); values.push(updates.path); }
        if (updates.repositoryUrl !== undefined) { fields.push('repository_url = ?'); values.push(updates.repositoryUrl || null); }
        if (updates.vcsType !== undefined) { fields.push('vcs_type = ?'); values.push(updates.vcsType || null); }
        if (updates.primaryLanguage !== undefined) { fields.push('primary_language = ?'); values.push(updates.primaryLanguage || null); }
        if (updates.defaultIde !== undefined) { fields.push('default_ide = ?'); values.push(updates.defaultIde || null); }

        if (fields.length === 0) {
            return { success: false, message: 'No fields to update' };
        }

        values.push(projectId);
        db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...values);

        console.log('[DeskFlow] Project updated:', projectId, updates);
        return { success: true };
    } catch (err: any) {
        console.error('[DeskFlow] Failed to update project:', err);
        return { success: false, message: err.message };
    }
});

// Detect primary language by scanning project file extensions
electron_1.ipcMain.handle('detect-project-language', async (_, projectPath: string) => {
    const EXT_TO_LANG = {
        '.ts': 'TypeScript', '.tsx': 'TypeScript', '.js': 'JavaScript', '.jsx': 'JavaScript',
        '.mjs': 'JavaScript', '.cjs': 'JavaScript', '.py': 'Python', '.rs': 'Rust',
        '.go': 'Go', '.java': 'Java', '.kt': 'Kotlin', '.kts': 'Kotlin',
        '.swift': 'Swift', '.rb': 'Ruby', '.php': 'PHP', '.c': 'C', '.h': 'C',
        '.cpp': 'C++', '.hpp': 'C++', '.cc': 'C++', '.cxx': 'C++',
        '.cs': 'C#', '.scala': 'Scala', '.r': 'R', '.dart': 'Dart',
        '.sh': 'Shell', '.bash': 'Shell', '.zsh': 'Shell', '.ps1': 'PowerShell',
        '.lua': 'Lua', '.pl': 'Perl', '.pm': 'Perl', '.hs': 'Haskell',
        '.elm': 'Elm', '.clj': 'Clojure', '.cljs': 'Clojure', '.erl': 'Erlang',
        '.ex': 'Elixir', '.exs': 'Elixir', '.vue': 'Vue', '.svelte': 'Svelte',
        '.astro': 'Astro', '.css': 'CSS', '.scss': 'Sass/SCSS', '.less': 'Less',
        '.html': 'HTML', '.sql': 'SQL', '.graphql': 'GraphQL', '.gql': 'GraphQL',
        '.yaml': 'YAML', '.yml': 'YAML', '.json': 'JSON', '.xml': 'XML',
        '.toml': 'TOML', '.md': 'Markdown', '.zig': 'Zig', '.nim': 'Nim',
        '.cr': 'Crystal', '.coffee': 'CoffeeScript', '.d': 'D',
        '.f': 'Fortran', '.f90': 'Fortran', '.v': 'V',
    };
    const SKIP_DIRS = new Set(['node_modules', '.git', '.svn', 'dist', 'build',
        '.next', '.nuxt', 'out', 'target', 'bin', 'obj', 'venv', '.venv',
        '__pycache__', '.cache', 'vendor', 'bower_components', 'tmp', 'coverage',
        '.nyc_output', '.svelte-kit', '.vercel', '.netlify']);

    const extCounts = new Map();
    let scannedFiles = 0;
    const maxFiles = 10000;

    function walkDir(dirPath, depth = 0) {
        if (depth > 8 || scannedFiles >= maxFiles) return;
        try {
            const entries = fs_1.default.readdirSync(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                if (scannedFiles >= maxFiles) return;
                const fullPath = path_1.default.join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    if (!SKIP_DIRS.has(entry.name)) {
                        walkDir(fullPath, depth + 1);
                    }
                } else if (entry.isFile()) {
                    scannedFiles++;
                    const ext = path_1.default.extname(entry.name).toLowerCase();
                    if (ext && EXT_TO_LANG[ext]) {
                        const lang = EXT_TO_LANG[ext];
                        extCounts.set(lang, (extCounts.get(lang) || 0) + 1);
                    }
                }
            }
        } catch { }
    }

    try {
        if (!fs_1.default.existsSync(projectPath)) {
            return { success: false, message: 'Project path does not exist' };
        }
        walkDir(projectPath);
        if (extCounts.size === 0) {
            return { success: false, message: 'No recognizable source files found' };
        }
        let topLang = '';
        let topCount = 0;
        for (const [lang, count] of extCounts) {
            if (count > topCount) {
                topCount = count;
                topLang = lang;
            }
        }
        return { success: true, language: topLang, fileCount: topCount, totalFiles: scannedFiles };
    } catch (err) {
        return { success: false, message: 'Error scanning project files' };
    }
});

// Batch detect languages for multiple projects with coding-only filter
electron_1.ipcMain.handle('detect-projects-languages', async (_, projectPaths) => {
    const EXT_TO_LANG = {
        '.ts': 'TypeScript', '.tsx': 'TypeScript', '.js': 'JavaScript', '.jsx': 'JavaScript',
        '.mjs': 'JavaScript', '.cjs': 'JavaScript', '.py': 'Python', '.rs': 'Rust',
        '.go': 'Go', '.java': 'Java', '.kt': 'Kotlin', '.kts': 'Kotlin',
        '.swift': 'Swift', '.rb': 'Ruby', '.php': 'PHP', '.c': 'C', '.h': 'C',
        '.cpp': 'C++', '.hpp': 'C++', '.cc': 'C++', '.cxx': 'C++',
        '.cs': 'C#', '.scala': 'Scala', '.r': 'R', '.dart': 'Dart',
        '.sh': 'Shell', '.bash': 'Shell', '.zsh': 'Shell', '.ps1': 'PowerShell',
        '.lua': 'Lua', '.pl': 'Perl', '.pm': 'Perl', '.hs': 'Haskell',
        '.elm': 'Elm', '.clj': 'Clojure', '.cljs': 'Clojure', '.erl': 'Erlang',
        '.ex': 'Elixir', '.exs': 'Elixir', '.vue': 'Vue', '.svelte': 'Svelte',
        '.astro': 'Astro', '.css': 'CSS', '.scss': 'Sass/SCSS', '.less': 'Less',
        '.html': 'HTML', '.sql': 'SQL', '.graphql': 'GraphQL', '.gql': 'GraphQL',
        '.yaml': 'YAML', '.yml': 'YAML', '.json': 'JSON', '.xml': 'XML',
        '.toml': 'TOML', '.md': 'Markdown', '.zig': 'Zig', '.nim': 'Nim',
        '.cr': 'Crystal', '.coffee': 'CoffeeScript', '.d': 'D',
        '.f': 'Fortran', '.f90': 'Fortran', '.v': 'V',
    };
    const CODING_EXCLUDE = new Set(['JSON', 'Markdown', 'YAML', 'TOML', 'XML']);
    const SKIP_DIRS = new Set(['node_modules', '.git', '.svn', 'dist', 'build',
        '.next', '.nuxt', 'out', 'target', 'bin', 'obj', 'venv', '.venv',
        '__pycache__', '.cache', 'vendor', 'bower_components', 'tmp', 'coverage',
        '.nyc_output', '.svelte-kit', '.vercel', '.netlify']);

    const results = {};

    for (const projectPath of projectPaths) {
        const extCounts = new Map();
        let scannedFiles = 0;
        const maxFiles = 10000;

        function walkDir(dirPath, depth = 0) {
            if (depth > 8 || scannedFiles >= maxFiles) return;
            try {
                const entries = fs_1.default.readdirSync(dirPath, { withFileTypes: true });
                for (const entry of entries) {
                    if (scannedFiles >= maxFiles) return;
                    const fullPath = path_1.default.join(dirPath, entry.name);
                    if (entry.isDirectory()) {
                        if (!SKIP_DIRS.has(entry.name)) {
                            walkDir(fullPath, depth + 1);
                        }
                    } else if (entry.isFile()) {
                        scannedFiles++;
                        const ext = path_1.default.extname(entry.name).toLowerCase();
                        if (ext && EXT_TO_LANG[ext]) {
                            const lang = EXT_TO_LANG[ext];
                            extCounts.set(lang, (extCounts.get(lang) || 0) + 1);
                        }
                    }
                }
            } catch { }
        }

        try {
            if (!fs_1.default.existsSync(projectPath)) {
                results[projectPath] = { success: false, message: 'Project path does not exist' };
                continue;
            }

            walkDir(projectPath);

            const allLangs = [];
            const codingLangs = [];
            let codingTotal = 0;

            for (const [lang, count] of extCounts) {
                const pct = scannedFiles > 0 ? Math.round((count / scannedFiles) * 100) : 0;
                allLangs.push({ language: lang, count, percentage: pct });
                if (!CODING_EXCLUDE.has(lang)) {
                    codingLangs.push({ language: lang, count, percentage: pct });
                    codingTotal += count;
                }
            }

            // Recalculate percentages based on coding-file total
            const normalized = codingLangs.map(l => ({
                ...l,
                percentage: codingTotal > 0 ? Math.round((l.count / codingTotal) * 100) : 0,
            })).sort((a, b) => b.count - a.count);

            results[projectPath] = {
                success: true,
                languages: normalized,
                allLanguages: allLangs.sort((a, b) => b.count - a.count),
                totalFiles: scannedFiles,
                codingFiles: codingTotal,
            };
        } catch (err) {
            results[projectPath] = { success: false, message: 'Error scanning project files' };
        }
    }

    return results;
});

// Soft delete project (mark as deleted, can be restored)
electron_1.ipcMain.handle('delete-project', (event, projectId: string) => {
    if (useJson) return { success: false, message: 'Projects require SQLite' };

    try {
        const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as any;
        if (!project) {
            return { success: false, message: 'Project not found' };
        }

        db.prepare('UPDATE projects SET deleted_at = ? WHERE id = ?').run(new Date().toISOString(), projectId);

        console.log('[DeskFlow] Project soft-deleted:', projectId);
        return { success: true };
    } catch (err: any) {
        console.error('[DeskFlow] Failed to delete project:', err);
        return { success: false, message: err.message };
    }
});

// Restore soft-deleted project
electron_1.ipcMain.handle('restore-project', (event, projectId: string) => {
    if (useJson) return { success: false, message: 'Projects require SQLite' };

    try {
        const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as any;
        if (!project) {
            return { success: false, message: 'Project not found' };
        }

        db.prepare('UPDATE projects SET deleted_at = NULL WHERE id = ?').run(projectId);

        console.log('[DeskFlow] Project restored:', projectId);
        return { success: true };
    } catch (err: any) {
        console.error('[DeskFlow] Failed to restore project:', err);
        return { success: false, message: err.message };
    }
});

// Open project in specified IDE
electron_1.ipcMain.handle('open-project', async (event, projectId: string, ideId?: string) => {
    if (useJson) return { success: false, message: 'Projects require SQLite' };

    try {
        const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as any;
        if (!project) {
            return { success: false, message: 'Project not found' };
        }

        console.log('[DeskFlow] open-project: projectId=', projectId, 'ideId=', ideId, 'project.default_ide=', project.default_ide);

        // If no IDE specified, use project's default IDE
        const targetIde = ideId || project.default_ide;
        console.log('[DeskFlow] open-project: targetIde=', targetIde);

        if (!targetIde) {
            return { success: false, message: 'No IDE specified for this project. Please set a default IDE in project settings.' };
        }

        // Get IDE info
        const ide = db.prepare('SELECT * FROM ides WHERE id = ?').get(targetIde) as any;
        console.log('[DeskFlow] open-project: ide=', ide);
        if (!ide) {
            return { success: false, message: `IDE '${targetIde}' not found in database` };
        }

        // Build open command based on IDE
        const { exec } = require('child_process');
        let command = '';

        switch (ideId || project.default_ide) {
            case 'vscode':
                command = `code "${project.path}"`;
                break;
            case 'cursor':
                command = `cursor "${project.path}"`;
                break;
            case 'intellij':
            case 'intellij-ce':
            case 'pycharm':
            case 'pycharm-ce':
            case 'goland':
            case 'webstorm':
            case 'rider':
                // JetBrains IDEs use a generic launcher or the .exe path
                if (ide.install_path && ide.install_path.includes('.exe')) {
                    command = `"${ide.install_path}" "${project.path}"`;
                } else {
                    // Try using the JetBrains toolbox launcher
                    command = `"${ide.install_path}" "${project.path}"`;
                }
                break;
            case 'android-studio':
                command = `"${ide.install_path}\\bin\\studio64.exe" "${project.path}"`;
                break;
            case 'antigravity':
                command = `"${ide.install_path}" "${project.path}"`;
                break;
            default:
                // Try using the IDE's install path directly
                if (ide.install_path) {
                    command = `"${ide.install_path}" "${project.path}"`;
                } else {
                    return { success: false, message: `No path configured for ${ide.name}` };
                }
        }

        // Execute the open command
        const { execSync } = require('child_process');
        try {
            execSync(command, { stdio: 'ignore', windowsHide: true });
            console.log('[DeskFlow] Opening project:', project.name, 'in', ide.name);
            return { success: true, ide: ide.name };
        } catch (err: any) {
            console.error('[DeskFlow] Failed to open project:', err.message);
            return { success: false, message: err.message };
        }
    } catch (err: any) {
        console.error('[DeskFlow] Open project error:', err);
        return { success: false, message: err.message };
    }
});

// Scan for tools in a project
function scanProjectTools(projectId: string, projectPath: string) {
    if (useJson || !db) return;
    const { execSync } = require('child_process');
    const pathModule = require('path');

    const projectTools: string[] = [];

    // Detect by package.json
    const pkgPath = pathModule.join(projectPath, 'package.json');
    if (fs_1.default.existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(fs_1.default.readFileSync(pkgPath, 'utf8'));
            const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

            const toolMap: Record<string, string> = {
                'eslint': 'linter',
                'prettier': 'formatter',
                'typescript': 'type-checker',
                'jest': 'test-runner',
                'vitest': 'test-runner',
                'webpack': 'bundler',
                'vite': 'bundler',
                'rollup': 'bundler',
                'esbuild': 'bundler'
            };

            for (const [dep, category] of Object.entries(toolMap)) {
                if (allDeps[dep]) {
                    projectTools.push(dep);
                    const toolId = `proj-${dep}-${Date.now()}`;
                    try {
                        db!.prepare(`
                            INSERT OR IGNORE INTO tools (id, name, category, version, detected_at, detection_method)
                            VALUES (?, ?, ?, ?, ?, ?)
                        `).run(toolId, dep, category, allDeps[dep], new Date().toISOString(), 'project');

                        db!.prepare(`
                            INSERT OR IGNORE INTO project_tools (project_id, tool_id)
                            VALUES (?, ?)
                        `).run(projectId, toolId);
                    } catch {}
                }
            }
        } catch {}
    }

    // Detect by pyproject.toml
    const pyprojectPath = pathModule.join(projectPath, 'pyproject.toml');
    if (fs_1.default.existsSync(pyprojectPath)) {
        try {
            const content = fs_1.default.readFileSync(pyprojectPath, 'utf8');
            const pythonTools: Record<string, string> = {
                'ruff': 'linter',
                'black': 'formatter',
                'pytest': 'test-runner',
                'mypy': 'type-checker'
            };

            for (const [tool, category] of Object.entries(pythonTools)) {
                if (content.includes(tool)) {
                    projectTools.push(tool);
                    const toolId = `proj-${tool}-${Date.now()}`;
                    try {
                        db!.prepare(`
                            INSERT OR IGNORE INTO tools (id, name, category, detected_at, detection_method)
                            VALUES (?, ?, ?, ?, ?)
                        `).run(toolId, tool, category, new Date().toISOString(), 'project');

                        db!.prepare(`
                            INSERT OR IGNORE INTO project_tools (project_id, tool_id)
                            VALUES (?, ?)
                        `).run(projectId, toolId);
                    } catch {}
                }
            }
        } catch {}
    }

    console.log('[DeskFlow] Project tools detected:', projectTools.join(', '));
}

// Get all projects (excluding soft-deleted)
electron_1.ipcMain.handle('get-projects', () => {
    if (useJson) return [];
    try {
        return db.prepare('SELECT * FROM projects WHERE deleted_at IS NULL ORDER BY last_activity_at DESC').all();
    } catch {
        return [];
    }
});

// Get all projects including soft-deleted (for restore)
electron_1.ipcMain.handle('get-all-projects', () => {
    if (useJson) return [];
    try {
        return db.prepare('SELECT * FROM projects ORDER BY last_activity_at DESC').all();
    } catch {
        return [];
    }
});

// Get tools for a specific project
electron_1.ipcMain.handle('get-project-tools', (event, projectId) => {
    if (useJson) return [];
    try {
        return db.prepare(`
            SELECT t.* FROM tools t
            JOIN project_tools pt ON t.id = pt.tool_id
            WHERE pt.project_id = ?
            ORDER BY t.category, t.name
        `).all(projectId);
    } catch {
        return [];
    }
});

// Calculate project health
electron_1.ipcMain.handle('calculate-project-health', (event, projectId) => {
    if (useJson) return { healthScore: 0, activityLevel: 'inactive', aiSessions: 0, commits: 0 };
    try {
        // Get project path for path-based matching
        const project = db.prepare('SELECT path FROM projects WHERE id = ?').get(projectId) || { path: null };
        const projectPath = project.path;

        // Get recent activity
        const recentSessions = db.prepare(`
            SELECT COUNT(*) as count FROM terminal_sessions 
            WHERE project_id = ? AND created_at >= datetime('now', '-7 days')
        `).get(projectId);
        
        const recentCommits = db.prepare(`
            SELECT COUNT(*) as count FROM commits 
            WHERE project_id = ? AND date >= datetime('now', '-7 days')
        `).get(projectId);

        // Match ai_usage by project_path (from JSONL) — project_id is often NULL
        // since sync stores project_path from JSONL cwd data
        let aiCount = 0;
        if (projectPath) {
            const aiUsage = db.prepare(`
                SELECT COUNT(*) as count FROM ai_usage 
                WHERE (project_id = ? OR project_path = ? OR project_path LIKE ?)
                AND date >= date('now', '-7 days')
            `).get(projectId, projectPath, projectPath + '/%');
            aiCount = aiUsage.count || 0;
        } else {
            const aiUsage = db.prepare(`
                SELECT COUNT(*) as count FROM ai_usage 
                WHERE project_id = ? AND date >= date('now', '-7 days')
            `).get(projectId);
            aiCount = aiUsage.count || 0;
        }
        
        // Calculate health score (0-100)
        let healthScore = 0;
        healthScore += Math.min(30, (recentSessions.count || 0) * 10); // Max 30 for sessions
        healthScore += Math.min(40, (recentCommits.count || 0) * 5); // Max 40 for commits  
        healthScore += Math.min(30, aiCount * 3); // Max 30 for AI usage
        
        // Determine activity level
        let activityLevel = 'inactive';
        if (healthScore >= 70) activityLevel = 'active';
        else if (healthScore >= 30) activityLevel = 'moderate';
        else if (healthScore > 0) activityLevel = 'light';
        
        return {
            healthScore,
            activityLevel,
            aiSessions: aiCount,
            commits: recentCommits.count || 0
        };
    } catch (err) {
        console.error('Failed to calculate project health:', err);
        return { healthScore: 0, activityLevel: 'inactive', aiSessions: 0, commits: 0 };
    }
});

// Get comprehensive project details (consolidated single-call endpoint)
electron_1.ipcMain.handle('get-project-details', (event, projectId) => {
    if (useJson) return { project: null, tools: [], sessions: [], health: null, presets: [], aiUsage: null };
    try {
        const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) || null;
        const projectPath = project?.path || null;

        const tools = db.prepare(`
            SELECT t.* FROM tools t
            JOIN project_tools pt ON t.id = pt.tool_id
            WHERE pt.project_id = ?
            ORDER BY t.category, t.name
        `).all(projectId);

        const sessions = db.prepare(`
            SELECT * FROM terminal_sessions
            WHERE project_id = ?
            ORDER BY created_at DESC LIMIT 5
        `).all(projectId);

        const presets = db.prepare(`
            SELECT * FROM terminal_presets
            WHERE project_id = ?
            ORDER BY updated_at DESC
        `).all(projectId);

        // Health calculation with path-based ai_usage matching
        const recentSessions = db.prepare(`
            SELECT COUNT(*) as count FROM terminal_sessions 
            WHERE project_id = ? AND created_at >= datetime('now', '-7 days')
        `).get(projectId);
        console.log('[HealthDebug] get-project-details for projectId:', projectId, 'recentSessions count:', (recentSessions as any)?.count);

        const recentCommits = db.prepare(`
            SELECT COUNT(*) as count FROM commits 
            WHERE project_id = ? AND date >= datetime('now', '-7 days')
        `).get(projectId);

        let aiCount = 0;
        let aiUsage = null;
        if (projectPath) {
            const aiRow = db.prepare(`
                SELECT COUNT(*) as count,
                       SUM(input_tokens + output_tokens) as total_tokens,
                       SUM(cost_usd) as total_cost,
                       SUM(message_count) as total_messages
                FROM ai_usage 
                WHERE (project_id = ? OR project_path = ? OR project_path LIKE ?)
                AND date >= date('now', '-7 days')
            `).get(projectId, projectPath, projectPath + '/%');
            aiCount = aiRow.count || 0;
            aiUsage = {
                sessions: aiRow.count || 0,
                totalTokens: aiRow.total_tokens || 0,
                totalCost: aiRow.total_cost || 0,
                totalMessages: aiRow.total_messages || 0
            };

            // Also get model breakdown for this project
            const modelBreakdown = db.prepare(`
                SELECT model,
                       SUM(input_tokens + output_tokens) as tokens,
                       COUNT(*) as sessions,
                       SUM(cost_usd) as cost
                FROM ai_usage 
                WHERE (project_id = ? OR project_path = ? OR project_path LIKE ?)
                AND date >= date('now', '-7 days')
                AND model IS NOT NULL
                GROUP BY model
                ORDER BY tokens DESC
            `).all(projectId, projectPath, projectPath + '/%');
            aiUsage.modelBreakdown = modelBreakdown;
        } else {
            const aiRow = db.prepare(`
                SELECT COUNT(*) as count,
                       SUM(input_tokens + output_tokens) as total_tokens,
                       SUM(cost_usd) as total_cost,
                       SUM(message_count) as total_messages
                FROM ai_usage 
                WHERE project_id = ? AND date >= date('now', '-7 days')
            `).get(projectId);
            aiCount = aiRow.count || 0;
            aiUsage = {
                sessions: aiRow.count || 0,
                totalTokens: aiRow.total_tokens || 0,
                totalCost: aiRow.total_cost || 0,
                totalMessages: aiRow.total_messages || 0,
                modelBreakdown: []
            };
        }

        // Calculate health
        let healthScore = 0;
        healthScore += Math.min(30, (recentSessions.count || 0) * 10);
        healthScore += Math.min(40, (recentCommits.count || 0) * 5);
        healthScore += Math.min(30, aiCount * 3);

        let activityLevel = 'inactive';
        if (healthScore >= 70) activityLevel = 'active';
        else if (healthScore >= 30) activityLevel = 'moderate';
        else if (healthScore > 0) activityLevel = 'light';

        return {
            project,
            tools,
            sessions,
            presets,
            aiUsage,
            health: {
                healthScore,
                activityLevel,
                aiSessions: aiCount,
                commits: recentCommits.count || 0
            }
        };
    } catch (err) {
        console.error('Failed to get project details:', err);
        return { project: null, tools: [], sessions: [], health: null, presets: [], aiUsage: null };
    }
});

// Remove a project
electron_1.ipcMain.handle('remove-project', (event, projectId) => {
    if (useJson) return { success: false };

    try {
        db.prepare('DELETE FROM project_tools WHERE project_id = ?').run(projectId);
        db.prepare('DELETE FROM commits WHERE project_id = ?').run(projectId);
        db.prepare('DELETE FROM ai_usage WHERE project_id = ?').run(projectId);
        db.prepare('DELETE FROM dora_metrics WHERE project_id = ?').run(projectId);
        db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);

        console.log('[DeskFlow] Project removed:', projectId);
        return { success: true };
    } catch (err: any) {
        return { success: false, message: err.message };
    }
});

// Get AI usage summary
electron_1.ipcMain.handle('get-ai-usage-summary', (event, period = 'week', dateOffset = 0, projectId) => {
    if (useJson) return { totalTokens: 0, totalCost: 0, byTool: {} };

    try {
        const now = new Date();
        let sinceDateStr: string | null = null;

        if (period === 'today') {
            const d = new Date(now);
            d.setDate(d.getDate() - dateOffset);
            sinceDateStr = d.toISOString().split('T')[0];
        } else if (period === 'week') {
            sinceDateStr = new Date(now.getTime() - (7 + dateOffset * 7) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        } else if (period === '7day') {
            sinceDateStr = new Date(now.getTime() - (7 + dateOffset * 7) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        } else if (period === 'month') {
            sinceDateStr = new Date(now.getTime() - (30 + dateOffset * 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        } else if (period === '30day') {
            sinceDateStr = new Date(now.getTime() - (30 + dateOffset * 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        }

        let query = `
            SELECT
                tool,
                SUM(input_tokens + output_tokens) as total_tokens,
                SUM(cost_usd) as total_cost,
                COUNT(*) as session_count,
                SUM(message_count) as total_messages,
                MAX(date) as last_used,
                GROUP_CONCAT(DISTINCT model) as models
            FROM ai_usage
        `;
        const params: any[] = [];

        const conditions: string[] = [];
        if (sinceDateStr) conditions.push(`date >= ?`);
        if (projectId) conditions.push(`project_id = ?`);

        if (conditions.length > 0) {
            query += `WHERE ${conditions.join(' AND ')} GROUP BY tool`;
            if (sinceDateStr) params.push(sinceDateStr);
            if (projectId) params.push(projectId);
        } else {
            query += `GROUP BY tool`;
        }

        const summary = db.prepare(query).all(...params);

        const byTool: Record<string, any> = {};
        let totalTokens = 0;
        let totalCost = 0;

        for (const row of summary) {
            const models = row.models ? row.models.split(',').filter((m: string) => m) : [];
            byTool[row.tool] = {
                tokens: row.total_tokens,
                cost: row.total_cost,
                sessions: row.session_count,
                messageCount: row.total_messages || 0,
                lastUsed: row.last_used || null,
                models,
            };
            totalTokens += row.total_tokens;
            totalCost += row.total_cost;
        }

        return { totalTokens, totalCost, byTool, period };
    } catch {
        return { totalTokens: 0, totalCost: 0, byTool: {} };
    }
});

// Get commit statistics
electron_1.ipcMain.handle('get-commit-stats', (event, projectId, period = 'week') => {
    if (useJson) return { totalCommits: 0, totalAdditions: 0, totalDeletions: 0 };

    try {
        let dateFilter = '';
        let projectFilter = '';

        if (projectId) {
            projectFilter = `project_id = '${projectId}'`;
        }

        const now = new Date();
        if (period === 'week') {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            dateFilter = `date >= '${weekAgo.toISOString()}'`;
        } else if (period === 'month') {
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            dateFilter = `date >= '${monthAgo.toISOString()}'`;
        }

        const whereClause = [projectFilter, dateFilter].filter(Boolean).join(' AND ');

        const stats = db.prepare(`
            SELECT
                COUNT(*) as total_commits,
                COALESCE(SUM(additions), 0) as total_additions,
                COALESCE(SUM(deletions), 0) as total_deletions,
                COALESCE(SUM(files_changed), 0) as total_files
            FROM commits
            ${whereClause ? 'WHERE ' + whereClause : ''}
        `).get();

        return stats;
    } catch {
        return { totalCommits: 0, totalAdditions: 0, totalDeletions: 0 };
    }
});

// Open folder picker dialog
electron_1.ipcMain.handle('pick-folder', async () => {
    return new Promise((resolve) => {
        electron_1.dialog.showOpenDialog({
            properties: ['openDirectory'],
            title: 'Select Project Folder'
        }).then((result: any) => {
            if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
                resolve({ success: false, path: null });
            } else {
                resolve({ success: true, path: result.filePaths[0] });
            }
        }).catch((err: any) => {
            console.error('[DeskFlow] Folder picker error:', err);
            resolve({ success: false, path: null });
        });
    });
});

// Open file dialog (for skill file widget)
electron_1.ipcMain.handle('show-open-dialog', async (_event, options: any) => {
    try {
        const result = await electron_1.dialog.showOpenDialog(options);
        return { canceled: result.canceled, filePaths: result.filePaths };
    } catch (err) {
        console.error('[DeskFlow] Open dialog error:', err);
        return { canceled: true, filePaths: [] };
    }
});

// Get IDE Projects overview for dashboard
electron_1.ipcMain.handle('get-ide-projects-overview', (event, period?: string, dateOffset = 0) => {
    if (useJson) {
        return {
            ides: [],
            tools: [],
            projects: [],
            aiUsage: { totalTokens: 0, totalCost: 0, totalMessages: 0, byTool: {} },
            commits: { totalCommits: 0, totalAdditions: 0, totalDeletions: 0 }
        };
    }

    try {
        const ides = db.prepare('SELECT * FROM ides ORDER BY name').all();
        const tools = db.prepare('SELECT * FROM tools ORDER BY category, name').all();
        const projects = db.prepare('SELECT * FROM projects ORDER BY last_activity_at DESC LIMIT 10').all();

        // Compute date filter for AI usage queries
        let dateFilterSQL = '';
        let dateFilterParam: string | null = null;
        if (period && period !== 'all') {
            const now = new Date();
            let sinceDate: Date | null = null;
        if (period === 'today' || period === 'day') {
                const d = new Date(now);
                d.setDate(d.getDate() - dateOffset);
                sinceDate = d;
            } else if (period === 'week' || period === '7day') {
                sinceDate = new Date(now.getTime() - (7 + dateOffset * 7) * 24 * 60 * 60 * 1000);
            } else if (period === 'month' || period === '30day') {
                sinceDate = new Date(now.getTime() - (30 + dateOffset * 30) * 24 * 60 * 60 * 1000);
            }
            if (sinceDate) {
                dateFilterSQL = 'WHERE date >= ?';
                dateFilterParam = sinceDate.toISOString().split('T')[0];
            }
        }

        const aiUsage = db.prepare(`
            SELECT tool,
                   SUM(input_tokens) as tokens_in,
                   SUM(output_tokens) as tokens_out,
                   SUM(input_tokens + output_tokens) as tokens,
                   SUM(cost_usd) as cost,
                   COUNT(*) as session_count,
                   SUM(message_count) as messageCount,
                   MAX(date) as lastUsed,
                   GROUP_CONCAT(DISTINCT model) as models
            FROM ai_usage
            ${dateFilterSQL}
            GROUP BY tool
        `).all(...(dateFilterParam ? [dateFilterParam] : []));
        const commits = db.prepare(`
            SELECT COUNT(*) as count, SUM(additions) as additions, SUM(deletions) as deletions
            FROM commits
            WHERE date >= datetime('now', '-30 days')
        `).get();

        // Daily breakdown per tool for charts (real message_count)
        const aiUsageDaily = db.prepare(`
            SELECT tool, date,
                   SUM(input_tokens) as tokens_in,
                   SUM(output_tokens) as tokens_out,
                   SUM(input_tokens + output_tokens) as tokens,
                   SUM(cost_usd) as cost,
                   COUNT(*) as session_count,
                   SUM(message_count) as messageCount
            FROM ai_usage
            ${dateFilterSQL}
            GROUP BY tool, date
            ORDER BY date DESC
        `).all(...(dateFilterParam ? [dateFilterParam] : []));

        // Project breakdown per tool
        const aiUsageProjects = db.prepare(`
            SELECT tool, project_path,
                   SUM(input_tokens) as tokens_in,
                   SUM(output_tokens) as tokens_out,
                   SUM(input_tokens + output_tokens) as tokens,
                   SUM(message_count) as messageCount,
                   COUNT(*) as session_count
            FROM ai_usage
            WHERE project_path IS NOT NULL AND project_path != ''
            ${dateFilterSQL ? 'AND date >= ?' : ''}
            GROUP BY tool, project_path
            ORDER BY tokens DESC
        `).all(...(dateFilterParam ? [dateFilterParam] : []));

        // Model breakdown per tool
        const aiUsageModels = db.prepare(`
            SELECT tool, model,
                   SUM(input_tokens) as tokens_in,
                   SUM(output_tokens) as tokens_out,
                   SUM(input_tokens + output_tokens) as tokens,
                   SUM(message_count) as messageCount,
                   COUNT(*) as session_count
            FROM ai_usage
            WHERE model IS NOT NULL AND model != ''
            ${dateFilterSQL ? 'AND date >= ?' : ''}
            GROUP BY tool, model
            ORDER BY tokens DESC
        `).all(...(dateFilterParam ? [dateFilterParam] : []));

        // Daily model breakdown per tool (for model timeline chart)
        const aiUsageModelDaily = db.prepare(`
            SELECT tool, model, date,
                   SUM(input_tokens) as tokens_in,
                   SUM(output_tokens) as tokens_out,
                   SUM(input_tokens + output_tokens) as tokens,
                   SUM(message_count) as messageCount,
                   COUNT(*) as session_count,
                   SUM(cost_usd) as cost
            FROM ai_usage
            WHERE model IS NOT NULL AND model != ''
            ${dateFilterSQL ? 'AND date >= ?' : ''}
            GROUP BY tool, model, date
            ORDER BY date ASC
        `).all(...(dateFilterParam ? [dateFilterParam] : []));

        const byTool: Record<string, any> = {};
        let totalTokens = 0;
        let totalCost = 0;
        let totalMessages = 0;

        for (const row of aiUsage) {
            const models = row.models ? row.models.split(',').filter((m: string) => m) : [];
            byTool[row.tool] = {
                tokens: row.tokens || 0,
                tokens_in: row.tokens_in || 0,
                tokens_out: row.tokens_out || 0,
                cost: row.cost || 0,
                sessions: row.session_count || 0,
                messageCount: row.messageCount || 0,
                lastUsed: row.lastUsed || null,
                models,
                daily: {},
                projects: [],
                modelBreakdown: [],
                modelDaily: {}
            };
            totalTokens += (row.tokens || 0);
            totalCost += (row.cost || 0);
            totalMessages += (row.messageCount || 0);
        }

        // Populate daily breakdown
        for (const row of aiUsageDaily) {
            if (byTool[row.tool]) {
                byTool[row.tool].daily[row.date] = {
                    tokens: row.tokens || 0,
                    tokens_in: row.tokens_in || 0,
                    tokens_out: row.tokens_out || 0,
                    cost: row.cost || 0,
                    sessions: row.session_count || 0,
                    messageCount: row.messageCount || 0
                };
            }
        }

        // Populate project breakdown
        for (const row of aiUsageProjects) {
            if (byTool[row.tool]) {
                byTool[row.tool].projects.push({
                    path: row.project_path,
                    tokens: row.tokens || 0,
                    tokens_in: row.tokens_in || 0,
                    tokens_out: row.tokens_out || 0,
                    messageCount: row.messageCount || 0,
                    sessions: row.session_count || 0
                });
            }
        }

        // Populate model breakdown
        for (const row of aiUsageModels) {
            if (byTool[row.tool]) {
                byTool[row.tool].modelBreakdown.push({
                    model: row.model,
                    tokens: row.tokens || 0,
                    tokens_in: row.tokens_in || 0,
                    tokens_out: row.tokens_out || 0,
                    messageCount: row.messageCount || 0,
                    sessions: row.session_count || 0
                });
            }
        }

        // Populate daily model breakdown
        for (const row of aiUsageModelDaily) {
            if (byTool[row.tool]) {
                if (!byTool[row.tool].modelDaily[row.model]) {
                    byTool[row.tool].modelDaily[row.model] = {};
                }
                byTool[row.tool].modelDaily[row.model][row.date] = {
                    tokens: row.tokens || 0,
                    tokens_in: row.tokens_in || 0,
                    tokens_out: row.tokens_out || 0,
                    messageCount: row.messageCount || 0,
                    sessions: row.session_count || 0,
                    cost: row.cost || 0
                };
            }
        }

        return {
            ides,
            tools,
            projects,
            aiUsage: { totalTokens, totalCost, totalMessages, byTool },
            commits: {
                totalCommits: commits?.count || 0,
                totalAdditions: commits?.additions || 0,
                totalDeletions: commits?.deletions || 0
            }
        };
    } catch (err) {
        console.error('[DeskFlow] IDE Projects overview error:', err);
        return {
            ides: [],
            tools: [],
            projects: [],
            aiUsage: { totalTokens: 0, totalCost: 0, totalMessages: 0, byTool: {} },
            commits: { totalCommits: 0, totalAdditions: 0, totalDeletions: 0 }
        };
    }
});

// Sync AI usage using the plugin system
electron_1.ipcMain.handle('sync-ai-usage', async () => {
    if (useJson) return { success: false, message: 'AI sync requires SQLite' };

    const results = await syncAllAIAgents(db);

    return { success: true, ...results };
});

// Terminal layout stubs (prevents console spam until full terminal feature is implemented)
electron_1.ipcMain.handle('get-terminal-layouts', async (_event, projectId?: string) => {
    if (!db) return [];
    try {
        const stmt = db.prepare('SELECT * FROM terminal_layouts WHERE project_id = ? OR project_id IS NULL ORDER BY updated_at DESC');
        return stmt.all(projectId || null);
    } catch {
        return [];
    }
});

electron_1.ipcMain.handle('save-terminal-layout', async (_event, data: any) => {
    if (!db) return { success: false };
    try {
        const id = data.id || `layout-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const exists = db.prepare('SELECT 1 FROM terminal_layouts WHERE id = ?').get(id);
        if (exists) {
            db.prepare(`
                UPDATE terminal_layouts SET name = ?, layout_data = ?, project_id = ?, is_active = ?, updated_at = datetime('now')
                WHERE id = ?
            `).run(data.name, data.layoutData, data.projectId || null, data.isActive ? 1 : 0, id);
        } else {
            db.prepare(`
                INSERT INTO terminal_layouts (id, name, layout_data, project_id, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `).run(id, data.name, data.layoutData, data.projectId || null, data.isActive ? 1 : 0);
        }
        return { success: true, id };
    } catch (err: any) {
        console.error('[DeskFlow] save-terminal-layout error:', err.message);
        return { success: false };
    }
});

// Terminal preset handlers
electron_1.ipcMain.handle('get-terminal-presets', async (_event, projectId?: string) => {
    if (!db) return [];
    try {
        const stmt = db.prepare('SELECT * FROM terminal_presets WHERE project_id = ? OR project_id IS NULL ORDER BY updated_at DESC');
        return stmt.all(projectId || null);
    } catch {
        return [];
    }
});

electron_1.ipcMain.handle('add-terminal-preset', async (_event, preset: any) => {
    if (!db) return { success: false };
    try {
        const id = `preset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        db.prepare(`
            INSERT INTO terminal_presets (id, name, command, project_id, working_directory, category, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).run(id, preset.name, preset.command, preset.projectId || null, preset.workingDirectory || null, preset.category || null);
        return { success: true, id };
    } catch (err: any) {
        console.error('[DeskFlow] add-terminal-preset error:', err.message);
        return { success: false, error: err.message };
    }
});

electron_1.ipcMain.handle('remove-terminal-preset', async (_event, presetId: string) => {
    if (!db) return { success: false };
    try {
        db.prepare('DELETE FROM terminal_presets WHERE id = ?').run(presetId);
        return { success: true };
    } catch (err: any) {
        console.error('[DeskFlow] remove-terminal-preset error:', err.message);
        return { success: false, error: err.message };
    }
});

electron_1.ipcMain.handle('execute-terminal-preset', async (_event, presetId: string, terminalId?: string) => {
    if (!db) return { success: false };
    try {
        const preset = db.prepare('SELECT * FROM terminal_presets WHERE id = ?').get(presetId) as any;
        if (!preset) return { success: false, error: 'Preset not found' };
        
        // Save as a session for tracking
        const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        db.prepare(`
            INSERT INTO terminal_sessions (id, preset_id, project_id, agent, topic, working_directory, created_at)
            VALUES (?, ?, ?, 'preset', ?, ?, datetime('now'))
        `).run(sessionId, presetId, preset.project_id, preset.name, preset.working_directory);
        
        return { success: true, sessionId, command: preset.command };
    } catch (err: any) {
        console.error('[DeskFlow] execute-terminal-preset error:', err.message);
        return { success: false, error: err.message };
    }
});

electron_1.ipcMain.handle('save-terminal-preset', async (_event, data: any) => {
    if (!db) return { success: false };
    try {
        const id = data.id || `preset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const exists = db.prepare('SELECT 1 FROM terminal_presets WHERE id = ?').get(id);
        if (exists) {
            db.prepare(`
                UPDATE terminal_presets SET name = ?, command = ?, project_id = ?, updated_at = datetime('now')
                WHERE id = ?
            `).run(data.name, data.command, data.projectId || null, id);
        } else {
            db.prepare(`
                INSERT INTO terminal_presets (id, name, command, project_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
            `).run(id, data.name, data.command, data.projectId || null);
        }
        return { success: true, id };
    } catch (err: any) {
        console.error('[DeskFlow] save-terminal-preset error:', err.message);
        return { success: false };
    }
});

// ═══════════════════════════════════════════════════════════════════
// Foundation: AGENT_CONFIGS, ANSI stripping, prompt detection,
// state machine, launch verification, error diagnosis
// ═══════════════════════════════════════════════════════════════════

interface AgentConfig {
  binaryCandidates: string[];
  readyRegex: RegExp;
  installHint: string;
  bracketedPaste: boolean;
}

const DEFAULT_AGENT = 'opencode';

const AGENT_CONFIGS: Record<string, AgentConfig> = {
  opencode: {
    binaryCandidates: ['opencode', 'opencode.cmd', 'opencode.exe'],
    readyRegex: /^(?:opencode)?\s*>\s*$/i,
    installHint: 'Install with: npm i -g opencode-ai (then restart the app)',
    bracketedPaste: true,
  },
  claude: {
    binaryCandidates: ['claude', 'claude.cmd', 'claude.exe'],
    readyRegex: /^(?:claude)?\s*>\s*$/i,
    installHint: 'Install with: npm i -g @anthropic-ai/claude-code (then restart the app)',
    bracketedPaste: true,
  },
};

const FALLBACK_READY_REGEX = /^[A-Za-z0-9_-]*\s*>\s*$/;

function getAgentConfig(agentType?: string): AgentConfig {
  return AGENT_CONFIGS[agentType ?? ''] ?? {
    binaryCandidates: agentType ? [agentType] : [],
    readyRegex: FALLBACK_READY_REGEX,
    installHint: `Could not find '${agentType}' on PATH. Install it and restart the app.`,
    bracketedPaste: false,
  };
}

// Strip ANSI escape sequences from terminal output
function stripAnsi(s: string): string {
  return s
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b[@-Z\\-_]/g, '')
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
}

// Shell prompt patterns — these must NEVER trigger agent:ready
const SHELL_PROMPT_REGEXES: RegExp[] = [
  /^PS\s+.*>\s*$/,
  /^[A-Za-z]:\\.*>\s*$/,
  /^[^@\s]+@[^:\s]+:.*[#$]\s*$/,
];

function looksLikeShell(line: string): boolean {
  return SHELL_PROMPT_REGEXES.some((re) => re.test(line));
}

// Agent prompt detection — checks the last non-empty line of accumulated output
// against the per-agent ready regex. Strips ANSI, rejects shell prompts.
function detectAgentPrompt(buffer: string, agentType?: string): boolean {
  const clean = stripAnsi(buffer);
  const lines = clean.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (trimmed.length === 0) continue;
    if (looksLikeShell(trimmed)) return false;
    return getAgentConfig(agentType).readyRegex.test(trimmed);
  }
  return false;
}

// Agent launch verification — out-of-band PATH check

interface AgentVerifyResult {
  found: boolean;
  resolvedBinary?: string;
  resolvedPath?: string;
  tried: string[];
  installHint: string;
}

function whichOne(name: string): Promise<string | null> {
  const cmd = process.platform === 'win32' ? 'where.exe' : 'which';
  return new Promise((resolve) => {
    child_process_1.execFile(cmd, [name], { timeout: 4000, windowsHide: true }, (err, stdout) => {
      if (err) return resolve(null);
      const first = stdout.split(/\r?\n/).map((l) => l.trim()).find(Boolean);
      resolve(first ?? null);
    });
  });
}

async function verifyAgent(agentType: string): Promise<AgentVerifyResult> {
  const cfg = getAgentConfig(agentType);
  const tried = cfg.binaryCandidates.length ? cfg.binaryCandidates : [agentType];
  for (const cand of tried) {
    const resolvedPath = await whichOne(cand);
    if (resolvedPath) {
      return { found: true, resolvedBinary: cand, resolvedPath, tried, installHint: cfg.installHint };
    }
  }
  return { found: false, tried, installHint: cfg.installHint };
}

// Per-terminal agent state machine
type AgentPhase = 'launching' | 'ready' | 'busy' | 'attention';
interface AgentState {
  agentType: string;
  phase: AgentPhase;
  dataBuffer: string;
  idleSeq: number;
  handshakeToken?: string;
  timeoutHandle?: ReturnType<typeof setTimeout>;
  pendingWrites?: string[];
}
const agentStates = new Map<string, AgentState>();

// Patterns that indicate the agent is waiting for user confirmation or input
const ACTION_REQUIRED_PATTERNS = [
  /\?\s*\[y\/n\]/i,
  /\?\s*\(yes\/no\)/i,
  /\[y\/n\]\s*\?/i,
  /confirm/i,
  /proceed/i,
  /password/i,
  /passphrase/i,
  /enter\s+your\s+name/i,
  /select\s+an\s+option/i,
];

function detectActionRequired(buffer: string): boolean {
  const clean = stripAnsi(buffer);
  const lines = clean.split(/\r?\n/);
  const lastLine = lines[lines.length - 1]?.trim() || '';
  if (!lastLine) return false;
  return ACTION_REQUIRED_PATTERNS.some(re => re.test(lastLine));
}

// Track which terminals have broadcast terminal:ready (first data chunk)
const terminalReadySent = new Set<string>();
const readyTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

function armTerminalReadyFallback(id: string) {
  const timer = setTimeout(() => {
    if (!terminalReadySent.has(id)) {
      terminalReadySent.add(id);
      broadcast('terminal:ready', id);
    }
    readyTimeouts.delete(id);
  }, 3000);
  readyTimeouts.set(id, timer);
}

function clearTerminalReadyFallback(id: string) {
  const timer = readyTimeouts.get(id);
  if (timer) {
    clearTimeout(timer);
    readyTimeouts.delete(id);
  }
}

function clearAgentTimeout(terminalId: string) {
  const st = agentStates.get(terminalId);
  if (st?.timeoutHandle) {
    clearTimeout(st.timeoutHandle);
    st.timeoutHandle = undefined;
  }
}

// Error patterns for diagnoseAgentFailure
const ERROR_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  { re: /is not recognized as (?:the name of )?a?\s*cmdlet/i, reason: 'not-recognized' },
  { re: /command not found/i, reason: 'not-recognized' },
  { re: /No such file or directory/i, reason: 'not-recognized' },
];

function diagnoseAgentFailure(id: string, agentType: string) {
  const st = agentStates.get(id);
  const tail = stripAnsi((st?.dataBuffer ?? '')).slice(-500);
  const cfg = getAgentConfig(agentType);

  for (const { re, reason } of ERROR_PATTERNS) {
    if (re.test(tail)) return { reason, detail: tail.trim(), hint: cfg.installHint };
  }
  const lastLine = tail.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).pop() ?? '';
  if (looksLikeShell(lastLine)) {
    return { reason: 'dropped-to-shell', detail: `Terminal is at a shell prompt: "${lastLine}"`, hint: cfg.installHint };
  }
  return { reason: 'silent-timeout', detail: tail.trim() || 'No output captured.', hint: cfg.installHint };
}

function startAgentTimeout(id: string, agentType: string) {
  const st = agentStates.get(id);
  if (!st) return;
  const timer = setTimeout(() => {
    if (agentStates.get(id)?.phase !== 'launching') return;
    const diag = diagnoseAgentFailure(id, agentType);
    for (const win of electron_1.BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        try { win.webContents.send('agent:timeout', { terminalId: id, agentType }); } catch {}
        try { win.webContents.send('agent:init-error', { terminalId: id, agentType, ...diag }); } catch {}
      }
    }
    failPendingWrites(id);
  }, 30000);
  st.timeoutHandle = timer;
}

// Broadcast helper — send to all windows with disposal-safe pattern
function broadcast(event: string, ...args: any[]) {
  for (const win of electron_1.BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      try { win.webContents.send(event, ...args); } catch {}
    }
  }
}

// Retry agent init — re-sends agent:ready for a terminal that timed out
electron_1.ipcMain.handle('retry-agent-init', async (_event, terminalId: string, agentType: string) => {
  try {
    const { BrowserWindow } = require('electron');
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('agent:ready', { terminalId });
      }
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Per-terminal accumulated output between prompts (for action/metadata parsing)
const terminalResponseBuffers = new Map<string, string>();

// Parse agent output for ## Session Metadata and ## Actions blocks
function parseTerminalOutput(terminalId: string, output: string) {
    if (!db || !output || !output.trim()) return;
    try {
        const sessionRow = db.prepare('SELECT id, project_id FROM terminal_sessions WHERE terminal_id = ? ORDER BY created_at DESC LIMIT 1').get(terminalId) as any;
        if (!sessionRow) return;
        const sessionId = sessionRow.id;
        const actor = 'ai:terminal';

        // Parse session metadata
        const meta = parseSessionMetadata(output);
        if (meta) {
            const missingFields: string[] = [];
            const updates: string[] = [];
            const params: any[] = [];
            if (meta.title) { updates.push('topic = ?'); params.push(meta.title); }
            else missingFields.push('title');
            if (meta.description) { updates.push('description = ?'); params.push(meta.description); }
            if (meta.status) { updates.push('status = ?'); params.push(meta.status); }
            else missingFields.push('status');
            if (meta.productArea) { updates.push('product_area = ?'); params.push(meta.productArea); }
            if (meta.category) { updates.push('category = ?'); params.push(meta.category); }
            else missingFields.push('category');

            // Validate: emit feedback if critical fields missing
            if (missingFields.length > 0) {
                const feedback = `[SYSTEM: Session metadata incomplete — missing: ${missingFields.join(', ')}. Expected format: title, status, category, productArea, description. Please re-emit the block with all fields.]`;
                try { terminalManager.write(terminalId, feedback + '\r\n'); } catch {}
            }
            if (meta.category) { updates.push('category_confirmed = 1'); }
            if (updates.length > 0) {
                params.push(sessionId);
                db.prepare(`UPDATE terminal_sessions SET ${updates.join(', ')} WHERE id = ?`).run(...params);
                const tags: string[] = [];
                if (meta.category) tags.push(`category:${meta.category}`);
                if (meta.status) tags.push(`status:${meta.status}`);
                if (meta.productArea) tags.push(`area:${meta.productArea}`);
                if (tags.length > 0) {
                    db.prepare('UPDATE terminal_sessions SET auto_tags = ? WHERE id = ?').run(JSON.stringify(tags), sessionId);
                }
                const { BrowserWindow } = require('electron');
                const windows = BrowserWindow.getAllWindows();
                for (const win of windows) {
                    if (!win.isDestroyed()) {
                        win.webContents.send('session-metadata-updated', { sessionId, metadata: meta, autoTags: tags });
                    }
                }
            }
        }

        // Parse and execute actions
        parseAndExecuteActions(output, sessionId, actor, terminalId);

        // Collaborative Debug — BUG-OWNER pattern detection
        const bugOwnerRegex = /BUG-OWNER:\s*(yes|no)\s*(?:-?\s*reason:\s*(.+?))?\s*(?:-?\s*session:\s*(\S+))?/i;
        const bugOwnerMatch = output.match(bugOwnerRegex);
        if (bugOwnerMatch) {
            handleBugOwnerResponse({
                terminalId,
                sessionId,
                agent: actor,
                response: bugOwnerMatch[1].toLowerCase() as 'yes' | 'no',
                reason: bugOwnerMatch[2]?.trim(),
                claimedSessionId: bugOwnerMatch[3]?.trim(),
            });
        }
    } catch (e) {
        console.error('[Terminal] parseTerminalOutput error:', e);
    }
}

// ── Collaborative Debug — Bug Owner Response Handler ──
const activeBugDispatches = new Map<string, { bugReportId: string; terminalIds: Set<string> }>();

function handleBugOwnerResponse(response: {
    terminalId: string;
    sessionId: string;
    agent: string;
    response: 'yes' | 'no';
    reason?: string;
    claimedSessionId?: string;
}) {
    if (!db) return;
    try {
        // Find the most recent pending bug report that this terminal was dispatched to
        const pending = db.prepare("SELECT * FROM bug_reports WHERE status = 'pending' ORDER BY created_at DESC LIMIT 5").all() as any[];
        let target: any = null;
        for (const p of pending) {
            const responses: any[] = JSON.parse(p.agent_responses || '[]');
            if (!responses.find((r: any) => r.terminalId === response.terminalId)) {
                target = p;
                break;
            }
        }
        if (!target) return;

        const responses: any[] = JSON.parse(target.agent_responses || '[]');
        const entry = {
            terminalId: response.terminalId,
            sessionId: response.sessionId,
            agent: response.agent,
            response: response.response,
            reason: response.reason || '',
            respondedAt: new Date().toISOString(),
        };
        responses.push(entry);
        db.prepare('UPDATE bug_reports SET agent_responses = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(JSON.stringify(responses), target.id);

        if (response.response === 'yes' && response.reason) {
            // Auto-create a Problem
            try {
                const { BrowserWindow } = require('electron');
                const windows = BrowserWindow.getAllWindows();
                const projectRow = db.prepare('SELECT project_id FROM terminal_sessions WHERE id = ?').get(response.sessionId) as any;
                const projectId = projectRow?.project_id;
                const projectPath = projectId ? getProjectPath(projectId) : undefined;

                const ProblemsServiceModule = require('./services/ProblemsService.cjs');
                const ProblemsService = ProblemsServiceModule.ProblemsService || ProblemsServiceModule;
                const ps = new ProblemsService(projectPath || '', projectId);
                const problem = ps.createProblem({
                    title: `[Auto] ${response.agent}: ${response.reason}`,
                    description: (target as any).error_text || response.reason,
                    category: 'bug',
                    priority: 'medium',
                });

                db.prepare("UPDATE bug_reports SET linked_problem_id = ?, status = 'identified', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(String(problem.id), target.id);

                for (const win of windows) {
                    if (!win.isDestroyed()) {
                        win.webContents.send('context-changed', { type: 'problem', action: 'created', entity: { id: String(problem.id), title: problem.title, status: problem.status } });
                        win.webContents.send('context-changed', { type: 'bug_report', action: 'updated', entity: { id: target.id, status: 'identified', linkedProblemId: String(problem.id) } });
                    }
                }

                // Notify the claiming agent
                try { terminalManager.write(response.terminalId, `[System] Your BUG-OWNER claim has been registered. Linked Problem: #${problem.id}.\n`); } catch {}
            } catch (e2) {
                console.error('[BugReport] Failed to auto-create problem:', e2);
            }
        }

        // Check if all dispatched terminals have responded
        const allSessions = db.prepare("SELECT terminal_id FROM terminal_sessions WHERE project_id = ? AND terminal_id IS NOT NULL").all((target as any).project_id) as any[];
        const allResponded = allSessions.every((s: any) =>
            responses.some((r: any) => r.terminalId === s.terminal_id)
        );
        if (allResponded) {
            const anyYes = responses.some((r: any) => r.response === 'yes');
            const newStatus = anyYes ? 'identified' : 'not_my_issue';
            db.prepare('UPDATE bug_reports SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, target.id);
        }
    } catch (e) {
        console.error('[BugReport] handleBugOwnerResponse error:', e);
    }
}

// ── AI Task Completion Tracking ──
const pendingCompletions = new Set<string>();

function markTaskCompleted(terminalId: string) {
    if (!db) return;
    try {
        const { BrowserWindow } = require('electron');
        const sid = getSessionIdForTerminal(terminalId);
        if (!sid) return;
        const row = db.prepare('SELECT id FROM terminal_messages WHERE session_id = ? AND status = ? ORDER BY created_at ASC LIMIT 1').get(sid, 'in_progress') as any;
        if (row) {
            db.prepare(`UPDATE terminal_messages SET status = 'completed' WHERE id = ?`).run(row.id);
            const windows = BrowserWindow.getAllWindows();
            for (const win of windows) {
                if (!win.isDestroyed()) {
                    win.webContents.send('ai-task:updated', { terminalId, messageId: row.id, status: 'completed' });
                }
            }
        }
    } catch (_e) { /* silent */ }
}

// Inline node-pty based TerminalManager
const terminalManager = {
  terminals: new Map(),
  intentionalKills: new Set<string>(),
  spawnTimes: new Map<string, number>(),
  spawn(id: string, cwd: string, cols: number = 80, rows: number = 24) {
    try {
      console.log('[TerminalManager] spawn called:', id, 'cwd:', cwd, 'has:', this.terminals.has(id), 'existing keys:', Array.from(this.terminals.keys()));
      if (this.terminals.has(id)) {
        console.log('[TerminalManager] DEDUPE KILL for:', id);
        this.kill(id);
      }
      const os = require('os');
      const fs = require('fs');
      const pty = require('node-pty');
      const shell = process.platform === 'win32' ? (process.env.COMSPEC || 'powershell.exe') : (process.env.SHELL || '/bin/bash');
      let workingDir = cwd && cwd.length > 0 ? cwd : os.homedir();
      try { if (!fs.existsSync(workingDir)) { workingDir = os.homedir(); } } catch {}
      console.log('[TerminalManager] spawning shell:', shell, 'in', workingDir);
      const proc = pty.spawn(shell, [], { name: 'xterm-256color', cols, rows, cwd: workingDir, env: process.env });
      this.spawnTimes.set(id, Date.now());
      console.log('[TerminalManager] PTY spawned, pid:', proc.pid);
      const ip: any = {
        write: (data: string) => proc.write(data),
        resize: (c: number, r: number) => proc.resize(c, r),
        kill: () => proc.kill(),
        onData: (cb: (d: string) => void) => proc.onData(cb),
        onExit: (cb: (code: number, sig: string) => void) => proc.onExit(cb),
      };
      this.terminals.set(id, { id, pty: ip, cwd });
      console.log('[TerminalManager] terminal stored:', id, 'total terminals:', this.terminals.size);
      return { success: true };
    } catch (err: any) {
      console.error('[TerminalManager] Spawn error:', err.message);
      return { success: false, error: err.message };
    }
  },
  write(id: string, data: string) {
    const t = this.terminals.get(id);
    if (t) { t.pty.write(data); return true; }
    return false;
  },
  resize(id: string, cols: number, rows: number) {
    const t = this.terminals.get(id);
    if (t) { t.pty.resize(cols, rows); return true; }
    return false;
  },
  kill(id: string) {
    const t = this.terminals.get(id);
    if (t) { console.log('[TerminalManager] KILL:', id); this.intentionalKills.add(id); this.spawnTimes.delete(id); try { t.pty.kill(); } catch {} this.terminals.delete(id); terminalMessageCounts.delete(id); releaseAllLocksForTerminal(id); clearTerminalReadyFallback(id); terminalReadySent.delete(id); return true; }
    console.log('[TerminalManager] KILL: no terminal for', id);
    return false;
  },
  getDataHandler(id: string, cb: (d: string) => void) {
    const t = this.terminals.get(id);
    if (t) t.pty.onData(cb);
  },
  getExitHandler(id: string, cb: (code: number, sig: string) => void) {
    const t = this.terminals.get(id);
    if (t) t.pty.onExit((result) => cb(result.exitCode, result.signal?.toString() ?? ''));
  }
};

// ── File Lock Manager (cross-session conflict detection) ─────────
const LOCK_TTL_MS = 60000;
const fileLocks = new Map<string, { terminalId: string; sessionId: string | null; timestamp: number; action: string }>();

function acquireLock(filePath: string, terminalId: string, sessionId: string | null, action: string = 'edit'): { acquired: boolean; heldBy?: string } {
  const existing = fileLocks.get(filePath);
  if (existing) {
    if (existing.terminalId === terminalId) return { acquired: true }; // same terminal = re-lock
    if (Date.now() - existing.timestamp > LOCK_TTL_MS) { // expired
      fileLocks.delete(filePath);
    } else {
      return { acquired: false, heldBy: existing.terminalId };
    }
  }
  fileLocks.set(filePath, { terminalId, sessionId, timestamp: Date.now(), action });
  return { acquired: true };
}

function releaseLock(filePath: string, terminalId: string): boolean {
  const existing = fileLocks.get(filePath);
  if (existing && existing.terminalId === terminalId) {
    fileLocks.delete(filePath);
    return true;
  }
  return false;
}

function releaseAllLocksForTerminal(terminalId: string): void {
  for (const [path, lock] of fileLocks) {
    if (lock.terminalId === terminalId) fileLocks.delete(path);
  }
}

function getLocksForFile(filePath: string): { terminalId: string; sessionId: string | null; timestamp: number; action: string } | undefined {
  const lock = fileLocks.get(filePath);
  if (lock && Date.now() - lock.timestamp > LOCK_TTL_MS) {
    fileLocks.delete(filePath);
    return undefined;
  }
  return lock;
}

function getAllLocks(): Array<{ filePath: string; terminalId: string; sessionId: string | null; timestamp: number; action: string }> {
  const now = Date.now();
  for (const [path, lock] of fileLocks) {
    if (now - lock.timestamp > LOCK_TTL_MS) fileLocks.delete(path);
  }
  return Array.from(fileLocks.entries()).map(([filePath, lock]) => ({ filePath, ...lock }));
}

// Periodic lock sweep
setInterval(() => {
  const now = Date.now();
  for (const [path, lock] of fileLocks) {
    if (now - lock.timestamp > LOCK_TTL_MS) fileLocks.delete(path);
  }
}, LOCK_TTL_MS);

// ── File edit detection ──────────────────────────────────────────
function detectEditsInOutput(terminalId: string, output: string) {
  if (!output || output.trim().length < 20) return;

  // Look up session_id from DB
  let sessionId: string | null = null;
  if (db) {
    try {
      const binding = db.prepare('SELECT session_id FROM terminal_bindings WHERE terminal_id = ?').get(terminalId) as any;
      sessionId = binding?.session_id || null;
    } catch {}
  }

  // Look for file write patterns in agent output
  const filePattern = /(?:wrote|saved|written|modified|created|updated|writes? to|edits?)\s+`?(?:\.\/)?([^\s`'"()]+\.[a-zA-Z]+)/gi;
  let match: RegExpExecArray | null;
  const seen = new Set<string>();

  while ((match = filePattern.exec(output)) !== null) {
    let filePath = match[1].replace(/[`'"]/g, '').trim();
    if (!filePath || filePath.length > 200 || seen.has(filePath)) continue;
    seen.add(filePath);

    const result = acquireLock(filePath, terminalId, sessionId);
    if (db) {
      try {
        db.prepare('INSERT INTO touched_files (terminal_id, session_id, file_path, action) VALUES (?, ?, ?, ?)')
          .run(terminalId, sessionId, filePath, result.acquired ? 'edit' : 'conflict');
      } catch {}
    }
    if (!result.acquired && result.heldBy) {
      const windows = require('electron').BrowserWindow.getAllWindows();
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send('file:conflict', {
            filePath,
            requestingTerminal: terminalId,
            lockingTerminal: result.heldBy,
            sessionId,
            timestamp: Date.now(),
          });
        }
      }
    }
  }
}

electron_1.ipcMain.handle('terminal:create', async (_event, id: string, cwd: string, cols: number, rows: number, agentType?: string) => {
    try {
        const result = terminalManager.spawn(id, cwd, cols, rows);
        if (result.success) {
            const type = agentType || DEFAULT_AGENT;
            clearAgentTimeout(id);
            agentStates.set(id, { agentType: type, phase: 'launching', dataBuffer: '', idleSeq: 0 });
            startAgentTimeout(id, type);
            armTerminalReadyFallback(id);

            terminalManager.getDataHandler(id, function (data) {
                if (!terminalReadySent.has(id)) {
                    terminalReadySent.add(id);
                    clearTerminalReadyFallback(id);
                    broadcast('terminal:ready', id);
                }
                broadcast('terminal:data', id, data);
                try {
                    if (db) {
                        const sid = (db.prepare('SELECT id FROM terminal_sessions WHERE terminal_id = ? ORDER BY created_at DESC LIMIT 1').get(id) as any)?.id;
                        if (sid) {
                            db.prepare('INSERT INTO terminal_messages (session_id, role, content) VALUES (?, ?, ?)').run(sid, 'assistant', data);
                        }
                    }
                } catch (_e) { }

                const st = agentStates.get(id);
                if (!st) return;
                st.dataBuffer += data;
                if (st.dataBuffer.length > 10000) st.dataBuffer = st.dataBuffer.slice(-5000);

                // Accumulate agent output for parsing (only after ready)
                if (st.phase === 'ready' || st.phase === 'busy') {
                    const buf = terminalResponseBuffers.get(id) || '';
                    terminalResponseBuffers.set(id, buf + data);
                }

                const handshakeSeen = st.handshakeToken ? stripAnsi(st.dataBuffer).includes(st.handshakeToken) : false;
                const promptSeen = detectAgentPrompt(st.dataBuffer, st.agentType);
                const actionRequired = detectActionRequired(st.dataBuffer);

                function isAgentReady(): boolean {
                    const cfg = getAgentConfig(st.agentType);
                    if (cfg.bracketedPaste) return promptSeen || handshakeSeen;
                    return promptSeen && handshakeSeen;
                }
                if (st.phase === 'launching' && isAgentReady()) {
                    st.phase = 'ready';
                    clearAgentTimeout(id);
                    if (st.pendingWrites && st.pendingWrites.length > 0) {
                        for (const w of st.pendingWrites) {
                            terminalManager.write(id, w);
                        }
                        st.pendingWrites = [];
                    }
                    broadcast('agent:ready', { terminalId: id });
                } else if ((st.phase === 'busy' || st.phase === 'attention') && promptSeen) {
                    st.phase = 'ready';
                    st.idleSeq += 1;
                    if (st.pendingWrites && st.pendingWrites.length > 0) {
                        for (const w of st.pendingWrites) {
                            terminalManager.write(id, w);
                        }
                        st.pendingWrites = [];
                    }
                    broadcast('agent:idle', { terminalId: id, seq: st.idleSeq });
                    broadcast('ai-task:updated', { terminalId: id, status: 'completed' });
                } else if (st.phase === 'busy' && actionRequired) {
                    st.phase = 'attention';
                    broadcast('ai-task:updated', { terminalId: id, status: 'action_required' });
                } else if (st.phase === 'attention' && !actionRequired && data.length > 0) {
                    st.phase = 'busy';
                    broadcast('ai-task:updated', { terminalId: id, status: 'in_progress' });
                }

                if ((st.phase === 'ready' || st.phase === 'busy') && promptSeen) {
                    const output = terminalResponseBuffers.get(id) || '';
                    terminalResponseBuffers.set(id, '');
                    if (output.trim().length > 20) {
                        parseTerminalOutput(id, output);
                    }
                    detectEditsInOutput(id, output);
                }

                if ((st.phase === 'ready' || st.phase === 'busy') && pendingCompletions.has(id) && promptSeen) {
                    pendingCompletions.delete(id);
                    markTaskCompleted(id);
                }
            });

            terminalManager.getExitHandler(id, (exitCode: number, signal: string) => {
                clearAgentTimeout(id);
                failPendingWrites(id);
                const intentional = terminalManager.intentionalKills.has(id);
                const spawnTime = terminalManager.spawnTimes.get(id);
                const isRecentSpawn = spawnTime && (Date.now() - spawnTime < 2000);
                terminalManager.spawnTimes.delete(id);
                broadcast('terminal:exit', id, exitCode, signal, intentional || !!isRecentSpawn);
            });
        }
        return result;
    } catch (err: any) {
        console.error('[DeskFlow] terminal:create error:', err.message);
        return { success: false, error: err.message };
    }
});

electron_1.ipcMain.handle('spawn-terminal', async (_event, id: string, cwd?: string, agentType?: string) => {
    try {
        const result = terminalManager.spawn(id, cwd || '', 80, 24);
        if (result.success) {
            const type = agentType || DEFAULT_AGENT;
            clearAgentTimeout(id);
            agentStates.set(id, { agentType: type, phase: 'launching', dataBuffer: '', idleSeq: 0 });
            startAgentTimeout(id, type);
            armTerminalReadyFallback(id);

            terminalManager.getDataHandler(id, function (data) {
                console.log('[TERMINAL_DEBUG] C2 data callback FIRED for', id, 'data length:', data.length, 'data:', JSON.stringify(data.substring(0, 200)));
                if (!terminalReadySent.has(id)) {
                    terminalReadySent.add(id);
                    clearTerminalReadyFallback(id);
                    broadcast('terminal:ready', id);
                }
                broadcast('terminal:data', id, data);
                try {
                    if (db) {
                        const sid = (db.prepare('SELECT id FROM terminal_sessions WHERE terminal_id = ? ORDER BY created_at DESC LIMIT 1').get(id) as any)?.id;
                        if (sid) {
                            db.prepare('INSERT INTO terminal_messages (session_id, role, content) VALUES (?, ?, ?)').run(sid, 'assistant', data);
                        }
                    }
                } catch (_e) { }

                const st = agentStates.get(id);
                if (!st) return;
                st.dataBuffer += data;
                if (st.dataBuffer.length > 10000) st.dataBuffer = st.dataBuffer.slice(-5000);

                if (st.phase === 'ready' || st.phase === 'busy') {
                    const buf = terminalResponseBuffers.get(id) || '';
                    terminalResponseBuffers.set(id, buf + data);
                }

                const handshakeSeen = st.handshakeToken ? stripAnsi(st.dataBuffer).includes(st.handshakeToken) : false;
                const promptSeen = detectAgentPrompt(st.dataBuffer, st.agentType);
                const actionRequired = detectActionRequired(st.dataBuffer);

                function isAgentReady(): boolean {
                    const cfg = getAgentConfig(st.agentType);
                    if (cfg.bracketedPaste) return promptSeen || handshakeSeen;
                    return promptSeen && handshakeSeen;
                }
                if (st.phase === 'launching' && isAgentReady()) {
                    st.phase = 'ready';
                    clearAgentTimeout(id);
                    if (st.pendingWrites && st.pendingWrites.length > 0) {
                        for (const w of st.pendingWrites) {
                            terminalManager.write(id, w);
                        }
                        st.pendingWrites = [];
                    }
                    broadcast('agent:ready', { terminalId: id });
                } else if ((st.phase === 'busy' || st.phase === 'attention') && promptSeen) {
                    st.phase = 'ready';
                    st.idleSeq += 1;
                    if (st.pendingWrites && st.pendingWrites.length > 0) {
                        for (const w of st.pendingWrites) {
                            terminalManager.write(id, w);
                        }
                        st.pendingWrites = [];
                    }
                    broadcast('agent:idle', { terminalId: id, seq: st.idleSeq });
                    broadcast('ai-task:updated', { terminalId: id, status: 'completed' });
                } else if (st.phase === 'busy' && actionRequired) {
                    st.phase = 'attention';
                    broadcast('ai-task:updated', { terminalId: id, status: 'action_required' });
                } else if (st.phase === 'attention' && !actionRequired && data.length > 0) {
                    st.phase = 'busy';
                    broadcast('ai-task:updated', { terminalId: id, status: 'in_progress' });
                }

                if ((st.phase === 'ready' || st.phase === 'busy') && promptSeen) {
                    const output = terminalResponseBuffers.get(id) || '';
                    terminalResponseBuffers.set(id, '');
                    if (output.trim().length > 20) {
                        parseTerminalOutput(id, output);
                    }
                    detectEditsInOutput(id, output);
                }

                if ((st.phase === 'ready' || st.phase === 'busy') && pendingCompletions.has(id) && promptSeen) {
                    pendingCompletions.delete(id);
                    markTaskCompleted(id);
                }
            });

            terminalManager.getExitHandler(id, (exitCode: number, signal: string) => {
                clearAgentTimeout(id);
                failPendingWrites(id);
                const intentional = terminalManager.intentionalKills.has(id);
                const spawnTime = terminalManager.spawnTimes.get(id);
                const isRecentSpawn = spawnTime && (Date.now() - spawnTime < 2000);
                terminalManager.spawnTimes.delete(id);
                broadcast('terminal:exit', id, exitCode, signal, intentional || !!isRecentSpawn);
            });
        }
        return result;
    } catch (err: any) {
        console.error('[DeskFlow] spawn-terminal error:', err.message);
        return { success: false, error: err.message };
    }
});

electron_1.ipcMain.handle('agent:verify', async (_event, agentType: string) => {
    const result = await verifyAgent(agentType);
    return result;
});

electron_1.ipcMain.handle('agent:arm-handshake', async (_event, terminalId: string) => {
    const st = agentStates.get(terminalId);
    if (!st) return { success: false, error: 'Agent session not found' };
    const token = `__HANDSHAKE_${Date.now()}_${Math.random().toString(36).slice(2, 8)}__`;
    st.handshakeToken = token;
    const bp = getAgentConfig(st.agentType).bracketedPaste;
    return { success: true, token, bracketedPaste: bp };
});

electron_1.ipcMain.handle('agent:send', async (_event, terminalId: string, data: string, agentType?: string) => {
    const st = agentStates.get(terminalId);
    if (!st) {
        return { success: false, error: 'Agent session not found' };
    }
    const type = agentType || DEFAULT_AGENT;
    const recordPrompt = () => {
        if (!db || !data || data.trim().length < 1) return undefined;
        try {
            const sid = getSessionIdForTerminal(terminalId);
            if (!sid) return undefined;
            pendingCompletions.add(terminalId);
            return db.prepare('INSERT INTO terminal_messages (session_id, role, content, status) VALUES (?, ?, ?, ?)').run(sid, 'user', data, 'in_progress');
        } catch (_e) { return undefined; }
    };
    const notifyTask = (messageId: number | bigint | undefined) => {
        try {
            const { BrowserWindow } = require('electron');
            const windows = BrowserWindow.getAllWindows();
            for (const win of windows) {
                if (!win.isDestroyed()) {
                    try {
                        win.webContents.send('ai-task:updated', { terminalId, status: 'in_progress', messageId });
                    } catch (e) { /* silent */ }
                }
            }
        } catch (_e) { /* silent */ }
    };

    if (st.phase === 'launching' || st.phase === 'busy') {
        st.pendingWrites = st.pendingWrites || [];
        st.pendingWrites.push(data);
        const result = recordPrompt();
        if (result) notifyTask(result.lastInsertRowid);
        return { success: true, queued: true };
    }
    const success = terminalManager.write(terminalId, data + '\r\n');
    if (success) {
        st.phase = 'busy';
        const result = recordPrompt();
        if (result) notifyTask(result.lastInsertRowid);
    }
    return { success, queued: false };
});

electron_1.ipcMain.handle('agent:get-phase', async (_event, terminalId: string) => {
    const st = agentStates.get(terminalId);
    return st ? st.phase : 'unknown';
});

electron_1.ipcMain.handle('agent:start-timeout', async (_event, terminalId: string, agentType: string) => {
    startAgentTimeout(terminalId, agentType);
    return { success: true };
});

electron_1.ipcMain.handle('agent:retry-launch', async (_event, terminalId: string, agentType: string) => {
    const st = agentStates.get(terminalId);
    if (st) {
        const type = agentType || DEFAULT_AGENT;
        st.phase = 'launching';
        st.dataBuffer = '';
        st.handshakeToken = undefined;
        st.pendingWrites = [];
        clearAgentTimeout(terminalId);
        startAgentTimeout(terminalId, type);
    }
    return { success: true };
});

electron_1.ipcMain.handle('terminal:write-raw', async (_event, terminalId: string, data: string) => {
    const success = terminalManager.write(terminalId, data);
    return { success };
});

electron_1.ipcMain.handle('terminal:write-display', async (_event, terminalId: string, data: string) => {
    broadcast('terminal:data', terminalId, data);
    return { success: true };
});

electron_1.ipcMain.handle('capture-opencode-session-id', async (_event, workspaceDir: string, sinceTimestamp?: number) => {
    try {
        const homedir = require('os').homedir();
        const dbPath = path_1.default.join(homedir, '.local', 'share', 'opencode', 'opencode.db');
        if (!fs_1.default.existsSync(dbPath)) {
            return { success: false, sessionId: null, source: 'generated', reason: 'opencode db not found at ' + dbPath };
        }
        const Database = require('better-sqlite3');
        const odb = new Database(dbPath, { readonly: true });
        try {
            let row;
            if (sinceTimestamp) {
                const sinceISO = new Date(sinceTimestamp).toISOString();
                row = odb.prepare('SELECT id FROM session WHERE directory = ? AND time_created >= ? ORDER BY time_created DESC LIMIT 1').get(workspaceDir, sinceISO);
            } else {
                row = odb.prepare('SELECT id FROM session WHERE directory = ? ORDER BY time_created DESC LIMIT 1').get(workspaceDir);
            }
            odb.close();
            if (row && row.id) {
                return { success: true, sessionId: row.id, source: 'db' };
            }
            return { success: false, sessionId: null, source: 'generated', reason: 'no session for directory ' + workspaceDir };
        }
        catch (e) {
            odb.close();
            return { success: false, sessionId: null, source: 'generated', reason: String(e) };
        }
    }
    catch (err) {
        return { success: false, sessionId: null, source: 'generated', error: String(err) };
    }
});

electron_1.ipcMain.handle('write-terminal', async (_event, terminalId: string, data: string) => {
    // T1.4-A: Auto re-injection — prepend rules reminder every N user messages
    if (data && data.trim()) {
      const count = (terminalMessageCounts.get(terminalId) || 0) + 1;
      terminalMessageCounts.set(terminalId, count);
      const reinjectThreshold = runtimeReinjectThreshold ?? RULES_REINJECT_THRESHOLD;
      if (count % reinjectThreshold === 0) {
        maybeReinjectRules(terminalId);
      }
    }
    const success = terminalManager.write(terminalId, data);
    if (success && db && data && data.trim()) {
        try {
            const sid = getSessionIdForTerminal(terminalId);
            if (sid) {
                pendingCompletions.add(terminalId);
                const result = db.prepare('INSERT INTO terminal_messages (session_id, role, content, status) VALUES (?, ?, ?, ?)').run(sid, 'user', data, 'in_progress');
                const { BrowserWindow } = require('electron');
                const windows = BrowserWindow.getAllWindows();
                for (const win of windows) {
                    if (!win.isDestroyed()) {
                        try {
                            win.webContents.send('ai-task:updated', { terminalId, status: 'in_progress', messageId: result.lastInsertRowid });
                        } catch (e) { /* silent */ }
                    }
                }
            }
        } catch (_e) { /* silent */ }
    }
    if (!success) {
        return { success: false, error: `Terminal "${terminalId}" not found or not spawned. Total terminals: ${terminalManager.terminals.size}` };
    }
    return { success };
});

electron_1.ipcMain.handle('resize-terminal', async (_event, terminalId: string, cols: number, rows: number) => {
    const success = terminalManager.resize(terminalId, cols, rows);
    return { success };
});

// ── Collaborative Debugging — Bug Report IPC Handlers ──

electron_1.ipcMain.handle('bug-report:submit', async (_, data: { projectId: string; title?: string; errorText: string }) => {
    if (!db) return { success: false, error: 'No database' };
    try {
        const id = `br-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        db.prepare(`
            INSERT INTO bug_reports (id, project_id, title, error_text, status, flow_type)
            VALUES (?, ?, ?, ?, 'pending', 'manual')
        `).run(id, data.projectId, data.title || '', data.errorText);

        // Dispatch to all terminal sessions for this project
        const sessions = db.prepare('SELECT id, terminal_id, agent FROM terminal_sessions WHERE project_id = ? AND terminal_id IS NOT NULL').all(data.projectId) as any[];
        const dispatchMessage = `[System — Collaborative Debug #${id}]\nAn error was reported in project "${data.projectId}". Error details:\n${data.errorText}\n\nPlease determine if YOUR PREVIOUS WORK caused this issue.\n- If YES, respond with exactly: BUG-OWNER: yes - reason: <brief reason> - session: <your session ID>\n- If NO, respond with exactly: BUG-OWNER: no\n- If YES, also create a Problem entry via your ## Actions block.\n`;

        for (const s of sessions) {
            if (s.terminal_id) {
                try { terminalManager.write(s.terminal_id, dispatchMessage); } catch {}
            }
        }

        // Fire context-changed
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('context-changed', { type: 'bug_report', action: 'created', entity: { id, status: 'pending' } });
        }

        return { success: true, id };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
});

electron_1.ipcMain.handle('bug-report:list', async (_, data: { projectId: string }) => {
    if (!db) return { success: false, data: [] };
    try {
        const rows = db.prepare('SELECT * FROM bug_reports WHERE project_id = ? ORDER BY created_at DESC').all(data.projectId) as any[];
        const reports = rows.map((r: any) => ({
            id: r.id,
            projectId: r.project_id,
            title: r.title,
            errorText: r.error_text,
            status: r.status,
            agentResponses: JSON.parse(r.agent_responses || '[]'),
            linkedProblemId: r.linked_problem_id,
            flowType: r.flow_type,
            rootCauseReport: r.root_cause_report ? JSON.parse(r.root_cause_report) : undefined,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
        }));
        return { success: true, data: reports };
    } catch (err: any) {
        return { success: false, data: [], error: err.message };
    }
});

electron_1.ipcMain.handle('bug-report:get', async (_, data: { id: string }) => {
    if (!db) return { success: false, data: null };
    try {
        const r = db.prepare('SELECT * FROM bug_reports WHERE id = ?').get(data.id) as any;
        if (!r) return { success: true, data: null };
        return {
            success: true,
            data: {
                id: r.id,
                projectId: r.project_id,
                title: r.title,
                errorText: r.error_text,
                status: r.status,
                agentResponses: JSON.parse(r.agent_responses || '[]'),
                linkedProblemId: r.linked_problem_id,
                flowType: r.flow_type,
                rootCauseReport: r.root_cause_report ? JSON.parse(r.root_cause_report) : undefined,
                createdAt: r.created_at,
                updatedAt: r.updated_at,
            },
        };
    } catch (err: any) {
        return { success: false, data: null, error: err.message };
    }
});

electron_1.ipcMain.handle('bug-report:auto-consult', async (_, data: { problemId: string; problemTitle: string; problemDescription: string; projectId?: string }) => {
    if (!db) return { success: false, error: 'No database' };
    try {
        const id = `br-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        db.prepare(`
            INSERT INTO bug_reports (id, project_id, title, error_text, status, flow_type, linked_problem_id)
            VALUES (?, ?, ?, ?, 'pending', 'auto-consult', ?)
        `).run(id, data.projectId || '', `Auto-consult: ${data.problemTitle}`, data.problemDescription, data.problemId);

        // Query all sessions EXCEPT the assigned one
        const sessions = db.prepare('SELECT id, terminal_id, agent FROM terminal_sessions WHERE project_id = ? AND terminal_id IS NOT NULL').all(data.projectId || '') as any[];
        const consultMessage = `[System — Collaborative Debug #${id}]\nAgent has been assigned Problem #${data.problemId}: "${data.problemTitle}"\n${data.problemDescription}\n\nDid YOUR PREVIOUS WORK contribute to this issue?\n- If YES: BUG-OWNER: yes - reason: <reason> - session: <your session ID>\n- If NO: BUG-OWNER: no\n`;

        for (const s of sessions) {
            if (s.terminal_id) {
                try { terminalManager.write(s.terminal_id, consultMessage); } catch {}
            }
        }

        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('context-changed', { type: 'bug_report', action: 'created', entity: { id, status: 'pending', flowType: 'auto-consult' } });
        }

        return { success: true, bugReportId: id };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
});

electron_1.ipcMain.handle('bug-report:investigate', async (_, data: { bugReportId: string }) => {
    if (!db) return { success: false, error: 'No database' };
    try {
        const row = db.prepare('SELECT * FROM bug_reports WHERE id = ?').get(data.bugReportId) as any;
        if (!row) return { success: false, error: 'Bug report not found' };

        // Set status to investigating
        db.prepare("UPDATE bug_reports SET status = 'investigating', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(data.bugReportId);

        // Phase 1 — Gather evidence
        const projectId = row.project_id;
        const fileLocks: any[] = [];
        const syncLogs: any[] = [];
        const sessions = db.prepare('SELECT * FROM terminal_sessions WHERE project_id = ? ORDER BY created_at DESC').all(projectId) as any[];

        // Try to get file locks if table exists
        try { fileLocks.push(...db.prepare('SELECT * FROM file_locks WHERE project_id = ? ORDER BY created_at DESC LIMIT 200').all(projectId) as any[]); } catch {}

        // Parse stack trace for file paths
        const errorText = row.error_text || '';
        const stackFilePattern = /(?:at\s+|file:\/\/\/|\(|in\s+)([a-zA-Z]:[^\s:)]+\.\w+|[^\s:)]+\.\w+(?::\d+)?(?::\d+)?)/g;
        const mentionedFiles: string[] = [];
        let m;
        while ((m = stackFilePattern.exec(errorText)) !== null) {
            const f = m[1].split(':')[0].trim();
            if (f && !mentionedFiles.includes(f)) mentionedFiles.push(f);
        }

        // Phase 2 — Correlate
        const suspectSessions: Array<{ sessionId: string; agent: string; confidence: 'high' | 'medium' | 'low'; reasons: string[] }> = [];
        const timeline: Array<{ timestamp: string; event: string; sessionId?: string }> = [];

        for (const s of sessions) {
            const reasons: string[] = [];
            // Check file locks for this session
            const sessionLocks = fileLocks.filter((fl: any) => fl.session_id === s.id);
            for (const lock of sessionLocks) {
                timeline.push({ timestamp: lock.created_at || lock.timestamp || '', event: `File lock: ${lock.file_path || lock.file || ''}`, sessionId: s.id });
                if (mentionedFiles.some(f => (lock.file_path || lock.file || '').includes(f))) {
                    reasons.push(`Touched error-correlated file: ${lock.file_path || lock.file}`);
                }
            }
            if (reasons.length > 0) {
                suspectSessions.push({
                    sessionId: s.id,
                    agent: s.agent || 'unknown',
                    confidence: reasons.length >= 2 ? 'high' : 'medium',
                    reasons,
                });
            }
        }

        // Phase 3 — Build report
        const rootCauseReport = {
            suspectSessions,
            suspiciousFiles: mentionedFiles,
            timeline: timeline.sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
            suggestedApproach: suspectSessions.length > 0
                ? `Investigate sessions: ${suspectSessions.map((s: any) => s.agent).join(', ')}. They touched files correlated with the error.`
                : 'No sessions with direct file correlation found. Consider manual investigation or checking recent changes.',
        };

        const reportJson = JSON.stringify(rootCauseReport);
        const newStatus = suspectSessions.length > 0 ? 'identified' : 'not_my_issue';
        db.prepare('UPDATE bug_reports SET status = ?, root_cause_report = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, reportJson, data.bugReportId);

        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('context-changed', { type: 'bug_report', action: 'updated', entity: { id: data.bugReportId, status: newStatus } });
        }

        return {
            success: true,
            data: {
                id: row.id,
                projectId: row.project_id,
                title: row.title,
                errorText: row.error_text,
                status: newStatus,
                agentResponses: JSON.parse(row.agent_responses || '[]'),
                linkedProblemId: row.linked_problem_id,
                flowType: row.flow_type,
                rootCauseReport,
                createdAt: row.created_at,
                updatedAt: new Date().toISOString(),
            },
        };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
});

function getSessionIdForTerminal(terminalId: string): string | null {
    if (!db) return null;
    try {
        const binding = db.prepare('SELECT session_id FROM terminal_bindings WHERE terminal_id = ?').get(terminalId) as any;
        if (binding?.session_id) return binding.session_id;
        const session = db.prepare('SELECT id FROM terminal_sessions WHERE terminal_id = ? ORDER BY created_at DESC LIMIT 1').get(terminalId) as any;
        return session?.id || null;
    } catch (_e) {
        return null;
    }
}

function failPendingWrites(terminalId: string) {
    const st = agentStates.get(terminalId);
    if (db) {
        try {
            const sid = getSessionIdForTerminal(terminalId);
            if (sid) {
                const result = db.prepare('UPDATE terminal_messages SET status = ? WHERE session_id = ? AND status = ?')
                    .run('failed', sid, 'in_progress');
                if (result.changes > 0) {
                    broadcast('terminal:pending-failed', { terminalId, count: result.changes });
                }
            }
        } catch (_e) { /* silent */ }
    }
    if (st) {
        st.pendingWrites = [];
    }
}

electron_1.ipcMain.handle('kill-terminal', async (_event, terminalId: string) => {
    failPendingWrites(terminalId);
    const success = terminalManager.kill(terminalId);
    releaseAllLocksForTerminal(terminalId);
    return { success };
});

// Consolidated terminal API (wraps existing handler with single-arg objects)
electron_1.ipcMain.handle('terminal:write-old-format', async (_event, terminalId: string, data: string) => {
    const recordPrompt = () => {
        if (!db || !data || data.trim().length < 1) return undefined;
        try {
            const sid = getSessionIdForTerminal(terminalId);
            if (!sid) return undefined;
            pendingCompletions.add(terminalId);
            return db.prepare('INSERT INTO terminal_messages (session_id, role, content, status) VALUES (?, ?, ?, ?)').run(sid, 'user', data, 'in_progress');
        } catch (_e) { return undefined; }
    };
    const notifyTask = (messageId: number | bigint | undefined) => {
        try {
            const { BrowserWindow } = require('electron');
            const windows = BrowserWindow.getAllWindows();
            for (const win of windows) {
                if (!win.isDestroyed()) {
                    try {
                        win.webContents.send('ai-task:updated', { terminalId, status: 'in_progress', messageId });
                    } catch (e) { /* silent */ }
                }
            }
        } catch (_e) { /* silent */ }
    };

    const ast = agentStates.get(terminalId);
    if (ast && (ast.phase === 'launching' || ast.phase === 'busy')) {
        ast.pendingWrites = ast.pendingWrites || [];
        ast.pendingWrites.push(data);
        const result = recordPrompt();
        if (result) notifyTask(result.lastInsertRowid);
        return { success: true, queued: true };
    }
    const success = terminalManager.write(terminalId, data);
    if (success && data && data.trim().length >= 1) {
        const result = recordPrompt();
        if (result) notifyTask(result.lastInsertRowid);
    }
    if (!success) {
        return { success: false, error: `Terminal "${terminalId}" not found or not spawned. Total terminals: ${terminalManager.terminals.size}` };
    }
    return { success };
});

// Handler for preload's terminalAPI.write bridge
electron_1.ipcMain.handle('terminal:write', async (_event, terminalId: string, data: string) => {
    const success = terminalManager.write(terminalId, data);
    return { success };
});

// Handler for preload's executeCommand bridge (used by ImportSessionsDialog and TerminalPage)
electron_1.ipcMain.handle('electron:execute-command', async (_event, command: string, cwd?: string) => {
    const { exec } = require('child_process');
    return new Promise((resolve) => {
        exec(command, { cwd: cwd || undefined, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
            resolve({ stdout, stderr, error: error ? error.message : null, code: error?.code || 0 });
        });
    });
});

electron_1.ipcMain.handle('terminal:resize-old-format', async (_event, terminalId: string, cols: number, rows: number) => {
    const success = terminalManager.resize(terminalId, cols, rows);
    return { success };
});

electron_1.ipcMain.handle('terminal:destroy-old-format', async (_event, terminalId: string) => {
    failPendingWrites(terminalId);
    const success = terminalManager.kill(terminalId);
    return { success };
});

// New-format terminal:destroy handler (used by terminalAPI.destroy in preload)
electron_1.ipcMain.handle('terminal:destroy', async (_event, terminalId: string) => {
    failPendingWrites(terminalId);
    const success = terminalManager.kill(terminalId);
    return { success };
});

electron_1.ipcMain.handle('get-terminal-sessions', async (_event, projectId?: string, limit?: number) => {
    if (!db) return [];
    try {
        if (projectId) {
            const stmt = db.prepare('SELECT * FROM terminal_sessions WHERE project_id = ? ORDER BY created_at DESC LIMIT ?');
            return stmt.all(projectId, limit || 500);
        }
        const stmt = db.prepare('SELECT * FROM terminal_sessions ORDER BY created_at DESC LIMIT ?');
        return stmt.all(limit || 500);
    } catch {
        return [];
    }
});

electron_1.ipcMain.handle('save-terminal-session', async (_event, session: any) => {
    if (!db) return { success: false };
    try {
        const id = session.id || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        // Generate a resume ID if this is a new session and one wasn't provided
        const resumeId = session.resumeId || `local_${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        console.log('[HealthDebug] save-terminal-session called:', { id, projectId: session.projectId, agent: session.agent, topic: session.topic, resumeId });
        const existing = db.prepare('SELECT created_at FROM terminal_sessions WHERE id = ?').get(id);
        const cat = session.category || 'other';
        const stat = session.status || 'active';
        const tags = JSON.stringify(session.autoTags || []);
        if (existing) {
            db.prepare(`
                UPDATE terminal_sessions SET project_id = ?, agent = ?, resume_id = ?, topic = ?,
                  working_directory = ?, terminal_id = ?, total_tokens = ?, total_cost = ?,
                  category = ?, status = ?, product_area = ?, description = ?, auto_tags = ?,
                  category_confirmed = ?, subpage = ?, updated_at = datetime('now')
                WHERE id = ?
            `).run(
                session.projectId || null, session.agent, resumeId, session.topic || null,
                session.workingDirectory || null, session.terminalId || null, session.totalTokens || 0, session.totalCost || 0,
                cat, stat, session.productArea || '', session.description || '', tags,
                session.categoryConfirmed ? 1 : 0, session.subpage || 'work/sessions', id
            );
        } else {
            db.prepare(`
                INSERT INTO terminal_sessions (id, project_id, agent, resume_id, topic, working_directory, terminal_id,
                  total_tokens, total_cost, category, status, product_area, description, auto_tags, category_confirmed, subpage, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `).run(
                id, session.projectId || null, session.agent, resumeId, session.topic || null,
                session.workingDirectory || null, session.terminalId || null, session.totalTokens || 0, session.totalCost || 0,
                cat, stat, session.productArea || '', session.description || '', tags,
                session.categoryConfirmed ? 1 : 0, session.subpage || 'work/sessions'
            );
        }
        return { success: true, id, resumeId };
    } catch (err: any) {
        console.error('[DeskFlow] save-terminal-session error:', err.message);
        return { success: false, error: err.message };
    }
});

electron_1.ipcMain.handle('update-session-resume-id', async (_event, sessionId: string, resumeId: string) => {
    if (!db) return { success: false, error: 'no db' };
    try {
        db.prepare('UPDATE terminal_sessions SET resume_id = ? WHERE id = ?').run(resumeId, sessionId);
        return { success: true };
    } catch (err: any) {
        console.error('[DeskFlow] update-session-resume-id error:', err.message);
        return { success: false, error: err.message };
    }
});

// ═══ Model Improvement Dashboard IPC handlers ═══

electron_1.ipcMain.handle('get-model-improvement-stats', async (_event, { terminalId }: { terminalId?: string } = {}) => {
  try {
    const messageCounts: Record<string, number> = {};
    for (const [id, count] of terminalMessageCounts.entries()) {
      if (!terminalId || id === terminalId) {
        messageCounts[id] = count;
      }
    }
    return {
      messageCounts,
      reinjectionCount: globalReinjectionCount,
      threshold: runtimeReinjectThreshold ?? RULES_REINJECT_THRESHOLD,
      actionsAttempted: globalActionsAttempted,
      actionsFailed: globalActionsFailed,
    };
  } catch (err) {
    console.error('[get-model-improvement-stats] error:', err);
    return null;
  }
});

electron_1.ipcMain.handle('set-reinject-threshold', async (_event, { threshold }: { threshold: number }) => {
  try {
    if (typeof threshold !== 'number' || threshold < 1 || threshold > 100) {
      return { success: false, error: 'threshold must be 1–100' };
    }
    runtimeReinjectThreshold = threshold;
    if (modelDebugMode) {
      console.log(`[ModelDebug] Re-injection threshold set to ${threshold}`);
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

electron_1.ipcMain.handle('set-model-debug', async (_event, { enabled }: { enabled: boolean }) => {
  try {
    modelDebugMode = Boolean(enabled);
    console.log(`[ModelDebug] Debug mode ${modelDebugMode ? 'enabled' : 'disabled'}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

electron_1.ipcMain.handle('read-actions-error-log', async (_event) => {
  try {
    const firstTerminal = terminalManager.terminals.values().next().value;
    if (!firstTerminal?.cwd) {
      return { entries: [], exists: false };
    }
    const logPath = path_1.default.join(firstTerminal.cwd, 'agent', 'actions_error.log');
    if (!fs_1.default.existsSync(logPath)) {
      return { entries: [], exists: false };
    }
    const content = fs_1.default.readFileSync(logPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    const entries = lines.slice(-10);
    return { entries, exists: true };
  } catch (err) {
    console.error('[read-actions-error-log] error:', err);
    return { entries: [], exists: false };
  }
});

// ═════════════════════════════════════���═════════════════════════
// Cross-Session Sync Config
// ═══════════════════════════════════════════════════════════════

let crossSessionSyncRuntimeConfig = {
  enabled: true,
  lockTTL: 300,
  contextBroadcast: true,
  conflictWarningMode: 'both',
  syncCommand: true,
};

electron_1.ipcMain.handle('get-cross-session-sync-config', () => {
  return crossSessionSyncRuntimeConfig;
});

electron_1.ipcMain.handle('set-cross-session-sync-config', (_event, config: any) => {
  crossSessionSyncRuntimeConfig = { ...crossSessionSyncRuntimeConfig, ...config };
  return { success: true };
});

electron_1.ipcMain.handle('get-terminal-session-resume-id', async (_event, sessionId: string) => {
    if (!db) return null;
    try {
        const session = db.prepare('SELECT resume_id FROM terminal_sessions WHERE id = ?').get(sessionId) as any;
        return session?.resume_id || null;
    } catch {
        return null;
    }
});

electron_1.ipcMain.handle('get-terminal-session-by-id', async (_event, sessionId: string) => {
    if (!db) return null;
    try {
        const session = db.prepare('SELECT * FROM terminal_sessions WHERE id = ?').get(sessionId);
        return session || null;
    } catch {
        return null;
    }
});

electron_1.ipcMain.handle('check-session-exists', async (_event, sessionId: string) => {
    try {
        const { execFile } = require('child_process');
        const result = await new Promise<{ exists: boolean; error?: string }>((resolve) => {
            execFile('opencode', ['-s', sessionId], { timeout: 10000 }, (err: any, _stdout: string, stderr: string) => {
                if (err) {
                    resolve({ exists: false, error: stderr || err.message });
                } else {
                    resolve({ exists: true });
                }
            });
        });
        return result;
    } catch (err: any) {
        return { exists: false, error: err.message };
    }
});

electron_1.ipcMain.handle('delete-terminal-session', async (_event, sessionId: string) => {
    if (!db) return { success: false };
    try {
        db.prepare('DELETE FROM terminal_messages WHERE session_id = ?').run(sessionId);
        db.prepare('DELETE FROM session_parsed_items WHERE session_id = ?').run(sessionId);
        db.prepare('DELETE FROM terminal_bindings WHERE session_id = ?').run(sessionId);
        db.prepare('DELETE FROM terminal_sessions WHERE id = ?').run(sessionId);
        console.log('[DeskFlow] delete-terminal-session: deleted session', sessionId, 'with cascaded messages, parsed items, and bindings');
        return { success: true };
    } catch (err: any) {
        console.error('[DeskFlow] delete-terminal-session error:', err.message);
        return { success: false, error: err.message };
    }
});

// ── Session Categorization IPC ──

electron_1.ipcMain.handle('update-session-category', async (_event, data: {
    sessionId: string; topic?: string; category?: string; productArea?: string; description?: string; status?: string; tags?: string[]; categoryConfirmed?: boolean;
}) => {
    if (!db) return { success: false, error: 'No database' };
    try {
        const updates: string[] = [];
        const params: any[] = [];
        if (data.topic !== undefined) { updates.push('topic = ?'); params.push(data.topic); }
        if (data.category) { updates.push('category = ?'); params.push(data.category); }
        if (data.productArea !== undefined) { updates.push('product_area = ?'); params.push(data.productArea); }
        if (data.description !== undefined) { updates.push('description = ?'); params.push(data.description); }
        if (data.status) { updates.push('status = ?'); params.push(data.status); }
        if (data.tags) { updates.push('auto_tags = ?'); params.push(JSON.stringify(data.tags)); }
        if (data.categoryConfirmed !== undefined) { updates.push('category_confirmed = ?'); params.push(data.categoryConfirmed ? 1 : 0); }
        if (updates.length > 0) {
            updates.push("updated_at = datetime('now')");
            params.push(data.sessionId);
            db.prepare(`UPDATE terminal_sessions SET ${updates.join(', ')} WHERE id = ?`).run(...params);
        }
        return { success: true };
    } catch (err: any) {
        console.error('[DeskFlow] update-session-category error:', err.message);
        return { success: false, error: err.message };
    }
});

electron_1.ipcMain.handle('get-parsed-session-items', async (_event, sessionId: string) => {
    if (!db) return { success: false, data: [] };
    try {
        const items = db.prepare(
            'SELECT * FROM session_parsed_items WHERE session_id = ? ORDER BY created_at ASC'
        ).all(sessionId);
        return { success: true, data: items };
    } catch (err: any) {
        console.error('[DeskFlow] get-parsed-session-items error:', err.message);
        return { success: false, error: err.message, data: [] };
    }
});

// Analyze session messages to suggest category
electron_1.ipcMain.handle('analyze-session-category', async (_event, sessionId: string) => {
    if (!db) return { success: false, category: 'other', confidence: 0, tags: [], productArea: '' };
    try {
        const messages = db.prepare(
            "SELECT content FROM terminal_messages WHERE session_id = ? AND role = 'assistant' ORDER BY created_at ASC"
        ).all(sessionId) as any[];
        const allContent = messages.map((m: any) => m.content).join('\n').toLowerCase();

        const keywordScores: Record<string, { score: number; keywords: string[] }> = {
            'bug-fix': { score: 0, keywords: ['bug', 'fix', 'error', 'crash', 'broken', 'issue #', 'regression', 'not working', 'fault', 'fail'] },
            'feature': { score: 0, keywords: ['add', 'new', 'implement', 'feature', 'create', 'build', 'introduce', 'support for'] },
            'refactor': { score: 0, keywords: ['refactor', 'clean', 'rename', 'extract', 'move', 'simplify', 'restructure', 'rewrite'] },
            'research': { score: 0, keywords: ['research', 'investigate', 'explore', 'how to', 'learn', 'evaluate', 'compare', 'documentation'] },
            'review': { score: 0, keywords: ['review', 'check', 'audit', 'verify', 'validate', 'approve', 'inspect'] },
        };

        for (const [cat, data] of Object.entries(keywordScores)) {
            for (const kw of data.keywords) {
                const regex = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                const matches = allContent.match(regex);
                if (matches) data.score += matches.length * 2;
            }
        }

        const totalScore = Object.values(keywordScores).reduce((s, d) => s + d.score, 0);
        let bestCat = 'other';
        let bestScore = 0;
        for (const [cat, data] of Object.entries(keywordScores)) {
            if (data.score > bestScore) { bestScore = data.score; bestCat = cat; }
        }

        const confidence = totalScore > 0 ? Math.round((bestScore / totalScore) * 100) : 0;

        // Extract tags: issue references + file paths
        const tags: string[] = [];
        const issueMatches = allContent.match(/#\d+/g);
        if (issueMatches) tags.push(...[...new Set(issueMatches)].slice(0, 5));
        const fileMatches = allContent.match(/[\w/]+\.\w+/g);
        if (fileMatches) tags.push(...[...new Set(fileMatches)].slice(0, 5));

        // Suggest product area from file paths
        const areaKeywords: Record<string, string[]> = {
            'Dashboard': ['dashboard', 'dashboardpage'],
            'Settings': ['settings', 'settingspage'],
            'Terminal': ['terminalpage', 'terminalwindow', 'terminal'],
            'External Page': ['externalpage', 'external'],
            'IDE Page': ['ideprojects', 'ideprojectspage'],
            'Database': ['main.ts', 'sqlite', 'database', 'db'],
            'Solar System': ['orbitsystem', 'solarsystem', 'planet', 'galaxy'],
            'Browser': ['browseractivitypage', 'browser'],
            'Heatmap': ['heatmap', 'dashboardpage'],
            'Insights': ['insightspage', 'insights'],
        };
        let suggestedArea = '';
        for (const [area, kws] of Object.entries(areaKeywords)) {
            if (kws.some(kw => allContent.includes(kw))) { suggestedArea = area; break; }
        }

        return { success: true, category: confidence >= 40 ? bestCat : 'other', confidence, tags: [...new Set(tags)], productArea: suggestedArea };
    } catch (err: any) {
        console.error('[DeskFlow] analyze-session-category error:', err.message);
        return { success: false, category: 'other', confidence: 0, tags: [], productArea: '' };
    }
});

// ── Session Config Save/Load ──

electron_1.ipcMain.handle('save-session-config', async (_, { sessionId, config, projectPath }: { sessionId: string; config: any; projectPath?: string }) => {
  try {
    const basePath = projectPath || process.cwd();
    const configDir = path_1.default.join(basePath, 'agent', 'session-configs');
    if (!fs_1.default.existsSync(configDir)) {
      fs_1.default.mkdirSync(configDir, { recursive: true });
    }
    const configPath = path_1.default.join(configDir, `${sessionId}.json`);
    fs_1.default.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log('[DeskFlow] Saved session config:', configPath);
    return { success: true };
  } catch (error: any) {
    console.error('[DeskFlow] save-session-config error:', error);
    return { success: false, error: error.message };
  }
});

electron_1.ipcMain.handle('load-session-config', async (_, { sessionId, projectPath }: { sessionId: string; projectPath?: string }) => {
  try {
    const basePath = projectPath || process.cwd();
    const configPath = path_1.default.join(basePath, 'agent', 'session-configs', `${sessionId}.json`);
    if (!fs_1.default.existsSync(configPath)) {
      return { success: false, data: null, error: 'Config not found' };
    }
    const content = fs_1.default.readFileSync(configPath, 'utf-8');
    return { success: true, data: JSON.parse(content) };
  } catch (error: any) {
    console.error('[DeskFlow] load-session-config error:', error);
    return { success: false, error: error.message };
  }
});

electron_1.ipcMain.handle('list-init-files', async (_, { projectPath }: { projectPath?: string } = {}) => {
  try {
    const fileSet = new Set<string>();
    // ONLY use projectPath/agent/ — NOT userDataPath
    if (projectPath) {
      const projAgentDir = path_1.default.join(projectPath, 'agent');
      if (fs_1.default.existsSync(projAgentDir)) {
        fs_1.default.readdirSync(projAgentDir)
          .filter((f: string) => f.endsWith('.md'))
          .forEach((f: string) => fileSet.add(f));
      }
    }
    return { success: true, data: [...fileSet].sort() };
  } catch (error: any) {
    console.error('[DeskFlow] list-init-files error:', error);
    return { success: false, error: error.message };
  }
});

electron_1.ipcMain.handle('read-init-file', async (_, { filename, projectPath }: { filename: string; projectPath?: string }) => {
  try {
    if (!filename) return { success: false, error: 'No filename provided' };
    if (projectPath) {
      const agentDir = path_1.default.join(projectPath, 'agent');
      const projectFile = path_1.default.join(agentDir, filename);
      if (!isPathWithin(agentDir, filename)) {
        return { success: false, error: 'Path traversal denied' };
      }
      if (fs_1.default.existsSync(projectFile)) {
        return { success: true, data: fs_1.default.readFileSync(projectFile, 'utf-8') };
      }
    }
    return { success: false, error: 'File not found' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// ── @mention Routing ──

electron_1.ipcMain.handle('resolve-at-mention', async (_event, data: { input: string; terminalTabs: Array<{ id: string; name: string }> }) => {
    try {
        const match = data.input.match(/@(\S+)/);
        if (!match) return { terminalId: null, message: data.input, resolved: false };

        const token = match[1].toLowerCase();
        const remaining = data.input.replace(/@\S+\s*/, '').trim();

        // Try exact name match
        const exactMatch = data.terminalTabs.find(t => t.name.toLowerCase() === token);
        if (exactMatch) return { terminalId: exactMatch.id, message: remaining, resolved: true };

        // Try number match: @3 or @term3
        const numMatch = token.match(/^(?:term)?(\d+)$/);
        if (numMatch) {
            const idx = parseInt(numMatch[1]) - 1;
            const sorted = [...data.terminalTabs].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
            if (sorted[idx]) return { terminalId: sorted[idx].id, message: remaining, resolved: true };
        }

        // Try fuzzy match
        const fuzzy = data.terminalTabs.find(t => t.name.toLowerCase().includes(token));
        if (fuzzy) return { terminalId: fuzzy.id, message: remaining, resolved: true };

        return { terminalId: null, message: remaining, resolved: false };
    } catch (err: any) {
        console.error('[DeskFlow] resolve-at-mention error:', err.message);
        return { terminalId: null, message: data.input, resolved: false };
    }
});

electron_1.ipcMain.handle('delete-terminal-layout', async (_event, layoutId: string) => {
    if (!db) return { success: false };
    try {
        db.prepare('DELETE FROM terminal_layouts WHERE id = ?').run(layoutId);
        return { success: true };
    } catch (err: any) {
        console.error('[DeskFlow] delete-terminal-layout error:', err.message);
        return { success: false, error: err.message };
    }
});

electron_1.ipcMain.handle('set-active-terminal-layout', async (_event, layoutId: string) => {
    if (!db) return { success: false };
    try {
        db.prepare("UPDATE terminal_layouts SET is_active = 0 WHERE is_active = 1").run();
        db.prepare('UPDATE terminal_layouts SET is_active = 1 WHERE id = ?').run(layoutId);
        return { success: true };
    } catch (err: any) {
        console.error('[DeskFlow] set-active-terminal-layout error:', err.message);
        return { success: false, error: err.message };
    }
});

// ── Workspace State Persistence ──

electron_1.ipcMain.handle('workspace:save', async (_event, data: {
    projectId: string;
    name?: string;
    scope?: string;
    sidebarWidth?: number;
    activeTab?: string;
    terminalTabs?: string[];
    layout?: any;
    openFiles?: string[];
    activeTerminalId?: string | null;
    todos?: any[];
    presets?: any[];
    terminalInfo?: Record<string, { name: string; agent: string; modelTier?: string }>;
    configs?: any;
    contextConfig?: any;
    analyticsPeriod?: string;
    sessionCategoryFilter?: string;
    skillsActiveView?: string;
    mapListRatio?: number;
    theme?: any;
}) => {
    if (!db) return { success: false, error: 'No database' };
    try {
        const instanceName = data.name || 'default';
        const tabsJson = JSON.stringify(data.terminalTabs || []);
        const stateJson = JSON.stringify({
            layout: data.layout || null,
            openFiles: data.openFiles || [],
            activeTerminalId: data.activeTerminalId || null,
            todos: data.todos || [],
            presets: data.presets || [],
            terminalInfo: data.terminalInfo || {},
            configs: data.configs || null,
            contextConfig: data.contextConfig || null,
            analyticsPeriod: data.analyticsPeriod || null,
            sessionCategoryFilter: data.sessionCategoryFilter || null,
            skillsActiveView: data.skillsActiveView || null,
            mapListRatio: data.mapListRatio || null,
            theme: data.theme || null,
        });
        // Deactivate all instances for this project
        db.prepare('UPDATE workspace_state SET is_active = 0 WHERE project_id = ?').run(data.projectId);
        // Upsert by (project_id, name)
        const existing = db.prepare('SELECT id FROM workspace_state WHERE project_id = ? AND name = ?').get(data.projectId, instanceName) as any;
        if (existing) {
            db.prepare(`
                UPDATE workspace_state SET scope = ?, sidebar_width = ?, active_tab = ?, terminal_tabs = ?, state_json = ?, is_active = 1, updated_at = CURRENT_TIMESTAMP
                WHERE project_id = ? AND name = ?
            `).run(data.scope || 'project', data.sidebarWidth || 400, data.activeTab || 'presets', tabsJson, stateJson, data.projectId, instanceName);
        } else {
            db.prepare(`
                INSERT INTO workspace_state (project_id, name, scope, sidebar_width, active_tab, terminal_tabs, state_json, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            `).run(data.projectId, instanceName, data.scope || 'project', data.sidebarWidth || 400, data.activeTab || 'presets', tabsJson, stateJson);
        }
        return { success: true, name: instanceName };
    } catch (err: any) {
        console.error('[DeskFlow] workspace:save error:', err.message);
        return { success: false, error: err.message };
    }
});

electron_1.ipcMain.handle('workspace:load', async (_event, data: { projectId: string; name?: string }) => {
    if (!db) return { success: false, error: 'No database' };
    try {
        let row: any;
        if (data.name) {
            // Load specific named instance
            row = db.prepare('SELECT * FROM workspace_state WHERE project_id = ? AND name = ?').get(data.projectId, data.name) as any;
        } else {
            // Load active instance, fallback to 'default'
            row = db.prepare('SELECT * FROM workspace_state WHERE project_id = ? AND is_active = 1').get(data.projectId) as any;
            if (!row) {
                row = db.prepare('SELECT * FROM workspace_state WHERE project_id = ? AND name = ?').get(data.projectId, 'default') as any;
            }
            // Fallback to any instance
            if (!row) {
                row = db.prepare('SELECT * FROM workspace_state WHERE project_id = ? ORDER BY updated_at DESC LIMIT 1').get(data.projectId) as any;
            }
        }
        if (!row) return { success: true, data: null };
        const parsedState = row.state_json ? JSON.parse(row.state_json) : {};
        return {
            success: true,
            data: {
                name: row.name,
                isActive: row.is_active === 1,
                sidebarWidth: row.sidebar_width,
                activeTab: row.active_tab,
                terminalTabs: JSON.parse(row.terminal_tabs || '[]'),
                state_json: row.state_json,
                layout: parsedState.layout || null,
                openFiles: parsedState.openFiles || [],
                activeTerminalId: parsedState.activeTerminalId || null,
                todos: parsedState.todos || [],
                presets: parsedState.presets || [],
                terminalInfo: parsedState.terminalInfo || {},
                configs: parsedState.configs || null,
                contextConfig: parsedState.contextConfig || null,
                analyticsPeriod: parsedState.analyticsPeriod || null,
                sessionCategoryFilter: parsedState.sessionCategoryFilter || null,
                skillsActiveView: parsedState.skillsActiveView || null,
                mapListRatio: parsedState.mapListRatio || null,
                theme: parsedState.theme || null,
            }
        };
    } catch (err: any) {
        console.error('[DeskFlow] workspace:load error:', err.message);
        return { success: false, error: err.message };
    }
});

electron_1.ipcMain.handle('workspace:list', async (_event, data: { projectId: string }) => {
    if (!db) return { success: false, error: 'No database' };
    try {
        const rows = db.prepare('SELECT name, is_active, sidebar_width, active_tab, updated_at FROM workspace_state WHERE project_id = ? ORDER BY updated_at DESC').all(data.projectId) as any[];
        return { success: true, data: rows.map(r => ({ name: r.name, isActive: r.is_active === 1, sidebarWidth: r.sidebar_width, activeTab: r.active_tab, updatedAt: r.updated_at })) };
    } catch (err: any) {
        console.error('[DeskFlow] workspace:list error:', err.message);
        return { success: false, error: err.message };
    }
});

electron_1.ipcMain.handle('workspace:delete', async (_event, data: { projectId: string; name: string }) => {
    if (!db) return { success: false, error: 'No database' };
    try {
        db.prepare('DELETE FROM workspace_state WHERE project_id = ? AND name = ?').run(data.projectId, data.name);
        return { success: true };
    } catch (err: any) {
        console.error('[DeskFlow] workspace:delete error:', err.message);
        return { success: false, error: err.message };
    }
});

electron_1.ipcMain.handle('workspace:list-all', async () => {
    if (!db) return { success: false, error: 'No database' };
    try {
        const rows = db.prepare('SELECT ws.name, ws.project_id, ws.is_active, ws.sidebar_width, ws.active_tab, ws.updated_at, p.name AS project_name FROM workspace_state ws LEFT JOIN projects p ON ws.project_id = p.id ORDER BY ws.updated_at DESC').all() as any[];
        return { success: true, data: rows.map(r => ({ name: r.name, projectId: r.project_id, projectName: r.project_name || r.project_id, isActive: r.is_active === 1, sidebarWidth: r.sidebar_width, activeTab: r.active_tab, updatedAt: r.updated_at })) };
    } catch (err: any) {
        console.error('[DeskFlow] workspace:list-all error:', err.message);
        return { success: false, error: err.message };
    }
});

// ── Terminal Messages (Chat Persistence) ──

// Parse session metadata from AI output
function parseSessionMetadata(content: string): {
  title?: string; description?: string; status?: string; productArea?: string; category?: string;
} | null {
  if (!content.includes('## Session Metadata')) return null;
  const meta: any = {};
  const lines = content.split('\n');
  let inMeta = false;
  for (const line of lines) {
    if (line.trim() === '## Session Metadata') { inMeta = true; continue; }
    if (!inMeta) continue;
    if (line.startsWith('#')) break;
    const m = line.match(/-\s*(\w+)\s*:\s*(.+)/);
    if (m) {
      const key = m[1].replace(/\s+/g, '').toLowerCase();
      const val = m[2].trim();
      if (key === 'title') meta.title = val;
      if (key === 'description') meta.description = val;
      if (key === 'status') meta.status = val;
      if (key === 'productarea') meta.productArea = val;
      if (key === 'category') meta.category = val;
    }
  }
  return Object.keys(meta).length ? meta : null;
}

// Parse decisions, action items, status changes, references from message content
function getSessionAgent(sessionId: string): string | null {
  if (!db) return null;
  try {
    const row = db.prepare('SELECT agent FROM terminal_sessions WHERE id = ?').get(sessionId) as any;
    return row?.agent || null;
  } catch { return null; }
}

function parseAndExecuteActions(content: string, sessionId: string, actor: string, terminalId?: string) {
  if (!content.includes('## Actions') || !db) return;
  const lines = content.split('\n');
  let inActions = false;
  let actionCount = 0;
  let failCount = 0;
  const errors: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '## Actions') { inActions = true; continue; }
    if (!inActions) continue;
    if (line.startsWith('#')) break;
    actionCount++;
    // [create-problem] Title - priority: high - category: bug-fix - description: ...
    const createMatch = trimmed.match(/\[create-problem\]\s+(.+?)(?:\s*-\s*priority:\s*(\w+))?(?:\s*-\s*category:\s*(\w+))?(?:\s*-\s*description:\s*(.+))?/i);
    if (createMatch) {
      const title = createMatch[1].trim();
      const priority = createMatch[2] || 'medium';
      const category = createMatch[3] || 'other';
      const desc = createMatch[4]?.trim();
      try {
        const ps = getProblemsService();
        const problem = ps.createProblem({ title, priority, category, description: desc || null });
        const sessionRow = db.prepare('SELECT project_id FROM terminal_sessions WHERE id = ?').get(sessionId) as any;
        if (sessionRow?.project_id) {
          const ps2 = getProblemsService(sessionRow.project_id);
          ps2.createProblem({ title, priority, category, description: desc || null });
        }
        logActivity({ entityType: 'problem', entityId: String(problem.id), entityTitle: title, action: 'created', actor, summary: `AI created problem: ${title}` });
      } catch (e: any) { failCount++; errors.push(`create_problem: ${e.message}`); }
      continue;
    }
    // [update-problem] ID - status: In Progress
    const updateMatch = trimmed.match(/\[update-problem\]\s+(\S+)(?:\s*-\s*status:\s*(.+))?/i);
    if (updateMatch) {
      const problemId = updateMatch[1];
      const status = updateMatch[2]?.trim();
      if (status) {
        try {
          const ps = getProblemsService();
          const all = ps.getProblems();
          const p = all.find((x: any) => x.id === problemId || x.title === problemId);
          if (p) {
            ps.updateProblem(p.id, { status });
            const sessionRow = db.prepare('SELECT project_id FROM terminal_sessions WHERE id = ?').get(sessionId) as any;
            if (sessionRow?.project_id) {
              const ps2 = getProblemsService(sessionRow.project_id);
              ps2.updateProblem(p.id, { status });
            }
            logActivity({ entityType: 'problem', entityId: String(p.id), entityTitle: p.title, action: 'status_changed', actor, summary: `AI updated status: ${p.title} → ${status}` });
          } else { failCount++; errors.push(`update_problem: "${problemId}" not found`); }
        } catch (e: any) { failCount++; errors.push(`update_problem: ${e.message}`); }
      } else { failCount++; errors.push('update_problem: missing status'); }
      continue;
    }
    // [add-check] problem-1.5 - description: Verify click handler - instruction: Open the page, click the button
    const addCheckMatch = trimmed.match(/\[add-check\]\s+(\S+)\s*-\s*description:\s*(.+?)(?:\s*-\s*instruction:\s*(.+))?$/i);
    if (addCheckMatch) {
      const parentId = addCheckMatch[1];
      const description = addCheckMatch[2].trim();
      const instruction = addCheckMatch[3]?.trim() || '';
      try {
        const sessionRow = db.prepare('SELECT project_id FROM terminal_sessions WHERE id = ?').get(sessionId) as any;
        const projectPath = sessionRow?.project_id || undefined;
        const ps = getProblemsService(undefined, projectPath);
        let check = ps.addCheck(parentId, description, instruction);
        if (!check) {
          const rs = getRequestsService(projectPath);
          check = rs.addCheck(parentId, description, instruction);
        }
        if (check) {
          logActivity({ entityType: 'check', entityId: check.id, action: 'created', actor, summary: `AI added check: ${description}` });
        } else {
          failCount++; errors.push(`add_check: parent "${parentId}" not found`);
        }
      } catch (e: any) { failCount++; errors.push(`add_check: ${e.message}`); }
      continue;
    }
    // [complete-check] problem-1.5-check-1
    const completeCheckMatch = trimmed.match(/\[complete-check\]\s+(\S+)/i);
    if (completeCheckMatch) {
      const checkId = completeCheckMatch[1].trim();
      try {
        const sessionRow = db.prepare('SELECT project_id FROM terminal_sessions WHERE id = ?').get(sessionId) as any;
        const projectPath = sessionRow?.project_id || undefined;
        const ps = getProblemsService(undefined, projectPath);
        const allProblems = ps.getProblems();
        let found = false;
        for (const p of allProblems) {
          if ((p.checks || []).some((c: any) => c.id === checkId)) {
            found = ps.completeCheck(p.id, checkId);
            if (found) break;
          }
        }
        if (!found) {
          const rs = getRequestsService(projectPath);
          const allRequests = rs.getRequests();
          for (const r of allRequests) {
            if ((r.checks || []).some((c: any) => c.id === checkId)) {
              found = rs.completeCheck(r.id, checkId);
              if (found) break;
            }
          }
        }
        if (found) {
          logActivity({ entityType: 'check', entityId: checkId, action: 'completed', actor, summary: `AI completed check: ${checkId}` });
        } else {
          failCount++; errors.push(`complete_check: check "${checkId}" not found`);
        }
      } catch (e: any) { failCount++; errors.push(`complete_check: ${e.message}`); }
      continue;
    }
    failCount++;
    errors.push(`unrecognized action format: "${trimmed.slice(0, 40)}..."`);
  }

  // Emit feedback if parsing failed
  if (failCount > 0 && terminalId) {
    const feedback = `[SYSTEM] Actions block: ${actionCount - failCount} succeeded, ${failCount} failed. Errors: ${errors.join('; ')}. Please re-emit valid actions.`;
    try { terminalManager.write(terminalId, feedback + '\r\n'); } catch {}
  }

  // Update global counters for Model Improvement Dashboard
  globalActionsAttempted += actionCount;
  globalActionsFailed += failCount;

  // Notify renderer that context may have changed after action processing
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('context-changed', {
      type: 'problems',
      action: 'batch-processed',
      source: terminalId || null,
      actionCount,
      failCount,
      timestamp: Date.now(),
    });
  }
}

function parseMessageContent(content: string): Array<{ item_type: string; content: string }> {
  const items: Array<{ item_type: string; content: string }> = [];
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/(?:^|\s)(?:decision:|chose|going with|let's use|we'll use)(?:\s|$)/i.test(trimmed)) {
      items.push({ item_type: 'decision', content: trimmed.substring(0, 200) });
    }
    if (/(?:^|\s)(?:todo:|next step|need to|should|must|action item)(?:\s|$)/i.test(trimmed)) {
      items.push({ item_type: 'action_item', content: trimmed.substring(0, 200) });
    }
    if (/(?:^|\s)(?:fixed|done|complete|blocked on|wontfix)(?:\s|$)/i.test(trimmed)) {
      items.push({ item_type: 'status_change', content: trimmed.substring(0, 200) });
    }
  }
  return items;
}

// ═══════════════════ actions.json file bridge — AI writes actions, system executes ═══════════════════

// Parse and execute actions from agent/actions.json format:
// { "actions": [{ "type": "create_problem", "title": "...", "priority": "...", ... }] }
function executeActionsFromFile(projectPath: string, terminalId: string) {
  try {
    const actionsPath = path_1.default.join(projectPath, 'agent', 'actions.json');
    if (!fs_1.default.existsSync(actionsPath)) return;
    const raw = fs_1.default.readFileSync(actionsPath, 'utf-8').trim();
    if (!raw) return;

    let data: any;
    try {
      data = JSON.parse(raw);
    } catch (parseErr: any) {
      const errorLogPath = path_1.default.join(projectPath, 'agent', 'actions_error.log');
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] JSON parse error: ${parseErr.message}\nRaw content:\n${raw}\n---\n`;
      fs_1.default.appendFileSync(errorLogPath, logEntry);
      const feedback = `[SYSTEM] actions.json parse error — ${parseErr.message}. Raw saved to agent/actions_error.log. Please re-emit valid actions.json.`;
      try { terminalManager.write(terminalId, feedback + '\r\n'); } catch {}
      console.error('[ActionsJSON] Parse error:', parseErr.message);
      return;
    }

    if (!data.actions || !Array.isArray(data.actions) || data.actions.length === 0) return;

    // Find session for this terminal
    let sessionId: string | null = null;
    if (db) {
      const row = db.prepare('SELECT id FROM terminal_sessions WHERE terminal_id = ? ORDER BY created_at DESC LIMIT 1').get(terminalId) as any;
      if (row) sessionId = row.id;
    }
    const actor = 'ai:terminal';
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (const action of data.actions) {
      const type = action.type || '';
      try {
        if (type === 'create_problem' && action.title) {
          const ps = getProblemsService(undefined, projectPath);
          const problem = ps.createProblem({
            title: action.title,
            priority: action.priority || 'medium',
            category: action.category || 'other',
            description: action.description || null,
          });
          logActivity({ entityType: 'problem', entityId: String(problem.id), entityTitle: problem.title, action: 'created', actor, summary: `AI created problem: ${problem.title}` });
          mainWindow?.webContents?.send('context-changed', { type: 'problem', action: 'created', entity: { id: problem.id, title: problem.title, status: problem.status } });
          successCount++;
        } else if (type === 'update_problem' && action.id && action.status) {
          const ps = getProblemsService(undefined, projectPath);
          const all = ps.getProblems();
          const p = all.find((x: any) => x.id === action.id || x.title === action.id);
          if (p) {
            ps.updateProblem(p.id, { status: action.status });
            logActivity({ entityType: 'problem', entityId: String(p.id), entityTitle: p.title, action: 'status_changed', actor, summary: `AI updated: ${p.title} → ${action.status}` });
            mainWindow?.webContents?.send('context-changed', { type: 'problem', action: 'updated', entity: { id: p.id, title: p.title, status: action.status } });
            successCount++;
          } else {
            errors.push(`update_problem: problem "${action.id}" not found`);
            failCount++;
          }
        } else if (type === 'add_check' && action.id && action.description) {
          const ps = getProblemsService(undefined, projectPath);
          let check = ps.addCheck(action.id, action.description, action.instruction || '');
          if (!check) {
            const rs = getRequestsService(projectPath);
            check = rs.addCheck(action.id, action.description, action.instruction || '');
          }
          if (check) {
            logActivity({ entityType: 'check', entityId: check.id, action: 'created', actor, summary: `AI added check: ${action.description}` });
            mainWindow?.webContents?.send('context-changed', { type: 'check', action: 'created', entity: check });
            successCount++;
          } else {
            errors.push(`add_check: parent "${action.id}" not found`);
            failCount++;
          }
        } else if (type === 'complete_check' && action.id) {
          const ps = getProblemsService(undefined, projectPath);
          const allProblems = ps.getProblems();
          let found = false;
          for (const p of allProblems) {
            if ((p.checks || []).some((c: any) => c.id === action.id)) {
              found = ps.completeCheck(p.id, action.id);
              if (found) break;
            }
          }
          if (!found) {
            const rs = getRequestsService(projectPath);
            const allRequests = rs.getRequests();
            for (const r of allRequests) {
              if ((r.checks || []).some((c: any) => c.id === action.id)) {
                found = rs.completeCheck(r.id, action.id);
                if (found) break;
              }
            }
          }
          if (found) {
            logActivity({ entityType: 'check', entityId: action.id, action: 'completed', actor, summary: `AI completed check: ${action.id}` });
            mainWindow?.webContents?.send('context-changed', { type: 'check', action: 'updated', entity: { id: action.id } });
            successCount++;
          } else {
            errors.push(`complete_check: check "${action.id}" not found`);
            failCount++;
          }
        } else if (type === 'complete_checklist' && action.id) {
          // Legacy compatibility — silently accept, no-op
          successCount++;
        } else if (type === 'add_step' || type === 'complete_step') {
          // No longer supported — steps are algorithmic view, not AI-managed
          successCount++;
        } else if (type === 'update_request' && action.id && action.status) {
          const rs = getRequestsService(undefined, projectPath);
          const all = rs.getRequests();
          const r = all.find((x: any) => x.id === action.id || x.title === action.id);
          if (r) {
            rs.updateStatus(r.id, action.status);
            logActivity({ entityType: 'request', entityId: String(r.id), entityTitle: r.title, action: 'status_changed', actor, summary: `AI updated: ${r.title} → ${action.status}` });
            mainWindow?.webContents?.send('context-changed', { type: 'request', action: 'updated', entity: { id: r.id, title: r.title, status: action.status } });
            successCount++;
          } else {
            errors.push(`update_request: request "${action.id}" not found`);
            failCount++;
          }
        } else {
          errors.push(`unknown or invalid action: ${type}`);
          failCount++;
        }
      } catch (e: any) {
        errors.push(`${type}: ${e.message}`);
        failCount++;
        console.error('[ActionsJSON] Failed to execute action:', type, e);
      }
    }

    // Report execution summary back to terminal
    if (failCount > 0 || successCount > 0) {
      const summary = `[SYSTEM] actions.json: ${successCount} succeeded, ${failCount} failed.${errors.length > 0 ? ' Errors: ' + errors.join('; ') : ''}`;
      try { terminalManager.write(terminalId, summary + '\r\n'); } catch {}
    }

    // Clear the file after execution
    fs_1.default.writeFileSync(actionsPath, JSON.stringify({ actions: [] }, null, 2));
  } catch (e) {
    console.error('[ActionsJSON] executeActionsFromFile error:', e);
  }
}

// --- Tier 1.4-A: Auto re-injection message counters ---
const terminalMessageCounts = new Map<string, number>();
const RULES_REINJECT_THRESHOLD = 10;

// Runtime overrides (read by Model Improvement Dashboard IPC)
let runtimeReinjectThreshold: number | null = null;
let modelDebugMode = false;
let globalReinjectionCount = 0;
let globalActionsAttempted = 0;
let globalActionsFailed = 0;

function maybeReinjectRules(terminalId: string): boolean {
  globalReinjectionCount++;
  const threshold = runtimeReinjectThreshold ?? RULES_REINJECT_THRESHOLD;
  const t = terminalManager.terminals.get(terminalId);
  if (!t?.cwd) return false;
  const rulesPath = path_1.default.join(t.cwd, 'agent', 'RULES_COMPACT.md');
  if (!fs_1.default.existsSync(rulesPath)) return false;
  try {
    const content = fs_1.default.readFileSync(rulesPath, 'utf-8').trim();
    const reminder = `[SYSTEM] Rules reminder (auto-injected):\n${content}\n`;
    t.pty.write(reminder);
    return true;
  } catch { return false; }
}

// Watchers for actions.json per project path
const actionFileWatchers = new Map<string, any>();

function setupActionsFileWatcher(projectPath: string, terminalId: string) {
  const actionsPath = path_1.default.join(projectPath, 'agent', 'actions.json');
  if (actionFileWatchers.has(actionsPath)) return;
  
  // Create file if it doesn't exist
  if (!fs_1.default.existsSync(actionsPath)) {
    fs_1.default.mkdirSync(path_1.default.dirname(actionsPath), { recursive: true });
    fs_1.default.writeFileSync(actionsPath, JSON.stringify({ actions: [] }, null, 2));
  }

  try {
    const watcher = fs_1.default.watch(actionsPath, (eventType: string) => {
      if (eventType === 'change') {
        // Debounce: wait briefly for write to complete
        setTimeout(() => {
          executeActionsFromFile(projectPath, terminalId);
        }, 300);
      }
    });
    actionFileWatchers.set(actionsPath, watcher);
    console.log('[ActionsJSON] Watching:', actionsPath);
  } catch (e) {
    console.error('[ActionsJSON] Failed to watch:', actionsPath, e);
  }
}

electron_1.ipcMain.handle('write-agent-actions', async (_event, data: { projectPath: string; terminalId: string; actions: any[] }) => {
  try {
    if (!data.projectPath || !data.actions) return { success: false, error: 'Missing projectPath or actions' };
    const actionsPath = path_1.default.join(data.projectPath, 'agent', 'actions.json');
    fs_1.default.mkdirSync(path_1.default.dirname(actionsPath), { recursive: true });
    
    // Write actions with terminal_id for context
    const payload = { terminal_id: data.terminalId, actions: data.actions };
    fs_1.default.writeFileSync(actionsPath, JSON.stringify(payload, null, 2));
    
    // Also execute immediately
    executeActionsFromFile(data.projectPath, data.terminalId);
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

electron_1.ipcMain.handle('setup-actions-file-watcher', async (_event, data: { projectPath: string; terminalId: string }) => {
  setupActionsFileWatcher(data.projectPath, data.terminalId);
  return { success: true };
});

electron_1.ipcMain.handle('execute-actions-from-file', async (_event, data: { projectPath: string; terminalId: string }) => {
  executeActionsFromFile(data.projectPath, data.terminalId);
  return { success: true };
});

electron_1.ipcMain.handle('save-terminal-message', async (_event, data: {
    sessionId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
}) => {
    if (!db) return { success: false, error: 'No database' };
    try {
        const result = db.prepare(
            'INSERT INTO terminal_messages (session_id, role, content) VALUES (?, ?, ?)'
        ).run(data.sessionId, data.role, data.content);
        const messageId = result.lastInsertRowid;

        // Parse metadata from assistant messages
        if (data.role === 'assistant') {
            const meta = parseSessionMetadata(data.content);
            if (meta) {
                const updates: string[] = [];
                const params: any[] = [];
                if (meta.title) { updates.push('topic = ?'); params.push(meta.title); }
                if (meta.description) { updates.push('description = ?'); params.push(meta.description); }
                if (meta.status) { updates.push('status = ?'); params.push(meta.status); }
                if (meta.productArea) { updates.push('product_area = ?'); params.push(meta.productArea); }
                if (meta.category) { updates.push('category = ?'); params.push(meta.category); }
                if (meta.category) { updates.push('category_confirmed = 1'); }
                if (updates.length > 0) {
                    params.push(data.sessionId);
                    db.prepare(`UPDATE terminal_sessions SET ${updates.join(', ')} WHERE id = ?`).run(...params);
                    
                    // Generate auto-tags from metadata
                    const tags: string[] = [];
                    if (meta.category) tags.push(`category:${meta.category}`);
                    if (meta.status) tags.push(`status:${meta.status}`);
                    if (meta.productArea) tags.push(`area:${meta.productArea}`);
                    if (tags.length > 0) {
                        db.prepare('UPDATE terminal_sessions SET auto_tags = ? WHERE id = ?').run(JSON.stringify(tags), data.sessionId);
                    }
                    
                    // Notify renderer about metadata change
                    mainWindow?.webContents?.send('session-metadata-updated', {
                        sessionId: data.sessionId,
                        metadata: meta,
                        autoTags: tags,
                    });
                }
            }

            // Parse decisions, actions, status changes
            const parsedItems = parseMessageContent(data.content);
            const insertStmt = db.prepare(
                'INSERT INTO session_parsed_items (session_id, item_type, content, source_message_id) VALUES (?, ?, ?, ?)'
            );
            for (const item of parsedItems) {
                insertStmt.run(data.sessionId, item.item_type, item.content, messageId);
            }

            // Auto-create problems/requests from parsed items
            if (parsedItems.length > 0) {
                try {
                    const termRow2 = db.prepare('SELECT terminal_id FROM terminal_sessions WHERE id = ?').get(data.sessionId) as any;
                    if (termRow2?.terminal_id) {
                        const term = terminalManager.terminals.get(termRow2.terminal_id);
                        if (term?.cwd) {
                            const projectBaseDir = term.cwd;
                            let projectId: string | undefined;
                            try {
                                const projRow = db.prepare('SELECT id FROM projects WHERE path = ?').get(projectBaseDir) as any;
                                if (projRow) projectId = projRow.id;
                            } catch {}
                            const ps2 = new ProblemsService(projectBaseDir, projectId);
                            const rs2 = new RequestsService(projectBaseDir);
                            for (const item of parsedItems) {
                                if (item.item_type === 'action_item') {
                                    try {
                                        rs2.createRequest({
                                            title: item.content.substring(0, 80),
                                            description: `Auto-extracted from session ${data.sessionId}:\n\n${item.content}`,
                                            priority: 'medium',
                                            category: 'feature',
                                            sessionId: data.sessionId,
                                        });
                                    } catch (e) {
                                        console.error('[save-terminal-message] Failed to create request from parsed item:', e);
                                    }
                                }
                                if (item.item_type === 'status_change') {
                                    try {
                                        ps2.createProblem({
                                            title: item.content.substring(0, 80),
                                            description: `Auto-extracted from session ${data.sessionId}:\n\n${item.content}`,
                                            priority: 'medium',
                                            category: item.content.toLowerCase().includes('fixed') ? 'bug-fix' : 'task',
                                            sessionId: data.sessionId,
                                        });
                                    } catch (e) {
                                        console.error('[save-terminal-message] Failed to create problem from parsed item:', e);
                                    }
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error('[save-terminal-message] Failed to auto-create from parsed items:', e);
                }
            }

            // Parse and execute structured actions
            try {
                const termRow = db.prepare('SELECT terminal_id FROM terminal_sessions WHERE id = ?').get(data.sessionId) as any;
                parseAndExecuteActions(data.content, data.sessionId, 'ai:' + (getSessionAgent(data.sessionId) || 'unknown'), termRow?.terminal_id);
            } catch {}
        }

        return { success: true, id: messageId };
    } catch (err: any) {
        console.error('[DeskFlow] save-terminal-message error:', err.message);
        return { success: false, error: err.message };
    }
});

electron_1.ipcMain.handle('get-session-messages', async (_event, sessionId: string, agentType?: string) => {
    if (!db) return { success: false, error: 'No database', data: [] };
    try {
        const messages = db.prepare(
            'SELECT * FROM terminal_messages WHERE session_id = ? ORDER BY created_at ASC'
        ).all(sessionId);
        return { success: true, data: messages };
    } catch (err: any) {
        console.error('[DeskFlow] get-session-messages error:', err.message);
        return { success: false, error: err.message, data: [] };
    }
});

electron_1.ipcMain.handle('get-terminal-messages', async (_event, sessionId: string) => {
    if (!db) return [];
    try {
        return db.prepare(
            'SELECT role, content, created_at FROM terminal_messages WHERE session_id = ? ORDER BY created_at ASC'
        ).all(sessionId) as { role: string; content: string; created_at: string }[];
    } catch (err: any) {
        console.error('[IPC] get-terminal-messages error:', err.message);
        return [];
    }
});

electron_1.ipcMain.handle('summarize-session', async (_event, sessionId: string, projectPath?: string) => {
    if (!db) return { success: false, error: 'No database' };
    try {
        const session = db.prepare('SELECT id, project_id, agent, topic FROM terminal_sessions WHERE id = ?').get(sessionId) as { id: string; project_id: string; agent: string; topic: string } | undefined;
        const messages = db.prepare(
            'SELECT role, content, created_at FROM terminal_messages WHERE session_id = ? ORDER BY created_at ASC'
        ).all(sessionId) as { role: string; content: string; created_at: string }[];
        const userCount = messages.filter(m => m.role === 'user').length;
        const assistantCount = messages.filter(m => m.role === 'assistant').length;
        const totalChars = messages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
        const firstMsg = messages[0];
        const lastMsg = messages[messages.length - 1];
        const duration = firstMsg && lastMsg
            ? (new Date(lastMsg.created_at).getTime() - new Date(firstMsg.created_at).getTime()) / 1000
            : 0;
        const summary = {
            sessionId,
            agent: session?.agent || 'unknown',
            topic: session?.topic || '',
            totalMessages: messages.length,
            userCount,
            assistantCount,
            totalChars,
            durationSeconds: duration,
            firstMessageAt: firstMsg?.created_at,
            lastMessageAt: lastMsg?.created_at,
            truncated: messages.slice(-10).map(m => ({ role: m.role, preview: (m.content || '').substring(0, 200) })),
            summarizedAt: new Date().toISOString(),
        };
        // Persist to session-summaries.json if we have a project path
        if (projectPath) {
            const contextDir = path_1.default.join(projectPath, 'agent', 'context');
            const summariesFile = path_1.default.join(contextDir, 'session-summaries.json');
            if (!fs_1.default.existsSync(contextDir)) {
                fs_1.default.mkdirSync(contextDir, { recursive: true });
            }
            let existing: any[] = [];
            if (fs_1.default.existsSync(summariesFile)) {
                try { existing = JSON.parse(fs_1.default.readFileSync(summariesFile, 'utf8')); } catch { existing = []; }
            }
            existing.push(summary);
            // Keep only last 50 summaries
            if (existing.length > 50) existing = existing.slice(-50);
            fs_1.default.writeFileSync(summariesFile, JSON.stringify(existing, null, 2));
        }
        return { success: true, data: summary };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
});

// ========== Context Maintenance IPC ==========

electron_1.ipcMain.handle('get-context-systems', async (_event, projectPath?: string) => {
    const projPath = projectPath || (global as any).__projectPath || '';
    if (!projPath) return { success: false, data: [] };

    const fs = fs_1.default;
    const path = path_1.default;

    // --- mtime helpers --------------------------------------------------------
    const toIso = (ms) => (ms > 0 ? new Date(ms).toISOString() : null);
    const mtimeOf = (file) => {
        try { const st = fs.statSync(file); return st.isFile() ? st.mtimeMs : 0; }
        catch { return 0; }
    };
    const newestInDir = (dir, match) => {
        if (!fs.existsSync(dir)) return 0;
        return fs.readdirSync(dir).reduce((n, f) => (match(f) ? Math.max(n, mtimeOf(path.join(dir, f))) : n), 0);
    };
    const newestRecursive = (dir, match) => {
        if (!fs.existsSync(dir)) return 0;
        let newest = 0;
        const stack = [dir];
        while (stack.length) {
            const cur = stack.pop();
            let entries = [];
            try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch { continue; }
            for (const e of entries) {
                const full = path.join(cur, e.name);
                if (e.isDirectory()) stack.push(full);
                else if (e.isFile() && match(e.name)) newest = Math.max(newest, mtimeOf(full));
            }
        }
        return newest;
    };
    const newestSkillMd = (skillsDir) => {
        if (!fs.existsSync(skillsDir)) return 0;
        let newest = 0;
        let dirs = [];
        try { dirs = fs.readdirSync(skillsDir, { withFileTypes: true }); } catch { return 0; }
        for (const d of dirs) {
            if (d.isDirectory()) newest = Math.max(newest, mtimeOf(path.join(skillsDir, d.name, 'SKILL.md')));
        }
        return newest;
    };

    const agentDir = path.join(projPath, 'agent');
    const skillsDir = path.join(agentDir, 'skills');

    type Sys = {
        id: string;
        name: string;
        itemCount: number;
        itemLabel: string;
        available: boolean;
        lastBuilt: string | null;
        error: string | null;
    };

    const MISSING = { itemCount: 0, itemLabel: '', available: false, lastBuiltMs: 0 };

    const build = (id, name, fn) => {
        try {
            const r = fn();
            return { id, name, itemCount: r.itemCount, itemLabel: r.itemLabel, available: r.available, lastBuilt: toIso(r.lastBuiltMs), error: null };
        } catch (e) {
            return { id, name, itemCount: 0, itemLabel: '', available: false, lastBuilt: null, error: e?.message || 'Path not found' };
        }
    };

    const systems = [
        build('llm_wiki', 'LLM Wiki', () => {
            if (!fs.existsSync(agentDir)) return MISSING;
            const md = fs.readdirSync(agentDir).filter((f) => f.endsWith('.md'));
            return { itemCount: md.length, itemLabel: 'files', available: true, lastBuiltMs: newestInDir(agentDir, (f) => f.endsWith('.md')) };
        }),
        build('obsidian_skills', 'Obsidian Skills', () => {
            if (!fs.existsSync(skillsDir)) return MISSING;
            const dirs = fs.readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory());
            return { itemCount: dirs.length, itemLabel: 'skills', available: true, lastBuiltMs: newestSkillMd(skillsDir) };
        }),
        build('graphify', 'Graphify', () => {
            const graphFile = path.join(projPath, 'graphify-out', 'graph.json');
            if (!fs.existsSync(graphFile)) return MISSING;
            let nodeCount = 0, edgeCount = 0;
            try { const g = JSON.parse(fs.readFileSync(graphFile, 'utf-8')); nodeCount = g.nodes?.length || 0; edgeCount = g.edges?.length || 0; } catch {}
            return { itemCount: nodeCount, itemLabel: `nodes · ${edgeCount} edges`, available: true, lastBuiltMs: mtimeOf(graphFile) };
        }),
        build('para', 'PARA', () => {
            const paraDir = path.join(projPath, 'CZVault');
            if (!fs.existsSync(paraDir)) return MISSING;
            const areas = fs.readdirSync(paraDir, { withFileTypes: true }).filter((d) => d.isDirectory());
            return { itemCount: areas.length, itemLabel: 'areas', available: true, lastBuiltMs: newestRecursive(paraDir, (f) => f.endsWith('.md')) };
        }),
        build('qmd', 'QMD Templates', () => {
            const templatesDir = path.join(agentDir, 'templates');
            if (!fs.existsSync(templatesDir)) return MISSING;
            const qmd = fs.readdirSync(templatesDir).filter((f) => f.endsWith('.qmd'));
            return { itemCount: qmd.length, itemLabel: 'templates', available: true, lastBuiltMs: newestInDir(templatesDir, (f) => f.endsWith('.qmd')) };
        }),
        build('automations', 'Automations', () => {
            const autoFile = path.join(agentDir, 'automations', 'automations.json');
            if (!fs.existsSync(autoFile)) return MISSING;
            let count = 0;
            try { const j = JSON.parse(fs.readFileSync(autoFile, 'utf-8')); count = Array.isArray(j) ? j.length : j.automations?.length || j.rules?.length || 0; } catch {}
            return { itemCount: count, itemLabel: 'automations', available: true, lastBuiltMs: mtimeOf(autoFile) };
        }),
        build('design_skills', 'Design Skills', () => {
            if (!fs.existsSync(skillsDir)) return MISSING;
            const dirs = fs.readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory());
            return { itemCount: dirs.length, itemLabel: 'design skills', available: true, lastBuiltMs: newestSkillMd(skillsDir) };
        }),
    ];

    return { success: true, data: systems };
});

electron_1.ipcMain.handle('get-session-summaries', async (_event, opts?: { limit?: number; offset?: number }) => {
    const projPath = (global as any).__projectPath || '';
    if (!projPath) return { success: false, data: [] };
    const summariesFile = path_1.default.join(projPath, 'agent', 'context', 'session-summaries.json');
    if (!fs_1.default.existsSync(summariesFile)) return { success: true, data: [] };
    try {
        const data = JSON.parse(fs_1.default.readFileSync(summariesFile, 'utf-8'));
        const summaries = Array.isArray(data) ? data : (data.summaries || []);
        const offset = opts?.offset || 0;
        const limit = opts?.limit || 20;
        return { success: true, data: summaries.slice(offset, offset + limit) };
    } catch { return { success: true, data: [] }; }
});

electron_1.ipcMain.handle('get-deep-memory', async () => {
    const projPath = (global as any).__projectPath || '';
    if (!projPath) return { success: false, data: { patterns: [], preferences: [], project_insights: [] } };
    const memoryFile = path_1.default.join(projPath, 'agent', 'context', 'deep-memory.json');
    if (!fs_1.default.existsSync(memoryFile)) return { success: true, data: { patterns: [], preferences: [], project_insights: [] } };
    try {
        return { success: true, data: JSON.parse(fs_1.default.readFileSync(memoryFile, 'utf-8')) };
    } catch { return { success: true, data: { patterns: [], preferences: [], project_insights: [] } }; }
});

electron_1.ipcMain.handle('get-rag-stats', async (_event, projectPath?: string) => {
    const projPath = projectPath || (global as any).__projectPath || '';
    if (!projPath) {
        return { success: false, data: { totalMessages: 0, lastUpdated: new Date().toISOString(), indexSize: 0 } };
    }
    const ragIndexFile = path_1.default.join(projPath, '.apptracker', 'context', 'rag-index.sqlite');
    let totalMessages = 0, indexSize = 0;
    if (fs_1.default.existsSync(ragIndexFile)) {
        try {
            const stats = fs_1.default.statSync(ragIndexFile);
            indexSize = stats.size;
            const Database = require('better-sqlite3');
            const ragDb = new Database(ragIndexFile);
            const row = ragDb.prepare('SELECT COUNT(*) as count FROM messages').get() as any;
            totalMessages = row?.count || 0;
            ragDb.close();
        } catch {}
    }
    return {
        success: true,
        data: { totalMessages, lastUpdated: new Date().toISOString(), indexSize },
    };
});

electron_1.ipcMain.handle('get-prompt-history', async (_event, { projectId, limit = 200 }: { projectId?: string; limit?: number }) => {
  if (!db) return { success: false, error: 'No database', data: [] };
  try {
    // Auto-settle stale in_progress records
    db.prepare(`UPDATE terminal_messages SET status = 'completed' WHERE status = 'in_progress' AND created_at < datetime('now', '-15 minutes')`).run();
    let query = `
      SELECT
        tm.id,
        tm.session_id,
        tm.role,
        tm.content AS prompt,
        tm.created_at AS sent_at,
        ts.id AS session_id_ref,
        ts.topic AS session_topic,
        ts.agent,
        ts.category,
        ts.product_area,
        ts.status AS session_status,
        tb.active_problem_id,
        tb.active_request_id,
        tb.project_id,
        tb.agent_type AS binding_agent
      FROM terminal_messages tm
      LEFT JOIN terminal_sessions ts ON ts.terminal_id = tm.session_id
      LEFT JOIN terminal_bindings tb ON tb.terminal_id = tm.session_id
    `;
    const params: any[] = [];
    if (projectId) {
      query += ` AND (tb.project_id = ? OR ts.project_id = ?)`;
      params.push(projectId, projectId);
    }
    query += ` ORDER BY tm.created_at DESC LIMIT ?`;
    params.push(limit);

    const rows = db.prepare(query).all(...params);
    return { success: true, data: rows };
  } catch (err: any) {
    console.error('[DeskFlow] get-prompt-history error:', err.message);
    return { success: false, error: err.message, data: [] };
  }
});

electron_1.ipcMain.handle('delete-terminal-message', async (_event, { id }: { id: number }) => {
  if (!db) return { success: false, error: 'No database' };
  try {
    db.prepare('DELETE FROM terminal_messages WHERE id = ?').run(id);
    return { success: true };
  } catch (err: any) {
    console.error('[DeskFlow] delete-terminal-message error:', err.message);
    return { success: false, error: err.message };
  }
});

// Terminal window management - opens terminal in a new BrowserWindow
const terminalWindows = new Map<string, any>();

electron_1.ipcMain.handle('create-terminal-window', async (_event, options?: { terminalId?: string; cwd?: string }) => {
    const { BrowserWindow } = require('electron');
    const terminalId = options?.terminalId || `term-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Check if window already exists
    if (terminalWindows.has(terminalId)) {
        const existing = terminalWindows.get(terminalId);
        existing.focus();
        return { success: true, terminalId, windowId: existing.id };
    }
    
    const terminalWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        title: 'DeskFlow Terminal',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path_1.default.join(__dirname, 'preload.cjs'),
        },
    });
    
    // Load terminal HTML (create a simple terminal viewer page)
    const terminalHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>DeskFlow Terminal</title>
    <style>
        body { margin: 0; padding: 10px; background: #1a1a1a; color: #fff; font-family: monospace; }
        #output { white-space: pre-wrap; }
        #input { width: 100%; background: #2a2a2a; border: none; color: #fff; padding: 5px; font-family: monospace; }
    </style>
</head>
<body>
    <div id="output"></div>
    <input id="input" type="text" placeholder="Enter command..." autofocus />
    <script>
        const api = window.deskflowAPI;
        const output = document.getElementById('output');
        const input = document.getElementById('input');
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const cmd = input.value;
                if (cmd) {
                    output.textContent += '> ' + cmd + '\\n';
                    api.sendTerminalCommand(cmd);
                    input.value = '';
                }
            }
        });
        
        api.onTerminalOutput((data) => {
            output.textContent += data + '\\n';
        });
    </script>
</body>
</html>
    `;
    
    terminalWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(terminalHtml));
    terminalWindows.set(terminalId, terminalWindow);
    
    terminalWindow.on('closed', () => {
        terminalWindows.delete(terminalId);
    });
    
    return { success: true, terminalId, windowId: terminalWindow.id };
});

// Debug: Check which AI agents are detected
electron_1.ipcMain.handle('debug-ai-agents', async () => {
    const agentStatus: Record<string, { detected: boolean; paths: string[]; sampleFiles?: string[]; totalFiles?: number }> = {};

    for (const plugin of AI_AGENT_PLUGINS) {
        try {
            const isDetected = await plugin.detect();
            const paths = plugin.getStoragePaths();
            const sampleFiles: string[] = [];
            let totalFiles = 0;

            for (const p of paths) {
                if (!fs_1.default.existsSync(p)) continue;
                const stat = fs_1.default.statSync(p);
                if (stat.isFile()) {
                    sampleFiles.push(path_1.default.basename(p));
                    totalFiles++;
                    continue;
                }
                if (!stat.isDirectory()) continue;

                // For project-based agents (Qwen: projects/*/chats/, Gemini: tmp/*/chats/)
                // Check for a nested chats structure
                const hasChatsSubdir = (dir: string): boolean => {
                    try {
                        const items = fs_1.default.readdirSync(dir);
                        for (const item of items) {
                            const itemPath = path_1.default.join(dir, item);
                            try {
                                if (fs_1.default.statSync(itemPath).isDirectory()) {
                                    const chatsPath = path_1.default.join(itemPath, 'chats');
                                    if (fs_1.default.existsSync(chatsPath) && fs_1.default.statSync(chatsPath).isDirectory()) {
                                        return true;
                                    }
                                }
                            } catch {}
                        }
                    } catch {}
                    return false;
                };

                if (hasChatsSubdir(p)) {
                    // Nested structure: project dirs → chats → files
                    const projectDirs = fs_1.default.readdirSync(p);
                    let displayCount = 0;
                    for (const projectDir of projectDirs) {
                        const projectPath = path_1.default.join(p, projectDir);
                        try {
                            if (!fs_1.default.statSync(projectPath).isDirectory()) continue;
                            const chatsPath = path_1.default.join(projectPath, 'chats');
                            if (!fs_1.default.existsSync(chatsPath)) continue;
                            const chatFiles = fs_1.default.readdirSync(chatsPath).filter(f => f.endsWith('.jsonl') || f.endsWith('.json'));
                            totalFiles += chatFiles.length;
                            if (displayCount < 3 && chatFiles.length > 0) {
                                sampleFiles.push(`${projectDir}/chats/ (${chatFiles.length} sessions)`);
                                displayCount++;
                            }
                        } catch {}
                    }
                    if (projectDirs.length > 3) {
                        sampleFiles.push(`...and ${projectDirs.length - 3} more projects`);
                    }
                } else {
                    // Flat structure or database file
                    try {
                        const allFiles = fs_1.default.readdirSync(p);
                        const dataFiles = allFiles.filter(f => f.endsWith('.jsonl') || f.endsWith('.json') || f.endsWith('.db'));
                        totalFiles += dataFiles.length;

                        // Show up to 5 sample files
                        const shown = allFiles.slice(0, 5);
                        for (const f of shown) {
                            const fullPath = path_1.default.join(p, f);
                            try {
                                const fStat = fs_1.default.statSync(fullPath);
                                if (fStat.isFile()) {
                                    if (f.endsWith('.db')) {
                                        sampleFiles.push(`${f} (${(fStat.size / 1024).toFixed(1)} KB)`);
                                    } else {
                                        sampleFiles.push(f);
                                    }
                                } else if (fStat.isDirectory()) {
                                    const subFiles = fs_1.default.readdirSync(fullPath);
                                    sampleFiles.push(`${f}/ (dir, ${subFiles.length} items)`);
                                }
                            } catch {}
                        }
                        if (allFiles.length > 5) {
                            sampleFiles.push(`...and ${allFiles.length - 5} more`);
                        }
                    } catch {}
                }
            }

            agentStatus[plugin.id] = { detected: isDetected, paths, sampleFiles, totalFiles };
        } catch (err: any) {
            agentStatus[plugin.id] = { detected: false, paths: [err.message], sampleFiles: [], totalFiles: 0 };
        }
    }

    let dbState = null;
    if (!useJson && db) {
        try {
            const count = db.prepare('SELECT COUNT(*) as count FROM ai_usage').get() as { count: number };
            const totalTokens = db.prepare('SELECT SUM(input_tokens + output_tokens) as total FROM ai_usage').get() as { total: number };
            const byTool = db.prepare('SELECT tool, COUNT(*) as count FROM ai_usage GROUP BY tool').all() as { tool: string; count: number }[];
            dbState = { totalRecords: count.count, totalTokens: totalTokens.total || 0, byTool };
        } catch (err: any) {
            dbState = { error: err.message };
        }
    }

    return { agents: agentStatus, database: dbState };
});

// Sync commits from a local Git repository
electron_1.ipcMain.handle('sync-commits', async (event, projectId: string, repoPath: string) => {
    if (useJson) return { success: false, message: 'Commit sync requires SQLite' };

    const results = { commits: 0, errors: [] as string[] };

    try {
        const { execSync } = require('child_process');

        // Get commit log from git
        let gitOutput: string;
        try {
            gitOutput = execSync(`git log --format="%H|%an|%ae|%ai|%s" -n 500`, {
                cwd: repoPath,
                encoding: 'utf8',
                maxBuffer: 10 * 1024 * 1024
            });
        } catch (gitErr: any) {
            return { success: false, message: `Not a git repository or no commits: ${gitErr.message}` };
        }

        const lines = gitOutput.trim().split('\n').filter(Boolean);

        for (const line of lines) {
            const [sha, author, authorEmail, date, message] = line.split('|');

            // Get diff stats for this commit
            let additions = 0;
            let deletions = 0;
            let filesChanged = 0;

            try {
                const statsOutput = execSync(`git show --numstat --format="" ${sha}`, {
                    cwd: repoPath,
                    encoding: 'utf8'
                });

                const statLines = statsOutput.trim().split('\n').filter(Boolean);
                filesChanged = statLines.length;

                for (const statLine of statLines) {
                    const parts = statLine.trim().split('\t');
                    if (parts.length >= 3) {
                        const add = parseInt(parts[0], 10);
                        const del = parseInt(parts[1], 10);
                        if (!isNaN(add)) additions += add;
                        if (!isNaN(del)) deletions += del;
                    }
                }
            } catch {}

            const id = `commit-${sha}`;
            const commitDate = new Date(date).toISOString();

            try {
                db!.prepare(`
                    INSERT OR REPLACE INTO commits (id, project_id, sha, author, author_email, date, message, additions, deletions, files_changed)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(id, projectId, sha, author, authorEmail, commitDate, message, additions, deletions, filesChanged);

                results.commits++;
            } catch (dbErr: any) {
                if (!dbErr.message.includes('UNIQUE constraint')) {
                    console.error('[DeskFlow] Commit DB error:', dbErr.message);
                }
            }
        }

        // Update project's last_activity_at
        db!.prepare(`UPDATE projects SET last_activity_at = ? WHERE id = ?`)
            .run(new Date().toISOString(), projectId);

        console.log(`[DeskFlow] Synced ${results.commits} commits from ${repoPath}`);
        return { success: true, ...results };

    } catch (err: any) {
        console.error('[DeskFlow] Commit sync error:', err);
        return { success: false, message: err.message };
    }
});

// Sync commits from GitHub API
electron_1.ipcMain.handle('sync-github-commits', async (event, projectId: string, owner: string, repo: string, token?: string) => {
    if (useJson) return { success: false, message: 'GitHub sync requires SQLite' };

    const results = { commits: 0, errors: [] as string[] };

    try {
        const headers: Record<string, string> = {
            'Accept': 'application/vnd.github.v3+json',
            'X-GitHub-Api-Version': '2022-11-28'
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // Fetch recent commits
        const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/commits?per_page=100`,
            { headers }
        );

        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, message: `GitHub API error: ${response.status} - ${errorText}` };
        }

        const commits = await response.json() as any[];

        for (const commit of commits) {
            const sha = commit.sha;
            const author = commit.commit?.author?.name || 'Unknown';
            const authorEmail = commit.commit?.author?.email || '';
            const date = commit.commit?.author?.date || new Date().toISOString();
            const message = commit.commit?.message?.split('\n')[0] || '';
            const additions = commit.stats?.additions || 0;
            const deletions = commit.stats?.deletions || 0;
            const filesChanged = commit.files?.length || 0;

            const id = `github-${sha}`;
            const commitDate = new Date(date).toISOString();

            try {
                db!.prepare(`
                    INSERT OR REPLACE INTO commits (id, project_id, sha, author, author_email, date, message, additions, deletions, files_changed)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(id, projectId, sha, author, authorEmail, commitDate, message, additions, deletions, filesChanged);

                results.commits++;
            } catch (dbErr: any) {
                if (!dbErr.message.includes('UNIQUE constraint')) {
                    console.error('[DeskFlow] GitHub commit DB error:', dbErr.message);
                }
            }
        }

        console.log(`[DeskFlow] Synced ${results.commits} commits from GitHub ${owner}/${repo}`);
        return { success: true, ...results };

    } catch (err: any) {
        console.error('[DeskFlow] GitHub commit sync error:', err);
        return { success: false, message: err.message };
    }
});

// Get DORA metrics for a project
electron_1.ipcMain.handle('get-dora-metrics', (event, projectId: string, period: 'week' | 'month' = 'month') => {
    if (useJson) return null;

    try {
        const days = period === 'week' ? 7 : 30;
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        // Get commits in period
        const commitStats = db!.prepare(`
            SELECT
                COUNT(*) as total_commits,
                SUM(additions) as total_additions,
                SUM(deletions) as total_deletions,
                COUNT(DISTINCT DATE(date)) as active_days,
                MIN(date) as first_commit,
                MAX(date) as last_commit
            FROM commits
            WHERE project_id = ? AND date >= ?
        `).get(projectId, cutoffDate) as any;

        if (!commitStats || commitStats.total_commits === 0) {
            return {
                projectId,
                period,
                deploymentFrequency: 0,
                leadTimeHours: 0,
                changeFailureRate: 0,
                meanTimeToRecoveryHours: 0,
                level: 'low' as const,
                commitCount: 0,
                totalLines: 0,
                activeDays: 0,
                message: 'No commits found in this period'
            };
        }

        // Estimate deployment frequency (commits that look like deploys)
        // For now, count commits to main/master as "deployments"
        const deployments = db!.prepare(`
            SELECT COUNT(*) as count FROM commits
            WHERE project_id = ? AND date >= ?
            AND (message LIKE '%deploy%' OR message LIKE '%release%' OR message LIKE '%publish%')
        `).get(projectId, cutoffDate) as any;

        const deploymentFrequency = (deployments?.count || 0) / days;

        // Calculate lines of code changed
        const totalLines = (commitStats.total_additions || 0) + (commitStats.total_deletions || 0);

        // Determine DORA level based on deployment frequency
        let level: 'elite' | 'high' | 'medium' | 'low';
        if (deploymentFrequency >= 1) {
            level = 'elite'; // Multiple deploys per day
        } else if (deploymentFrequency >= 0.1) {
            level = 'high'; // Weekly to daily
        } else if (deploymentFrequency >= 0.03) {
            level = 'medium'; // Monthly
        } else {
            level = 'low'; // Less than monthly
        }

        // Calculate lead time (simplified: average time between commits)
        let leadTimeHours = 0;
        if (commitStats.active_days > 1) {
            leadTimeHours = (days * 24) / commitStats.active_days;
        }

        // Change failure rate: deployment commits followed by terminal errors within 24h
        let changeFailureRate = 0;
        try {
            const deployCommits = db!.prepare(`
                SELECT id, date, message FROM commits
                WHERE project_id = ? AND date >= ?
                AND (message LIKE '%deploy%' OR message LIKE '%release%' OR message LIKE '%publish%')
            `).all(projectId, cutoffDate) as any[];

            if (deployCommits.length > 0) {
                const errorSessionsForCFR = db!.prepare(`
                    SELECT created_at FROM terminal_sessions
                    WHERE project_id = ? AND status = 'error' AND created_at >= ?
                `).all(projectId, cutoffDate) as any[];

                let failedDeployments = 0;
                for (const commit of deployCommits) {
                    try {
                        const commitTime = new Date(commit.date).getTime();
                        if (isNaN(commitTime)) continue;
                        const hasFailure = errorSessionsForCFR.some((s: any) => {
                            try {
                                const sessionTime = new Date(s.created_at).getTime();
                                return !isNaN(sessionTime)
                                    && sessionTime >= commitTime
                                    && sessionTime <= commitTime + 86400000;
                            } catch { return false; }
                        });
                        if (hasFailure) failedDeployments++;
                    } catch { continue; }
                }
                changeFailureRate = failedDeployments / deployCommits.length;
            }
        } catch (e) {
            console.warn('[DORA] CFR calculation failed:', e);
            changeFailureRate = 0;
        }

        // MTTR: average time from error session to next successful session
        let meanTimeToRecoveryHours = 0;
        try {
            const errorSessionsForMTTR = db!.prepare(`
                SELECT id, created_at FROM terminal_sessions
                WHERE project_id = ? AND status = 'error' AND created_at >= ?
                ORDER BY created_at ASC
            `).all(projectId, cutoffDate) as any[];

            if (errorSessionsForMTTR.length > 0) {
                const successfulSessions = db!.prepare(`
                    SELECT created_at FROM terminal_sessions
                    WHERE project_id = ? AND status NOT IN ('error', 'stopped') AND created_at >= ?
                    ORDER BY created_at ASC
                `).all(projectId, cutoffDate) as any[];

                let totalRecoveryHours = 0;
                let recoveredCount = 0;

                for (const errSession of errorSessionsForMTTR) {
                    const errTime = new Date(errSession.created_at).getTime();
                    if (isNaN(errTime)) continue;

                    for (const s of successfulSessions) {
                        const successTime = new Date(s.created_at).getTime();
                        if (isNaN(successTime) || successTime <= errTime) continue;

                        const hours = (successTime - errTime) / 3600000;
                        if (hours >= 0 && hours < 720) {
                            totalRecoveryHours += hours;
                            recoveredCount++;
                        }
                        break;
                    }
                }

                meanTimeToRecoveryHours = recoveredCount > 0
                    ? totalRecoveryHours / recoveredCount
                    : 0;
            }
        } catch (e) {
            console.warn('[DORA] MTTR calculation failed:', e);
            meanTimeToRecoveryHours = 0;
        }

        return {
            projectId,
            period,
            deploymentFrequency: Math.round(deploymentFrequency * 100) / 100,
            leadTimeHours: Math.round(leadTimeHours * 10) / 10,
            changeFailureRate,
            meanTimeToRecoveryHours,
            level,
            commitCount: commitStats.total_commits,
            totalLines,
            activeDays: commitStats.active_days
        };

    } catch (err) {
        console.error('[DeskFlow] DORA metrics error:', err);
        return null;
    }
});

// Get commit history for a project
electron_1.ipcMain.handle('get-commit-history', (event, projectId: string, limit: number = 50) => {
    if (useJson) return [];

    try {
        return db!.prepare(`
            SELECT * FROM commits
            WHERE project_id = ?
            ORDER BY date DESC
            LIMIT ?
        `).all(projectId, limit);
    } catch {
        return [];
    }
});

// Get contributor stats for a project
electron_1.ipcMain.handle('get-contributor-stats', (event, projectId: string) => {
    if (useJson) return [];

    try {
        return db!.prepare(`
            SELECT
                author,
                author_email,
                COUNT(*) as commit_count,
                SUM(additions) as total_additions,
                SUM(deletions) as total_deletions,
                MIN(date) as first_commit,
                MAX(date) as last_commit
            FROM commits
            WHERE project_id = ?
            GROUP BY author_email
            ORDER BY commit_count DESC
        `).all(projectId);
    } catch {
        return [];
    }
});

// Get git diff (staged or working) for a project
electron_1.ipcMain.handle('get-git-diff', (event, projectId: string, diffType: 'cached' | 'working' = 'cached') => {
    if (useJson) return { success: false, message: 'Requires SQLite' };
    try {
        const repoPath = db!.prepare('SELECT path FROM projects WHERE id = ?').get(projectId);
        if (!repoPath || !repoPath.path) return { success: false, message: 'Project path not found' };

        const flag = diffType === 'cached' ? '--cached' : '';
        const diff = (0, child_process_1.execSync)(`git diff ${flag}`, {
            cwd: repoPath.path,
            encoding: 'utf8',
            maxBuffer: 10 * 1024 * 1024
        });
        return { success: true, diff };
    } catch (err) {
        return { success: false, message: err instanceof Error ? err.message : String(err) };
    }
});

// Save file handler for exports - opens file dialog to let user choose location
electron_1.ipcMain.handle('save-file', async (event, options) => {
    try {
        const { content, filename, fileType } = options;
        const downloadsPath = electron_1.app.getPath('downloads');
        
        // Show save dialog to let user choose where to save
        const result = await electron_1.dialog.showSaveDialog({
            title: 'Save Export File',
            defaultPath: path_1.default.join(downloadsPath, filename),
            filters: [
                { name: fileType === 'application/json' ? 'JSON' : 'CSV', extensions: [fileType === 'application/json' ? 'json' : 'csv'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        
        if (result.canceled || !result.filePath) {
            return { success: false, message: 'Save cancelled' };
        }
        
        fs_1.default.writeFileSync(result.filePath, content);
        console.log(`[DeskFlow] File saved: ${result.filePath}`);
        return { success: true, path: result.filePath };
    }
    catch (err) {
        console.error('[DeskFlow] Save file error:', err);
        return { success: false, message: err.message };
    }
});

// ========== AI Features ==========
// Helper to get OpenRouter API key (preferences > env var)
function getOpenRouterApiKey(): string {
    // Check user preferences first (set via Settings UI)
    let prefsKey = userPreferences?.openrouterApiKey || '';
    prefsKey = prefsKey.trim().replace(/^["']|["']$/g, ''); // Strip quotes and whitespace
    if (prefsKey) {
        console.log('[DeskFlow] Using OpenRouter API key from preferences');
        return prefsKey;
    }
    // Fallback to SQLite preferences table (legacy saves)
    try {
        const row = db!.prepare('SELECT value FROM preferences WHERE key = ?').get('openrouterApiKey') as any;
        if (row?.value) {
            let sqliteKey = row.value.trim().replace(/^["']|["']$/g, '');
            if (sqliteKey) {
                console.log('[DeskFlow] Using OpenRouter API key from SQLite preferences');
                userPreferences = userPreferences || {};
                userPreferences.openrouterApiKey = sqliteKey;
                savePreferences();
                return sqliteKey;
            }
        }
    } catch {}
    // Fallback to environment variable (from .env file or OS env)
    let envKey = process.env.OPENROUTER_API_KEY || '';
    envKey = envKey.trim().replace(/^["']|["']$/g, ''); // Strip quotes and whitespace
    if (envKey) {
        console.log('[DeskFlow] Using OpenRouter API key from environment');
        return envKey;
    }
    console.warn('[DeskFlow] OpenRouter API key not found in preferences or environment');
    return '';
}

// Helper to extract JSON from AI response (handles markdown code blocks, trailing commas, etc.)
function extractJsonFromResponse(content: string): any {
    let cleaned = content.trim();
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) cleaned = codeBlockMatch[1].trim();
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    if (firstBrace === -1 && firstBracket === -1) throw new Error('No JSON object or array found');
    const start = firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace) ? firstBracket : firstBrace;
    const endChar = start === firstBracket ? ']' : '}';
    let depth = 0, inString = false, end = -1;
    for (let i = start; i < cleaned.length; i++) {
        const ch = cleaned[i];
        if (inString) { if (ch === '\\') i++; else if (ch === '"') inString = false; continue; }
        if (ch === '"') { inString = true; continue; }
        if (ch === '{' || ch === '[') depth++;
        if (ch === '}' || ch === ']') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end === -1) throw new Error('Unmatched JSON brace/bracket');
    let json = cleaned.slice(start, end + 1);
    json = json.replace(/,\s*([}\]])/g, '$1');
    json = json.replace(/\.\.\./g, '"..."');
    return JSON.parse(json);
}

// ========== Auto-Assign Routing Helpers ==========

interface AutoAssignConfig {
  enabled: boolean;
  routingModel: string;
  summaryFrequency: number;
  autoRename: boolean;
  renameThreshold: number;
  confidenceThreshold: number;
  autoCreateSessions: boolean;
}

const DEFAULT_AUTO_ASSIGN_CONFIG: AutoAssignConfig = {
  enabled: false,
  routingModel: 'anthropic/claude-3.5-haiku',
  summaryFrequency: 10,
  autoRename: false,
  renameThreshold: 5,
  confidenceThreshold: 0.7,
  autoCreateSessions: false,
};

function loadAutoAssignConfig(): AutoAssignConfig {
  try {
    const configPath = path_1.default.join(userDataPath, 'auto-assign-config.json');
    if (fs_1.default.existsSync(configPath)) {
      return { ...DEFAULT_AUTO_ASSIGN_CONFIG, ...JSON.parse(fs_1.default.readFileSync(configPath, 'utf8')) };
    }
  } catch {}
  return { ...DEFAULT_AUTO_ASSIGN_CONFIG };
}

function saveAutoAssignConfigFile(config: AutoAssignConfig): void {
  fs_1.default.writeFileSync(path_1.default.join(userDataPath, 'auto-assign-config.json'), JSON.stringify(config, null, 2));
}

function generateSessionName(prompt: string): string {
  const words = prompt.replace(/[^a-zA-Z0-9\s-]/g, '').split(/\s+/).filter((w: string) => w.length > 2);
  return words.slice(0, 4).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') || 'New Session';
}

const ROUTING_MODEL_PRICING: Record<string, { inputPerM: number; outputPerM: number }> = {
  'anthropic/claude-3.5-haiku': { inputPerM: 0.80, outputPerM: 4.00 },
  'anthropic/claude-3-haiku': { inputPerM: 0.25, outputPerM: 1.25 },
  'google/gemini-2.0-flash-001': { inputPerM: 0.10, outputPerM: 0.40 },
  'openai/gpt-4o-mini': { inputPerM: 0.15, outputPerM: 0.60 },
};

function computeRoutingCost(inputTokens: number, outputTokens: number, model: string): number {
  const pricing = ROUTING_MODEL_PRICING[model] || ROUTING_MODEL_PRICING['anthropic/claude-3.5-haiku'];
  return (inputTokens / 1_000_000 * pricing.inputPerM) + (outputTokens / 1_000_000 * pricing.outputPerM);
}

function logRoutingCost(entry: { callType: string; model: string; inputTokens: number; outputTokens: number; costUsd: number; sessionId?: string; promptPreview?: string }) {
  if (!db) return;
  try {
    db.prepare(`INSERT INTO routing_costs (call_type, model, input_tokens, output_tokens, cost_usd, session_id, prompt_preview) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(entry.callType, entry.model, entry.inputTokens, entry.outputTokens, entry.costUsd, entry.sessionId || null, entry.promptPreview || null);
  } catch (err) {
    console.error('[RoutingCost] Failed to log:', err);
  }
}

// Call OpenRouter API for routing/summary calls
async function callOpenRouter(systemPrompt: string, userPrompt: string, options: { model: string; maxTokens: number; temperature: number }): Promise<{ content: string; usage?: { prompt_tokens: number; completion_tokens: number } }> {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) throw new Error('No OpenRouter API key configured');
  const response = await fetch(OPENROUTER_BASE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://deskflow.app',
    },
    body: JSON.stringify({
      model: options.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      stream: true,
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${errText.slice(0, 200)}`);
  }
  
  // Handle streaming response
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not readable');
  }
  
  const decoder = new TextDecoder();
  let fullContent = '';
  let usage = { prompt_tokens: 0, completion_tokens: 0 };
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        
        try {
          const parsed = JSON.parse(data);
          
          // Extract content from delta
          if (parsed.choices?.[0]?.delta?.content) {
            fullContent += parsed.choices[0].delta.content;
          }
          
          // Extract usage information
          if (parsed.usage) {
            usage = {
              prompt_tokens: parsed.usage.prompt_tokens || 0,
              completion_tokens: parsed.usage.completion_tokens || 0,
            };
          }
        } catch (e) {
          // Skip invalid JSON lines
          continue;
        }
      }
    }
  }
  
  return { content: fullContent, usage: usage };
}

// OpenRouter API base configuration
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODELS = [
    'liquid/lfm-2.5-1.2b-instruct:free',
    'anthropic/claude-3.5-sonnet',
    'anthropic/claude-3-sonnet',
    'openai/gpt-4o-mini',
    'google/gemini-flash-1.5'
];

// System prompt for color generation
const COLOR_SYSTEM_PROMPT = `You are a color palette expert. Your task is to generate brand-appropriate hex color codes for apps and websites.
Rules:
- Return ONLY valid JSON, no markdown, no explanations
- Use vibrant but professional colors
- Consider the app's purpose and brand identity
- Always return 6-digit hex codes with # prefix`;

// System prompt for categorization
const CATEGORY_SYSTEM_PROMPT = `You are a productivity app categorization expert. Your task is to categorize apps and websites into predefined categories.
Rules:
- Return ONLY valid JSON, no markdown, no explanations
- Use exactly these categories: IDE, AI Tools, Browser, Entertainment, Communication, Design, Productivity, Tools, Education, Developer Tools, Search Engine, News, Shopping, Social Media, Uncategorized, Other
- Be accurate and consistent`;

// Generate AI colors for apps/websites using OpenRouter API
electron_1.ipcMain.handle('generate-ai-colors', async (event, apps: string[]) => {
    try {
        const OPENROUTER_API_KEY = getOpenRouterApiKey();
        if (!OPENROUTER_API_KEY) {
            console.warn('[DeskFlow] OpenRouter API key not set');
            return {};
        }

        console.log(`[DeskFlow] Generating colors for ${apps.length} apps...`);

        const userPrompt = `Generate brand-appropriate hex colors for these apps/websites. Return ONLY a JSON object with app names as keys and hex colors as values.

Apps: ${apps.join(', ')}

Example format: {"app1": "#FF5733", "app2": "#33FF57"}`;

        const response = await fetch(OPENROUTER_BASE_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://deskflow.app',
                'X-Title': 'DeskFlow',
            },
            body: JSON.stringify({
                model: OPENROUTER_MODELS[0],
                messages: [
                    { role: 'system', content: COLOR_SYSTEM_PROMPT },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: 1000,
                temperature: 0.7,
                stream: true,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[DeskFlow] OpenRouter API error (${response.status}):`, errorText);
            return {};
        }

        // Handle streaming response
        const reader = response.body?.getReader();
        if (!reader) {
            console.error('[DeskFlow] Response body is not readable');
            return {};
        }
        
        const decoder = new TextDecoder();
        let fullContent = '';
        let usage = { prompt_tokens: 0, completion_tokens: 0 };
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;
                    
                    try {
                        const parsed = JSON.parse(data);
                        
                        // Extract content from delta
                        if (parsed.choices?.[0]?.delta?.content) {
                            fullContent += parsed.choices[0].delta.content;
                        }
                        
                        // Extract usage information
                        if (parsed.usage) {
                            usage = {
                                prompt_tokens: parsed.usage.prompt_tokens || 0,
                                completion_tokens: parsed.usage.completion_tokens || 0,
                            };
                        }
                    } catch (e) {
                        // Skip invalid JSON lines
                        continue;
                    }
                }
            }
        }

        console.log('[DeskFlow] OpenRouter response:', JSON.stringify({ content: fullContent, usage }, null, 2));

        const content = fullContent;
        if (!content) {
            console.error('[DeskFlow] No content in OpenRouter response');
            return {};
        }

        console.log('[DeskFlow] Raw AI response:', content);

        const colors = extractJsonFromResponse(content);
        console.log('[DeskFlow] Parsed colors:', colors);
        return colors;
    } catch (err: any) {
        console.error('[DeskFlow] AI color generation error:', err.message);
        return {};
    }
});

// Validate OpenRouter API key using their auth endpoint
electron_1.ipcMain.handle('test-openrouter-key', async () => {
    try {
        const OPENROUTER_API_KEY = getOpenRouterApiKey();
        if (!OPENROUTER_API_KEY) {
            return { success: false, error: 'API key not set' };
        }

        console.log('[DeskFlow] Testing API key (first 20 chars):', OPENROUTER_API_KEY.substring(0, 20) + '...');
        console.log('[DeskFlow] Key length:', OPENROUTER_API_KEY.length);
        console.log('[DeskFlow] Key starts with "sk-or-v1-":', OPENROUTER_API_KEY.startsWith('sk-or-v1-'));

        // First validate the key using OpenRouter's auth endpoint
        const authResponse = await fetch('https://openrouter.ai/api/v1/auth/key', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            },
        });

        console.log('[DeskFlow] Auth check status:', authResponse.status);
        
        if (!authResponse.ok) {
            const authError = await authResponse.text();
            console.error('[DeskFlow] Auth check failed:', authError);
            return { 
                success: false, 
                error: `Invalid API key. Please check your key at https://openrouter.ai/keys`,
                details: authError
            };
        }

        const authData = await authResponse.json();
        console.log('[DeskFlow] Auth data:', authData);

        // Now test with a simple completion
        const response = await fetch(OPENROUTER_BASE_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://deskflow.app',
                'X-Title': 'DeskFlow',
            },
            body: JSON.stringify({
                model: OPENROUTER_MODELS[0], // Use first model for testing
                messages: [
                    { role: 'user', content: 'Say OK' }
                ],
                max_tokens: 10,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[DeskFlow] API test failed (${response.status}):`, errorText);
            return { success: false, error: `HTTP ${response.status}: ${errorText}` };
        }

        const data = await response.json();
        if (data.error) {
            return { success: false, error: data.error.message || 'Unknown API error' };
        }

        return { success: true, model: data.model || 'openai/gpt-3.5-turbo' };
    } catch (err: any) {
        console.error('[DeskFlow] API test error:', err.message);
        return { success: false, error: err.message };
    }
});

// ─── LLM Summarization via OpenRouter ─────────────────────
electron_1.ipcMain.handle('summarize-with-llm', async (_event, prompt, options) => {
    const apiKey = getOpenRouterApiKey();
    if (!apiKey) {
        return {
            success: false,
            error: 'No OpenRouter API key configured. Set openrouterApiKey in Settings to enable LLM summarization.'
        };
    }
    try {
        const maxTokens = options?.maxTokens || 800;
        const model = options?.model || OPENROUTER_MODELS[0];
        const response = await fetch(OPENROUTER_BASE_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://deskflow.app',
                'X-Title': 'DeskFlow',
            },
            body: JSON.stringify({
                model,
                messages: [
                    {
                        role: 'system',
                        content: `You are a technical session summarizer for a developer tool. Produce concise, structured markdown summaries of development sessions. Focus on:
- Key decisions made
- Changes implemented
- Problems encountered and their resolution status
- Outstanding items or next steps

Use headers (##) and bullet points. Be factual and precise. Do not fabricate information.`
                    },
                    { role: 'user', content: prompt }
                ],
                max_tokens: maxTokens,
                temperature: 0.3,
            }),
        });
        if (!response.ok) {
            const errorBody = await response.text().catch(() => 'unknown error');
            console.error('[LLM] API error:', response.status, errorBody.slice(0, 200));
            return { success: false, error: `LLM API error ${response.status}: ${errorBody.slice(0, 200)}` };
        }
        const data = await response.json();
        const summary = data.choices?.[0]?.message?.content;
        if (!summary) return { success: false, error: 'Empty response from LLM API' };
        console.log(`[LLM] Summarization complete (${summary.length} chars, model: ${model})`);
        return { success: true, summary };
    } catch (err) {
        console.error('[LLM] Summarization failed:', err);
        return { success: false, error: err?.message || 'LLM summarization request failed' };
    }
});

// ========== AI Daily Briefing & News Features ==========
const AIServiceModule = require("./services/AIService.cjs");
const AIService = AIServiceModule.AIService || AIServiceModule;
const { buildChain, runWithFallback } = require("./services/providers/router.cjs");
const { PROVIDER_TEMPLATES } = require("./services/providers/templates.cjs");

// Compute weekly quarter (ISO week string YYYY-WXX)
function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + yearStart.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function formatDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getYesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatDateStr(d);
}

function getTodayStr(): string {
  return formatDateStr(new Date());
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
}

function trackFeatureUsage(feature: string, model: string, inputTokens: number, outputTokens: number, costUsd: number, success: boolean) {
  if (!db) return;
  try {
    db.prepare(`INSERT INTO ai_feature_usage (date, feature, model, input_tokens, output_tokens, cost_usd, success, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`)
      .run(getTodayStr(), feature, model, inputTokens, outputTokens, costUsd, success ? 1 : 0);
  } catch (err) {
    console.error('[AIFeatures] Failed to track usage:', err);
  }
}

const MODEL_COST_PER_M_INPUT: Record<string, number> = {
  'google/gemini-2.0-flash-001': 0.10,
  'deepseek/deepseek-chat-v3-0324': 0.27,
  'deepseek/deepseek-chat': 0.27,
};

function computeCost(model: string, inputTokens: number, outputTokens: number): number {
  const rate = MODEL_COST_PER_M_INPUT[model] || 0.10;
  return ((inputTokens + outputTokens) / 1_000_000) * rate;
}

// ─── Shared Brief Generation (used by both fetch and regenerate) ──
// ─── Topic Digest IPC ────────────────────────
let _digestGenerationInProgress = false;

electron_1.ipcMain.handle('is-digest-generating', () => _digestGenerationInProgress);

electron_1.ipcMain.handle('get-topic-digest', async (_event, opts?: { force?: boolean }) => {
  console.log('[TopicDigest] get-topic-digest called', opts?.force ? '(force)' : '');
  try {
    const topics = db!.prepare('SELECT topic FROM ai_interests WHERE enabled = 1 ORDER BY created_at DESC').all() as any[];
    const topicNames = topics.map((t: any) => t.topic);
    console.log('[TopicDigest] topicNames:', topicNames);
    if (topicNames.length === 0) {
      console.log('[TopicDigest] no topics configured, returning empty');
      return { success: true, topics: [] };
    }

    const today = getTodayStr();
    if (opts?.force) {
      console.log('[TopicDigest] force refresh — deleting today\'s cache');
      db!.prepare('DELETE FROM ai_briefs WHERE type = ? AND date = ?').run('topic', today);
    } else {
      const cached = db!.prepare('SELECT content FROM ai_briefs WHERE type = ? AND date = ?').get('topic', today) as any;
      if (cached) {
        console.log('[TopicDigest] found cached brief for today');
        try {
          const parsed = JSON.parse(cached.content);
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.log('[TopicDigest] returning cached brief with', parsed.length, 'topics');
            _digestGenerationInProgress = false;
            return { success: true, topics: parsed };
          }
          console.log('[TopicDigest] cached brief invalid, deleting');
        } catch (e: any) {
          console.warn('[TopicDigest] cached brief parse failed:', e.message);
        }
        db!.prepare('DELETE FROM ai_briefs WHERE type = ? AND date = ?').run('topic', today);
    } else {
      console.log('[TopicDigest] no cached brief — returning empty (not generating)');
      _digestGenerationInProgress = false;
      return { success: true, topics: [] };
    }
  }

  const p = userPreferences || {};
    const digestModel = p.ai_digestModel || 'google/gemini-2.0-flash-001';

    interface TopicItem { topic: string; summary?: string };
    const topicItems: TopicItem[] = topicNames.map((t: string) => ({ topic: t }));
    const systemPrompt = `Output raw JSON array only. Each item: {"topic":"exact name","summary":"1-2 paragraph current-state research (under 100 words)","sources":[]}. If unknown, summary="No major recent developments reported". Never fabricate. Never use markdown or code fences. Respond with only the JSON array — do not include any reasoning, thoughts, or preamble. Today is ${today}.`;
    const userMsg = `Topics: ${topicItems.map(t => t.topic).join(', ')}`;

    let result: { content: string | any[]; usage?: { prompt_tokens?: number; completion_tokens?: number } } | null = null;

    _digestGenerationInProgress = true;

    console.log('[TopicDigest] Step 1: provider state check');
    const pState = p.aiProviders ? JSON.parse(p.aiProviders) : null;
    if (pState) {
      console.log('[TopicDigest] Routing state:', JSON.stringify(pState.routing));
      console.log('[TopicDigest] Providers:', pState.providers?.map((pr: any) => `${pr.id}(${pr.templateId}) enabled=${pr.enabled} key=${pr.apiKey ? pr.apiKey.slice(0,8)+'...' : 'NONE'} model=${pr.models?.[0] || 'none'} prio=${pr.priority}`).join(' | '));
    } else {
      console.log('[TopicDigest] No aiProviders state at all');
    }
    const hasProviderChain = !!(pState && pState.providers && pState.providers.some((pr: any) => pr.enabled));
    console.log('[TopicDigest] hasProviderChain:', hasProviderChain);
    if (hasProviderChain) {
      try {
        console.log('[TopicDigest] Step 2: building provider chain for researchDigest');
        const chain = buildChain(pState, 'researchDigest');
        console.log('[TopicDigest] chain built, calling runWithFallback');
        const { result: r } = await runWithFallback(chain, {
          systemPrompt,
          messages: [{ role: 'user', content: userMsg }],
          maxTokens: 2000,
          temperature: 0.4,
        });
        result = r;
        console.log('[TopicDigest] Provider chain raw result, content type:', typeof result.content, 'len:', String(result.content).length);
        // Normalize: runWithFallback returns { content: string }, but we need { content: any[] }
        // Parse string content as JSON, or treat empty string as empty array
        if (typeof result.content === 'string') {
          if (!result.content.trim()) {
            console.log('[TopicDigest] Provider chain content is empty string, treating as empty array');
            result = { content: [], usage: result.usage };
          } else {
            try {
              const parsed = JSON.parse(result.content);
              result = { content: Array.isArray(parsed) ? parsed : [], usage: result.usage };
              console.log('[TopicDigest] Provider chain content parsed as JSON, array len:', result.content.length);
            } catch (e: any) {
              console.warn('[TopicDigest] Provider chain content parse failed:', e.message, '— treating as empty array');
              result = { content: [], usage: result.usage };
            }
          }
        } else if (Array.isArray(result.content)) {
          console.log('[TopicDigest] Provider chain content is already an array, using directly');
        } else {
          console.warn('[TopicDigest] Provider chain content is unexpected type:', typeof result.content, '— treating as empty array');
          result = { content: [], usage: result.usage };
        }
      } catch (chainErr: any) {
        console.error('[TopicDigest] Provider chain FAILED:', chainErr.message);
        console.error('[TopicDigest] NOT falling back to legacy — user configured a provider chain');
        _digestGenerationInProgress = false;
        return { success: false, error: `Provider chain failed: ${chainErr.message}`, topics: [] };
      }
    } else {
      console.log('[TopicDigest] No provider chain configured, will use legacy API key');
    }

    if (!result && !hasProviderChain) {
      console.log('[TopicDigest] Step 3: trying legacy API path (OpenRouter)');
      const apiKey = getOpenRouterApiKey();
      if (!apiKey) {
        console.log('[TopicDigest] No API key configured — aborting');
        _digestGenerationInProgress = false;
        return { success: false, error: 'No API key configured', topics: [] };
      }
      console.log('[TopicDigest] API key found, model:', digestModel, 'topics:', topicNames);

      const tokenTiers = [200, 100, 50, 40];
      let lastErr: any = null;
      for (let i = 0; i < tokenTiers.length; i++) {
        try {
          console.log(`[TopicDigest] Calling generateTopicDigest with maxTokens=${tokenTiers[i]}`);
          result = await AIService.generateTopicDigest(apiKey, { topics: topicNames, today }, digestModel, tokenTiers[i]);
          console.log('[TopicDigest] generateTopicDigest returned, content:', result ? `type=${typeof result.content} len=${Array.isArray(result.content) ? result.content.length : String(result.content).length}` : 'null');
          break;
        } catch (err: any) {
          lastErr = err;
          console.warn(`[TopicDigest] Attempt ${i + 1}/${tokenTiers.length} failed:`, err.message);
          const isCreditError = err.message?.includes('402') || err.message?.includes('credits') || err.message?.includes('insufficient');
          if (isCreditError && i < tokenTiers.length - 1) {
            console.warn(`[TopicDigest] credit error at ${tokenTiers[i]} maxTokens, retrying at ${tokenTiers[i + 1]}`);
            continue;
          }
          throw err;
        }
      }
      if (!result && lastErr) {
        console.log('[TopicDigest] All attempts exhausted, last error:', lastErr.message);
      }
    }

    if (!result) {
      console.log('[TopicDigest] FAIL: result is null after all generation paths');
      _digestGenerationInProgress = false;
      return { success: false, error: 'Topic digest generation returned no content — AI call failed to produce a result', topics: [] };
    }
    if (!result.content) {
      console.log('[TopicDigest] FAIL: result.content is falsy, type:', typeof result.content, 'value:', result.content);
      _digestGenerationInProgress = false;
      return { success: false, error: `Topic digest generation returned no content — content was ${typeof result.content} (${JSON.stringify(result.content).slice(0, 100)})`, topics: [] };
    }
    console.log('[TopicDigest] result.content present, type:', typeof result.content, Array.isArray(result.content) ? `array len=${result.content.length}` : `string len=${result.content.length}`);

    function cleanDigestJson(raw: string): string {
      let s = raw.trim();
      const cb = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (cb) s = cb[1].trim();
      const fs = s.indexOf('[');
      const fb = s.indexOf('{');
      let start = -1;
      if (fs !== -1 && (fb === -1 || fs < fb)) start = fs; else if (fb !== -1) start = fb;
      if (start === -1) throw new Error('no JSON found');
      let depth = 0, inStr = false, end = -1;
      for (let i = start; i < s.length; i++) {
        const c = s[i];
        if (inStr) { if (c === '\\') i++; else if (c === '"') inStr = false; continue; }
        if (c === '"') { inStr = true; continue; }
        if (c === '{' || c === '[') depth++;
        if (c === '}' || c === ']') { depth--; if (depth === 0) { end = i; break; } }
      }
      if (end === -1) throw new Error('unmatched bracket');
      return s.slice(start, end + 1);
    }

    let parsedContent: any[];
    const contentType = Array.isArray(result.content) ? 'array' : typeof result.content === 'string' ? 'string' : 'other';
    console.log(`[TopicDigest] result.content type: ${contentType}, value:`, result.content);

    if (Array.isArray(result.content)) {
      console.log('[TopicDigest] content is already an array, using directly');
      parsedContent = result.content;
    } else if (typeof result.content === 'string') {
      console.log('[TopicDigest] content is string, attempting JSON.parse');
      // Strip BOM and common invisible characters
      const cleanedInput = result.content.replace(/^[\u200B\u200C\u200D\uFEFF]/, '').trim();
      try {
        parsedContent = JSON.parse(cleanedInput);
        console.log('[TopicDigest] JSON.parse succeeded');
      } catch {
        console.log('[TopicDigest] JSON.parse failed, trying cleanDigestJson');
        try {
          const cleaned = cleanDigestJson(cleanedInput);
          parsedContent = JSON.parse(cleaned);
          console.log('[TopicDigest] cleanDigestJson + JSON.parse succeeded');
        } catch (e: any) {
          console.warn('[TopicDigest] cleanDigestJson failed, trying last-resort extraction:', e.message);
          // Last resort: try to find any {...} block and parse it
          const match = cleanedInput.match(/\{[\s\S]*\}/);
          if (match) {
            try {
              parsedContent = JSON.parse(match[0]);
              console.log('[TopicDigest] last-resort extraction succeeded');
            } catch {
              parsedContent = [{ topic: 'digest', summary: String(result.content) }];
            }
          } else {
            parsedContent = [{ topic: 'digest', summary: String(result.content) }];
          }
        }
      }
    } else {
      console.warn('[TopicDigest] content is neither array nor string, wrapping:', typeof result.content);
      parsedContent = [{ topic: 'digest', summary: String(result.content) }];
    }

    if (!Array.isArray(parsedContent)) {
      try { parsedContent = JSON.parse(parsedContent); } catch {}
      if (!Array.isArray(parsedContent)) {
        console.warn('[TopicDigest] parsedContent not an array, wrapping');
        parsedContent = [{ topic: 'digest', summary: String(parsedContent) }];
      }
    }

    db!.prepare('INSERT OR REPLACE INTO ai_briefs (type, date, content, model_used, tokens_used, created_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))')
      .run('topic', today, JSON.stringify(parsedContent), digestModel, 0);

    console.log('[TopicDigest] returning success with', parsedContent.length, 'topics');
    _digestGenerationInProgress = false;
    try { mainWindow?.webContents.send('digest-generation-complete', { success: true, topics: parsedContent }); } catch {}
    return { success: true, topics: parsedContent };
  } catch (err: any) {
    _digestGenerationInProgress = false;
    console.error('[TopicDigest] Error:', err.message);
    return { success: false, error: err.message, topics: [] };
  }
});

// ─── Interest Topics CRUD IPC ────────────────
electron_1.ipcMain.handle('get-interest-topics', async () => {
  try {
    const rows = db!.prepare('SELECT topic FROM ai_interests WHERE enabled = 1 ORDER BY created_at DESC').all() as any[];
    return rows.map((r: any) => r.topic);
  } catch {
    return [];
  }
});

electron_1.ipcMain.handle('add-interest-topic', async (_event, topic: string) => {
  try {
    db!.prepare('INSERT OR IGNORE INTO ai_interests (topic, created_at) VALUES (?, datetime(\'now\'))').run(topic.trim());
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

electron_1.ipcMain.handle('remove-interest-topic', async (_event, topic: string) => {
  try {
    db!.prepare('DELETE FROM ai_interests WHERE topic = ?').run(topic.trim());
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// ─── AI Config IPC ───────────────────────────
electron_1.ipcMain.handle('get-ai-config', async () => {
  const apiKey = getOpenRouterApiKey();
  const p = userPreferences || {};
  return {
    success: true,
    hasApiKey: !!apiKey,
    apiKeyPreview: apiKey ? apiKey.substring(0, 8) + '...' : '',
    briefModel: p.ai_briefModel || 'google/gemini-2.0-flash-001',
    weeklyModel: p.ai_weeklyModel || 'google/gemini-2.0-flash-001',
    digestModel: p.ai_digestModel || 'google/gemini-2.0-flash-001',
    anomalyModel: p.ai_anomalyModel || 'google/gemini-2.0-flash-001',
    autoGenerateBrief: p.ai_autoGenerateBrief !== false,
    enabled: p.ai_enabled !== false && !!apiKey,
  };
});

electron_1.ipcMain.handle('save-ai-config', async (_event, config: any) => {
  try {
    userPreferences = userPreferences || {};
    if (config.briefModel !== undefined) userPreferences.ai_briefModel = config.briefModel;
    if (config.weeklyModel !== undefined) userPreferences.ai_weeklyModel = config.weeklyModel;
    if (config.digestModel !== undefined) userPreferences.ai_digestModel = config.digestModel;
    if (config.anomalyModel !== undefined) userPreferences.ai_anomalyModel = config.anomalyModel;
    if (config.autoGenerateBrief !== undefined) userPreferences.ai_autoGenerateBrief = config.autoGenerateBrief;
    if (config.enabled !== undefined) userPreferences.ai_enabled = config.enabled;
    if (config.apiKey !== undefined) {
      userPreferences.openrouterApiKey = config.apiKey;
    }
    savePreferences();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// ========== Auto-Assign Routing IPC ==========

// 3a. route-prompt — core routing: match prompt to session
electron_1.ipcMain.handle('route-prompt', async (_event, request: { prompt: string; projectPath?: string }) => {
    const { prompt } = request;
    const config = loadAutoAssignConfig();
    if (!config.enabled) return { action: 'manual', reason: 'Auto-assign is disabled' };

    try {
        // Gather active sessions with summaries
        const sessions: any[] = db!.prepare(`
            SELECT id, topic, description, agent, status, terminal_id,
                   (SELECT COUNT(*) FROM terminal_messages WHERE session_id = terminal_sessions.id) as msg_count
            FROM terminal_sessions
            WHERE status = 'active'
            ORDER BY updated_at DESC
        `).all();

        if (sessions.length === 0) {
            return { action: 'create_new', suggestedName: generateSessionName(prompt), suggestedSummary: prompt.substring(0, 120), confidence: 1.0 };
        }

        // Build routing prompt
        const sessionList = sessions.map((s: any, i: number) => {
            return `[${i}] Session: "${s.topic || 'Untitled'}" | Summary: ${s.description || 'No summary'} | Messages: ${s.msg_count || 0} | Agent: ${s.agent}`;
        }).join('\n');

        const routingSystemPrompt = `You are a session router for an AI agent workspace. Given a user's prompt and a list of active sessions, decide which session the prompt should be routed to.

RULES:
- Match based on topic similarity, ongoing work, and context overlap
- If the prompt is unrelated to ALL existing sessions, respond with action: "create_new"
- Be decisive — avoid "create_new" if any session is a reasonable match
- Confidence is 0.0-1.0: how certain you are that this session is the right target

RESPOND WITH EXACTLY THIS JSON FORMAT, NOTHING ELSE:
{"session_index": <number or null>, "action": "route" or "create_new", "confidence": <0.0-1.0>, "suggested_name": "<string if create_new>", "reason": "<1 sentence>"}`;

        const routingUserPrompt = `ACTIVE SESSIONS:\n${sessionList}\n\nUSER PROMPT:\n${prompt}`;

        // Call LLM for routing
        const startTime = Date.now();
        const llmResponse = await callOpenRouter(routingSystemPrompt, routingUserPrompt, {
            model: config.routingModel,
            maxTokens: 300,
            temperature: 0.1,
        });

        const inputTokens = llmResponse.usage?.prompt_tokens || Math.ceil((routingSystemPrompt.length + routingUserPrompt.length) / 4);
        const outputTokens = llmResponse.usage?.completion_tokens || Math.ceil(llmResponse.content.length / 4);
        const costUsd = computeRoutingCost(inputTokens, outputTokens, config.routingModel);

        // Log cost
        logRoutingCost({ callType: 'routing', model: config.routingModel, inputTokens, outputTokens, costUsd, promptPreview: prompt.substring(0, 100) });

        // Parse JSON from response
        const jsonMatch = llmResponse.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return { action: 'manual', reason: 'Could not parse routing result' };
        const routingResult = JSON.parse(jsonMatch[0]);

        if (routingResult.action === 'create_new') {
            return {
                action: 'create_new',
                suggestedName: routingResult.suggested_name || generateSessionName(prompt),
                suggestedSummary: prompt.substring(0, 120),
                confidence: routingResult.confidence || 0.5,
                reason: routingResult.reason,
            };
        }

        const targetIndex = routingResult.session_index;
        if (typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex < sessions.length) {
            const target = sessions[targetIndex];
            return {
                action: 'route',
                sessionId: target.id,
                sessionName: target.topic || 'Untitled',
                terminalId: target.terminal_id,
                confidence: routingResult.confidence || 0.5,
                reason: routingResult.reason,
            };
        }

        return { action: 'manual', reason: 'Could not resolve session index' };
    } catch (err: any) {
        console.error('[Route-Prompt] Error:', err);
        return { action: 'manual', reason: err.message || 'Routing failed' };
    }
});

// 3b. update-session-summary — async summary + optional rename
electron_1.ipcMain.handle('update-session-summary', async (_event, request: { sessionId: string; force?: boolean }) => {
    const { sessionId, force = false } = request;
    const config = loadAutoAssignConfig();
    if (!db) return { success: false, error: 'No database' };

    try {
        const session = db.prepare(`
            SELECT id, topic, description, auto_named, agent,
                   (SELECT COUNT(*) FROM terminal_messages WHERE session_id = ?) as msg_count
            FROM terminal_sessions WHERE id = ?
        `).get(sessionId, sessionId) as any;

        if (!session) return { success: false, error: 'Session not found' };

        if (!force) {
            const msgCount = session.msg_count || 0;
            const threshold = config.summaryFrequency;
            if (session.description && threshold > 0 && msgCount % threshold !== 0) {
                return { success: true, skipped: true, reason: 'Not due for update' };
            }
        }

        // Get recent messages
        const messages = db.prepare(`
            SELECT role, content FROM terminal_messages
            WHERE session_id = ? ORDER BY created_at DESC LIMIT 20
        `).all(sessionId) as { role: string; content: string }[];

        if (messages.length < 2) return { success: true, skipped: true, reason: 'Not enough messages' };

        const messageText = messages.reverse().map((m: any) => `[${m.role}]: ${m.content.substring(0, 300)}`).join('\n');
        const summaryPrompt = `Current summary: ${session.description || 'None'}\n\nRecent messages:\n${messageText}\n\nProvide an updated 1-2 sentence summary of what this session is working on. Be specific about the current task, not the entire history. Reply with ONLY the summary text, no formatting.`;

        const llmResponse = await callOpenRouter(
            'You are a concise session summarizer. Produce 1-2 sentence summaries of what a development session is currently working on.',
            summaryPrompt,
            { model: config.routingModel, maxTokens: 150, temperature: 0.2 }
        );

        const inputTokens = llmResponse.usage?.prompt_tokens || Math.ceil(summaryPrompt.length / 4);
        let outputTokens = llmResponse.usage?.completion_tokens || Math.ceil(llmResponse.content.length / 4);
        let costUsd = computeRoutingCost(inputTokens, outputTokens, config.routingModel);

        const newSummary = llmResponse.content.trim();
        let newTopic = session.topic;
        let autoNamed = session.auto_named || 0;

        // Auto-rename if enabled
        if (config.autoRename && (session.auto_named || !session.topic || session.topic === 'New Session')) {
            const renameResponse = await callOpenRouter(
                'You generate short, descriptive session names.',
                `Based on this summary: "${newSummary}"\n\nGenerate a short descriptive session name (3-5 words, no quotes). Reply with ONLY the name.`,
                { model: config.routingModel, maxTokens: 30, temperature: 0.3 }
            );
            const renameTokens = renameResponse.usage?.completion_tokens || Math.ceil(renameResponse.content.length / 4);
            outputTokens += renameTokens;
            costUsd += computeRoutingCost(0, renameTokens, config.routingModel);
            newTopic = renameResponse.content.trim().replace(/^["']|["']$/g, '');
            autoNamed = 1;
        }

        // Update session
        db.prepare(`UPDATE terminal_sessions SET description = ?, topic = ?, auto_named = ?, updated_at = datetime('now') WHERE id = ?`)
            .run(newSummary, newTopic, autoNamed, sessionId);

        logRoutingCost({ callType: config.autoRename && autoNamed ? 'rename' : 'summary', model: config.routingModel, inputTokens, outputTokens, costUsd, sessionId });

        return { success: true, summary: newSummary, topic: newTopic, autoNamed: !!autoNamed };
    } catch (err: any) {
        console.error('[Update-Session-Summary] Failed:', err);
        return { success: false, error: err.message };
    }
});

// 3c. get-routing-costs — aggregation queries
electron_1.ipcMain.handle('get-routing-costs', async (_event) => {
    if (!db) return { today: null, week: null, month: null, total: null, byType: [] };
    try {
        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
        const monthStart = today.substring(0, 7) + '-01';

        const todayCost = db!.prepare(`SELECT COALESCE(SUM(cost_usd),0) as total, COALESCE(SUM(input_tokens),0) as inputTokens, COALESCE(SUM(output_tokens),0) as outputTokens, COUNT(*) as calls FROM routing_costs WHERE date(timestamp) = ?`).get(today);
        const weekCost = db!.prepare(`SELECT COALESCE(SUM(cost_usd),0) as total, COALESCE(SUM(input_tokens),0) as inputTokens, COALESCE(SUM(output_tokens),0) as outputTokens, COUNT(*) as calls FROM routing_costs WHERE date(timestamp) >= ?`).get(weekAgo);
        const monthCost = db!.prepare(`SELECT COALESCE(SUM(cost_usd),0) as total, COALESCE(SUM(input_tokens),0) as inputTokens, COALESCE(SUM(output_tokens),0) as outputTokens, COUNT(*) as calls FROM routing_costs WHERE date(timestamp) >= ?`).get(monthStart);
        const totalCost = db!.prepare(`SELECT COALESCE(SUM(cost_usd),0) as total, COALESCE(SUM(input_tokens),0) as inputTokens, COALESCE(SUM(output_tokens),0) as outputTokens, COUNT(*) as calls FROM routing_costs`).get();
        const byType = db.prepare(`SELECT call_type, COALESCE(SUM(cost_usd), 0) as total, COUNT(*) as calls FROM routing_costs GROUP BY call_type`).all();

        return { today: todayCost, week: weekCost, month: monthCost, total: totalCost, byType };
    } catch (err) {
        console.error('[Get-Routing-Costs] Error:', err);
        return { today: null, week: null, month: null, total: null, byType: [] };
    }
});

// 3d. reset-routing-costs — clear all
electron_1.ipcMain.handle('reset-routing-costs', async (_event) => {
    if (!db) return { success: false };
    try { db.prepare('DELETE FROM routing_costs').run(); return { success: true }; }
    catch { return { success: false }; }
});

// 3e. config get/save
electron_1.ipcMain.handle('get-auto-assign-config', async (_event) => {
    return loadAutoAssignConfig();
});

electron_1.ipcMain.handle('save-auto-assign-config', async (_event, config: AutoAssignConfig) => {
    try { saveAutoAssignConfigFile(config); return { success: true }; }
    catch { return { success: false }; }
});

// Generate AI categorization for apps/websites using OpenRouter API
electron_1.ipcMain.handle('generate-ai-categorization', async (event, items) => {
    try {
        const OPENROUTER_API_KEY = getOpenRouterApiKey();
        if (!OPENROUTER_API_KEY) {
            console.warn('[DeskFlow] OpenRouter API key not set');
            return [];
        }

        console.log(`[DeskFlow] Generating categories for ${items.length} items...`);

        const itemsList = items.map(i => `${i.name} (current: ${i.category})`).join(', ');
        
        const userPrompt = `Categorize these apps/websites into appropriate categories. Use these categories: IDE, AI Tools, Browser, Entertainment, Communication, Design, Productivity, Tools, Education, Developer Tools, Search Engine, News, Shopping, Social Media, Uncategorized, Other.

Items: ${itemsList}

Return ONLY a JSON array of objects with "name" and "category" keys.

Example format: [{"name": "app1", "category": "Productivity"}, {"name": "app2", "category": "Entertainment"}]`;

        const response = await fetch(OPENROUTER_BASE_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://deskflow.app',
                'X-Title': 'DeskFlow',
            },
            body: JSON.stringify({
                model: OPENROUTER_MODELS[0],
                messages: [
                    { role: 'system', content: CATEGORY_SYSTEM_PROMPT },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: 2000,
                temperature: 0.3,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[DeskFlow] OpenRouter API error (${response.status}):`, errorText);
            return [];
        }

        const data = await response.json();
        console.log('[DeskFlow] OpenRouter response:', JSON.stringify(data, null, 2));

        if (data.error) {
            console.error('[DeskFlow] OpenRouter returned error:', data.error);
            return [];
        }

        const content = data.choices?.[0]?.message?.content;
        if (!content) {
            console.error('[DeskFlow] No content in OpenRouter response');
            return [];
        }

        console.log('[DeskFlow] Raw AI response:', content);

        const result = extractJsonFromResponse(content);
        console.log('[DeskFlow] Parsed categories:', result);
        return result;
    } catch (err: any) {
        console.error('[DeskFlow] AI categorization error:', err.message);
        return [];
    }
});

function migrateProviderNames(state: any): any {
  if (!state || !state.providers) return state;
  const oldToNew: Record<string, string> = { cloudflayer: 'cloudflare', ollamah: 'ollama' };
  state.providers = state.providers.filter((p: any) => {
    const lowId = (p.id || '').toLowerCase();
    const lowTid = (p.templateId || '').toLowerCase();
    return lowId !== 'invilier' && lowTid !== 'invilier';
  });
  for (const p of state.providers) {
    const idFixed = oldToNew[(p.id || '').toLowerCase()];
    const tidFixed = oldToNew[(p.templateId || '').toLowerCase()];
    const fixed = idFixed || tidFixed;
    if (fixed) {
      p.id = fixed;
      p.templateId = fixed;
      p.label = ({ cloudflare: 'Cloudflare', ollama: 'Ollama' })[fixed] || p.label;
      if (PROVIDER_TEMPLATES[fixed]?.defaultBaseUrl && !p.baseUrl?.trim()) p.baseUrl = '';
    }
  }
  return state;
}

// ========== Multi‑Provider AI / Goal Features ==========
electron_1.ipcMain.handle('get-ai-providers', async () => {
  const p = userPreferences || {};
  try {
    return migrateProviderNames(JSON.parse(p.aiProviders || 'null')) || {
      providers: [
        { id: 'openrouter', templateId: 'openrouter', label: 'OpenRouter', enabled: true, apiKey: getOpenRouterApiKey(), baseUrl: '', models: ['google/gemini-2.0-flash-001'], priority: 0 },
        { id: 'cloudflare', templateId: 'cloudflare', label: 'Cloudflare', enabled: false, apiKey: '', baseUrl: '', models: [], priority: 1 },
        { id: 'ollama', templateId: 'ollama', label: 'Ollama', enabled: false, apiKey: '', baseUrl: '', models: ['llama3.1'], priority: 2 },
        { id: 'custom', templateId: 'custom', label: 'Custom OpenAI-compatible', enabled: false, apiKey: '', baseUrl: '', models: [], priority: 4 },
      ],
      routing: {
        default: { providerId: 'auto', model: '' },
        researchDigest: null,
        goalAssistant: null,
      },
    };
  } catch {
    return null;
  }
});

electron_1.ipcMain.handle('save-ai-providers', async (_event, state: any) => {
  userPreferences = userPreferences || {};
  userPreferences.aiProviders = JSON.stringify(state);
  savePreferences();
  return { success: true };
});

electron_1.ipcMain.handle('test-ai-provider', async (_event, providerId: string) => {
  try {
    const p = userPreferences || {};
    const pState = migrateProviderNames(JSON.parse(p.aiProviders || 'null'));
    if (!pState) return { success: false, error: 'No provider config' };
    const cfg = pState.providers.find((pr: any) => pr.id === providerId);
    if (!cfg) return { success: false, error: 'Provider not found' };
    const template = PROVIDER_TEMPLATES[cfg.templateId];
    if (!template) return { success: false, error: `Unknown template "${cfg.templateId}" — try re-saving the provider in Settings` };
    if (cfg.templateId === 'cloudflare' && !cfg.extraConfig?.cloudflareAccountId) {
      return { success: false, error: 'Missing Cloudflare Account ID — add it in Settings under the Cloudflare provider (find it at https://dash.cloudflare.com in the URL after /account/)' };
    }
    const { callProvider: call } = require('./services/providers/callProvider.cjs');
    const result = await call(
      { config: cfg, template },
      { model: cfg.models[0] || 'gpt-3.5-turbo', systemPrompt: 'Reply with exactly: OK', messages: [{ role: 'user', content: 'Ping' }], maxTokens: 10 },
    );
    return { success: true, content: result.content };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

electron_1.ipcMain.handle('get-goals', async (_event, date: string) => {
  try {
    const rows = db!.prepare('SELECT * FROM goals WHERE date = ? ORDER BY created_at ASC').all(date) as any[];
    const reviewRow = db!.prepare('SELECT review_summary FROM goal_reviews WHERE date = ?').get(date) as any;
    return {
      date,
      reviewSummary: reviewRow?.review_summary,
      goals: rows.map((r: any) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        category: r.category,
        target: { type: r.target_type, targetSeconds: r.target_seconds, matchCategory: r.match_category },
        period: r.period,
        status: r.status,
        date: r.date,
        source: r.source,
        links: JSON.parse(r.links || '[]'),
        progressSeconds: r.progress_seconds,
        createdAt: r.created_at,
        completedAt: r.completed_at,
      })),
    };
  } catch (err: any) {
    return { date, goals: [], error: err.message };
  }
});

// Batch goals by date range — replaces N+1 sequential get-goals calls
electron_1.ipcMain.handle('get-goals-batch', async (_event, startDate: string, endDate: string) => {
  try {
    const rows = db!.prepare('SELECT * FROM goals WHERE date BETWEEN ? AND ? ORDER BY date ASC, created_at ASC').all(startDate, endDate) as any[];
    const reviewRows = db!.prepare('SELECT date, review_summary FROM goal_reviews WHERE date BETWEEN ? AND ?').all(startDate, endDate) as any[];
    const reviewsMap: Record<string, string> = {};
    for (const r of reviewRows) { reviewsMap[r.date] = r.review_summary; }
    const days: Record<string, any> = {};
    for (const r of rows) {
      if (!days[r.date]) {
        days[r.date] = { date: r.date, reviewSummary: reviewsMap[r.date] || null, goals: [] };
      }
      days[r.date].goals.push({
        id: r.id, title: r.title, description: r.description,
        category: r.category, target: { type: r.target_type, targetSeconds: r.target_seconds, matchCategory: r.match_category },
        period: r.period, status: r.status, date: r.date, source: r.source,
        links: JSON.parse(r.links || '[]'), progressSeconds: r.progress_seconds,
        createdAt: r.created_at, completedAt: r.completed_at,
      });
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    const result: any[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      result.push(days[dateStr] || { date: dateStr, reviewSummary: reviewsMap[dateStr] || null, goals: [] });
    }
    return { success: true, days: result };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

electron_1.ipcMain.handle('save-goal', async (_event, date: string, goal: any) => {
  try {
    db!.prepare(`
      INSERT OR REPLACE INTO goals (id, date, title, description, category, target_type, target_seconds, match_category, status, period, source, links, progress_seconds, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      goal.id, date, goal.title, goal.description || null,
      goal.category || 'work', goal.target?.type || 'time', goal.target?.targetSeconds || null, goal.target?.matchCategory || null,
      goal.status || 'pending', goal.period || 'daily', goal.source || 'manual',
      JSON.stringify(goal.links || []), goal.progressSeconds || 0, goal.completedAt || null,
    );
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

electron_1.ipcMain.handle('get-longterm-goals', async () => {
  try {
    const rows = db!.prepare('SELECT * FROM goals WHERE period = ? ORDER BY priority ASC, created_at ASC').all('longterm') as any[];
    return { success: true, goals: rows };
  } catch (err: any) {
    return { success: false, error: err.message, goals: [] };
  }
});

electron_1.ipcMain.handle('delete-goal', async (_event, goalId: string) => {
  try {
    db!.prepare('DELETE FROM goals WHERE id = ?').run(goalId);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

electron_1.ipcMain.handle('save-goal-review', async (_event, date: string, reviewSummary: string) => {
  try {
    db!.prepare('UPDATE goals SET reviewSummary = ? WHERE date = ? AND reviewSummary IS NULL').run(reviewSummary, date);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// ─── Goal Hierarchy IPC (parent_id decomposition) ──────────────────────

electron_1.ipcMain.handle('get-goal', async (_event, goalId: string) => {
  try {
    const row = db!.prepare('SELECT * FROM goals WHERE id = ?').get(goalId) as any;
    if (!row) return { success: false, error: 'Goal not found' };
    return {
      success: true,
      goal: {
        id: row.id, title: row.title, description: row.description,
        category: row.category, period: row.period, status: row.status,
        date: row.date, source: row.source, parent_id: row.parent_id,
        priority: row.priority, progressSeconds: row.progress_seconds,
        links: JSON.parse(row.links || '[]'),
        createdAt: row.created_at, completedAt: row.completed_at,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

electron_1.ipcMain.handle('get-child-goals', async (_event, parentId: string) => {
  try {
    const rows = db!.prepare('SELECT * FROM goals WHERE parent_id = ? ORDER BY priority ASC, created_at ASC').all(parentId) as any[];
    return {
      success: true,
      children: rows.map((r: any) => ({
        id: r.id, title: r.title, description: r.description,
        category: r.category, period: r.period, status: r.status,
        date: r.date, source: r.source, parent_id: r.parent_id,
        priority: r.priority, progressSeconds: r.progress_seconds,
        links: JSON.parse(r.links || '[]'),
        createdAt: r.created_at, completedAt: r.completed_at,
      })),
    };
  } catch (err: any) {
    return { success: false, error: err.message, children: [] };
  }
});

electron_1.ipcMain.handle('save-goals-batch', async (_event, goals: any[]) => {
  try {
    const insert = db!.prepare(`
      INSERT OR REPLACE INTO goals (id, date, title, description, category, target_type, target_seconds, match_category, status, period, source, links, progress_seconds, completed_at, parent_id, priority)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const txn = db!.transaction((items: any[]) => {
      for (const g of items) {
        insert.run(
          g.id, g.date || '2000-01-01', g.title, g.description || null,
          g.category || 'work', g.target?.type || 'custom', g.target?.targetSeconds || null, g.target?.matchCategory || null,
          g.status || 'pending', g.period || 'daily', g.source || 'ai_assistant',
          JSON.stringify(g.links || []), g.progressSeconds || 0, g.completedAt || null,
          g.parent_id || null, g.priority ?? 0,
        );
      }
    });
    txn(goals);
    return { success: true, count: goals.length };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

electron_1.ipcMain.handle('link-goal-to-entity', async (_event, goalId: string, link: { type: 'problem' | 'request'; id: string; label?: string }) => {
  try {
    const row = db!.prepare('SELECT * FROM goals WHERE id = ?').get(goalId) as any;
    if (!row) return { success: false, error: 'Goal not found' };
    const links = JSON.parse(row.links || '[]');
    links.push(link);
    db!.prepare('UPDATE goals SET links = ? WHERE id = ?').run(JSON.stringify(links), goalId);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

electron_1.ipcMain.handle('unlink-goal-from-entity', async (_event, goalId: string, type: 'problem' | 'request', entityId: string) => {
  try {
    const row = db!.prepare('SELECT * FROM goals WHERE id = ?').get(goalId) as any;
    if (!row) return { success: false, error: 'Goal not found' };
    const links = JSON.parse(row.links || '[]').filter((l: any) => !(l.type === type && l.id === entityId));
    db!.prepare('UPDATE goals SET links = ? WHERE id = ?').run(JSON.stringify(links), goalId);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// ─── Planning.md Helpers ──────────────────────
function planningPath() {
  return path_1.default.join(userDataPath, 'planning.md');
}

interface GoalPromptContext {
  planningContent?: string;
  longtermGoals?: Array<{ title: string; category: string }>;
  unfinished?: Array<{ title: string; category: string; progress?: number }>;
  recentlyCompleted?: string[];
  stats?: Record<string, any>;
}

electron_1.ipcMain.handle('read-planning-md', async () => {
  try {
    const fpath = planningPath();
    if (!fs_1.default.existsSync(fpath)) return { content: '' };
    return { content: fs_1.default.readFileSync(fpath, 'utf-8') };
  } catch (err: any) {
    return { content: '', error: err.message };
  }
});

electron_1.ipcMain.handle('write-planning-md', async (_event, content: string) => {
  try {
    const fpath = planningPath();
    const dir = path_1.default.dirname(fpath);
    if (!fs_1.default.existsSync(dir)) fs_1.default.mkdirSync(dir, { recursive: true });
    fs_1.default.writeFileSync(fpath, content, 'utf-8');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

electron_1.ipcMain.handle('write-feature-spec-file', async (_event, content: string) => {
  try {
    const appRoot = electron_1.app.getAppPath();
    const fpath = path_1.default.join(appRoot, 'agent', 'FEATURE_SPECS.md');
    const dir = path_1.default.dirname(fpath);
    if (!fs_1.default.existsSync(dir)) fs_1.default.mkdirSync(dir, { recursive: true });
    fs_1.default.writeFileSync(fpath, content, 'utf-8');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

electron_1.ipcMain.handle('get-goal-context', async (_event, date: string) => {
  try {
    const sevenDaysAgo = formatDateStr(new Date(Date.now() - 7 * 86400000));
    const weekStats = db!.prepare(`SELECT category, SUM(total_sec) as total FROM daily_stats WHERE date >= ? AND date <= ? GROUP BY category ORDER BY total DESC`).all(sevenDaysAgo, date) as any[];
    const yesterday = db!.prepare(`SELECT app as app_name, total_sec as total_seconds, category FROM daily_stats WHERE date = ? ORDER BY total_sec DESC LIMIT 5`).get(formatDateStr(new Date(Date.now() - 86400000))) as any;
    return { success: true, last7dByCategory: weekStats, yesterday: yesterday || null };
  } catch (err: any) {
    return { success: false, error: err.message, last7dByCategory: [], yesterday: null };
  }
});

electron_1.ipcMain.handle('suggest-goals', async (_event, date: string, ctx?: GoalPromptContext) => {
  try {
    const p = userPreferences || {};
    const pState = p.aiProviders ? JSON.parse(p.aiProviders) : null;
    const chain = pState ? buildChain(pState, 'goalAssistant') : [];
    let systemPrompt = `You are a daily goal planner. Based on the user's activity data, suggest 3-5 SMART goals for today (${date}). Return ONLY a JSON array of objects with keys: title (string), category ("work"|"personal"|"health"|"learning"), target ({type:"time", targetSeconds?: number} or {type:"completion", done: false}).`;
    const userParts: string[] = ['Suggest daily goals for today.'];

    if (ctx?.planningContent) {
      systemPrompt += `\n\nThe user has the following plan:\n${ctx.planningContent}\n\nPrefer goals that align with their plan.`;
    }
    if (ctx?.longtermGoals?.length) {
      systemPrompt += `\n\nThe user's long-term goals are:\n${ctx.longtermGoals.map((g: any) => `- ${g.title} (${g.category})`).join('\n')}\n\nSuggest daily goals that make progress toward these long-term goals.`;
    }
    if (ctx?.unfinished?.length) {
      userParts.push(`Unfinished from yesterday: ${ctx.unfinished.map(u => u.title).join(', ')}`);
    }
    if (ctx?.recentlyCompleted?.length) {
      userParts.push(`Already completed recently (do NOT re-suggest): ${ctx.recentlyCompleted.join(', ')}`);
    }
    const userMsg = userParts.join('\n');

    if (chain.length > 0) {
      const { result } = await runWithFallback(chain, { systemPrompt, messages: [{ role: 'user', content: userMsg }], maxTokens: 500, temperature: 0.7 });
      const parsed = JSON.parse(result.content);
      return { success: true, suggestions: Array.isArray(parsed) ? parsed : [] };
    }

    const apiKey = getOpenRouterApiKey();
    if (!apiKey) return { success: false, error: 'No AI providers configured', suggestions: [] };
    const model = p.ai_briefModel || 'google/gemini-2.0-flash-001';
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }], max_tokens: 500 }),
    });
    const data = await response.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '[]');
    return { success: true, suggestions: Array.isArray(parsed) ? parsed : [] };
  } catch (err: any) {
    return { success: false, error: err.message, suggestions: [] };
  }
});

electron_1.ipcMain.handle('review-goals', async (_event, date: string, ctx?: GoalPromptContext) => {
  try {
    const rows = db!.prepare('SELECT * FROM goals WHERE date = ? ORDER BY created_at ASC').all(date) as any[];
    const pending = rows.filter((g: any) => g.status !== 'completed' && g.status !== 'dismissed');
    if (pending.length === 0) return { success: true, review: 'All goals completed or dismissed today.' };

    const p = userPreferences || {};
    const pState = p.aiProviders ? JSON.parse(p.aiProviders) : null;
    const chain = pState ? buildChain(pState, 'goalAssistant') : [];
    let systemPrompt = `You are a goal review assistant. Review these goals for ${date}. For each incomplete goal, suggest: slip (move to tomorrow), dismiss, or reprioritize. Return a JSON object with keys: reviewSummary (string), suggestions (array of {goalId, action: "slip"|"dismiss"|"reprioritize", reason}).`;
    const userMsg = `Pending goals: ${JSON.stringify(pending.map((g: any) => ({ id: g.id, title: g.title, status: g.status })))}`;

    if (ctx?.planningContent) {
      systemPrompt += `\n\nUser's plan context:\n${ctx.planningContent}`;
    }

    if (chain.length > 0) {
      const { result } = await runWithFallback(chain, { systemPrompt, messages: [{ role: 'user', content: userMsg }], maxTokens: 300, temperature: 0.5 });
      const parsed = JSON.parse(result.content);
      const reviewSummary = parsed.reviewSummary || result.content;
      const suggestions = parsed.suggestions || [];
      // Save review
      db!.prepare('INSERT OR REPLACE INTO goal_reviews (date, review_summary, suggestions, created_at) VALUES (?, ?, ?, datetime(\'now\'))')
        .run(date, reviewSummary, JSON.stringify(suggestions));
      return { success: true, review: reviewSummary, suggestions };
    }
    return { success: true, review: 'No AI provider configured for review.', suggestions: [] };
  } catch (err: any) {
    return { success: false, error: err.message, review: '', suggestions: [] };
  }
});

// ─── Parse Goal Feedback ─────────────────────
const GOAL_FEEDBACK_SYSTEM = `You are a goal feedback parser. Given a user's message about their daily goals, extract:
- completed: which goals they finished (match by title or paraphrase)
- note: a short 1-sentence summary of their reflection
Return ONLY JSON: { completed: string[], note: string }`;

electron_1.ipcMain.handle('parse-goal-feedback', async (_event, params: { message: string; goals: string[] }) => {
  const p = userPreferences || {};
  const pState = p.aiProviders ? JSON.parse(p.aiProviders) : null;
  const chain = pState ? buildChain(pState, 'goalAssistant') : [];
  const userMsg = `User says: "${params.message}". Their goals: ${params.goals.join(', ')}`;

  if (chain.length > 0) {
    try {
      const { result } = await runWithFallback(chain, { systemPrompt: GOAL_FEEDBACK_SYSTEM, messages: [{ role: 'user', content: userMsg }], maxTokens: 150 });
      const parsed = JSON.parse(result.content);
      return { completed: parsed.completed || [], added: [], note: parsed.note || '' };
    } catch {
      return { completed: [], added: [], note: '' };
    }
  }

  return { completed: [], added: [], note: '' };
});

// ─── Parse Goal Dump (Bulk Import) ─────────────────────
const GOAL_DUMP_SYSTEM = `You are a goal extractor. Given freeform text from a user, extract actionable long-term goals.
For each goal, provide:
- title: short clear name (required)
- description: 1-sentence detail (optional)
- category: one of: work, personal, health, learning, finance, relationships

Rules:
- Extract ONLY clear, actionable goals. Skip vague wishes.
- If a goal has a deadline, include it in the description.
- Return ONLY a valid JSON array: [{ "title": "...", "description?": "...", "category": "..." }]
- If nothing parseable, return [].`;

electron_1.ipcMain.handle('parse-goal-dump', async (_event, text: string) => {
  const p = userPreferences || {};
  const pState = p.aiProviders ? JSON.parse(p.aiProviders) : null;
  const chain = pState ? buildChain(pState, 'goalAssistant') : [];

  if (chain.length > 0 && text.trim().length > 10) {
    try {
      const { result } = await runWithFallback(chain, {
        systemPrompt: GOAL_DUMP_SYSTEM,
        messages: [{ role: 'user', content: `Extract goals from this text:\n\n${text}` }],
        maxTokens: 800,
        temperature: 0.3,
      });
      const raw = result.content;
      const cleaned = raw.replace(/^```(?:json)?\s*(\[.*?\])\s*```$/s, '$1').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        return { success: true, goals: parsed };
      }
      return { success: true, goals: [] };
    } catch (err: any) {
      console.log('[parse-goal-dump] parse error:', err.message);
      return { success: false, error: 'AI could not parse your text. Try being more specific.', goals: [] };
    }
  }

  if (text.trim().length <= 10) {
    return { success: false, error: 'Please provide at least a few sentences describing your goals.', goals: [] };
  }
  return { success: false, error: 'No AI provider configured for goal parsing. Configure one in Settings → AI Providers.', goals: [] };
});

// --- Browser Tracking HTTP Server ---
function startBrowserTrackingServer() {
    if (!isBrowserTrackingEnabled) {
        console.log('[DeskFlow] 🚫 Browser tracking disabled, server not started');
        return;
    }
    const server = http_1.default.createServer((req, res) => {
        // Only accept POST /browser-data
        if (req.method === 'POST' && req.url === '/browser-data') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    console.log('[DeskFlow] Browser data received:', data.domain, 'is_browser_focused:', data.is_browser_focused);
                    
                    // Block ALL browser data when not focused to prevent
                    // stale website events appearing after switching to a desktop app
                    if (data.is_browser_focused === false) {
                        console.log('[DeskFlow] ⏸️ Browser data skipped - browser not focused:', data.domain);
                    } else {
                        handleBrowserData(data);
                        // Always stream to renderer - let renderer filter
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            const category = categorizeDomain(data.domain, data.title, data.url);
                            try {
                                mainWindow.webContents.send('browser-tracking-event', {
                                    type: 'browser-data',
                                    domain: data.domain,
                                    url: data.url,
                                    title: data.title,
                                    category: category,
                                    duration: data.active_duration_ms,
                                    is_browser_focused: data.is_browser_focused,
                                    timestamp: Date.now()
                                });
                            } catch (_err) {
                                // Render frame disposed before send — window closing, ignore
                            }
                        }
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'ok' }));
                }
                catch (err) {
                    console.error('[DeskFlow] Invalid browser data:', err);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'error', message: 'Invalid JSON' }));
                }
            });
        }
        else if (req.method === 'GET' && req.url === '/health') {
            // Health check endpoint
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', tracking: isBrowserTrackingEnabled }));
        }
        else if (req.method === 'GET' && req.url === '/foreground-app') {
            // Return the current foreground app name so browser extension can check if browser is focused
            // Normalize: strip .exe suffix for consistent comparison with extension's BROWSER_NAME
            const normalizedApp = (currentApp || '').replace(/\.exe$/i, '');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                app: normalizedApp,
                isTracking: isBrowserTrackingEnabled
            }));
        }
        else if (req.method === 'POST' && req.url === '/browser-identify') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    if (data.browser) {
                        userPreferences.browserWithExtension = data.browser;
                        // Store process names from extension if provided, else derive from mapping
                        userPreferences.browserProcessNames = data.processNames || getBrowserProcessNames(data.browser);
                        savePreferences();
                        console.log(`[DeskFlow] 🏷️ Browser extension identified as: ${data.browser} (processes: ${userPreferences.browserProcessNames.join(', ')})`);
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'ok', browser: data.browser }));
                }
                catch (err) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'error', message: 'Invalid JSON' }));
                }
            });
        }
        else if (req.method === 'POST' && req.url === '/browser-log') {
            // Live log streaming endpoint from extension
            let logBody = '';
            req.on('data', chunk => { logBody += chunk.toString(); });
            req.on('end', () => {
                try {
                    const log = JSON.parse(logBody);
                    // Check if browser is focused — prevents stale live-logs
                    // from being processed after user switches to desktop apps
                    const browserFocused = !!currentApp && !!userPreferences?.browserWithExtension &&
                        isAppMatchingBrowser(currentApp, userPreferences.browserWithExtension);
                    if (mainWindow && !mainWindow.isDestroyed() && browserFocused) {
                        const category = categorizeDomain(log.domain, log.title, log.url);
                        console.log('[DeskFlow] Sending live-log with category:', category);
                        try {
                            mainWindow.webContents.send('browser-tracking-event', {
                                type: 'live-log',
                                message: log.message,
                                level: log.level,
                                domain: log.domain,
                                url: log.url,
                                title: log.title,
                                category: category,
                                is_browser_focused: true,
                                timestamp: log.timestamp || Date.now()
                            });
                        } catch (_err) {
                            // Render frame disposed before send — ignore
                        }
                    } else if (mainWindow && !mainWindow.isDestroyed() && !browserFocused) {
                        console.log('[DeskFlow] ⏸️ Live-log skipped - browser not focused');
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: browserFocused ? 'ok' : 'skipped' }));
                }
                catch (err) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'error', message: 'Invalid JSON' }));
                }
            });
        }
        else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'not found' }));
        }
    });
    server.listen(browserServerPort, () => {
        console.log(`[DeskFlow] 🌐 Browser tracking server started on port ${browserServerPort}`);
    });
    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.warn(`[DeskFlow] ⚠️ Port ${browserServerPort} already in use, browser tracking unavailable`);
        }
        else {
            console.error('[DeskFlow] Browser server error:', err.message);
        }
    });
    browserServer = server;
    // FIX 2: Start the stale session flush timer
    startBrowserSessionFlushTimer();
}
// Handle incoming browser tracking data from extension
// FIX 1 + FIX 4: Use Map<string, LogEntry> keyed by domain, track time deltas properly
// FIX: Only track the MOST RECENTLY active tab, not all tabs
function handleBrowserData(data) {
    if (!isBrowserTrackingEnabled)
        return;
    if (!data.domain || !data.url)
        return;
    // Block all browser data when unfocused (phantom deltas from background tabs)
    if (data.is_browser_focused === false) {
        console.log('[DeskFlow] ⏸️ Browser data skipped - browser not focused:', data.domain);
        return;
    }
// Ensure we are on the configured browser before accepting any browser logs.
// Skip if the foreground app does not match the user-configured browser.
if (!currentApp || !userPreferences?.browserWithExtension || !isAppMatchingBrowser(currentApp, userPreferences.browserWithExtension)) {
    console.log('[DeskFlow] ? Browser data skipped � foreground app does not match configured browser:', data.domain, '(current:', currentApp, ')');
    return;
}
    // Check if domain is excluded
    if (categorizeDomain(data.domain, data.title, data.url) === 'Excluded') {
        console.log('[DeskFlow] 🚫 Excluded domain skipped:', data.domain);
        return;
    }
    const sessionDuration = data.active_duration_ms || 0;
    const dataTimestamp = data.timestamp ? new Date(data.timestamp).getTime() : Date.now();
    // Only log if session is meaningful (> 2 seconds)
    if (sessionDuration < 2000)
        return;
    // STRICT MODE: Only track the MOST RECENTLY active tab
    // If this domain is NOT the most recent one, skip it
    if (lastActiveBrowserDomain && lastActiveBrowserDomain !== data.domain) {
        const timeSinceLastActive = dataTimestamp - lastActiveBrowserTimestamp;
        // If the last active was within last 30 seconds and this is a different domain, skip
        if (timeSinceLastActive < 30000) {
            console.log(`[DeskFlow] ⏭️ Skipped non-active browser tab: ${data.domain} (active: ${lastActiveBrowserDomain})`);
            return;
        }
    }
    // Update last active domain
    lastActiveBrowserDomain = data.domain;
    lastActiveBrowserTimestamp = dataTimestamp;
    const existingSession = activeBrowserSessions.get(data.domain);
    if (existingSession) {
        // FIX: Use explicit delta from extension if available (new behavior)
        // Otherwise calculate delta from last recorded duration (legacy behavior)
        let safeDelta;
        if (data.is_periodic && data.delta_ms) {
            // New behavior: extension sends explicit delta (time since last sync)
            safeDelta = Math.min(data.delta_ms, BROWSER_MAX_DELTA_MS);
            console.log(`[DeskFlow] 🔄 Periodic update for ${data.domain}: +${Math.floor(safeDelta / 1000)}s (delta)`);
        }
        else {
            // Legacy behavior: calculate delta from total duration
            const lastDuration = existingSession.duration_ms;
            const delta = sessionDuration - lastDuration;
            safeDelta = Math.min(Math.max(0, delta), BROWSER_MAX_DELTA_MS);
        }
        // Only update if there's actual new time (delta > 0 and reasonable)
        if (safeDelta > 1000) { // At least 1 second of new activity
            existingSession.duration_ms = existingSession.duration_ms + safeDelta;
            existingSession.title = data.title || existingSession.title;
            existingSession.timestamp = data.timestamp || new Date().toISOString();
            // Update in SQLite with the accumulated total
            if (!useJson) {
                try {
                    const updateStmt = db.prepare(`UPDATE logs SET duration_ms = ?, title = ?, url = ?, timestamp = ? WHERE id = ?`);
                    updateStmt.run(existingSession.duration_ms, data.title || existingSession.title, data.sanitized_url || data.url, existingSession.timestamp, existingSession.id);
                }
                catch (err) {
                    console.error('[DeskFlow] Browser session update failed:', err);
                }
            }
            else {
                // For JSON fallback: find and update the entry in jsonLogs
                const idx = jsonLogs.findIndex((l) => l.id === existingSession.id);
                if (idx !== -1) {
                    jsonLogs[idx].duration_ms = existingSession.duration_ms;
                    jsonLogs[idx].title = data.title || jsonLogs[idx].title;
                    jsonLogs[idx].url = data.sanitized_url || data.url;
                    jsonLogs[idx].timestamp = existingSession.timestamp;
                    saveJsonLogs();
                }
            }
            console.log(`[DeskFlow] 🔄 Updated browser session: ${data.domain} → ${Math.floor(existingSession.duration_ms / 1000)}s (+${Math.floor(safeDelta / 1000)}s)`);
            // Update browser_sessions aggregate table with the delta
            if (!useJson && safeDelta > 0) {
                updateAggregates(existingSession.timestamp, existingSession.app, existingSession.category, safeDelta, data.domain, true);
            }
        }
    }
    else {
        // DEDUPLICATION: Check if a recent browser app entry exists (within 5s window)
        // If found, UPDATE it to use domain as app name instead of creating separate entry
        if (!useJson) {
            const recentBrowserApp = db.prepare(`
                SELECT id, app, domain, duration_ms FROM logs 
                WHERE is_browser_tracking = 1
                  AND domain IS NULL
                  AND timestamp > datetime('now', '-5 seconds')
                ORDER BY timestamp DESC
                LIMIT 1
            `).get();
            if (recentBrowserApp) {
                // Update existing entry with domain info
                db.prepare(`
                    UPDATE logs SET 
                      app = ?, domain = ?, url = ?, title = ?,
                      category = ?
                    WHERE id = ?
                `).run(
                    data.domain, data.domain,
                    data.sanitized_url || data.url,
                    data.title || data.domain,
                    categorizeDomain(data.domain, data.title, data.url),
                    recentBrowserApp.id
                );
                console.log(`[DeskFlow] 🔗 Deduplicated browser entry: ${recentBrowserApp.app} → ${data.domain}`);
                // Still create in-memory session for delta tracking
                activeBrowserSessions.set(data.domain, {
                    id: recentBrowserApp.id,
                    timestamp: data.timestamp || new Date().toISOString(),
                    app: data.domain,
                    category: categorizeDomain(data.domain, data.title, data.url),
                    duration_ms: 0,
                    title: data.title || data.domain,
                    domain: data.domain,
                    is_browser_tracking: true
                });
                return;
            }
        }
        // No active session for this domain — create new one
        let newSessionDuration;
        if (data.is_periodic) {
            newSessionDuration = Math.min(data.delta_ms || data.active_duration_ms, MAX_LOGGED_SESSION_MS);
            console.log(`[DeskFlow] 📝 First sync for ${data.domain}: creating new session with ${Math.floor((newSessionDuration || 0) / 1000)}s`);
        }
        newSessionDuration = Math.min(sessionDuration, MAX_LOGGED_SESSION_MS);
        if (sessionDuration > MAX_LOGGED_SESSION_MS) {
            console.warn(`[DeskFlow] ⚠️ Suspicious duration ${Math.floor(sessionDuration / 1000)}s for new session ${data.domain}, capping to 1 hour`);
        }
        const entry = {
            id: Date.now(),
            timestamp: data.timestamp || new Date().toISOString(),
            app: data.domain || data.app || 'Browser',
            category: categorizeDomain(data.domain, data.title, data.url),
            duration_ms: newSessionDuration,
            title: data.title || data.domain,
            project: undefined,
            url: data.sanitized_url || data.url,
            domain: data.domain,
            tab_id: data.tab_id,
            is_browser_tracking: true
        };
        if (useJson) {
            jsonLogs.unshift(entry);
            if (jsonLogs.length > 50000)
                jsonLogs = jsonLogs.slice(0, 50000);
            saveJsonLogs();
        }
        else {
            try {
                const stmt = db.prepare(`
          INSERT INTO logs (timestamp, app, category, duration_ms, title, project, url, domain, tab_id, is_browser_tracking)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
                const result = stmt.run(entry.timestamp, entry.app, entry.category, entry.duration_ms, entry.title, entry.project, entry.url, entry.domain, entry.tab_id, 1);
                entry.id = result.lastInsertRowid;
            }
            catch (err) {
                console.error('[DeskFlow] Browser data insert failed:', err);
            }
        }
        updateAggregates(entry.timestamp, entry.app, entry.category, entry.duration_ms, entry.domain, true);
        activeBrowserSessions.set(data.domain, entry);
        console.log(`[DeskFlow] ✅ Browser logged: ${data.domain} → ${Math.floor(sessionDuration / 1000)}s`);
    }
}
// FIX 2: Periodic flush of stale browser sessions (handles MV3 onSuspend unreliability)
// Called every 30 seconds to flush sessions that haven't been updated in 60+ seconds
let browserSessionFlushInterval = null;
function startBrowserSessionFlushTimer() {
    if (browserSessionFlushInterval)
        clearInterval(browserSessionFlushInterval);
    browserSessionFlushInterval = setInterval(() => {
        const now = Date.now();
        const STALE_THRESHOLD_MS = 60000; // 60 seconds
        for (const [domain, session] of activeBrowserSessions.entries()) {
            // Check if this session is stale by comparing its timestamp
            const sessionAge = now - new Date(session.timestamp).getTime();
            if (sessionAge > STALE_THRESHOLD_MS) {
                // Session is stale — remove from active map (it's already persisted in SQLite)
                activeBrowserSessions.delete(domain);
                console.log(`[DeskFlow] 🧹 Flushed stale browser session: ${domain} (${Math.floor(session.duration_ms / 1000)}s)`);
            }
        }
    }, 30000); // Check every 30 seconds
}
function stopBrowserSessionFlushTimer() {
    if (browserSessionFlushInterval) {
        clearInterval(browserSessionFlushInterval);
        browserSessionFlushInterval = null;
    }
}
function computeBrowserDateRange(period, dateOffset) {
    const now = new Date();
    if (period === 'today') {
        const d = new Date(now);
        d.setDate(d.getDate() - dateOffset);
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
        const end = new Date(d);
        end.setHours(23, 59, 59, 999);
        return { startDate: start, endDate: end.toISOString() };
    }
    if (period === 'week') {
        const weekStart = new Date(now);
        const day = weekStart.getDay();
        const diff = day === 0 ? 6 : day - 1;
        weekStart.setDate(weekStart.getDate() - diff - dateOffset * 7);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        return { startDate: weekStart.toISOString(), endDate: weekEnd.toISOString() };
    }
    if (period === '7day') {
        const end = new Date(now.getTime() - dateOffset * 7 * 24 * 60 * 60 * 1000);
        end.setHours(23, 59, 59, 999);
        const start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
        return { startDate: start.toISOString(), endDate: end.toISOString() };
    }
    if (period === 'month') {
        const targetMonth = new Date(now.getFullYear(), now.getMonth() - dateOffset, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - dateOffset + 1, 0, 23, 59, 59, 999);
        return { startDate: targetMonth.toISOString(), endDate: monthEnd.toISOString() };
    }
    if (period === '30day') {
        const end = new Date(now.getTime() - dateOffset * 30 * 24 * 60 * 60 * 1000);
        end.setHours(23, 59, 59, 999);
        const start = new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);
        return { startDate: start.toISOString(), endDate: end.toISOString() };
    }
    return { startDate: null, endDate: null };
}
// Get browser activity logs
function getBrowserLogs(period, dateOffset = 0) {
    const { startDate, endDate } = computeBrowserDateRange(period, dateOffset);

    if (useJson) {
        let logs = jsonLogs.filter((log) => log.is_browser_tracking);
        if (startDate) {
            logs = logs.filter(l => l.timestamp >= startDate);
        }
        if (endDate) {
            logs = logs.filter(l => l.timestamp <= endDate);
        }
        return logs.slice(0, 200);
    }
    try {
        let query = `SELECT * FROM logs WHERE is_browser_tracking = 1`;
        const params: string[] = [];
        if (startDate) {
            query += ` AND timestamp >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND timestamp <= ?`;
            params.push(endDate);
        }
        // No limit — frontend needs all matching rows for daily/monthly chart aggregation
        query += ` ORDER BY id DESC`;
        const stmt = db.prepare(query);
        return stmt.all(...params);
    }
    catch (err) {
        console.error('[DeskFlow] get-browser-logs error:', err);
        return [];
    }
}
// Get browser stats grouped by domain
function getBrowserDomainStats(period, dateOffset = 0) {
    const { startDate, endDate } = computeBrowserDateRange(period, dateOffset);

    if (useJson) {
        let logs = jsonLogs.filter((log) => log.is_browser_tracking);
        if (startDate) {
            logs = logs.filter(l => l.timestamp >= startDate);
        }
        if (endDate) {
            logs = logs.filter(l => l.timestamp <= endDate);
        }
        const stats = new Map();
        logs.forEach((log) => {
            const key = log.domain || 'unknown';
            const existing = stats.get(key) || { total_ms: 0, sessions: 0, domain: key, category: log.category || 'Other', title: log.title || key };
            existing.total_ms += log.duration_ms;
            existing.sessions += 1;
            stats.set(key, existing);
        });
        return Array.from(stats.values()).sort((a, b) => b.total_ms - a.total_ms);
    }
    try {
        let query = `
      SELECT domain, category, SUM(duration_ms) as total_ms, COUNT(*) as sessions, MAX(title) as title
      FROM logs 
      WHERE is_browser_tracking = 1 AND domain IS NOT NULL
    `;
        const params: string[] = [];
        if (startDate) {
            query += ` AND timestamp >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND timestamp <= ?`;
            params.push(endDate);
        }
        query += ` GROUP BY domain ORDER BY total_ms DESC`;
        const stmt = db.prepare(query);
        return stmt.all(...params);
    }
    catch (err) {
        console.error('[DeskFlow] get-browser-domain-stats error:', err);
        return [];
    }
}
// Get browser stats grouped by category
function getBrowserCategoryStats(period, dateOffset = 0) {
    const { startDate, endDate } = computeBrowserDateRange(period, dateOffset);

    if (useJson) {
        let logs = jsonLogs.filter((log) => log.is_browser_tracking);
        if (startDate) {
            logs = logs.filter(l => l.timestamp >= startDate);
        }
        if (endDate) {
            logs = logs.filter(l => l.timestamp <= endDate);
        }
        const stats = new Map();
        logs.forEach((log) => {
            const key = log.category || 'Other';
            const existing = stats.get(key) || { total_ms: 0, sessions: 0, category: key };
            existing.total_ms += log.duration_ms;
            existing.sessions += 1;
            stats.set(key, existing);
        });
        return Array.from(stats.values()).sort((a, b) => b.total_ms - a.total_ms);
    }
    try {
        let query = `
      SELECT category, SUM(duration_ms) as total_ms, COUNT(*) as sessions
      FROM logs 
      WHERE is_browser_tracking = 1 AND category IS NOT NULL
    `;
        const params: string[] = [];
        if (startDate) {
            query += ` AND timestamp >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND timestamp <= ?`;
            params.push(endDate);
        }
        query += ` GROUP BY category ORDER BY total_ms DESC`;
        const stmt = db.prepare(query);
        return stmt.all(...params);
    }
    catch (err) {
        console.error('[DeskFlow] get-browser-category-stats error:', err);
        return [];
    }
}
electron_1.app.whenReady().then(() => {
    initializeStorage();
    loadFinanceSettings();
    loadCategoryConfig();
    loadSleepState(); // Load sleep tracking state
    
    // Build game detection index from Steam library (once at startup)
    buildInstalledGameIndex();
    
    // Initialize Tracker Mind problems from markdown
    try {
      const problemsService = getProblemsService();
      const problems = problemsService.getProblems();
      console.log(`[Tracker Mind] ✅ Loaded ${problems.length} problems from PROBLEMS.md`);
    } catch (e) {
      console.error('[Tracker Mind] ⚠️ Failed to load problems:', e);
    }
    
    // Check if we should show morning prompt
    checkMorningPrompt();
    
    // Check if started with --minimized flag (background mode)
    startMinimized = process.argv.includes('--minimized') || process.argv.includes('-m');
    
    // Always create tray first (works in background)
    createTray();
    
    // Only create window if NOT starting minimized (background mode)
    if (!startMinimized) {
        createWindow();
    } else {
        // In background mode, just start tracking - no window needed yet
        console.log('[DeskFlow] 🔄 Running in background (minimized)');
    }
    
    startBrowserTrackingServer();
    
    // Set auto-start only once (not every run) - but only if explicitly enabled by user
    // Removed: electron_1.app.setLoginItemSettings auto-set on every run
    
    // Load browser tracking preferences
    if (userPreferences.browserTrackingPort) {
        browserServerPort = userPreferences.browserTrackingPort;
    }
    if (userPreferences.browserTrackingEnabled !== undefined) {
        isBrowserTrackingEnabled = userPreferences.browserTrackingEnabled;
    }
    if (userPreferences.browserExcludedDomains) {
        browserExcludedDomains = userPreferences.browserExcludedDomains;
    }
    if (userPreferences.browserRecordingMode) {
        browserRecordingMode = userPreferences.browserRecordingMode;
    }
    if (userPreferences.appRecordingMode) {
        appRecordingMode = userPreferences.appRecordingMode;
    }

    // Create design caches directory
    try {
      if (!fs_1.default.existsSync(DESIGN_CACHE_DIR)) {
        fs_1.default.mkdirSync(DESIGN_CACHE_DIR, { recursive: true });
        fs_1.default.mkdirSync(path_1.default.join(DESIGN_CACHE_DIR, 'aceternity', 'components'), { recursive: true });
        fs_1.default.mkdirSync(path_1.default.join(DESIGN_CACHE_DIR, 'refero', 'systems'), { recursive: true });
        fs_1.default.mkdirSync(path_1.default.join(DESIGN_CACHE_DIR, '21st-dev', 'search-cache'), { recursive: true });
        const metaPath = path_1.default.join(DESIGN_CACHE_DIR, 'meta.json');
        fs_1.default.writeFileSync(metaPath, JSON.stringify({ version: 1, lastCleanup: new Date().toISOString() }));
      }
    } catch (e) {
      console.error('[DesignCache] Failed to create cache directory:', e);
    }

    // Auto-start 21st-dev MCP server if enabled in config
    try {
      const configPath = path_1.default.join(__dirname, '..', 'opencode.json');
      if (fs_1.default.existsSync(configPath)) {
        const opencodeConfig = JSON.parse(fs_1.default.readFileSync(configPath, 'utf8'));
        const mcpConfig = opencodeConfig.mcp?.['21st-dev'];
        if (mcpConfig) {
          const proc = child_process_1.spawn(mcpConfig.command[0], mcpConfig.command.slice(1), {
            env: { ...process.env, ...mcpConfig.environment },
            stdio: ['pipe', 'pipe', 'pipe'],
          });
          proc.stdout.on('data', (data: Buffer) => handleMCPStdout('21st-dev', data));
          proc.stderr.on('data', (data: Buffer) => console.error('[MCP:21st-dev] stderr:', data.toString()));
          proc.on('exit', (code: number) => {
            const entry = mcpServers.get('21st-dev');
            if (entry) entry.status = 'stopped';
          });
          proc.on('error', (err: Error) => {
            console.error('[MCP:21st-dev] error:', err.message);
            const entry = mcpServers.get('21st-dev');
            if (entry) entry.status = 'error';
          });
          const instance = {
            proc,
            status: 'starting',
            tools: [],
            requestCounter: 0,
            buffer: '',
            initPromise: Promise.resolve(),
            initResolve: null as (() => void) | null,
            pendingRequests: new Map(),
            startTime: Date.now(),
          };
          mcpServers.set('21st-dev', instance as any);
          proc.stdin.write(JSON.stringify({
            jsonrpc: '2.0', id: 1, method: 'initialize',
            params: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, clientInfo: { name: 'deskflow', version: '1.0.0' } }
          }) + '\\n');
          setTimeout(() => {
            const entry = mcpServers.get('21st-dev');
            if (entry && entry.status === 'starting') {
              entry.status = 'running';
              proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\\n');
              sendMCPRequest('21st-dev', 'tools/list').then(r => {
                entry.tools = r?.['tools'] || []
              }).catch(() => {});
            }
          }, 3000);
        }
      }
    } catch (e) {
      console.error('[MCP] Auto-start failed:', e);
    }

    console.log('[DeskFlow] ✅ Real window tracking started with active-win');
    console.log(`[DeskFlow] ✅ Browser tracking: ${isBrowserTrackingEnabled ? 'ON' : 'OFF'}`);
    console.log(`[DeskFlow] ✅ Auto-start: ${electron_1.app.getLoginItemSettings().openAtLogin ? 'enabled' : 'disabled'}`);
});

// ========== External Activities IPC Handlers ==========

electron_1.ipcMain.handle('get-external-activities', () => {
    if (useJson) return [];
    try {
        return db.prepare('SELECT * FROM external_activities WHERE is_visible = 1 ORDER BY sort_order').all();
    } catch (err) {
        console.error('[DeskFlow] Failed to get external activities:', err);
        return [];
    }
});

electron_1.ipcMain.handle('add-external-activity', (event, activity) => {
    if (useJson) return { success: false };
    try {
        const result = db.prepare(`
            INSERT INTO external_activities (name, type, color, icon, default_duration, is_default, sort_order)
            VALUES (?, ?, ?, ?, ?, 0, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM external_activities))
        `).run(activity.name, activity.type, activity.color || '#6366f1', activity.icon || 'Clock', activity.default_duration || 30);
        return { success: true, id: result.lastInsertRowid.toString() };
    } catch (err) {
        console.error('[DeskFlow] Failed to add external activity:', err);
        return { success: false };
    }
});

electron_1.ipcMain.handle('update-external-activity', (event, id, updates) => {
    if (useJson) return false;
    try {
        const fields = [];
        const values = [];
        if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
        if (updates.type !== undefined) { fields.push('type = ?'); values.push(updates.type); }
        if (updates.color !== undefined) { fields.push('color = ?'); values.push(updates.color); }
        if (updates.icon !== undefined) { fields.push('icon = ?'); values.push(updates.icon); }
        if (updates.default_duration !== undefined) { fields.push('default_duration = ?'); values.push(updates.default_duration); }
        if (updates.is_visible !== undefined) { fields.push('is_visible = ?'); values.push(updates.is_visible ? 1 : 0); }
        if (fields.length === 0) return true;
        values.push(id);
        db.prepare(`UPDATE external_activities SET ${fields.join(', ')} WHERE id = ?`).run(...values);
        return true;
    } catch (err) {
        console.error('[DeskFlow] Failed to update external activity:', err);
        return false;
    }
});

electron_1.ipcMain.handle('reorder-external-activities', (event, ordered) => {
    if (useJson) return false;
    try {
        const stmt = db.prepare('UPDATE external_activities SET sort_order = ? WHERE id = ?');
        const tx = db.transaction((items: Array<{ id: number; sort_order: number }>) => {
            for (const item of items) stmt.run(item.sort_order, item.id);
        });
        tx(ordered);
        return true;
    } catch (err) {
        console.error('[DeskFlow] Failed to reorder activities:', err);
        return false;
    }
});

electron_1.ipcMain.handle('delete-external-activity', (event, id) => {
    if (useJson) return false;
    try {
        db.prepare('DELETE FROM external_sessions WHERE activity_id = ?').run(id);
        db.prepare('DELETE FROM external_activities WHERE id = ? AND is_default = 0').run(id);
        return true;
    } catch (err) {
        console.error('[DeskFlow] Failed to delete external activity:', err);
        return false;
    }
});

// ========== External Sessions IPC Handlers ==========

// Auto-start AFK external session
electron_1.ipcMain.handle('start-afk-session', async () => {
    if (useJson) return { success: false, sessionId: null };
    try {
        // Find AFK activity
        const afkActivity = db.prepare("SELECT id FROM external_activities WHERE name = 'AFK' LIMIT 1").get() as any;
        if (!afkActivity) return { success: false, sessionId: null };
        
        // Stop any existing AFK session first, using real duration
        let previousSessionId: string | null = null;
        const existingAfk = db.prepare("SELECT id, started_at FROM external_sessions WHERE activity_id = ? AND ended_at IS NULL").get(afkActivity.id) as any;
        if (existingAfk) {
            const now = new Date();
            const startedAt = new Date(existingAfk.started_at);
            const durationSeconds = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000));
            console.log('[DeskFlow] start-afk-session: closing existing AFK session id=' + existingAfk.id + ' duration=' + durationSeconds + 's');
            db.prepare("UPDATE external_sessions SET ended_at = ?, duration_seconds = ? WHERE id = ?")
                .run(now.toISOString(), durationSeconds, existingAfk.id);
            previousSessionId = existingAfk.id.toString();
        }
        
        // Start new AFK session
        const result = db.prepare(`
            INSERT INTO external_sessions (activity_id, started_at)
            VALUES (?, ?)
        `).run(afkActivity.id, new Date().toISOString());
        
        console.log('[DeskFlow] start-afk-session: created session id=' + result.lastInsertRowid);
        return { success: true, sessionId: result.lastInsertRowid.toString(), previousSessionId, activityId: afkActivity.id };
    } catch (err) {
        console.error('[DeskFlow] Failed to start AFK session:', err);
        return { success: false, sessionId: null };
    }
});

// Stop AFK session when user returns
// Accepts optional newActivityId to reclassify the AFK time to a real activity
electron_1.ipcMain.handle('stop-afk-session', async (event, newActivityId) => {
    if (useJson) return { success: false };
    try {
        console.log('[DeskFlow] stop-afk-session called with newActivityId:', newActivityId);
        const afkActivity = db.prepare("SELECT id FROM external_activities WHERE name = 'AFK' LIMIT 1").get() as any;
        if (!afkActivity) {
            console.warn('[DeskFlow] stop-afk-session: AFK activity not found');
            return { success: false };
        }
        
        let runningAfk = db.prepare("SELECT id, started_at FROM external_sessions WHERE activity_id = ? AND ended_at IS NULL").get(afkActivity.id) as any;
        
        // Fallback: if no AFK-specific session found, try ANY running external session
        if (!runningAfk) {
            console.warn('[DeskFlow] stop-afk-session: No AFK session found, trying ANY running session');
            runningAfk = db.prepare("SELECT id, started_at FROM external_sessions WHERE ended_at IS NULL ORDER BY started_at ASC LIMIT 1").get() as any;
            if (runningAfk) {
                console.log('[DeskFlow] stop-afk-session: Found running session id=' + runningAfk.id + ' as fallback');
            }
        }
        
        if (runningAfk) {
            const now = new Date();
            const startedAt = new Date(runningAfk.started_at);
            const durationSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000);
            console.log('[DeskFlow] stop-afk-session: running session id=' + runningAfk.id + ' started=' + runningAfk.started_at + ' duration=' + durationSeconds + 's');
            
            // If user picked a different activity, update the session's activity_id
            if (newActivityId) {
                console.log('[DeskFlow] stop-afk-session: reclassifying to activity_id=' + newActivityId);
                db.prepare("UPDATE external_sessions SET activity_id = ? WHERE id = ?")
                    .run(Number(newActivityId), runningAfk.id);
                const selAct = db.prepare("SELECT type FROM external_activities WHERE id = ? LIMIT 1").get(Number(newActivityId)) as any;
                if (selAct?.type === 'sleep') {
                    console.log('[DeskFlow] stop-afk-session: setting sleep fields');
                    db.prepare("UPDATE external_sessions SET device_off_to_sleep_seconds = ?, wake_up_to_app_seconds = ? WHERE id = ?")
                        .run(0, 0, runningAfk.id);
                }
            }
            
            db.prepare("UPDATE external_sessions SET ended_at = ?, duration_seconds = ? WHERE id = ?")
                .run(now.toISOString(), durationSeconds, runningAfk.id);
            
            // Notify renderer that external data changed (refresh ExternalPage etc.)
            try {
                event.sender.send('external-data-changed');
            } catch (_) {}
            
            return { success: true, duration: durationSeconds };
        }
        
        console.warn('[DeskFlow] stop-afk-session: No running session found at all');
        return { success: false };
    } catch (err) {
        console.error('[DeskFlow] Failed to stop AFK session:', err);
        return { success: false };
    }
});

// Reclassify a closed AFK session to a different activity
electron_1.ipcMain.handle('reclassify-afk-session', async (event, sessionId: number, newActivityId: number) => {
    if (useJson) return { success: false };
    try {
        const session = db.prepare("SELECT id, activity_id FROM external_sessions WHERE id = ?").get(sessionId) as any;
        if (!session) {
            console.warn('[DeskFlow] reclassify-afk-session: session not found id=' + sessionId);
            return { success: false };
        }
        console.log('[DeskFlow] reclassify-afk-session: session=' + sessionId + ' from activity=' + session.activity_id + ' to=' + newActivityId);
        db.prepare("UPDATE external_sessions SET activity_id = ? WHERE id = ?")
            .run(Number(newActivityId), sessionId);
        try { event.sender.send('external-data-changed'); } catch (_) {}
        return { success: true };
    } catch (err) {
        console.error('[DeskFlow] Failed to reclassify AFK session:', err);
        return { success: false };
    }
});

// Dead-simple direct insert for AFK debug flow — bypasses all session-finding complexity
electron_1.ipcMain.handle('debug-save-afk', async (event, { activityId, startedAt, endedAt }) => {
    if (useJson) return { success: false };
    try {
        const start = new Date(startedAt);
        const end = new Date(endedAt);
        const durationSeconds = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 1000));
        console.log('[DeskFlow] debug-save-afk: activityId=' + activityId + ' start=' + startedAt + ' end=' + endedAt + ' duration=' + durationSeconds + 's');
        const result = db.prepare(
            `INSERT INTO external_sessions (activity_id, started_at, ended_at, duration_seconds) VALUES (?, ?, ?, ?)`
        ).run(Number(activityId), start.toISOString(), end.toISOString(), durationSeconds);
        console.log('[DeskFlow] debug-save-afk: inserted session id=' + result.lastInsertRowid);
        try { event.sender.send('external-data-changed'); } catch (_) {}
        return { success: true, sessionId: result.lastInsertRowid.toString() };
    } catch (err) {
        console.error('[DeskFlow] Failed to debug-save-afk:', err);
        return { success: false };
    }
});

// Batch multi-segment save — inserts multiple external sessions in one transaction (no session-finding)
electron_1.ipcMain.handle('batch-save-afk-segments', async (event, { segments }) => {
    if (useJson) return { success: false, sessionIds: [] };
    try {
        const insertStmt = db.prepare(
            `INSERT INTO external_sessions (activity_id, started_at, ended_at, duration_seconds) VALUES (?, ?, ?, ?)`
        );
        const insertAll = db.transaction((items: { activityId: string; startedAt: string; endedAt: string }[]) => {
            const ids: string[] = [];
            for (const seg of items) {
                const start = new Date(seg.startedAt);
                const end = new Date(seg.endedAt);
                const durationSeconds = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 1000));
                console.log('[DeskFlow] batch-save-afk-segments: activityId=' + seg.activityId + ' start=' + seg.startedAt + ' end=' + seg.endedAt + ' duration=' + durationSeconds + 's');
                const result = insertStmt.run(Number(seg.activityId), start.toISOString(), end.toISOString(), durationSeconds);
                ids.push(result.lastInsertRowid.toString());
            }
            return ids;
        });
        const sessionIds = insertAll(segments);
        console.log('[DeskFlow] batch-save-afk-segments: inserted ' + sessionIds.length + ' sessions');
        try { event.sender.send('external-data-changed'); } catch (_) {}
        return { success: true, sessionIds };
    } catch (err) {
        console.error('[DeskFlow] Failed to batch-save-afk-segments:', err);
        return { success: false, sessionIds: [] };
    }
});

// Guess the most likely external activity for a given timestamp based on typical patterns
electron_1.ipcMain.handle('get-typical-activity-at-time', (event, timestamp) => {
    if (useJson) return null;
    try {
        const date = new Date(timestamp);
        const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon...6=Sat
        const hour = date.getHours();
        
        // Query external sessions for the last 30 days at this day-of-week + hour
        // Sum by activity, return the dominant one (excluding AFK)
        const activity = db.prepare(`
            SELECT ea.id, ea.name, ea.color, SUM(es.duration_seconds) as total_seconds
            FROM external_sessions es
            JOIN external_activities ea ON es.activity_id = ea.id
            WHERE es.ended_at IS NOT NULL
              AND es.duration_seconds > 0
              AND CAST(strftime('%w', es.started_at) AS INTEGER) = ?
              AND CAST(strftime('%H', es.started_at) AS INTEGER) = ?
              AND date(es.started_at) >= date('now', '-30 days')
              AND ea.name != 'AFK'
            GROUP BY ea.id
            ORDER BY total_seconds DESC
            LIMIT 1
        `).get(dayOfWeek, hour) as any;
        
        return activity ? { id: activity.id, name: activity.name, color: activity.color || '#6b7280' } : null;
    } catch (err) {
        console.error('[DeskFlow] get-typical-activity-at-time error:', err);
        return null;
    }
});

// Detect gaps in device/app usage where no activity was tracked, for filling in external activities
electron_1.ipcMain.handle('detect-usage-gaps', (event, { period = 'week', minGapMinutes = 5 } = {}) => {
    if (useJson) return [];
    try {
        const now = new Date();
        let periodStart;
        if (period === 'today') periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        else if (period === 'week') periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        else if (period === 'month') periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        else periodStart = new Date(0);
        const minGapMs = minGapMinutes * 60 * 1000;
        const periodStartIso = periodStart.toISOString();

        const logs = db.prepare(`SELECT timestamp, duration_ms FROM logs WHERE timestamp >= ? ORDER BY timestamp ASC`).all(periodStartIso);
        const externals = db.prepare(`SELECT started_at, ended_at FROM external_sessions WHERE ended_at IS NOT NULL AND started_at >= ?`).all(periodStartIso);

        const intervals = [];
        for (const log of logs) {
            const start = new Date(log.timestamp).getTime();
            const end = start + Math.max((log.duration_ms || 0), 1000);
            intervals.push({ start, end });
        }
        for (const es of externals) {
            const start = new Date(es.started_at).getTime();
            const end = new Date(es.ended_at).getTime();
            if (end > start) intervals.push({ start, end });
        }

        intervals.sort((a, b) => a.start - b.start);
        const merged = [];
        for (const iv of intervals) {
            if (merged.length === 0 || iv.start > merged[merged.length - 1].end) {
                merged.push({ start: iv.start, end: iv.end });
            } else {
                merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, iv.end);
            }
        }

        const gaps = [];
        const periodEndMs = now.getTime();
        const addGap = (s, e) => {
            const sec = Math.floor((e - s) / 1000);
            if (sec >= minGapMinutes * 60) gaps.push({ start: new Date(s).toISOString(), end: new Date(e).toISOString(), durationSeconds: sec });
        };

        if (merged.length === 0) {
            addGap(periodStart.getTime(), periodEndMs);
        } else {
            if (merged[0].start > periodStart.getTime()) addGap(periodStart.getTime(), merged[0].start);
            for (let i = 0; i < merged.length - 1; i++) addGap(merged[i].end, merged[i + 1].start);
            if (periodEndMs > merged[merged.length - 1].end) addGap(merged[merged.length - 1].end, periodEndMs);
        }

        console.log('[DeskFlow] detect-usage-gaps: period=' + period + ' found ' + gaps.length + ' gaps');
        return gaps;
    } catch (err) {
        console.error('[DeskFlow] detect-usage-gaps error:', err);
        return [];
    }
});

electron_1.ipcMain.handle('start-external-session', (event, activityId) => {
    if (useJson) return { success: false };
    try {
        const active = db.prepare(`
            SELECT id, activity_id FROM external_sessions
            WHERE ended_at IS NULL
            ORDER BY started_at DESC
            LIMIT 1
        `).get();
        if (active) {
            if (active.activity_id.toString() === activityId) {
                return { success: true, sessionId: active.id.toString() };
            }
            const startedAt = db.prepare(`SELECT started_at FROM external_sessions WHERE id = ?`).get(active.id);
            if (startedAt) {
                const durationSeconds = Math.floor((Date.now() - new Date(startedAt.started_at).getTime()) / 1000);
                db.prepare(`UPDATE external_sessions SET ended_at = ?, duration_seconds = ? WHERE id = ?`)
                    .run(new Date().toISOString(), durationSeconds, active.id);
            }
        }
        const result = db.prepare(`
            INSERT INTO external_sessions (activity_id, started_at)
            VALUES (?, ?)
        `).run(activityId, new Date().toISOString());
        return { success: true, sessionId: result.lastInsertRowid.toString() };
    } catch (err) {
        console.error('[DeskFlow] Failed to start external session:', err);
        return { success: false };
    }
});

electron_1.ipcMain.handle('stop-external-session', (event, sessionId, endTime, deviceOffToSleepSeconds, wakeUpToAppSeconds) => {
    if (useJson) return { success: false, duration: 0 };
    try {
        const now = endTime ? new Date(endTime) : new Date();
        const session = db.prepare('SELECT * FROM external_sessions WHERE id = ?').get(sessionId);
        if (!session) return { success: false, duration: 0 };
        
        const startedAt = new Date(session.started_at);
        const durationSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000);
        
        if (deviceOffToSleepSeconds !== undefined || wakeUpToAppSeconds !== undefined) {
            const offSleep = deviceOffToSleepSeconds !== undefined ? deviceOffToSleepSeconds : (session.device_off_to_sleep_seconds || 0);
            const wakeApp = wakeUpToAppSeconds !== undefined ? wakeUpToAppSeconds : (session.wake_up_to_app_seconds || 0);
            db.prepare(`
                UPDATE external_sessions 
                SET ended_at = ?, duration_seconds = ?, device_off_to_sleep_seconds = ?, wake_up_to_app_seconds = ?
                WHERE id = ?
            `).run(now.toISOString(), durationSeconds, offSleep, wakeApp, sessionId);
        } else {
            db.prepare(`
                UPDATE external_sessions 
                SET ended_at = ?, duration_seconds = ?
                WHERE id = ?
            `).run(now.toISOString(), durationSeconds, sessionId);
        }
        
        return { success: true, duration: durationSeconds };
    } catch (err) {
        console.error('[DeskFlow] Failed to stop external session:', err);
        return { success: false, duration: 0 };
    }
});

electron_1.ipcMain.handle('update-external-session', (event, sessionId, updates: { started_at?: string; ended_at?: string; duration_seconds?: number }) => {
    if (useJson) return { success: false };
    try {
        const fields: string[] = [];
        const values: any[] = [];
        if (updates.started_at !== undefined) { fields.push('started_at = ?'); values.push(updates.started_at); }
        if (updates.ended_at !== undefined) { fields.push('ended_at = ?'); values.push(updates.ended_at); }
        if (updates.duration_seconds !== undefined) { fields.push('duration_seconds = ?'); values.push(updates.duration_seconds); }
        if (fields.length === 0) return { success: true };
        values.push(sessionId);
        db.prepare(`UPDATE external_sessions SET ${fields.join(', ')} WHERE id = ?`).run(...values);
        return { success: true };
    } catch (err) {
        console.error('[DeskFlow] Failed to update external session:', err);
        return { success: false };
    }
});

electron_1.ipcMain.handle('delete-external-session', (event, sessionId) => {
    if (useJson) return false;
    try {
        db.prepare('DELETE FROM external_sessions WHERE id = ?').run(sessionId);
        return true;
    } catch (err) {
        console.error('[DeskFlow] Failed to delete external session:', err);
        return false;
    }
});

electron_1.ipcMain.handle('add-manual-sleep', (event, sleepData: { started_at: string; ended_at: string; device_off_to_sleep_seconds?: number; wake_up_to_app_seconds?: number }) => {
    if (useJson) return { success: false };
    try {
        const startTime = new Date(sleepData.started_at);
        const endTime = new Date(sleepData.ended_at);
        const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
        
        if (durationSeconds <= 0) {
            return { success: false, error: 'End time must be after start time' };
        }
        
        const sleepActivity = db.prepare(`
            SELECT id FROM external_activities WHERE type = 'sleep' LIMIT 1
        `).get() as any;
        
        if (!sleepActivity) {
            return { success: false, error: 'No sleep activity found' };
        }
        
        const result = db.prepare(`
            INSERT INTO external_sessions (activity_id, started_at, ended_at, duration_seconds, device_off_to_sleep_seconds, wake_up_to_app_seconds)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            sleepActivity.id, 
            startTime.toISOString(), 
            endTime.toISOString(), 
            durationSeconds,
            sleepData.device_off_to_sleep_seconds || 0,
            sleepData.wake_up_to_app_seconds || 0
        );
        
        return { success: true, sessionId: result.lastInsertRowid.toString() };
    } catch (err) {
        console.error('[DeskFlow] Failed to add manual sleep:', err);
        return { success: false };
    }
});

electron_1.ipcMain.handle('get-sleep-for-date', (event, dateStr: string) => {
    if (useJson) return null;
    try {
        const sleepActivity = db.prepare(`SELECT id FROM external_activities WHERE type = 'sleep' LIMIT 1`).get() as any;
        if (!sleepActivity) return null;

        const session = db.prepare(`
            SELECT * FROM external_sessions
            WHERE activity_id = ? AND ended_at IS NOT NULL AND (date(started_at) = ? OR date(ended_at) = ?)
            ORDER BY started_at DESC LIMIT 1
        `).get(sleepActivity.id, dateStr, dateStr) as any;

        if (!session) return null;

        return {
            id: session.id,
            started_at: session.started_at,
            ended_at: session.ended_at,
            device_off_to_sleep_seconds: session.device_off_to_sleep_seconds || 0,
            wake_up_to_app_seconds: session.wake_up_to_app_seconds || 0,
        };
    } catch (err) {
        console.error('[DeskFlow] Failed to get sleep for date:', err);
        return null;
    }
});

electron_1.ipcMain.handle('update-manual-sleep', (event, sessionId: string, sleepData: { started_at: string; ended_at: string; device_off_to_sleep_seconds?: number; wake_up_to_app_seconds?: number }) => {
    if (useJson) return { success: false };
    try {
        const startTime = new Date(sleepData.started_at);
        const endTime = new Date(sleepData.ended_at);
        const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

        if (durationSeconds <= 0) {
            return { success: false, error: 'End time must be after start time' };
        }

        db.prepare(`
            UPDATE external_sessions
            SET started_at = ?, ended_at = ?, duration_seconds = ?, device_off_to_sleep_seconds = ?, wake_up_to_app_seconds = ?
            WHERE id = ?
        `).run(
            startTime.toISOString(),
            endTime.toISOString(),
            durationSeconds,
            sleepData.device_off_to_sleep_seconds || 0,
            sleepData.wake_up_to_app_seconds || 0,
            sessionId
        );

        return { success: true };
    } catch (err) {
        console.error('[DeskFlow] Failed to update manual sleep:', err);
        return { success: false };
    }
});

electron_1.ipcMain.handle('get-active-external-session', (event) => {
    if (useJson) return null;
    try {
        const session = db.prepare(`
            SELECT es.*, ea.name, ea.type, ea.color, ea.icon
            FROM external_sessions es
            JOIN external_activities ea ON es.activity_id = ea.id
            WHERE es.ended_at IS NULL
            ORDER BY es.started_at DESC
            LIMIT 1
        `).get();
        return session || null;
    } catch (err) {
        console.error('[DeskFlow] Failed to get active external session:', err);
        return null;
    }
});

electron_1.ipcMain.handle('get-morning-prompt', (event) => {
    try {
        const promptPath = path_1.default.join(userDataPath, 'show-morning-prompt.json');
        if (fs_1.default.existsSync(promptPath)) {
            const data = JSON.parse(fs_1.default.readFileSync(promptPath, 'utf-8'));
            return data;
        }
        return null;
    } catch (err) {
        console.error('[DeskFlow] Failed to get morning prompt:', err);
        return null;
    }
});

electron_1.ipcMain.handle('dismiss-morning-prompt', (event) => {
    try {
        const promptPath = path_1.default.join(userDataPath, 'show-morning-prompt.json');
        if (fs_1.default.existsSync(promptPath)) {
            fs_1.default.unlinkSync(promptPath);
        }
        return true;
    } catch (err) {
        console.error('[DeskFlow] Failed to dismiss morning prompt:', err);
        return false;
    }
});

// ── Sleep Detection IPC ──
electron_1.ipcMain.handle('check-sleep-detection', (event) => {
    try {
        const detPath = path_1.default.join(userDataPath, 'deskflow-sleep-detection.json');
        if (fs_1.default.existsSync(detPath)) {
            const data = JSON.parse(fs_1.default.readFileSync(detPath, 'utf-8'));
            if (data.detected && !data.checked) {
                // Mark as checked
                data.checked = true;
                fs_1.default.writeFileSync(detPath, JSON.stringify(data, null, 2));
                
                const deviceOff = new Date(data.gapStart);
                const deviceOn = new Date(data.gapEnd);
                
                return {
                    detected: true,
                    gapStart: data.gapStart,
                    gapEnd: data.gapEnd,
                    gapMinutes: data.gapMinutes,
                    suggestedBedtime: deviceOff.toISOString(),
                    suggestedWakeTime: deviceOn.toISOString(),
                };
            }
        }
        return { detected: false };
    } catch (err) {
        console.error('[DeskFlow] Failed to check sleep detection:', err);
        return { detected: false };
    }
});

electron_1.ipcMain.handle('confirm-sleep', (event, sleepData: {
    started_at: string;
    ended_at: string;
    device_off_to_sleep_seconds: number;
    wake_up_to_app_seconds: number;
}) => {
    if (useJson) return { success: false };
    try {
        const startTime = new Date(sleepData.started_at);
        const endTime = new Date(sleepData.ended_at);
        const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
        
        if (durationSeconds <= 0) return { success: false, error: 'End must be after start' };
        
        const sleepActivity = db.prepare(`
            SELECT id FROM external_activities WHERE type = 'sleep' LIMIT 1
        `).get() as any;
        
        if (!sleepActivity) return { success: false, error: 'No sleep activity found' };
        
        const result = db.prepare(`
            INSERT INTO external_sessions (activity_id, started_at, ended_at, duration_seconds, device_off_to_sleep_seconds, wake_up_to_app_seconds)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            sleepActivity.id,
            startTime.toISOString(),
            endTime.toISOString(),
            durationSeconds,
            sleepData.device_off_to_sleep_seconds || 0,
            sleepData.wake_up_to_app_seconds || 0
        );
        
        // Close any running AFK session left from sleep period
        const afkActivity = db.prepare("SELECT id FROM external_activities WHERE name = 'AFK' LIMIT 1").get() as any;
        if (afkActivity) {
            const runningAfk = db.prepare("SELECT id, started_at FROM external_sessions WHERE activity_id = ? AND ended_at IS NULL").get(afkActivity.id) as any;
            if (runningAfk) {
                const now = new Date();
                const closedDuration = Math.max(0, Math.floor((now.getTime() - new Date(runningAfk.started_at).getTime()) / 1000));
                console.log('[DeskFlow] confirm-sleep: closing leftover AFK session id=' + runningAfk.id + ' duration=' + closedDuration + 's');
                db.prepare("UPDATE external_sessions SET ended_at = ?, duration_seconds = ? WHERE id = ?")
                    .run(now.toISOString(), closedDuration, runningAfk.id);
            }
        }
        
        // Save sleep pattern for future recognition
        saveSleepPattern({
            date: startTime.toISOString().split('T')[0],
            sleepStart: startTime.getTime(),
            sleepEnd: endTime.getTime(),
            durationMinutes: Math.round(durationSeconds / 60),
        });
        
        // Clean up detection file
        try {
const detPath = path_1.default.join(userDataPath, 'deskflow-sleep-detection.json');
            if (fs_1.default.existsSync(detPath)) fs_1.default.unlinkSync(detPath);
        } catch { /* ignore */ }
        
        return { success: true, sessionId: result.lastInsertRowid.toString() };
    } catch (err) {
        console.error('[DeskFlow] Failed to confirm sleep:', err);
        return { success: false };
    }
});

electron_1.ipcMain.handle('dismiss-sleep-detection', (event) => {
    try {
        const detPath = path_1.default.join(userDataPath, 'deskflow-sleep-detection.json');
        if (fs_1.default.existsSync(detPath)) {
            fs_1.default.unlinkSync(detPath);
        }
        return true;
    } catch (err) {
        console.error('[DeskFlow] Failed to dismiss sleep detection:', err);
        return false;
    }
});

electron_1.ipcMain.handle('get-external-sessions', (event, period = 'all') => {
    if (useJson) return [];
    try {
        let dateFilter = '';
        const now = new Date();
        
        if (period === 'today') {
            const localStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
            const localEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
            dateFilter = `AND es.started_at >= '${localStart}' AND es.started_at < '${localEnd}'`;
        } else if (period === 'week' || period === '7day') {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            dateFilter = `AND date(es.started_at) >= '${weekAgo}'`;
        } else if (period === 'month' || period === '30day') {
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            dateFilter = `AND date(es.started_at) >= '${monthAgo}'`;
        }
        
        return db.prepare(`
            SELECT es.*, ea.name as activity_name, ea.type, ea.color, ea.icon
            FROM external_sessions es
            JOIN external_activities ea ON es.activity_id = ea.id
            WHERE es.ended_at IS NOT NULL ${dateFilter}
            ORDER BY es.started_at DESC
        `).all();
    } catch (err) {
        console.error('[DeskFlow] Failed to get external sessions:', err);
        return [];
    }
});

electron_1.ipcMain.handle('get-day-detail', (event, dateStr) => {
    if (useJson) return { logs: [], externalSessions: [] };
    try {
        const logs = db.prepare(`
            SELECT * FROM logs WHERE date(timestamp) = ? ORDER BY timestamp ASC
        `).all(dateStr) || [];

        const externalSessions = db.prepare(`
            SELECT es.*, ea.name as activity_name, ea.type, ea.color, ea.icon
            FROM external_sessions es
            JOIN external_activities ea ON es.activity_id = ea.id
            WHERE date(es.started_at) = ? OR date(es.ended_at) = ?
            ORDER BY es.started_at ASC
        `).all(dateStr, dateStr) || [];

        return { logs, externalSessions };
    } catch (err) {
        console.error('[DeskFlow] Failed to get day detail:', err);
        return { logs: [], externalSessions: [] };
    }
});

// ========== External Statistics IPC Handlers ==========

electron_1.ipcMain.handle('get-external-stats', (event, period = 'all') => {
    if (useJson) return { byActivity: {}, total_seconds: 0, sleep_deficit_seconds: 0, average_sleep_hours: 0 };
    try {
        let dateFilter = '';
        const now = new Date();
        
        if (period === 'today') {
            const localStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
            const localEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
            dateFilter = `AND es.started_at >= '${localStart}' AND es.started_at < '${localEnd}'`;
        } else if (period === 'week' || period === '7day') {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            dateFilter = `AND date(es.started_at) >= '${weekAgo}'`;
        } else if (period === 'month' || period === '30day') {
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            dateFilter = `AND date(es.started_at) >= '${monthAgo}'`;
        }
        
        const sessions = db.prepare(`
            SELECT es.*, ea.name, ea.type
            FROM external_sessions es
            JOIN external_activities ea ON es.activity_id = ea.id
            WHERE es.ended_at IS NOT NULL ${dateFilter}
        `).all();
        
        const byActivity: Record<string, { total_seconds: number; session_count: number }> = {};
        let totalSeconds = 0;
        
        for (const s of sessions) {
            if (!byActivity[s.name]) {
                byActivity[s.name] = { total_seconds: 0, session_count: 0 };
            }
            byActivity[s.name].total_seconds += s.duration_seconds || 0;
            byActivity[s.name].session_count += 1;
            totalSeconds += s.duration_seconds || 0;
        }
        
        // Calculate sleep deficit
        const sleepSessions = sessions.filter((s: any) => s.type === 'sleep');
        const targetSleepSeconds = 8 * 3600; // 8 hours
        const totalSleepSeconds = sleepSessions.reduce((sum: number, s: any) => sum + (s.duration_seconds || 0), 0);
        const sleepDeficitSeconds = (targetSleepSeconds * sleepSessions.length) - totalSleepSeconds;
        const averageSleepHours = sleepSessions.length > 0 ? (totalSleepSeconds / sleepSessions.length / 3600) : 0;
        
        return {
            byActivity,
            total_seconds: totalSeconds,
            sleep_deficit_seconds: sleepDeficitSeconds,
            average_sleep_hours: averageSleepHours
        };
    } catch (err) {
        console.error('[DeskFlow] Failed to get external stats:', err);
        return { byActivity: {}, total_seconds: 0, sleep_deficit_seconds: 0, average_sleep_hours: 0 };
    }
});

electron_1.ipcMain.handle('get-comparison-stats', (event, period = 'all') => {
    if (useJson) return { external_seconds: 0, internal_seconds: 0 };
    try {
        let dateFilter = '';
        const now = new Date();

        if (period === 'today') {
            const today = now.toISOString().split('T')[0];
            dateFilter = `AND date(es.started_at) = '${today}'`;
        } else if (period === 'week') {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            dateFilter = `AND date(es.started_at) >= '${weekAgo}'`;
        } else if (period === 'month') {
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            dateFilter = `AND date(es.started_at) >= '${monthAgo}'`;
        }

        const externalSec = db.prepare(`
            SELECT COALESCE(SUM(duration_seconds), 0) as total
            FROM external_sessions es
            WHERE es.ended_at IS NOT NULL ${dateFilter}
        `).get() as any;

        let internalSec = 0;
        let internalDateFilter = '';
        if (period === 'today') {
            const today = now.toISOString().split('T')[0];
            internalDateFilter = `AND date(timestamp) = '${today}'`;
        } else if (period === 'week' || period === '7day') {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            dateFilter = `AND date(es.started_at) >= '${weekAgo}'`;
        } else if (period === 'month' || period === '30day') {
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            dateFilter = `AND date(es.started_at) >= '${monthAgo}'`;
        }
        const internalResult = db.prepare(`
            SELECT COALESCE(SUM(duration_ms), 0) / 1000 as total
            FROM logs
            WHERE duration_ms > 0 ${internalDateFilter}
        `).get() as any;
        internalSec = internalResult?.total || 0;

        return {
            external_seconds: externalSec?.total || 0,
            internal_seconds: internalSec
        };
    } catch (err) {
        console.error('[DeskFlow] Failed to get comparison stats:', err);
        return { external_seconds: 0, internal_seconds: 0 };
    }
});

electron_1.ipcMain.handle('get-activity-stats', (event, activityId: string) => {
    if (useJson) return { today_seconds: 0, week_seconds: 0, month_seconds: 0, session_count: 0 };
    try {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const todayStats = db.prepare(`
            SELECT COALESCE(SUM(duration_seconds), 0) as total, COUNT(*) as count
            FROM external_sessions
            WHERE activity_id = ? AND ended_at IS NOT NULL AND date(started_at) = ?
        `).get(activityId, today) as any;
        
        const weekStats = db.prepare(`
            SELECT COALESCE(SUM(duration_seconds), 0) as total, COUNT(*) as count
            FROM external_sessions
            WHERE activity_id = ? AND ended_at IS NOT NULL AND date(started_at) >= ?
        `).get(activityId, weekAgo) as any;
        
        const monthStats = db.prepare(`
            SELECT COALESCE(SUM(duration_seconds), 0) as total, COUNT(*) as count
            FROM external_sessions
            WHERE activity_id = ? AND ended_at IS NOT NULL AND date(started_at) >= ?
        `).get(activityId, monthAgo) as any;
        
        return {
            today_seconds: todayStats?.total || 0,
            week_seconds: weekStats?.total || 0,
            month_seconds: monthStats?.total || 0,
            session_count: todayStats?.count || 0
        };
    } catch (err) {
        console.error('[DeskFlow] Failed to get activity stats:', err);
        return { today_seconds: 0, week_seconds: 0, month_seconds: 0, session_count: 0 };
    }
});

// Get current foreground app (for Dashboard mount — foreground-changed only fires on change)
electron_1.ipcMain.handle('get-current-foreground', () => {
    if (useJson) return null;
    try {
        if (!currentApp) return null;
        const category = categorizeApp(currentApp);
        return {
            app: currentApp,
            category,
            title: '',
            timestamp: new Date().toISOString(),
            isReal: true
        };
    } catch {
        return null;
    }
});

// ========== Productivity Sessions IPC Handlers ==========

electron_1.ipcMain.handle('save-productivity-session', (event, session: {
    started_at: string;
    ended_at?: string;
    duration_seconds?: number;
    app_name?: string;
    category?: string;
    is_streak?: boolean;
}) => {
    if (useJson) return null;
    try {
        const started = new Date(session.started_at);
        const day = started.getDay();
        const weekNum = getWeekNumber(started);
        const month = `${started.getFullYear()}-${started.getMonth() + 1}`;

        const result = db.prepare(`
            INSERT INTO productivity_sessions (started_at, ended_at, duration_seconds, app_name, category, is_streak, day, week_number, month)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            session.started_at,
            session.ended_at || null,
            session.duration_seconds || 0,
            session.app_name || null,
            session.category || null,
            session.is_streak ? 1 : 0,
            day,
            weekNum,
            month
        );

        return { id: result.lastInsertRowid };
    } catch (err) {
        console.error('[DeskFlow] Failed to save productivity session:', err);
        return null;
    }
});

electron_1.ipcMain.handle('get-productivity-sessions', (event, opts: {
    period?: 'today' | 'week' | '7day' | 'month' | '30day' | 'all';
    dateOffset?: number;
    minDuration?: number;
    limit?: number;
    offset?: number;
} = {}) => {
    if (useJson) return { sessions: [], stats: { todayBest: 0, weekBest: 0, allTimeBest: 0, todayTotal: 0, weekTotal: 0, longestStreak: 0 } };
    try {
        const { period = 'all', dateOffset = 0, minDuration = 0, limit = 50, offset = 0 } = opts;
        let dateFilter = '';
        const now = new Date();

        const periodDays = period === 'today' ? 1 : period === 'week' || period === '7day' ? 7 : period === 'month' || period === '30day' ? 30 : 0;
        const shifted = new Date(now.getTime() + dateOffset * periodDays * 24 * 60 * 60 * 1000);

        if (period === 'today') {
            const today = shifted.toISOString().split('T')[0];
            dateFilter = `AND date(ps.started_at) = '${today}'`;
        } else if (period === 'week' || period === '7day') {
            const weekAgo = new Date(shifted.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            dateFilter = `AND date(ps.started_at) >= '${weekAgo}'`;
        } else if (period === 'month' || period === '30day') {
            const monthAgo = new Date(shifted.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            dateFilter = `AND date(ps.started_at) >= '${monthAgo}'`;
        }

        const sessions = db.prepare(`
            SELECT ps.*,
                (SELECT MAX(duration_seconds) FROM productivity_sessions WHERE date(started_at) = date(ps.started_at)) as day_best,
                (SELECT SUM(duration_seconds) FROM productivity_sessions WHERE date(started_at) = date(ps.started_at)) as day_total
            FROM productivity_sessions ps
            WHERE ps.duration_seconds >= ? ${dateFilter}
            ORDER BY ps.duration_seconds DESC, ps.started_at DESC
            LIMIT ? OFFSET ?
        `).all(minDuration, limit, offset);

        const stats = (() => {
            const today = shifted.toISOString().split('T')[0];
            const weekAgo = new Date(shifted.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            const todayBest = db.prepare(`
                SELECT MAX(duration_seconds) as best FROM productivity_sessions WHERE date(started_at) = ? AND duration_seconds >= ?
            `).get(today, minDuration) as any;

            const weekBest = db.prepare(`
                SELECT MAX(duration_seconds) as best FROM productivity_sessions WHERE date(started_at) >= ? AND duration_seconds >= ?
            `).get(weekAgo, minDuration) as any;

            const allTimeBest = db.prepare(`
                SELECT MAX(duration_seconds) as best FROM productivity_sessions WHERE duration_seconds >= ?
            `).get(minDuration) as any;

            const todayTotal = db.prepare(`
                SELECT COALESCE(SUM(duration_seconds), 0) as total FROM productivity_sessions WHERE date(started_at) = ? AND duration_seconds >= ?
            `).get(today, minDuration) as any;

            const weekTotal = db.prepare(`
                SELECT COALESCE(SUM(duration_seconds), 0) as total FROM productivity_sessions WHERE date(started_at) >= ? AND duration_seconds >= ?
            `).get(weekAgo, minDuration) as any;

            return {
                todayBest: todayBest?.best || 0,
                weekBest: weekBest?.best || 0,
                allTimeBest: allTimeBest?.best || 0,
                todayTotal: todayTotal?.total || 0,
                weekTotal: weekTotal?.total || 0,
                longestStreak: 0
            };
        })();

        return { sessions, stats };
    } catch (err) {
        console.error('[DeskFlow] Failed to get productivity sessions:', err);
        return { sessions: [], stats: { todayBest: 0, weekBest: 0, allTimeBest: 0, todayTotal: 0, weekTotal: 0, longestStreak: 0 } };
    }
});

electron_1.ipcMain.handle('clear-productivity-sessions', () => {
    if (useJson) return;
    try {
        db.prepare('DELETE FROM productivity_sessions').run();
        console.log('[DeskFlow] All productivity sessions cleared');
    } catch (err) {
        console.error('[DeskFlow] Failed to clear productivity sessions:', err);
    }
});

function getWeekNumber(d: Date): number {
    const oneJan = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d.getTime() - oneJan.getTime()) / 86400000) + oneJan.getDay() + 1) / 7);
}



function emptyTypicalDayGrid(days: number) {
    return {
        grid: Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({
            activities: [], totalSeconds: 0, dominantActivity: 'none', hasExternal: false, hasDevice: false
        }))),
        legend: [], stats: { totalHours: 0, mostActiveHour: { hour: 0, day: 0 }, mostActiveDay: 0, activityBreakdown: {} },
        generatedAt: new Date().toISOString(), daysCovered: days
    };
}

electron_1.ipcMain.handle('get-typical-day', (event, days = 30, dateOffset = 0) => {
    if (useJson) return emptyTypicalDayGrid(days);
    try {
        const now = new Date();
        const offsetMs = dateOffset * days * 24 * 60 * 60 * 1000;
        const endDate = new Date(now.getTime() - offsetMs);
        const startStr = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];
        const grid: any[][] = Array.from({ length: 7 }, () =>
            Array.from({ length: 24 }, () => ({
                activities: [], totalSeconds: 0, dominantActivity: 'none', hasExternal: false, hasDevice: false
            }))
        );
        const activityTotals: Record<string, number> = {};
        const weekCount = days / 7;

        const externalSessions = db.prepare(`
            SELECT es.started_at, es.ended_at, es.duration_seconds, ea.name, ea.color
            FROM external_sessions es
            JOIN external_activities ea ON es.activity_id = ea.id
            WHERE es.ended_at IS NOT NULL AND date(es.started_at) >= date(?) AND date(es.started_at) <= date(?) AND es.duration_seconds > 0
        `).all(startStr, endStr) as any[];

        for (const s of externalSessions) {
            const start = new Date(s.started_at), end = new Date(s.ended_at), activity = s.name, activityColor = s.color || '#6b7280';
            let remaining = s.duration_seconds || 0, current = new Date(start);
            while (remaining > 0 && current < end) {
                const dayOfWeek = current.getDay(), hour = current.getHours();
                const hourEnd = new Date(current); hourEnd.setMinutes(59, 59, 999);
                const secInHour = Math.min(remaining, Math.max(0, Math.floor((Math.min(end.getTime(), hourEnd.getTime()) - current.getTime()) / 1000)));
                if (secInHour > 0) {
                    const cell = grid[dayOfWeek][hour];
                    const existing = cell.activities.find((a: any) => a.activity === activity);
                    if (existing) existing.seconds += secInHour;
                    else cell.activities.push({ activity, seconds: secInHour, percentage: 0, color: activityColor });
                    cell.totalSeconds += secInHour; cell.hasExternal = true;
                    activityTotals[activity] = (activityTotals[activity] || 0) + secInHour;
                    remaining -= secInHour;
                }
                current = new Date(current.getTime() + 3600000); current.setMinutes(0, 0, 0);
            }
        }

        const deviceLogs = db.prepare(`
            SELECT timestamp, app, category, duration_ms FROM logs
            WHERE date(timestamp) >= date(?) AND date(timestamp) <= date(?) AND duration_ms > 0
        `).all(startStr, endStr) as any[];

        for (const log of deviceLogs) {
            const start = new Date(log.timestamp), dayOfWeek = start.getDay(), hour = start.getHours();
            const duration = Math.round((log.duration_ms || 0) / 1000);
            if (duration <= 0) continue;
            const activity = log.category || 'Other';
            const cell = grid[dayOfWeek][hour];
            const existing = cell.activities.find((a: any) => a.activity === activity);
            if (existing) existing.seconds += duration;
            else cell.activities.push({ activity, seconds: duration, percentage: 0, color: '' });
            cell.totalSeconds += duration; cell.hasDevice = true;
            activityTotals[activity] = (activityTotals[activity] || 0) + duration;
        }

        let maxCellSec = 0;
        let mostActiveHour = { hour: 0, day: 0, seconds: 0 };
        const dayTotals = Array(7).fill(0);

        for (let d = 0; d < 7; d++) {
            for (let h = 0; h < 24; h++) {
                const cell = grid[d][h];
                cell.totalSeconds = Math.round(cell.totalSeconds / weekCount);
                for (const a of cell.activities) {
                    a.seconds = Math.round(a.seconds / weekCount);
                    a.percentage = cell.totalSeconds > 0 ? Math.round((a.seconds / cell.totalSeconds) * 100) : 0;
                }
                cell.activities.sort((a: any, b: any) => b.seconds - a.seconds);
                cell.activities = cell.activities.filter((a: any) => a.percentage >= 10 || a.seconds >= 60);
                const totalF = cell.activities.reduce((sum: number, a: any) => sum + a.seconds, 0);
                for (const a of cell.activities) a.percentage = totalF > 0 ? Math.round((a.seconds / totalF) * 100) : 0;
                if (cell.activities.length > 0) cell.dominantActivity = cell.activities[0].activity;
                if (cell.totalSeconds > maxCellSec) { maxCellSec = cell.totalSeconds; mostActiveHour = { hour: h, day: d, seconds: cell.totalSeconds }; }
                dayTotals[d] += cell.totalSeconds;
            }
        }

        const legend = Object.entries(activityTotals)
            .map(([activity, seconds]: any) => ({ activity, color: '', totalSeconds: Math.round(seconds / weekCount) }))
            .sort((a: any, b: any) => b.totalSeconds - a.totalSeconds).slice(0, 8);

        const totalHours = Math.round(Object.values(activityTotals).reduce((sum: number, s: any) => sum + s, 0) / 3600 / weekCount);
        const mostActiveDay = dayTotals.indexOf(Math.max(...dayTotals));

        return { grid, legend, stats: { totalHours, mostActiveHour: { hour: mostActiveHour.hour, day: mostActiveHour.day }, mostActiveDay, activityBreakdown: Object.fromEntries(legend.map((l: any) => [l.activity, Math.round(l.totalSeconds / 3600)])) }, generatedAt: now.toISOString(), daysCovered: days };
    } catch (err) {
        console.error('[DeskFlow] Failed to get typical day:', err);
        return emptyTypicalDayGrid(days);
    }
});

electron_1.ipcMain.handle('get-hourly-heatmap', (event, days = 7) => {
    if (useJson) return [[0]];
    try {
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const sessions = db.prepare(`
            SELECT es.started_at, es.duration_seconds
            FROM external_sessions es
            WHERE es.ended_at IS NOT NULL AND date(es.started_at) >= ?
        `).all(startDate) as any[];
        const grid: number[][] = [];
        for (let d = 0; d < 7; d++) { grid[d] = []; for (let h = 0; h < 24; h++) grid[d][h] = 0; }
        for (const s of sessions) {
            const date = new Date(s.started_at);
            grid[date.getDay()][date.getHours()] += (s.duration_seconds || 0) / 3600;
        }
        return grid;
    } catch (err) { return [[0]]; }
});

electron_1.ipcMain.handle('get-best-days', () => {
    if (useJson) return { bestDay: 'Mon', worstDay: 'Sun', averages: {} };
    try {
        const sessions = db.prepare(`SELECT started_at, duration_seconds FROM external_sessions WHERE ended_at IS NOT NULL`).all() as any[];
        const dayTotals: Record<number, { total: number; count: number }> = {};
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        for (let d = 0; d < 7; d++) dayTotals[d] = { total: 0, count: 0 };
        for (const s of sessions) {
            const day = new Date(s.started_at).getDay();
            dayTotals[day].total += s.duration_seconds || 0;
            dayTotals[day].count += 1;
        }
        const averages: Record<string, number> = {};
        let bestDay = 'Mon', worstDay = 'Sun', bestAvg = 0, worstAvg = Infinity;
        for (let d = 0; d < 7; d++) {
            const name = dayNames[d];
            const avg = dayTotals[d].count > 0 ? dayTotals[d].total / dayTotals[d].count : 0;
            averages[name] = Math.round(avg / 3600 * 10) / 10;
            if (avg > bestAvg) { bestAvg = avg; bestDay = name; }
            if (avg < worstAvg && dayTotals[d].count > 0) { worstAvg = avg; worstDay = name; }
        }
        return { bestDay, worstDay, averages };
    } catch (err) { return { bestDay: 'Mon', worstDay: 'Sun', averages: {} }; }
});

electron_1.ipcMain.handle('get-sleep-trends', (event, period = 'week', dateOffset = 0) => {
    if (useJson) return { daily: [], average_bedtime: '', average_wake_time: '', average_sleep_duration: 0, average_latency: 0, average_wake_latency: 0 };
    try {
        let dateFilter = '';
        const now = new Date();
        
        if (period === 'today') {
            const localRef = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dateOffset);
            const localStart = localRef.toISOString();
            const localEnd = new Date(localRef.getFullYear(), localRef.getMonth(), localRef.getDate() + 2).toISOString();
            dateFilter = `AND ((es.started_at >= '${localStart}' AND es.started_at < '${localEnd}') OR (es.ended_at >= '${localStart}' AND es.ended_at < '${localEnd}'))`;
        } else if (period === 'week') {
            const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const day = weekStart.getDay();
            const diff = day === 0 ? 6 : day - 1;
            weekStart.setDate(weekStart.getDate() - diff - dateOffset * 7);
            weekStart.setHours(0, 0, 0, 0);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 8);
            dateFilter = `AND ((es.started_at >= '${weekStart.toISOString()}' AND es.started_at < '${weekEnd.toISOString()}') OR (es.ended_at >= '${weekStart.toISOString()}' AND es.ended_at < '${weekEnd.toISOString()}'))`;
        } else {
            const days = period === '7day' ? 7 : period === 'month' || period === '30day' ? 30 : period === 'all' ? -1 : 7;
            if (days > 0) {
                const rangeEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dateOffset * days + 1);
                const rangeStart = new Date(rangeEnd.getTime() - days * 24 * 60 * 60 * 1000);
                dateFilter = `AND ((es.started_at >= '${rangeStart.toISOString()}' AND es.started_at < '${rangeEnd.toISOString()}') OR (es.ended_at >= '${rangeStart.toISOString()}' AND es.ended_at < '${rangeEnd.toISOString()}'))`;
            }
        }
        
        const sessions = db.prepare(`
            SELECT es.*, ea.name, ea.type
            FROM external_sessions es
            JOIN external_activities ea ON es.activity_id = ea.id
            WHERE ea.type = 'sleep' AND es.ended_at IS NOT NULL ${dateFilter}
            ORDER BY es.started_at ASC
        `).all();
        
        const daily: Array<{ date: string; sleep_seconds: number; deficit_seconds: number; pre_sleep_seconds: number; post_wake_seconds: number; bedtime_minutes: number; waketime_minutes: number }> = [];
        const targetSleep = 8 * 3600;
        
        const toLocalDate = (iso: string) => {
            const d = new Date(iso);
            return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        };
        
        // Group by **bedtime evening**, not calendar date of started_at.
        // If bedtime is AM (after midnight, hour < 12), shift to the PREVIOUS day
        // because the user stayed up late the night before.
        // If bedtime is PM (before midnight, hour >= 12), keep on same day.
        const getSleepGroupDate = (iso: string) => {
            const d = new Date(iso);
            const h = d.getHours();
            if (h < 12) d.setDate(d.getDate() - 1);
            return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        };
        
        const byDate: Record<string, { sleep_seconds: number; bedtime_count: number; bedtime_sum: number; waketime_sum: number; pre_sleep_sum: number; post_wake_sum: number }> = {};
        for (const s of sessions) {
            const date = getSleepGroupDate(s.started_at);
            if (!byDate[date]) {
                byDate[date] = { sleep_seconds: 0, bedtime_count: 0, bedtime_sum: 0, waketime_sum: 0, pre_sleep_sum: 0, post_wake_sum: 0 };
            }
            byDate[date].sleep_seconds += s.duration_seconds || 0;
            byDate[date].bedtime_count += 1;
            const bedtime = new Date(s.started_at);
            const waketime = new Date(s.ended_at);
            
            byDate[date].bedtime_sum += bedtime.getHours() * 60 + bedtime.getMinutes();
            byDate[date].waketime_sum += waketime.getHours() * 60 + waketime.getMinutes();
            byDate[date].pre_sleep_sum += s.device_off_to_sleep_seconds || 0;
            byDate[date].post_wake_sum += s.wake_up_to_app_seconds || 0;
        }
        
        for (const [date, data] of Object.entries(byDate)) {
            const avgBedtimeMinutes = data.bedtime_count > 0 ? Math.round(data.bedtime_sum / data.bedtime_count) : 0;
            let avgWaketimeMinutes = data.bedtime_count > 0 ? Math.round(data.waketime_sum / data.bedtime_count) : 0;
            const avgPreSleepSec = Math.round(data.pre_sleep_sum / data.bedtime_count) || 0;
            const avgPostWakeSec = Math.round(data.post_wake_sum / data.bedtime_count) || 0;
            
            // Sanity cap: pre-sleep can't exceed 50% of total sleep duration
            const safePreSleepSec = Math.min(avgPreSleepSec, data.sleep_seconds * 0.5);
            
            // Actual sleep start = app exit time + pre-sleep duration
            const actualSleepStartMinutes = avgBedtimeMinutes + Math.round(safePreSleepSec / 60);
            const actualSleepSeconds = Math.max(0, data.sleep_seconds - safePreSleepSec);
            
            // Adjust for midnight crossing
            let rawWakeMinutes = avgWaketimeMinutes;
            if (rawWakeMinutes < 720 && actualSleepStartMinutes > 720) {
                // normal night sleep
            } else if (rawWakeMinutes < actualSleepStartMinutes) {
                rawWakeMinutes += 24 * 60;
            }
            
            daily.push({
                date,
                sleep_seconds: actualSleepSeconds,
                deficit_seconds: targetSleep - actualSleepSeconds,
                pre_sleep_seconds: avgPreSleepSec,
                post_wake_seconds: avgPostWakeSec,
                bedtime_minutes: avgBedtimeMinutes, // raw app exit time (started_at), NO SHIFT
                waketime_minutes: rawWakeMinutes % (24 * 60)
            });
        }
        
        // Calculate average bedtime
        const allBedtimes = sessions.map((s: any) => {
            const d = new Date(s.started_at);
            return d.getHours() * 60 + d.getMinutes();
        });
        const avgBedtimeMinutes = allBedtimes.length > 0 ? Math.round(allBedtimes.reduce((a: number, b: number) => a + b, 0) / allBedtimes.length) : 0;
        const avgBedtime = `${Math.floor(avgBedtimeMinutes / 60).toString().padStart(2, '0')}:${(avgBedtimeMinutes % 60).toString().padStart(2, '0')}`;
        
        // Calculate average wake time
        const allWaketimes = sessions.map((s: any) => {
            const d = new Date(s.ended_at);
            return d.getHours() * 60 + d.getMinutes();
        });
        let avgWaketimeMinutes = allWaketimes.length > 0 ? Math.round(allWaketimes.reduce((a: number, b: number) => a + b, 0) / allWaketimes.length) : 0;
        const avgWaketime = `${Math.floor(avgWaketimeMinutes / 60).toString().padStart(2, '0')}:${(avgWaketimeMinutes % 60).toString().padStart(2, '0')}`;
        
        // Calculate average sleep duration (actual sleep, excluding pre-sleep delay)
        const totalSleepSeconds = sessions.reduce((sum: number, s: any) => sum + Math.max(0, (s.duration_seconds || 0) - (s.device_off_to_sleep_seconds || 0)), 0);
        const avgSleepDuration = sessions.length > 0 ? Math.round(totalSleepSeconds / sessions.length) : 0;
        
        // Calculate average latencies
        const avgLatency = sessions.length > 0 
            ? Math.round(sessions.reduce((sum: number, s: any) => sum + (s.device_off_to_sleep_seconds || 0), 0) / sessions.length)
            : 0;
        
        const avgWakeLatency = sessions.length > 0 
            ? Math.round(sessions.reduce((sum: number, s: any) => sum + (s.wake_up_to_app_seconds || 0), 0) / sessions.length)
            : 0;
        
        return { 
            daily, 
            average_bedtime: avgBedtime, 
            average_wake_time: avgWaketime,
            average_sleep_duration: avgSleepDuration,
            average_latency: avgLatency,
            average_wake_latency: avgWakeLatency
        };
    } catch (err) {
        console.error('[DeskFlow] Failed to get sleep trends:', err);
        return { daily: [], average_bedtime: '', average_wake_time: '', average_sleep_duration: 0, average_latency: 0, average_wake_latency: 0 };
    }
});

electron_1.ipcMain.handle('get-sleep-debug', (event, period = 'week', dateOffset = 0) => {
    if (useJson) return { sessions: [], trends: null };
    try {
        let dateFilter = '';
        const now = new Date();
        
        if (period === 'today') {
            const localRef = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dateOffset);
            const localStart = localRef.toISOString();
            const localEnd = new Date(localRef.getFullYear(), localRef.getMonth(), localRef.getDate() + 1).toISOString();
            dateFilter = `AND es.started_at >= '${localStart}' AND es.started_at < '${localEnd}'`;
        } else {
            const days = period === 'week' || period === '7day' ? 7 : period === 'month' || period === '30day' ? 30 : period === 'all' ? -1 : 7;
            if (days > 0) {
                const rangeEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dateOffset * days);
                const rangeStart = new Date(rangeEnd.getTime() - days * 24 * 60 * 60 * 1000);
                dateFilter = `AND es.started_at >= '${rangeStart.toISOString()}' AND es.started_at < '${rangeEnd.toISOString()}'`;
            }
        }
        
        const sessions = db.prepare(`
            SELECT es.id, es.activity_id, es.started_at, es.ended_at, es.duration_seconds,
                   es.device_off_to_sleep_seconds, es.wake_up_to_app_seconds, ea.name, ea.type
            FROM external_sessions es
            JOIN external_activities ea ON es.activity_id = ea.id
            WHERE ea.type = 'sleep' AND es.ended_at IS NOT NULL ${dateFilter}
            ORDER BY es.started_at DESC
        `).all();
        const trends = db.prepare(`
            SELECT es.*, ea.name, ea.type
            FROM external_sessions es
            JOIN external_activities ea ON es.activity_id = ea.id
            WHERE ea.type = 'sleep' AND es.ended_at IS NOT NULL ${dateFilter}
            ORDER BY es.started_at ASC
        `).all();
        return { sessions, trendsRaw: trends, queryRange: { dateFilter } };
    } catch (err) {
        console.error('[DeskFlow] Failed to get sleep debug:', err);
        return { sessions: [], trendsRaw: [], queryRange: null };
    }
});

electron_1.ipcMain.handle('fix-sleep-dates', () => {
    if (useJson) return { fixed: 0, message: 'JSON mode, no-op' };
    try {
        const sleepActivity = db.prepare(`SELECT id FROM external_activities WHERE type = 'sleep' LIMIT 1`).get() as any;
        if (!sleepActivity) return { fixed: 0, message: 'No sleep activity found' };

        const sessions = db.prepare(`
            SELECT * FROM external_sessions
            WHERE activity_id = ? AND ended_at IS NOT NULL
            ORDER BY started_at ASC
        `).all(sleepActivity.id) as any[];

        let fixedCount = 0;
        const updates: Array<{ id: number; oldEnd: string; newEnd: string; oldDuration: number; newDuration: number }> = [];

        for (const s of sessions) {
            const startD = new Date(s.started_at);
            const endD = new Date(s.ended_at);

            const startDateStr = `${startD.getFullYear()}-${String(startD.getMonth()+1).padStart(2,'0')}-${String(startD.getDate()).padStart(2,'0')}`;
            const endDateStr = `${endD.getFullYear()}-${String(endD.getMonth()+1).padStart(2,'0')}-${String(endD.getDate()).padStart(2,'0')}`;

            if (startDateStr === endDateStr) continue;

            const startH = startD.getHours();
            const endH = endD.getHours();

            // Both in AM (before noon) → same calendar day, end date was wrongly pushed to next day
            if (startH < 12 && endH < 12) {
                const fixedEnd = new Date(startD);
                fixedEnd.setHours(endD.getHours(), endD.getMinutes(), endD.getSeconds(), endD.getMilliseconds());

                const newDuration = Math.max(0, Math.floor((fixedEnd.getTime() - startD.getTime()) / 1000));

                db.prepare(`UPDATE external_sessions SET ended_at = ?, duration_seconds = ? WHERE id = ?`).run(
                    fixedEnd.toISOString(), newDuration, s.id
                );

                updates.push({
                    id: s.id,
                    oldEnd: s.ended_at,
                    newEnd: fixedEnd.toISOString(),
                    oldDuration: s.duration_seconds || 0,
                    newDuration
                });
                fixedCount++;
            }
        }

        return { fixed: fixedCount, message: `Fixed ${fixedCount} sleep session(s)` };
    } catch (err) {
        console.error('[DeskFlow] Failed to fix sleep dates:', err);
        return { fixed: 0, message: 'Error fixing sleep dates' };
    }
});

electron_1.ipcMain.handle('get-consistency-score', (event, period = 'week') => {
    if (useJson) return { score: 0, weekly_comparison: [], this_week: 0, last_week: 0, trend: 'stable', streak: 0 };
    try {
        const weeks = 4;
        const weeklyTotals: Array<{ week: string; total_seconds: number }> = [];
        const now = new Date();
        
        for (let i = weeks - 1; i >= 0; i--) {
            const daysAgo = (i + 1) * 7;
            const weekStart = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
            weekStart.setHours(0, 0, 0, 0);
            
            const daysAgoEnd = i * 7;
            const weekEnd = new Date(now.getTime() - daysAgoEnd * 24 * 60 * 60 * 1000);
            weekEnd.setHours(0, 0, 0, 0);
            
            const weekLabel = `${weekStart.toISOString().split('T')[0]}`;
            
            const sessions = db.prepare(`
                SELECT COALESCE(SUM(duration_seconds), 0) as total
                FROM external_sessions
                WHERE ended_at IS NOT NULL 
                AND date(started_at) >= date(?) AND date(started_at) < date(?, '+1 day')
            `).get(weekStart.toISOString().split('T')[0], weekEnd.toISOString().split('T')[0]) as any;
            
            weeklyTotals.push({
                week: weekLabel,
                total_seconds: sessions?.total || 0
            });
        }
        
        const currentWeek = weeklyTotals[weeklyTotals.length - 1];
        const lastWeek = weeklyTotals.length > 1 ? weeklyTotals[weeklyTotals.length - 2] : { week: '', total_seconds: 0 };
        const targetSeconds = 30 * 3600;
        
        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (currentWeek.total_seconds > lastWeek.total_seconds * 1.1) trend = 'up';
        else if (currentWeek.total_seconds < lastWeek.total_seconds * 0.9) trend = 'down';
        
        const variance = Math.abs((currentWeek?.total_seconds || 0) - targetSeconds) / targetSeconds;
        const score = Math.max(0, Math.round((1 - variance) * 100));
        
        let streak = 0;
        for (const w of [...weeklyTotals].reverse()) {
            if (w.total_seconds >= targetSeconds * 0.8) streak++;
            else break;
        }
        
        return { 
            score, 
            weekly_comparison: weeklyTotals, 
            this_week: currentWeek.total_seconds,
            last_week: lastWeek.total_seconds,
            trend,
            streak
        };
    } catch (err) {
        console.error('[DeskFlow] Failed to get consistency score:', err);
        return { score: 0, weekly_comparison: [], this_week: 0, last_week: 0, trend: 'stable', streak: 0 };
    }
});

electron_1.ipcMain.handle('get-external-settings', (event, key: string) => {
    if (useJson) return null;
    try {
        const row = db.prepare('SELECT value FROM external_settings WHERE key = ?').get(key) as any;
        return row ? row.value : null;
    } catch (err) {
        console.error('[DeskFlow] Failed to get external setting:', err);
        return null;
    }
});

electron_1.ipcMain.handle('set-external-settings', (event, key: string, value: string) => {
    if (useJson) return false;
    try {
        db.prepare(`
            INSERT INTO external_settings (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `).run(key, value);
        return true;
    } catch (err) {
        console.error('[DeskFlow] Failed to set external setting:', err);
        return false;
    }
});

electron_1.ipcMain.handle('get-tracking-settings', () => {
    return {
        sleep_gap_ms: SLEEP_GAP_MS,
        max_session_ms: MAX_SESSION_MS,
    };
});

electron_1.ipcMain.handle('set-tracking-setting', (event, key: string, value: string) => {
    try {
        const numValue = parseInt(value, 10);
        if (isNaN(numValue)) return false;
        
        if (key === 'sleep_gap_ms') {
            SLEEP_GAP_MS = numValue;
        } else if (key === 'max_session_ms') {
            MAX_SESSION_MS = numValue;
        }
        return true;
    } catch (err) {
        console.error('[DeskFlow] Failed to set tracking setting:', err);
        return false;
    }
});

// --- Window state IPC ---
electron_1.ipcMain.handle('get-window-state', () => {
    return loadWindowState() ?? { width: 1400, height: 900, maximized: false };
});
electron_1.ipcMain.handle('reset-window-state', () => {
    try {
        if (fs_1.default.existsSync(windowStatePath)) {
            fs_1.default.unlinkSync(windowStatePath);
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
            const primaryDisplay = electron_1.screen.getPrimaryDisplay();
            const { x, y, width, height } = primaryDisplay.workArea;
            mainWindow.setBounds({ x, y, width, height });
            mainWindow.maximize();
        }
        return { success: true };
    } catch (e) {
        console.error('[DeskFlow] Failed to reset window state:', e);
        return { success: false, error: String(e) };
    }
});

electron_1.app.on('window-all-closed', () => {
    // Keep app running in background (tray mode)
});
electron_1.app.on('before-quit', () => {
    electron_1.app.isQuitting = true;
    if (trackingInterval)
        clearInterval(trackingInterval);
    
    // Save close time for sleep tracking
    lastCloseTime = Date.now();
    lastCloseType = 'normal';
    saveSleepState();
    
    // Log current session before quit
     // Filter out Electron/DeskFlow app (don't track the app itself) and known browser (extension handles it)
     if (currentApp && Date.now() - sessionStart > 5000 && currentApp !== 'DeskFlow' && currentApp !== 'Electron') {
         const duration = Date.now() - sessionStart;
         const category = categorizeApp(currentApp);
         addLog(new Date(sessionStart).toISOString(), currentApp, category, duration, `${currentApp} Window`, null);
         console.log('[DeskFlow] ✅ Logged final session before quit:', currentApp);
     }
    // Auto-stop active external sessions before quit
    try {
        ensureDb();
        const activeSession = db.prepare(`
            SELECT es.*, ea.type
            FROM external_sessions es
            JOIN external_activities ea ON es.activity_id = ea.id
            WHERE es.ended_at IS NULL
        `).get();
        if (activeSession) {
            const now = new Date();
            const startedAt = new Date(activeSession.started_at);
            let durationMs = now.getTime() - startedAt.getTime();
            // Handle midnight crossing for sleep
            if (durationMs < 0) {
                durationMs += 24 * 60 * 60 * 1000;
            }
            const durationSeconds = Math.floor(durationMs / 1000);
            db.prepare(`
                UPDATE external_sessions 
                SET ended_at = ?, duration_seconds = ?
                WHERE id = ?
            `).run(now.toISOString(), durationSeconds, activeSession.id);
            console.log('[DeskFlow] ✅ Auto-stopped external session:', activeSession.id, 'Duration:', durationSeconds, 's');
        }
    } catch (err) {
        console.error('[DeskFlow] Failed to auto-stop external session:', err);
    }
    // Ensure JSON data is flushed
    if (useJson) {
        saveJsonLogs();
        console.log('[DeskFlow] ✅ JSON data flushed to disk');
    }
    // Close browser tracking server
    if (browserServer) {
        browserServer.close();
        console.log('[DeskFlow] ✅ Browser tracking server closed');
    }
    // Unregister global shortcuts
    globalShortcut.unregisterAll();
    console.log('[DeskFlow] ✅ Global shortcuts unregistered');
    // Close SQLite connection
    if (db) {
        db.close();
        console.log('[DeskFlow] ✅ SQLite database closed');
    }
    console.log('[DeskFlow] 👋 App quit gracefully');
});

// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// DB Health & Reconnection
// ═══════════════════════════════════════════════════════════════

const DB_RECONNECT_INTERVAL = 30000; // 30s between reconnect attempts
let lastDbReconnectAttempt = 0;

function ensureDb(): boolean {
  if (typeof window !== 'undefined') {
    // Only run in main process
    return false;
  }
  if (db) {
    // Fast health check — verify connection is still alive
    try {
      db.prepare('SELECT 1').get();
      return true;
    } catch {
      // Connection is stale — close it and re-open
      console.warn('[DeskFlow] DB connection stale, attempting reconnect...');
      try { db.close(); } catch {}
      db = null;
    }
  }
  // Reconnect
  const now = Date.now();
  if (now - lastDbReconnectAttempt < DB_RECONNECT_INTERVAL) return false;
  lastDbReconnectAttempt = now;
  try {
    const Database = require('better-sqlite3');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    useJson = false;
    console.log('[DeskFlow] DB reconnected successfully');
    return true;
  } catch (err) {
    console.error('[DeskFlow] DB reconnect failed:', err);
    return false;
  }
}

function withDb<T>(fn: (d: any) => T, fallback: T): T {
  if (!ensureDb()) return fallback;
  if (useJson) return fallback;
  try {
    return fn(db);
  } catch (err: any) {
    console.error('[DeskFlow] DB query error:', err);
    // If it looks like a connection error, force reconnect next time
    if (err.message && (err.message.includes('closed') || err.message.includes('locked') || err.message.includes('SQLITE_BUSY') || err.message.includes('not open'))) {
      try { db.close(); } catch {}
      db = null;
    }
    return fallback;
  }
}

// TRACKER MIND - TERMINAL BINDING MANAGEMENT
// ═══════════════════════════════════════════════════════════════

function getProjectPath(projectId: string | undefined): string | undefined {
  if (!projectId) return undefined;
  
  let d = db;
  if (!d) {
    try { d = require('better-sqlite3')(dbPath); } catch {}
  }
  
  try {
    const project = d.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as any;
    if (project?.path) {
      console.log('[Tracker Mind] Using project path:', project.path, 'for project:', projectId);
      return project.path;
    }
  } catch (e) {
    console.error('[Tracker Mind] Failed to get project path:', e);
  }
  
  console.log('[Tracker Mind] Project not found in DB, returning undefined');
  return undefined;
}

function getProblemsService(projectId?: string, projectPath?: string): any {
  const resolvedPath = projectPath || getProjectPath(projectId);
  return new ProblemsService(resolvedPath, projectId);
}

function getRequestsService(projectId?: string, projectPath?: string): any {
  const resolvedPath = projectPath || getProjectPath(projectId);
  return new RequestsService(resolvedPath);
}

// ═══════════════════ File-backed Problems IPC (JSON source of truth, no DB) ═══════════════════

electron_1.ipcMain.handle('get-problems', async (_, opts?: { projectId?: string; projectPath?: string }) => {
  try {
    const ps = getProblemsService(opts?.projectId, opts?.projectPath);
    const data = ps.getProblems();
    return { success: true, data, fromFile: true };
  } catch (error: any) {
    console.error('[Tracker Mind] get-problems error:', error);
    return { success: false, error: error.message };
  }
});

// ── Activity Log ──

function logActivity(params: {
  entityType: string; entityId: string; entityTitle?: string;
  action: string; actor: string; summary: string; details?: string;
}) {
  if (!db) return;
  try {
    db.prepare(`
      INSERT INTO activity_log (entity_type, entity_id, entity_title, action, actor, summary, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(params.entityType, params.entityId, params.entityTitle || null,
      params.action, params.actor, params.summary, params.details || null);
  } catch {}
}

electron_1.ipcMain.handle('log-activity', async (_event, data: {
  entityType: string; entityId: string; entityTitle?: string;
  action: string; actor: string; summary: string; details?: string;
}) => {
  logActivity(data);
  return { success: true };
});

electron_1.ipcMain.handle('get-activity-log', async (_event, opts?: { entityType?: string; entityId?: string; limit?: number }) => {
  if (!db) return { success: false, data: [] };
  try {
    let sql = 'SELECT * FROM activity_log WHERE 1=1';
    const params: any[] = [];
    if (opts?.entityType) { sql += ' AND entity_type = ?'; params.push(opts.entityType); }
    if (opts?.entityId) { sql += ' AND entity_id = ?'; params.push(opts.entityId); }
    sql += ' ORDER BY created_at DESC';
    if (opts?.limit) { sql += ' LIMIT ?'; params.push(opts.limit); }
    return { success: true, data: db.prepare(sql).all(...params) };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
});

// Generate AI-readable context from recent activity
electron_1.ipcMain.handle('get-ai-context', async (_event, opts?: { projectId?: string; since?: string; limit?: number }) => {
  if (!db) return { success: false, context: '' };
  try {
    const since = opts?.since || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const count = opts?.limit || 20;
    const rows = db.prepare(`SELECT * FROM activity_log WHERE created_at >= ? ORDER BY created_at DESC LIMIT ?`).all(since, count);

    const sections = ['## Recent Activity (last 24h)\n'];
    for (const row of rows) {
      sections.push(`- [${row.created_at}] **${row.actor}** ${row.summary}`);
    }
    if (rows.length === 0) sections.push('- No recent activity recorded.');

    // Also pull active problems count
    const activeProblems = db.prepare("SELECT COUNT(*) as c FROM workspace_problems WHERE status NOT IN ('Closed','Done','Fixed')").get() as any;
    if (activeProblems?.c > 0) sections.push(`\n**Active problems:** ${activeProblems.c}`);

    return { success: true, context: sections.join('\n') };
  } catch (err: any) {
    console.error('[DeskFlow] get-ai-context error:', err.message);
    return { success: false, context: '', error: err.message };
  }
});

electron_1.ipcMain.handle('create-problem', async (_, data: { title: string; priority?: string; category?: string; description?: string; projectId?: string; projectPath?: string; actor?: string; sessionId?: string; sessionName?: string }) => {
  try {
    const ps = getProblemsService(data.projectId, data.projectPath);
    const problem = ps.createProblem({
      title: data.title,
      priority: data.priority || 'medium',
      category: data.category || 'other',
      description: data.description || null,
      sessionId: data.sessionId,
      sessionName: data.sessionName,
    });
    logActivity({ entityType: 'problem', entityId: String(problem.id), entityTitle: problem.title, action: 'created', actor: data.actor || 'user', summary: `Created problem: ${problem.title}` });
    console.log('[Tracker Mind] Created problem:', problem.id, problem.title);
    mainWindow?.webContents?.send('context-changed', { type: 'problem', action: 'created', entity: { id: problem.id, title: problem.title, status: problem.status } });
    return { success: true, data: problem };
  } catch (error: any) {
    console.error('[Tracker Mind] create-problem error:', error);
    return { success: false, error: error.message };
  }
});

electron_1.ipcMain.handle('update-problem-status', async (_, { problemId, status, projectId, projectPath, actor }: { problemId: string; status: string; projectId?: string; projectPath?: string; actor?: string }) => {
  try {
    const validStatuses = ['NEW', 'Not Started', 'In Progress', 'AI Attempted Fix', 'User Testing', 'Fixed', 'Irrelevant'];
    if (!validStatuses.includes(status)) {
      return { success: false, error: `Invalid status "${status}". Must be one of: ${validStatuses.join(', ')}` };
    }
    const ps = getProblemsService(projectId, projectPath);
    const all = ps.getProblems();
    const p = all.find((x: any) => x.id === problemId);
    if (!p) return { success: false, error: 'Problem not found' };
    const oldStatus = p?.status || '?';
    const success = ps.updateProblem(problemId, { status });
    if (success) logActivity({ entityType: 'problem', entityId: String(problemId), entityTitle: p.title, action: 'status_changed', actor: actor || 'user', summary: `Status: ${oldStatus} → ${status}` });
    if (success) mainWindow?.webContents?.send('context-changed', { type: 'problem', action: 'updated', entity: { id: problemId, title: p.title, status } });
    return { success };
  } catch (error: any) {
    console.error('[Tracker Mind] update-problem-status error:', error);
    return { success: false, error: error.message };
  }
});

electron_1.ipcMain.handle('update-problem', async (_, data: { id: string; user_notes?: string; terminal_id?: string; title?: string; priority?: string; category?: string; description?: string; projectId?: string; projectPath?: string }) => {
  try {
    const ps = getProblemsService(data.projectId, data.projectPath);
    const all = ps.getProblems();
    const p = all.find((x: any) => x.id === data.id);
    if (!p) return { success: false, error: 'Problem not found' };

    const updates: Record<string, any> = {};
    const changed: string[] = [];
    if (data.user_notes !== undefined) { updates.user_notes = data.user_notes; changed.push('notes'); }
    if (data.terminal_id !== undefined) { updates.terminal_id = data.terminal_id; changed.push('terminal link'); }
    if (data.title !== undefined) { updates.title = data.title; changed.push('title'); }
    if (data.priority !== undefined) { updates.priority = data.priority; changed.push('priority'); }
    if (data.category !== undefined) { updates.category = data.category; changed.push('category'); }
    if (data.description !== undefined) { updates.description = data.description; changed.push('description'); }

    const success = ps.updateProblem(data.id, updates);
    if (success) logActivity({ entityType: 'problem', entityId: String(data.id), entityTitle: p.title, action: 'updated', actor: 'user', summary: `Updated problem: ${changed.join(', ')}` });
    if (success) mainWindow?.webContents?.send('context-changed', { type: 'problem', action: 'updated', entity: { id: data.id, title: p.title, status: p.status } });
    return { success };
  } catch (error: any) {
    console.error('[Tracker Mind] update-problem error:', error);
    return { success: false, error: error.message };
  }
});

electron_1.ipcMain.handle('delete-problem', async (_, { problemId, projectId, projectPath, actor }: { problemId: string; projectId?: string; projectPath?: string; actor?: string }) => {
  try {
    const ps = getProblemsService(projectId, projectPath);
    const all = ps.getProblems();
    const p = all.find((x: any) => x.id === problemId);
    const success = ps.deleteProblem(problemId);
    if (success && p) logActivity({ entityType: 'problem', entityId: String(problemId), entityTitle: p.title, action: 'deleted', actor: actor || 'user', summary: `Deleted problem: ${p.title}` });
    if (success && p) mainWindow?.webContents?.send('context-changed', { type: 'problem', action: 'deleted', entity: { id: problemId, title: p.title } });
    return { success };
  } catch (error: any) {
    console.error('[Tracker Mind] delete-problem error:', error);
    return { success: false, error: error.message };
  }
});

electron_1.ipcMain.handle('assign-problem-to-terminal', async (_, data: { problemId: string; terminalId?: string; skillId?: string; systemPrompt?: string; projectId?: string; projectPath?: string }) => {
  try {
    const ps = getProblemsService(data.projectId, data.projectPath);
    const allProblems = ps.getProblems();
    const problem = allProblems.find((p: any) => p.id === data.problemId);
    if (!problem) return { success: false, error: 'Problem not found' };

    let terminalId = data.terminalId;
    let isNewTerminal = false;
    if (!terminalId) {
      terminalId = `term-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      isNewTerminal = true;
    }

    // Save terminal_id back to the problem so the link is permanent
    ps.updateProblem(data.problemId, { terminal_id: terminalId });

    const promptLines = [
      `You have been assigned to fix problem ${problem.id}: ${problem.title}\n`,
      `**Problem ID:** ${problem.id}`,
      `**Title:** ${problem.title}`,
      `**Priority:** ${problem.priority}`,
      `**Category:** ${problem.category}`,
    ];
    if (problem.user_notes) promptLines.push(`\n**User Notes:**\n${problem.user_notes}`);
    if (data.systemPrompt) promptLines.push(`\n**Additional Instructions:**\n${data.systemPrompt}`);
    promptLines.push('\n\nPlease analyze and fix this problem.');
    const fullPrompt = promptLines.join('\n');

    return { success: true, data: { terminalId, isNewTerminal, prompt: fullPrompt } };
  } catch (error: any) {
    console.error('[Tracker Mind] assign-problem-to-terminal error:', error);
    return { success: false, error: error.message };
  }
});

electron_1.ipcMain.handle('get-terminal-bindings', async () => {
  try {
    if (!db) return { success: false, error: 'Database not ready' };
    const bindings = db.prepare('SELECT * FROM terminal_bindings WHERE status != "closed" ORDER BY last_activity_at DESC').all();
    return { success: true, data: bindings };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

electron_1.ipcMain.handle('get-skills', async (_, { projectPath }: { projectPath?: string } = {}) => {
  try {
    const baseDir = projectPath || userDataPath;
    const ss = new SkillsService(baseDir);
    const skills = ss.getSkills();

    // Also read legacy agent/skills.md for skills listed there
    const legacySkillsPath = path_1.default.join(baseDir, 'agent', 'skills.md');
    if (fs_1.default.existsSync(legacySkillsPath)) {
      const legacyContent = fs_1.default.readFileSync(legacySkillsPath, 'utf-8');
      const skillSections = legacyContent.match(/### ([^\n]+)\n[\s\S]*?(?=### |$)/g) || [];
      for (const section of skillSections) {
        const nameMatch = section.match(/### ([^\n]+)/);
        const descMatch = section.match(/\*\*When to use:\*\* ([^\n]+)/);
        const contentMatch = section.match(/\*\*Usage:\*\*\n```\n?([\s\S]*?)```/);
        if (nameMatch) {
          const id = nameMatch[1].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          if (!skills.find(s => s.id === id)) {
            skills.push({
              id,
              name: nameMatch[1].trim(),
              description: descMatch ? descMatch[1].trim() : '',
              category: 'legacy',
              content: section.trim(),
              filePath: legacySkillsPath
            });
          }
        }
      }
    }

    return { success: true, data: skills };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// ─── Workspace Skills IPC ──────────────────────────────────

electron_1.ipcMain.handle('get-workspace-skills', async (_event, args) => {
  try {
    const { projectPath } = args || {};
    const skillsBasePath = projectPath
      ? path_1.default.join(projectPath, 'agent', 'skills')
      : path_1.default.join(userDataPath, 'agent', 'skills');

    if (!fs_1.default.existsSync(skillsBasePath)) {
      return { success: true, data: [] };
    }

    const entries = fs_1.default.readdirSync(skillsBasePath, { withFileTypes: true });
    const workspaceSkills = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillDir = path_1.default.join(skillsBasePath, entry.name);
      const skillMdPath = path_1.default.join(skillDir, 'SKILL.md');
      const pluginJsonPath = path_1.default.join(skillDir, 'plugin.json');

      let descriptor: any = {
        id: entry.name,
        name: entry.name,
        category: 'custom',
        skillPath: skillDir,
      };

      if (fs_1.default.existsSync(skillMdPath)) {
        try {
          const content = fs_1.default.readFileSync(skillMdPath, 'utf8');
          const fm = parseSimpleFrontmatter(content);
          if (fm) {
            descriptor.id = fm.id || descriptor.id;
            descriptor.name = fm.name || descriptor.name;
            descriptor.category = fm.category || descriptor.category;
            descriptor.version = fm.version || descriptor.version;
            descriptor.description = fm.description || descriptor.description;

            if (fm.sidebar) {
              try {
                descriptor.sidebarEntry = typeof fm.sidebar === 'string'
                  ? JSON.parse(fm.sidebar)
                  : fm.sidebar;
              } catch { }
            }
            if (fm.workspace) {
              try {
                descriptor.workspaceConfig = typeof fm.workspace === 'string'
                  ? JSON.parse(fm.workspace)
                  : fm.workspace;
              } catch { }
            }
          }
        } catch (e: any) {
          console.warn(`[WorkspaceRegistry] Failed to read SKILL.md for ${entry.name}:`, e.message);
        }
      }

      if (fs_1.default.existsSync(pluginJsonPath)) {
        try {
          const pluginConfig = JSON.parse(fs_1.default.readFileSync(pluginJsonPath, 'utf8'));
          descriptor = { ...descriptor, ...pluginConfig, skillPath: skillDir };
        } catch (e: any) {
          console.warn(`[WorkspaceRegistry] Failed to parse plugin.json for ${entry.name}:`, e.message);
        }
      }

      if (descriptor.sidebarEntry || descriptor.workspace || descriptor.workspaceConfig) {
        if (descriptor.workspaceConfig && !descriptor.workspace) {
          descriptor.workspace = descriptor.workspaceConfig;
          delete descriptor.workspaceConfig;
        }
        workspaceSkills.push(descriptor);
      }
    }

    return { success: true, data: workspaceSkills };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// ═══════════════════════════════════════════════════════════
// Previously dead IPC handlers (preload bridges existed but no main handlers)
// ═══════════════════════════════════════════════════════════

// ─── Prompt Templates (real implementation) ────────────────
electron_1.ipcMain.handle('get-prompt-templates', async (_event, projectId) => {
    try {
        const key = projectId ? `prompt-templates-${projectId}` : 'prompt-templates-global';
        const templates = userPreferences[key] || [];
        return { success: true, data: templates };
    } catch (err) {
        return { success: false, error: err?.message || 'Failed to get prompt templates' };
    }
});

electron_1.ipcMain.handle('save-prompt-template', async (_event, data) => {
    try {
        const key = data.projectId ? `prompt-templates-${data.projectId}` : 'prompt-templates-global';
        const templates = userPreferences[key] || [];
        const id = data.id || `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const now = new Date().toISOString();
        const existingIdx = templates.findIndex((t) => t.id === id);
        if (existingIdx >= 0) {
            templates[existingIdx] = { ...templates[existingIdx], name: data.name, content: data.content, category: (data.category || templates[existingIdx].category), isFormattingTemplate: (data.isFormattingTemplate ?? templates[existingIdx].isFormattingTemplate), updatedAt: now };
        } else {
            templates.push({ id, name: data.name, content: data.content, category: data.category || 'general', isFormattingTemplate: data.isFormattingTemplate || false, projectId: data.projectId || null, createdAt: now, updatedAt: now });
        }
        userPreferences[key] = templates;
        savePreferences();
        return { success: true, data: templates.find((t) => t.id === id) };
    } catch (err) {
        return { success: false, error: err?.message || 'Failed to save prompt template' };
    }
});

electron_1.ipcMain.handle('delete-prompt-template', async (_event, templateId) => {
    try {
        let deleted = false;
        for (const key of Object.keys(userPreferences)) {
            if (!key.startsWith('prompt-templates')) continue;
            const templates = userPreferences[key] || [];
            const idx = templates.findIndex((t) => t.id === templateId);
            if (idx >= 0) { templates.splice(idx, 1); userPreferences[key] = templates; deleted = true; }
        }
        if (deleted) savePreferences();
        return { success: true, data: deleted };
    } catch (err) {
        return { success: false, error: err?.message || 'Failed to delete prompt template' };
    }
});

electron_1.ipcMain.handle('update-activity-chart-preference', async (_event, activityId, chartType) => {
    try {
        userPreferences[`chart-type-${activityId}`] = chartType;
        savePreferences();
        return { success: true };
    } catch (err) {
        return { success: false, error: err?.message || 'Failed to update chart preference' };
    }
});

// ─── Stub Handlers (planned features, clear error messages) ──
electron_1.ipcMain.handle('add-external-time', async (event, { activityId, durationMinutes, started_at, ended_at }) => {
    if (useJson) return { success: false };
    try {
        const now = new Date();
        const startedAt = started_at ? new Date(started_at) : new Date(now.getTime() - durationMinutes * 60 * 1000);
        const endedAt = ended_at ? new Date(ended_at) : now;
        const durationSeconds = Math.max(0, Math.round(durationMinutes * 60));
        const result = db.prepare(`
            INSERT INTO external_sessions (activity_id, started_at, ended_at, duration_seconds)
            VALUES (?, ?, ?, ?)
        `).run(activityId, startedAt.toISOString(), endedAt.toISOString(), durationSeconds);
        return { success: true, sessionId: result.lastInsertRowid.toString() };
    } catch (err) {
        console.error('[DeskFlow] Failed to add external time:', err);
        return { success: false };
    }
});
electron_1.ipcMain.handle('get-hour-detail', async () => {
    console.warn('[IPC] get-hour-detail called — not yet implemented');
    return { success: false, error: 'Not implemented: get-hour-detail. This feature is planned for a future release.', data: [] };
});
electron_1.ipcMain.handle('get-workspace-todos', async () => {
    console.warn('[IPC] get-workspace-todos called — not yet implemented');
    return { success: false, error: 'Not implemented: get-workspace-todos. Workspace todos are planned for a future release.', data: [] };
});
electron_1.ipcMain.handle('add-workspace-todo', async () => {
    console.warn('[IPC] add-workspace-todo called — not yet implemented');
    return { success: false, error: 'Not implemented: add-workspace-todo. Workspace todos are planned for a future release.' };
});
electron_1.ipcMain.handle('toggle-workspace-todo', async () => {
    console.warn('[IPC] toggle-workspace-todo called — not yet implemented');
    return { success: false, error: 'Not implemented: toggle-workspace-todo. Workspace todos are planned for a future release.' };
});
electron_1.ipcMain.handle('delete-workspace-todo', async () => {
    console.warn('[IPC] delete-workspace-todo called — not yet implemented');
    return { success: false, error: 'Not implemented: delete-workspace-todo. Workspace todos are planned for a future release.' };
});

function parseSimpleFrontmatter(content: string): Record<string, any> | null {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return null;

  const result = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    const rawValue = line.slice(colonIdx + 1).trim();

    if (!key || rawValue.startsWith('|') || rawValue.startsWith('>')) continue;

    if (rawValue === 'true') result[key] = true;
    else if (rawValue === 'false') result[key] = false;
    else if (rawValue === 'null') result[key] = null;
    else if (/^-?\d+$/.test(rawValue)) result[key] = parseInt(rawValue, 10);
    else if (/^-?\d+\.\d+$/.test(rawValue)) result[key] = parseFloat(rawValue);
    else result[key] = rawValue;
  }

  return result;
}

electron_1.ipcMain.handle('create-skill', async (_, data: { name: string; category: string; description: string; content: string; projectPath?: string }) => {
  try {
    const baseDir = data.projectPath || userDataPath;
    const id = data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const skillsDir = path_1.default.join(baseDir, 'agent', 'skills');
    if (!fs_1.default.existsSync(skillsDir)) {
      fs_1.default.mkdirSync(skillsDir, { recursive: true });
    }
    const filePath = path_1.default.join(skillsDir, `${id}.md`);
    const frontmatter = `---\nid: ${id}\nname: ${data.name}\ndescription: ${data.description}\ncategory: ${data.category}\n---\n\n${data.content}`;
    fs_1.default.writeFileSync(filePath, frontmatter, 'utf-8');
    return { success: true, data: { id, name: data.name, description: data.description, category: data.category, filePath } };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

electron_1.ipcMain.handle('update-skill', async (_, data: { id: string; name: string; category: string; description: string; content: string; projectPath?: string }) => {
  try {
    const baseDir = data.projectPath || userDataPath;
    const skillsDir = path_1.default.join(baseDir, 'agent', 'skills');
    const filePath = path_1.default.join(skillsDir, `${data.id}.md`);
    if (!fs_1.default.existsSync(filePath)) {
      return { success: false, error: 'Skill not found' };
    }
    const frontmatter = `---\nid: ${data.id}\nname: ${data.name}\ndescription: ${data.description}\ncategory: ${data.category}\n---\n\n${data.content}`;
    fs_1.default.writeFileSync(filePath, frontmatter, 'utf-8');
    return { success: true, data: { id: data.id, name: data.name, description: data.description, category: data.category, filePath } };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});


// ═══════════════════ File-backed Requests IPC (JSON source of truth, no DB) ═══════════════════

electron_1.ipcMain.handle('delete-skill', async (_, data: { id: string; projectPath?: string }) => {
  try {
    const baseDir = data.projectPath || userDataPath;
    const skillsDir = path_1.default.join(baseDir, 'agent', 'skills');
    const flatPath = path_1.default.join(skillsDir, `${data.id}.md`);
    const dirPath = path_1.default.join(skillsDir, data.id);
    let removed = false;
    if (fs_1.default.existsSync(flatPath)) {
      fs_1.default.unlinkSync(flatPath);
      removed = true;
    }
    if (fs_1.default.existsSync(dirPath) && fs_1.default.statSync(dirPath).isDirectory()) {
      fs_1.default.rmSync(dirPath, { recursive: true, force: true });
      removed = true;
    }
    if (!removed) {
      return { success: false, error: 'Skill not found' };
    }
    return { success: true, data: { id: data.id } };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

electron_1.ipcMain.handle('get-app-skills', async () => {
  try {
    const ss = new SkillsService(userDataPath);
    const skills = ss.getSkills();
    return { success: true, data: skills };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

electron_1.ipcMain.handle('add-skill-to-project', async (_, data: { skillId: string; projectPath: string }) => {
  try {
    const appSs = new SkillsService(userDataPath);
    const appSkill = appSs.getSkillById(data.skillId);
    if (!appSkill) return { success: false, error: 'Skill not found in app library' };
    const srcPath = appSkill.filePath;
    const destSkillsDir = path_1.default.join(data.projectPath, 'agent', 'skills');
    if (!fs_1.default.existsSync(destSkillsDir)) {
      fs_1.default.mkdirSync(destSkillsDir, { recursive: true });
    }
    // Determine if source is directory-based (SKILL.md inside folder) or flat file
    const srcParsed = path_1.default.parse(srcPath);
    const parentDir = path_1.default.basename(srcParsed.dir);
    const appSkillsDir = path_1.default.join(userDataPath, 'agent', 'skills');
    const isDirBased = srcParsed.base === 'SKILL.md' && parentDir !== 'skills' && path_1.default.dirname(srcPath) !== appSkillsDir;
    let destPath;
    if (isDirBased) {
      // Directory-based: create <project>/agent/skills/<name>/SKILL.md
      const skillDir = path_1.default.join(destSkillsDir, parentDir);
      if (fs_1.default.existsSync(skillDir)) {
        return { success: false, error: 'Skill already exists in project' };
      }
      fs_1.default.mkdirSync(skillDir, { recursive: true });
      destPath = path_1.default.join(skillDir, 'SKILL.md');
      // Also copy any companion files in the source directory
      const srcDir = path_1.default.dirname(srcPath);
      try {
        const companions = fs_1.default.readdirSync(srcDir).filter(f => f !== 'SKILL.md');
        for (const comp of companions) {
          const compSrc = path_1.default.join(srcDir, comp);
          const compDest = path_1.default.join(skillDir, comp);
          if (fs_1.default.statSync(compSrc).isFile()) {
            fs_1.default.copyFileSync(compSrc, compDest);
          }
        }
      } catch {}
    } else {
      // Flat file: copy as-is
      destPath = path_1.default.join(destSkillsDir, path_1.default.basename(srcPath));
      if (fs_1.default.existsSync(destPath)) {
        return { success: false, error: 'Skill already exists in project' };
      }
    }
    const content = fs_1.default.readFileSync(srcPath, 'utf-8');
    const parentDestDir = path_1.default.dirname(destPath);
    if (!fs_1.default.existsSync(parentDestDir)) {
      fs_1.default.mkdirSync(parentDestDir, { recursive: true });
    }
    fs_1.default.writeFileSync(destPath, content, 'utf-8');
    return { success: true, data: { id: appSkill.id, name: appSkill.name, filePath: destPath } };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// -- Saved/Favorite skills tracking --
const SAVED_SKILLS_PATH = path_1.default.join(userDataPath, 'agent', 'saved-skills.json');

function getSavedSkillIds(): string[] {
  try {
    if (fs_1.default.existsSync(SAVED_SKILLS_PATH)) {
      return JSON.parse(fs_1.default.readFileSync(SAVED_SKILLS_PATH, 'utf-8'));
    }
  } catch {}
  return [];
}

function saveSavedSkillIds(ids: string[]): void {
  const dir = path_1.default.dirname(SAVED_SKILLS_PATH);
  if (!fs_1.default.existsSync(dir)) fs_1.default.mkdirSync(dir, { recursive: true });
  fs_1.default.writeFileSync(SAVED_SKILLS_PATH, JSON.stringify(ids, null, 2), 'utf-8');
}

electron_1.ipcMain.handle('get-saved-skills', async () => {
  try {
    const ids = getSavedSkillIds();
    return { success: true, data: ids };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

electron_1.ipcMain.handle('save-workspace-skill', async (_, { skillId }: { skillId: string }) => {
  try {
    const ids = getSavedSkillIds();
    if (!ids.includes(skillId)) {
      ids.push(skillId);
      saveSavedSkillIds(ids);
    }
    return { success: true, data: ids };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

electron_1.ipcMain.handle('unsave-workspace-skill', async (_, { skillId }: { skillId: string }) => {
  try {
    const ids = getSavedSkillIds().filter(id => id !== skillId);
    saveSavedSkillIds(ids);
    return { success: true, data: ids };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// -- Seed workspace skills from a project --
electron_1.ipcMain.handle('seed-workspace-skills', async (_, { sourceDir }: { sourceDir: string }) => {
  try {
    const sourceSkillsDir = path_1.default.join(sourceDir, 'agent', 'skills');
    if (!fs_1.default.existsSync(sourceSkillsDir)) {
      return { success: false, error: 'Source project has no agent/skills/ directory' };
    }
    const destSkillsDir = path_1.default.join(userDataPath, 'agent', 'skills');
    if (!fs_1.default.existsSync(destSkillsDir)) {
      fs_1.default.mkdirSync(destSkillsDir, { recursive: true });
    }
    const entries = fs_1.default.readdirSync(sourceSkillsDir, { withFileTypes: true });
    let copied = 0;
    let skipped = 0;
    for (const entry of entries) {
      const srcPath = path_1.default.join(sourceSkillsDir, entry.name);
      if (entry.isDirectory()) {
        // Directory-based skill: copy whole directory
        const destPath = path_1.default.join(destSkillsDir, entry.name);
        if (!fs_1.default.existsSync(destPath)) {
          copyDirSync(srcPath, destPath);
          copied++;
        } else {
          skipped++;
        }
      } else if (entry.name.endsWith('.md') && entry.name !== 'README.md') {
        // Flat file skill
        const destPath = path_1.default.join(destSkillsDir, entry.name);
        if (!fs_1.default.existsSync(destPath)) {
          fs_1.default.copyFileSync(srcPath, destPath);
          copied++;
        } else {
          skipped++;
        }
      }
    }
    return { success: true, data: { copied, skipped } };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

function copyDirSync(src: string, dest: string): void {
  fs_1.default.mkdirSync(dest, { recursive: true });
  const entries = fs_1.default.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path_1.default.join(src, entry.name);
    const destPath = path_1.default.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs_1.default.copyFileSync(srcPath, destPath);
    }
  }
}

electron_1.ipcMain.handle('get-requests', async (_, { projectId }: { projectId?: string } = {}) => {
  try {
    const rs = getRequestsService(projectId);
    const data = rs.getRequests();
    return { success: true, data };
  } catch (error: any) {
    console.error('[Tracker Mind] get-requests error:', error);
    return { success: false, error: error.message };
  }
});

electron_1.ipcMain.handle('create-request', async (_, data: { title: string; description?: string; priority?: string; category?: string; projectId?: string; actor?: string; sessionId?: string; sessionName?: string }) => {
  try {
    const rs = getRequestsService(data.projectId);
    const request = rs.createRequest({
      title: data.title,
      description: data.description || null,
      priority: data.priority || 'Medium',
      category: data.category || 'Feature',
      sessionId: data.sessionId,
      sessionName: data.sessionName,
    });
    logActivity({ entityType: 'request', entityId: String(request.id), entityTitle: request.title, action: 'created', actor: data.actor || 'user', summary: `Created request: ${request.title}` });
    console.log('[Tracker Mind] Created request:', request.id, request.title);
    mainWindow?.webContents?.send('context-changed', { type: 'request', action: 'created', entity: { id: request.id, title: request.title, status: request.status } });
    return { success: true, data: request };
  } catch (error: any) {
    console.error('[Tracker Mind] create-request error:', error);
    return { success: false, error: error.message };
  }
});

electron_1.ipcMain.handle('update-request-status', async (_, { requestId, status, projectId, actor }: { requestId: string; status: string; projectId?: string; actor?: string }) => {
  try {
    const validStatuses = ['Pending', 'In Progress', 'Completed', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      return { success: false, error: `Invalid status "${status}". Must be one of: ${validStatuses.join(', ')}` };
    }
    const rs = getRequestsService(projectId);
    const all = rs.getRequests();
    const r = all.find((x: any) => x.id === requestId);
    if (!r) return { success: false, error: 'Request not found' };
    const oldStatus = r?.status || '?';
    const success = rs.updateStatus(requestId, status);
    if (success) logActivity({ entityType: 'request', entityId: String(requestId), entityTitle: r.title, action: 'status_changed', actor: actor || 'user', summary: `Status: ${oldStatus} → ${status}` });
    if (success) mainWindow?.webContents?.send('context-changed', { type: 'request', action: 'updated', entity: { id: requestId, title: r.title, status } });
    return { success };
  } catch (error: any) {
    console.error('[Tracker Mind] update-request-status error:', error);
    return { success: false, error: error.message };
  }
});

electron_1.ipcMain.handle('delete-request', async (_, { requestId, projectId, actor }: { requestId: string; projectId?: string; actor?: string }) => {
  try {
    const rs = getRequestsService(projectId);
    const all = rs.getRequests();
    const r = all.find((x: any) => x.id === requestId);
    const success = rs.deleteRequest(requestId);
    if (success && r) logActivity({ entityType: 'request', entityId: String(requestId), entityTitle: r.title, action: 'deleted', actor: actor || 'user', summary: `Deleted request: ${r.title}` });
    if (success && r) mainWindow?.webContents?.send('context-changed', { type: 'request', action: 'deleted', entity: { id: requestId, title: r.title } });
    return { success };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

electron_1.ipcMain.handle('link-problem-to-request', async (_, { requestId, problemId, projectId, actor }: { requestId: string; problemId: string; projectId?: string; actor?: string }) => {
  try {
    const rs = getRequestsService(projectId);
    const request = rs.getRequest(requestId);
    if (!request) return { success: false, error: 'Request not found' };
    const success = rs.linkProblem(requestId, problemId);
    if (success) logActivity({ entityType: 'request', entityId: String(requestId), entityTitle: request.title, action: 'linked_problem', actor: actor || 'user', summary: `Linked problem #${problemId} to request: ${request.title}` });
    return { success };
  } catch (error: any) {
    console.error('[Tracker Mind] link-problem-to-request error:', error);
    return { success: false, error: error.message };
  }
});

electron_1.ipcMain.handle('unlink-problem-from-request', async (_, { requestId, problemId, projectId, actor }: { requestId: string; problemId: string; projectId?: string; actor?: string }) => {
  try {
    const rs = getRequestsService(projectId);
    const request = rs.getRequest(requestId);
    if (!request) return { success: false, error: 'Request not found' };
    const success = rs.unlinkProblem(requestId, problemId);
    if (success) logActivity({ entityType: 'request', entityId: String(requestId), entityTitle: request.title, action: 'unlinked_problem', actor: actor || 'user', summary: `Unlinked problem #${problemId} from request: ${request.title}` });
    return { success };
  } catch (error: any) {
    console.error('[Tracker Mind] unlink-problem-from-request error:', error);
    return { success: false, error: error.message };
  }
});

electron_1.ipcMain.handle('send-instructions-to-terminal', async (_, data: { terminalId: string; instructions: string; linkedProblemId?: string; linkedRequestId?: string }) => {
  try {
    const terminal = terminalManager.terminals.get(data.terminalId);
    if (!terminal) {
      return { success: false, error: 'Terminal not found or not ready' };
    }
    terminalManager.write(data.terminalId, data.instructions + '\r\n');

    // Track prompt status in terminal_messages
    if (db && data.instructions.trim()) {
      try {
        pendingCompletions.add(data.terminalId);
        db.prepare('INSERT INTO terminal_messages (session_id, role, content, status) VALUES (?, ?, ?, ?)')
          .run(data.terminalId, 'user', data.instructions, 'in_progress');
        const { BrowserWindow } = require('electron');
        const windows = BrowserWindow.getAllWindows();
        for (const win of windows) {
          if (!win.isDestroyed()) {
            try {
              win.webContents.send('ai-task:updated', { terminalId: data.terminalId, status: 'in_progress' });
            } catch (e) { /* silent */ }
          }
        }
      } catch (_e) { /* silent */ }
    }

    if (data.linkedProblemId || data.linkedRequestId) {
      if (db) {
        const stmt = db.prepare(`UPDATE terminal_bindings SET active_problem_id = ?, active_request_id = ? WHERE terminal_id = ?`);
        stmt.run(data.linkedProblemId || null, data.linkedRequestId || null, data.terminalId);
      }
    }
    return { success: true };
  } catch (error: any) {
    console.error('[Tracker Mind] send-instructions error:', error);
    return { success: false, error: error.message };
  }
});

// Save terminal binding
electron_1.ipcMain.handle('save-terminal-binding', async (_, data: { terminalId: string; problemId?: string; sessionContext?: string; status?: string }) => {
  try {
    if (!db) return { success: false, error: 'Database not ready' };
    
    // Check if binding exists
    const existing = db.prepare('SELECT id FROM terminal_bindings WHERE terminal_id = ?').get(data.terminalId);
    
    if (existing) {
      db.prepare(`UPDATE terminal_bindings SET 
        problem_id = COALESCE(?, problem_id),
        session_context = COALESCE(?, session_context),
        status = COALESCE(?, status),
        last_activity_at = ?
        WHERE terminal_id = ?`).run(
        data.problemId || null,
        data.sessionContext || null,
        data.status || null,
        new Date().toISOString(),
        data.terminalId
      );
    } else {
      db.prepare(`INSERT INTO terminal_bindings (terminal_id, problem_id, session_context, status, created_at, last_activity_at)
        VALUES (?, ?, ?, ?, ?, ?)`).run(
        data.terminalId,
        data.problemId || null,
        data.sessionContext || null,
        data.status || 'active',
        new Date().toISOString(),
        new Date().toISOString()
      );
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('[Tracker Mind] save-terminal-binding error:', error);
    return { success: false, error: error.message };
  }
});

// Get binding for a specific terminal
electron_1.ipcMain.handle('get-terminal-binding', async (_, terminalId: string) => {
  try {
    if (!db) return { success: false, error: 'Database not ready' };
    const binding = db.prepare('SELECT * FROM terminal_bindings WHERE terminal_id = ?').get(terminalId);
    return { success: true, data: binding || null };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Watch agent files for changes (live parsing)
electron_1.ipcMain.handle('watch-agent-files', async () => {
  try {
    const agentDir = path_1.default.join(userDataPath, 'agent');
    if (!fs_1.default.existsSync(agentDir)) {
      return { success: true, watching: false };
    }
    
    // Get last modified times of key files
    const files = ['PROBLEMS.md', 'REQUESTS.md', 'state.md'];
    const statuses = files.map(f => {
      const fp = path_1.default.join(agentDir, f);
      if (fs_1.default.existsSync(fp)) {
        const stats = fs_1.default.statSync(fp);
        return { file: f, mtime: stats.mtime.toISOString() };
      }
      return { file: f, mtime: null };
    });
    
    return { success: true, watching: true, files: statuses };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Sync PROBLEMS.md from JSON (regenerate markdown from source of truth)
electron_1.ipcMain.handle('sync-problems-md', async (_, { projectId, projectPath }: { projectId?: string; projectPath?: string } = {}) => {
  try {
    const ps = getProblemsService(projectId, projectPath);
    const problems = ps.getProblems();
    const mdPath = path_1.default.join(ps.getProjectPath(), 'agent', 'PROBLEMS.md');
    console.log('[Tracker Mind] sync-problems-md: regenerated PROBLEMS.md with', problems.length, 'problems');
    return { success: true, count: problems.length };
  } catch (error: any) {
    console.error('[Tracker Mind] sync-problems-md error:', error);
    return { success: false, error: error.message };
  }
});

// ═══════════════════ Checklist Feedback IPC ═══════════════════

electron_1.ipcMain.handle('add-check-feedback', async (_event, data: {
  parentId: string;
  checkId: string;
  parentType: 'problem' | 'request';
  feedback: { type: 'approved' | 'rejected' | 'text'; value?: string; timestamp: string; session_id?: string; terminal_id?: string };
}) => {
  const { parentId, checkId, parentType, feedback } = data;
  let result: any;

  if (parentType === 'problem') {
    const ps = getProblemsService();
    result = ps.addCheckFeedback?.(parentId, checkId, feedback);
  } else {
    const rs = getRequestsService();
    result = rs.addCheckFeedback?.(parentId, checkId, feedback);
  }

  if (result && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('context-changed', {
      type: 'check',
      action: 'feedback-added',
      entity: { checkId, parentId, parentType, feedback },
    });
  }

  return { success: !!result, check: result };
});

electron_1.ipcMain.handle('send-check-feedback-to-terminal', async (_event, data: {
  terminalId: string;
  checkId: string;
  checkDescription: string;
  feedback: { type: 'approved' | 'rejected' | 'text'; value?: string; timestamp: string };
  sessionId?: string;
}) => {
  const { terminalId, checkId, checkDescription, feedback, sessionId } = data;

  const emoji = feedback.type === 'approved' ? '\u2705' : feedback.type === 'rejected' ? '\u274C' : '\uD83D\uDCAC';
  let message = `[USER FEEDBACK] Check "${checkDescription}": ${emoji}`;
  if (feedback.type === 'approved') message += ' Works';
  else if (feedback.type === 'rejected') message += ' Does not work';
  if (feedback.value) message += ` \u2014 ${feedback.value}`;

  const term = terminalManager.terminals.get(terminalId);
  if (term) {
    const formattedMsg = `\r\n\x1b[36m${message}\x1b[0m\r\n`;
    term.pty.write(formattedMsg);
  }

  if (sessionId) {
    try {
      db.prepare(`
        INSERT INTO terminal_messages (session_id, role, content, created_at)
        VALUES (?, 'user', ?, datetime('now'))
      `).run(sessionId, `[CHECK FEEDBACK] ${message}`);
    } catch (err) {
      console.error('[CheckFeedback] Failed to save message:', err);
    }
  }

  return { success: !!term, message };
});

// ═══════════════════ Checklist CRUD IPC (AI Assistant) ═══════════════════

electron_1.ipcMain.handle('add-problem-check', async (_event, data: { problemId: string; description: string; instruction?: string }) => {
  try {
    const ps = getProblemsService();
    const check = ps.addCheck(data.problemId, data.description, data.instruction || '');
    if (!check) return { success: false, error: 'Problem not found' };
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('context-changed', {
        type: 'check', action: 'added', entity: { check, parentId: data.problemId, parentType: 'problem' },
      });
    }
    return { success: true, check };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

electron_1.ipcMain.handle('add-request-check', async (_event, data: { requestId: string; description: string; instruction?: string }) => {
  try {
    const rs = getRequestsService();
    const check = rs.addCheck(data.requestId, data.description, data.instruction || '');
    if (!check) return { success: false, error: 'Request not found' };
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('context-changed', {
        type: 'check', action: 'added', entity: { check, parentId: data.requestId, parentType: 'request' },
      });
    }
    return { success: true, check };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

electron_1.ipcMain.handle('complete-check', async (_event, checkId: string) => {
  try {
    const ps = getProblemsService();
    const problems = ps.getProblems();
    for (const p of problems) {
      const check = p.checks?.find((c: any) => c.id === checkId);
      if (check) {
        const result = ps.completeCheck(p.id, checkId);
        return { success: true, check: result, parentId: p.id, parentType: 'problem' };
      }
    }
    const rs = getRequestsService();
    const requests = rs.getRequests();
    for (const r of requests) {
      const check = r.checks?.find((c: any) => c.id === checkId);
      if (check) {
        const result = rs.completeCheck(r.id, checkId);
        return { success: true, check: result, parentId: r.id, parentType: 'request' };
      }
    }
    return { success: false, error: 'Check not found' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

electron_1.ipcMain.handle('get-problem-checks', async (_event, problemId: string) => {
  try {
    const ps = getProblemsService();
    const problems = ps.getProblems();
    const problem = problems.find((p: any) => p.id === problemId);
    return { success: true, checks: problem?.checks || [] };
  } catch (err: any) {
    return { success: false, error: err.message, checks: [] };
  }
});

electron_1.ipcMain.handle('get-request-checks', async (_event, requestId: string) => {
  try {
    const rs = getRequestsService();
    const requests = rs.getRequests();
    const request = requests.find((r: any) => r.id === requestId);
    return { success: true, checks: request?.checks || [] };
  } catch (err: any) {
    return { success: false, error: err.message, checks: [] };
  }
});

// ═══════════════════ Session Compaction IPC ═══════════════════

electron_1.ipcMain.handle('check-session-compaction', async (_event, data: {
  sessionId: string;
  messageThreshold?: number;
}) => {
  const threshold = data.messageThreshold || 500;

  const count = db.prepare(
    'SELECT COUNT(*) as count FROM terminal_messages WHERE session_id = ?'
  ).get(data.sessionId) as any;

  if ((count?.count || 0) < threshold) {
    return { needsCompaction: false };
  }

  return { needsCompaction: true, messageCount: count.count };
});

electron_1.ipcMain.handle('compact-session', async (_event, data: {
  sessionId: string;
  summaryPrompt?: string;
}) => {
  const { sessionId } = data;
  try {
    const messages = db.prepare(
      'SELECT role, content FROM terminal_messages WHERE session_id = ? ORDER BY created_at'
    ).all(sessionId);

    const summaryContent = (messages as any[]).map((m: any) =>
      `[${m.role}]: ${m.content.substring(0, 200)}`
    ).join('\n');

    let llmResult: any;
    try {
      llmResult = await callOpenRouter(
        'You summarize terminal sessions concisely. Produce a structured summary with key decisions, changes, and current state.',
        `Session ${sessionId} history:\n${summaryContent.substring(0, 4000)}`,
        { model: 'anthropic/claude-3.5-haiku', maxTokens: 500, temperature: 0.2 }
      );
    } catch (llmErr) {
      console.error('[SessionCompaction] LLM call failed, using basic summary:', llmErr);
      llmResult = { content: `Session ${sessionId} containing ${summaryContent.length} characters of history.` };
    }

    db.prepare(`
      UPDATE terminal_sessions SET status = 'archived', updated_at = datetime('now')
      WHERE id = ?
    `).run(sessionId);

    const newSessionId = `compacted-${Date.now()}`;
    const oldSession = db.prepare('SELECT * FROM terminal_sessions WHERE id = ?').get(sessionId) as any;

    db.prepare(`
      INSERT INTO terminal_sessions (id, project_id, agent, resume_id, topic, terminal_id, category, status, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, datetime('now'), datetime('now'))
    `).run(
      newSessionId,
      oldSession?.project_id,
      oldSession?.agent,
      sessionId,
      `[Compacted] ${oldSession?.topic || 'Session'}`,
      oldSession?.terminal_id,
      oldSession?.category,
      llmResult.content,
    );

    db.prepare(`
      INSERT INTO terminal_messages (session_id, role, content, created_at)
      VALUES (?, 'system', ?, datetime('now'))
    `).run(newSessionId, `[SESSION COMPACTION SUMMARY]\n${llmResult.content}`);

    return { success: true, newSessionId, archivedSessionId: sessionId };
  } catch (error: any) {
    console.error('[SessionCompaction] compact-session error:', error);
    return { success: false, error: error.message };
  }
});

// Progress event channel for streaming init progress
const INIT_PROGRESS_CHANNEL = 'tracker-mind-init-progress';

async function runInitAll(baseDir: string, agent: string, projectId: string | undefined, event: any) {
  const agentDir = path_1.default.join(baseDir, 'agent');
  const skillsDir = path_1.default.join(agentDir, 'skills');
  const graphifyDir = path_1.default.join(baseDir, 'graphify-out');

  const steps = [
    // -- agent/ directory --
    { id: 'agent-dir', label: 'agent/', type: 'folder', group: 'agent', path: 'agent/' },
    { id: 'agents-md', label: 'AGENTS.md', type: 'file', group: 'agent', path: 'agent/AGENTS.md' },
    { id: 'agents-lower', label: 'agents.md', type: 'file', group: 'agent', path: 'agent/agents.md' },
    { id: 'initialize-md', label: 'INITIALIZE.md', type: 'file', group: 'agent', path: 'agent/INITIALIZE.md' },
    { id: 'problems-md', label: 'PROBLEMS.md', type: 'file', group: 'agent', path: 'agent/PROBLEMS.md' },
    { id: 'requests-md', label: 'REQUESTS.md', type: 'file', group: 'agent', path: 'agent/REQUESTS.md' },
    { id: 'state-md', label: 'state.md', type: 'file', group: 'agent', path: 'agent/state.md' },
    { id: 'problems-json', label: 'problems.json', type: 'file', group: 'agent', path: 'agent/problems.json' },
    { id: 'requests-json', label: 'requests.json', type: 'file', group: 'agent', path: 'agent/requests.json' },
    { id: 'terminal-sessions-json', label: 'terminal-sessions.json', type: 'file', group: 'agent', path: 'agent/terminal-sessions.json' },
    { id: 'commits-md', label: 'COMMITS.md', type: 'file', group: 'agent', path: 'agent/COMMITS.md' },
    { id: 'feature-tracker', label: 'FEATURE_TRACKER.md', type: 'file', group: 'agent', path: 'agent/FEATURE_TRACKER.md' },
    { id: 'workspace-context', label: 'WORKSPACE_CONTEXT.md', type: 'file', group: 'agent', path: 'agent/WORKSPACE_CONTEXT.md' },
    { id: 'human-test', label: 'HUMAN_TEST_CHECKLIST.md', type: 'file', group: 'agent', path: 'agent/HUMAN_TEST_CHECKLIST.md' },
    { id: 'page-context-md', label: 'PAGE_CONTEXT.md', type: 'file', group: 'agent', path: 'agent/PAGE_CONTEXT.md' },
    { id: 'context-md', label: 'context.md', type: 'file', group: 'agent', path: 'agent/context.md' },
    { id: 'constraints-md', label: 'constraints.md', type: 'file', group: 'agent', path: 'agent/constraints.md' },
    { id: 'patterns-md', label: 'patterns.md', type: 'file', group: 'agent', path: 'agent/patterns.md' },
    { id: 'glossary-md', label: 'glossary.md', type: 'file', group: 'agent', path: 'agent/glossary.md' },
    { id: 'data-md', label: 'data.md', type: 'file', group: 'agent', path: 'agent/data.md' },
    { id: 'debugging-md', label: 'debugging.md', type: 'file', group: 'agent', path: 'agent/debugging.md' },
    { id: 'skills-md', label: 'skills.md', type: 'file', group: 'agent', path: 'agent/skills.md' },
    { id: 'prompt-md', label: 'prompt.md', type: 'file', group: 'agent', path: 'agent/prompt.md' },
    { id: 'prompts-md', label: 'prompts.md', type: 'file', group: 'agent', path: 'agent/prompts.md' },
    { id: 'readme-md', label: 'README.md', type: 'file', group: 'agent', path: 'agent/README.md' },
    { id: 'generic-agent', label: 'GENERIC_AGENT.md', type: 'file', group: 'agent', path: 'agent/GENERIC_AGENT.md' },
    { id: 'qwen-md', label: 'qwen.md', type: 'file', group: 'agent', path: 'agent/qwen.md' },
    { id: 'dictionary', label: 'dictionary.md', type: 'file', group: 'agent', path: 'agent/dictionary.md' },
    { id: 'actions-schema', label: 'ACTIONS_SCHEMA.md', type: 'file', group: 'agent', path: 'agent/ACTIONS_SCHEMA.md' },
    { id: 'default-system-prompt', label: 'DEFAULT_SYSTEM_PROMPT.md', type: 'file', group: 'agent', path: 'agent/DEFAULT_SYSTEM_PROMPT.md' },
    { id: 'rules-compact', label: 'RULES_COMPACT.md', type: 'file', group: 'agent', path: 'agent/RULES_COMPACT.md' },
    { id: 'terminal-sidebar-ref', label: 'TERMINAL_SIDEBAR_REFERENCE.md', type: 'file', group: 'agent', path: 'agent/TERMINAL_SIDEBAR_REFERENCE.md' },
    { id: 'tracker-mind-checklist', label: 'TRACKER_MIND_CHECKLIST.md', type: 'file', group: 'agent', path: 'agent/TRACKER_MIND_CHECKLIST.md' },
    // -- agent/docs/ subdirectories --
    { id: 'docs-dir', label: 'agent/docs/', type: 'folder', group: 'docs', path: 'agent/docs/' },
    { id: 'templates-dir', label: 'agent/templates/', type: 'folder', group: 'docs', path: 'agent/templates/' },
    { id: 'core-dir', label: 'agent/core/', type: 'folder', group: 'docs', path: 'agent/core/' },
    { id: 'context-dir', label: 'agent/context/', type: 'folder', group: 'docs', path: 'agent/context/' },
    { id: 'page-context-guide', label: 'PAGE_CONTEXT_GUIDE.md', type: 'file', group: 'docs', path: 'agent/docs/PAGE_CONTEXT_GUIDE.md' },
    // -- agent/skills/ --
    { id: 'skills-dir', label: 'agent/skills/', type: 'folder', group: 'skills', path: 'agent/skills/' },
    { id: 'skill-templates', label: 'fix-problems.md', type: 'file', group: 'skills', path: 'agent/skills/fix-problems.md' },
    { id: 'skill-agent-reflect', label: 'agent-reflect/', type: 'folder', group: 'skills', path: 'agent/skills/agent-reflect/' },
    { id: 'skill-commit', label: 'commit/', type: 'folder', group: 'skills', path: 'agent/skills/commit/' },
    { id: 'skill-deep-research', label: 'deep-research/', type: 'folder', group: 'skills', path: 'agent/skills/deep-research/' },
    { id: 'skill-deep-research-prompt', label: 'deep-research-prompt/', type: 'folder', group: 'skills', path: 'agent/skills/deep-research-prompt/' },
    { id: 'skill-design-taste', label: 'design-taste/', type: 'folder', group: 'skills', path: 'agent/skills/design-taste/' },
    { id: 'skill-fix-problems', label: 'fix-problems/', type: 'folder', group: 'skills', path: 'agent/skills/fix-problems/' },
    { id: 'skill-frontend-design', label: 'frontend-design/', type: 'folder', group: 'skills', path: 'agent/skills/frontend-design/' },
    { id: 'skill-generate-problem', label: 'generate-problem/', type: 'folder', group: 'skills', path: 'agent/skills/generate-problem/' },
    { id: 'skill-generate-prompt', label: 'generate-prompt/', type: 'folder', group: 'skills', path: 'agent/skills/generate-prompt/' },
    { id: 'skill-google-stitch', label: 'google-stitch/', type: 'folder', group: 'skills', path: 'agent/skills/google-stitch/' },
    { id: 'skill-impeccable', label: 'impeccable/', type: 'folder', group: 'skills', path: 'agent/skills/impeccable/' },
    { id: 'skill-maintain-context', label: 'maintain-context/', type: 'folder', group: 'skills', path: 'agent/skills/maintain-context/' },
    { id: 'skill-readme-generator', label: 'readme-generator/', type: 'folder', group: 'skills', path: 'agent/skills/readme-generator/' },
    { id: 'skill-recursive-playwright', label: 'recursive-playwright/', type: 'folder', group: 'skills', path: 'agent/skills/recursive-playwright/' },
    { id: 'skill-sqlite-js-migration', label: 'sqlite-js-migration/', type: 'folder', group: 'skills', path: 'agent/skills/sqlite-js-migration/' },
    { id: 'skill-taste-skill', label: 'taste-skill/', type: 'folder', group: 'skills', path: 'agent/skills/taste-skill/' },
    { id: 'skill-terminal-agent', label: 'terminal-agent/', type: 'folder', group: 'skills', path: 'agent/skills/terminal-agent/' },
    { id: 'skill-ui-ux-pro-max', label: 'ui-ux-pro-max/', type: 'folder', group: 'skills', path: 'agent/skills/ui-ux-pro-max/' },
    // -- graphify-out/ --
    { id: 'graphify-dir', label: 'graphify-out/', type: 'folder', group: 'graphify', path: 'graphify-out/' },
    // -- automations/ --
    { id: 'automations-dir', label: 'agent/automations/', type: 'folder', group: 'docs', path: 'agent/automations/' },
    // -- design-references/ --
    { id: 'design-refs-dir', label: 'agent/design-references/', type: 'folder', group: 'docs', path: 'agent/design-references/' },
  ];

  const send = (stepId: string | null, status: string, extra?: Record<string, any>) => {
    event.sender.send(INIT_PROGRESS_CHANNEL, { type: 'step', stepId, status, ...extra });
  };

  const today = new Date().toISOString().split('T')[0];

  try {
    // Send manifest
    event.sender.send(INIT_PROGRESS_CHANNEL, { type: 'manifest', steps });

    // Step 1: agent directory
    send('agent-dir', 'creating');
    if (!fs_1.default.existsSync(agentDir)) {
      fs_1.default.mkdirSync(agentDir, { recursive: true });
    }
    send('agent-dir', 'done');

    // Step 2: AGENTS.md
    send('agents-md', 'creating');
    const mdFiles = fs_1.default.readdirSync(agentDir)
      .filter(f => f.endsWith('.md') && f !== 'AGENTS.md')
      .sort();
    const skillsMdFiles = fs_1.default.existsSync(skillsDir)
      ? fs_1.default.readdirSync(skillsDir).filter(f => f.endsWith('.md')).sort()
      : [];
    const allMdFiles = [
      ...mdFiles.map(f => `- \`agent/${f}\``),
      ...skillsMdFiles.map(f => `- \`agent/skills/${f}\``),
    ].join('\n');

    const agentsContent = `# 🤖 AI Agent Workspace

> **Auto-generated by Tracker Mind** — ${new Date().toISOString()}
> **Target Agent:** ${agent}

## Workspace Context

This directory contains the context files for AI agents working on this project.

## Agent Files

${allMdFiles || '- No markdown files yet'}

## Page Context System

This project uses \`PAGE_CONTEXT.md\` to track every page's purpose, data flow, IPC endpoints, component tree, and connections to other pages. **Read it before editing any UI code.**

## Initialization Instructions

1. Read each file listed above for project context
2. Check \`INITIALIZE.md\` for setup instructions
3. Review \`PROBLEMS.md\` for known issues
4. Check \`REQUESTS.md\` for pending requests
5. Read \`PAGE_CONTEXT.md\` to understand each page's purpose, data flow, and connections before editing UI code
6. Update files as needed during work — keep \`PAGE_CONTEXT.md\` in sync when you add/modify pages

## Session Metadata Requirements

This project requires structured session metadata from AI agents.

At the **start of each session** (or when switching tasks), output:

\`\`\`
## Session Metadata
- Title: Short descriptive title of what this session is working on
- Description: 1-2 sentences explaining the goal and scope
- Status: active | paused | completed
- Product Area: Which part of the application this targets (e.g., Dashboard, Settings, Terminal, Database, External Page, IDE Page, etc.)
- Category: bug-fix | feature | refactor | research | review
\`\`\`

If you don't provide this metadata, the system will auto-analyze your messages to infer it. Providing it explicitly is more accurate.

## Recent Activity Tracking

Changes to problems, requests, steps, and sessions are logged in the **activity_log** table with who made the change, what changed, and when.

When a user completes a step or changes a request status, you'll see it reflected here. Check the activity_log to understand what's happened recently.

You can also signal important activity by including an \`## Actions\` block in your response:

\`\`\`
## Actions
- [create-problem] Problem Title - priority: high - category: bug-fix - description: What's broken
- [update-problem] ProblemID - status: In Progress
- [complete-checklist] checklist-item-id
\`\`\`

These actions will be automatically executed to keep the project board in sync.
---
`;
    fs_1.default.writeFileSync(path_1.default.join(agentDir, 'AGENTS.md'), agentsContent, 'utf-8');
    send('agents-md', 'done', { content: agentsContent });

    // Step 3: INITIALIZE.md
    send('initialize-md', 'creating');
    const initContent = `# 🚀 Workspace Initialization Guide

> **Generated for:** ${agent}
> **Date:** ${new Date().toISOString()}

## Overview

This file guides the AI agent through workspace initialization. Follow these steps in order.

## Step 1: Read AGENTS.md

Read \`AGENTS.md\` to understand the workspace structure and available files.

## Step 2: Agent Session Setup

${agent === 'opencode' ? `Run: \`opencode --init\` in the project root to initialize.` : `Run: \`${agent}\` and use its built-in init command.`}

## Step 3: Review Project State

- \`state.md\` — Current project state and recent changes
- \`PROBLEMS.md\` — Known issues to fix
- \`REQUESTS.md\` — User feature requests
- \`problems.json\` — Machine-parseable problem data
- \`requests.json\` — Machine-parseable request data
- \`problems.json\` and \`requests.json\` — Each item has a \`steps\` array (inline sub-tasks with status tracking)

## Step 3a: Read Page Context

Read \`PAGE_CONTEXT.md\` (+ \`docs/PAGE_CONTEXT_GUIDE.md\` for format reference) to understand the full UI layout before editing any page code.

## Step 4: Skills Setup

Browse the \`skills/\` directory and load relevant skills for your tasks.

## Step 5: Begin Work

Once initialization is complete, you can begin working on:
1. Review and update \`PROBLEMS.md\` with any discovered issues
2. Address high-priority items
3. Update \`state.md\` as you make changes
4. For each problem or request you work on, add steps to the \`steps\` array — add step-by-step items so the human can track progress:
   - Each step: \`{ "id": "problem-1-step-1", "description": "what to do", "status": "pending|in_progress|completed" }\`
   - Use \`[add-step]\` and \`[complete-step]\` actions to manage them

---
*This file is managed by Tracker Mind. It is read by AI agents during workspace initialization.*
`;
    fs_1.default.writeFileSync(path_1.default.join(agentDir, 'INITIALIZE.md'), initContent, 'utf-8');
    send('initialize-md', 'done', { content: initContent });

    // Step 4: PROBLEMS.md
    send('problems-md', 'creating');
    const problemsPath = path_1.default.join(agentDir, 'PROBLEMS.md');
    let problemsContent = '';
    if (!fs_1.default.existsSync(problemsPath)) {
      try {
        const ps = new ProblemsService(baseDir, projectId);
        const existing = ps.getProblems();
        if (existing.length > 0) {
          problemsContent = fs_1.default.readFileSync(problemsPath, 'utf-8');
        } else {
          problemsContent = `# PROBLEMS.md\n\n> **Purpose:** Issue tracker for AI agents and humans.\n> **Last Updated:** ${today}\n\n---\n\n<!-- No problems yet. -->\n`;
          fs_1.default.writeFileSync(problemsPath, problemsContent, 'utf-8');
        }
      } catch (e) {
        console.error('[Tracker Mind] Failed to init PROBLEMS.md:', e);
      }
    } else {
      problemsContent = fs_1.default.readFileSync(problemsPath, 'utf-8');
    }
    send('problems-md', 'done', { content: problemsContent });

    // Step 5: REQUESTS.md
    send('requests-md', 'creating');
    const requestsPath = path_1.default.join(agentDir, 'REQUESTS.md');
    let requestsContent = '';
    if (!fs_1.default.existsSync(requestsPath)) {
      try {
        const rs = new RequestsService(baseDir);
        const existing = rs.getRequests();
        if (existing.length > 0) {
          requestsContent = fs_1.default.readFileSync(requestsPath, 'utf-8');
        } else {
          requestsContent = `# 📋 User Requests Log\n\n> **Purpose:** Track all user requests.\n> **Last Updated:** ${new Date().toISOString()}\n\n---\n\n<!-- No requests yet. -->\n`;
          fs_1.default.writeFileSync(requestsPath, requestsContent, 'utf-8');
        }
      } catch (e) {
        console.error('[Tracker Mind] Failed to init REQUESTS.md:', e);
      }
    } else {
      requestsContent = fs_1.default.readFileSync(requestsPath, 'utf-8');
    }
    send('requests-md', 'done', { content: requestsContent });

    // Step 6: state.md
    send('state-md', 'creating');
    const statePath = path_1.default.join(agentDir, 'state.md');
    let stateContent = '';
    if (!fs_1.default.existsSync(statePath)) {
      stateContent = `# 📌 Project State

**Purpose:** Current status, known issues, and recent changes for Tracker Mind.

**Version:** 1.0
**Target Agent:** ${agent}
**Last Updated:** ${new Date().toISOString()}

## Recent Changes

### ${new Date().toISOString().split('T')[0]} — Initial Setup

- Initialized Tracker Mind structure
- Created agent/ directory
- Created AGENTS.md, INITIALIZE.md, PROBLEMS.md, REQUESTS.md
- Exported JSON data files

---
`;
      fs_1.default.writeFileSync(statePath, stateContent, 'utf-8');
    } else {
      stateContent = fs_1.default.readFileSync(statePath, 'utf-8');
    }
    send('state-md', 'done', { content: stateContent });

    // Step 7: problems.json (re-export via ProblemsService)
    send('problems-json', 'creating');
    try {
      const ps = new ProblemsService(baseDir, projectId);
      const problems = ps.getProblems();
      const jsonPath = path_1.default.join(agentDir, 'problems.json');
      fs_1.default.writeFileSync(jsonPath, JSON.stringify(problems, null, 2), 'utf-8');
      send('problems-json', 'done', { content: JSON.stringify(problems.slice(0, 3), null, 2) + (problems.length > 3 ? '\n...' : '') });
    } catch (e) {
      console.error('[Tracker Mind] Failed to export problems:', e);
      send('problems-json', 'error', { error: String(e) });
    }

    // Step 8: requests.json
    send('requests-json', 'creating');
    try {
      const rs = new RequestsService(baseDir);
      const requests = rs.getRequests();
      const jsonPath = path_1.default.join(agentDir, 'requests.json');
      fs_1.default.writeFileSync(jsonPath, JSON.stringify(requests, null, 2), 'utf-8');
      send('requests-json', 'done', { content: JSON.stringify(requests.slice(0, 3), null, 2) + (requests.length > 3 ? '\n...' : '') });
    } catch (e) {
      console.error('[Tracker Mind] Failed to export requests:', e);
      send('requests-json', 'error', { error: String(e) });
    }

    // Step 9: terminal-sessions.json
    send('terminal-sessions-json', 'creating');
    try {
      const sessions = db ? db.prepare('SELECT * FROM terminal_sessions ORDER BY created_at DESC').all() : [];
      const jsonPath = path_1.default.join(agentDir, 'terminal-sessions.json');
      fs_1.default.writeFileSync(jsonPath, JSON.stringify(sessions, null, 2), 'utf-8');
      send('terminal-sessions-json', 'done', { content: JSON.stringify((sessions as any[]).slice(0, 3), null, 2) + ((sessions as any[]).length > 3 ? '\n...' : '') });
    } catch (e) {
      console.error('[Tracker Mind] Failed to export sessions:', e);
      send('terminal-sessions-json', 'error', { error: String(e) });
    }

    // Step 10: COMMITS.md
    send('commits-md', 'creating');
    const commitsPath = path_1.default.join(agentDir, 'COMMITS.md');
    let commitsContent = '';
    if (!fs_1.default.existsSync(commitsPath)) {
      commitsContent = `# COMMITS.md\n\n> **Purpose:** Track git commit history and conventions.\n> **Last Updated:** ${today}\n\n---\n\n<!-- Commit history will be recorded here. -->\n`;
      fs_1.default.writeFileSync(commitsPath, commitsContent, 'utf-8');
    } else {
      commitsContent = fs_1.default.readFileSync(commitsPath, 'utf-8');
    }
    send('commits-md', 'done', { content: commitsContent });

    // Step 11: FEATURE_TRACKER.md
    send('feature-tracker', 'creating');
    const ftPath = path_1.default.join(agentDir, 'FEATURE_TRACKER.md');
    let ftContent = '';
    if (!fs_1.default.existsSync(ftPath)) {
      ftContent = `# FEATURE_TRACKER.md\n\n> **Purpose:** Complete inventory of all pages and features.\n> **Last Updated:** ${today}\n\n---\n\n<!-- Feature inventory will be documented here. -->\n`;
      fs_1.default.writeFileSync(ftPath, ftContent, 'utf-8');
    } else {
      ftContent = fs_1.default.readFileSync(ftPath, 'utf-8');
    }
    send('feature-tracker', 'done', { content: ftContent });

    // Step 12: WORKSPACE_CONTEXT.md
    send('workspace-context', 'creating');
    const wcPath = path_1.default.join(agentDir, 'WORKSPACE_CONTEXT.md');
    let wcContent = '';
    if (!fs_1.default.existsSync(wcPath)) {
      wcContent = `# WORKSPACE_CONTEXT.md\n\n> **Purpose:** Workspace/IDE projects context for AI agents.\n> **Last Updated:** ${today}\n\n---\n\n<!-- Workspace context will be documented here. -->\n`;
      fs_1.default.writeFileSync(wcPath, wcContent, 'utf-8');
    } else {
      wcContent = fs_1.default.readFileSync(wcPath, 'utf-8');
    }
    send('workspace-context', 'done', { content: wcContent });

    // Step 13: HUMAN_TEST_CHECKLIST.md
    send('human-test', 'creating');
    const htPath = path_1.default.join(agentDir, 'HUMAN_TEST_CHECKLIST.md');
    let htContent = '';
    if (!fs_1.default.existsSync(htPath)) {
      htContent = `# HUMAN_TEST_CHECKLIST.md\n\n> **Purpose:** Test checklist for manual testing by humans.\n> **Last Updated:** ${today}\n\n---\n\n<!-- No test items yet. Add testable items with expected behavior. -->\n`;
      fs_1.default.writeFileSync(htPath, htContent, 'utf-8');
    } else {
      htContent = fs_1.default.readFileSync(htPath, 'utf-8');
    }
    send('human-test', 'done', { content: htContent });

    // Step 14: PAGE_CONTEXT.md
    send('page-context-md', 'creating');
    const pcPath = path_1.default.join(agentDir, 'PAGE_CONTEXT.md');
    if (!fs_1.default.existsSync(pcPath)) {
      const pcContent = `# Page Context

**Purpose:** Structured page-by-page reference so AI agents understand the UI layer without re-discovering it every session.

**Last Updated:** ${today}

---

## Page: Example

### Identity
- **Route:** \`/\`
- **File:** \`src/pages/ExamplePage.tsx\`
- **Primary props:** selectedPeriod, dateOffset
- **Primary state:** items, loading

### Component Tree
\`\`\`
PageShell
├── Section
│   └── SubComponent
└── AnotherSection
\`\`\`

### IPC Endpoints Called
| Channel | Direction | Purpose |
|---------|-----------|---------|
| \`example-read\` | read | Fetches data |
| \`example-write\` | write | Saves changes |

### Data Flow
- **Reads:** IPC calls + props from App.tsx
- **Writes:** IPC mutations
- **Shared state:** selectedPeriod, dateOffset

### Connections to Other Pages
- Links to /other-page via navigation
- Shares global timer state

### Update Conventions
- Follow the existing pattern for this page type
- Keep performance in mind

### Known Pitfalls
- Re-renders on every prop change — use useMemo

---

<!-- AI agents: update this file by running the page-context-update workflow.
     Read PAGE_CONTEXT_GUIDE.md for the full format specification. -->
`;
      fs_1.default.writeFileSync(pcPath, pcContent, 'utf-8');
      send('page-context-md', 'done', { content: pcContent });
    } else {
      send('page-context-md', 'done', { content: fs_1.default.readFileSync(pcPath, 'utf-8') });
    }

    // -- agents.md (lowercase) --
    send('agents-lower', 'creating');
    const agentsLowerPath = path_1.default.join(agentDir, 'agents.md');
    if (!fs_1.default.existsSync(agentsLowerPath)) {
      fs_1.default.writeFileSync(agentsLowerPath, `# ?? AI Agent Workspace

> **Auto-generated by Tracker Mind** � ${new Date().toISOString()}
> **Target Agent:** ${agent}

## Workspace Context

This directory contains the context files for AI agents working on this project.

## Agent Files

\${allMdFiles || '- No markdown files yet'}

## Page Context System

This project uses \`PAGE_CONTEXT.md\` to track every page's purpose, data flow, IPC endpoints, component tree, and connections to other pages. **Read it before editing any UI code.**

## Initialization Instructions

1. Read each file listed above for project context
2. Check \`INITIALIZE.md\` for setup instructions
3. Review \`PROBLEMS.md\` for known issues
4. Check \`REQUESTS.md\` for pending requests
5. Read \`PAGE_CONTEXT.md\` to understand each page's purpose, data flow, and connections before editing UI code
6. Update files as needed during work — keep \`PAGE_CONTEXT.md\` in sync when you add/modify pages

## Session Metadata Requirements

This project requires structured session metadata from AI agents.

At the **start of each session** (or when switching tasks), output:

\`\`\`
## Session Metadata
- Title: Short descriptive title of what this session is working on
- Description: 1-2 sentences explaining the goal and scope
- Status: active | paused | completed
- Product Area: Which part of the application this targets (e.g., Dashboard, Settings, Terminal, Database, External Page, IDE Page, etc.)
- Category: bug-fix | feature | refactor | research | review
\`\`\`

If you don't provide this metadata, the system will auto-analyze your messages to infer it. Providing it explicitly is more accurate.

## Recent Activity Tracking

Changes to problems, requests, steps, and sessions are tracked. When a user completes a step or changes a request status, it will be reflected here.

You can also signal important activity by including an \`## Actions\` block in your response:

\`\`\`
## Actions
- [create-problem] Problem Title - priority: high - category: bug-fix - description: What's broken
- [update-problem] ProblemID - status: In Progress
- [complete-checklist] checklist-item-id
\`\`\`

These actions will be automatically executed to keep the project board in sync.
---\n`, 'utf-8');
    }
    send('agents-lower', 'done', { content: fs_1.default.readFileSync(agentsLowerPath, 'utf-8') });

    // -- context.md --
    send('context-md', 'creating');
    const contextPath = path_1.default.join(agentDir, 'context.md');
    if (!fs_1.default.existsSync(contextPath)) {
      fs_1.default.writeFileSync(contextPath, `# ?? Project Context

**Purpose:** Comprehensive overview of the project architecture, tech stack, and conventions.
**Last Updated:** ${today}

---

## ?? Project Overview

**Project Name** � Brief one-liner describing what the application does.

**Core Systems:**
- **System 1** � Brief description of what it does
- **System 2** � Brief description of what it does
- **System 3** � Brief description of what it does
- **System 4** � Brief description of what it does

---

## ??? Tech Stack

### Core Technologies
| Technology | Version | Purpose |
|------------|---------|---------|
| Electron | | Desktop wrapper |
| React | | UI framework |
| TypeScript | | Type safety |
| Vite | | Build tool |

### Database
| Technology | Purpose |
|------------|---------|
| SQLite (better-sqlite3) | Primary storage |

## Architecture

Describe the application architecture here. Include:
- Main process (Electron) responsibilities
- Renderer process responsibilities
- IPC communication patterns
- Key service layers

## Data Flow

Describe key data flows here. Include:
- Tracking data: source ? storage ? display
- User interactions: UI ? IPC ? main process ? response
- External integrations

## Build & Deployment

- **Build command:** \`npm run build\`
- **Dev command:** \`npm run dev\`
- **Output:** \`dist/\` (renderer) + \`dist-electron/\` (main)

---

## Environment

- **Platform:** Windows (primary), cross-platform potential
- **Package manager:** npm
- **Node version:** 18+

---\n`, 'utf-8');
    }
    send('context-md', 'done', { content: fs_1.default.readFileSync(contextPath, 'utf-8') });

    // -- constraints.md --
    send('constraints-md', 'creating');
    const constraintsPath = path_1.default.join(agentDir, 'constraints.md');
    if (!fs_1.default.existsSync(constraintsPath)) {
      fs_1.default.writeFileSync(constraintsPath, `# ?? Project Constraints

**Purpose:** Hard rules and limitations for this project.

---

## ?? Hard Constraints

### Electron
- **No external URLs** � All assets must be local
- **No nodeIntegration** � Must use contextIsolation
- **CJS for Electron** � Main/preload must be CommonJS (.cjs)

### React
- **HashRouter only** � No BrowserRouter (file:// protocol)
- **No direct DOM** � Use refs for Three.js integration if applicable
- **TypeScript** � All new code must be TypeScript

### Database
- **SQLite preferred** � JSON fallback only if SQLite fails
- **No SQL injection** � Use prepared statements

### Build
- **Vite base** � Must be './' for Electron
- **TypeScript target** � ES2020 for Electron, ESNext for React
- **No eval** � Content Security Policy

---

## ?? Style Constraints

### Code Style
Describe code style conventions here.

### Naming Conventions
Describe naming conventions here.

---

## ?? Dependency Constraints

Document any pinned dependency versions or upgrade restrictions here.

---

## ?? Process Constraints

- Run build after every code change
- Update state.md after every change
- Check PROBLEMS.md before starting new work

---\n`, 'utf-8');
    }
    send('constraints-md', 'done', { content: fs_1.default.readFileSync(constraintsPath, 'utf-8') });

    // -- patterns.md --
    send('patterns-md', 'creating');
    const patternsPath = path_1.default.join(agentDir, 'patterns.md');
    if (!fs_1.default.existsSync(patternsPath)) {
      fs_1.default.writeFileSync(patternsPath, `# ?? Code Patterns

**Purpose:** Common code patterns and conventions used in this project.

---

## ?? React Patterns

### Component Template
\`\`\`tsx
interface Props {
  data: DataType;
  onAction: () => void;
}

function MyComponent({ data, onAction }: Props) {
  const [state, setState] = useState(false);

  const computed = useMemo(() => {
    return expensiveComputation(data);
  }, [data]);

  return <div onClick={onAction}>{/* ... */}</div>;
}

export default MyComponent;
\`\`\`

### State Management
\`\`\`tsx
// Local state
const [isPaused, setIsPaused] = useState(false);

// Derived state
const filteredItems = useMemo(() => {
  return items.filter(item => item.active);
}, [items]);

// Callbacks
const handleSubmit = useCallback((data: DataType) => {
  // handle submit
}, [dependencies]);
\`\`\`

## ?? IPC Patterns

### Request-Response
\`\`\`ts
// Main process
electron_1.ipcMain.handle('get-data', async (_, args) => {
  return { success: true, data: result };
});

// Preload bridge
getData: (args) => ipcRenderer.invoke('get-data', args),

// Renderer
const result = await window.deskflowAPI?.getData?.(args);
\`\`\`

### Events (Main ? Renderer)
\`\`\`ts
// Main process
mainWindow.webContents.send('data-updated', payload);

// Renderer
window.deskflowAPI?.onDataUpdated?.((data) => { ... });
\`\`\`

## ??? Data Patterns

Document data access patterns here (SQL queries, JSON file I/O, etc.).

## ?? Styling Patterns

Document styling conventions (Tailwind classes, CSS modules, etc.).

---\n`, 'utf-8');
    }
    send('patterns-md', 'done', { content: fs_1.default.readFileSync(patternsPath, 'utf-8') });

    // -- glossary.md --
    send('glossary-md', 'creating');
    const glossaryPath = path_1.default.join(agentDir, 'glossary.md');
    if (!fs_1.default.existsSync(glossaryPath)) {
      fs_1.default.writeFileSync(glossaryPath, `# ?? Glossary

**Purpose:** Domain-specific terminology and definitions.

---

## ?? Technical Terms

| Term | Definition |
|------|-----------|
| **IPC** | Inter-Process Communication (main ? renderer) |
| **Preload** | Script that bridges main and renderer securely |
| **Context Bridge** | Electron API for exposing safe APIs to renderer |

## ??? Architecture Terms

| Term | Definition |
|------|-----------|
| | |

## ?? Domain Terms

| Term | Definition |
|------|-----------|
| | |

---\n`, 'utf-8');
    }
    send('glossary-md', 'done', { content: fs_1.default.readFileSync(glossaryPath, 'utf-8') });

    // -- data.md --
    send('data-md', 'creating');
    const dataPath = path_1.default.join(agentDir, 'data.md');
    if (!fs_1.default.existsSync(dataPath)) {
      fs_1.default.writeFileSync(dataPath, `# ?? Project Data Reference

**Purpose:** Document data storage, schemas, and IPC endpoints.
**Last Updated:** ${today}

---

## ??? Data Storage Architecture

### Primary Storage
- **Type:** Specify database type (SQLite / JSON / etc.)
- **Location:** Specify storage path
- **Tables/Collections:**

| Table/Collection | Key Fields | Purpose |
|-----------------|------------|---------|
| | | |

### Fallback Storage (if applicable)
- **Type:** 
- **Location:** 
- **Status:** 

---

## ?? IPC Endpoints

| Channel | Direction | Payload | Purpose |
|---------|-----------|---------|---------|
| | renderer ? main | | |

---

## ?? Data Flow

Describe how data flows through the system.

---\n`, 'utf-8');
    }
    send('data-md', 'done', { content: fs_1.default.readFileSync(dataPath, 'utf-8') });

    // -- debugging.md --
    send('debugging-md', 'creating');
    const debuggingPath = path_1.default.join(agentDir, 'debugging.md');
    if (!fs_1.default.existsSync(debuggingPath)) {
      fs_1.default.writeFileSync(debuggingPath, `# ?? Debugging Guide

**Purpose:** Common issues, debugging strategies, and known fixes.

---

## [Issue Title: Brief description]

**Root cause:** Explain why the issue happens.

**Symptoms:**
- Symptom 1
- Symptom 2
- Symptom 3

**Fix:**
Step-by-step fix description.

---

## [Issue Title: Another issue]

**Root cause:** Explain why the issue happens.

**Symptoms:**
- Symptom 1
- Symptom 2

**Fix:**
Step-by-step fix description.

---

## General Debugging Tips

- Tip 1
- Tip 2
- Tip 3

---\n`, 'utf-8');
    }
    send('debugging-md', 'done', { content: fs_1.default.readFileSync(debuggingPath, 'utf-8') });

    // -- skills.md --
    send('skills-md', 'creating');
    const skillsMdPath = path_1.default.join(agentDir, 'skills.md');
    if (!fs_1.default.existsSync(skillsMdPath)) {
      fs_1.default.writeFileSync(skillsMdPath, `# ?? Available Skills

**Purpose:** Documentation of available skills and when to use them.

---

## ?? Agent Self-Improvement

### [skill-name]
**Location:** \`agent/skills/[skill-name]/\`
**When to use:** Describe when this skill is appropriate.

**Usage:**
Describe how to invoke/use the skill.

**What it does:**
Brief description of the skill's functionality.

---

## ?? Core Skills

### 1. [Skill Name]
**When to use:** 

**Best practices:**
- Practice 1
- Practice 2

### 2. [Skill Name]
**When to use:** 

**Best practices:**
- Practice 1
- Practice 2

---

## ?? Skill Index

| Skill | Location | Purpose |
|-------|----------|---------|
| | | |

---\n`, 'utf-8');
    }
    send('skills-md', 'done', { content: fs_1.default.readFileSync(skillsMdPath, 'utf-8') });

    // -- prompt.md --
    send('prompt-md', 'creating');
    const promptPath = path_1.default.join(agentDir, 'prompt.md');
    if (!fs_1.default.existsSync(promptPath)) {
      fs_1.default.writeFileSync(promptPath, `# ?? Prompt for AI

**Purpose:** Reusable prompt templates for AI agents working on this project.

---

## ?? Prompt Template

### Task
Describe the specific task to be completed.

### Key Files
- \`path/to/file1\` � What this file does
- \`path/to/file2\` � What this file does

### Context
Relevant background information for the task.

### Requirements
1. Requirement 1
2. Requirement 2
3. Requirement 3

### Expected Output
Describe what success looks like.

---

## ?? Quick Reference

- **Build command:** \`npm run build\`
- **Test command:** (specify if applicable)
- **Key directories:** \`src/\`, \`agent/\`, etc.

---\n`, 'utf-8');
    }
    send('prompt-md', 'done', { content: fs_1.default.readFileSync(promptPath, 'utf-8') });

    // -- prompts.md --
    send('prompts-md', 'creating');
    const promptsPath = path_1.default.join(agentDir, 'prompts.md');
    if (!fs_1.default.existsSync(promptsPath)) {
      fs_1.default.writeFileSync(promptsPath, `# ?? Compiled Prompts

**Purpose:** Collection of proven prompts for common tasks.

---

## ?? Development Prompts

### [Prompt Category Title]
\`\`\`
Prompt content here with specific instructions for the AI agent.
Be detailed and include file paths, expected patterns, and constraints.
\`\`\`

### [Another Prompt]
\`\`\`
Prompt content here.
\`\`\`

---

## ?? Diagnostic Prompts

### [Diagnostic Title]
\`\`\`
Steps to diagnose and fix the issue.
\`\`\`

---

## ?? Prompt Index

| Prompt | Category | When to Use |
|--------|----------|-------------|
| | | |

---\n`, 'utf-8');
    }
    send('prompts-md', 'done', { content: fs_1.default.readFileSync(promptsPath, 'utf-8') });

    // -- README.md --
    send('readme-md', 'creating');
    const readmePath = path_1.default.join(agentDir, 'README.md');
    if (!fs_1.default.existsSync(readmePath)) {
      fs_1.default.writeFileSync(readmePath, `# ?? Agent Workspace

**Purpose:** AI agent workspace directory for this project. Contains context files, skills, and configuration for AI agents.

---

## ?? Directory Structure

### Core Files
| File | Purpose |
|------|---------|
| \`AGENTS.md\` | Primary agent instructions and behavioral guidelines |
| \`state.md\` | Current project state and recent changes |
| \`context.md\` | Architecture, tech stack, and data flow |
| \`PROBLEMS.md\` | Issue tracker for bugs and improvements |
| \`REQUESTS.md\` | User feature requests and task tracking |

### Configuration Files
| File | Purpose |
|------|---------|
| \`constraints.md\` | Hard rules and limitations |
| \`patterns.md\` | Code patterns and conventions |
| \`data.md\` | Data schemas and IPC endpoints |

### Subdirectories
| Directory | Purpose |
|-----------|---------|
| \`skills/\` | Available skills for AI agents |
| \`docs/\` | Documentation files |
| \`templates/\` | Reusable templates |
| \`core/\` | Core configuration files |
| \`context/\` | Context assembly files |

---

## ?? Getting Started

1. Read \`AGENTS.md\` for full instructions
2. Check \`state.md\` for current status
3. Review \`PROBLEMS.md\` for known issues
4. Browse \`skills/\` for available capabilities

---\n`, 'utf-8');
    }
    send('readme-md', 'done', { content: fs_1.default.readFileSync(readmePath, 'utf-8') });

    // -- GENERIC_AGENT.md --
    send('generic-agent', 'creating');
    const genericAgentPath = path_1.default.join(agentDir, 'GENERIC_AGENT.md');
    if (!fs_1.default.existsSync(genericAgentPath)) {
      fs_1.default.writeFileSync(genericAgentPath, `# ?? AI Agent Instructions (Generic)

**Purpose:** General-purpose instructions for any AI agent working on any project. Customize with project-specific rules.

---

## ? PRIME STATE � MANDATORY PERFORMANCE STANDARD

**Always be in peak performance mode.** This is not optional.

### Prime State Rules:
1. **Always read relevant files BEFORE coding** � Never guess, never assume
2. **Understand the data flow FIRST** � Trace from source to display
3. **Match existing patterns** � Follow the codebase's conventions
4. **Verify EVERY change** � Run build, test, confirm
5. **Make surgical changes only** � Touch only what you must

### Prime State Checklist:
- [ ] Read the relevant files thoroughly
- [ ] Understand exactly what is needed (clarify if ambiguous)
- [ ] Trace the complete data flow
- [ ] Identify root cause (not just symptoms)
- [ ] Make surgical changes only
- [ ] Verify build passes
- [ ] Confirm the fix actually solves the problem

### What Kills Prime State:
- Rushing without understanding
- Making assumptions instead of reading code
- Suggesting changes without verifying they work

---\n`, 'utf-8');
    }
    send('generic-agent', 'done', { content: fs_1.default.readFileSync(genericAgentPath, 'utf-8') });

    // -- qwen.md --
    send('qwen-md', 'creating');
    const qwenPath = path_1.default.join(agentDir, 'qwen.md');
    if (!fs_1.default.existsSync(qwenPath)) {
      fs_1.default.writeFileSync(qwenPath, `# ?? Qwen Configuration

**Purpose:** Qwen-specific behavior, configuration, and best practices for this project.

---

## ?? Critical Instructions

### Version Notice
- Specify the Qwen CLI version in use
- Note any version-specific behaviors

### Task-Specific Prompt Structure

For EVERY new task, use a DIFFERENT prompt based on task type:

### 1. ?? Research Agent
**When:** Researching technologies, analyzing codebases, architecture decisions

**Prompt Template:**
\`\`\`markdown
# Research: [Topic]

## Context
[Why this research is needed]

## Research Questions
1. [Primary question]
2. [Secondary question]

## Scope
- **Include:** [What to cover]
- **Exclude:** [What to skip]
\`\`\`

### 2. ?? Development Agent
**When:** Writing code, fixing bugs, implementing features

**Prompt Template:**
\`\`\`markdown
# Development: [Task]

## Context
[Background information]

## Files to Modify
- [path/to/file] � [change needed]

## Requirements
1. [Requirement]
2. [Requirement]
\`\`\`

---

## Configuration

Document any Qwen-specific configuration settings here.

---\n`, 'utf-8');
    }
    send('qwen-md', 'done', { content: fs_1.default.readFileSync(qwenPath, 'utf-8') });

    // -- dictionary.md --
    send('dictionary', 'creating');
    const dictPath = path_1.default.join(agentDir, 'dictionary.md');
    if (!fs_1.default.existsSync(dictPath)) {
      fs_1.default.writeFileSync(dictPath, `# ?? Project Context Dictionary

**Purpose:** Key terms, concepts, and their meanings in this project.

---

## Architecture & Design

### [Term]
- **What it is:** Brief definition
- **How it works:** Explanation of behavior
- **Important:** Key nuance to understand

### [Term]
- **What it is:** Brief definition
- **How it works:** Explanation of behavior
- **Important:** Key nuance to understand

---

## Data & Storage

### [Term]
- **What it is:** Brief definition
- **Location:** Where it's stored/configured
- **Format:** Data format

---

## UI & Interaction

### [Term]
- **What it is:** Brief definition
- **Location:** Where it appears in the UI
- **Behavior:** How it works

---

## Quick Reference

| Term | Short Definition |
|------|-----------------|
| | |

---\n`, 'utf-8');
    }
    send('dictionary', 'done', { content: fs_1.default.readFileSync(dictPath, 'utf-8') });

    // -- ACTIONS_SCHEMA.md --
    send('actions-schema', 'creating');
    const actionsSchemaPath = path_1.default.join(agentDir, 'ACTIONS_SCHEMA.md');
    if (!fs_1.default.existsSync(actionsSchemaPath)) {
      fs_1.default.writeFileSync(actionsSchemaPath, `# actions.json Schema

Write structured actions to \`agent/actions.json\` for batch execution:

\`\`\`json
{
  "terminal_id": "term-xxx",
  "actions": [
    { "type": "create_problem", "title": "...", "priority": "high", "category": "bug-fix", "description": "..." },
    { "type": "update_problem", "id": "1.5", "status": "FIXED" },
    { "type": "complete_checklist", "id": "checklist-item-id" },
    { "type": "update_request", "id": "1", "status": "IMPLEMENTED" }
  ]
}
\`\`\`

## Available Actions

| Action Type | Description | Required Fields |
|-------------|-------------|-----------------|
| \`create_problem\` | Create a new problem entry | title, priority, category, description |
| \`update_problem\` | Update problem status | id, status |
| \`complete_checklist\` | Mark checklist item done | id |
| \`update_request\` | Update request status | id, status |

---

## Examples

### Example 1: Create a bug problem
\`\`\`json
{
  "terminal_id": "term-123",
  "actions": [
    { "type": "create_problem", "title": "Feature not working", "priority": "high", "category": "bug-fix", "description": "Description of the bug" }
  ]
}
\`\`\`

### Example 2: Update problem + complete checklist
\`\`\`json
{
  "terminal_id": "term-123",
  "actions": [
    { "type": "update_problem", "id": "1.5", "status": "FIXED" },
    { "type": "complete_checklist", "id": "problem-1.5-step-1" }
  ]
}
\`\`\`

---\n`, 'utf-8');
    }
    send('actions-schema', 'done', { content: fs_1.default.readFileSync(actionsSchemaPath, 'utf-8') });

    // -- DEFAULT_SYSTEM_PROMPT.md --
    send('default-system-prompt', 'creating');
    const dspPath = path_1.default.join(agentDir, 'DEFAULT_SYSTEM_PROMPT.md');
    if (!fs_1.default.existsSync(dspPath)) {
      fs_1.default.writeFileSync(dspPath, `# Default System Prompt

**Purpose:** Default system prompt template for AI agents working on this project.

---

\`\`\`
You are an AI agent operating within a desktop application built with Electron, React, TypeScript, and SQLite.

## Your Environment

You have access to:
- The full codebase via file system
- IPC bridge to interact with the application
- Terminal sessions for running commands
- Agent workspace at \`agent/\` for context files

## Communication

You communicate through:
1. **Terminal** � Running commands, scripts, and builds
2. **Agent workspace** � Reading/writing context files in \`agent/\`
3. **Actions** � Use \`## Actions\` blocks or \`agent/actions.json\` for structured operations

## Core Rules

1. Read \`agent/AGENTS.md\` at session start
2. Read context files before making changes
3. Run build after code changes
4. Update \`agent/state.md\` after every change
5. Check \`agent/PROBLEMS.md\` before starting new work
6. Never use git checkout/restore/reset commands
\`\`\`

---\n`, 'utf-8');
    }
    send('default-system-prompt', 'done', { content: fs_1.default.readFileSync(dspPath, 'utf-8') });

    // -- RULES_COMPACT.md --
    send('rules-compact', 'creating');
    const rulesCompactPath = path_1.default.join(agentDir, 'RULES_COMPACT.md');
    if (!fs_1.default.existsSync(rulesCompactPath)) {
      fs_1.default.writeFileSync(rulesCompactPath, `# AGENT RULES (read first � always)

1. At session start: read \`state.md\`, \`context.md\`, active problem, active checklist.
2. At session end: write ## Session Metadata block. Write actions.json if changes.
3. actions.json format: { "actions": [ { "type": "...", "payload": {...} } ] }
4. Never guess file paths. Use list-agent-dir-files if unsure.
5. If unsure about a term: check glossary.md before asking the user.
6. After code changes: run \`npm run build\` to verify.
7. NEVER use git checkout, git restore, git reset, git stash.
8. NEVER change \`@import "tailwindcss"\` in src/index.css to v3 directives.
9. Make surgical changes � touch only what you must.
10. Update \`state.md\` after every change.

---\n`, 'utf-8');
    }
    send('rules-compact', 'done', { content: fs_1.default.readFileSync(rulesCompactPath, 'utf-8') });

    // -- TERMINAL_SIDEBAR_REFERENCE.md --
    send('terminal-sidebar-ref', 'creating');
    const tsrPath = path_1.default.join(agentDir, 'TERMINAL_SIDEBAR_REFERENCE.md');
    if (!fs_1.default.existsSync(tsrPath)) {
      fs_1.default.writeFileSync(tsrPath, `# Terminal Sidebar Reference

**Purpose:** Reference for terminal and workspace sidebar features.

---

## Status Overview

| Feature | Tab/Area | Status |
|---------|----------|--------|
| Terminal Tabs | Header | Present |
| Sidebar Tabs | Sidebar | Present |

## Sidebar Tabs

| Tab | Purpose | Features |
|-----|---------|----------|
| Sessions | Session management | List, resume, categorize sessions |
| Problems | Issue tracker | View, create, update problems |
| Requests | Request tracker | View, create, update requests |
| Skills | Skill library | Browse, save, add to project |
| Files | File browser | Navigate project files |
| Analytics | Usage analytics | Token usage, cost, agent stats |
| Map | Session map | Visual session relationship view |

---

## Key Interactions

- **New Session:** Opens NewSessionDialog with agent type selection
- **Resume Session:** Opens existing session in terminal
- **Save Checkpoint:** Saves workspace state

---\n`, 'utf-8');
    }
    send('terminal-sidebar-ref', 'done', { content: fs_1.default.readFileSync(tsrPath, 'utf-8') });

    // -- TRACKER_MIND_CHECKLIST.md --
    send('tracker-mind-checklist', 'creating');
    const tmcPath = path_1.default.join(agentDir, 'TRACKER_MIND_CHECKLIST.md');
    if (!fs_1.default.existsSync(tmcPath)) {
      fs_1.default.writeFileSync(tmcPath, `# Tracker Mind � Feature Checklist

## Core Features

### 1. Problems Tab in Workspace Sidebar
- [ ] Problems tab visible in workspace sidebar
- [ ] Shows parsed issues from agent/PROBLEMS.md
- [ ] Groups by status (NEW, In Progress, Fixed, etc.)
- [ ] Click to view problem details
- [ ] Create new problem via UI
- [ ] Change status via UI
- [ ] Auto-creates/updates PROBLEMS.md

### 2. Requests Tab in Workspace Sidebar
- [ ] Requests tab visible in workspace sidebar
- [ ] Shows parsed requests from agent/REQUESTS.md
- [ ] Groups by status (pending, in_progress, implemented)
- [ ] Create new request via UI
- [ ] Change status via UI
- [ ] Auto-creates/updates REQUESTS.md

### 3. Terminal-Problem Binding
- [ ] Terminal shows what problem it's working on
- [ ] Can assign problem to terminal from Problems panel
- [ ] If no matching terminal exists, can create new terminal for problem
- [ ] Terminal binding stored and displayed

### 4. Send Instructions to Terminal
- [ ] In problem detail, can type instructions
- [ ] Instructions sent to the bound terminal

### 5. Session Management
- [ ] Session list with status indicators
- [ ] Session categorization (bug-fix, feature, etc.)
- [ ] Session resume with context restoration

### 6. Skills System
- [ ] Browse workspace skill library
- [ ] Save/bookmark skills
- [ ] Add skills to project
- [ ] View skill content inline

---\n`, 'utf-8');
    }
    send('tracker-mind-checklist', 'done', { content: fs_1.default.readFileSync(tmcPath, 'utf-8') });

    // -- agent/docs/ subdirectories --
    const docsDir = path_1.default.join(agentDir, 'docs');
    const templatesDir = path_1.default.join(agentDir, 'templates');
    const coreDir = path_1.default.join(agentDir, 'core');
    const contextDir = path_1.default.join(agentDir, 'context');

    send('docs-dir', 'creating');
    if (!fs_1.default.existsSync(docsDir)) fs_1.default.mkdirSync(docsDir, { recursive: true });
    send('docs-dir', 'done');

    send('page-context-guide', 'creating');
    const pageContextGuidePath = path_1.default.join(docsDir, 'PAGE_CONTEXT_GUIDE.md');
    if (!fs_1.default.existsSync(pageContextGuidePath)) {
      fs_1.default.writeFileSync(pageContextGuidePath, `# PAGE_CONTEXT_GUIDE.md

**Purpose:** Format specification for PAGE_CONTEXT.md.

## Structure

Each page entry in PAGE_CONTEXT.md follows this structure:

## Page: [Page Name]

### Identity
- **Route:** \`/[route]\`
- **File:** \`src/pages/[file].tsx\`

### Component Tree
\\\`\\\`
ComponentTree
\\\`\\\`

### IPC Endpoints Called
| Channel | Direction | Purpose |

### Data Flow
- **Reads:**
- **Writes:**

### Update Conventions

### Known Pitfalls

---

## Maintenance

- Run \`node scripts/update-page-context.js\` after adding/moving pages
- Keep IPC endpoint tables in sync with preload.ts changes
- Update component trees when refactoring

---
*Auto-generated by Tracker Mind — ${today}*
`, 'utf-8');
    }
    send('page-context-guide', 'done', { content: fs_1.default.readFileSync(pageContextGuidePath, 'utf-8') });

    send('templates-dir', 'creating');
    if (!fs_1.default.existsSync(templatesDir)) fs_1.default.mkdirSync(templatesDir, { recursive: true });
    const templateQmdPath = path_1.default.join(templatesDir, 'template.qmd');
    if (!fs_1.default.existsSync(templateQmdPath)) {
      fs_1.default.writeFileSync(templateQmdPath, `---
title: "Template"
format: html
---
# Template

Reusable template for agent-generated content.

## Purpose

Describe the purpose of this template.

## Usage

Fill in the sections below:
- **Section 1:** Description
- **Section 2:** Description

---
*Auto-generated by Tracker Mind — ${today}*
`, 'utf-8');
    }
    send('templates-dir', 'done');

    send('core-dir', 'creating');
    if (!fs_1.default.existsSync(coreDir)) fs_1.default.mkdirSync(coreDir, { recursive: true });
    const coreReadmePath = path_1.default.join(coreDir, 'README.md');
    if (!fs_1.default.existsSync(coreReadmePath)) {
      fs_1.default.writeFileSync(coreReadmePath, `# Core

**Purpose:** Core configuration and system files for agent workspace.

This directory stores core system configurations, schemas, and essential agent metadata.

---
*Auto-generated by Tracker Mind — ${today}*
`, 'utf-8');
    }
    send('core-dir', 'done');

    send('context-dir', 'creating');
    if (!fs_1.default.existsSync(contextDir)) fs_1.default.mkdirSync(contextDir, { recursive: true });
    const deepMemoryPath = path_1.default.join(contextDir, 'deep-memory.json');
    if (!fs_1.default.existsSync(deepMemoryPath)) {
      fs_1.default.writeFileSync(deepMemoryPath, JSON.stringify({ sessions: [], patterns: [] }, null, 2), 'utf-8');
    }
    const sessionSummariesPath = path_1.default.join(contextDir, 'session-summaries.json');
    if (!fs_1.default.existsSync(sessionSummariesPath)) {
      fs_1.default.writeFileSync(sessionSummariesPath, JSON.stringify({ summaries: [] }, null, 2), 'utf-8');
    }
    send('context-dir', 'done');

    // Step 14: skills directory (moved after new config files)
    send('skills-dir', 'creating');

    // Step 15: Skill templates
    send('skill-templates', 'creating');
    const defaultSkillPath = path_1.default.join(skillsDir, 'fix-problems.md');
    let skillContent = '';
    if (!fs_1.default.existsSync(defaultSkillPath)) {
      skillContent = `# Fix Problems

## Purpose
Systematically analyze and fix issues in the codebase.

## Workflow
1. Read PROBLEMS.md to see all issues
2. Prioritize by P1 > P2 > P3 > P4 > P5
3. For each issue:
   - Understand the problem
   - Identify root cause
   - Implement fix
   - Update PROBLEMS.md with status change
4. Report progress

## Guidelines
- Make surgical changes
- Always run build after changes
- Update state.md after every change
- Test before marking as fixed
`;
      fs_1.default.writeFileSync(defaultSkillPath, skillContent, 'utf-8');
    } else {
      skillContent = fs_1.default.readFileSync(defaultSkillPath, 'utf-8');
    }
    send('skill-templates', 'done', { content: skillContent });

    // -- Skill subdirectories --
    const skillSubDirs = [
      'agent-reflect', 'commit', 'deep-research', 'deep-research-prompt',
      'design-taste', 'fix-problems', 'frontend-design', 'generate-problem',
      'generate-prompt', 'google-stitch', 'impeccable', 'maintain-context',
      'readme-generator', 'recursive-playwright', 'sqlite-js-migration',
      'taste-skill', 'terminal-agent', 'ui-ux-pro-max',
    ];
    for (const sub of skillSubDirs) {
      const stepId = `skill-${sub}`;
      send(stepId, 'creating');
      const subDir = path_1.default.join(skillsDir, sub);
      if (!fs_1.default.existsSync(subDir)) {
        fs_1.default.mkdirSync(subDir, { recursive: true });
      }
      const skillMdPath = path_1.default.join(subDir, 'SKILL.md');
      if (!fs_1.default.existsSync(skillMdPath)) {
        const skillLabel = sub.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        fs_1.default.writeFileSync(skillMdPath, `# ${skillLabel}

## Purpose
Scaffold skill — content will be populated by maintain-context workflow.

## When to Use
Use when working on tasks related to ${skillLabel.toLowerCase()}.

## Usage
Load this skill via the skill system when appropriate.

---
*Auto-generated by Tracker Mind — ${today}*
`, 'utf-8');
      }
      send(stepId, 'done');
    }

    // -- graphify-out directory --
    send('graphify-dir', 'creating');
    if (!fs_1.default.existsSync(graphifyDir)) {
      fs_1.default.mkdirSync(graphifyDir, { recursive: true });
    }
    const graphReportPath = path_1.default.join(graphifyDir, 'GRAPH_REPORT.md');
    if (!fs_1.default.existsSync(graphReportPath)) {
      fs_1.default.writeFileSync(graphReportPath, `# Graphify Report

**Purpose:** Code architecture visualization generated by graphify.

## Overview

No graph report generated yet. Run \`python agent/skills/maintain-context/graphify_maintain.py build\` to generate.

---
*Auto-generated by Tracker Mind — ${today}*
`, 'utf-8');
    }
    const graphJsonPath = path_1.default.join(graphifyDir, 'graph.json');
    if (!fs_1.default.existsSync(graphJsonPath)) {
      fs_1.default.writeFileSync(graphJsonPath, JSON.stringify({ nodes: [], edges: [], communities: [] }, null, 2), 'utf-8');
    }
    send('graphify-dir', 'done');

    // -- automations/ directory --
    const automationsDir = path_1.default.join(agentDir, 'automations');
    send('automations-dir', 'creating');
    if (!fs_1.default.existsSync(automationsDir)) {
      fs_1.default.mkdirSync(automationsDir, { recursive: true });
    }
    const automationsJsonPath = path_1.default.join(automationsDir, 'automations.json');
    if (!fs_1.default.existsSync(automationsJsonPath)) {
      fs_1.default.writeFileSync(automationsJsonPath, JSON.stringify({ automations: [] }, null, 2), 'utf-8');
    }
    send('automations-dir', 'done');

    // -- design-references/ directory --
    const designRefsDir = path_1.default.join(agentDir, 'design-references');
    send('design-refs-dir', 'creating');
    if (!fs_1.default.existsSync(designRefsDir)) {
      fs_1.default.mkdirSync(designRefsDir, { recursive: true });
    }
    send('design-refs-dir', 'done');

    const allFiles = fs_1.default.readdirSync(agentDir).filter(f => f.endsWith('.md') || f.endsWith('.json'));
    event.sender.send(INIT_PROGRESS_CHANNEL, { type: 'complete', stats: { total: steps.length, created: allFiles.length } });
    return { success: true, projectPath: baseDir, files: allFiles };
  } catch (error: any) {
    console.error('[Tracker Mind] init-all streaming error:', error);
    event.sender.send(INIT_PROGRESS_CHANNEL, { type: 'error', error: error.message });
    return { success: false, error: error.message };
  }
}

// TODO: tracker-mind-generate — handler for generating content via tracker mind (e.g., prompts, summaries)
// TODO: Tracker Mind Setup Handler
electron_1.ipcMain.handle('tracker-mind-setup', async (event, { step, projectId, agentName }: { step: string; projectId?: string; agentName?: string }) => {
  try {
let baseDir = process.cwd();
    if (projectId) {
      try {
        const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
        if (project?.path) baseDir = project.path;
        else {
          console.error('[Tracker Mind] Project exists but has no path. Using cwd:', baseDir);
        }
      } catch (e) {
        console.error('[Tracker Mind] Failed to get project path for setup:', e);
      }
    }
    const agentDir = path_1.default.join(baseDir, 'agent');
    const agent = agentName || 'claude';

    if (step === 'init-all') {
      return await runInitAll(baseDir, agent, projectId, event);
    }

    switch (step) {
      case 'init-agent-dir':
        if (!fs_1.default.existsSync(agentDir)) {
          fs_1.default.mkdirSync(agentDir, { recursive: true });
          console.log('[Tracker Mind] Created agent directory:', agentDir);
        }
        const skillsDir = path_1.default.join(agentDir, 'skills');
        if (!fs_1.default.existsSync(skillsDir)) {
          fs_1.default.mkdirSync(skillsDir, { recursive: true });
          console.log('[Tracker Mind] Created skills directory:', skillsDir);
        }
        return { success: true };

      case 'init-agents-md': {
        const mdFiles = fs_1.default.readdirSync(agentDir)
          .filter(f => f.endsWith('.md') && f !== 'AGENTS.md')
          .sort();
        const sDir = path_1.default.join(agentDir, 'skills');
        const skillsMdFiles = fs_1.default.existsSync(sDir)
          ? fs_1.default.readdirSync(sDir).filter(f => f.endsWith('.md')).sort()
          : [];
        const allFiles = [
          ...mdFiles.map(f => `- \`agent/${f}\``),
          ...skillsMdFiles.map(f => `- \`agent/skills/${f}\``),
        ].join('\n');

        const agentsPath = path_1.default.join(agentDir, 'AGENTS.md');
        const agentsContent = `# 🤖 AI Agent Workspace

> **Auto-generated by Tracker Mind** — ${new Date().toISOString()}
> **Target Agent:** ${agent}

## Workspace Context

This directory contains the context files for AI agents working on this project.

## Agent Files

${allFiles || '- No markdown files yet'}

## Initialization Instructions

1. Read each file listed above for project context
2. Check \`INITIALIZE.md\` for setup instructions
3. Review \`PROBLEMS.md\` for known issues
4. Check \`REQUESTS.md\` for pending requests
5. Update files as needed during work

## Session Metadata Requirements

This project requires structured session metadata from AI agents.

At the **start of each session** (or when switching tasks), output:

\`\`\`
## Session Metadata
- Title: Short descriptive title of what this session is working on
- Description: 1-2 sentences explaining the goal and scope
- Status: active | paused | completed
- Product Area: Which part of the application this targets (e.g., Dashboard, Settings, Terminal, Database, External Page, IDE Page, etc.)
- Category: bug-fix | feature | refactor | research | review
\`\`\`

If you don't provide this metadata, the system will auto-analyze your messages to infer it. Providing it explicitly is more accurate.

## Recent Activity Tracking

Changes to problems, requests, steps, and sessions are logged in the **activity_log** table with who made the change, what changed, and when.

When a user completes a step or changes a request status, you'll see it reflected here. Check the activity_log to understand what's happened recently.

You can also signal important activity by including an \`## Actions\` block in your response:

\`\`\`
## Actions
- [create-problem] Problem Title - priority: high - category: bug-fix - description: What's broken
- [update-problem] ProblemID - status: In Progress
- [complete-checklist] checklist-item-id
\`\`\`

These actions will be automatically executed to keep the project board in sync.
---
`;
        fs_1.default.writeFileSync(agentsPath, agentsContent, 'utf-8');
        return { success: true };
      }

      case 'init-initialize-md': {
        const initPath = path_1.default.join(agentDir, 'INITIALIZE.md');
        const initContent = `# 🚀 Workspace Initialization Guide

> **Generated for:** ${agent}
> **Date:** ${new Date().toISOString()}

## Overview

This file guides the AI agent through workspace initialization. Follow these steps in order.

## Step 1: Read AGENTS.md

Read \`AGENTS.md\` to understand the workspace structure and available files.

## Step 2: Agent Session Setup

${agent === 'opencode' ? `Run: \`opencode --init\` in the project root to initialize.` : `Run: \`${agent}\` and use its built-in init command.`}

## Step 3: Review Project State

- \`state.md\` — Current project state and recent changes
- \`PROBLEMS.md\` — Known issues to fix
- \`REQUESTS.md\` — User feature requests

## Step 3a: Read Page Context

Read \`PAGE_CONTEXT.md\` (+ \`docs/PAGE_CONTEXT_GUIDE.md\` for format reference) to understand the full UI layout before editing any page code.

## Step 4: Skills Setup

Browse the \`skills/\` directory and load relevant skills for your tasks.

## Step 5: Begin Work

---
*This file is managed by Tracker Mind.*
`;
        fs_1.default.writeFileSync(initPath, initContent, 'utf-8');
        return { success: true };
      }

      case 'init-problems-md': {
        const problemsPath = path_1.default.join(agentDir, 'PROBLEMS.md');
        if (!fs_1.default.existsSync(problemsPath)) {
          try {
            const ps = new ProblemsService(baseDir, projectId);
            const existing = ps.getProblems();
            if (existing.length > 0) {
              console.log('[Tracker Mind] PROBLEMS.md auto-created by ProblemsService');
            } else {
              const initialContent = `# PROBLEMS.md\n\n> **Purpose:** Issue tracker for AI agents and humans.\n> **Last Updated:** ${new Date().toISOString().split('T')[0]}\n\n---\n\n<!-- No problems yet. -->\n`;
              fs_1.default.writeFileSync(problemsPath, initialContent, 'utf-8');
            }
          } catch (e) {
            console.error('[Tracker Mind] Failed to init PROBLEMS.md:', e);
          }
        }
        return { success: true };
      }
      
      case 'init-requests-md': {
        const requestsPath = path_1.default.join(agentDir, 'REQUESTS.md');
        if (!fs_1.default.existsSync(requestsPath)) {
          try {
            const rs = new RequestsService(baseDir);
            const existing = rs.getRequests();
            if (existing.length > 0) {
              console.log('[Tracker Mind] REQUESTS.md auto-created by RequestsService');
            } else {
              const initialContent = `# 📋 User Requests Log\n\n> **Purpose:** Track all user requests.\n> **Last Updated:** ${new Date().toISOString()}\n\n---\n\n<!-- No requests yet. -->\n`;
              fs_1.default.writeFileSync(requestsPath, initialContent, 'utf-8');
            }
          } catch (e) {
            console.error('[Tracker Mind] Failed to init REQUESTS.md:', e);
          }
        }
        return { success: true };
      }

      case 'init-json-export': {
        try {
          const ps = new ProblemsService(baseDir, projectId);
          const problems = ps.getProblems();
          console.log('[Tracker Mind] ProblemsService has', problems.length, 'problems');
        } catch (e) {
          console.error('[Tracker Mind] Failed to export problems:', e);
        }

        try {
          const rs = new RequestsService(baseDir);
          const requests = rs.getRequests();
          console.log('[Tracker Mind] RequestsService has', requests.length, 'requests');
        } catch (e) {
          console.error('[Tracker Mind] Failed to export requests:', e);
        }

        const sessionsJsonPath = path_1.default.join(agentDir, 'terminal-sessions.json');
        try {
          const sessions = db ? db.prepare('SELECT * FROM terminal_sessions ORDER BY created_at DESC').all() : [];
          fs_1.default.writeFileSync(sessionsJsonPath, JSON.stringify(sessions, null, 2), 'utf-8');
          console.log('[Tracker Mind] Exported', (sessions as any[]).length, 'sessions to terminal-sessions.json');
        } catch (e) {
          console.error('[Tracker Mind] Failed to export sessions JSON:', e);
        }
        return { success: true };
      }

      case 'init-state-md': {
        const statePath = path_1.default.join(agentDir, 'state.md');
        if (!fs_1.default.existsSync(statePath)) {
          const initialContent = `# 📌 Project State

**Purpose:** Current status, known issues, and recent changes for Tracker Mind.

**Version:** 1.0
**Target Agent:** ${agent}
**Last Updated:** ${new Date().toISOString()}

## Recent Changes

### ${new Date().toISOString().split('T')[0]} — Initial Setup

- Initialized Tracker Mind structure
- Created agent/ directory
- Created AGENTS.md, INITIALIZE.md, PROBLEMS.md, REQUESTS.md
- Exported JSON data files

---
`;
          fs_1.default.writeFileSync(statePath, initialContent, 'utf-8');
          console.log('[Tracker Mind] Created state.md:', statePath);
        }
        return { success: true };
      }
      
      case 'init-skills': {
        const sDir = path_1.default.join(agentDir, 'skills');
        if (!fs_1.default.existsSync(sDir)) fs_1.default.mkdirSync(sDir, { recursive: true });
        const defaultSkillPath = path_1.default.join(sDir, 'fix-problems.md');
        if (!fs_1.default.existsSync(defaultSkillPath)) {
          const skillContent = `# Fix Problems

## Purpose
Systematically analyze and fix issues in the codebase.

## Workflow
1. Read PROBLEMS.md to see all issues
2. Prioritize by P1 > P2 > P3 > P4 > P5
3. For each issue:
   - Understand the problem
   - Identify root cause
   - Implement fix
   - Update PROBLEMS.md with status change
4. Report progress

## Guidelines
- Make surgical changes
- Always run build after changes
- Update state.md after every change
- Test before marking as fixed
`;
          fs_1.default.writeFileSync(defaultSkillPath, skillContent, 'utf-8');
          console.log('[Tracker Mind] Created fix-problems.md skill:', defaultSkillPath);
        }
        return { success: true };
      }
      
      default:
        return { success: false, error: 'Unknown step: ' + step };
    }
  } catch (error: any) {
    console.error('[Tracker Mind] setup error:', error);
    return { success: false, error: error.message };
  }
});

electron_1.ipcMain.handle('register-terminal', async (event, data: {
  terminalId: string;
  projectId?: string;
  agentType?: string;
  status?: string;
  }) => {
  try {
    if (!db) return { success: false, error: 'Database not ready' };
    
    db.run(
      `INSERT OR REPLACE INTO terminal_bindings 
       (terminal_id, project_id, agent_type, status, last_activity_at, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        data.terminalId,
        data.projectId || null,
        data.agentType || null,
        data.status || 'idle',
        new Date().toISOString(),
        new Date().toISOString()
      ]
    );
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

electron_1.ipcMain.handle('update-terminal-binding', async (event, data: {
  terminalId: string;
  updates: {
    status?: string;
    active_problem_id?: string;
    active_request_id?: string;
    session_context?: string;
    agent_type?: string;
  };
}) => {
  try {
    if (!db) return { success: false, error: 'Database not ready' };
    const setClause = Object.keys(data.updates)
      .map((k: string) => `${k} = ?`)
      .join(', ');
    const values: any[] = [...Object.values(data.updates), new Date().toISOString(), data.terminalId];
    
    await db.run(
      `UPDATE terminal_bindings SET ${setClause}, last_activity_at = ? WHERE terminal_id = ?`,
      values
    );
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Agent Files Reader - Read files from project's agent/ directory
electron_1.ipcMain.handle('read-agent-files', async (_, projectPath: string) => {
  try {
    const agentDir = path_1.default.join(projectPath, 'agent');
    if (!fs_1.default.existsSync(agentDir)) {
      return { success: true, data: [] };
    }
    
    const files: { name: string; path: string; isDirectory: boolean }[] = [];
    
    const readDir = (dir: string, basePath: string = '') => {
      const entries = fs_1.default.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue; // Skip hidden files
        const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
        files.push({
          name: entry.name,
          path: relativePath,
          isDirectory: entry.isDirectory()
        });
        if (entry.isDirectory()) {
          readDir(path_1.default.join(dir, entry.name), relativePath);
        }
      }
    };
    
    readDir(agentDir);
    return { success: true, data: files };
  } catch (error: any) {
    console.error('[DeskFlow] read-agent-files error:', error);
    return { success: false, error: error.message };
  }
});

electron_1.ipcMain.handle('read-agent-file', async (_, filePath: string, projectPath: string) => {
  try {
    const agentDir = path_1.default.join(projectPath, 'agent');
    if (!isPathWithin(agentDir, filePath)) {
      return { success: false, error: 'Path traversal denied' };
    }
    const fullPath = path_1.default.join(agentDir, filePath);
    if (!fs_1.default.existsSync(fullPath)) {
      return { success: false, error: 'File not found: ' + fullPath };
    }
    
    const content = fs_1.default.readFileSync(fullPath, 'utf-8');
    return { success: true, data: content };
  } catch (error: any) {
    console.error('[DeskFlow] read-agent-file error:', error);
    return { success: false, error: error.message };
  }
});

// General project file reader (read any file relative to project root)
electron_1.ipcMain.handle('read-project-file', async (_, relativePath: string, projectPath?: string) => {
  try {
    if (!projectPath) return { success: false, error: 'No project path provided' };
    if (!isPathWithin(projectPath, relativePath)) {
      return { success: false, error: 'Path traversal denied' };
    }
    const fullPath = path_1.default.join(projectPath, relativePath);
    if (!fs_1.default.existsSync(fullPath)) {
      return { success: false, error: 'File not found: ' + fullPath };
    }
    const content = fs_1.default.readFileSync(fullPath, 'utf-8');
    return { success: true, data: content };
  } catch (error: any) {
    console.error('[DeskFlow] read-project-file error:', error);
    return { success: false, error: error.message };
  }
});

// List project files in a subdirectory relative to project root
electron_1.ipcMain.handle('write-project-file', async (_, relativePath: string, content: string, projectPath?: string) => {
  try {
    if (!projectPath) return { success: false, error: 'No project path provided' };
    if (!isPathWithin(projectPath, relativePath)) {
      return { success: false, error: 'Path traversal denied' };
    }
    const fullPath = path_1.default.join(projectPath, relativePath);
    const dir = path_1.default.dirname(fullPath);
    if (!fs_1.default.existsSync(dir)) {
      fs_1.default.mkdirSync(dir, { recursive: true });
    }
    fs_1.default.writeFileSync(fullPath, content, 'utf-8');
    return { success: true };
  } catch (error: any) {
    console.error('[DeskFlow] write-project-file error:', error);
    return { success: false, error: error.message };
  }
});

electron_1.ipcMain.handle('list-project-files', async (_, subDir?: string, projectPath?: string) => {
  try {
    if (!projectPath) return { success: false, error: 'No project path provided' };
    if (subDir && !isPathWithin(projectPath, subDir)) {
      return { success: false, error: 'Path traversal denied', data: [] };
    }
    const targetPath = subDir ? path_1.default.join(projectPath, subDir) : projectPath;
    if (!fs_1.default.existsSync(targetPath)) {
      return { success: false, error: 'Directory not found: ' + targetPath, data: [] };
    }
    const entries = fs_1.default.readdirSync(targetPath, { withFileTypes: true });
    const files = entries.map(entry => ({
      name: entry.name,
      path: subDir ? path_1.default.join(subDir, entry.name) : entry.name,
      isDirectory: entry.isDirectory(),
    }));
    return { success: true, data: files };
  } catch (error: any) {
    console.error('[DeskFlow] list-project-files error:', error);
    return { success: false, error: error.message, data: [] };
  }
});

// List directory entries (for ContextService — returns names only)
electron_1.ipcMain.handle('list-directory', async (_, { projectPath, relativePath }: { projectPath: string; relativePath: string }) => {
  try {
    if (!projectPath) return { success: false, error: 'No project path provided', data: [] };
    if (!isPathWithin(projectPath, relativePath)) {
      return { success: false, error: 'Path traversal denied', data: [] };
    }
    const fullPath = path_1.default.join(projectPath, relativePath);
    if (!fs_1.default.existsSync(fullPath)) return { success: true, data: [] };
    const entries = fs_1.default.readdirSync(fullPath, { withFileTypes: true });
    const names = entries.map(e => e.name);
    return { success: true, data: names };
  } catch (error: any) {
    console.error('[DeskFlow] list-directory error:', error);
    return { success: false, error: error.message, data: [] };
  }
});

// Update state from AI agent output
electron_1.ipcMain.handle('update-state-from-agent', async (_, data: {
  projectPath: string;
  updates: {
    problemId?: string;
    newStatus?: string;
    newRequest?: {
      title: string;
      description?: string;
      priority?: string;
    };
    stateEntry?: string;
  };
}) => {
  try {
    const agentDir = path_1.default.join(data.projectPath, 'agent');
    
    // Update problem status in PROBLEMS.md
    if (data.updates.problemId && data.updates.newStatus) {
      const problemsPath = path_1.default.join(agentDir, 'PROBLEMS.md');
      if (fs_1.default.existsSync(problemsPath)) {
        let content = fs_1.default.readFileSync(problemsPath, 'utf-8');
        // Find and replace status
        const statusPattern = new RegExp(`(\\*\\*Issue ${data.updates.problemId}:\\*\\*.*?\\n.*?\\*\\*Status:\\*\\*\\s*).+?(?=\\n)`, 'i');
        content = content.replace(statusPattern, `$1${data.updates.newStatus}`);
        fs_1.default.writeFileSync(problemsPath, content, 'utf-8');
      }
    }
    
    // Add new request to REQUESTS.md
    if (data.updates.newRequest) {
      const requestsPath = path_1.default.join(agentDir, 'REQUESTS.md');
      let content = fs_1.default.existsSync(requestsPath) 
        ? fs_1.default.readFileSync(requestsPath, 'utf-8')
        : '# 📋 User Requests Log\n\n> Auto-generated by Tracker Mind\n\n---\n\n';
      
      const requestNum = (content.match(/### Request #(\d+)/g) || []).length + 1;
      const newRequest = `### Request #${requestNum} - ${data.updates.newRequest.title}\n\n`;
      const newRequestBody = `**Status:** Pending\n`;
      const newRequestDesc = data.updates.newRequest.description 
        ? `\n**Request:** \n${data.updates.newRequest.description}\n` 
        : '\n**Request:** (from AI agent)\n';
      
      const requestEntry = newRequest + newRequestBody + newRequestDesc + '---\n\n';
      content += requestEntry;
      fs_1.default.writeFileSync(requestsPath, content, 'utf-8');
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('[DeskFlow] update-state-from-agent error:', error);
    return { success: false, error: error.message };
  }
});

electron_1.ipcMain.handle('read-progress-json', async (_, { projectPath }: { projectPath?: string }) => {
  try {
    if (!projectPath) return { success: false, error: 'No project path provided' };
    const progressPath = path_1.default.join(projectPath, 'agent', 'progress.json');
    if (!fs_1.default.existsSync(progressPath)) {
      return { success: true, data: null };
    }
    const content = fs_1.default.readFileSync(progressPath, 'utf-8');
    return { success: true, data: JSON.parse(content) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

electron_1.ipcMain.handle('write-progress-json', async (_, { projectPath, data }: { projectPath?: string; data: any }) => {
  try {
    if (!projectPath) return { success: false, error: 'No project path provided' };
    const progressPath = path_1.default.join(projectPath, 'agent', 'progress.json');
    fs_1.default.writeFileSync(progressPath, JSON.stringify(data, null, 2), 'utf-8');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

electron_1.ipcMain.handle('read-agent-file-content', async (_, { filename, projectPath }: { filename: string; projectPath?: string }) => {
  try {
    if (!projectPath) return { success: false, error: 'No project path provided' };
    const agentDir = path_1.default.join(projectPath, 'agent');
    if (!isPathWithin(agentDir, filename)) {
      return { success: false, error: 'Path traversal denied' };
    }
    const filePath = path_1.default.join(agentDir, filename);
    if (!fs_1.default.existsSync(filePath)) {
      return { success: false, error: 'File not found: ' + filePath };
    }
    const content = fs_1.default.readFileSync(filePath, 'utf-8');
    return { success: true, data: content };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

electron_1.ipcMain.handle('list-agent-dir-files', async (_, { projectPath }: { projectPath?: string }) => {
  try {
    if (!projectPath) return { success: false, error: 'No project path provided', data: [] };
    const agentDir = path_1.default.join(projectPath, 'agent');
    if (!fs_1.default.existsSync(agentDir)) {
      return { success: true, data: [] };
    }
    const entries = fs_1.default.readdirSync(agentDir, { withFileTypes: true });
    const files = entries
      .filter(e => !e.isDirectory())
      .map(e => ({ name: e.name, path: path_1.default.join('agent', e.name) }));
    return { success: true, data: files };
  } catch (error: any) {
    return { success: false, error: error.message, data: [] };
  }
});

electron_1.ipcMain.handle('save-base-system-prompt', async (_, { agent, prompt }: { agent: string; prompt: string }) => {
  try {
    if (!userPreferences.systemPrompts) userPreferences.systemPrompts = {};
    (userPreferences.systemPrompts as Record<string, string>)[agent] = prompt;
    savePreferences();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

electron_1.ipcMain.handle('get-base-system-prompt', async (_, agent: string) => {
  try {
    const prompts = (userPreferences?.systemPrompts || {}) as Record<string, string>;
    const prompt = prompts[agent] || prompts['claude'] || '';
    return { success: true, data: prompt };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// ── AI Task Status IPC ──
electron_1.ipcMain.handle('get-prompt-status', async (_event, terminalId?: string) => {
  if (!db) return { success: false, data: [] };
  try {
    // Auto-settle stale in_progress records
    db.prepare(`UPDATE terminal_messages SET status = 'completed' WHERE status = 'in_progress' AND created_at < datetime('now', '-15 minutes')`).run();
    let query = `SELECT id, session_id, status, role, content, created_at FROM terminal_messages WHERE role = 'user'`;
    const params: any[] = [];
    if (terminalId) {
      query += ` AND session_id = ?`;
      params.push(terminalId);
    }
    query += ` ORDER BY created_at DESC LIMIT 100`;
    const rows = db.prepare(query).all(...params);
    return { success: true, data: rows };
  } catch (err: any) {
    return { success: false, error: err.message, data: [] };
  }
});

// ── AI Task File Watcher (agent/ai-tasks.json) ──
const aiTaskWatchers = new Map<string, { watcher: any; debounce: any }>();

electron_1.ipcMain.handle('ai-task:watch', async (_event, projectPath: string) => {
  try {
    // Stop existing watcher for this path
    const existing = aiTaskWatchers.get(projectPath);
    if (existing) {
      try { existing.watcher.close(); } catch {}
      clearTimeout(existing.debounce);
    }

    const tasksPath = path_1.default.join(projectPath, 'agent', 'ai-tasks.json');
    if (!fs_1.default.existsSync(path_1.default.dirname(tasksPath))) {
      return { success: false, error: 'agent directory does not exist' };
    }

    // Ensure file exists
    if (!fs_1.default.existsSync(tasksPath)) {
      fs_1.default.writeFileSync(tasksPath, JSON.stringify({ tasks: [] }), 'utf-8');
    }

    const watcher = fs_1.default.watch(tasksPath, (eventType: string) => {
      if (eventType !== 'change') return;
      const existing2 = aiTaskWatchers.get(projectPath);
      if (existing2) clearTimeout(existing2.debounce);
      const debounce = setTimeout(() => {
        try {
          const content = fs_1.default.readFileSync(tasksPath, 'utf-8');
          const data = JSON.parse(content);
          const { BrowserWindow } = require('electron');
          const windows = BrowserWindow.getAllWindows();
          for (const win of windows) {
            if (!win.isDestroyed()) {
              win.webContents.send('ai-task:file-changed', { tasks: data.tasks || [] });
            }
          }
        } catch {}
      }, 500);
      aiTaskWatchers.set(projectPath, { watcher, debounce });
    });

    aiTaskWatchers.set(projectPath, { watcher, debounce: null });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

electron_1.ipcMain.handle('ai-task:stop-watch', async (_event, projectPath: string) => {
  const existing = aiTaskWatchers.get(projectPath);
  if (existing) {
    try { existing.watcher.close(); } catch {}
    clearTimeout(existing.debounce);
    aiTaskWatchers.delete(projectPath);
  }
  return { success: true };
});

electron_1.ipcMain.handle('ai-task:add', async (_event, task: { terminalId: string; prompt: string; agent: string; sessionId?: string; projectPath?: string }) => {
  try {
    if (!task.projectPath) return { success: false, error: 'No project path provided' };
    const agentDir = path_1.default.join(task.projectPath, 'agent');
    const tasksPath = path_1.default.join(agentDir, 'ai-tasks.json');
    
    if (!fs_1.default.existsSync(agentDir)) {
      fs_1.default.mkdirSync(agentDir, { recursive: true });
    }
    let tasks: any[] = [];
    if (fs_1.default.existsSync(tasksPath)) {
      try {
        const content = fs_1.default.readFileSync(tasksPath, 'utf-8');
        const parsed = JSON.parse(content);
        tasks = parsed.tasks || [];
      } catch {}
    }

    const newTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      prompt: task.prompt,
      status: 'pending',
      terminal_id: task.terminalId,
      agent: task.agent,
      session_id: task.sessionId || null,
      created_at: new Date().toISOString(),
      completed_at: null,
      result: null,
    };
    tasks.unshift(newTask);
    
    // Keep max 500 tasks
    if (tasks.length > 500) tasks = tasks.slice(0, 500);
    
    fs_1.default.writeFileSync(tasksPath, JSON.stringify({ tasks }, null, 2), 'utf-8');
    
    // Also notify via PTY tracking
    const { BrowserWindow } = require('electron');
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('ai-task:updated', { terminalId: task.terminalId, status: 'pending', messageId: newTask.id });
      }
    }
    
    return { success: true, task: newTask };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

electron_1.ipcMain.handle('unregister-terminal', async (event, terminalId: string) => {
  try {
    if (!db) return { success: false, error: 'Database not ready' };
    
    // Clear the binding but don't delete (keep history)
    await db.run(
      `UPDATE terminal_bindings SET status = 'closed', last_activity_at = ? WHERE terminal_id = ?`,
      [new Date().toISOString(), terminalId]
    );
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// ── Cross-Session Sync IPC Handlers ─────────────────────────────

electron_1.ipcMain.handle('lock-file', async (_event, filePath: string, terminalId: string, sessionId: string | null, action?: string) => {
  const result = acquireLock(filePath, terminalId, sessionId, action);
  return result;
});

electron_1.ipcMain.handle('release-file-lock', async (_event, filePath: string, terminalId: string) => {
  const released = releaseLock(filePath, terminalId);
  return { success: released };
});

electron_1.ipcMain.handle('get-file-locks', async () => {
  return getAllLocks();
});

electron_1.ipcMain.handle('get-locks-for-terminal', async (_event, terminalId: string) => {
  return getAllLocks().filter(l => l.terminalId === terminalId);
});

electron_1.ipcMain.handle('get-touched-files', async (_event, opts?: { terminalId?: string; filePath?: string; limit?: number }) => {
  if (!db) return { success: false, data: [], error: 'Database not ready' };
  try {
    let query = 'SELECT * FROM touched_files';
    const params: any[] = [];
    const conditions: string[] = [];
    if (opts?.terminalId) { conditions.push('terminal_id = ?'); params.push(opts.terminalId); }
    if (opts?.filePath) { conditions.push('file_path = ?'); params.push(opts.filePath); }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY timestamp DESC';
    if (opts?.limit) query += ' LIMIT ?', params.push(opts.limit);
    const data = db.prepare(query).all(...params);
    return { success: true, data };
  } catch (error: any) {
    return { success: false, data: [], error: error.message };
  }
});

electron_1.ipcMain.handle('compile-sync-summary', async (_event, terminalId: string) => {
  if (!db) return { success: false, summary: 'Database not ready', error: 'Database not ready' };
  try {
    const lines: string[] = [];
    const requesterBinding = db.prepare('SELECT session_id FROM terminal_bindings WHERE terminal_id = ?').get(terminalId) as any;
    const requesterSessionId = requesterBinding?.session_id || null;
    const otherBindings = db.prepare('SELECT * FROM terminal_bindings WHERE terminal_id != ? AND status != ?').all(terminalId, 'closed') as any[];
    
    if (otherBindings.length === 0) {
      return { success: true, summary: 'No other active sessions. You are the only agent working.' };
    }

    lines.push(`## Cross-Session Sync Summary\n`);
    lines.push(`Other active sessions: ${otherBindings.length}\n`);

    for (const binding of otherBindings) {
      const tid = binding.terminal_id;
      const sessionId = binding.session_id;
      lines.push(`### Terminal: ${tid}${sessionId ? ` (Session: ${sessionId})` : ''}`);
      
      if (binding.active_problem_id) {
        const problem = db.prepare('SELECT title, description FROM problems WHERE id = ?').get(binding.active_problem_id) as any;
        if (problem) lines.push(`  Active Problem: ${problem.title} — ${problem.description || 'no description'}`);
      }
      
      if (binding.session_context) {
        try {
          const ctx = JSON.parse(binding.session_context);
          if (ctx.requests?.length) lines.push(`  Requests: ${ctx.requests.join(', ')}`);
          if (ctx.problems?.length) lines.push(`  Problems referenced: ${ctx.problems.join(', ')}`);
        } catch {}
      }
    }

    // Recent file changes by other terminals
    const recentChanges = db.prepare(`
      SELECT DISTINCT file_path, terminal_id, MAX(timestamp) as last_touched
      FROM touched_files
      WHERE terminal_id != ?
      GROUP BY file_path ORDER BY last_touched DESC LIMIT 10
    `).all(terminalId) as any[];
    
    if (recentChanges.length) {
      lines.push(`\n### Files Recently Modified by Other Agents`);
      for (const f of recentChanges) {
        lines.push(`  ${f.file_path} (by ${f.terminal_id})`);
      }
    }

    // Locks held by other terminals
    const otherLocks = getAllLocks().filter(l => l.terminalId !== terminalId);
    if (otherLocks.length) {
      lines.push(`\n### Currently Locked Files (by others)`);
      for (const l of otherLocks) {
        lines.push(`  ${l.filePath} (locked by ${l.terminalId})`);
      }
    }

    return { success: true, summary: lines.join('\n') };
  } catch (error: any) {
    return { success: false, summary: '', error: error.message };
  }
});

electron_1.ipcMain.handle('broadcast-context-delta', async (_event, data: { terminalId: string; type: string; payload: any }) => {
  const windows = require('electron').BrowserWindow.getAllWindows();
  let sentCount = 0;
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send('context-changed', {
        type: data.type,
        action: 'broadcast',
        source: data.terminalId,
        payload: data.payload,
        timestamp: Date.now(),
      });
      sentCount++;
    }
  }
   return { success: true, sentCount };
   });

// ── Finance Page IPC Handlers ────────────────────────────────────

// In-memory lock state
let financeLocked = true;
let financePasswordHash: string | null = null;
let financePasswordSalt: string | null = null;
let financeRememberDevice = false;
let financeRememberDeviceExpiry: number | null = null;
let financeLockTimeout = 5 * 60 * 1000; // 5 minutes in milliseconds
let financeDisplayCurrency = 'USD';
const crypto = require('crypto');
const PASSWORD_HASH_OPTS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function loadFinanceSettings() {
  if (!db) return;
  try {
    const hashRow = db.prepare("SELECT value FROM finance_settings WHERE key = 'password_hash'").get() as any;
    const saltRow = db.prepare("SELECT value FROM finance_settings WHERE key = 'password_salt'").get() as any;
    const rememberDeviceRow = db.prepare("SELECT value FROM finance_settings WHERE key = 'remember_device'").get() as any;
    const rememberDeviceExpiryRow = db.prepare("SELECT value FROM finance_settings WHERE key = 'remember_device_expiry'").get() as any;
    const lockTimeoutRow = db.prepare("SELECT value FROM finance_settings WHERE key = 'lock_timeout'").get() as any;
    const displayCurrencyRow = db.prepare("SELECT value FROM finance_settings WHERE key = 'display_currency'").get() as any;
    
    if (hashRow && saltRow) {
      financePasswordHash = hashRow.value;
      financePasswordSalt = saltRow.value;
      financeLocked = true;
    } else {
      financePasswordHash = null;
      financePasswordSalt = null;
      financeLocked = false;
    }
    
    financeRememberDevice = rememberDeviceRow?.value === 'true';
    financeRememberDeviceExpiry = rememberDeviceExpiryRow?.value ? parseInt(rememberDeviceExpiryRow.value) : null;
    financeLockTimeout = lockTimeoutRow?.value ? parseInt(lockTimeoutRow.value) : 5 * 60 * 1000;
    financeDisplayCurrency = displayCurrencyRow?.value || 'USD';
    
    // Check if remember device has expired
    if (financeRememberDevice && financeRememberDeviceExpiry && Date.now() > financeRememberDeviceExpiry) {
      financeRememberDevice = false;
      financeRememberDeviceExpiry = null;
      financeLocked = true;
    } else if (financeRememberDevice && !financeLocked) {
      // If device is remembered and not locked, keep it unlocked
      financeLocked = false;
    }
  } catch { 
    financeRememberDevice = false;
    financeRememberDeviceExpiry = null;
    financeLockTimeout = 5 * 60 * 1000;
  }
}

function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64, PASSWORD_HASH_OPTS).toString('hex');
  return { hash, salt };
}

function verifyPassword(password: string): boolean {
  if (!financePasswordHash || !financePasswordSalt) return false;
  try {
    const hash = crypto.scryptSync(password, financePasswordSalt, 64, PASSWORD_HASH_OPTS).toString('hex');
    const stored = Buffer.from(financePasswordHash, 'hex');
    const computed = Buffer.from(hash, 'hex');
    if (stored.length !== computed.length) return false;
    return crypto.timingSafeEqual(stored, computed);
  } catch {
    return false;
  }
}

// ── Security ──
electron_1.ipcMain.handle('finance:check-password-setup', async () => {
  return { hasPassword: !!financePasswordHash };
});

electron_1.ipcMain.handle('finance:is-locked', async () => {
  // Check if remember device is active and not expired
  if (financeRememberDevice && financeRememberDeviceExpiry && Date.now() < financeRememberDeviceExpiry) {
    return { locked: false };
  }
  return { locked: financeLocked };
});

electron_1.ipcMain.handle('finance:lock', async () => {
  financeLocked = true;
  return { success: true };
});

electron_1.ipcMain.handle('finance:unlock', async (_event, password: string) => {
  if (verifyPassword(password)) {
    financeLocked = false;
    return { success: true };
  }
  return { success: false };
});

electron_1.ipcMain.handle('finance:verify-password', async (_event, password: string) => {
  return { success: verifyPassword(password) };
});

electron_1.ipcMain.handle('finance:set-password', async (_event, password: string) => {
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
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

electron_1.ipcMain.handle('finance:change-password', async (_event, currentPassword: string, nextPassword: string) => {
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

electron_1.ipcMain.handle('finance:set-remember-device', async (_event, remember: boolean, days: number) => {
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

electron_1.ipcMain.handle('finance:set-lock-timeout', async (_event, timeoutMs: number) => {
  if (!db) return { success: false };
  try {
    financeLockTimeout = timeoutMs;
    db.prepare("INSERT OR REPLACE INTO finance_settings (key, value) VALUES ('lock_timeout', ?)").run(String(timeoutMs));
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

electron_1.ipcMain.handle('finance:biometric-unlock', async () => {
  financeLocked = false;
  return { success: true };
});

electron_1.ipcMain.handle('finance:get-webauthn-credential', async () => {
  if (!db) return { credentialId: null };
  try {
    const row = db.prepare("SELECT value FROM finance_settings WHERE key = 'webauthn_credential_id'").get() as { value: string } | undefined;
    return { credentialId: row?.value || null };
  } catch {
    return { credentialId: null };
  }
});

electron_1.ipcMain.handle('finance:store-webauthn-credential', async (_event, credentialId: string) => {
  if (!db) return { success: false };
  try {
    db.prepare("INSERT OR REPLACE INTO finance_settings (key, value) VALUES ('webauthn_credential_id', ?)").run(credentialId);
    return { success: true };
  } catch {
    return { success: false };
  }
});

electron_1.ipcMain.handle('finance:get-display-currency', async () => {
  return { currency: financeDisplayCurrency };
});

electron_1.ipcMain.handle('finance:set-display-currency', async (_event, currency: string) => {
  if (!db) return { success: false };
  try {
    db.prepare("INSERT OR REPLACE INTO finance_settings (key, value) VALUES ('display_currency', ?)").run(currency);
    financeDisplayCurrency = currency;
    return { success: true };
  } catch {
    return { success: false };
  }
});

electron_1.ipcMain.handle('finance:get-security-settings', async () => {
  return {
    hasPassword: !!financePasswordHash,
    locked: financeLocked,
    rememberDevice: financeRememberDevice,
    rememberDeviceExpiry: financeRememberDeviceExpiry,
    lockTimeout: financeLockTimeout,
    displayCurrency: financeDisplayCurrency,
  };
});

electron_1.ipcMain.handle('finance:check-page-access', async () => {
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
electron_1.ipcMain.handle('finance:get-accounts', async () => {
  if (!db) return [];
  try {
    return db.prepare('SELECT * FROM finance_accounts WHERE is_archived = 0 ORDER BY name').all();
  } catch { return []; }
});

electron_1.ipcMain.handle('finance:create-account', async (_event, data: any) => {
  if (!db) return null;
  try {
    const stmt = db.prepare(`
      INSERT INTO finance_accounts (name, type, description, icon, color, currency, balance)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(data.name, data.type, data.description || null, data.icon || 'Wallet', data.color || '#10b981', data.currency || 'USD', data.balance || 0);
    return { id: result.lastInsertRowid, ...data };
  } catch (error: any) {
    console.error('[finance] create account error:', error);
    return null;
  }
});

electron_1.ipcMain.handle('finance:update-account', async (_event, data: any) => {
  if (!db) return null;
  try {
    db.prepare(`
      UPDATE finance_accounts SET name=?, type=?, description=?, icon=?, color=?, currency=?, updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(data.name, data.type, data.description, data.icon, data.color, data.currency, data.id);
    return { success: true };
  } catch { return null; }
});

electron_1.ipcMain.handle('finance:archive-account', async (_event, id: number) => {
  if (!db) return null;
  try {
    db.prepare("UPDATE finance_accounts SET is_archived=1 WHERE id=?").run(id);
    return { success: true };
  } catch { return null; }
});

// ── Wallets ──
electron_1.ipcMain.handle('finance:get-wallets', async (_event, accountId?: number) => {
  if (!db) return [];
  try {
    let rows: any[];
    if (accountId) {
      rows = db.prepare('SELECT * FROM finance_wallets WHERE account_id = ? AND is_archived = 0 ORDER BY name').all(accountId) as any[];
    } else {
      rows = db.prepare('SELECT * FROM finance_wallets WHERE is_archived = 0 ORDER BY name').all() as any[];
    }
    for (const row of rows) {
      if (row.metadata) {
        try { row.metadata = JSON.parse(row.metadata); } catch { row.metadata = null; }
      }
    }
    return rows;
  } catch { return []; }
});

electron_1.ipcMain.handle('finance:create-wallet', async (_event, data: any) => {
  if (!db) return null;
  try {
    const stmt = db.prepare(`
      INSERT INTO finance_wallets (account_id, name, type, provider, last_four, balance, currency, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const metadata = data.metadata ? JSON.stringify(data.metadata) : null;
    console.log('[finance:create-wallet] input:', JSON.stringify(data));
    const result = stmt.run(data.account_id, data.name, data.type, data.provider || null, data.last_four || null, data.balance || 0, data.currency || 'USD', metadata);
    console.log('[finance:create-wallet] stmt.run result:', { lastInsertRowid: result.lastInsertRowid, type: typeof result.lastInsertRowid });
    const created = { id: Number(result.lastInsertRowid), ...data, metadata: data.metadata || null };
    console.log('[finance:create-wallet] returning:', JSON.stringify(created));
    return created;
  } catch (e: any) {
    console.error('[finance:create-wallet] ERROR:', e?.message);
    return null;
  }
});

electron_1.ipcMain.handle('finance:update-wallet', async (_event, data: any) => {
  if (!db) return null;
  try {
    const hasBalance = typeof data.balance === 'number';
    if (hasBalance) {
      db.prepare(`
        UPDATE finance_wallets SET name=?, type=?, provider=?, last_four=?, balance=?, currency=?, updated_at=datetime('now','localtime')
        WHERE id=?
      `).run(data.name, data.type, data.provider, data.last_four, data.balance, data.currency, data.id);
    } else {
      db.prepare(`
        UPDATE finance_wallets SET name=?, type=?, provider=?, last_four=?, currency=?, updated_at=datetime('now','localtime')
        WHERE id=?
      `).run(data.name, data.type, data.provider, data.last_four, data.currency, data.id);
    }
    return { success: true };
  } catch { return null; }
});

electron_1.ipcMain.handle('finance:adjust-balance', async (_event, { id, newBalance }: { id: number; newBalance: number }) => {
  if (!db) return { success: false };
  try {
    db.prepare("UPDATE finance_wallets SET balance=?, updated_at=datetime('now','localtime') WHERE id=?").run(newBalance, id);
    return { success: true };
  } catch { return null; }
});

electron_1.ipcMain.handle('finance:archive-wallet', async (_event, id: number) => {
  if (!db) return null;
  try {
    db.prepare("UPDATE finance_wallets SET is_archived=1, updated_at=datetime('now','localtime') WHERE id=?").run(id);
    return { success: true };
  } catch { return null; }
});

electron_1.ipcMain.handle('finance:get-wallet', async (_event, id: number) => {
  if (!db) return null;
  try {
    const wallet = db.prepare('SELECT * FROM finance_wallets WHERE id = ?').get(id) as any;
    if (!wallet) return null;
    if (wallet.metadata) {
      try { wallet.metadata = JSON.parse(wallet.metadata); } catch { wallet.metadata = null; }
    }
    return wallet;
  } catch { return null; }
});

electron_1.ipcMain.handle('finance:update-wallet-metadata', async (_event, { id, metadata }: { id: number; metadata: Record<string, any> }) => {
  if (!db) return null;
  try {
    const existing = db.prepare('SELECT metadata FROM finance_wallets WHERE id = ?').get(id) as any;
    if (!existing) return null;
    let merged: Record<string, any> = {};
    if (existing.metadata) {
      try { merged = JSON.parse(existing.metadata); } catch { merged = {}; }
    }
    Object.assign(merged, metadata);
    const json = JSON.stringify(merged);
    db.prepare("UPDATE finance_wallets SET metadata=?, updated_at=datetime('now','localtime') WHERE id=?").run(json, id);
    const updated = db.prepare('SELECT * FROM finance_wallets WHERE id = ?').get(id) as any;
    if (updated?.metadata) {
      try { updated.metadata = JSON.parse(updated.metadata); } catch { updated.metadata = null; }
    }
    return updated;
  } catch { return null; }
});

electron_1.ipcMain.handle('finance:fetch-crypto-prices', async (_event, coinIds: string[], currency: string = 'usd') => {
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

electron_1.ipcMain.handle('finance:get-crypto-history', async (_event, coinId: string, days: number = 30, currency: string = 'usd') => {
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
electron_1.ipcMain.handle('finance:get-categories', async () => {
  if (!db) return [];
  try {
    return db.prepare('SELECT * FROM finance_categories WHERE is_archived = 0 ORDER BY sort_order').all();
  } catch { return []; }
});

electron_1.ipcMain.handle('finance:create-category', async (_event, data: any) => {
  if (!db) return null;
  try {
    const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM finance_categories').get() as any;
    const stmt = db.prepare(`
      INSERT INTO finance_categories (name, type, icon, color, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(data.name, data.type, data.icon || 'CircleDollarSign', data.color || '#10b981', maxOrder?.next || 1);
    return { id: result.lastInsertRowid, ...data };
  } catch (error: any) {
    console.error('[finance] create category error:', error);
    return null;
  }
});

electron_1.ipcMain.handle('finance:update-category', async (_event, data: any) => {
  if (!db) return null;
  try {
    db.prepare(`
      UPDATE finance_categories SET name=?, type=?, icon=?, color=? WHERE id=?
    `).run(data.name, data.type, data.icon, data.color, data.id);
    return { success: true };
  } catch { return null; }
});

// ── Transactions ──
electron_1.ipcMain.handle('finance:get-transactions', async (_event, filters?: any) => {
  if (!db) return [];
  try {
    let query = `
      SELECT t.*, a.name as account_name, c.name as category_name, c.color as category_color, c.icon as category_icon, w.name as wallet_name
      FROM finance_transactions t
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
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY t.date DESC, t.id DESC';
    if (filters?.limit) { query += ' LIMIT ?'; params.push(filters.limit); }
    return db.prepare(query).all(...params);
  } catch (error: any) {
    console.error('[finance] get transactions error:', error);
    return [];
  }
});

electron_1.ipcMain.handle('finance:create-transaction', async (_event, data: any) => {
  if (!db) return null;
  try {
    const stmt = db.prepare(`
      INSERT INTO finance_transactions (account_id, wallet_id, category_id, type, amount, description, note, date, time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.account_id, data.wallet_id || null, data.category_id,
      data.type, data.amount, data.description || null, data.note || null,
      data.date, data.time || null
    );

    // Update account balance (amount already has correct sign from renderer)
    db.prepare('UPDATE finance_accounts SET balance = balance + ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(data.amount, data.account_id);

    // Update wallet balance if wallet specified
    if (data.wallet_id) {
      db.prepare('UPDATE finance_wallets SET balance = balance + ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(data.amount, data.wallet_id);
    }

    return { id: result.lastInsertRowid, ...data };
  } catch (error: any) {
    console.error('[finance] create transaction error:', error);
    return null;
  }
});

electron_1.ipcMain.handle('finance:update-transaction', async (_event, data: any) => {
  if (!db) return null;
  try {
    db.prepare(`
      UPDATE finance_transactions SET account_id=?, wallet_id=?, category_id=?, type=?, amount=?, description=?, note=?, date=?, time=?, updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(data.account_id, data.wallet_id, data.category_id, data.type, data.amount, data.description, data.note, data.date, data.time, data.id);
    return { success: true };
  } catch { return null; }
});

electron_1.ipcMain.handle('finance:delete-transaction', async (_event, id: number) => {
  if (!db) return { success: false };
  try {
    const txn = db.prepare('SELECT * FROM finance_transactions WHERE id = ?').get(id) as any;
    if (!txn) return { success: false };

    // Reverse balance effect (negate amount since stored amount already has correct sign)
    db.prepare('UPDATE finance_accounts SET balance = balance + ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(-txn.amount, txn.account_id);
    if (txn.wallet_id) {
      db.prepare('UPDATE finance_wallets SET balance = balance + ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(-txn.amount, txn.wallet_id);
    }

    db.prepare('DELETE FROM finance_transactions WHERE id = ?').run(id);
    return { success: true };
  } catch (error: any) {
    console.error('[finance] delete transaction error:', error);
    return { success: false, error: error.message };
  }
});

// ── Summary / Analytics ──
electron_1.ipcMain.handle('finance:get-summary', async () => {
  if (!db) return { totalIncome: 0, totalExpense: 0, netBalance: 0 };
  try {
    const income = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM finance_transactions WHERE type='income'").get() as any;
    const expense = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM finance_transactions WHERE type='expense'").get() as any;
    const netBalance = db.prepare("SELECT COALESCE(SUM(balance),0) as total FROM finance_accounts WHERE is_archived=0 AND type!='custodial'").get() as any;
    return {
      totalIncome: income.total,
      totalExpense: expense.total,
      netBalance: netBalance.total,
    };
  } catch {
    return { totalIncome: 0, totalExpense: 0, netBalance: 0 };
  }
});

electron_1.ipcMain.handle('finance:get-spending-by-category', async () => {
  if (!db) return [];
  try {
    return db.prepare(`
      SELECT c.id as categoryId, c.name as categoryName, c.color as categoryColor, c.icon as categoryIcon, COALESCE(SUM(t.amount),0) as amount, COUNT(t.id) as count
      FROM finance_categories c
      LEFT JOIN finance_transactions t ON t.category_id = c.id AND t.type = 'expense'
      WHERE c.type = 'expense' AND c.is_archived = 0
      GROUP BY c.id ORDER BY amount DESC
    `).all();
  } catch { return []; }
});

electron_1.ipcMain.handle('finance:get-monthly-trends', async () => {
  if (!db) return [];
  try {
    return db.prepare(`
      SELECT strftime('%Y-%m', date) as month,
        COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0) as income,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) as expense,
        COALESCE(SUM(amount),0) as net
      FROM finance_transactions
      GROUP BY month ORDER BY month DESC LIMIT 12
    `).all();
  } catch { return []; }
});

// ── Archived Items ──
electron_1.ipcMain.handle('finance:get-archived-accounts', async () => {
  if (!db) return [];
  try {
    return db.prepare('SELECT * FROM finance_accounts WHERE is_archived = 1 ORDER BY name').all();
  } catch { return []; }
});

electron_1.ipcMain.handle('finance:get-archived-wallets', async () => {
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

electron_1.ipcMain.handle('finance:unarchive-account', async (_event, id: number) => {
  if (!db) return { success: false };
  try {
    db.prepare("UPDATE finance_accounts SET is_archived=0, updated_at=datetime('now','localtime') WHERE id=?").run(id);
    return { success: true };
  } catch { return { success: false }; }
});

electron_1.ipcMain.handle('finance:unarchive-wallet', async (_event, id: number) => {
  if (!db) return { success: false };
  try {
    db.prepare("UPDATE finance_wallets SET is_archived=0, updated_at=datetime('now','localtime') WHERE id=?").run(id);
    return { success: true };
  } catch { return { success: false }; }
});

// ── Delete Account / Wallet ──
electron_1.ipcMain.handle('finance:delete-account', async (_event, id: number) => {
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

electron_1.ipcMain.handle('finance:delete-wallet', async (_event, id: number) => {
  if (!db) return { success: false };
  try {
    db.prepare('DELETE FROM finance_transactions WHERE wallet_id = ?').run(id);
    db.prepare('DELETE FROM finance_wallets WHERE id = ?').run(id);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// ── Password Requirements ──
electron_1.ipcMain.handle('finance:get-password-requirements', async () => {
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

electron_1.ipcMain.handle('finance:set-password-requirement', async (_event, key: string, value: boolean) => {
  if (!db) return { success: false };
  try {
    db.prepare("INSERT OR REPLACE INTO finance_settings (key, value) VALUES (?, ?)").run(key, value ? '1' : '0');
    return { success: true };
  } catch { return { success: false }; }
});

export { getAgentConfig, AgentConfig, detectAgentPrompt, AgentVerifyResult };
