import React from 'react';

export function CodeDemo() {
  return (
    <div className="rounded-lg bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] border border-zinc-800 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800">
        <span className="text-[10px] text-zinc-500 font-mono">python</span>
        <button className="text-[10px] text-zinc-600 hover:text-zinc-400 transition">Copy</button>
      </div>
      <pre className="p-3 text-xs font-mono text-zinc-300 overflow-x-auto">
        <code>{`def train(model, data):
    for batch in data:
        loss = model(batch)
        loss.backward()
        optimizer.step()`}</code>
      </pre>
    </div>
  );
}
