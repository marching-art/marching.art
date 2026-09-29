// A panel of runnable registry jobs. Sections pass their domain; System passes
// the whole registry with search. Every run goes through the shared runner
// (confirm → manualTrigger → toast → refresh the dashboard it recomputes).

import { useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { Search, Terminal } from 'lucide-react';
import { ADMIN_JOBS, jobsForDomain } from './adminJobs';
import type { AdminJob, AdminJobDomain } from './adminJobs';
import { getAdminSection } from './adminSections';
import { Panel, ProcessRow, inputClass } from './AdminUI';
import { useAdmin } from './adminContextCore';

interface JobListProps {
  /** Omit for the full, searchable registry grouped by section. */
  domain?: AdminJobDomain;
  title?: string;
  id?: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
}

export default function JobList({ domain, title, id, description, icon }: JobListProps) {
  const { runJob, runningJob } = useAdmin();
  const [query, setQuery] = useState('');

  const jobs = useMemo<AdminJob[]>(() => {
    const pool = domain ? jobsForDomain(domain) : [...ADMIN_JOBS];
    const q = query.trim().toLowerCase();
    if (!q) return pool;
    return pool.filter((job) =>
      `${job.name} ${job.description} ${job.id}`.toLowerCase().includes(q)
    );
  }, [domain, query]);

  const rows = (list: AdminJob[]) =>
    list.map((job) => (
      <ProcessRow
        key={job.id}
        name={job.name}
        description={job.description}
        icon={Terminal}
        caution={job.caution}
        loading={runningJob === job.id}
        onExecute={() => void runJob(job)}
      />
    ));

  const grouped = !domain
    ? (['season', 'players', 'podium', 'insights', 'moderation', 'system'] as AdminJobDomain[])
        .map((d) => ({ domain: d, list: jobs.filter((job) => job.domain === d) }))
        .filter((g) => g.list.length > 0)
    : null;

  return (
    <Panel
      id={id}
      title={title ?? (domain ? 'Jobs' : 'All Jobs')}
      icon={icon ?? Terminal}
      description={description}
      flush
    >
      {!domain && (
        <div className="px-4 py-3 border-b border-line">
          <label className="relative block">
            <span className="sr-only">Search jobs</span>
            <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search jobs…"
              className={`${inputClass} w-full pl-8`}
            />
          </label>
        </div>
      )}
      {grouped
        ? grouped.map((g) => (
            <div key={g.domain}>
              <p className="px-4 pt-3 pb-1 text-[9px] font-bold uppercase tracking-wider text-muted">
                {getAdminSection(g.domain).label}
              </p>
              {rows(g.list)}
            </div>
          ))
        : rows(jobs)}
      {jobs.length === 0 && <p className="px-4 py-4 text-[11px] text-muted">No matching jobs.</p>}
    </Panel>
  );
}
