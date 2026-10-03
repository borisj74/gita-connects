import { useMemo, useState } from 'react';
import type { Edge } from 'reactflow';
import { Check, ShieldCheck } from 'lucide-react';
import type { CheckLink, CheckResult, Verdict } from '../aiCheck.js';
import { getTypeColor, getTypeLabel, type ConnectionTypeDef } from '../connectionTypes.js';

const MAX_VERSES_SENT = 40;
// Descriptions the connection dialog fills in when the reader writes none;
// they say nothing, so they are not sent as the reader's note.
const PLACEHOLDER_NOTE = /^(User-created connection|.+ connection)$/;

const VERDICT_LABEL: Record<Verdict, string> = {
  strong: 'Holds strongly',
  sound: 'Holds',
  weak: 'Weak link',
  stretch: 'A stretch',
};

interface AiCheckSectionProps {
  networkVerses: Set<string>;
  networkEdges: Edge[];
  connectionTypes: ConnectionTypeDef[];
  /** False on builds without accounts: the section is hidden. */
  cloudEnabled: boolean;
  /** The signed-in reader's Supabase access token, or null when signed out. */
  accessToken: string | null;
  onSignIn: () => void;
  onRetype: (edgeId: string, typeId: string) => void;
}

const typeOf = (e: Edge) => (e.data?.typeId as string | undefined) ?? String(e.label ?? '');

/** Connections the reader made or accepted; the app's own scholarly links are not checked. */
function readerLinks(edges: Edge[]): CheckLink[] {
  return edges
    .filter((e) => /-(user|suggested)-/.test(e.id))
    .map((e) => {
      const note = (e.data?.description as string | undefined)?.trim();
      return {
        id: e.id,
        from: e.source,
        to: e.target,
        type: typeOf(e),
        note: note && !PLACEHOLDER_NOTE.test(note) ? note : undefined,
      };
    });
}

/**
 * "Check with AI", for signed-in readers: TypeSafe judges whether each
 * connection the reader drew holds and whether another type fits it better,
 * names what the network is mostly about, and picks a reflection question.
 */
export default function AiCheckSection({
  networkVerses,
  networkEdges,
  connectionTypes,
  cloudEnabled,
  accessToken,
  onSignIn,
  onRetype,
}: AiCheckSectionProps) {
  const links = useMemo(() => readerLinks(networkEdges), [networkEdges]);
  // Which connections a result is about. Changing a link's type (say, taking
  // the AI's suggestion) does not make the check stale; adding or removing
  // links or verses does.
  const scope = useMemo(
    () => JSON.stringify([[...networkVerses].sort(), links.map((l) => l.id).sort()]),
    [networkVerses, links],
  );
  const [state, setState] = useState<
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'done'; scope: string; result: CheckResult; retyped: Record<string, string> }
  >({ status: 'idle' });

  if (!cloudEnabled) return null;

  const run = async () => {
    if (!accessToken) return;
    setState({ status: 'loading' });
    // The verses the links touch go first, so they survive the cap.
    const touched = new Set(links.flatMap((l) => [l.from, l.to]));
    const verses = [...touched, ...[...networkVerses].filter((v) => !touched.has(v))].slice(0, MAX_VERSES_SENT);
    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ verses, links }),
      });
      const json = (await res.json().catch(() => ({}))) as Partial<CheckResult> & { error?: string };
      if (!res.ok || !json.links) throw new Error(json.error ?? 'The AI check failed. Try again.');
      setState({ status: 'done', scope, result: json as CheckResult, retyped: {} });
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  };

  const retype = (edgeId: string, typeId: string) => {
    onRetype(edgeId, typeId);
    setState((s) => (s.status === 'done' ? { ...s, retyped: { ...s.retyped, [edgeId]: typeId } } : s));
  };

  const linkById = new Map(links.map((l) => [l.id, l]));
  const done = state.status === 'done' ? state : null;
  const stale = done !== null && done.scope !== scope;

  return (
    <section className="insights-section insights-ai">
      <h3 className="insights-heading">
        <ShieldCheck size={13} strokeWidth={2.4} aria-hidden="true" />
        Check with AI
      </h3>

      {!accessToken ? (
        <>
          <p className="insights-hint">Sign in to have AI check whether the connections you drew hold.</p>
          <button type="button" className="insights-ai-button is-quiet" onClick={onSignIn}>
            Sign in
          </button>
        </>
      ) : links.length === 0 ? (
        <p className="insights-hint">Draw a connection of your own, and AI can check whether it holds.</p>
      ) : (
        <>
          {(!done || stale) && (
            <>
              {stale && <p className="insights-hint">Your network changed since the last check.</p>}
              <button
                type="button"
                className="insights-ai-button"
                onClick={run}
                disabled={state.status === 'loading'}
                aria-busy={state.status === 'loading'}
              >
                {state.status === 'loading'
                  ? 'Checking…'
                  : `${stale ? 'Check again' : 'Check my connections'} (${links.length})`}
              </button>
            </>
          )}

          {state.status === 'error' && (
            <p className="insights-ai-error" role="alert">
              {state.message}
            </p>
          )}

          {done && (
            <div className={`insights-ai-result ${stale ? 'is-stale' : ''}`} aria-live="polite">
              {done.result.theme && (
                <p className="insights-ai-theme">
                  Mostly about <strong>{done.result.theme.concept}</strong>
                </p>
              )}
              <ul className="insights-ai-links">
                {done.result.links.map((v) => {
                  const link = linkById.get(v.id);
                  if (!link) return null;
                  const retypedTo = done.retyped[v.id];
                  const shownType = retypedTo ?? link.type;
                  return (
                    <li key={v.id} className="insights-ai-link">
                      <div className="insights-ai-link-row">
                        <span className="insights-ai-pair">
                          {link.from} → {link.to}
                        </span>
                        <span className="insights-ai-type">
                          <span
                            className="insights-ai-dot"
                            style={{ background: getTypeColor(connectionTypes, shownType) }}
                          />
                          {getTypeLabel(connectionTypes, shownType)}
                        </span>
                        <span className={`insights-ai-verdict is-${v.verdict}`}>{VERDICT_LABEL[v.verdict]}</span>
                      </div>
                      {retypedTo ? (
                        <p className="insights-ai-suggest is-done">
                          <Check size={13} strokeWidth={2.6} aria-hidden="true" /> Changed to{' '}
                          {getTypeLabel(connectionTypes, retypedTo)}
                        </p>
                      ) : (
                        v.suggestedType &&
                        v.suggestedType !== link.type && (
                          <p className="insights-ai-suggest">
                            Fits better as {getTypeLabel(connectionTypes, v.suggestedType)}
                            <button
                              type="button"
                              className="insights-ai-change"
                              onClick={() => retype(v.id, v.suggestedType!)}
                            >
                              Change
                            </button>
                          </p>
                        )
                      )}
                    </li>
                  );
                })}
              </ul>
              {done.result.total > done.result.checked && (
                <p className="insights-hint">
                  Checked {done.result.checked} of your {done.result.total} connections.
                </p>
              )}
              {done.result.question && (
                <p className="insights-ai-question">
                  <span>To reflect on</span>
                  {done.result.question}
                </p>
              )}
              <p className="insights-ai-note">
                An AI judgement, and it can be wrong. It sees the app's own summaries and concepts and your
                notes, never the translation.
                {typeof done.result.remaining === 'number' && ` ${done.result.remaining} checks left today.`}
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
