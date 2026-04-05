import { useState } from "react";
import { FileText, ExternalLink, X, FlaskConical, Clock, Calendar, Stethoscope, StickyNote, Hash } from "lucide-react";
import { PlanCard, PAYER_COLORS, STATUS_STYLES } from "./mock-data";
import { TtsIconButton } from "./tts-icon-button";
import {
  buildPlanSpeechSummary,
  formatEffectiveDate,
  VOICE_OPTIONS,
} from "./tts";

interface DetailPanelProps {
  plan: PlanCard;
  onClose: () => void;
  voiceId?: string;
  onVoiceChange: (voiceId: string) => void;
}

export function DetailPanel({
  plan,
  onClose,
  voiceId,
  onVoiceChange,
}: DetailPanelProps) {
  const [showSource, setShowSource] = useState(false);
  const payerStyle = PAYER_COLORS[plan.payer];
  const statusStyle = STATUS_STYLES[plan.coverageStatus];
  const c = plan.criteria;
  const speechSummary = buildPlanSpeechSummary(plan);

  return (
    <section
      className="border-t-2 border-border bg-card"
      aria-label={`Detail panel for ${plan.drugName} — ${plan.payer}`}
      role="region"
    >
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="mt-0">{plan.drugName}</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-sm ${payerStyle.bg} ${payerStyle.text}`}>{plan.payer}</span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm ${statusStyle.bg} ${statusStyle.text}`}>
                <span aria-hidden="true">{statusStyle.icon}</span>
                {plan.coverageStatus}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1 mb-0">
              {plan.rxNormCode} &middot; Effective{" "}
              {formatEffectiveDate(plan.effectiveDate)}
            </p>
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
            <TtsIconButton
              text={speechSummary}
              label={`${plan.drugName} ${plan.payer} detail summary`}
              voiceId={voiceId}
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

        {/* Clinical Criteria Grid */}
        <h3 className="mb-3 mt-0">Clinical Criteria</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CriteriaItem icon={<Clock className="w-4 h-4" />} label="Trial Duration" value={c.trialDuration} />
          <CriteriaItem icon={<FlaskConical className="w-4 h-4" />} label="Lab Requirements" value={c.labRequirements.join("; ")} />
          <CriteriaItem icon={<Calendar className="w-4 h-4" />} label="Age Limit" value={c.ageLimit} />
          <CriteriaItem icon={<Hash className="w-4 h-4" />} label="Diagnosis Codes" value={plan.diagnosisCodes.join(", ")} />
          <CriteriaItem icon={<Stethoscope className="w-4 h-4" />} label="Diagnosis Requirement" value={c.diagnosisRequirement} />
          <CriteriaItem icon={<StickyNote className="w-4 h-4" />} label="Additional Notes" value={c.additionalNotes} className="md:col-span-2" />
        </div>

        {/* Source section */}
        <div className="mt-5">
          <button
            onClick={() => setShowSource(!showSource)}
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-lg bg-muted hover:bg-accent transition-colors text-sm border border-border"
            aria-expanded={showSource}
            aria-controls="source-panel"
          >
            <FileText className="w-4 h-4" aria-hidden="true" />
            {showSource ? "Hide Source" : "View Source"}
          </button>
          {showSource && (
            <div id="source-panel" className="mt-3 p-4 bg-muted/50 rounded-lg border border-border" role="region" aria-label="Source document excerpt">
              <p className="text-sm italic text-foreground leading-relaxed mb-2">"{c.sourceSnippet}"</p>
              <a
                href={c.sourceDocLink}
                className="inline-flex items-center gap-1.5 min-h-[44px] text-sm text-primary underline hover:text-primary/80"
              >
                <ExternalLink className="w-4 h-4" aria-hidden="true" />
                Open source document
                <span className="sr-only">(opens in new window)</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function CriteriaItem({ icon, label, value, className = "" }: { icon: React.ReactNode; label: string; value: string; className?: string }) {
  return (
    <div className={`p-4 rounded-lg bg-muted/40 border border-border ${className}`}>
      <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
        <span aria-hidden="true">{icon}</span>
        <span className="text-sm uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-sm mb-0">{value}</p>
    </div>
  );
}
