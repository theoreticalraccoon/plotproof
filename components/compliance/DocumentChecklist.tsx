"use client";

/**
 * The resolved document checklist, grouped by who produces each document:
 * "you can create these now" (self/platform, with an in-app action) vs.
 * "request these from an authority". Shared by the /sell results step and the
 * persistent /documents hub so the two never drift.
 *
 * Chrome (group titles, tags, buttons, status pills) follows the selected
 * language; the per-document guidance text stays English (see lib/i18n/strings).
 * When `statuses`/`onSetStatus` are provided, each item shows its progress and a
 * "Mark as done" toggle, the farmer's own record of where they are.
 */
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { t, useLang } from "@/lib/i18n";
import { cycleStatus, type StatusMap } from "@/lib/compliance/status";
import { hoverLift } from "@/lib/motion/variants";
import { useToast } from "@/components/shell/Toast";
import type { DocStatus, RequiredDocument } from "@/lib/compliance/types";

interface Props {
  documents: RequiredDocument[];
  statuses?: StatusMap;
  onSetStatus?: (documentTypeId: string, status: DocStatus) => void;
}

export default function DocumentChecklist({ documents, statuses, onSetStatus }: Props) {
  return (
    <>
      <DocGroup
        titleKey="group_self"
        docs={documents.filter((d) => d.issuer !== "authority")}
        statuses={statuses}
        onSetStatus={onSetStatus}
      />
      <DocGroup
        titleKey="group_authority"
        docs={documents.filter((d) => d.issuer === "authority")}
        statuses={statuses}
        onSetStatus={onSetStatus}
      />
    </>
  );
}

function DocGroup({
  titleKey,
  docs,
  statuses,
  onSetStatus,
}: {
  titleKey: string;
  docs: RequiredDocument[];
  statuses?: StatusMap;
  onSetStatus?: (documentTypeId: string, status: DocStatus) => void;
}) {
  const lang = useLang();
  const { toast } = useToast();
  if (docs.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide faint">{t(lang, titleKey)}</h2>
      <ul className="flex flex-col gap-3">
        {docs.map((d) => {
          const status: DocStatus = statuses?.[d.documentTypeId] ?? "not_started";
          return (
            <li key={d.documentTypeId} className="glass-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{d.name}</span>
                <IssuerTag issuer={d.issuer} />
                {statuses && <StatusPill status={status} />}
              </div>
              <p className="mt-1.5 text-sm">{d.what}</p>
              <p className="mt-1 text-xs muted"><span className="font-semibold">{t(lang, "why")}</span> {d.why}</p>
              <p className="mt-1 text-xs muted"><span className="font-semibold">{t(lang, "how")}</span> {d.howToObtain}</p>
              <p className="mt-1 text-xs faint">{t(lang, "basis")} {d.source}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {d.actionHref && (
                  <motion.div {...hoverLift}>
                    <Link href={d.actionHref} className="btn btn-primary btn-sm">
                      {t(lang, d.issuer === "authority" ? "prepare_draft" : "create_it")}
                    </Link>
                  </motion.div>
                )}
                {onSetStatus && (
                  <motion.div {...hoverLift}>
                    <button
                      onClick={() => {
                        const next = cycleStatus(status);
                        onSetStatus(d.documentTypeId, next);
                        toast(t(lang, next === "ready" ? "toast_marked_done" : "toast_marked_todo"));
                      }}
                      className={`btn btn-sm ${status === "ready" ? "btn-primary" : "btn-ghost"}`}
                    >
                      {status === "ready" ? (
                        <>
                          <CheckCircle2 size={14} /> {t(lang, "status_ready")}
                        </>
                      ) : (
                        t(lang, "mark_done")
                      )}
                    </button>
                  </motion.div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function StatusPill({ status }: { status: DocStatus }) {
  const lang = useLang();
  const map: Record<DocStatus, [string, string]> = {
    ready: ["status_ready", "tag-accent"],
    in_progress: ["status_in_progress", "tag-warn"],
    not_started: ["status_not_started", "tag-muted"],
  };
  const [key, cls] = map[status];
  return <span className={`tag ${cls}`}>{t(lang, key)}</span>;
}

function IssuerTag({ issuer }: { issuer: RequiredDocument["issuer"] }) {
  const lang = useLang();
  const map: Record<string, [string, string]> = {
    self: ["tag_self", "tag-info"],
    platform: ["tag_platform", "tag-accent"],
    authority: ["tag_authority", "tag-muted"],
  };
  const [key, cls] = map[issuer];
  return <span className={`tag ${cls}`}>{t(lang, key)}</span>;
}
