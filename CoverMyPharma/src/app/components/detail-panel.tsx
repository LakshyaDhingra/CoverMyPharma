import { useState } from "react";
import { FileText, ExternalLink, Trash2, X } from "lucide-react";
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

interface DetailPanelProps {
  plan: PlanCard;
  onClose: () => void;
  voiceId?: string;
  onVoiceChange: (voiceId: string) => void;
  playbackRate?: number;
  onPlaybackRateChange?: (playbackRate: number) => void;
  onDeleteDocument?: (documentId: string) => boolean | Promise<boolean>;
}

export function DetailPanel({
  plan,
  onClose,
  voiceId,
  onVoiceChange,
  playbackRate = 1,
  onPlaybackRateChange,
  onDeleteDocument,
}: DetailPanelProps) {
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
  const documentId = plan.documentId;
  const planRows = [
    {
      label: "Drug Name / Generic Name",
      value: formatPlanDrugHeading(plan),
    },
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

  return (
    <section
      className="border-t-2 border-border bg-card"
      aria-label={`Detail panel for ${formatPlanDrugHeading(plan)} - ${plan.payer}`}
      role="region"
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
            aria-labelledby="delete-detail-doc-title"
            className="bg-card border border-border rounded-xl shadow-lg max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="delete-detail-doc-title" className="mt-0 mb-2">
              Delete this document?
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              This removes <strong>{formatPlanDrugHeading(plan)}</strong> (
              {plan.payer}) from
              your account and database. This cannot be undone.
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

      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="mt-0">{formatPlanDrugHeading(plan)}</h2>
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
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <label
              htmlFor={`voice-select-${plan.id}`}
              className="text-sm text-muted-foreground"
            >
              Voice
            </label>
            <select
              id={`voice-select-${plan.id}`}
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
              htmlFor={`speed-select-${plan.id}`}
              className="text-sm text-muted-foreground"
            >
              Speed
            </label>
            <select
              id={`speed-select-${plan.id}`}
              value={String(playbackRate)}
              onChange={(e) => onPlaybackRateChange?.(Number(e.target.value))}
              disabled={!onPlaybackRateChange}
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
              label={`${formatPlanDrugHeading(plan)} ${plan.payer} detail summary`}
              voiceId={voiceId}
              playbackRate={playbackRate}
              className="min-w-[44px] min-h-[44px]"
            />
            <button
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
              aria-label="Close detail panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div
          className="overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Plan detail table"
        >
          <table className="w-full border-collapse text-sm" aria-label="Plan detail">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="text-left p-3 bg-muted rounded-tl-lg w-48 min-w-[180px]"
                >
                  Criteria
                </th>
                <th scope="col" className="text-left p-3 bg-muted">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-sm ${payerStyle.bg} ${payerStyle.text} mr-2`}
                  >
                    {plan.payer}
                  </span>
                  {formatPlanDrugHeading(plan)}
                </th>
              </tr>
            </thead>
            <tbody>
              {planRows.map((row, index) => (
                <tr
                  key={row.label}
                  className={index % 2 === 0 ? "" : "bg-muted/30"}
                >
                  <th
                    scope="row"
                    className="p-3 text-muted-foreground align-top text-left"
                  >
                    {row.label}
                  </th>
                  <td className="p-3 align-top">
                    {row.label === "Clinical Criteria" ? (
                      <div className="space-y-1.5 whitespace-pre-line">
                        {row.value}
                      </div>
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
              aria-controls="source-panel"
            >
              <FileText className="w-4 h-4" aria-hidden="true" />
              {showSource ? "Hide Source" : "View Source"}
            </button>
            {documentId && onDeleteDocument ? (
              <div className="ms-auto">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg border border-destructive/50 text-destructive hover:bg-destructive/10 transition-colors"
                  aria-label="Delete uploaded document"
                  title="Delete uploaded document"
                >
                  <Trash2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                </button>
              </div>
            ) : null}
          </div>
          {showSource ? (
            <div
              id="source-panel"
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
    </section>
  );
}
