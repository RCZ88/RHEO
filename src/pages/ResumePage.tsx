import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Upload, Rocket, Eye, Download, Plus, TrendingUp, CheckCircle, ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useResumeStore } from '../stores/resumeStore';
import { CareerTapestry } from '../features/resume/components/CareerTapestry';
import { ScoreGauge } from '../features/resume/components/ScoreGauge';
import { NumberTicker } from '../components/ui/number-ticker';
import { Skeleton } from '../components/ui/skeleton';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { AuroraText } from '../components/ui/aurora-text';
import { AnimatedShinyText } from '../components/ui/animated-shiny-text';
import { Marquee } from '../components/ui/marquee';

const features = [
  { icon: Sparkles, text: 'AI-Powered Feedback' },
  { icon: FileText, text: 'ATS-Optimized Output' },
  { icon: Upload, text: 'Chat Import' },
  { icon: Rocket, text: '7-Phase Builder' },
  { icon: Eye, text: 'Live Preview' },
  { icon: Download, text: 'PDF Export' },
];

export default function ResumePage() {
  const navigate = useNavigate();
  const { profile, score, versions, chatCompilations, takeaways, fetchProfile, fetchVersions, fetchChatCompilations, isLoading } = useResumeStore();

  useEffect(() => { fetchProfile(); fetchVersions(); fetchChatCompilations(); }, []);

  const confirmedTakeaways = takeaways.filter((t) => t.status === 'confirmed').length;

  return (
    <div className="min-h-full relative overflow-hidden" style={{ '--page-accent': 'rgb(99, 102, 241)' } as any}>
      {/* Ambient background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[var(--page-accent)]/8 via-transparent to-transparent pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[400px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/5 via-transparent to-transparent pointer-events-none light:from-amber-500/10" />

      <div className="max-w-6xl mx-auto space-y-8 relative py-8">

        {/* HERO — Headline + CTA immediately visible */}
        <div className="text-center space-y-5">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>
            <AuroraText colors={['#6366f1', '#a78bfa', '#fbbf24', '#f472b6']} speed={0.8}>
              Career Forge
            </AuroraText>
          </h1>
          <div className="flex justify-center">
            <AnimatedShinyText className="text-sm text-zinc-400 light:text-zinc-500" shimmerWidth={120}>
              Build a resume that gets you hired — with AI coaching every step of the way
            </AnimatedShinyText>
          </div>

          {/* PRIMARY CTA — right in the hero, no scroll needed */}
          <div className="flex items-center justify-center gap-3 pt-2">
            <motion.button
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/resume/build')}
              className="relative inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-[var(--page-accent)] text-white font-semibold text-sm shadow-[0_0_24px_rgba(99,102,241,0.3)] hover:shadow-[0_0_32px_rgba(99,102,241,0.45)] transition-shadow light:shadow-[0_0_24px_rgba(99,102,241,0.2)]"
            >
              <Rocket className="w-4 h-4" />
              {versions.length > 0 ? 'Continue Building' : 'Start Building'}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/resume/import')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-zinc-700/60 bg-zinc-900/60 text-zinc-300 font-medium text-sm hover:border-zinc-600 hover:bg-zinc-800/60 transition-colors light:border-zinc-300/60 light:bg-white/80 light:text-zinc-700 light:hover:border-zinc-400 light:hover:bg-zinc-50"
            >
              <Upload className="w-4 h-4" />
              Import Chat
            </motion.button>
          </div>
        </div>

        {/* Career Tapestry — compact, below hero */}
        <CareerTapestry
          phaseStatus={{ 1: versions.length > 0 ? 'complete' : 'in_progress' }}
          currentPhase={1}
          onPhaseClick={(p) => navigate('/resume/build')}
        />

        {/* Identity + Score Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Identity Card */}
          <motion.div
            whileHover={{ y: -2 }}
            className="md:col-span-2 relative overflow-hidden rounded-xl border border-zinc-800/60 bg-gradient-to-br from-zinc-900/90 to-zinc-800/50 p-5 light:border-zinc-200/60 light:from-white/90 light:to-zinc-50/50"
          >
            <div className="absolute top-0 right-0 w-[250px] h-[250px] bg-[var(--page-accent)]/5 rounded-full blur-3xl pointer-events-none" />
            <div className="relative flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--page-accent)]/30 to-[var(--page-accent)]/5 flex items-center justify-center ring-2 ring-[var(--page-accent)]/20 shadow-[0_0_20px_rgba(99,102,241,0.15)]">
                <span className="text-lg font-bold text-white">{(profile?.fullName || 'Y').charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold text-white light:text-zinc-900">{profile?.fullName || 'Your Resume'}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm text-zinc-400 light:text-zinc-500">{profile?.targetRole || 'Set up your target role'}</span>
                  {profile?.careerLevel && (
                    <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-500 light:border-zinc-300 light:text-zinc-600">{profile.careerLevel}</Badge>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Score Card */}
          <motion.div
            whileHover={{ y: -2 }}
            className="relative overflow-hidden rounded-xl border border-zinc-800/60 bg-gradient-to-br from-[var(--page-accent)]/10 to-transparent p-5 flex flex-col items-center justify-center light:border-zinc-200/60 light:from-[var(--page-accent)]/15"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(99,102,241,0.1)_0%,_transparent_70%)]" />
            {isLoading ? (
              <Skeleton className="w-20 h-20 rounded-full" />
            ) : (
              <div className="relative">
                <ScoreGauge score={score.current} size={80} />
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-zinc-500 uppercase tracking-wider light:text-zinc-400">Score</div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Quick Actions Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Import', desc: 'Extract from chats', icon: Upload, color: 'emerald', path: '/resume/import', available: true },
            { label: 'Build', desc: 'Answer AI questions', icon: Rocket, color: 'indigo', path: '/resume/build', available: true },
            { label: 'Preview', desc: 'See live resume', icon: Eye, color: 'blue', path: '/resume/preview', available: versions.length > 0 },
            { label: 'Export', desc: 'PDF / Markdown', icon: Download, color: 'amber', path: '/resume/export', available: versions.length > 0 },
          ].map((step) => (
            <motion.button
              key={step.label}
              whileHover={step.available ? { y: -3, scale: 1.02 } : undefined}
              whileTap={step.available ? { scale: 0.97 } : undefined}
              onClick={() => step.available && navigate(step.path)}
              disabled={!step.available}
              className={`relative overflow-hidden rounded-xl border p-4 text-left transition-all duration-200 ${
                step.available
                  ? 'border-zinc-800/60 bg-gradient-to-br from-zinc-900/80 to-zinc-800/40 cursor-pointer hover:border-zinc-700/60 light:border-zinc-200/60 light:from-white/80 light:to-zinc-100/40'
                  : 'border-zinc-800/30 opacity-40 cursor-not-allowed bg-zinc-900/30 light:border-zinc-200/20 light:bg-white/50'
              }`}
            >
              {step.available && (
                <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-${step.color}-500/50 to-transparent`} />
              )}
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${
                step.available ? `bg-${step.color}-500/15 ring-1 ring-${step.color}-500/20` : 'bg-zinc-800/50'
              }`}>
                <step.icon className={`w-4 h-4 ${step.available ? `text-${step.color}-400` : 'text-zinc-600'}`} />
              </div>
              <p className={`text-sm font-semibold ${step.available ? 'text-white' : 'text-zinc-600'}`}>{step.label}</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">{step.desc}</p>
              {step.available && <ArrowRight className="w-4 h-4 text-zinc-600 absolute right-3 bottom-3" />}
            </motion.button>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Versions', value: versions.length, icon: FileText, color: 'indigo', max: 5 },
            { label: 'Imports', value: chatCompilations.length, icon: Upload, color: 'emerald', max: 10 },
            { label: 'Takeaways', value: confirmedTakeaways, icon: CheckCircle, color: 'amber', max: 20 },
            { label: 'Score', value: score.current, icon: TrendingUp, color: 'violet', max: 100 },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              whileHover={{ y: -2 }}
              className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4 hover:border-zinc-700/60 transition-colors light:border-zinc-200/60 light:bg-white/70"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <stat.icon className={`w-3.5 h-3.5 text-${stat.color}-400`} />
                <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">{stat.label}</span>
              </div>
              <NumberTicker value={stat.value} className="text-xl font-bold text-white tabular-nums light:text-zinc-900" />
              <div className="mt-1.5 h-1 bg-zinc-800 rounded-full overflow-hidden light:bg-zinc-200/60">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((stat.value / stat.max) * 100, 100)}%` }}
                  transition={{ duration: 0.8, delay: 0.5 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                  className={`h-full rounded-full bg-${stat.color}-500/40`}
                />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Versions or Empty */}
        {versions.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider light:text-zinc-500">Recent Versions</h3>
              <button onClick={() => navigate('/resume/export')} className="text-[11px] text-[var(--page-accent)] hover:text-[var(--page-accent)]/80 font-medium">
                View all →
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {versions.slice(0, 6).map((v, i) => (
                <motion.div
                  key={v.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  whileHover={{ y: -3 }}
                  onClick={() => navigate('/resume/preview')}
                  className="group relative overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5 cursor-pointer hover:border-zinc-700/60 transition-colors light:border-zinc-200/60 light:bg-white/70"
                >
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--page-accent)]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="h-[80px] rounded-lg bg-gradient-to-br from-zinc-950 to-zinc-900 mb-3 flex items-center justify-center light:from-zinc-100 light:to-zinc-200">
                    <FileText className="w-8 h-8 text-zinc-700 group-hover:text-zinc-500 transition-colors light:text-zinc-400 light:group-hover:text-zinc-600" />
                  </div>
                  <p className="text-sm font-semibold text-white group-hover:text-[var(--page-accent)] transition-colors truncate light:text-zinc-900 light:group-hover:text-[var(--page-accent)]">{v.versionName}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-zinc-500 light:text-zinc-400">{v.targetRole}</span>
                    <span className={`text-sm font-bold ${v.score >= 75 ? 'text-emerald-400' : v.score >= 50 ? 'text-amber-400' : 'text-red-400'} light:${v.score >= 75 ? 'text-emerald-600' : v.score >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{v.score}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ) : !isLoading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative overflow-hidden rounded-xl border border-zinc-800/60 bg-gradient-to-br from-zinc-900/80 to-zinc-800/40 p-10 text-center light:border-zinc-200/60 light:from-white/80 light:to-zinc-50/40"
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-[var(--page-accent)]/5 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[var(--page-accent)]/20 to-[var(--page-accent)]/5 flex items-center justify-center mx-auto mb-3 ring-1 ring-[var(--page-accent)]/20">
                <FileText className="w-7 h-7 text-[var(--page-accent)]" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1.5">No versions yet</h3>
              <p className="text-sm text-zinc-500 max-w-sm mx-auto mb-5">
                Start building your resume to create your first version.
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
