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
 * "Mark as done" toggle — the farmer's own record of where they are.
 */
import Link from "next/link";
import { t, useLang } from "@/lib/i18n";
import { cycleStatus, type StatusMap } from "@/lib/compliance/status";
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
  if (docs.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-gray-700">{t(lang, titleKey)}</h2>
      <ul className="flex flex-col gap-2">
        {docs.map((d) => {
          const status: DocStatus = statuses?.[d.documentTypeId] ?? "not_started";
          return (
            <li key={d.documentTypeId} className="rounded-lg border border-gray-200 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{d.name}</span>
                <IssuerTag issuer={d.issuer} />
                {statuses && <StatusPill status={status} />}
              </div>
              <p className="mt-1 text-sm text-gray-700">{d.what}</p>
              <p className="text-xs text-gray-500">{t(lang, "why")} {d.why}</p>
              <p className="mt-1 text-xs text-gray-500">{t(lang, "how")} {d.howToObtain}</p>
              <p className="text-xs text-gray-400">{t(lang, "basis")} {d.source}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {d.actionHref && (
                  <Link
                    href={d.actionHref}
                    className="inline-block rounded bg-green-600 px-3 py-1.5 text-sm text-white"
                  >
                    {t(lang, d.issuer === "authority" ? "prepare_draft" : "create_it")}
                  </Link>
                )}
                {onSetStatus && (
                  <button
                    onClick={() => onSetStatus(d.documentTypeId, cycleStatus(status))}
                    className={`rounded border px-3 py-1.5 text-sm ${
                      status === "ready"
                        ? "border-green-600 text-green-700"
                        : "border-gray-300 text-gray-600 hover:border-gray-500"
                    }`}
                  >
                    {status === "ready" ? `✓ ${t(lang, "status_ready")}` : t(lang, "mark_done")}
                  </button>
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
    ready: ["status_ready", "bg-green-100 text-green-800"],
    in_progress: ["status_in_progress", "bg-amber-100 text-amber-800"],
    not_started: ["status_not_started", "bg-gray-100 text-gray-500"],
  };
  const [key, cls] = map[status];
  return <span className={`rounded px-2 py-0.5 text-xs ${cls}`}>{t(lang, key)}</span>;
}

function IssuerTag({ issuer }: { issuer: RequiredDocument["issuer"] }) {
  const lang = useLang();
  const map: Record<string, [string, string]> = {
    self: ["tag_self", "bg-blue-100 text-blue-800"],
    platform: ["tag_platform", "bg-green-100 text-green-800"],
    authority: ["tag_authority", "bg-gray-100 text-gray-600"],
  };
  const [key, cls] = map[issuer];
  return <span className={`rounded px-2 py-0.5 text-xs ${cls}`}>{t(lang, key)}</span>;
}
