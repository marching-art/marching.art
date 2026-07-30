// @ts-nocheck -- presentational primitives; see howToPlaySections.jsx
// GAME GUIDE — SHARED PRIMITIVES (/guide). The small presentational pieces the
// guide's section bodies are built from. Split out of howToPlaySections.jsx so
// that file stays under its size cap and the league sections can reuse them
// without importing back into it.

import React from 'react';
import { Heading } from '../components/ui';

export const Card = ({ className = '', children }) => (
  <div className={`bg-surface-sunken border border-white/10 rounded-none p-4 ${className}`}>
    {children}
  </div>
);

export const DataRow = ({ label, value, accent = false }) => (
  <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
    <span className="text-muted text-xs">{label}</span>
    <span className={`text-xs font-bold ${accent ? 'text-interactive' : 'text-white'}`}>
      {value}
    </span>
  </div>
);

export const SectionHead = ({ icon: Icon, title, kicker }) => (
  <div className="mb-4">
    {kicker && (
      <p className="text-[10px] font-bold uppercase tracking-wider text-interactive mb-1">
        {kicker}
      </p>
    )}
    <div className="flex items-center gap-3">
      <span className="w-9 h-9 bg-interactive/20 rounded-none flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-interactive" />
      </span>
      <Heading level="title">{title}</Heading>
    </div>
  </div>
);

/** A titled block of prose — the shape almost every league fact wants. */
export const NoteCard = ({ title, children }) => (
  <div className="bg-black/30 border border-white/10 rounded-none p-3">
    <p className="text-xs font-bold text-secondary">{title}</p>
    <p className="text-[11px] text-muted leading-snug">{children}</p>
  </div>
);

export const NoteGrid = ({ items }) => (
  <div className="grid gap-2 sm:grid-cols-2">
    {items.map((item) => (
      <NoteCard key={item.title} title={item.title}>
        {item.desc}
      </NoteCard>
    ))}
  </div>
);

/** A heading inside a section, between its sub-topics. */
export const SubHead = ({ children, className = 'mt-5 mb-2' }) => (
  <p className={`text-xs font-bold uppercase tracking-wider text-muted ${className}`}>{children}</p>
);
