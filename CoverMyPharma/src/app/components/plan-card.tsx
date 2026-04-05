import { Check, ChevronRight } from "lucide-react";
import {
  PlanCard,
  PAYER_COLORS,
  DEFAULT_PAYER_STYLE,
  STATUS_STYLES,
  formatPlanDrugHeading,
  getPlanConditions,
  getPlanPriorAuthRequirement,
} from "./mock-data";
import { formatEffectiveDate } from "./tts";

function truncateSectionText(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trimEnd()}...`;
}

interface PlanCardProps {
  plan: PlanCard;
  isSelected: boolean;
  isCompareChecked: boolean;
  isCompareDisabled?: boolean;
  onSelect: (id: string) => void;
  onCompareToggle: (id: string) => void;
}

export function PlanSnapshotCard({
  plan,
  isSelected,
  isCompareChecked,
  isCompareDisabled = false,
  onSelect,
  onCompareToggle,
}: PlanCardProps) {
  const payerStyle = PAYER_COLORS[plan.payer] ?? DEFAULT_PAYER_STYLE;
  const statusStyle = STATUS_STYLES[plan.coverageStatus];
  const effectiveDateLabel = plan.effectiveDateLabel ?? "Effective";
  const conditions = getPlanConditions(plan);
  const priorAuthRequirement = getPlanPriorAuthRequirement(plan);
  const drugHeading = truncateSectionText(formatPlanDrugHeading(plan), 56);
  const truncatedConditions = truncateSectionText(conditions, 70);
  const truncatedPriorAuthRequirement = truncateSectionText(
    priorAuthRequirement,
    42,
  );
  const visibleDiagnosisCodes = plan.diagnosisCodes.slice(0, 3);
  const hiddenDiagnosisCodeCount = Math.max(plan.diagnosisCodes.length - 3, 0);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={`${formatPlanDrugHeading(plan)} - ${plan.payer} - ${plan.coverageStatus}. Press Enter to view details.`}
      className={`relative rounded-xl border-2 p-5 cursor-pointer transition-all min-h-[180px] flex flex-col ${
        isSelected
          ? "border-primary shadow-lg ring-2 ring-primary/40"
          : `${payerStyle.border} hover:shadow-md`
      } bg-card`}
      onClick={() => onSelect(plan.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(plan.id);
        }
      }}
    >
      <div className="absolute top-2 right-2 z-10">
        <label
          className={`flex items-center justify-center w-11 h-11 ${
            isCompareDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={isCompareChecked}
            disabled={isCompareDisabled}
            onChange={(e) => {
              e.stopPropagation();
              onCompareToggle(plan.id);
            }}
            className="sr-only peer"
            aria-label={`Select ${formatPlanDrugHeading(plan)} (${plan.payer}) for comparison`}
          />
          <span
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-primary peer-focus-visible:outline-offset-2 ${
              isCompareChecked
                ? "bg-primary border-primary"
                : isCompareDisabled
                  ? "border-gray-300"
                  : "border-gray-500 hover:border-gray-700"
            }`}
            aria-hidden="true"
          >
            {isCompareChecked && (
              <Check className="w-3 h-3 text-primary-foreground" />
            )}
          </span>
        </label>
      </div>

      <span
        className={`inline-block px-2.5 py-0.5 rounded-full text-sm self-start ${payerStyle.bg} ${payerStyle.text}`}
      >
        {plan.payer}
      </span>

      <h3 className="mt-2 mb-0" title={formatPlanDrugHeading(plan)}>
        {drugHeading}
      </h3>
      <p
        className="text-sm text-muted-foreground mt-0.5 mb-0"
        title={conditions}
      >
        Conditions: {truncatedConditions}
      </p>
      <p
        className="text-sm text-muted-foreground mt-1 mb-0"
        title={priorAuthRequirement}
      >
        Prior Auth: {truncatedPriorAuthRequirement}
      </p>

      <span
        className={`inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-md text-sm self-start ${statusStyle.bg} ${statusStyle.text}`}
      >
        <span aria-hidden="true">{statusStyle.icon}</span>
        {plan.coverageStatus}
      </span>

      <p className="text-sm text-muted-foreground mt-3 mb-0">
        <span className="sr-only">{effectiveDateLabel} date: </span>
        {effectiveDateLabel}: {formatEffectiveDate(plan.effectiveDate)}
      </p>

      <div
        className="flex flex-wrap gap-1 mt-2"
        aria-label="Applicable diagnosis codes"
      >
        {visibleDiagnosisCodes.map((code) => (
          <span
            key={code}
            className="text-xs px-1.5 py-0.5 bg-muted rounded text-foreground"
          >
            {code}
          </span>
        ))}
        {hiddenDiagnosisCodeCount > 0 && (
          <span
            className="text-xs px-1.5 py-0.5 bg-muted rounded text-foreground"
            title={plan.diagnosisCodes.join(", ")}
          >
            +{hiddenDiagnosisCodeCount} more
          </span>
        )}
      </div>

      <div className="mt-auto pt-3 flex items-center gap-1 text-sm text-primary">
        <span>View Criteria</span>
        <ChevronRight className="w-4 h-4" aria-hidden="true" />
      </div>
    </div>
  );
}
