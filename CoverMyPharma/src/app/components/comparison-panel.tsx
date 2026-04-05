import { useState } from "react";
import { AlertTriangle, ExternalLink, FileText, Trash2, X } from "lucide-react";

import {
  PlanCard,
  PAYER_COLORS,
  DEFAULT_PAYER_STYLE,
  formatPlanDrugHeading,
  getPlanClinicalCriteria,
  getPlanConditions,
  getPlanPriorAuthRequirement,
} from "./mock-data";
import { TtsIconButton } from "./tts-icon-button";
import {
  buildComparisonSpeechSummary,
  formatEffectiveDate,
  PLAYBACK_SPEED_OPTIONS,
  VOICE_OPTIONS,
} from "./tts";

interface ComparisonPanelProps {
  plans: PlanCard[];
  onClose: () => void;
  voiceId?: string;
  onVoiceChange: (voiceId: string) => void;
  playbackRate?: number;
  onPlaybackRateChange: (playbackRate: number) => void;
  onDeleteDocument?: (documentId: string) => boolean | Promise<boolean>;
  onPlanDeleted?: (planId: string) => void;
}

const CRITERIA_ROWS: {
  key: string;
  label: string;
  accessor: (plan: PlanCard) => string;
}[] = [
  {
    key: "drugGeneric",
    label: "Drug Name / Generic Name",
    accessor: (plan) => formatPlanDrugHeading(plan),
  },
  {
    key: "conditions",
    label: "Conditions / Diagnosis",
    accessor: (plan) => getPlanConditions(plan),
  },
  {
    key: "priorAuth",
    label: "Prior Auth Req For Drug",
    accessor: (plan) => getPlanPriorAuthRequirement(plan),
  },
  {
    key: "clinicalCriteria",
    label: "Clinical Criteria",
    accessor: (plan) => getPlanClinicalCriteria(plan),
  },
  {
    key: "effective",
    label: "Effective Date Of Coverage",
    accessor: (plan) => formatEffectiveDate(plan.effectiveDate),
  },
  {
    key: "diagnosisCodes",
    label: "Diagnosis Codes",
    accessor: (plan) => plan.diagnosisCodes.join(", "),
  },
];

function highlightDiffs(values: string[]): boolean[] {
  if (values.length < 2) return values.map(() => false);
  const first = values[0];
  return values.map((value) => value !== first);
}

export function ComparisonPanel({
  plans,
  onClose,
  voiceId,
  onVoiceChange,
  playbackRate = 1,
  onPlaybackRateChange,
  onDeleteDocument,
  onPlanDeleted,
}: ComparisonPanelProps) {
  const [sourceOpen, setSourceOpen] = useState<Record<string, boolean>>({});
  const [deleteTarget, setDeleteTarget] = useState<PlanCard | null>(null);

  const comparisonSummary = buildComparisonSpeechSummary(plans);
  const comparisonGridStyle = {
    gridTemplateColumns: `180px repeat(${plans.length}, minmax(0, 1fr))`,
  };

  const toggleSource = (planId: string) => {
    setSourceOpen((prev) => ({ ...prev, [planId]: !prev[planId] }));
  };

  return (
    <section
      className="border-t-2 border-border bg-card"
      aria-label="Plan comparison grid"
      role="region"
    >
      <div className="p-6 max-w-full mx-auto">
        {deleteTarget?.documentId && onDeleteDocument ? (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
            role="presentation"
            onClick={() => setDeleteTarget(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-compare-doc-title"
              className="bg-card border border-border rounded-xl shadow-lg max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="delete-compare-doc-title" className="mt-0 mb-2">
                Delete this document?
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                This removes{" "}
                <strong>{formatPlanDrugHeading(deleteTarget)}</strong> (
                {deleteTarget.payer}) from your account and database. This
                cannot be undone.
              </p>
              <div className="flex flex-wrap gap-3 justify-end">
                <button
                  type="button"
                  className="px-4 py-2.5 min-h-[44px] rounded-lg border border-border text-sm hover:bg-muted"
                  onClick={() => setDeleteTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-4 py-2.5 min-h-[44px] rounded-lg bg-destructive text-destructive-foreground text-sm hover:opacity-90"
                  onClick={async () => {
                    const docId = deleteTarget.documentId;
                    if (!docId || !onDeleteDocument) return;
                    const ok = await onDeleteDocument(docId);
                    if (ok) {
                      onPlanDeleted?.(deleteTarget.id);
                      setDeleteTarget(null);
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between mb-5 gap-3">
          <h2 className="mt-0">Split-Screen Diff - {plans.length} Plans</h2>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <label
              htmlFor="comparison-voice-select"
              className="text-sm text-muted-foreground"
            >
              Voice
            </label>
            <select
              id="comparison-voice-select"
              value={voiceId}
              onChange={(e) => onVoiceChange(e.target.value)}
              className="px-3 py-2 min-h-[44px] rounded-lg border border-border bg-input-background text-sm min-w-[140px]"
            >
              {VOICE_OPTIONS.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.label}
                </option>
              ))}
            </select>
            <label
              htmlFor="comparison-speed-select"
              className="text-sm text-muted-foreground"
            >
              Speed
            </label>
            <select
              id="comparison-speed-select"
              value={String(playbackRate)}
              onChange={(e) => onPlaybackRateChange(Number(e.target.value))}
              className="px-3 py-2 min-h-[44px] rounded-lg border border-border bg-input-background text-sm min-w-[96px]"
            >
              {PLAYBACK_SPEED_OPTIONS.map((speed) => (
                <option key={speed.label} value={speed.value}>
                  {speed.label}
                </option>
              ))}
            </select>
            <TtsIconButton
              text={comparisonSummary}
              label={`comparison summary for ${plans.length} plans`}
              voiceId={voiceId}
              playbackRate={playbackRate}
              className="min-w-[44px] min-h-[44px]"
            />
            <button
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
              aria-label="Close comparison panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid gap-4 w-full mb-6" style={comparisonGridStyle}>
          <div aria-hidden="true" />
          {plans.map((plan) => {
            const payerStyle = PAYER_COLORS[plan.payer] ?? DEFAULT_PAYER_STYLE;
            const c = plan.criteria;
            const sourceLinkLabel = plan.sourceLinkLabel ?? "Open source document";
            const hasSourceDocumentLink = plan.hasSourceDocumentLink ?? true;
            const showSrc = Boolean(sourceOpen[plan.id]);

            return (
              <div
                key={`${plan.id}-summary-wrap`}
                className="px-3 flex justify-center"
              >
                <article
                  className="w-full rounded-xl border border-border bg-muted/20 p-4"
                  aria-label={`${formatPlanDrugHeading(plan)} summary`}
                >
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-sm ${payerStyle.bg} ${payerStyle.text}`}
                    >
                      {plan.payer}
                    </span>
                  </div>
                  <h3 className="mt-0 mb-2">{formatPlanDrugHeading(plan)}</h3>
                  <div className="space-y-1.5 text-sm text-muted-foreground">
                    <p className="mb-0">
                      <span className="font-medium text-foreground">
                        Conditions / Diagnosis:
                      </span>{" "}
                      {getPlanConditions(plan)}
                    </p>
                    <p className="mb-0">
                      <span className="font-medium text-foreground">
                        Prior Auth Req For Drug:
                      </span>{" "}
                      {getPlanPriorAuthRequirement(plan)}
                    </p>
                    <p className="mb-0">
                      <span className="font-medium text-foreground">
                        Diagnosis Codes:
                      </span>{" "}
                      {plan.diagnosisCodes.join(", ")}
                    </p>
                    <p className="mb-0">
                      <span className="font-medium text-foreground">
                        Effective Date Of Coverage:
                      </span>{" "}
                      {formatEffectiveDate(plan.effectiveDate)}
                    </p>
                  </div>

                  <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => toggleSource(plan.id)}
                      className="inline-flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-lg bg-muted hover:bg-accent transition-colors text-sm border border-border"
                      aria-expanded={showSrc}
                      aria-controls={`compare-source-${plan.id}`}
                    >
                      <FileText className="w-4 h-4" aria-hidden="true" />
                      {showSrc ? "Hide Source" : "View Source"}
                    </button>
                    {plan.documentId && onDeleteDocument ? (
                      <div className="ms-auto">
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(plan)}
                          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg border border-destructive/50 text-destructive hover:bg-destructive/10 transition-colors"
                          aria-label={`Delete ${formatPlanDrugHeading(plan)} document`}
                          title={`Delete ${formatPlanDrugHeading(plan)} document`}
                        >
                          <Trash2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {showSrc ? (
                    <div
                      id={`compare-source-${plan.id}`}
                      className="mt-2 p-3 bg-muted/50 rounded-lg border border-border"
                      role="region"
                      aria-label="Source document excerpt"
                    >
                      <p className="text-sm italic text-foreground leading-relaxed mb-2">
                        &quot;{c.sourceSnippet}&quot;
                      </p>
                      {hasSourceDocumentLink ? (
                        <a
                          href={c.sourceDocLink}
                          className="inline-flex items-center gap-1.5 min-h-[44px] text-sm text-primary underline hover:text-primary/80"
                        >
                          <ExternalLink className="w-4 h-4" aria-hidden="true" />
                          {sourceLinkLabel}
                          <span className="sr-only">(opens in new window)</span>
                        </a>
                      ) : (
                        <p className="text-sm text-muted-foreground mb-0">
                          {sourceLinkLabel}
                        </p>
                      )}
                    </div>
                  ) : null}
                </article>
              </div>
            );
          })}
        </div>

        <div
          className="overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Scrollable comparison table"
        >
          <table
            className="w-full border-collapse text-sm"
            aria-label="Plan criteria comparison"
          >
            <thead>
              <tr>
                <th
                  scope="col"
                  className="text-left p-3 bg-muted rounded-tl-lg w-48 min-w-[180px]"
                >
                  Criteria
                </th>
                {plans.map((plan) => {
                  const payerStyle = PAYER_COLORS[plan.payer] ?? DEFAULT_PAYER_STYLE;

                  return (
                    <th
                      scope="col"
                      key={plan.id}
                      className="text-left p-3 bg-muted min-w-[260px]"
                    >
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-sm ${payerStyle.bg} ${payerStyle.text} mr-2`}
                      >
                        {plan.payer}
                      </span>
                      {formatPlanDrugHeading(plan)}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {CRITERIA_ROWS.map((row, rowIndex) => {
                const values = plans.map((plan) => row.accessor(plan));
                const diffs = highlightDiffs(values);

                return (
                  <tr
                    key={row.key}
                    className={rowIndex % 2 === 0 ? "" : "bg-muted/30"}
                  >
                    <th
                      scope="row"
                      className="p-3 text-muted-foreground align-top text-left"
                    >
                      {row.label}
                    </th>
                    {plans.map((plan, index) => {
                      const value = values[index];
                      const isDiff = diffs[index];

                      return (
                        <td
                          key={plan.id}
                          className={`p-3 align-top ${
                            isDiff ? "bg-amber-50 border-l-4 border-amber-500" : ""
                          }`}
                        >
                          {row.key === "clinicalCriteria" ? (
                            <div
                              className={`space-y-1.5 whitespace-pre-line ${
                                isDiff ? "text-amber-900" : ""
                              }`}
                            >
                              {value}
                            </div>
                          ) : (
                            <span className={isDiff ? "text-amber-900" : ""}>
                              {value}
                            </span>
                          )}
                          {isDiff && (
                            <span className="flex items-center gap-1 text-xs text-amber-800 mt-1.5">
                              <AlertTriangle
                                className="w-3.5 h-3.5 shrink-0"
                                aria-hidden="true"
                              />
                              Differs from first plan
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
