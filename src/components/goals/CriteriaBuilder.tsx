import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Clock, CheckCircle2, Monitor, Search, Target, ArrowDownToLine, CalendarDays, AlertTriangle, Settings2, Zap } from 'lucide-react';
import { Input } from '../ui/input';
import { Select, SelectItem } from '../ui/select';
import { VoiceInputWrapper } from '../VoiceInputWrapper';
import { FocusGroupSelect } from './FocusGroupSelect';
import { ExternalActivityPicker } from './ExternalActivityPicker';
import { CrossFeatureLinkPicker } from './CrossFeatureLinkPicker';
import { AppUsageGoalPicker, type AppUsageGoalPickerValue } from './AppUsageGoalPicker';
import type { GoalCategory, GoalTarget, GoalPeriod, TrackingMode, CompletionLogic, CadenceConfig, CrossFeatureLink } from '../../types/goals';
import { DEFAULT_COMPLETION_LOGIC, DEFAULT_CADENCE_CONFIG } from '../../types/goals';

// Plain-language explainers (Human-Centric UX: never leave a mode's meaning implicit).
const TRACKING_MODE_HELP: Record<'manual' | 'system' | 'hybrid', string> = {
  manual: "You check the goal off yourself when you've done it.",
  system: 'Progress is measured automatically from your app & focus-group activity — no check-in needed.',
  hybrid: 'Auto-tracks from activity when possible, but you can still mark it done yourself.',
};

const CADENCE_HELP: Record<'fixed' | 'rolling' | 'flexible', string> = {
  fixed: 'On specific days only (e.g. every Mon/Wed/Fri). Skipping a chosen day = missed.',
  rolling: 'Spread across the whole period — finish N times anywhere in the week, any days.',
  flexible: 'Pick any X days out of the period. Which days you choose can change week to week.',
};

// Targets that are intrinsically measured by the computer → Manual tracking is contradictory.
function isSystemTrackedTarget(targetType: string, matchCategory: string, appCount: number): boolean {
  return targetType === 'time' && matchCategory.startsWith('fg:') || (targetType === 'app' && appCount > 0);
}

// Seconds → "1h 30m" / "45m" for human-readable previews.
function formatHm(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export interface CriteriaForm {
  title: string;
  description: string;
  category: GoalCategory;
  period: GoalPeriod;
  targetType: GoalTarget['type'];
  targetHours: number;
  targetMinutes: number;
  externalHours: number;
  externalMinutes: number;
  matchCategory: string;
  detectionEnabled: boolean;
  detectionMode: 'positive' | 'avoidance';
  detectionKeywords: string;
  detectionMinMinutes: number;
  /** Closed-ended app-usage selection (apps detected by the OS tracker). */
  appUsage: AppUsageGoalPickerValue;
  parentIds: string[];
  links: { label: string; url: string }[];
  externalActivityId?: number | null;
  trackingMode: TrackingMode;
  completionLogic: CompletionLogic;
  cadenceConfig: CadenceConfig;
  crossFeatureLink?: CrossFeatureLink | null;
}

interface CriteriaBuilderProps {
  value: CriteriaForm;
  onChange: (form: CriteriaForm) => void;
  onSave: () => void;
  onCancel: () => void;
  longTermGoals: { id: string; title: string }[];
  isEditing?: boolean;
}

const CATEGORIES: { value: GoalCategory; label: string; color: string }[] = [
  { value: 'work', label: 'Work', color: 'text-pink-400' },
  { value: 'personal', label: 'Personal', color: 'text-violet-400' },
  { value: 'health', label: 'Health', color: 'text-emerald-400' },
  { value: 'learning', label: 'Learning', color: 'text-cyan-400' },
  { value: 'finance', label: 'Finance', color: 'text-amber-400' },
  { value: 'relationships', label: 'Relationships', color: 'text-rose-400' },
];

export function LTGPicker({
  longTermGoals, value, onChange,
}: {
  longTermGoals: { id: string; title: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);
  };

  return (
    <div className="space-y-1.5">
      <label className="text-[11px] text-zinc-500 block">
        Link to long-term goals {value.length > 0 && <span className="text-violet-400">({value.length} selected)</span>}
      </label>
      <div className="space-y-1 max-h-[180px] overflow-y-auto pr-1">
        {longTermGoals.map(ltg => {
          const selected = value.includes(ltg.id);
          return (
            <button
              type="button"
              key={ltg.id}
              onClick={() => toggle(ltg.id)}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left transition-colors ${
                selected
                  ? 'bg-violet-500/15 border-violet-500/40 text-violet-200'
                  : 'bg-zinc-900/60 border-zinc-700/50 text-zinc-300 hover:border-zinc-600'
              }`}
            >
              <span className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border transition-colors ${
                selected ? 'bg-violet-500 border-violet-500' : 'border-zinc-600'
              }`}>
                {selected && <CheckCircle2 size={9} className="text-white" />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[12px] truncate">{ltg.title}</span>
              </span>
              <Target size={11} className={`shrink-0 ${selected ? 'text-violet-400' : 'text-zinc-600'}`} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CriteriaBuilder({ value, onChange, onSave, onCancel, longTermGoals, isEditing }: CriteriaBuilderProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const update = (patch: Partial<CriteriaForm>) => onChange({ ...value, ...patch });

  const targetSeconds = value.targetType === 'time'
    ? (value.targetHours * 3600) + (value.targetMinutes * 60)
    : undefined;

  // A target intrinsically measured by the computer can't be "manually" tracked.
  const isSystemTracked = isSystemTrackedTarget(value.targetType, value.matchCategory, value.appUsage?.apps?.length ?? 0);

  return (
    <div className="space-y-3">
      <VoiceInputWrapper className="w-full">
        <Input
          value={value.title}
          onChange={e => update({ title: e.target.value })}
          onKeyDown={e => e.key === 'Enter' && value.title.trim() && onSave()}
          placeholder="What do you want to achieve?"
          autoFocus
          className="bg-zinc-900/80 border-zinc-700/50 focus-visible:ring-violet-500/50 text-[13px] h-9"
        />
      </VoiceInputWrapper>

      <VoiceInputWrapper className="w-full">
        <Input
          value={value.description}
          onChange={e => update({ description: e.target.value })}
          placeholder="Add details (optional)"
          className="bg-zinc-900/80 border-zinc-700/50 focus-visible:ring-violet-500/50 text-[13px] h-9"
        />
      </VoiceInputWrapper>

      <div className="flex items-center gap-2 flex-wrap">
        <Select value={value.category} onValueChange={v => update({ category: v as GoalCategory })} className="w-[110px]">
          {CATEGORIES.map(c => (
            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
          ))}
        </Select>

        <Select value={value.period} onValueChange={v => update({ period: v as GoalPeriod })} className="w-[100px]">
          <SelectItem value="daily">Daily</SelectItem>
          <SelectItem value="weekly">Weekly</SelectItem>
          <SelectItem value="monthly">Monthly</SelectItem>
        </Select>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Select value={value.targetType} onValueChange={v => update({ targetType: v as GoalTarget['type'] })} className="w-[180px]">
          <SelectItem value="completion">Complete it</SelectItem>
          <SelectItem value="time">Spend time</SelectItem>
          <SelectItem value="app">App usage</SelectItem>
          <SelectItem value="external">External usage under</SelectItem>
        </Select>

        {value.targetType === 'time' && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-1.5"
          >
            <Clock size={13} className="text-zinc-500" />
            <Input
              type="number" min={0} max={23}
              value={value.targetHours}
              onChange={e => update({ targetHours: parseInt(e.target.value) || 0 })}
              className="w-14 bg-zinc-900/80 border-zinc-700/50 text-[13px] h-8 text-center"
            />
            <span className="text-[11px] text-zinc-500">h</span>
            <Input
              type="number" min={0} max={59}
              value={value.targetMinutes}
              onChange={e => update({ targetMinutes: parseInt(e.target.value) || 0 })}
              className="w-14 bg-zinc-900/80 border-zinc-700/50 text-[13px] h-8 text-center"
            />
            <span className="text-[11px] text-zinc-500">m</span>
            {targetSeconds && (
              <span className="text-[10px] text-zinc-600 ml-1">
                = {Math.floor(targetSeconds / 3600)}h {Math.floor((targetSeconds % 3600) / 60)}m
              </span>
            )}
          </motion.div>
        )}
      </div>

      {value.targetType === 'time' && (
        <div>
          <FocusGroupSelect
            label="Track time spent in focus group"
            value={value.matchCategory || ''}
            onValueChange={v => update({ matchCategory: v })}
            className="w-full"
          />
          <p className="text-[10px] text-zinc-600 mt-1">Progress counts completed focus sessions of the group.</p>
        </div>
      )}

      {value.targetType === 'app' && (
        <div className="space-y-2 p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/40">
          <div className="flex items-center gap-1.5 text-[11px] text-amber-300">
            <Monitor size={13} /> Track time spent in specific apps
          </div>
          <AppUsageGoalPicker
            value={value.appUsage}
            onChange={next => update({ appUsage: next })}
          />
        </div>
      )}

      {value.targetType === 'external' && (
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-2 p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/40"
        >
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
            <ArrowDownToLine size={13} className="text-amber-400" />
            Keep this external activity under:
          </div>
          <ExternalActivityPicker value={value.externalActivityId ?? null} onChange={id => update({ externalActivityId: id, matchCategory: id == null ? '' : String(id) })} />
          <div className="flex items-center gap-1.5">
            <Input
              type="number" min={0} max={23}
              value={value.externalHours}
              onChange={e => update({ externalHours: parseInt(e.target.value) || 0 })}
              className="w-14 bg-zinc-900/80 border-zinc-700/50 text-[13px] h-8 text-center"
            />
            <span className="text-[11px] text-zinc-500">h</span>
            <Input
              type="number" min={0} max={59}
              value={value.externalMinutes}
              onChange={e => update({ externalMinutes: parseInt(e.target.value) || 0 })}
              className="w-14 bg-zinc-900/80 border-zinc-700/50 text-[13px] h-8 text-center"
            />
            <span className="text-[11px] text-zinc-500">m</span>
            <span className="text-[10px] text-zinc-600 ml-1">
              max per day
            </span>
          </div>
          <p className="text-[10px] text-zinc-600">Goal completes when external/distracting app usage stays below this limit for the day.</p>
        </motion.div>
      )}

      {longTermGoals.length > 0 && (
        <LTGPicker
          longTermGoals={longTermGoals}
          value={value.parentIds}
          onChange={ids => update({ parentIds: ids })}
        />
      )}

      {/* Tracking Mode */}
      <div className="space-y-1.5">
        <label className="text-[11px] text-zinc-500 flex items-center gap-1">
          <Settings2 size={11} /> Tracking mode
        </label>
        {/*
          Human-Centric rule: when the goal's target is intrinsically system-tracked
          (focus group / detected app usage), Manual makes no sense — you can't
          manually "track" time the computer already measures. We force + lock System
          and explain why, instead of silently offering a contradictory option.
        */}
        {isSystemTracked && (
          <p className="text-[10px] text-emerald-400/80 flex items-center gap-1">
            <Zap size={10} /> This goal is tracked automatically — no manual check-in needed.
          </p>
        )}
        <div className="flex gap-2">
          {(['manual', 'system', 'hybrid'] as const).map(mode => {
            const disabled = isSystemTracked && mode === 'manual';
            const selected = (isSystemTracked ? 'system' : value.trackingMode) === mode;
            return (
              <button
                key={mode}
                type="button"
                disabled={disabled}
                onClick={() => update({ trackingMode: mode })}
                title={TRACKING_MODE_HELP[mode]}
                className={`flex-1 px-2.5 py-2 rounded-lg text-[11px] font-medium border transition-all duration-200 text-left ${
                  selected
                    ? mode === 'system'
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : mode === 'hybrid'
                        ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                        : 'bg-violet-500/15 text-violet-400 border-violet-500/30'
                    : 'bg-zinc-900/60 text-zinc-500 border-zinc-700/50 hover:border-zinc-600'
                } ${disabled ? 'opacity-35 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-1">
                  {mode === 'manual' && '👤'}
                  {mode === 'system' && '⚙️'}
                  {mode === 'hybrid' && '🔄'}
                  <span>{mode === 'manual' ? 'Manual' : mode === 'system' ? 'Automatic' : 'Hybrid'}</span>
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-zinc-600 leading-relaxed">
          {TRACKING_MODE_HELP[isSystemTracked ? 'system' : value.trackingMode]}
        </p>
      </div>

      {/* Completion Logic */}
      <div className="space-y-2 p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/40">
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
          <AlertTriangle size={13} className="text-amber-400" />
          What happens if this goal is missed?
        </div>
        <label className="flex items-center gap-2 text-[12px] text-zinc-300 cursor-pointer">
          <input
            type="checkbox"
            checked={value.completionLogic.lateAllowed}
            onChange={e => update({ completionLogic: { ...value.completionLogic, lateAllowed: e.target.checked } })}
            className="rounded border-zinc-600 bg-zinc-800 text-violet-500"
          />
          Allow late completion
        </label>
        {value.completionLogic.lateAllowed && (
          <div className="flex items-center gap-2 text-[11px] text-zinc-400">
            Grace period:
            <Input
              type="number" min={0} max={1440}
              value={value.completionLogic.gracePeriodMinutes}
              onChange={e => update({ completionLogic: { ...value.completionLogic, gracePeriodMinutes: parseInt(e.target.value) || 0 } })}
              className="w-20 bg-zinc-900/80 border-zinc-700/50 text-[13px] h-7 text-center"
            />
            minutes after deadline
          </div>
        )}
        <label className="flex items-center gap-2 text-[12px] text-zinc-300 cursor-pointer">
          <input
            type="checkbox"
            checked={value.completionLogic.partialCredit}
            onChange={e => update({ completionLogic: { ...value.completionLogic, partialCredit: e.target.checked } })}
            className="rounded border-zinc-600 bg-zinc-800 text-violet-500"
          />
          Count as done at a partial amount
        </label>
        {value.completionLogic.partialCredit && (
          <div className="space-y-1.5 pl-1">
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>Done once you reach</span>
              <span className="text-amber-300 font-medium tabular-nums">{value.completionLogic.partialCreditThreshold ?? 80}%</span>
            </div>
            <input
              type="range"
              min={50}
              max={95}
              step={5}
              value={value.completionLogic.partialCreditThreshold ?? 80}
              onChange={e => update({ completionLogic: { ...value.completionLogic, partialCreditThreshold: parseInt(e.target.value) || 80 } })}
              className="w-full accent-amber-500"
            />
            <p className="text-[10px] text-zinc-600 leading-relaxed">
              {targetSeconds
                ? `Based on your ${formatHm(targetSeconds)} target: counts as complete after ${formatHm(Math.round(targetSeconds * (((value.completionLogic.partialCreditThreshold ?? 80) / 100))))} of tracked time.`
                : 'Below this % of the target, the goal shows as in-progress rather than missed.'}
            </p>
          </div>
        )}
        <div className="space-y-1">
          <label className="text-[11px] text-zinc-500">When missed, streak should:</label>
          <div className="flex gap-2">
            {(['reset', 'continue', 'pause'] as const).map(rule => (
              <button
                key={rule}
                type="button"
                onClick={() => update({ completionLogic: { ...value.completionLogic, streakOnMiss: rule } })}
                className={`px-2.5 py-1 rounded-md text-[10px] font-medium border transition-colors ${
                  value.completionLogic.streakOnMiss === rule
                    ? rule === 'reset'
                      ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                      : rule === 'continue'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    : 'bg-zinc-900/60 text-zinc-500 border-zinc-700/50'
                }`}
              >
                {rule === 'reset' && '🔥 Reset'}
                {rule === 'continue' && '✅ Continue'}
                {rule === 'pause' && '⏸️ Pause'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cadence Config */}
      {(value.period === 'weekly' || value.period === 'monthly') && (
        <div className="space-y-2 p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/40">
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
            <CalendarDays size={13} className="text-cyan-400" />
            Schedule pattern
          </div>
          <div className="flex gap-2">
            {(['fixed', 'rolling', 'flexible'] as const).map(type => (
              <button
                key={type}
                type="button"
                onClick={() => update({ cadenceConfig: { ...value.cadenceConfig, type } })}
                title={CADENCE_HELP[type]}
                className={`flex-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium border transition-colors ${
                  value.cadenceConfig.type === type
                    ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                    : 'bg-zinc-900/60 text-zinc-500 border-zinc-700/50 hover:border-zinc-600'
                }`}
              >
                {type === 'fixed' && '📌 Specific days'}
                {type === 'rolling' && '🔄 Any N times'}
                {type === 'flexible' && '🎯 Any X days'}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-zinc-600 leading-relaxed">
            {CADENCE_HELP[value.cadenceConfig.type]}
          </p>
          {value.cadenceConfig.type === 'fixed' && (
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-500">Select days:</label>
              <div className="flex gap-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      const days = value.cadenceConfig.fixedDays.includes(i)
                        ? value.cadenceConfig.fixedDays.filter(d => d !== i)
                        : [...value.cadenceConfig.fixedDays, i];
                      update({ cadenceConfig: { ...value.cadenceConfig, fixedDays: days } });
                    }}
                    className={`w-9 h-7 rounded-md text-[10px] font-medium border transition-colors ${
                      value.cadenceConfig.fixedDays.includes(i)
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                        : 'bg-zinc-900/60 text-zinc-500 border-zinc-700/50 hover:border-zinc-600'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}
          {value.cadenceConfig.type === 'rolling' && (
            <div className="flex items-center gap-2 text-[11px] text-zinc-400">
              Complete
              <Input
                type="number" min={1} max={31}
                value={value.cadenceConfig.rollingTarget}
                onChange={e => update({ cadenceConfig: { ...value.cadenceConfig, rollingTarget: parseInt(e.target.value) || 1 } })}
                className="w-14 bg-zinc-900/80 border-zinc-700/50 text-[13px] h-7 text-center"
              />
              times per {value.period}
            </div>
          )}
          {value.cadenceConfig.type === 'flexible' && (
            <div className="flex items-center gap-2 text-[11px] text-zinc-400">
              Any
              <Input
                type="number" min={1} max={31}
                value={value.cadenceConfig.flexibleWindowDays}
                onChange={e => update({ cadenceConfig: { ...value.cadenceConfig, flexibleWindowDays: parseInt(e.target.value) || 1 } })}
                className="w-14 bg-zinc-900/80 border-zinc-700/50 text-[13px] h-7 text-center"
              />
              of {value.period === 'weekly' ? '7 days' : '30 days'}
            </div>
          )}
        </div>
      )}

      {/* Cross-Feature Link */}
      <CrossFeatureLinkPicker
        value={value.crossFeatureLink ?? null}
        onChange={link => update({ crossFeatureLink: link })}
      />

      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
      >
        {showAdvanced ? '−' : '+'} Advanced: Detection & Criteria
      </button>

      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden space-y-3 p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/40"
          >
            <div className="flex items-center gap-2">
              <Monitor size={13} className="text-zinc-500" />
              <label className="flex items-center gap-2 text-[12px] text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={value.detectionEnabled}
                  onChange={e => update({ detectionEnabled: e.target.checked })}
                  className="rounded border-zinc-600 bg-zinc-800 text-violet-500"
                />
                Auto-detect completion from app usage
              </label>
            </div>

            {value.detectionEnabled && (
              <>
                <div className="flex gap-2">
                  {(['positive', 'avoidance'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => update({ detectionMode: m })}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                        value.detectionMode === m
                          ? m === 'positive'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                          : 'bg-zinc-900/60 text-zinc-500 border-zinc-700/50'
                      }`}
                    >
                      {m === 'positive' ? 'Positive (accumulate)' : 'Avoidance (flag)'}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="text-[11px] text-zinc-500 mb-1 block">
                    <Search size={11} className="inline mr-1" />
                    App/window title keywords (comma-separated):
                  </label>
                  <Input
                    value={value.detectionKeywords}
                    onChange={e => update({ detectionKeywords: e.target.value })}
                    placeholder="e.g. VS Code, Duolingo, Figma"
                    className="bg-zinc-900/80 border-zinc-700/50 text-[13px] h-8"
                  />
                </div>

                {value.detectionMode === 'positive' && (
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                    Mark complete after
                    <Input
                      type="number" min={1}
                      value={value.detectionMinMinutes}
                      onChange={e => update({ detectionMinMinutes: parseInt(e.target.value) || 1 })}
                      className="w-14 bg-zinc-900/80 border-zinc-700/50 text-[13px] h-7 text-center"
                    />
                    minutes detected
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onSave}
          disabled={!value.title.trim()}
          className="px-4 py-1.5 rounded-lg bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 disabled:opacity-40 disabled:cursor-not-allowed text-[12px] font-medium transition-colors"
        >
          <CheckCircle2 size={12} className="inline mr-1" />
          {isEditing ? 'Save Changes' : 'Add Goal'}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/50 text-[12px] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
