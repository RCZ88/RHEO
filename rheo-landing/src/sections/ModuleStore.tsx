import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const MODULES = [
  { slug: 'time', label: 'Time', desc: 'Tracks every app, every website, every minute.' },
  { slug: 'money', label: 'Money', desc: 'Wallets, subscriptions, income, expenses — all in one view.' },
  { slug: 'learning', label: 'Learning', desc: 'Hierarchical lessons with AI-powered mastery levels.' },
  { slug: 'chat', label: 'Chat', desc: 'Multi-provider AI that knows your entire local context.' },
  { slug: 'terminal', label: 'Terminal', desc: 'Multi-pane terminal with AI agents that read your codebase.' },
  { slug: 'timeline', label: 'Timeline', desc: 'Visual phases of your life — past, present, and emerging.' },
  { slug: 'goals', label: 'Goals', desc: 'Daily habits, weekly targets, and long-term milestones.' },
  { slug: 'life-phases', label: 'Life Phases', desc: 'Major chapters of your life, mapped and reflected on.' },
  { slug: 'agent-orchestration', label: 'Agent Orchestration', desc: 'Swarm of AI agents collaborating on your projects.' },
  { slug: 'content-creation', label: 'Content Creation', desc: 'Scripts, retention analysis, and post-publish analytics.' },
  { slug: 'external', label: 'External', desc: 'Sleep, activity grids, and cross-device comparison.' },
  { slug: 'context-brain', label: 'Context Brain', desc: 'Knowledge graph that connects everything you track.' },
];

export function ModuleStore() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-10% 0px", amount: 0.2 });

  return (
    <section ref={ref} className="relative py-24 px-8">
      <div className="max-w-[1100px] mx-auto">
        <motion.h2
          className="text-[clamp(1.5rem,3vw,2.25rem)] font-display font-bold tracking-tight text-text mb-3 text-center"
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          Spare threads you can add
        </motion.h2>
        <motion.p
          className="text-text-secondary text-center max-w-[50ch] mx-auto mb-14 text-[0.95rem]"
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          Every module is a thread on the same loom. Pick the ones that matter to you.
        </motion.p>
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5"
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          variants={{
            visible: { transition: { staggerChildren: 0.08 } },
            hidden: {},
          }}
        >
          {MODULES.map((mod) => (
            <motion.div
              key={mod.slug}
              className="group relative bg-surface border border-white/[0.06] rounded-xl p-5 flex flex-col items-center text-center overflow-hidden"
              style={{ borderRadius: 16 }}
              variants={{
                hidden: { opacity: 0, y: 24 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
              }}
              whileHover={{ y: -4, borderColor: "rgba(255,255,255,0.16)" }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Hover glow — white radial, LAMINAR */}
              <div
                className="absolute inset-0 rounded-xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                style={{
                  background: 'radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255,255,255,0.06) 0%, transparent 70%)',
                  pointerEvents: 'none',
                }}
              />
              {/* Animated white border beam — sweeps on hover */}
              <div
                className="absolute inset-0 rounded-xl border border-transparent transition-all duration-700 group-hover:border-white/20 group-hover:shadow-[0_0_24px_rgba(255,255,255,0.08)]"
              />
              {/* Dashed inner border — LAMINAR */}
              <div
                className="absolute inset-[3px] rounded-[11px] border border-transparent transition-all duration-700 group-hover:border-white/10"
                style={{
                  backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.03) 4px, rgba(255,255,255,0.03) 5px)',
                  pointerEvents: 'none',
                }}
              />

              {/* Mascot image — embroidered patch style, scaled with spring on hover */}
              <div className="relative w-[84px] h-[46px] mb-3">
                <div
                  className="absolute inset-0 rounded-lg opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  style={{
                    boxShadow: '0 0 0 1px rgba(255,255,255,0.15), 0 4px 12px rgba(0,0,0,0.3)',
                    pointerEvents: 'none',
                  }}
                />
                <img
                  src={`/assets/mascots/mascot-${mod.slug}.png`}
                  alt={`${mod.label} mascot`}
                  className="relative w-full h-full object-contain transition-transform duration-700 group-hover:scale-110 will-change-transform"
                />
              </div>

              {/* Label — white, mono, uppercase — LAMINAR */}
              <span className="text-[0.65rem] tracking-[0.14em] text-white uppercase font-mono mb-2.5 relative z-10">
                {mod.label}
              </span>

              {/* Description — text, small */}
              <span className="text-[0.8rem] text-text leading-snug relative z-10">
                {mod.desc}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
