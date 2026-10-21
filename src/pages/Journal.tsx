import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownToLine, ArrowRight, ArrowUpRight, BookOpen, Search } from 'lucide-react';
import { downloadFile, useDesk } from '../core/runtime';
export function JournalPage() {
  const { book } = useDesk();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const rows = book.journal.filter(
    (e) =>
      (kind === 'all' || e.kind === kind) &&
      `${e.fixture} ${e.market} ${e.reason}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="page-intro">
        <div>
          <p className="eyebrow">THE RECORD OF YOUR SHIFT</p>
          <h1>
            Every <span>decision.</span>
          </h1>
        </div>
        <button
          className="button"
          disabled={!book.journal.length}
          onClick={() =>
            downloadFile(
              'ryvqen-journal.json',
              JSON.stringify(
                {
                  product: 'RYVQEN',
                  exportedAt: new Date().toISOString(),
                  scope: 'Local demonstration actions; newest 200 retained.',
                  entries: book.journal,
                },
                null,
                2,
              ),
            )
          }
        >
          <ArrowDownToLine size={16} /> Export journal
        </button>
      </div>
      <div className="journal-summary">
        <span>
          <strong>{String(book.journal.length).padStart(2, '0')}</strong> SAVED DECISIONS
        </span>
        <p>
          A reason. A before. An after.
          <br />
          <span className="muted">Saved in this browser. Newest 200 retained.</span>
        </p>
      </div>
      <div className="filter-bar journal-filters">
        <label className="search-field">
          <Search size={16} />
          <input
            aria-label="Search journal"
            placeholder="Find a team, market, or reason…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label>
          <span className="sr-only">Action type</span>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="all">Every action</option>
            <option value="price">Price changes</option>
            <option value="suspend">Market pauses</option>
            <option value="resume">Market resumes</option>
            <option value="release">Returns to feed</option>
          </select>
        </label>
      </div>
      <div className="journal-list">
        {rows.map((e) => (
          <article className="journal-entry" key={e.id}>
            <div className="journal-time">
              <time dateTime={e.at}>
                {new Date(e.at).toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </time>
              <span>
                {new Date(e.at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
              </span>
            </div>
            <div className="journal-main">
              <div className="journal-kicker">
                <span className="action-tag">
                  {e.kind === 'price'
                    ? 'PRICES SET'
                    : e.kind === 'release'
                      ? 'FOLLOW FEED'
                      : e.kind === 'suspend'
                        ? 'PAUSED'
                        : 'RESUMED'}
                </span>
                <span>{e.fixture}</span>
              </div>
              <h2>{e.market}</h2>
              <p>{e.reason}</p>
              <div className="change-comparison">
                <span>
                  <small>BEFORE</small>
                  {e.before}
                </span>
                <ArrowRight size={16} />
                <span>
                  <small>AFTER</small>
                  {e.after}
                </span>
              </div>
            </div>
            <Link
              to={`/?event=${e.fixtureId}`}
              className="icon-button"
              aria-label={`Open ${e.fixture}`}
            >
              <ArrowUpRight size={19} />
            </Link>
          </article>
        ))}
        {!rows.length && (
          <div className="empty-state">
            <BookOpen size={32} />
            <h2>{book.journal.length ? 'Nothing matches yet.' : 'Your shift starts here.'}</h2>
            <p>
              {book.journal.length
                ? 'Try another search or action filter.'
                : 'Set a price or pause a market. Your decisions will appear here after they are saved.'}
            </p>
            <Link to="/" className="button primary">
              Go to the live desk <ArrowUpRight size={15} />
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
