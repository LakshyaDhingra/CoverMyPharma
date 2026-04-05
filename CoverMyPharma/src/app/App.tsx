import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Search,
  GitCompareArrows,
  LayoutGrid,
  CheckCircle,
  AlertTriangle,
  Pill,
  ClipboardList,
  History,
} from "lucide-react";
import {
  MOCK_PLANS,
  DIAGNOSIS_OPTIONS,
  type PlanCard,
} from "./components/mock-data";
import { PlanSnapshotCard } from "./components/plan-card";
import { DetailPanel } from "./components/detail-panel";
import { ComparisonPanel } from "./components/comparison-panel";
import { CriteriaLookup } from "./components/criteria-lookup";
import { PolicyChanges } from "./components/policy-changes";
import { VOICE_OPTIONS } from "./components/tts";
import UploadPage from "./components/upload-page";
import { transformBackendResponse } from "./lib/plan-transform";
import { useSavedPlans } from "@/hooks/useSavedPlans";

type ActiveTab = "search" | "criteria" | "changes";

const TABS: { id: ActiveTab; label: string; icon: ReactNode }[] = [
  {
    id: "search",
    label: "Coverage Search",
    icon: <Search className="w-4 h-4" aria-hidden="true" />,
  },
  {
    id: "criteria",
    label: "Criteria Lookup",
    icon: <ClipboardList className="w-4 h-4" aria-hidden="true" />,
  },
  {
    id: "changes",
    label: "Policy Changes",
    icon: <History className="w-4 h-4" aria-hidden="true" />,
  },
];

const diagnosisLabels = new Map(
  DIAGNOSIS_OPTIONS.map((option) => [option.value, option.label]),
);

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("search");
  const [uploadedPlans, setUploadedPlans] = useState<PlanCard[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDiagnosis, setSelectedDiagnosis] = useState("");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [selectedVoiceId, setSelectedVoiceId] = useState(VOICE_OPTIONS[0].id);
  const [showUpload, setShowUpload] = useState(true);
  const {
    plans: savedPlans,
    isLoading: isSavedPlansLoading,
    error: savedPlansError,
  } = useSavedPlans();

  const activePlans = useMemo(
    () =>
      uploadedPlans.length > 0 || savedPlans.length > 0
        ? [...uploadedPlans, ...savedPlans]
        : MOCK_PLANS,
    [uploadedPlans, savedPlans],
  );
  const hasRealPlans = uploadedPlans.length > 0 || savedPlans.length > 0;

  const availablePayers = useMemo(
    () => [...new Set(activePlans.map((plan) => plan.payer))],
    [activePlans],
  );

  const diagnosisOptions = useMemo(() => {
    const values = [...new Set(activePlans.flatMap((plan) => plan.diagnosisCodes))];
    return values.map((value) => ({
      value,
      label: diagnosisLabels.get(value) ?? value,
    }));
  }, [activePlans]);

  const [selectedPayers, setSelectedPayers] = useState<Set<string> | null>(null);
  const activeSelectedPayers = useMemo(() => {
    if (selectedPayers === null) {
      return new Set(availablePayers);
    }

    const availableSet = new Set(availablePayers);
    const next = new Set(
      [...selectedPayers].filter((payer) => availableSet.has(payer)),
    );

    if (selectedPayers.size > 0 && next.size === 0) {
      return new Set(availablePayers);
    }

    return next;
  }, [availablePayers, selectedPayers]);
  const activeSelectedDiagnosis = diagnosisOptions.some(
    (diagnosis) => diagnosis.value === selectedDiagnosis,
  )
    ? selectedDiagnosis
    : "";

  const handleUploadSuccess = (data: unknown) => {
    const transformedPlan = transformBackendResponse(data);

    if (!transformedPlan) {
      return;
    }

    setUploadedPlans((prev) => [...prev, transformedPlan]);
  };

  const filteredPlans = useMemo(() => {
    return activePlans.filter((plan) => {
      if (
        searchQuery &&
        !plan.drugName.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }

      if (!activeSelectedPayers.has(plan.payer)) {
        return false;
      }

      if (
        activeSelectedDiagnosis &&
        !plan.diagnosisCodes.includes(activeSelectedDiagnosis)
      ) {
        return false;
      }

      return true;
    });
  }, [activePlans, searchQuery, activeSelectedPayers, activeSelectedDiagnosis]);

  const selectedPlan = selectedCardId
    ? activePlans.find((plan) => plan.id === selectedCardId) ?? null
    : null;
  const comparePlans = activePlans.filter((plan) => compareIds.has(plan.id));
  const isCompareMode = comparePlans.length >= 2;

  const togglePayer = (payer: string) => {
    setSelectedPayers((prev) => {
      const next = prev === null ? new Set(activeSelectedPayers) : new Set(prev);
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

  if (showUpload) {
    return (
      <UploadPage
        onContinue={() => setShowUpload(false)}
        onUploadSuccess={handleUploadSuccess}
      />
    );
  }

  const stats = {
    total: filteredPlans.length,
    preferred: filteredPlans.filter((plan) => plan.coverageStatus === "Preferred")
      .length,
    paRequired: filteredPlans.filter(
      (plan) => plan.coverageStatus === "Prior Auth Required",
    ).length,
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background:
          "linear-gradient(135deg, #f0f7f5 0%, #e8f4f8 50%, #f0f0fa 100%)",
      }}
    >
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header
        className="border-b border-border bg-card sticky top-0 z-20"
        role="banner"
      >
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary">
            <Pill
              className="w-5 h-5 text-primary-foreground"
              aria-hidden="true"
            />
          </div>
          <div>
            <h1 className="leading-tight">CoverMyPharma</h1>
            <p className="text-sm text-muted-foreground mb-0">
              Medical Benefit Drug Policy Tracker
            </p>
          </div>
        </div>

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

      <main id="main-content" className="flex-1">
        <div
          role="tabpanel"
          id="panel-search"
          aria-labelledby="tab-search"
          className={activeTab === "search" ? "" : "hidden"}
        >
          <div className="max-w-7xl mx-auto px-4 py-6">
            <h2 className="mt-0 mb-1">Coverage Search</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Search by drug name to discover which plans cover it and view
              coverage details.
            </p>
            {savedPlansError && (
              <p className="text-sm text-amber-800 mb-4" role="status">
                Saved records could not be loaded from Supabase. Showing the
                data currently available in session.
              </p>
            )}

            <form
              onSubmit={handleSearch}
              className="flex flex-col lg:flex-row gap-4 mb-6"
              aria-label="Coverage search filters"
            >
              <div className="flex-1 max-w-md">
                <label htmlFor="drug-search" className="block text-sm mb-1.5">
                  Drug Name
                </label>
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
                    aria-hidden="true"
                  />
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
                <span id="search-hint" className="sr-only">
                  Type a drug name to filter the plan cards below
                </span>
              </div>

              <fieldset className="flex items-end gap-4">
                <legend className="text-sm mb-1.5">Payers</legend>
                {availablePayers.map((payer) => (
                  <label
                    key={payer}
                    className="flex items-center gap-2 cursor-pointer min-h-[44px] px-1"
                  >
                    <input
                      type="checkbox"
                      checked={activeSelectedPayers.has(payer)}
                      onChange={() => togglePayer(payer)}
                      className="w-5 h-5 rounded accent-primary"
                    />
                    <span className="text-sm">{payer}</span>
                  </label>
                ))}
              </fieldset>

              <div className="flex flex-col">
                <label htmlFor="diagnosis-select" className="text-sm mb-1.5">
                  Diagnosis Code
                </label>
                <select
                  id="diagnosis-select"
                  value={activeSelectedDiagnosis}
                  onChange={(e) => setSelectedDiagnosis(e.target.value)}
                  className="px-3 py-2.5 min-h-[44px] rounded-lg border border-border bg-input-background text-sm max-w-xs"
                >
                  <option value="">All Diagnoses</option>
                  {diagnosisOptions.map((diagnosis) => (
                    <option key={diagnosis.value} value={diagnosis.value}>
                      {diagnosis.label}
                    </option>
                  ))}
                </select>
              </div>

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

            <div
              className="flex items-center gap-6 mb-5 text-sm text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              <span>
                {stats.total} plan{stats.total !== 1 ? "s" : ""} found
              </span>
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
                  {compareIds.size >= 2 && (
                    <span className="text-sm bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                      Diff Active
                    </span>
                  )}
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

            <h3 className="mt-0 mb-4">
              {searchQuery
                ? `Results for "${searchQuery}"`
                : hasRealPlans
                  ? "Uploaded Policy Analyses"
                  : "All Indexed Plans"}
            </h3>
            {isSavedPlansLoading && !uploadedPlans.length && (
              <p className="text-sm text-muted-foreground mb-4" role="status">
                Loading saved policy records from Supabase...
              </p>
            )}

            {filteredPlans.length === 0 ? (
              <div
                className="text-center py-16 text-muted-foreground"
                role="status"
              >
                <LayoutGrid
                  className="w-10 h-10 mx-auto mb-3 opacity-40"
                  aria-hidden="true"
                />
                <p>No plans match your filters</p>
                <p className="text-sm mt-1">
                  Try adjusting your search or filter criteria
                </p>
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
                      onSelect={(id) =>
                        setSelectedCardId(selectedCardId === id ? null : id)
                      }
                      onCompareToggle={toggleCompare}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {isCompareMode ? (
            <ComparisonPanel
              plans={comparePlans}
              onClose={() => setCompareIds(new Set())}
              voiceId={selectedVoiceId}
              onVoiceChange={setSelectedVoiceId}
            />
          ) : selectedPlan ? (
            <DetailPanel
              plan={selectedPlan}
              onClose={() => setSelectedCardId(null)}
              voiceId={selectedVoiceId}
              onVoiceChange={setSelectedVoiceId}
            />
          ) : null}
        </div>

        <div
          role="tabpanel"
          id="panel-criteria"
          aria-labelledby="tab-criteria"
          className={activeTab === "criteria" ? "" : "hidden"}
        >
          <div className="max-w-5xl mx-auto px-4 py-6">
            <CriteriaLookup
              plans={activePlans}
              hasRealPlans={hasRealPlans}
              isLoading={isSavedPlansLoading}
            />
          </div>
        </div>

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
