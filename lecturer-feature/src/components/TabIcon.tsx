import {
  Activity, BarChart3, Bot, Box, Clapperboard, Code2, Cpu, Database, FlaskConical, Folder, GitBranch,
  Globe, History, Keyboard, Layers, Monitor, Palette, Pin, Plug, Rocket, ScrollText, Server, Settings,
  Shield, Star, Terminal, Wrench, Zap,
} from "lucide-react";

const MAP: Record<string, typeof Terminal> = {
  terminal: Terminal, code: Code2, server: Server, git: GitBranch, activity: Activity,
  logs: ScrollText, folder: Folder, container: Box, zap: Zap, database: Database,
  globe: Globe, cpu: Cpu, shield: Shield, rocket: Rocket, flask: FlaskConical,
  bot: Bot, plug: Plug, palette: Palette, keyboard: Keyboard, chart: BarChart3,
  history: History, layers: Layers, star: Star, settings: Settings, pin: Pin,
  monitor: Monitor, wrench: Wrench, film: Clapperboard,
};

export function TabIcon({ name, size = 14, className = "" }: { name: string; size?: number; className?: string }) {
  const C = MAP[name] ?? Terminal;
  return <C size={size} className={className} />;
}

export const ICON_CHOICES = ["terminal", "code", "server", "git", "activity", "logs", "database", "globe", "shield", "rocket", "flask", "zap", "container", "monitor", "wrench", "film", "pin", "bot"];
