import { motion } from 'framer-motion';
import {
  Settings, Globe, Monitor, Sun, Moon, Check, ChevronRight,
  Palette, Eye, EyeOff, Key, Save, Loader2, X, Sparkles,
  AlertTriangle, Clock, Download, Trash2, RefreshCw, Terminal,
  Activity, Database, Lock, LockOpen, History, Undo2, Pencil,
  Upload, FileText, SearchX, Inbox, Keyboard, MousePointer,
  ChevronDown, ChevronUp, HandMetal, WandSparkles, BadgeInfo,
  Volume2, Mic, Headphones, MapPin, Package, TrendingUp,
  Shield, ShieldCheck, CircleHelp, BookOpen, Target,
  Wifi, WifiOff, Bluetooth, Headphones, Gamepad,
  Clock, Calculator, PieChart, BarChart3, Gauge,
  ArrowRight, ArrowUp, Plus, GripVertical, Zap,
  FileJson, FileSpreadsheet, FolderDown, HardDrive,
  MessageSquare, Headphones, Mic, Sparkles, Brain,
  Bot, Wand2, Compass, Route, Network, Cpu,
  Eye as EyeIcon, EyeOff as EyeOffIcon,
} from 'lucide-react';
import { lazy } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { SectionHeader } from '../../components/SectionHeader';
import { ProviderDiagnostics } from '../../components/ProviderDiagnostics';
import { GlassCard } from '../../components/GlassCard';
import { PageShell } from '../../components/PageShell';
import { DevicesPanel } from '../../components/DevicesPanel';
import { AuthSettings } from '../../components/AuthSettings';
import BrowserProfileSettings from '../../components/BrowserProfileSettings';
import { BorderBeam } from '../../components/ui/border-beam';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { Button } from '../../components/ui/button';
import {
  Dialog, DialogClose, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import { ColorPicker } from './ColorPicker';
import { DEFAULT_CATEGORIES, PRESET_COLORS, CATEGORY_COLORS, DEFAULT_TIER_ASSIGNMENTS } from './constants';

// Re-export SearchableSection and ColorPicker for other sections
export { SearchableSection, ColorPicker } from './shared';
export { DEFAULT_CATEGORIES, PRESET_COLORS, CATEGORY_COLORS, DEFAULT_TIER_ASSIGNMENTS } from './constants';
