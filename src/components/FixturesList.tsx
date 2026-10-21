import { memo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Star } from 'lucide-react';
import { Crest } from './Visuals';
import type { Fixture } from '../core/model';
export const FixtureRow = memo(function FixtureRow({
  fixture: f,
  selected = false,
  saved,
  watch,
}: {
  fixture: Fixture;
  selected?: boolean;
  saved: boolean;
  watch: (id: string) => void;
}) {
  return (
    <div className={`fixture-row ${selected ? 'selected' : ''}`}>
      <Link
        to={`/?event=${f.id}`}
        className="fixture-link"
        aria-current={selected ? 'true' : undefined}
        aria-label={`${f.home} versus ${f.away}, ${f.phase}`}
      >
        <span className="fixture-time">
          {f.phase === 'live' ? (
            <>
              <i />
              {f.sport === 'football' ? `${f.minute}′` : 'Q3'}
            </>
          ) : f.phase === 'finished' ? (
            'FT'
          ) : (
            new Date(f.startsAt).toLocaleTimeString('en-GB', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'UTC',
            })
          )}
        </span>
        <span className="fixture-teams">
          <span>
            <Crest code={f.homeCode} color={f.homeColor} size="small" />
            {f.home}
            <b>{f.phase !== 'upcoming' ? f.homeScore : '—'}</b>
          </span>
          <span>
            <Crest code={f.awayCode} color={f.awayColor} size="small" />
            {f.away}
            <b>{f.phase !== 'upcoming' ? f.awayScore : '—'}</b>
          </span>
        </span>
        <ArrowUpRight size={15} className="fixture-arrow" />
      </Link>
      <button
        className="watch-button"
        aria-label={`${saved ? 'Remove' : 'Add'} ${f.home} versus ${f.away} ${saved ? 'from' : 'to'} watchlist`}
        aria-pressed={saved}
        onClick={() => watch(f.id)}
      >
        <Star size={14} fill={saved ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
});
export function VirtualFixtures({
  fixtures,
  watchlist,
  watch,
}: {
  fixtures: Fixture[];
  watchlist: string[];
  watch: (id: string) => void;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  // Virtualizer methods stay local; memoized rows receive ordinary immutable data.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtual = useVirtualizer({
    count: fixtures.length,
    getScrollElement: () => scroll.current,
    estimateSize: () => 90,
    overscan: 4,
    getItemKey: (index) => fixtures[index]?.id ?? index,
  });
  return (
    <div
      className="virtual-list"
      ref={scroll}
      tabIndex={0}
      aria-label="Scrollable fixture list. Use the paginated view to browse every fixture with the keyboard."
      data-testid="virtual-list"
    >
      <div style={{ height: virtual.getTotalSize(), position: 'relative' }}>
        {virtual.getVirtualItems().map((row) => {
          const f = fixtures[row.index];
          return (
            f && (
              <div
                key={row.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: row.size,
                  transform: `translateY(${row.start}px)`,
                }}
              >
                <FixtureRow fixture={f} saved={watchlist.includes(f.id)} watch={watch} />
              </div>
            )
          );
        })}
      </div>
    </div>
  );
}
