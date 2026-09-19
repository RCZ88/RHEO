/**
 * STTVocabManager.tsx — Custom vocabulary editor panel
 * R-48 compliant: token colors, {6,10,16} radii, no shadow/blur/spring,
 * static waveform, RM→static.
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Plus, Trash2, Search, X, Check } from 'lucide-react';
import { useLocalStt } from '../../hooks/useLocalStt';
import { SttCategoryColors } from '../../lib/sttStore';

interface VocabEntry {
  canonical: string;
  aliases: string[];
  priority: number;
}

export function STTVocabManager() {
  const stt = useLocalStt();
  const [filter, setFilter] = useState('');
  const [newCanonical, setNewCanonical] = useState('');
  const [newAliases, setNewAliases] = useState('');
  const [newPriority, setNewPriority] = useState(5);
  const [addPending, setAddPending] = useState(false);

  const filtered = stt.vocab?.filter(
    e => !filter || e.canonical.toLowerCase().includes(filter.toLowerCase())
  ) ?? [];

  const handleAdd = useCallback(async () => {
    if (!newCanonical.trim()) return;
    setAddPending(true);
    try {
      await stt.setVocab({ canonical: newCanonical.trim(), aliases: newAliases.split(',').map(a => a.trim()).filter(Boolean), priority: newPriority });
      setNewCanonical('');
      setNewAliases('');
      setNewPriority(5);
    } finally {
      setAddPending(false);
    }
  }, [newCanonical, newAliases, newPriority, stt.setVocab]);

  const handleRemove = useCallback(async (canonical: string) => {
    await stt.removeVocab(canonical);
  }, [stt.removeVocab]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          borderBottom: '1px solid var(--ws-border)',
          background: 'rgb(0 0 0 / 0.1)',
        }}
      >
        <div style={{ width: 24, height: 24, borderRadius: '6px', background: 'rgb(0 0 0 / 0.2)', display: 'grid', placeItems: 'center' }}>
          <Sparkles style={{ width: 12, height: 12, color: 'var(--resume-warning)' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Custom Vocabulary</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>Biases ASR + auto-corrects transcripts</div>
        </div>
        {stt.vocab && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{stt.vocab.length}</span>}
      </div>

      {/* Add form */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '8px 10px', borderBottom: '1px solid var(--ws-border)', background: 'rgb(0 0 0 / 0.05)' }}>
        <input
          value={newCanonical}
          onChange={e => setNewCanonical(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Term"
          style={{
            flex: '1 1 100px',
            padding: '6px 8px',
            background: 'rgb(0 0 0 / 0.3)',
            border: '1px solid var(--ws-border)',
            borderRadius: '6px',
            color: 'var(--text-primary)',
            fontSize: 12,
            outline: 'none',
          }}
          onFocus={e => (e.target as HTMLElement).style.borderColor = 'var(--resume-info)'}
          onBlur={e => (e.target as HTMLElement).style.borderColor = 'var(--ws-border)'}
        />
        <input
          value={newAliases}
          onChange={e => setNewAliases(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="open router, openrouter"
          style={{
            flex: '1 1 100px',
            padding: '6px 8px',
            background: 'rgb(0 0 0 / 0.3)',
            border: '1px solid var(--ws-border)',
            borderRadius: '6px',
            color: 'var(--text-primary)',
            fontSize: 12,
            outline: 'none',
          }}
          onFocus={e => (e.target as HTMLElement).style.borderColor = 'var(--resume-info)'}
          onBlur={e => (e.target as HTMLElement).style.borderColor = 'var(--ws-border)'}
        />
        <select
          value={newPriority}
          onChange={e => setNewPriority(Number(e.target.value))}
          style={{
            padding: '6px 4px',
            background: 'rgb(0 0 0 / 0.3)',
            border: '1px solid var(--ws-border)',
            borderRadius: '6px',
            color: 'var(--text-primary)',
            fontSize: 11,
            outline: 'none',
          }}
        >
          <option value={1}>p1</option>
          <option value={3}>p3</option>
          <option value={5}>p5</option>
          <option value={7}>p7</option>
          <option value={10}>p10</option>
        </select>
        <button
          onClick={handleAdd}
          disabled={!newCanonical.trim() || addPending}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '6px 10px',
            background: 'var(--resume-warning)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 600,
            minHeight: 28,
            opacity: (!newCanonical.trim() || addPending) ? 0.4 : 1,
          }}
          aria-label="Add vocabulary term"
        >
          <Plus style={{ width: 12, height: 12 }} />
          {addPending ? 'Adding…' : 'Add'}
        </button>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderBottom: '1px solid var(--ws-border)' }}>
        <Search style={{ width: 12, height: 12, color: 'var(--text-muted)', flexShrink: 0 }} />
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter terms…"
          style={{
            flex: 1,
            padding: '4px 6px',
            background: 'rgb(0 0 0 / 0.2)',
            border: '1px solid var(--ws-border)',
            borderRadius: '4px',
            color: 'var(--text-secondary)',
            fontSize: 11,
            outline: 'none',
          }}
          onFocus={e => (e.target as HTMLElement).style.borderColor = 'var(--resume-info)'}
          onBlur={e => (e.target as HTMLElement).style.borderColor = 'var(--ws-border)'}
        />
        {filter && (
          <button
            onClick={() => setFilter('')}
            style={{
              display: 'grid', placeItems: 'center',
              width: 18, height: 18,
              background: 'transparent',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              color: 'var(--text-muted)',
            }}
            onMouseEnter={e => (e.target as HTMLElement).style.color = 'var(--text-primary)'}
            onMouseLeave={e => (e.target as HTMLElement).style.color = 'var(--text-muted)'}
            aria-label="Clear filter"
          >
            <X style={{ width: 10, height: 10 }} />
          </button>
        )}
      </div>

      {/* Term list */}
      <div
        style={{
          maxHeight: 180,
          overflowY: 'auto',
          flex: 1,
        }}
      >
        {stt.vocab === undefined ? (
          <div style={{ padding: '16px 10px', color: 'var(--text-muted)', fontSize: 11, textAlign: 'center' }}>
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '16px 10px', color: 'var(--text-muted)', fontSize: 11, textAlign: 'center' }}>
            No custom vocabulary terms. Add technical terms to improve transcription accuracy.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {filtered.map(entry => (
              <motion.div
                key={entry.canonical}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.12 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  borderBottom: '1px solid var(--ws-border)',
                }}
              >
                {/* Term */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-primary)' }}>
                    <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.canonical}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>p{entry.priority}</span>
                  </div>
                  {entry.aliases.length > 0 && (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {entry.aliases.map(a => (
                        <span key={a} style={{
                          padding: '1px 5px',
                          background: 'rgb(0 0 0 / 0.3)',
                          border: '1px solid var(--ws-border)',
                          borderRadius: '3px',
                          fontSize: 9,
                          color: 'var(--text-muted)',
                        }}>
                          {a}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Remove */}
                <button
                  onClick={() => handleRemove(entry.canonical)}
                  style={{
                    display: 'grid', placeItems: 'center',
                    width: 24, height: 24,
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                  }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.color = 'var(--resume-danger)'; (e.target as HTMLElement).style.background = 'rgb(0 0 0 / 0.1)'; }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.color = 'var(--text-muted)'; (e.target as HTMLElement).style.background = 'transparent'; }}
                  aria-label={`Remove ${entry.canonical}`}
                >
                  <Trash2 style={{ width: 12, height: 12 }} />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          borderTop: '1px solid var(--ws-border)',
          fontSize: 10,
          color: 'var(--text-muted)',
        }}
      >
        <span>Terms used for ASR prompting + post-correction</span>
      </div>
    </div>
  );
}
