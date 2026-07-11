// PodiumTrajectoryCard — historical shadows (design §6, decision 29): your
// season score line drawn against real corps arcs (Crown '12, Bluecoats '10,
// Boston '02, Blue Stars '10, Mandarins, Cascades, Surf, Pioneer) from the
// committed 2000-2012 corpus. Shadows are muted context lines identified by
// direct end-labels, never by color; your corps is the single emphasized
// series. Chasing a named ghost is the point.

import React, { useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import shadowData from '../../data/historicalShadows.json';

const W = 960;
const H = 240;
const PAD = { top: 10, right: 128, bottom: 22, left: 34 };

function scaleX(day) {
  return PAD.left + ((day - 1) / 48) * (W - PAD.left - PAD.right);
}

export default function PodiumTrajectoryCard({ podium }) {
  const state = podium.data?.state;
  const [hovered, setHovered] = useState(null); // shadow corps name
  const history = useMemo(
    () => (state?.scoreHistory || []).filter((e) => e && e.day >= 1 && e.day <= 49),
    [state]
  );

  if (!state) return null;
  const shadows = shadowData.shadows || [];
  if (shadows.length === 0) return null;

  // Y domain: fit everything visible, floored generously.
  const allValues = [
    ...history.map((e) => e.total),
    ...shadows.flatMap((s) => [s.totals[0], s.finals]),
  ];
  const yMin = Math.max(40, Math.floor((Math.min(...allValues) - 4) / 5) * 5);
  const yMax = 100;
  const scaleY = (value) =>
    H - PAD.bottom - ((value - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);

  const gridValues = [];
  for (let v = Math.ceil(yMin / 10) * 10; v <= 100; v += 10) gridValues.push(v);

  const shadowPath = (totals) =>
    totals
      .map((t, i) => `${i === 0 ? 'M' : 'L'}${scaleX(i + 1).toFixed(1)},${scaleY(t).toFixed(1)}`)
      .join('');

  const myPath = history
    .map(
      (e, i) => `${i === 0 ? 'M' : 'L'}${scaleX(e.day).toFixed(1)},${scaleY(e.total).toFixed(1)}`
    )
    .join('');

  // Collision-relaxed end labels: sort by finals, nudge apart by 11px.
  const labels = [...shadows]
    .sort((a, b) => b.finals - a.finals)
    .map((s) => ({ ...s, y: scaleY(s.finals) }));
  for (let i = 1; i < labels.length; i++) {
    if (labels[i].y - labels[i - 1].y < 11) labels[i].y = labels[i - 1].y + 11;
  }

  return (
    <div className="bg-[#1a1a1a] border border-[#333] rounded-sm p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
          <TrendingUp className="w-3 h-3" /> Trajectory vs. history
        </span>
        <span className="text-[9px] text-gray-600">
          Real DCI season arcs (2000&ndash;2012) · gray lines are the ghosts
        </span>
      </div>

      {/* Cap the render size: with only a viewBox and w-full the SVG scales
          to whatever the (up to 2/3-viewport) column gives it, ballooning the
          9px labels to 18px on wide monitors. The cap tracks the 960px viewBox
          at the same 1.2x factor as the old 640/768 pair, so widening the plot
          leaves text at its previous rendered size; mx-auto centers the slack. */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto max-w-[1152px] mx-auto"
        role="img"
        aria-label={`Your season scores against ${shadows.length} historical corps trajectories`}
      >
        {/* Grid + y labels */}
        {gridValues.map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={scaleY(v)}
              y2={scaleY(v)}
              stroke="#2a2a2a"
              strokeWidth="1"
            />
            <text x={PAD.left - 6} y={scaleY(v) + 3} textAnchor="end" fontSize="9" fill="#6b7280">
              {v}
            </text>
          </g>
        ))}
        {/* Week ticks */}
        {[1, 7, 14, 21, 28, 35, 42, 49].map((d) => (
          <text key={d} x={scaleX(d)} y={H - 8} textAnchor="middle" fontSize="9" fill="#6b7280">
            D{d}
          </text>
        ))}

        {/* Shadows */}
        {shadows.map((s) => (
          <path
            key={s.corps}
            d={shadowPath(s.totals)}
            fill="none"
            stroke={hovered === s.corps ? '#9ca3af' : '#4b5563'}
            strokeWidth={hovered === s.corps ? 2 : 1.25}
            opacity={hovered && hovered !== s.corps ? 0.25 : 0.6}
            onMouseEnter={() => setHovered(s.corps)}
            onMouseLeave={() => setHovered(null)}
          >
            <title>{`${s.corps} ${s.year} — finals ${s.finals.toFixed(2)}`}</title>
          </path>
        ))}

        {/* Shadow end-labels (identity by label, not color) */}
        {labels.map((s) => (
          <text
            key={s.corps}
            x={W - PAD.right + 6}
            y={s.y + 3}
            fontSize="9"
            fill={hovered === s.corps ? '#d1d5db' : '#6b7280'}
            onMouseEnter={() => setHovered(s.corps)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: 'default' }}
          >
            {`${s.corps} '${String(s.year).slice(2)} · ${s.finals.toFixed(1)}`}
          </text>
        ))}

        {/* My line */}
        {history.length > 0 && (
          <>
            <path d={myPath} fill="none" stroke="#4d9fff" strokeWidth="2.25" />
            {history.map((e) => (
              <circle
                key={e.day}
                cx={scaleX(e.day)}
                cy={scaleY(e.total)}
                r="3"
                fill="#4d9fff"
                stroke="#1a1a1a"
                strokeWidth="1.5"
              >
                <title>{`Day ${e.day} — ${e.total.toFixed(3)}`}</title>
              </circle>
            ))}
          </>
        )}
      </svg>

      <div className="flex items-center gap-3 text-[9px] text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-[#4d9fff]" /> {state.corpsName || 'Your corps'}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-px bg-gray-500" /> historical shadows
        </span>
        {history.length === 0 && (
          <span className="text-gray-600">Your line starts after your first scored show.</span>
        )}
      </div>
    </div>
  );
}
