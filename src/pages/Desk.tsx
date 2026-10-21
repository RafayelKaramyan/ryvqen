import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ArrowUpDown,
  CirclePause,
  CirclePlay,
  Radio,
  RotateCcw,
  Search,
  Star,
} from 'lucide-react';
import { desk, useDesk } from '../core/runtime';
import { effectiveMarket, formatPrice } from '../core/model';
import { FixtureRow } from '../components/FixturesList';
import { Crest, Movement, Pitch, Trend } from '../components/Visuals';
import { MarketDialog } from '../components/MarketDialog';
import type { Editor } from '../components/MarketDialog';
import type { Fixture, Market } from '../core/model';

function MarketCard({
  fixture,
  market,
  open,
}: {
  fixture: Fixture;
  market: Market;
  open: (e: Editor) => void;
}) {
  const { book, stream, pending } = useDesk();
  const override = book.overrides[market.id];
  const current = effectiveMarket(market, override);
  const disabled = stream.connection !== 'connected' || fixture.phase !== 'live' || pending;
  return (
    <section
      className={`market-card ${current.status === 'suspended' ? 'suspended' : ''}`}
      aria-label={market.name}
    >
      <div className="market-heading">
        <h3>{market.name}</h3>
        <span className={`market-state ${current.status}`}>
          <i />
          {current.status === 'suspended' ? 'PAUSED' : override?.prices ? 'MANUAL' : 'FEED'}
        </span>
      </div>
      <div
        className="outcomes"
        style={{ '--outcomes': current.outcomes.length } as React.CSSProperties}
      >
        {current.outcomes.map((o) => {
          const source = market.outcomes.find((x) => x.id === o.id);
          const previous = source?.history.at(-2) ?? o.price;
          return (
            <button
              key={o.id}
              className="outcome"
              disabled={disabled || current.status !== 'open'}
              aria-label={`Edit ${market.name}, ${o.label} price ${formatPrice(o.price)}`}
              onClick={() => open({ fixture, market, kind: 'price' })}
            >
              <span className="outcome-label">
                {o.label}
                <Movement current={o.price} previous={override?.prices ? o.price : previous} />
              </span>
              <span className="outcome-price" key={`${o.price}-${override?.revision ?? 0}`}>
                {current.status === 'suspended' ? (
                  <span className="paused-price">{formatPrice(o.price)}</span>
                ) : (
                  formatPrice(o.price)
                )}
              </span>
              <Trend
                values={source?.history ?? []}
                color={override?.prices ? 'var(--cyan)' : 'var(--lime)'}
              />
            </button>
          );
        })}
      </div>
      <div className="market-footer">
        <span>FEED TREND / DECIMAL</span>
        <div>
          {override?.prices && (
            <button
              className="mini-button"
              disabled={disabled}
              aria-label={`Return ${market.name} to feed`}
              onClick={() => open({ fixture, market, kind: 'release' })}
            >
              <RotateCcw size={12} /> Feed
            </button>
          )}
          <button
            className="mini-button"
            disabled={disabled || market.status === 'suspended'}
            aria-label={`${override?.suspended ? 'Resume' : 'Suspend'} ${market.name}`}
            onClick={() =>
              open({ fixture, market, kind: override?.suspended ? 'resume' : 'suspend' })
            }
          >
            {override?.suspended ? <CirclePlay size={13} /> : <CirclePause size={13} />}{' '}
            {override?.suspended ? 'Resume' : 'Pause'}
          </button>
        </div>
      </div>
    </section>
  );
}

export function DeskPage() {
  const { stream, book } = useDesk();
  const [params] = useSearchParams();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [query, setQuery] = useState('');
  const [onlySaved, setOnlySaved] = useState(false);
  const eventId = params.get('event') ?? 'evt-001';
  const fixture = stream.fixtures.find((f) => f.id === eventId);
  const live = stream.fixtures.filter((f) => f.phase === 'live');
  const rows = live.filter(
    (f) =>
      (!onlySaved || book.watchlist.includes(f.id)) &&
      `${f.home} ${f.away} ${f.league}`.toLowerCase().includes(query.toLowerCase()),
  );
  const watch = (id: string) => {
    void desk.watch(id).catch(() => {});
  };
  if (!stream.fixtures.length)
    return (
      <div className="loading-desk">
        <Radio size={28} />
        <h1>Finding the rhythm.</h1>
        <p>Connecting to the demonstration feed…</p>
        <button className="button" onClick={() => desk.control('resume')}>
          Reconnect
        </button>
      </div>
    );
  if (!fixture)
    return (
      <div className="empty-state">
        <h1>Fixture not found.</h1>
        <p>This event is not in the current replay.</p>
        <Link to="/" className="button primary">
          Back to the live desk <ArrowRight size={16} />
        </Link>
      </div>
    );
  const markets = live.flatMap((f) => f.markets);
  const paused = markets.filter(
    (m) => effectiveMarket(m, book.overrides[m.id]).status === 'suspended',
  ).length;
  return (
    <>
      <div className="page-intro">
        <div>
          <p className="eyebrow">
            <span className="tiny-cross">+</span> CONTROL THE MOMENT.
          </p>
          <h1>
            The live <span>desk.</span>
          </h1>
        </div>
        <div className="intro-note">
          <span className="signal-dot" />
          <p>
            A clear view of every play.
            <br />
            <span>Fictional events. Working controls.</span>
          </p>
        </div>
      </div>
      <div className="desk-stats">
        <div>
          <span className="metric-label">
            <Radio size={13} /> IN PLAY
          </span>
          <strong>
            {String(live.length).padStart(2, '0')}
            <small>events</small>
          </strong>
          <span className="metric-note">
            Across two sports <ArrowUpRight size={14} />
          </span>
        </div>
        <div>
          <span className="metric-label">
            <ArrowUpDown size={13} /> ACTIVE MARKETS
          </span>
          <strong>
            {String(markets.length - paused).padStart(2, '0')}
            <small>open</small>
          </strong>
          <span className="metric-note">
            {paused ? `${paused} locally paused` : 'The floor is moving'}{' '}
            <span className="mini-wave">▁▃▅▂▆▃▇▅</span>
          </span>
        </div>
        <div>
          <span className="metric-label">
            <Star size={13} /> YOUR WATCHLIST
          </span>
          <strong>
            {String(book.watchlist.length).padStart(2, '0')}
            <small>saved</small>
          </strong>
          <Link to="/fixtures?saved=1" className="metric-note">
            Keep the important ones close <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
      <div className="desk-grid">
        <aside className="fixture-panel" aria-labelledby="radar-heading">
          <div className="panel-heading">
            <h2 id="radar-heading">On the radar</h2>
            <span className="count">{rows.length}</span>
          </div>
          <div className="radar-controls">
            <label className="search-field">
              <Search size={14} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find in-play…"
                aria-label="Search live events"
              />
            </label>
            <button
              className="icon-button"
              aria-label="Show only watched live events"
              aria-pressed={onlySaved}
              onClick={() => setOnlySaved(!onlySaved)}
            >
              <Star size={15} fill={onlySaved ? 'currentColor' : 'none'} />
            </button>
          </div>
          <div className="radar-list">
            {rows.map((f) => (
              <FixtureRow
                key={f.id}
                fixture={f}
                selected={f.id === fixture.id}
                saved={book.watchlist.includes(f.id)}
                watch={watch}
              />
            ))}
            {!rows.length && (
              <p className="small-empty">
                No matching live events.
                <br />
                Try another search or save a fixture.
              </p>
            )}
          </div>
          <Link to="/fixtures" className="panel-link">
            All 240 fixtures <ArrowUpRight size={15} />
          </Link>
          <div className="radar-caption">
            <span>01 — THE PLAY</span>
            <span>02 — YOUR CALL</span>
            <span>03 — THE RECORD</span>
          </div>
        </aside>
        <div className="event-panel">
          <div className="event-kicker">
            <span>
              <span className="sport-symbol">{fixture.sport === 'football' ? '◉' : '◎'}</span>{' '}
              {fixture.league}
            </span>
            <span className={`live-pill ${fixture.phase === 'live' ? '' : 'muted-pill'}`}>
              {fixture.phase === 'live' && <i />}
              {fixture.phase === 'live'
                ? `${fixture.sport === 'football' ? '2ND HALF' : 'QUARTER 3'} · ${fixture.minute}′`
                : fixture.phase === 'finished'
                  ? 'FULL TIME'
                  : 'UPCOMING / UTC'}
            </span>
          </div>
          <div className="scoreboard">
            <div className="score-team">
              <Crest code={fixture.homeCode} color={fixture.homeColor} size="large" />
              <h2>{fixture.home}</h2>
              <span>HOME</span>
            </div>
            <div className="score">
              <span>{fixture.phase === 'upcoming' ? '—' : fixture.homeScore}</span>
              <b>:</b>
              <span>{fixture.phase === 'upcoming' ? '—' : fixture.awayScore}</span>
              <small>
                {fixture.phase === 'live'
                  ? 'SIMULATED IN PLAY'
                  : fixture.phase === 'finished'
                    ? 'FINAL RESULT'
                    : 'SCHEDULED EVENT'}
              </small>
            </div>
            <div className="score-team">
              <Crest code={fixture.awayCode} color={fixture.awayColor} size="large" />
              <h2>{fixture.away}</h2>
              <span>AWAY</span>
            </div>
          </div>
          <Pitch fixture={fixture} sequence={fixture.phase === 'live' ? stream.sequence : 0} />
          <div className="markets-title">
            <div>
              <p className="eyebrow">THE NEXT MOVE</p>
              <h2>Read the market.</h2>
            </div>
            <span>01 / {String(fixture.markets.length).padStart(2, '0')} MARKETS</span>
          </div>
          {stream.connection !== 'connected' && (
            <p className="inline-notice">
              The feed is {stream.connection}. Resume it before changing a market.
            </p>
          )}
          {fixture.phase !== 'live' && (
            <p className="inline-notice">
              {fixture.phase === 'upcoming'
                ? 'Upcoming fixture preview. Controls open when an event is in play.'
                : 'This fixture has finished. Markets are read only.'}
            </p>
          )}
          <div className="markets-grid">
            {fixture.markets.map((m) => (
              <MarketCard key={m.id} fixture={fixture} market={m} open={setEditor} />
            ))}
          </div>
          <div className="market-legend">
            <span>
              <i className="legend-dot" /> Feed prices update automatically
            </span>
            <span>
              <i className="legend-dot manual" /> Manual prices stay fixed until released
            </span>
          </div>
        </div>
        <aside className="insight-panel" aria-labelledby="pulse-heading">
          <div className="panel-heading">
            <h2 id="pulse-heading">The pulse</h2>
            <span className="label-accent">REPLAY</span>
          </div>
          <div className="pulse-title">
            <span>POSSESSION BALANCE</span>
            <strong>
              {fixture.possession}
              <small>%</small>
            </strong>
            <p>{fixture.home} have the ball.</p>
          </div>
          <div className="balance-bars" aria-hidden="true">
            {Array.from({ length: 28 }, (_, i) => (
              <span
                key={i}
                style={{
                  height: `${20 + Math.abs(Math.sin((i + stream.sequence) / 3)) * 65}%`,
                  background:
                    i < Math.round((fixture.possession / 100) * 28)
                      ? 'var(--lime)'
                      : 'var(--line-strong)',
                }}
              />
            ))}
          </div>
          <div className="pulse-key">
            <span>
              {fixture.homeCode} {fixture.possession}%
            </span>
            <span>
              {fixture.awayCode} {100 - fixture.possession}%
            </span>
          </div>
          <div className="shift-heading">
            <span className="tiny-cross">+</span>
            <h3>Leave a clear trail.</h3>
          </div>
          <p className="muted small-copy">
            Every local market decision gets a reason, a before, and an after.
          </p>
          <div className="recent-decisions">
            {book.journal.slice(0, 3).map((entry) => (
              <Link key={entry.id} to="/journal" className="decision">
                <span className="decision-icon">
                  {entry.kind === 'suspend' ? (
                    <CirclePause size={15} />
                  ) : (
                    <ArrowUpRight size={15} />
                  )}
                </span>
                <span>
                  <b>{entry.market}</b>
                  <small>
                    {entry.kind === 'price'
                      ? 'Manual prices set'
                      : entry.kind === 'release'
                        ? 'Returned to feed'
                        : entry.kind === 'suspend'
                          ? 'Market paused'
                          : 'Market resumed'}
                  </small>
                </span>
                <ArrowUpRight size={12} />
              </Link>
            ))}
            {!book.journal.length && (
              <div className="empty-decisions">
                <span>—</span>
                <p>
                  No decisions yet.
                  <br />
                  Make your first market call.
                </p>
              </div>
            )}
          </div>
          <Link to="/journal" className="panel-link">
            Open the journal <ArrowUpRight size={15} />
          </Link>
          <div className="desk-signoff">
            <span>
              MADE FOR THE
              <br />
              MOMENT.
            </span>
            <ArrowDownRight size={38} />
          </div>
        </aside>
      </div>
      <div className="desk-bottom">
        <span>
          <i className="signal-dot" /> FRAME {String(stream.sequence).padStart(5, '0')} /{' '}
          {stream.connection.toUpperCase()}
        </span>
        <p>Follow the play. Shape the market. Keep the record.</p>
        <Link to="/guide">
          A field guide <ArrowUpRight size={13} />
        </Link>
      </div>
      {editor && <MarketDialog editor={editor} dismiss={() => setEditor(null)} />}
    </>
  );
}
