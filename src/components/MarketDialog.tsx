import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, X } from 'lucide-react';
import { desk } from '../core/runtime';
import { effectiveMarket, formatPrice, parsePrice } from '../core/model';
import type { ActionKind, Fixture, Market } from '../core/model';

export type Editor = { fixture: Fixture; market: Market; kind: ActionKind };
const titles = {
  price: 'Set the price.',
  suspend: 'Pause the market.',
  resume: 'Back in play.',
  release: 'Return to the feed.',
};
export function MarketDialog({ editor, dismiss }: { editor: Editor; dismiss: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [initial] = useState(() => desk.getSnapshot().book);
  const original = effectiveMarket(editor.market, initial.overrides[editor.market.id]);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(original.outcomes.map((o) => [o.id, formatPrice(o.price)])),
  );
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const previous = document.activeElement;
    const el = dialog.current;
    el?.showModal();
    return () => {
      el?.close();
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    const prices: Record<string, number> = {};
    if (editor.kind === 'price') {
      for (const outcome of editor.market.outcomes) {
        const price = parsePrice(values[outcome.id] ?? '');
        if (price === null) {
          setError('Every price must be between 1.01 and 1000.00, with up to two decimals.');
          return;
        }
        prices[outcome.id] = price;
      }
    }
    if (reason.trim().length < 4) {
      setError('Add a short reason (at least 4 characters).');
      return;
    }
    setError('');
    setPending(true);
    try {
      await desk.mutate({
        kind: editor.kind,
        fixtureId: editor.fixture.id,
        marketId: editor.market.id,
        expectedRevision: initial.overrides[editor.market.id]?.revision ?? 0,
        generation: initial.generation,
        reason,
        ...(editor.kind === 'price' ? { prices } : {}),
      });
      dismiss();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The change could not be applied.');
      setPending(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      aria-labelledby="editor-title"
      className="market-dialog"
      onCancel={(e) => {
        e.preventDefault();
        if (!pending) dismiss();
      }}
    >
      <form
        onSubmit={(e) => {
          void submit(e);
        }}
      >
        <div className="dialog-top">
          <span className="eyebrow">MARKET CONTROL / LOCAL DEMO</span>
          <button
            type="button"
            className="icon-button"
            aria-label="Close market editor"
            disabled={pending}
            onClick={dismiss}
          >
            <X size={20} />
          </button>
        </div>
        <h2 id="editor-title">{titles[editor.kind]}</h2>
        <p className="muted">
          {editor.fixture.home} / {editor.fixture.away}
          <br />
          <strong className="text">{editor.market.name}</strong>
        </p>
        {editor.kind === 'price' ? (
          <>
            <div className="price-inputs">
              {original.outcomes.map((o) => (
                <label key={o.id}>
                  {o.label}
                  <input
                    autoFocus={o.id === original.outcomes[0]?.id}
                    inputMode="decimal"
                    value={values[o.id] ?? ''}
                    disabled={pending}
                    onChange={(e) => setValues({ ...values, [o.id]: e.target.value })}
                    aria-label={`${o.label} price`}
                    maxLength={7}
                    required
                  />
                </label>
              ))}
            </div>
            <p className="fine-print">
              Manual prices remain fixed as the replay moves. Use “Return to feed” to follow the
              feed again.
            </p>
          </>
        ) : (
          <p className="dialog-explainer">
            {editor.kind === 'suspend'
              ? 'This market will stop accepting local price changes until you resume it. Other markets keep moving.'
              : editor.kind === 'resume'
                ? 'This market will reopen with its current pricing source.'
                : 'Your manual prices will be released. The latest replay prices will take over; any local suspension stays in place.'}
          </p>
        )}
        <label className="field-label" htmlFor="market-reason">
          Reason for change <span>Required</span>
        </label>
        <textarea
          id="market-reason"
          autoFocus={editor.kind !== 'price'}
          value={reason}
          maxLength={240}
          rows={3}
          placeholder="What should the next operator know?"
          disabled={pending}
          onChange={(e) => setReason(e.target.value)}
          aria-describedby={error ? 'editor-error' : undefined}
        />
        {error && (
          <p role="alert" id="editor-error" className="form-error">
            {error}
          </p>
        )}
        <div className="dialog-footer">
          <span>
            <Check size={14} /> Recorded only after a successful save
          </span>
          <button type="submit" className="button primary" disabled={pending}>
            {pending ? 'Applying…' : 'Apply change'}
            <ArrowUpRight size={17} />
          </button>
        </div>
      </form>
    </dialog>
  );
}
