import React, { useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { CityScene } from "./cityscape/v3/CityScene";
import { toHeroes } from "./cityscape/v3/dataAdapter";
import type { ByToolRow } from "./cityscape/v3/dataAdapter";

const _warn = console.warn.bind(console);
console.warn = (msg: any, ...args: any[]) => {
  if (
    typeof msg === "string" &&
    (msg.includes("PCFSoftShadowMap has been deprecated") ||
      msg.includes("THREE.Clock") ||
      msg.includes("X4122"))
  )
    return;
  _warn(msg, ...args);
};

interface AIAgent {
  id: string;
  name: string;
  tokens: number;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  sessions: number;
  messageCount: number;
  status: "active" | "idle" | "inactive" | "error";
  lastUsed?: Date;
}

interface AICityscapeProps {
  agents: AIAgent[];
  overview: any;
  metric: "tokens" | "messages" | "sessions" | "cost";
  tokenDisplayMode: "combined" | "input" | "output";
  loading?: boolean;
  className?: string;
  period?: "week" | "month" | "all";
}

export default function AICityscape({
  agents,
  metric = "tokens",
  tokenDisplayMode,
  loading,
  className,
  period = "week",
}: AICityscapeProps) {
  const prevAgentsFingerprintRef = useRef('');
  const prevMetricKeyRef = useRef('');
  const prevHeroesRef = useRef<any[]>([]);
  const heroes = useMemo(() => {
    const dataFp = agents?.map(a => `${a.id}:${a.tokens}:${a.sessions}:${a.cost}:${a.messageCount}:${a.status}`).join('|') ?? '';
    const metricKey = `${metric}:${tokenDisplayMode}`;
    if (dataFp === prevAgentsFingerprintRef.current && metricKey === prevMetricKeyRef.current) return prevHeroesRef.current;
    prevAgentsFingerprintRef.current = dataFp;
    prevMetricKeyRef.current = metricKey;
    if (!agents?.length) return [];
    const resolveMetric = (a: AIAgent): number => {
      if (metric === "tokens" && tokenDisplayMode === "input") return a.tokensIn
      if (metric === "tokens" && tokenDisplayMode === "output") return a.tokensOut
      if (metric === "tokens") return a.tokens
      if (metric === "messages") return a.messageCount
      if (metric === "cost") return a.cost
      if (metric === "sessions") return a.sessions
      return a.tokens
    }
    const rows: ByToolRow[] = agents
      .filter((a) => a.status !== "inactive" && resolveMetric(a) > 0)
      .map((a) => ({
        id: a.id,
        label: a.name,
        tokens: resolveMetric(a),
        messages: a.messageCount,
        sessions: a.sessions,
        cost: a.cost,
        active: a.status === "active",
        lastActiveMsAgo: a.lastUsed
          ? Date.now() - new Date(a.lastUsed).getTime()
          : undefined,
      }));
    const result = toHeroes(rows, metric);
    prevHeroesRef.current = result;
    return result;
  }, [agents, metric, tokenDisplayMode]);

  const activeCount = heroes.length;

  return (
    <div
      className={`relative rounded-xl overflow-hidden bg-zinc-950 h-[500px] min-h-[440px] ${className ?? ""}`}
    >
      {loading || activeCount === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="grid grid-cols-5 gap-1.5">
                {Array.from({ length: 9 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-4 h-6 bg-zinc-800/80 rounded-sm"
                    animate={{ opacity: [0.3, 0.7, 0.3] }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: i * 0.1,
                    }}
                  />
                ))}
              </div>
              <p className="text-zinc-500 text-xs">Building city...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <p className="text-zinc-500 text-sm">No AI agent data yet</p>
              <p className="text-zinc-600 text-xs">
                Sync your agents to build the skyline
              </p>
            </div>
          )}
        </div>
      ) : (
        <CityScene key={`city-${period}`} heroes={heroes} seed="deskflow" rings={10} hdrFile="/cyber_assets/hdri/night_sky.hdr" />
      )}
    </div>
  );
}
