import { AlertTriangle, X } from "lucide-react";

import {
  PlanCard,
  PAYER_COLORS,
  DEFAULT_PAYER_STYLE,
  STATUS_STYLES,
  getPlanConditions,
  getPlanPriorAuthRequirement,
} from "./mock-data";
import { TtsIconButton } from "./tts-icon-button";
import {
  buildComparisonSpeechSummary,
  formatEffectiveDate,
  VOICE_OPTIONS,
} from "./tts";

interface ComparisonPanelProps {
  plans: PlanCard[];
  onClose: () => void;
  voiceId?: string;
  onVoiceChange: (voiceId: string) => void;
}

const CRITERIA_ROWS: {
  key: string;
  label: string;
  accessor: (plan: PlanCard) => string;
}[] = [
  {
    key: "genericName",
    label: "Generic Name",
    accessor: (plan) => plan.genericName || "Not available",
  },
  {
    key: "conditions",
    label: "Conditions / Diagnosis",
    accessor: (plan) => getPlanConditions(plan),
  },
  {
    key: "priorAuth",
    label: "Prior Auth Requirement",
    accessor: (plan) => getPlanPriorAuthRequirement(plan),
  },
  { key: "status", label: "Coverage Status", accessor: (plan) => plan.coverageStatus },
  { key: "effective", label: "Effective Date", accessor: (plan) => formatEffectiveDate(plan.effectiveDate) },
  { key: "diagnosisCodes", label: "Diagnosis Codes", accessor: (plan) => plan.diagnosisCodes.join(", ") },
  { key: "trial", label: "Trial Duration", accessor: (plan) => plan.criteria.trialDuration },
  { key: "labs", label: "Lab Requirements", accessor: (plan) => plan.criteria.labRequirements.join("; ") },
  { key: "age", label: "Age Limit", accessor: (plan) => plan.criteria.ageLimit },
  { key: "diagnosis", label: "Diagnosis Requirement", accessor: (plan) => plan.criteria.diagnosisRequirement },
  { key: "notes", label: "Additional Notes", accessor: (plan) => plan.criteria.additionalNotes },
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
}: ComparisonPanelProps) {
  const comparisonSummary = buildComparisonSpeechSummary(plans);
  const comparisonGridStyle = {
    gridTemplateColumns: `180px repeat(${plans.length}, minmax(0, 1fr))`,
  };

  return (
    <section
      className="border-t-2 border-border bg-card"
      aria-label="Plan comparison grid"
      role="region"
    >
      <div className="p-6 max-w-full mx-auto">
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
            <TtsIconButton
              text={comparisonSummary}
              label={`comparison summary for ${plans.length} plans`}
              voiceId={voiceId}
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
            const statusStyle = STATUS_STYLES[plan.coverageStatus];

            return (
              <article
                key={`${plan.id}-summary`}
                className="rounded-xl border border-border bg-muted/20 p-4"
                aria-label={`${plan.drugName} summary`}
              >
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-sm ${payerStyle.bg} ${payerStyle.text}`}
                  >
                    {plan.payer}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-sm ${statusStyle.bg} ${statusStyle.text}`}
                  >
                    <span aria-hidden="true">{statusStyle.icon}</span>
                    {plan.coverageStatus}
                  </span>
                </div>
                <h3 className="mt-0 mb-2">{plan.drugName}</h3>
                <div className="space-y-1.5 text-sm text-muted-foreground">
                  <p className="mb-0">
                    <span className="font-medium text-foreground">Generic:</span>{" "}
                    {plan.genericName || "Not available"}
                  </p>
                  <p className="mb-0">
                    <span className="font-medium text-foreground">Conditions:</span>{" "}
                    {getPlanConditions(plan)}
                  </p>
                  <p className="mb-0">
                    <span className="font-medium text-foreground">Prior Auth:</span>{" "}
                    {getPlanPriorAuthRequirement(plan)}
                  </p>
                  <p className="mb-0">
                    <span className="font-medium text-foreground">Diagnosis Codes:</span>{" "}
                    {plan.diagnosisCodes.join(", ")}
                  </p>
                  <p className="mb-0">
                    <span className="font-medium text-foreground">Coverage Effective:</span>{" "}
                    {formatEffectiveDate(plan.effectiveDate)}
                  </p>
                </div>
              </article>
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
                      {plan.drugName}
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
                      const statusStyle = STATUS_STYLES[plan.coverageStatus];

                      return (
                        <td
                          key={plan.id}
                          className={`p-3 align-top ${isDiff ? "bg-amber-50 border-l-4 border-amber-500" : ""}`}
                        >
                          {row.key === "status" ? (
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-sm ${statusStyle.bg} ${statusStyle.text}`}
                            >
                              <span aria-hidden="true">{statusStyle.icon}</span>
                              {value}
                            </span>
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
