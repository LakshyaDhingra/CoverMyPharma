import { useState } from "react";
import { FileText, ExternalLink, Trash2 } from "lucide-react";
import {
  PlanCard,
  PAYER_COLORS,
  DEFAULT_PAYER_STYLE,
  STATUS_STYLES,
  formatPlanDrugHeading,
  getPlanClinicalCriteria,
  getPlanConditions,
  getPlanPriorAuthRequirement,
} from "./mock-data";
import { TtsIconButton } from "./tts-icon-button";
import {
  buildPlanSpeechSummary,
  formatEffectiveDate,
  PLAYBACK_SPEED_OPTIONS,
  VOICE_OPTIONS,
} from "./tts";

export interface CriteriaLookupResultDocumentProps {
  plan: PlanCard;
  voiceId?: string;
  onVoiceChange?: (voiceId: string) => void;
  playbackRate?: number;
  onPlaybackRateChange?: (playbackRate: number) => void;
  onDeleteDocument?: (documentId: string) => boolean | Promise<boolean>;
}

export function CriteriaLookupResultDocument({
  plan,
  voiceId,
  onVoiceChange,
  playbackRate = 1,
  onPlaybackRateChange,
  onDeleteDocument,
}: CriteriaLookupResultDocumentProps) {
  const [showSource, setShowSource] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const payerStyle = PAYER_COLORS[plan.payer] ?? DEFAULT_PAYER_STYLE;
  const statusStyle = STATUS_STYLES[plan.coverageStatus];
  const c = plan.criteria;
  const speechSummary = buildPlanSpeechSummary(plan);
  const sourceLinkLabel = plan.sourceLinkLabel ?? "Open source document";
  const hasSourceDocumentLink = plan.hasSourceDocumentLink ?? true;
  const conditions = getPlanConditions(plan);
  const priorAuthRequirement = getPlanPriorAuthRequirement(plan);
  const diagnosisCodes = plan.diagnosisCodes.join(", ");
  const coverageEffectiveDate = formatEffectiveDate(plan.effectiveDate);

  const planRows = [
    {
      label: "Generic name",
      value: plan.genericName?.trim() ? plan.genericName : "Not specified",
    },
    ...(plan.sourceFilename
      ? [{ label: "Source file", value: plan.sourceFilename }]
      : []),
    {
      label: "Conditions / Diagnosis",
      value: conditions,
    },
    {
      label: "Prior Auth Req For Drug",
      value: priorAuthRequirement,
    },
    {
      label: "Clinical Criteria",
      value: getPlanClinicalCriteria(plan),
    },
    {
      label: "Diagnosis Codes",
      value: diagnosisCodes,
    },
    {
      label: "Effective Date Of Coverage",
      value: coverageEffectiveDate,
    },
  ];

  const documentId = plan.documentId;
  const showVoiceBar = Boolean(
    voiceId != null && onVoiceChange && onPlaybackRateChange,
  );

  return (
    <article
      className="w-full rounded-xl border border-border bg-card shadow-sm overflow-hidden"
      aria-label={`Criteria document for ${formatPlanDrugHeading(plan)} — ${plan.payer}`}
    >
      {showDeleteConfirm && documentId && onDeleteDocument ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
          role="presentation"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`delete-doc-title-${plan.id}`}
            className="bg-card border border-border rounded-xl shadow-lg max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id={`delete-doc-title-${plan.id}`} className="mt-0 mb-2">
              Delete this document?
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              This removes <strong>{formatPlanDrugHeading(plan)}</strong> (
              {plan.payer}) from your
              account and database. This cannot be undone.
            </p>
            <div className="flex flex-wrap gap-3 justify-end">
              <button
                type="button"
                className="px-4 py-2.5 min-h-[44px] rounded-lg border border-border text-sm hover:bg-muted"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2.5 min-h-[44px] rounded-lg bg-destructive text-destructive-foreground text-sm hover:opacity-90"
                onClick={async () => {
                  const ok = await onDeleteDocument(documentId);
                  if (ok) setShowDeleteConfirm(false);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="p-6 w-full">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-5">
          <div className="min-w-0 flex-1">
            <h2 className="mt-0 text-xl sm:text-2xl leading-snug break-words">
              {formatPlanDrugHeading(plan)}
            </h2>
            <div className="flex items-center gap-2 flex-wrap mt-3">
              <span
                className={`px-2.5 py-0.5 rounded-full text-sm ${payerStyle.bg} ${payerStyle.text}`}
              >
                {plan.payer}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm ${statusStyle.bg} ${statusStyle.text}`}
              >
                <span aria-hidden="true">{statusStyle.icon}</span>
                {plan.coverageStatus}
              </span>
            </div>
          </div>
          {showVoiceBar ? (
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <label
                htmlFor={`criteria-voice-${plan.id}`}
                className="text-sm text-muted-foreground"
              >
                Voice
              </label>
              <select
                id={`criteria-voice-${plan.id}`}
                value={voiceId}
                onChange={(e) => onVoiceChange!(e.target.value)}
                className="px-3 py-2 min-h-[44px] rounded-lg border border-border bg-input-background text-sm min-w-[140px]"
              >
                {VOICE_OPTIONS.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.label}
                  </option>
                ))}
              </select>
              <label
                htmlFor={`criteria-speed-${plan.id}`}
                className="text-sm text-muted-foreground"
              >
                Speed
              </label>
              <select
                id={`criteria-speed-${plan.id}`}
                value={String(playbackRate)}
                onChange={(e) =>
                  onPlaybackRateChange!(Number(e.target.value))
                }
                className="px-3 py-2 min-h-[44px] rounded-lg border border-border bg-input-background text-sm min-w-[96px]"
              >
                {PLAYBACK_SPEED_OPTIONS.map((speed) => (
                  <option key={speed.label} value={speed.value}>
                    {speed.label}
                  </option>
                ))}
              </select>
              <TtsIconButton
                text={speechSummary}
                label={`${formatPlanDrugHeading(plan)} ${plan.payer} criteria summary`}
                voiceId={voiceId!}
                playbackRate={playbackRate}
                className="min-w-[44px] min-h-[44px]"
              />
            </div>
          ) : null}
        </div>

        <div
          className="overflow-x-auto rounded-lg border border-border"
          tabIndex={0}
          role="region"
          aria-label="Plan criteria table"
        >
          <table className="w-full border-collapse text-sm" aria-label="Plan detail">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="text-left p-3 bg-muted w-48 min-w-[180px] rounded-tl-lg"
                >
                  Criteria
                </th>
                <th
                  scope="col"
                  className="text-left p-3 bg-muted rounded-tr-lg"
                >
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-sm ${payerStyle.bg} ${payerStyle.text}`}
                  >
                    {plan.payer}
                  </span>
                  <span className="sr-only">
                    {" "}
                    — {formatPlanDrugHeading(plan)}
                  </span>
                  <span className="ml-2 text-muted-foreground font-normal">
                    Details
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {planRows.map((row, index) => (
                <tr
                  key={`${plan.id}-${row.label}`}
                  className={index % 2 === 0 ? "" : "bg-muted/30"}
                >
                  <th
                    scope="row"
                    className="p-3 text-foreground font-semibold align-top text-left"
                  >
                    {row.label}
                  </th>
                  <td className="p-3 align-top break-words">
                    {row.label === "Clinical Criteria" ? (
                      <div className="space-y-1.5 whitespace-pre-line">
                        {row.value}
                      </div>
                    ) : row.label === "Source file" ? (
                      <span className="font-mono text-xs sm:text-sm">
                        {row.value}
                      </span>
                    ) : (
                      <span>{row.value}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 pt-5 border-t border-border">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setShowSource(!showSource)}
              className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-lg bg-muted hover:bg-accent transition-colors text-sm border border-border"
              aria-expanded={showSource}
              aria-controls={`criteria-source-${plan.id}`}
            >
              <FileText className="w-4 h-4" aria-hidden="true" />
              {showSource ? "Hide Source" : "View Source"}
            </button>
            {documentId && onDeleteDocument ? (
              <div className="ms-auto">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-lg border border-destructive/50 text-destructive hover:bg-destructive/10 transition-colors text-sm"
                  aria-label="Delete uploaded document"
                >
                  <Trash2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  Delete document
                </button>
              </div>
            ) : null}
          </div>
          {showSource ? (
            <div
              id={`criteria-source-${plan.id}`}
              className="mt-3 p-4 bg-muted/50 rounded-lg border border-border"
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
        </div>
      </div>
    </article>
  );
}
