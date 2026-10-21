import {
  Activity,
  ArrowRight,
  Copy,
  Database,
  Link2,
  Pause,
  Play,
  Radio,
  RefreshCw,
  ShieldCheck,
  SkipForward,
} from 'lucide-react';
import { desk, useDesk, websocketMode } from '../core/runtime';
export function SystemPage() {
  const { stream, book, rejectNext } = useDesk();
  return (
    <>
      <div className="page-intro">
        <div>
          <p className="eyebrow">SEE WHAT'S UNDER THE SURFACE</p>
          <h1>
            Keep the <span>signal.</span>
          </h1>
        </div>
        <span className={`system-status ${stream.connection === 'connected' ? 'healthy' : ''}`}>
          <i />
          {stream.connection.toUpperCase()}
        </span>
      </div>
      <div className="system-metrics">
        {[
          ['Accepted frames', stream.received, Radio],
          ['Discarded frames', stream.dropped, Copy],
          ['Invalid payloads', stream.invalid, ShieldCheck],
          ['Sequence gaps', stream.gaps, SkipForward],
        ].map(([label, value, Icon]) => {
          const I = Icon as typeof Radio;
          return (
            <div key={String(label)}>
              <span>
                <I size={16} />
                {String(label)}
              </span>
              <strong>{String(value).padStart(2, '0')}</strong>
            </div>
          );
        })}
      </div>
      <div className="system-grid">
        <section className="system-section">
          <span className="section-number">01 / THE TRANSPORT</span>
          <h2>A visible data path.</h2>
          <dl className="system-details">
            <div>
              <dt>Source</dt>
              <dd>Fictional fixtures & decimal prices</dd>
            </div>
            <div>
              <dt>Transport</dt>
              <dd>{websocketMode ? 'Local WebSocket server' : 'Browser worker replay'}</dd>
            </div>
            <div>
              <dt>Sequence</dt>
              <dd>#{String(stream.sequence).padStart(6, '0')}</dd>
            </div>
            <div>
              <dt>Last accepted frame</dt>
              <dd>
                {stream.lastReceivedAt
                  ? new Date(stream.lastReceivedAt).toLocaleTimeString('en-GB')
                  : 'Waiting for the first frame'}
              </dd>
            </div>
            <div>
              <dt>Snapshot size</dt>
              <dd>{stream.fixtures.length} fixtures</dd>
            </div>
            <div>
              <dt>Workspace revision</dt>
              <dd>{book.revision}</dd>
            </div>
            <div>
              <dt>Cross-tab coordination</dt>
              <dd>
                {navigator.locks
                  ? 'Web Locks + revision checks'
                  : 'Revision checks (non-atomic fallback)'}
              </dd>
            </div>
          </dl>
          <p className="small-copy muted">
            The public demo runs entirely in your browser. A separately runnable Node.js WebSocket
            adapter uses the same data protocol. No external sports feed is connected.
          </p>
        </section>
        <section className="system-section">
          <span className="section-number">02 / TRY THE EDGES</span>
          <h2>
            Break the rhythm.
            <br />
            Watch it recover.
          </h2>
          <p className="small-copy muted">
            Controls below exercise the real client reducer. Counters reflect frames handled during
            this session.
          </p>
          <div className="scenario-list">
            <div>
              <span>
                <Link2 size={18} />
                <span>
                  <b>Interrupt the feed</b>
                  <small>Market writes stop until a fresh snapshot arrives.</small>
                </span>
              </span>
              <button
                className="button"
                onClick={() => desk.control(stream.connection === 'connected' ? 'pause' : 'resume')}
              >
                {stream.connection === 'connected' ? <Pause size={14} /> : <Play size={14} />}{' '}
                {stream.connection === 'connected' ? 'Pause' : 'Reconnect'}
              </button>
            </div>
            <div>
              <span>
                <Copy size={18} />
                <span>
                  <b>Duplicate a frame</b>
                  <small>A repeated sequence cannot change the current state.</small>
                </span>
              </span>
              <button
                className="button"
                disabled={websocketMode || stream.connection !== 'connected'}
                onClick={() => desk.control('duplicate')}
              >
                Send duplicate <ArrowRight size={14} />
              </button>
            </div>
            <div>
              <span>
                <Activity size={18} />
                <span>
                  <b>Deliver an old frame</b>
                  <small>Late data is counted and discarded.</small>
                </span>
              </span>
              <button
                className="button"
                disabled={websocketMode || stream.connection !== 'connected' || stream.sequence < 3}
                onClick={() => desk.control('late')}
              >
                Send late frame <ArrowRight size={14} />
              </button>
            </div>
            <div>
              <span>
                <SkipForward size={18} />
                <span>
                  <b>Skip a sequence</b>
                  <small>A gap triggers a complete snapshot, then resumes.</small>
                </span>
              </span>
              <button
                className="button"
                disabled={websocketMode || stream.connection !== 'connected'}
                onClick={() => desk.control('gap')}
              >
                Create a gap <ArrowRight size={14} />
              </button>
            </div>
            <div>
              <span>
                <ShieldCheck size={18} />
                <span>
                  <b>Reject one market request</b>
                  <small>A failed request must leave prices and journal unchanged.</small>
                </span>
              </span>
              <button className="button" aria-pressed={rejectNext} onClick={desk.rejectNextChange}>
                {rejectNext ? 'Cancel scenario' : 'Reject next change'} <ArrowRight size={14} />
              </button>
            </div>
            <div>
              <span>
                <RefreshCw size={18} />
                <span>
                  <b>Request a clean snapshot</b>
                  <small>Refresh feed values without releasing manual prices.</small>
                </span>
              </span>
              <button
                className="button"
                disabled={stream.connection === 'paused'}
                onClick={() => desk.control('snapshot')}
              >
                Resync <RefreshCw size={14} />
              </button>
            </div>
          </div>
        </section>
      </div>
      <div className="system-footnote">
        <Database size={18} />
        <p>
          Market decisions, watchlists and motion preferences persist on this device. Feed position
          and session counters restart on a full reload. Your journal records the sequence observed
          at each decision.
        </p>
      </div>
    </>
  );
}
