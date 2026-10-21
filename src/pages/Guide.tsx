import { ArrowUpRight, Radio, SlidersHorizontal, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
export function GuidePage() {
  return (
    <>
      <div className="page-intro">
        <div>
          <p className="eyebrow">AN INDEPENDENT INTERACTIVE CONCEPT</p>
          <h1>
            Made for the <span>moment.</span>
          </h1>
        </div>
      </div>
      <div className="guide-lead">
        <p>
          A small field guide
          <br />
          to the live desk.
        </p>
        <span>
          DESIGN & DEVELOPMENT
          <br />
          <strong>Rafayel Karamyan</strong>
        </span>
      </div>
      <div className="guide-steps">
        {[
          [
            Radio,
            '01',
            'Read the play.',
            'Start at the live desk. Choose an event, follow the illustrative tracker, and watch replay prices move. Save a fixture to build your watchlist.',
          ],
          [
            SlidersHorizontal,
            '02',
            'Make the call.',
            'Select a price to set manual values. Add a reason, then apply. Pause a market, resume it, or release your manual prices back to the feed.',
          ],
          [
            BookOpen,
            '03',
            'Keep the record.',
            'Open the journal to see what changed and why. Filter decisions or download a JSON record. Reload the page; saved decisions remain on this device.',
          ],
        ].map(([Icon, n, title, text]) => {
          const I = Icon as typeof Radio;
          return (
            <section key={String(n)}>
              <span className="section-number">
                {String(n)}
                <I size={22} />
              </span>
              <h2>{String(title)}</h2>
              <p>{String(text)}</p>
            </section>
          );
        })}
      </div>
      <div className="guide-details">
        <section>
          <h2>Built to be explored.</h2>
          <p>
            Open Signal to try duplicate messages, late frames, a skipped sequence, or a
            disconnected feed. Inspect how the interface recovers before you continue editing.
          </p>
          <p>
            Use the paginated fixture view for uninterrupted keyboard browsing. Press / to find a
            fixture. Motion can be paused at any time and follows your system preference.
          </p>
          <Link to="/system" className="button">
            Explore the signal <ArrowUpRight size={16} />
          </Link>
        </section>
        <section>
          <h2>A clear boundary.</h2>
          <p>
            RYVQEN is an original portfolio project. Events, teams, prices and trackers are
            fictional. Prices demonstrate UI and data behavior; they are not real sports
            information.
          </p>
          <p>
            Changes are local demonstrations, not shared trading actions or real accounts. Clearing
            browser data removes the workspace. The newest 200 journal entries are retained.
          </p>
          <p>
            All crests, field graphics and the visual identity were made for this project. Fonts:
            Space Grotesk and IBM Plex Mono, under their included open font licenses.
          </p>
        </section>
      </div>
      <Link to="/" className="guide-cta">
        Your next move.
        <ArrowUpRight />
      </Link>
    </>
  );
}
