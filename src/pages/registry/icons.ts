/**
 * icons.ts — the single icon vocabulary.
 *
 * Manifests declare `icon: 'BookOpen'` as a STRING so a manifest file stays a
 * pure data module (no React import, no barrel cycle, trivially parseable by the
 * `validate:pages` script). The palette resolves the name here.
 *
 * Trap this file exists to prevent: importing lucide directly into every
 * manifest makes `npm run validate:pages` need a TS transform, and importing a
 * barrel from a data module is how you get a circular-dependency white screen.
 * A missing name is a build failure, not a silently-blank icon.
 */
import {
  Activity, AlarmClock, AlertTriangle, Anchor, Archive, ArrowRight, Award,
  BarChart3, Battery, Bell, Blocks, BookOpen, Bookmark, Bot, Boxes, Brain,
  Briefcase, Brush, Bug, Building2, Calculator, Calendar, CalendarCheck,
  Camera, ChartLine, CheckCircle2, ChevronRight, Circle, Clock, Cloud, Code2,
  Coins, Compass, Copy, Cpu, CreditCard, Crown, Database, Download, Eye,
  Feather, FileCode, FileText, Filter, Flag, Flame, FlaskConical, Folder,
  FolderOpen, Gauge, GitBranch, Globe, GraduationCap, Grid3x3, HardDrive, Hash,
  Headphones, Heart, History, Home, Image, Inbox, Keyboard, KeyRound, Landmark,
  Layers, LayoutDashboard, LayoutGrid, Lightbulb, LineChart, List, ListChecks,
  ListTodo, Lock, Map, MessageSquare, Mic, Monitor, Moon, MoreHorizontal,
  Mountain, Network, NotebookPen, Orbit, Palette, Paperclip, PenTool, Percent,
  PieChart, Play, Plus, Presentation, Radio, Receipt, RefreshCw, Repeat, Rocket,
  RotateCcw, Rss, Save, ScanLine, ScrollText, Search, Server, Settings, Shield,
  ShieldCheck, ShoppingCart, Sliders, Sparkles, Speaker, Star, Sun, Tags,
  Target, Terminal, Timer, Trophy, Upload, User, Users, Video, Volume2, Wallet,
  Wand2, Watch, Waves, Wind, Workflow, Wrench, Zap, ZoomIn,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/** name -> component. Resolve a manifest's `icon` string through this map. */
export const ICONS: Record<string, LucideIcon> = {
  Activity, AlarmClock, AlertTriangle, Anchor, Archive, ArrowRight, Award,
  BarChart3, Battery, Bell, Blocks, BookOpen, Bookmark, Bot, Boxes, Brain,
  Briefcase, Brush, Bug, Building2, Calculator, Calendar, CalendarCheck,
  Camera, ChartLine, CheckCircle2, ChevronRight, Circle, Clock, Cloud, Code2,
  Coins, Compass, Copy, Cpu, CreditCard, Crown, Database, Download, Eye,
  Feather, FileCode, FileText, Filter, Flag, Flame, FlaskConical, Folder,
  FolderOpen, Gauge, GitBranch, Globe, GraduationCap, Grid3x3, HardDrive, Hash,
  Headphones, Heart, History, Home, Image, Inbox, Keyboard, KeyRound, Landmark,
  Layers, LayoutDashboard, LayoutGrid, Lightbulb, LineChart, List, ListChecks,
  ListTodo, Lock, Map, MessageSquare, Mic, Monitor, Moon, MoreHorizontal,
  Mountain, Network, NotebookPen, Orbit, Palette, Paperclip, PenTool, Percent,
  PieChart, Play, Plus, Presentation, Radio, Receipt, RefreshCw, Repeat, Rocket,
  RotateCcw, Rss, Save, ScanLine, ScrollText, Search, Server, Settings, Shield,
  ShieldCheck, ShoppingCart, Sliders, Sparkles, Speaker, Star, Sun, Tags,
  Target, Terminal, Timer, Trophy, Upload, User, Users, Video, Volume2, Wallet,
  Wand2, Watch, Waves, Wind, Workflow, Wrench, Zap, ZoomIn,
}

/** Fallback so a bad name renders a neutral glyph instead of crashing the palette. */
export const FALLBACK_ICON = Circle

export function resolveIcon(name: string | undefined): LucideIcon {
  if (!name) return FALLBACK_ICON
  return ICONS[name] ?? FALLBACK_ICON
}

/** True when the name is in the vocabulary — used by the manifest validator. */
export function isKnownIcon(name: string | undefined): boolean {
  return !!name && Object.prototype.hasOwnProperty.call(ICONS, name)
}

export const ICON_NAMES = Object.keys(ICONS).sort()