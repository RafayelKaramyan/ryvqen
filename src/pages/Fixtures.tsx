import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, List, Search, SlidersHorizontal, Star } from 'lucide-react';
import { desk, useDesk } from '../core/runtime';
import { FixtureRow, VirtualFixtures } from '../components/FixturesList';

export function FixturesPage() {
  const { stream, book } = useDesk();
  const [params, setParams] = useSearchParams();
  const [paginated, setPaginated] = useState(false);
  const query = params.get('q') ?? '';
  const sport = params.get('sport') ?? 'all';
  const phase = params.get('phase') ?? 'all';
  const saved = params.get('saved') === '1';
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value && value !== 'all') next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setParams(next, { replace: true });
  };
  const matches = stream.fixtures.filter(
    (f) =>
      `${f.home} ${f.away} ${f.league}`.toLowerCase().includes(query.toLowerCase()) &&
      (sport === 'all' || f.sport === sport) &&
      (phase === 'all' || f.phase === phase) &&
      (!saved || book.watchlist.includes(f.id)),
  );
  const pageCount = Math.max(1, Math.ceil(matches.length / 20));
  const rawPage = Number(params.get('page') ?? 1);
  const page = Number.isInteger(rawPage) ? Math.max(1, Math.min(pageCount, rawPage)) : 1;
  const watch = (id: string) => {
    void desk.watch(id).catch(() => {});
  };
  return (
    <>
      <div className="page-intro">
        <div>
          <p className="eyebrow">THE WHOLE FIELD</p>
          <h1>
            Every <span>fixture.</span>
          </h1>
        </div>
        <p className="intro-description">
          Find your next focus.
          <br />
          240 fictional fixtures. One clear view.
        </p>
      </div>
      <section className="directory">
        <div className="filter-bar">
          <label className="search-field">
            <Search size={17} />
            <input
              aria-label="Search all fixtures"
              placeholder="Search teams or competitions…"
              value={query}
              onChange={(e) => set('q', e.target.value)}
            />
          </label>
          <label>
            <span className="sr-only">Sport</span>
            <select value={sport} onChange={(e) => set('sport', e.target.value)}>
              <option value="all">All sports</option>
              <option value="football">Football</option>
              <option value="basketball">Basketball</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Fixture status</span>
            <select value={phase} onChange={(e) => set('phase', e.target.value)}>
              <option value="all">All statuses</option>
              <option value="live">In play</option>
              <option value="upcoming">Upcoming</option>
              <option value="finished">Finished</option>
            </select>
          </label>
          <button
            className={`button ${saved ? 'active' : ''}`}
            aria-pressed={saved}
            onClick={() => set('saved', saved ? '' : '1')}
          >
            <Star size={15} /> Watchlist
          </button>
        </div>
        <div className="directory-heading">
          <span>
            <SlidersHorizontal size={14} /> {matches.length} MATCHING FIXTURES
          </span>
          <button
            className="text-button"
            aria-pressed={paginated}
            onClick={() => setPaginated(!paginated)}
          >
            <List size={15} />
            {paginated ? 'Use scrolling view' : 'Use paginated view'}
          </button>
        </div>
        {!matches.length ? (
          <div className="empty-state">
            <Search size={30} />
            <h2>No fixtures in sight.</h2>
            <p>Try a different team, competition, or filter.</p>
            <button className="button" onClick={() => setParams({})}>
              Clear all filters
            </button>
          </div>
        ) : paginated ? (
          <>
            <div className="paginated-list">
              {matches.slice((page - 1) * 20, page * 20).map((f) => (
                <div key={f.id}>
                  <span className="fixture-league">
                    {f.league} / {f.id.toUpperCase()}
                  </span>
                  <FixtureRow fixture={f} saved={book.watchlist.includes(f.id)} watch={watch} />
                </div>
              ))}
            </div>
            <nav className="pagination" aria-label="Fixture pages">
              <button
                className="button"
                disabled={page <= 1}
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.set('page', String(page - 1));
                  setParams(next);
                }}
              >
                <ArrowLeft size={15} /> Previous
              </button>
              <span>
                Page {page} of {pageCount}
              </span>
              <button
                className="button"
                disabled={page >= pageCount}
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.set('page', String(page + 1));
                  setParams(next);
                }}
              >
                Next <ArrowRight size={15} />
              </button>
            </nav>
          </>
        ) : (
          <VirtualFixtures
            key={`${query}-${sport}-${phase}-${saved}`}
            fixtures={matches}
            watchlist={book.watchlist}
            watch={watch}
          />
        )}
        <p className="directory-note">
          The scrolling view renders visible rows. The paginated view keeps every page fully
          reachable by keyboard. Event times are shown in UTC.
        </p>
      </section>
    </>
  );
}
