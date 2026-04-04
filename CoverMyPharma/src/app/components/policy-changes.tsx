import { useState, useMemo } from "react";
import { Plus, Minus, RefreshCw, ArrowRight, History, Filter } from "lucide-react";
import { MOCK_POLICY_CHANGES, QUARTERS, PAYER_COLORS, type PolicyChange } from "./mock-data";

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

export function PolicyChanges() {
  const [selectedQuarterA, setSelectedQuarterA] = useState("2026-Q1");
  const [selectedQuarterB, setSelectedQuarterB] = useState("2025-Q4");
  const [payerFilter, setPayerFilter] = useState("");
  const [drugFilter, setDrugFilter] = useState("");

  const drugOptions = [...new Set(MOCK_POLICY_CHANGES.map((c) => c.drugName))];
  const payerOptions = [...new Set(MOCK_POLICY_CHANGES.map((c) => c.payer))];

  // Filter changes that fall within the selected quarter range
  const filteredChanges = useMemo(() => {
    return MOCK_POLICY_CHANGES.filter((c) => {
      if (c.quarter !== selectedQuarterA && c.quarter !== selectedQuarterB) return false;
      if (payerFilter && c.payer !== payerFilter) return false;
      if (drugFilter && c.drugName !== drugFilter) return false;
      return true;
    });
  }, [selectedQuarterA, selectedQuarterB, payerFilter, drugFilter]);

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

  return (
    <div>
      <h2 className="mt-0 mb-1">Policy Changes & Version Tracking</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Compare how payer policies have changed across quarters. Select two time periods to see a diff of all modifications.
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
      <div className="flex items-center gap-5 mb-5 text-sm" role="status" aria-live="polite">
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

      {/* Change list */}
      {filteredChanges.length === 0 ? (
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
            const ps = PAYER_COLORS[firstChange.payer];
            return (
              <section key={groupKey} className="border border-border rounded-xl bg-card overflow-hidden" aria-label={`Changes for ${groupKey}`}>
                {/* Group header */}
                <div className="px-5 py-3 bg-muted/50 border-b border-border flex items-center gap-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-sm ${ps.bg} ${ps.text}`}>
                    {firstChange.payer}
                  </span>
                  <h3 className="mt-0 mb-0">{firstChange.drugName}</h3>
                  <span className="text-sm text-muted-foreground ml-auto">{changes.length} change{changes.length !== 1 ? "s" : ""}</span>
                </div>

                {/* Individual changes — two-column diff */}
                <div className="divide-y divide-border">
                  {changes.map((change) => {
                    const style = CHANGE_TYPE_STYLES[change.changeType];
                    return (
                      <div
                        key={change.id}
                        className={`flex flex-col md:flex-row border-l-4 ${style.border}`}
                      >
                        {/* Field + type indicator */}
                        <div className="px-5 py-4 md:w-56 shrink-0 bg-muted/20">
                          <div className="flex items-center gap-2 mb-1">
                            {style.icon}
                            <span className={`text-xs px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                              {style.label}
                            </span>
                          </div>
                          <p className="text-sm mb-0">{change.field}</p>
                          <p className="text-xs text-muted-foreground mb-0 mt-1">Effective {change.effectiveDate}</p>
                        </div>

                        {/* Two-column diff: Old → New */}
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
                          {/* Previous version */}
                          <div className="px-5 py-4 bg-red-50/50">
                            <span className="text-xs text-red-800 flex items-center gap-1 mb-1.5">
                              <Minus className="w-3 h-3" aria-hidden="true" />
                              Previous
                            </span>
                            <p className="text-sm mb-0 line-through decoration-red-300">{change.oldValue}</p>
                          </div>
                          {/* New version */}
                          <div className="px-5 py-4 bg-emerald-50/50">
                            <span className="text-xs text-emerald-800 flex items-center gap-1 mb-1.5">
                              <Plus className="w-3 h-3" aria-hidden="true" />
                              Current
                            </span>
                            <p className="text-sm mb-0">{change.newValue}</p>
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
