import { useState, useMemo } from "react";
import { Plus, Minus, RefreshCw, ArrowRight, History, Filter } from "lucide-react";
import { shortenMedicationName } from "@/app/lib/plan-transform";
import {
  MOCK_POLICY_CHANGES,
  QUARTERS,
  PAYER_COLORS,
  DEFAULT_PAYER_STYLE,
  type PolicyChange,
} from "./mock-data";

const CHANGE_TYPE_STYLES: Record<PolicyChange["changeType"], { bg: string; text: string; border: string; icon: React.ReactNode; label: string }> = {
  addition: {
    bg: "bg-emerald-50",
    text: "text-emerald-900",
    border: "border-l-emerald-500",
    icon: <Plus className="w-4 h-4" aria-hidden="true" />,
    label: "Addition",
  },
  removal: {
    bg: "bg-red-50",
    text: "text-red-900",
    border: "border-l-red-500",
    icon: <Minus className="w-4 h-4" aria-hidden="true" />,
    label: "Removal",
  },
  modification: {
    bg: "bg-amber-50",
    text: "text-amber-900",
    border: "border-l-amber-500",
    icon: <RefreshCw className="w-4 h-4" aria-hidden="true" />,
    label: "Modified",
  },
};

/** Policy tab only — keep plan snapshot limits separate in plan-card.tsx */
const POLICY_FIELD_MAX = 120;
const POLICY_VALUE_MAX = 360;

function truncateForCard(text: string, max: number): { display: string; full: string } {
  const t = text.trim();
  if (t.length <= max) return { display: t, full: t };
  return { display: `${t.slice(0, max).trimEnd()}…`, full: t };
}

export function PolicyChanges({
  dbChanges = [],
  hasRealPlans = false,
}: {
  /** Aggregated from uploaded + saved plans (`policy_changes` / parser) */
  dbChanges?: PolicyChange[];
  hasRealPlans?: boolean;
}) {
  const [selectedQuarterA, setSelectedQuarterA] = useState("2026-Q1");
  const [selectedQuarterB, setSelectedQuarterB] = useState("2025-Q4");
  const [payerFilter, setPayerFilter] = useState("");
  const [drugFilter, setDrugFilter] = useState("");

  const useDatabase = hasRealPlans && dbChanges.length > 0;
  const sourceChanges = useDatabase
    ? dbChanges
    : hasRealPlans
      ? []
      : MOCK_POLICY_CHANGES;

  const drugOptions = useMemo(
    () => [...new Set(sourceChanges.map((c) => c.drugName))].sort(),
    [sourceChanges],
  );
  const payerOptions = useMemo(
    () => [...new Set(sourceChanges.map((c) => c.payer))].sort(),
    [sourceChanges],
  );

  const filteredChanges = useMemo(() => {
    return sourceChanges.filter((c) => {
      // Real / uploaded data: parser often sets quarter to "Unknown" — still show those rows.
      // Demo mock: ignore quarter filter so all sample quarters appear (mock spans Q3/Q4/Q1).
      if (hasRealPlans) {
        const quarterOk =
          c.quarter === "Unknown" ||
          c.quarter === selectedQuarterA ||
          c.quarter === selectedQuarterB;
        if (!quarterOk) return false;
      }
      if (payerFilter && c.payer !== payerFilter) return false;
      if (drugFilter && c.drugName !== drugFilter) return false;
      return true;
    });
  }, [
    sourceChanges,
    hasRealPlans,
    selectedQuarterA,
    selectedQuarterB,
    payerFilter,
    drugFilter,
  ]);

  const grouped = useMemo(() => {
    const map = new Map<string, PolicyChange[]>();
    filteredChanges.forEach((c) => {
      const key = `${c.payer} — ${c.drugName}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });
    return map;
  }, [filteredChanges]);

  const stats = {
    additions: filteredChanges.filter((c) => c.changeType === "addition").length,
    removals: filteredChanges.filter((c) => c.changeType === "removal").length,
    modifications: filteredChanges.filter((c) => c.changeType === "modification").length,
  };

  const emptyRealNoRows =
    hasRealPlans && !useDatabase && sourceChanges.length === 0;

  return (
    <div>
      <h2 className="mt-0 mb-1">Policy Changes & Version Tracking</h2>
      {!hasRealPlans ? (
        <div
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          You’re viewing <strong>demo</strong> policy changes (no saved uploads in this session).
          Sign in, upload policy PDFs, and ensure your Supabase <code className="text-xs bg-white/60 px-1 rounded">medical_documents.policy_changes</code> column exists — then extracted rows appear here instead of samples.
        </div>
      ) : null}
      <p className="text-sm text-muted-foreground mb-6">
        {useDatabase
          ? "Changes extracted from your uploaded policy documents. Rows with an unknown quarter still appear; use payer/drug filters to narrow results."
          : hasRealPlans
            ? "No discrete policy changes were extracted from your saved documents yet. The model returns an empty list when the PDF doesn’t describe explicit updates, or if parsing skipped the policy_changes field."
            : "Compare how payer policies have changed across quarters (sample data below)."}
      </p>

      {/* Quarter selectors + filters */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6 items-end flex-wrap">
        <div>
          <label htmlFor="quarter-a" className="block text-sm mb-1.5">Compare From</label>
          <select
            id="quarter-a"
            value={selectedQuarterB}
            onChange={(e) => setSelectedQuarterB(e.target.value)}
            className="px-3 py-2.5 min-h-[44px] rounded-lg border border-border bg-input-background text-sm"
          >
            {QUARTERS.map((q) => (
              <option key={q.value} value={q.value}>{q.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center self-end min-h-[44px]">
          <ArrowRight className="w-5 h-5 text-muted-foreground" aria-label="to" />
        </div>

        <div>
          <label htmlFor="quarter-b" className="block text-sm mb-1.5">Compare To</label>
          <select
            id="quarter-b"
            value={selectedQuarterA}
            onChange={(e) => setSelectedQuarterA(e.target.value)}
            className="px-3 py-2.5 min-h-[44px] rounded-lg border border-border bg-input-background text-sm"
          >
            {QUARTERS.map((q) => (
              <option key={q.value} value={q.value}>{q.label}</option>
            ))}
          </select>
        </div>

        <div className="border-l border-border pl-4 flex gap-3">
          <div>
            <label htmlFor="payer-filter-changes" className="block text-sm mb-1.5">Payer</label>
            <select
              id="payer-filter-changes"
              value={payerFilter}
              onChange={(e) => setPayerFilter(e.target.value)}
              className="px-3 py-2.5 min-h-[44px] rounded-lg border border-border bg-input-background text-sm"
            >
              <option value="">All Payers</option>
              {payerOptions.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="drug-filter-changes" className="block text-sm mb-1.5">Drug</label>
            <select
              id="drug-filter-changes"
              value={drugFilter}
              onChange={(e) => setDrugFilter(e.target.value)}
              className="px-3 py-2.5 min-h-[44px] rounded-lg border border-border bg-input-background text-sm"
            >
              <option value="">All Drugs</option>
              {drugOptions.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Change summary stats */}
      <div className="flex items-center gap-5 mb-5 text-sm flex-wrap" role="status" aria-live="polite">
        <span className="text-muted-foreground inline-flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5" aria-hidden="true" />
          {useDatabase ? "From your documents" : hasRealPlans ? "No extracted rows" : "Demo dataset"}
        </span>
        <span className="text-muted-foreground">{filteredChanges.length} change{filteredChanges.length !== 1 ? "s" : ""} found</span>
        <span className="inline-flex items-center gap-1.5 text-emerald-800">
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          {stats.additions} additions
        </span>
        <span className="inline-flex items-center gap-1.5 text-red-800">
          <Minus className="w-3.5 h-3.5" aria-hidden="true" />
          {stats.removals} removals
        </span>
        <span className="inline-flex items-center gap-1.5 text-amber-800">
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          {stats.modifications} modifications
        </span>
      </div>

      {emptyRealNoRows ? (
        <div className="border-2 border-dashed border-border rounded-xl bg-muted/30 p-8 text-center" role="status">
          <History className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" aria-hidden="true" />
          <p className="text-muted-foreground mb-1">No policy changes extracted yet</p>
          <p className="text-sm text-muted-foreground mb-0">
            Parsed PDFs will list explicit updates here when the model finds them. Try including &quot;Undated / unknown quarter&quot; in your quarter filters if dates were missing.
          </p>
        </div>
      ) : filteredChanges.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-xl bg-muted/30 p-8 text-center" role="status">
          <History className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" aria-hidden="true" />
          <p className="text-muted-foreground mb-1">No policy changes found</p>
          <p className="text-sm text-muted-foreground">
            Adjust the quarter range or filters to see changes.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {[...grouped.entries()].map(([groupKey, changes]) => {
            const firstChange = changes[0];
            const ps = PAYER_COLORS[firstChange.payer] ?? DEFAULT_PAYER_STYLE;
            return (
              <section key={groupKey} className="border border-border rounded-xl bg-card overflow-hidden" aria-label={`Changes for ${groupKey}`}>
                <div className="px-5 py-3 bg-muted/50 border-b border-border flex items-center gap-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-sm ${ps.bg} ${ps.text}`}>
                    {firstChange.payer}
                  </span>
                  <h3 className="mt-0 mb-0" title={firstChange.drugName}>
                    {shortenMedicationName(firstChange.drugName)}
                  </h3>
                  <span className="text-sm text-muted-foreground ml-auto">{changes.length} change{changes.length !== 1 ? "s" : ""}</span>
                </div>

                <div className="divide-y divide-border">
                  {changes.map((change) => {
                    const style = CHANGE_TYPE_STYLES[change.changeType];
                    const fieldT = truncateForCard(change.field, POLICY_FIELD_MAX);
                    const oldT = truncateForCard(change.oldValue, POLICY_VALUE_MAX);
                    const newT = truncateForCard(change.newValue, POLICY_VALUE_MAX);
                    return (
                      <div
                        key={change.id}
                        className={`flex flex-col md:flex-row border-l-4 ${style.border}`}
                      >
                        <div className="px-5 py-4 md:w-56 shrink-0 bg-muted/20">
                          <div className="flex items-center gap-2 mb-1">
                            {style.icon}
                            <span className={`text-xs px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                              {style.label}
                            </span>
                          </div>
                          <p
                            className="text-sm mb-0 break-words"
                            title={fieldT.display !== fieldT.full ? fieldT.full : undefined}
                          >
                            {fieldT.display}
                          </p>
                          <p className="text-xs text-muted-foreground mb-0 mt-1">Effective {change.effectiveDate}</p>
                        </div>

                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
                          <div className="px-5 py-4 bg-red-50/50">
                            <span className="text-xs text-red-800 flex items-center gap-1 mb-1.5">
                              <Minus className="w-3 h-3" aria-hidden="true" />
                              Previous
                            </span>
                            <p
                              className="text-sm mb-0 line-through decoration-red-300 break-words"
                              title={oldT.display !== oldT.full ? oldT.full : undefined}
                            >
                              {oldT.display}
                            </p>
                          </div>
                          <div className="px-5 py-4 bg-emerald-50/50">
                            <span className="text-xs text-emerald-800 flex items-center gap-1 mb-1.5">
                              <Plus className="w-3 h-3" aria-hidden="true" />
                              Current
                            </span>
                            <p
                              className="text-sm mb-0 break-words"
                              title={newT.display !== newT.full ? newT.full : undefined}
                            >
                              {newT.display}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
