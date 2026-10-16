import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, X, Check, AlertCircle } from 'lucide-react';
import { WarmCard } from '../../WarmCard';

interface SemesterCardProps {
  onSet: (semester: { name: string; startDate: string; endDate: string }) => void;
  onDismiss: () => void;
  isFirstTime: boolean;
}

export function SemesterCard({ onSet, onDismiss, isFirstTime }: SemesterCardProps) {
  const [name, setName] = useState('Fall Semester');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(8, 1); // September 1
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setMonth(11, 20); // December 20
    return d.toISOString().slice(0, 10);
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    if (!startDate) newErrors.startDate = 'Start date is required';
    if (!endDate) newErrors.endDate = 'End date is required';
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      newErrors.endDate = 'End date must be after start date';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSet({ name: name.trim(), startDate, endDate });
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <WarmCard ambient className="border-amber-500/30 bg-amber-500/5">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={16} className="text-amber-400 shrink-0" />
                <span className="text-[12px] font-medium text-zinc-200">
                  {isFirstTime ? "Welcome! Set your semester dates" : "No semester set"}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mb-3">
                {isFirstTime
                  ? "This helps filter activities by semester and pre-fills dates for new activities. You can change it anytime."
                  : "The 'This semester' filter needs semester dates to work. Add them to enable it."}
              </p>

              <form onSubmit={handleSubmit} className="space-y-2">
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Semester name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Fall 2024, Spring 2025..."
                    className={`w-full mt-1 px-2 py-1.5 rounded-lg bg-zinc-900/80 border ${
                      errors.name ? 'border-red-500/50' : 'border-zinc-700/50'
                    } text-[11px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-cyan-500/50`}
                  />
                  {errors.name && <p className="text-[10px] text-red-400 mt-0.5">{errors.name}</p>}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Start date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className={`w-full mt-1 px-2 py-1.5 rounded-lg bg-zinc-900/80 border ${
                        errors.startDate ? 'border-red-500/50' : 'border-zinc-700/50'
                      } text-[11px] text-zinc-200 outline-none focus:border-cyan-500/50`}
                    />
                    {errors.startDate && <p className="text-[10px] text-red-400 mt-0.5">{errors.startDate}</p>}
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase tracking-wider">End date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className={`w-full mt-1 px-2 py-1.5 rounded-lg bg-zinc-900/80 border ${
                        errors.endDate ? 'border-red-500/50' : 'border-zinc-700/50'
                      } text-[11px] text-zinc-200 outline-none focus:border-cyan-500/50`}
                    />
                    {errors.endDate && <p className="text-[10px] text-red-400 mt-0.5">{errors.endDate}</p>}
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-1">
                  <button
                    type="button"
                    onClick={onDismiss}
                    className="px-3 py-1.5 text-[10px] text-zinc-500 hover:text-zinc-300 rounded-lg"
                  >
                    {isFirstTime ? 'Skip for now' : 'Not now'}
                  </button>
                  <button
                    type="submit"
                    disabled={Object.keys(errors).length > 0}
                    className="px-3 py-1.5 text-[11px] bg-cyan-500/15 text-cyan-300 border border-cyan-500/25 rounded-lg hover:bg-cyan-500/25 disabled:opacity-30"
                  >
                    <Check size={11} className="inline mr-1" /> Save
                  </button>
                </div>
              </form>
            </div>
            <button
              onClick={onDismiss}
              className="shrink-0 p-1 text-zinc-500 hover:text-zinc-200 rounded"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        </WarmCard>
      </motion.div>
    </AnimatePresence>
  );
}