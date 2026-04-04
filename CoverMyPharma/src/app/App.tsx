import { useState, useMemo, type FormEvent, type ReactNode } from "react";
import {
  Search, GitCompareArrows, LayoutGrid, CheckCircle, AlertTriangle,
  Pill, ClipboardList, History,
} from "lucide-react";
import { MOCK_PLANS, DIAGNOSIS_OPTIONS } from "./components/mock-data";
import { PlanSnapshotCard } from "./components/plan-card";
import { DetailPanel } from "./components/detail-panel";
import { ComparisonPanel } from "./components/comparison-panel";
import { CriteriaLookup } from "./components/criteria-lookup";
import { PolicyChanges } from "./components/policy-changes";

const PAYERS = ["Aetna", "UHC", "Cigna"] as const;

type ActiveTab = "search" | "criteria" | "changes";

const TABS: { id: ActiveTab; label: string; icon: ReactNode }[] = [
  { id: "search", label: "Coverage Search", icon: <Search className="w-4 h-4" aria-hidden="true" /> },
  { id: "criteria", label: "Criteria Lookup", icon: <ClipboardList className="w-4 h-4" aria-hidden="true" /> },
  { id: "changes", label: "Policy Changes", icon: <History className="w-4 h-4" aria-hidden="true" /> },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("search");

  // ── Coverage Search state ──
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPayers, setSelectedPayers] = useState<Set<string>>(new Set(PAYERS));
  const [selectedDiagnosis, setSelectedDiagnosis] = useState("");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());

  const filteredPlans = useMemo(() => {
    return MOCK_PLANS.filter((p) => {
      if (searchQuery && !p.drugName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (!selectedPayers.has(p.payer)) return false;
      if (selectedDiagnosis && !p.diagnosisCodes.includes(selectedDiagnosis)) return false;
      return true;
    });
  }, [searchQuery, selectedPayers, selectedDiagnosis]);

  const selectedPlan = selectedCardId ? MOCK_PLANS.find((p) => p.id === selectedCardId) : null;
  const comparePlans = MOCK_PLANS.filter((p) => compareIds.has(p.id));
  const isCompareMode = comparePlans.length >= 2;

  const togglePayer = (payer: string) => {
    setSelectedPayers((prev) => {
      const next = new Set(prev);
      if (next.has(payer)) next.delete(payer);
      else next.add(payer);
      return next;
    });
  };

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSearch = (e?: FormEvent) => {
    e?.preventDefault();
  };

  const stats = {
    total: filteredPlans.length,
    preferred: filteredPlans.filter((p) => p.coverageStatus === "Preferred").length,
    paRequired: filteredPlans.filter((p) => p.coverageStatus === "Prior Auth Required").length,
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* WCAG: Skip to main content link */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* ── Header with professional branding ── */}
      <header className="border-b border-border bg-card sticky top-0 z-20" role="banner">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary">
            <Pill className="w-5 h-5 text-primary-foreground" aria-hidden="true" />
          </div>
          <div>
            <h1 className="leading-tight">CoverMyPharma</h1>
            <p className="text-sm text-muted-foreground mb-0">Medical Benefit Drug Policy Tracker</p>
          </div>
        </div>

        {/* ── Tab Navigation ── */}
        <nav aria-label="Main navigation" className="max-w-7xl mx-auto px-4">
          <div className="flex gap-0 border-b-0" role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={activeTab === tab.id}
                aria-controls={`panel-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-4 py-3 min-h-[44px] text-sm border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      {/* ── Main Content ── */}
      <main id="main-content" className="flex-1">
        {/* ═══ TAB 1: Coverage Search ═══ */}
        <div
          role="tabpanel"
          id="panel-search"
          aria-labelledby="tab-search"
          className={activeTab === "search" ? "" : "hidden"}
        >
          <div className="max-w-7xl mx-auto px-4 py-6">
            <h2 className="mt-0 mb-1">Coverage Search</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Search by drug name to discover which plans cover it and view coverage details.
            </p>

            {/* Filters */}
            <form onSubmit={handleSearch} className="flex flex-col lg:flex-row gap-4 mb-6" aria-label="Coverage search filters">
              {/* Search */}
              <div className="flex-1 max-w-md">
                <label htmlFor="drug-search" className="block text-sm mb-1.5">
                  Drug Name
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  <input
                    id="drug-search"
                    type="search"
                    placeholder="e.g. Keytruda, Humira..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 min-h-[44px] rounded-lg border border-border bg-input-background"
                    aria-describedby="search-hint"
                  />
                </div>
                <span id="search-hint" className="sr-only">Type a drug name to filter the plan cards below</span>
              </div>

              {/* Payer checkboxes */}
              <fieldset className="flex items-end gap-4">
                <legend className="text-sm mb-1.5">Payers</legend>
                {PAYERS.map((payer) => (
                  <label key={payer} className="flex items-center gap-2 cursor-pointer min-h-[44px] px-1">
                    <input
                      type="checkbox"
                      checked={selectedPayers.has(payer)}
                      onChange={() => togglePayer(payer)}
                      className="w-5 h-5 rounded accent-primary"
                    />
                    <span className="text-sm">{payer}</span>
                  </label>
                ))}
              </fieldset>

              {/* Diagnosis dropdown */}
              <div className="flex flex-col">
                <label htmlFor="diagnosis-select" className="text-sm mb-1.5">
                  Diagnosis Code
                </label>
                <select
                  id="diagnosis-select"
                  value={selectedDiagnosis}
                  onChange={(e) => setSelectedDiagnosis(e.target.value)}
                  className="px-3 py-2.5 min-h-[44px] rounded-lg border border-border bg-input-background text-sm max-w-xs"
                >
                  <option value="">All Diagnoses</option>
                  {DIAGNOSIS_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>

              {/* Search button */}
              <div className="flex items-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-6 py-2.5 min-h-[44px] rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm"
                >
                  <Search className="w-4 h-4" aria-hidden="true" />
                  Find Coverage
                </button>
              </div>
            </form>

            {/* Stats bar */}
            <div className="flex items-center gap-6 mb-5 text-sm text-muted-foreground" role="status" aria-live="polite">
              <span>{stats.total} plan{stats.total !== 1 ? "s" : ""} found</span>
              <span className="inline-flex items-center gap-1.5 text-emerald-800">
                <CheckCircle className="w-4 h-4" aria-hidden="true" />
                {stats.preferred} Preferred
              </span>
              <span className="inline-flex items-center gap-1.5 text-amber-800">
                <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                {stats.paRequired} PA Required
              </span>
              {compareIds.size > 0 && (
                <span className="ml-auto flex items-center gap-2 text-primary">
                  <GitCompareArrows className="w-4 h-4" aria-hidden="true" />
                  {compareIds.size} selected for comparison
                  {compareIds.size >= 2 && <span className="text-sm bg-primary text-primary-foreground px-2 py-0.5 rounded-full">Diff Active</span>}
                  <button
                    onClick={() => setCompareIds(new Set())}
                    className="text-sm underline text-muted-foreground ml-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label="Clear comparison selection"
                  >
                    Clear
                  </button>
                </span>
              )}
            </div>

            {/* Results heading */}
            <h3 className="mt-0 mb-4">
              {searchQuery ? `Results for "${searchQuery}"` : "All Indexed Plans"}
            </h3>

            {/* Cards grid */}
            {filteredPlans.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground" role="status">
                <LayoutGrid className="w-10 h-10 mx-auto mb-3 opacity-40" aria-hidden="true" />
                <p>No plans match your filters</p>
                <p className="text-sm mt-1">Try adjusting your search or filter criteria</p>
              </div>
            ) : (
              <div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                role="list"
                aria-label="Plan snapshot cards"
              >
                {filteredPlans.map((plan) => (
                  <div role="listitem" key={plan.id}>
                    <PlanSnapshotCard
                      plan={plan}
                      isSelected={selectedCardId === plan.id}
                      isCompareChecked={compareIds.has(plan.id)}
                      onSelect={(id) => setSelectedCardId(selectedCardId === id ? null : id)}
                      onCompareToggle={toggleCompare}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom panels */}
          {isCompareMode ? (
            <ComparisonPanel plans={comparePlans} onClose={() => setCompareIds(new Set())} />
          ) : selectedPlan ? (
            <DetailPanel plan={selectedPlan} onClose={() => setSelectedCardId(null)} />
          ) : null}
        </div>

        {/* ═══ TAB 2: Criteria Lookup ═══ */}
        <div
          role="tabpanel"
          id="panel-criteria"
          aria-labelledby="tab-criteria"
          className={activeTab === "criteria" ? "" : "hidden"}
        >
          <div className="max-w-5xl mx-auto px-4 py-6">
            <CriteriaLookup />
          </div>
        </div>

        {/* ═══ TAB 3: Policy Changes ═══ */}
        <div
          role="tabpanel"
          id="panel-changes"
          aria-labelledby="tab-changes"
          className={activeTab === "changes" ? "" : "hidden"}
        >
          <div className="max-w-6xl mx-auto px-4 py-6">
            <PolicyChanges />
          </div>
        </div>
      </main>
    </div>
  );
}