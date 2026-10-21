import { Component, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  HashRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  Check,
  Compass,
  Grid2X2,
  Pause,
  Play,
  Radio,
  Search,
  X,
} from 'lucide-react';
import { connectFeed, desk, downloadFile, useDesk } from './core/runtime';
import { Mark } from './components/Visuals';
import { DeskPage } from './pages/Desk';
import { FixturesPage } from './pages/Fixtures';
import { JournalPage } from './pages/Journal';
import { SystemPage } from './pages/System';
import { GuidePage } from './pages/Guide';

function Workspace() {
  const { stream, book, notice, error, corrupt } = useDesk();
  const location = useLocation();
  const navigate = useNavigate();
  const main = useRef<HTMLElement>(null);
  const focusFixtureSearch = useRef(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetError, setResetError] = useState('');
  useEffect(() => connectFeed(), []);
  useEffect(() => {
    document.documentElement.dataset.motion = book.motionPaused ? 'paused' : 'full';
  }, [book.motionPaused]);
  useEffect(() => {
    const names: Record<string, string> = {
      '/': 'The live desk',
      '/fixtures': 'Every fixture',
      '/journal': 'The journal',
      '/system': 'The signal',
      '/guide': 'A field guide',
    };
    document.title = `RYVQEN — ${names[location.pathname] ?? 'Page not found'}`;
    const search = focusFixtureSearch.current
      ? main.current?.querySelector<HTMLInputElement>('[aria-label="Search all fixtures"]')
      : null;
    focusFixtureSearch.current = false;
    if (search) search.focus();
    else main.current?.focus({ preventScroll: true });
  }, [location.pathname]);
  useEffect(() => {
    const shortcut = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        !e.ctrlKey &&
        !e.metaKey &&
        !document.querySelector('dialog[open]') &&
        !(
          e.target instanceof HTMLElement &&
          (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable)
        )
      ) {
        e.preventDefault();
        if (location.pathname === '/fixtures')
          main.current
            ?.querySelector<HTMLInputElement>('[aria-label="Search all fixtures"]')
            ?.focus();
        else {
          focusFixtureSearch.current = true;
          navigate('/fixtures');
        }
      }
    };
    document.addEventListener('keydown', shortcut);
    return () => document.removeEventListener('keydown', shortcut);
  }, [navigate, location.pathname]);
  const feedActive = stream.connection === 'connected';
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          main.current?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className="sidebar" aria-label="Workspace tools">
        <Link className="brand-mark" to="/" aria-label="RYVQEN live desk">
          <Mark />
        </Link>
        <nav aria-label="Workspace navigation">
          <NavLink to="/" end>
            <Grid2X2 size={21} />
            <span>Desk</span>
          </NavLink>
          <NavLink to="/fixtures">
            <Compass size={21} />
            <span>Fixtures</span>
          </NavLink>
          <NavLink to="/journal">
            <BookOpen size={21} />
            <span>Journal</span>
          </NavLink>
          <NavLink to="/system">
            <Activity size={21} />
            <span>Signal</span>
          </NavLink>
        </nav>
        <NavLink to="/guide" className="sidebar-guide" aria-label="Field guide">
          ?<span>Guide</span>
        </NavLink>
        <span className="operator-avatar" aria-label="Local demonstration operator">
          RK
        </span>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <Link className="wordmark" to="/">
            RYVQEN<span>LIVE OPERATIONS</span>
          </Link>
          <div className="workspace-label">
            WORKSPACE <span>/</span> DEMO FLOOR
          </div>
          <div className="topbar-actions">
            <Link
              to="/fixtures"
              className="top-search"
              aria-keyshortcuts="/"
              aria-label="Find a fixture"
            >
              <Search size={17} />
              <span>Find a fixture</span>
              <kbd>/</kbd>
            </Link>
            <div className={`connection-control ${feedActive ? 'is-connected' : ''}`}>
              <span>
                <i />
                {feedActive ? 'REPLAY CONNECTED' : stream.connection.toUpperCase()}
              </span>
              <button
                aria-label={feedActive ? 'Pause replay feed' : 'Resume replay feed'}
                onClick={() => desk.control(feedActive ? 'pause' : 'resume')}
              >
                {feedActive ? <Pause size={13} /> : <Play size={13} />}
              </button>
            </div>
          </div>
        </header>
        <main id="main" ref={main} tabIndex={-1} className="main-content">
          {error && (
            <div className="storage-banner" role="alert">
              <div>
                <b>Workspace notice</b>
                <p>{error}</p>
              </div>
              {corrupt !== null ? (
                <div className="banner-actions">
                  <button
                    className="button"
                    onClick={() =>
                      downloadFile('ryvqen-workspace-backup.txt', corrupt, 'text/plain')
                    }
                  >
                    Download backup
                  </button>
                  <button className="button" onClick={() => setConfirmReset(true)}>
                    Reset unreadable data
                  </button>
                </div>
              ) : (
                <button className="button" onClick={desk.refresh}>
                  Try again
                </button>
              )}
            </div>
          )}
          {confirmReset && corrupt !== null && (
            <div className="reset-panel">
              <p>
                Resetting removes the unreadable workspace. Download its backup first. Continue?
              </p>
              <button className="button" onClick={() => setConfirmReset(false)}>
                Keep data
              </button>
              <button
                className="button"
                onClick={() => {
                  void desk
                    .resetCorrupt(corrupt)
                    .then(() => setConfirmReset(false))
                    .catch((e) => setResetError(e instanceof Error ? e.message : 'Reset failed.'));
                }}
              >
                Confirm reset
              </button>
              {resetError && <p role="alert">{resetError}</p>}
            </div>
          )}
          <Routes>
            <Route path="/" element={<DeskPage />} />
            <Route path="/fixtures" element={<FixturesPage />} />
            <Route path="/journal" element={<JournalPage />} />
            <Route path="/system" element={<SystemPage />} />
            <Route path="/guide" element={<GuidePage />} />
            <Route
              path="*"
              element={
                <div className="empty-state">
                  <p className="eyebrow">OFF THE FIELD / 404</p>
                  <h1>This page is out of play.</h1>
                  <Link to="/" className="button primary">
                    Back to the desk <ArrowUpRight size={16} />
                  </Link>
                </div>
              }
            />
          </Routes>
        </main>
        <footer className="app-footer">
          <span>
            <Radio size={13} /> INDEPENDENT PORTFOLIO CONCEPT <i>·</i> FICTIONAL SPORTS DATA
          </span>
          <div>
            <Link to="/guide">
              Rafayel Karamyan <ArrowUpRight size={11} />
            </Link>
            <button
              onClick={() => {
                void desk.toggleMotion().catch(() => {});
              }}
            >
              {book.motionPaused ? <Play size={12} /> : <Pause size={12} />}{' '}
              {book.motionPaused ? 'Resume motion' : 'Pause motion'}
            </button>
          </div>
        </footer>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{notice}</span>
          <button aria-label="Dismiss notification" onClick={desk.clearNotice}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="empty-state">
        <h1>The desk needs a restart.</h1>
        <p>Your saved workspace has not been reset.</p>
        <button className="button primary" onClick={() => window.location.reload()}>
          Reload the desk
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <Workspace />
      </HashRouter>
    </ErrorBoundary>
  );
}
