import { Check, ChevronRight } from "lucide-react";
import { PlanCard, PAYER_COLORS, STATUS_STYLES } from "./mock-data";

interface PlanCardProps {
  plan: PlanCard;
  isSelected: boolean;
  isCompareChecked: boolean;
  onSelect: (id: string) => void;
  onCompareToggle: (id: string) => void;
}

export function PlanSnapshotCard({ plan, isSelected, isCompareChecked, onSelect, onCompareToggle }: PlanCardProps) {
  const payerStyle = PAYER_COLORS[plan.payer];
  const statusStyle = STATUS_STYLES[plan.coverageStatus];

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={`${plan.drugName} — ${plan.payer} — ${plan.coverageStatus}. Press Enter to view details.`}
      className={`relative rounded-xl border-2 p-5 cursor-pointer transition-all min-h-[180px] flex flex-col ${
        isSelected ? "border-primary shadow-lg ring-2 ring-primary/40" : `${payerStyle.border} hover:shadow-md`
      } bg-card`}
      onClick={() => onSelect(plan.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(plan.id);
        }
      }}
    >
      {/* Compare checkbox — proper checkbox with 44x44 touch target */}
      <div className="absolute top-2 right-2 z-10">
        <label className="flex items-center justify-center w-11 h-11 cursor-pointer" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isCompareChecked}
            onChange={(e) => {
              e.stopPropagation();
              onCompareToggle(plan.id);
            }}
            className="sr-only peer"
            aria-label={`Select ${plan.drugName} (${plan.payer}) for comparison`}
          />
          <span
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-primary peer-focus-visible:outline-offset-2 ${
              isCompareChecked ? "bg-primary border-primary" : "border-gray-500 hover:border-gray-700"
            }`}
            aria-hidden="true"
          >
            {isCompareChecked && <Check className="w-3 h-3 text-primary-foreground" />}
          </span>
        </label>
      </div>

      {/* Payer badge */}
      <span className={`inline-block px-2.5 py-0.5 rounded-full text-sm self-start ${payerStyle.bg} ${payerStyle.text}`}>
        {plan.payer}
      </span>

      {/* Drug info */}
      <h3 className="mt-2 mb-0">{plan.drugName}</h3>
      <p className="text-sm text-muted-foreground mt-0.5 mb-0">{plan.rxNormCode}</p>

      {/* Status — icon + text, not color alone */}
      <span className={`inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-md text-sm self-start ${statusStyle.bg} ${statusStyle.text}`}>
        <span aria-hidden="true">{statusStyle.icon}</span>
        {plan.coverageStatus}
      </span>

      {/* Effective date */}
      <p className="text-sm text-muted-foreground mt-3 mb-0">
        <span className="sr-only">Effective date: </span>
        Effective: {new Date(plan.effectiveDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
      </p>

      {/* Diagnosis codes */}
      <div className="flex flex-wrap gap-1 mt-2" aria-label="Applicable diagnosis codes">
        {plan.diagnosisCodes.map((code) => (
          <span key={code} className="text-xs px-1.5 py-0.5 bg-muted rounded text-foreground">
            {code}
          </span>
        ))}
      </div>

      {/* View Details CTA — visual affordance */}
      <div className="mt-auto pt-3 flex items-center gap-1 text-sm text-primary">
        <span>View Criteria</span>
        <ChevronRight className="w-4 h-4" aria-hidden="true" />
      </div>
    </div>
  );
}
