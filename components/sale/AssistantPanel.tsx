"use client";

/**
 * The export assistant, beside the sale it can see.
 *
 * On a wide screen it sits in the right-hand column next to the questionnaire.
 * On a phone it opens as a sheet from a button, because a chat stacked below a
 * long form is a chat nobody finds.
 *
 * Each sale keeps its own conversation for the session, so switching between
 * two consignments does not mix up two exporters' questions. Nothing is stored
 * after the tab closes: the conversation is working notes, not a record.
 */
import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, MessageSquare, Send, X } from "lucide-react";
import { t, type Lang } from "@/lib/i18n";
import { END, LIMITS } from "@/lib/assistant/protocol";
import { needsEudr } from "@/lib/sale/model";
import type { Sale } from "@/lib/sale/types";

interface Turn {
  role: "user" | "assistant";
  content: string;
  /** How an assistant turn ended, when it did not end normally. */
  ending?: "cut" | "refused" | "failed" | "unavailable";
}

/** Per-sale threads for this session. */
const threads = new Map<string, Turn[]>();

export default function AssistantPanel({ sale, lang }: { sale: Sale; lang: Lang }) {
  const [turns, setTurns] = useState<Turn[]>(() => threads.get(sale.id) ?? []);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [open, setOpen] = useState(false); // mobile sheet
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Switching sale switches thread.
  useEffect(() => {
    setTurns(threads.get(sale.id) ?? []);
    setProblem(null);
  }, [sale.id]);

  useEffect(() => {
    threads.set(sale.id, turns);
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [turns, sale.id]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const suggestions = [
    "assistant_q_missing",
    "assistant_q_incoterm",
    ...(needsEudr(sale) ? ["assistant_q_eudr"] : ["assistant_q_phyto"]),
  ];

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    if (q.length > LIMITS.maxMessageChars) {
      setProblem("too_long");
      return;
    }
    setProblem(null);
    const history: Turn[] = [...turns, { role: "user", content: q }];
    setTurns([...history, { role: "assistant", content: "" }]);
    setDraft("");
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
          sale,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setProblem(body.error ?? "failed");
        setTurns(history); // drop the empty assistant bubble
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        const visible = text.split(String.fromCharCode(0))[0];
        setTurns([...history, { role: "assistant", content: visible }]);
      }
      const ending = text.endsWith(END.cut)
        ? "cut"
        : text.endsWith(END.refused)
          ? "refused"
          : text.endsWith(END.unavailable)
            ? "unavailable"
            : text.endsWith(END.failed)
              ? "failed"
              : undefined;
      const visible = text.split(String.fromCharCode(0))[0];
      setTurns([...history, { role: "assistant", content: visible, ending }]);
    } catch {
      if (!controller.signal.aborted) {
        setProblem("offline");
        setTurns(history);
      }
    } finally {
      setBusy(false);
    }
  };

  const panel = (
    <section
      aria-labelledby="assistant-heading"
      className="glass-card flex h-full flex-col p-0 lg:max-h-[640px]"
    >
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--glass-hairline)" }}>
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
          >
            <Bot size={16} aria-hidden="true" />
          </span>
          <div>
            <h2 id="assistant-heading" className="text-[0.95rem] font-semibold leading-tight">
              {t(lang, "assistant_title")}
            </h2>
            <p className="text-[0.7rem] faint">{t(lang, "assistant_sub")}</p>
          </div>
        </div>
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-lg lg:hidden"
          onClick={() => setOpen(false)}
          aria-label={t(lang, "assistant_close")}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <div
        ref={listRef}
        className="min-h-[180px] flex-1 space-y-3 overflow-y-auto px-4 py-3"
        aria-live="polite"
        aria-busy={busy}
      >
        {turns.length === 0 && (
          <div>
            <p className="text-[0.85rem] muted">{t(lang, "assistant_intro")}</p>
            <ul className="mt-3 flex flex-col gap-2">
              {suggestions.map((k) => (
                <li key={k}>
                  <button
                    type="button"
                    className="w-full rounded-[var(--radius-sm)] border px-3 py-2.5 text-left text-[0.84rem] hover:bg-[var(--bg-1)]"
                    style={{ borderColor: "var(--glass-hairline)" }}
                    onClick={() => void send(t(lang, k))}
                  >
                    {t(lang, k)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {turns.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className="max-w-[92%] rounded-2xl px-3.5 py-2.5 text-[0.88rem] leading-relaxed"
              style={
                m.role === "user"
                  ? { background: "var(--accent)", color: "var(--accent-fg)" }
                  : { background: "var(--bg-1)" }
              }
            >
              {m.role === "assistant" && m.content === "" && busy ? (
                <span className="inline-flex items-center gap-2 faint">
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" /> {t(lang, "assistant_thinking")}
                </span>
              ) : (
                <Formatted text={m.content} />
              )}
              {m.ending && (
                <p className="mt-2 text-[0.75rem]" style={{ color: "var(--warn)" }}>
                  {t(lang, `assistant_end_${m.ending}`)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {problem && (
        <p className="mx-4 mb-2 rounded-lg px-3 py-2 text-[0.8rem]" role="alert" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>
          {t(lang, `assistant_err_${problem}`) === `assistant_err_${problem}`
            ? t(lang, "assistant_err_failed")
            : t(lang, `assistant_err_${problem}`)}
        </p>
      )}

      <form
        className="flex items-end gap-2 border-t p-3"
        style={{ borderColor: "var(--glass-hairline)" }}
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
      >
        <label htmlFor="assistant-input" className="sr-only">
          {t(lang, "assistant_input_label")}
        </label>
        <textarea
          id="assistant-input"
          rows={2}
          value={draft}
          maxLength={LIMITS.maxMessageChars}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(draft);
            }
          }}
          placeholder={t(lang, "assistant_placeholder")}
          className="field min-h-[48px] flex-1 resize-none"
        />
        <button
          type="submit"
          className="btn btn-primary flex h-12 w-12 shrink-0 items-center justify-center p-0"
          disabled={busy || !draft.trim()}
          aria-label={t(lang, "assistant_send")}
        >
          {busy ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <Send size={17} aria-hidden="true" />}
        </button>
      </form>
      <p className="px-4 pb-3 text-[0.68rem] faint">{t(lang, "assistant_disclaimer")}</p>
    </section>
  );

  return (
    <>
      {/* Desktop: in the side column. */}
      <div className="hidden lg:block">{panel}</div>

      {/* Phone and tablet: a button that opens the same panel as a sheet. */}
      <button
        type="button"
        className="btn btn-primary fixed bottom-5 right-5 z-40 inline-flex min-h-[52px] items-center gap-2 shadow-lg lg:hidden"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="assistant-sheet"
      >
        <MessageSquare size={18} aria-hidden="true" /> {t(lang, "assistant_open")}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden" role="dialog" aria-modal="true" aria-labelledby="assistant-heading">
          <button
            type="button"
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.35)" }}
            onClick={() => setOpen(false)}
            aria-label={t(lang, "assistant_close")}
          />
          <div id="assistant-sheet" className="relative h-[85dvh] p-2">
            {panel}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Plain-text answer with paragraphs, bullet lists and **bold** — and nothing
 * else. The model's output is never injected as HTML.
 */
function Formatted({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).filter((b) => b.trim());
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        const isList = lines.every((l) => /^\s*([-*•]|\d+\.)\s+/.test(l));
        if (isList) {
          return (
            <ul key={i} className="my-1.5 list-disc space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{bold(l.replace(/^\s*([-*•]|\d+\.)\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className={i > 0 ? "mt-2" : undefined}>
            {lines.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {bold(l)}
              </span>
            ))}
          </p>
        );
      })}
    </>
  );
}

function bold(s: string) {
  const parts = s.split(/\*\*(.+?)\*\*/g);
  return parts.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : <span key={i}>{p}</span>));
}
