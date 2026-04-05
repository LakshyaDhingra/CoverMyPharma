import { AlertTriangle, X } from "lucide-react";
import {
  PlanCard,
  PAYER_COLORS,
  DEFAULT_PAYER_STYLE,
  STATUS_STYLES,
} from "./mock-data";

interface ComparisonPanelProps {
  plans: PlanCard[];
  onClose: () => void;
}

const CRITERIA_ROWS: { key: string; label: string; accessor: (p: PlanCard) => string }[] = [
  { key: "status", label: "Coverage Status", accessor: (p) => p.coverageStatus },
  { key: "effective", label: "Effective Date", accessor: (p) => p.effectiveDate },
  { key: "trial", label: "Trial Duration", accessor: (p) => p.criteria.trialDuration },
  { key: "labs", label: "Lab Requirements", accessor: (p) => p.criteria.labRequirements.join("; ") },
  { key: "age", label: "Age Limit", accessor: (p) => p.criteria.ageLimit },
  { key: "diagnosis", label: "Diagnosis Requirement", accessor: (p) => p.criteria.diagnosisRequirement },
  { key: "notes", label: "Additional Notes", accessor: (p) => p.criteria.additionalNotes },
];

function highlightDiffs(values: string[]): boolean[] {
  if (values.length < 2) return values.map(() => false);
  const first = values[0];
  return values.map((v) => v !== first);
}

export function ComparisonPanel({ plans, onClose }: ComparisonPanelProps) {
  return (
    <section
      className="border-t-2 border-border bg-card"
      aria-label="Plan comparison grid"
      role="region"
    >
      <div className="p-6 max-w-full mx-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="mt-0">Split-Screen Diff — {plans.length} Plans</h2>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
            aria-label="Close comparison panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Scrollable comparison table">
          <table className="w-full border-collapse text-sm" aria-label="Plan criteria comparison">
            <thead>
              <tr>
                <th scope="col" className="text-left p-3 bg-muted rounded-tl-lg w-48 min-w-[180px]">Criteria</th>
                {plans.map((plan) => {
                  const ps = PAYER_COLORS[plan.payer] ?? DEFAULT_PAYER_STYLE;
                  return (
                    <th scope="col" key={plan.id} className="text-left p-3 bg-muted min-w-[260px]">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-sm ${ps.bg} ${ps.text} mr-2`}>{plan.payer}</span>
                      {plan.drugName}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {CRITERIA_ROWS.map((row, ri) => {
                const values = plans.map((p) => row.accessor(p));
                const diffs = highlightDiffs(values);
                return (
                  <tr key={row.key} className={ri % 2 === 0 ? "" : "bg-muted/30"}>
                    <th scope="row" className="p-3 text-muted-foreground align-top text-left">{row.label}</th>
                    {plans.map((plan, i) => {
                      const val = values[i];
                      const isDiff = diffs[i];
                      const statusStyle = STATUS_STYLES[plan.coverageStatus];
                      return (
                        <td
                          key={plan.id}
                          className={`p-3 align-top ${isDiff ? "bg-amber-50 border-l-4 border-amber-500" : ""}`}
                        >
                          {row.key === "status" ? (
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-sm ${statusStyle.bg} ${statusStyle.text}`}>
                              <span aria-hidden="true">{statusStyle.icon}</span>
                              {val}
                            </span>
                          ) : (
                            <span className={isDiff ? "text-amber-900" : ""}>{val}</span>
                          )}
                          {isDiff && (
                            <span className="flex items-center gap-1 text-xs text-amber-800 mt-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
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
