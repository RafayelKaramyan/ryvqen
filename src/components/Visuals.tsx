import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { Fixture } from '../core/model';

export function Mark({ small = false }: { small?: boolean }) {
  return (
    <svg width={small ? 24 : 32} height={small ? 24 : 32} viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M3 26V6h13c13 0 13 15 2 15l11 5H19L9 19v7zm6-13h8c3 0 3-3 0-3H9z"
        fill="currentColor"
      />
    </svg>
  );
}
export function Crest({
  code,
  color,
  size = 'normal',
}: {
  code: string;
  color: string;
  size?: 'small' | 'normal' | 'large';
}) {
  return (
    <span
      className={`crest crest-${size}`}
      style={{ '--team': color } as React.CSSProperties}
      aria-hidden="true"
    >
      <svg viewBox="0 0 48 52">
        <path
          d="M24 2 44 9v21c0 11-20 20-20 20S4 41 4 30V9Z"
          fill="currentColor"
          fillOpacity=".08"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path
          d="m12 13 24 26M12 25l13 14M24 13l12 13"
          stroke="currentColor"
          opacity=".18"
          strokeWidth="5"
        />
      </svg>
      <span>{code}</span>
    </span>
  );
}
export function Trend({
  values,
  color = 'var(--lime)',
  label,
}: {
  values: number[];
  color?: string;
  label?: string;
}) {
  const min = Math.min(...values) - 6;
  const max = Math.max(...values) + 6;
  const points = values
    .map(
      (v, i) =>
        `${(i / Math.max(1, values.length - 1)) * 120},${28 - ((v - min) / (max - min)) * 24}`,
    )
    .join(' ');
  return (
    <svg
      viewBox="0 0 120 32"
      className="sparkline"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={!label}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
export function Movement({ current, previous }: { current: number; previous: number }) {
  return current === previous ? (
    <span className="flat">—</span>
  ) : current > previous ? (
    <ArrowUpRight size={13} className="up" aria-label="increased" />
  ) : (
    <ArrowDownRight size={13} className="down" aria-label="decreased" />
  );
}

export function Pitch({ fixture, sequence }: { fixture: Fixture; sequence: number }) {
  const football = fixture.sport === 'football';
  const bx = 35 + (Math.sin(sequence * 0.53) + 1) * 220;
  const by = 48 + (Math.cos(sequence * 0.77) + 1) * 87;
  const home = football
    ? [
        [75, 136],
        [145, 64],
        [142, 124],
        [145, 207],
        [232, 83],
        [235, 174],
        [329, 115],
      ]
    : [
        [122, 90],
        [173, 180],
        [266, 113],
        [359, 177],
        [392, 83],
      ];
  const away = football
    ? [
        [520, 136],
        [449, 63],
        [454, 131],
        [450, 206],
        [363, 70],
        [363, 208],
        [273, 132],
      ]
    : [
        [150, 104],
        [205, 166],
        [302, 130],
        [384, 192],
        [415, 107],
      ];
  return (
    <div className={`pitch-wrap ${football ? '' : 'court-wrap'}`}>
      <div className="pitch-topline">
        <span>
          <i className="signal-dot" /> {football ? 'LIVE POSITION' : 'COURT VIEW'}
        </span>
        <span>ILLUSTRATIVE TRACKER</span>
      </div>
      <svg
        viewBox="0 0 600 275"
        className="pitch"
        role="img"
        aria-label={`Illustrative ${fixture.sport} tracker. ${fixture.home} possession ${fixture.possession} percent.`}
      >
        <defs>
          <pattern id="pitch-grid" width="50" height="275" patternUnits="userSpaceOnUse">
            <rect width="25" height="275" fill="#ffffff" opacity=".017" />
          </pattern>
          <radialGradient id="pitch-glow">
            <stop stopColor="#d7fa70" stopOpacity=".14" />
            <stop offset="1" stopColor="#d7fa70" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="600" height="275" fill="url(#pitch-grid)" />
        <ellipse cx={bx} cy={by} rx="150" ry="100" fill="url(#pitch-glow)" className="ball-glow" />
        <g fill="none" stroke="currentColor" strokeWidth=".8" className="pitch-lines">
          <rect x="27" y="27" width="546" height="220" rx={football ? 0 : 8} />
          <path d="M300 27v220" />
          <circle cx="300" cy="137" r="40" />
          {football ? (
            <>
              <path d="M27 71h84v132H27m546-132h-84v132h84M27 107h31v60H27m546-60h-31v60h31" />
              <path d="M111 108a40 40 0 0 1 0 58m378-58a40 40 0 0 0 0 58" />
              <circle cx="84" cy="137" r="1.5" />
              <circle cx="516" cy="137" r="1.5" />
            </>
          ) : (
            <>
              <path d="M27 88h96v98H27m546-98h-96v98h96M53 27v55a85 85 0 0 1 0 110v55m494-220v55a85 85 0 0 0 0 110v55" />
              <circle cx="100" cy="137" r="34" />
              <circle cx="500" cy="137" r="34" />
            </>
          )}
        </g>
        <path
          d={`M${bx - 72} ${by + 35} Q ${bx - 25} ${by + 40} ${bx} ${by}`}
          fill="none"
          stroke="var(--lime)"
          strokeWidth="1"
          strokeDasharray="3 5"
          opacity=".5"
          className="ball-trail"
        />
        {home.map(([x = 0, y = 0], i) => (
          <g
            key={`h${i}`}
            className="player"
            style={{
              transform: `translate(${x + Math.sin(sequence * 0.35 + i) * 12}px, ${y + Math.cos(sequence * 0.2 + i) * 8}px)`,
            }}
          >
            <circle r="7" fill={fixture.homeColor} fillOpacity=".13" />
            <circle r="3.5" fill={fixture.homeColor} />
          </g>
        ))}
        {away.map(([x = 0, y = 0], i) => (
          <g
            key={`a${i}`}
            className="player"
            style={{
              transform: `translate(${x - Math.sin(sequence * 0.3 + i) * 11}px, ${y + Math.cos(sequence * 0.4 + i) * 9}px)`,
            }}
          >
            <circle r="7" fill={fixture.awayColor} fillOpacity=".13" />
            <circle r="3.5" fill={fixture.awayColor} />
          </g>
        ))}
        <g className="ball" style={{ transform: `translate(${bx}px, ${by}px)` }}>
          <circle className="ball-pulse" r="13" fill="none" stroke="var(--lime)" opacity=".3" />
          <circle r="5" fill="#fff" />
          <circle r="2" fill="#121810" />
        </g>
      </svg>
      <div className="pitch-bottomline">
        <span>
          <i style={{ background: fixture.homeColor }} /> {fixture.homeCode}
        </span>
        <span>
          {fixture.possession}% <span className="muted">POSSESSION</span> {100 - fixture.possession}
          %
        </span>
        <span>
          {fixture.awayCode} <i style={{ background: fixture.awayColor }} />
        </span>
      </div>
      <div className="possession-bar">
        <span style={{ width: `${fixture.possession}%`, background: fixture.homeColor }} />
        <span style={{ background: fixture.awayColor }} />
      </div>
    </div>
  );
}
