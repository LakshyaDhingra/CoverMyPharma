import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  Search,
  GitCompareArrows,
  LayoutGrid,
  CheckCircle,
  AlertTriangle,
  ClipboardList,
  History,
} from "lucide-react";
import {
  MOCK_PLANS,
  DIAGNOSIS_OPTIONS,
  type CoverageStatus,
  type PlanCard,
} from "./components/mock-data";
import { PlanSnapshotCard } from "./components/plan-card";
import { DetailPanel } from "./components/detail-panel";
import { ComparisonPanel } from "./components/comparison-panel";
import { CriteriaLookup } from "./components/criteria-lookup";
import { PolicyChanges } from "./components/policy-changes";
import { VOICE_OPTIONS } from "./components/tts";
import UploadPage from "./components/upload-page";
import symbol from "@/assets/CoverMyPharmaSymbol.svg";

type ActiveTab = "search" | "criteria" | "changes";

interface UploadedAnalysis {
  patient_name?: unknown;
  medication_name?: unknown;
  generic_name?: unknown;
  conditions?: unknown;
  diagnosis?: unknown;
  diagnosis_codes?: unknown;
  insurance_provider?: unknown;
  prior_auth_required?: boolean;
  effective_date?: unknown;
  coverage_effective_date?: unknown;
  summary?: unknown;
  missing_information?: unknown;
  recommended_next_steps?: unknown;
}

interface ParsePdfResponse {
  success?: boolean;
  extracted_text?: unknown;
  analysis?: UploadedAnalysis;
}

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

const MAX_COMPARE_PLANS = 4;

const diagnosisLabels = new Map(
  DIAGNOSIS_OPTIONS.map((option) => [option.value, option.label]),
);

function truncateText(text: string, maxLength = 240) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}...`;
}

function flattenToStrings(value: unknown): string[] {
  if (value == null) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenToStrings(item));
  }

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap((item) =>
      flattenToStrings(item),
    );
  }

  const normalized = String(value).trim();
  return normalized ? [normalized] : [];
}

function normalizeText(value: unknown, fallback = "") {
  const parts = flattenToStrings(value);
  return parts.length > 0 ? parts.join("; ") : fallback;
}

function normalizeStringArray(value: unknown, fallback: string[] = []) {
  const parts = flattenToStrings(value);
  return parts.length > 0 ? parts : fallback;
}

function normalizeEffectiveDate(...values: unknown[]) {
  for (const value of values) {
    const text = normalizeText(value);
    if (!text) continue;

    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  return "";
}

function splitDiagnosisValues(diagnosis: unknown) {
  const values = flattenToStrings(diagnosis);

  return values
    .flatMap((value) => value.split(/[,;/]/))
    .map((value) => value.trim())
    .filter(Boolean);
}

function deriveCoverageStatus(analysis: UploadedAnalysis): CoverageStatus {
  if (analysis.prior_auth_required) {
    return "Prior Auth Required";
  }

  if (normalizeStringArray(analysis.missing_information).length > 0) {
    return "Covered with Limits";
  }

  return "Preferred";
}

function transformBackendResponse(response: unknown): PlanCard | null {
  if (!response || typeof response !== "object") {
    return null;
  }

  const payload = response as ParsePdfResponse;
  const analysis = payload.analysis;

  if (!analysis) {
    return null;
  }

  const diagnosisCodes = splitDiagnosisValues(analysis.diagnosis);
  const explicitDiagnosisCodes = normalizeStringArray(analysis.diagnosis_codes);
  const missingInformation = normalizeStringArray(
    analysis.missing_information,
  );
  const nextSteps = normalizeStringArray(analysis.recommended_next_steps);
  const summary = normalizeText(analysis.summary);
  const extractedText = normalizeText(payload.extracted_text);
  const medicationName = normalizeText(analysis.medication_name);
  const genericName = normalizeText(analysis.generic_name);
  const conditions = normalizeText(analysis.conditions || analysis.diagnosis);
  const insuranceProvider = normalizeText(
    analysis.insurance_provider,
    "Uploaded payer",
  );
  const diagnosisRequirement = normalizeText(
    analysis.diagnosis,
    "Not specified in uploaded PDF",
  );
  const sourceSnippet = summary || extractedText
    ? truncateText(summary || extractedText || "")
    : "No source excerpt was returned from the uploaded PDF.";
  const additionalNotes = [
    summary,
    nextSteps.length
      ? `Recommended next steps: ${nextSteps.join("; ")}`
      : "No recommended next steps were returned.",
  ]
    .filter(Boolean)
    .join(" ");
  const priorAuthRequirement = analysis.prior_auth_required == null
    ? "Not available"
    : analysis.prior_auth_required
      ? "Required"
      : "Not required";
  const effectiveDate = normalizeEffectiveDate(
    analysis.effective_date,
    analysis.coverage_effective_date,
  );

  return {
    id: crypto.randomUUID(),
    payer: insuranceProvider,
    drugName: medicationName || "Uploaded medication",
    genericName: genericName || undefined,
    conditions: conditions || "Not specified in uploaded PDF",
    priorAuthRequirement,
    rxNormCode: "Medical policy PDF analysis",
    coverageStatus: deriveCoverageStatus(analysis),
    effectiveDate,
    effectiveDateLabel: "Coverage Effective",
    sourceLinkLabel: "Excerpt from uploaded PDF",
    hasSourceDocumentLink: false,
    diagnosisCodes: explicitDiagnosisCodes.length
      ? explicitDiagnosisCodes
      : diagnosisCodes.length
      ? diagnosisCodes
      : ["Diagnosis not specified"],
    criteria: {
      trialDuration: analysis.prior_auth_required
        ? "Prior authorization is required; prepare supporting documentation before submission."
        : "No prior authorization requirement was identified in the uploaded PDF.",
      labRequirements: missingInformation.length
        ? missingInformation
        : ["No missing information was flagged by the parser."],
      ageLimit: "Not specified in uploaded PDF",
      diagnosisRequirement,
      additionalNotes:
        additionalNotes || "No additional notes were extracted from the PDF.",
      sourceSnippet,
      sourceDocLink: "#uploaded-pdf-analysis",
    },
  };
}

export default function App() {
  const { loginWithRedirect, logout, user, isAuthenticated } = useAuth0();
  const [activeTab, setActiveTab] = useState<ActiveTab>("search");
  const [uploadedPlans, setUploadedPlans] = useState<PlanCard[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDiagnosis, setSelectedDiagnosis] = useState("");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [selectedVoiceId, setSelectedVoiceId] = useState(VOICE_OPTIONS[0].id);
  const [showUpload, setShowUpload] = useState(true);

  const activePlans = useMemo(
    () => (uploadedPlans.length > 0 ? uploadedPlans : MOCK_PLANS),
    [uploadedPlans],
  );

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

  const [selectedPayers, setSelectedPayers] = useState<Set<string>>(
    () => new Set(availablePayers),
  );

  useEffect(() => {
    setSelectedPayers(new Set(availablePayers));
    setSelectedDiagnosis("");
    setSelectedCardId(null);
    setCompareIds(new Set());
  }, [availablePayers]);

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

      if (!selectedPayers.has(plan.payer)) {
        return false;
      }

      if (selectedDiagnosis && !plan.diagnosisCodes.includes(selectedDiagnosis)) {
        return false;
      }

      return true;
    });
  }, [activePlans, searchQuery, selectedPayers, selectedDiagnosis]);

  const selectedPlan = selectedCardId
    ? activePlans.find((plan) => plan.id === selectedCardId) ?? null
    : null;
  const comparePlans = activePlans.filter((plan) => compareIds.has(plan.id));
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
      else if (next.size < MAX_COMPARE_PLANS) next.add(id);
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
        className="flex items-center justify-between px-8 py-4 bg-transparent border-b border-white/20 shadow-lg transition-all duration-300"
        role="banner"
        style={{
          background: "#5b8db8",
        }}
      >
        <div className="flex items-center gap-3">
          <img
            src={symbol}
            alt="CoverMyPharma"
            className="h-20 w-auto cursor-pointer hover:scale-105 transition-transform duration-200"
            style={{ filter: "brightness(0) invert(1)" }}
            onClick={() => setShowUpload(true)}
          />
        </div>

        <nav
          aria-label="Main navigation"
          className="flex-1 flex justify-center"
        >
          <div className="flex flex-wrap items-center gap-3" role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={activeTab === tab.id}
                aria-controls={`panel-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] text-sm rounded-lg border transition-colors ${
                  activeTab === tab.id
                    ? "bg-[#3d3d3d] border-[#3d3d3d] text-white"
                    : "border-white/25 text-white hover:bg-white/20"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <span className="text-sm text-white">Hello, {user?.name}</span>
              <button
                onClick={() =>
                  logout({ logoutParams: { returnTo: window.location.origin } })
                }
                className="text-sm px-4 py-2 rounded-lg hover:bg-white/20 transition-all duration-200 hover:shadow-md text-white"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => loginWithRedirect()}
                className="text-sm px-4 py-2 rounded-lg hover:bg-white/20 transition-all duration-200 hover:shadow-md text-white"
              >
                Sign in
              </button>
              <button
                onClick={() => loginWithRedirect()}
                className="text-sm font-medium px-4 py-2 rounded-lg text-white hover:opacity-90 transition-all duration-200 hover:shadow-md"
                style={{
                  background: "#3d3d3d",
                }}
              >
                Get started
              </button>
            </>
          )}
        </div>
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
                      checked={selectedPayers.has(payer)}
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
                  value={selectedDiagnosis}
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
                  {compareIds.size === MAX_COMPARE_PLANS && (
                    <span className="text-sm text-muted-foreground">
                      Max {MAX_COMPARE_PLANS}
                    </span>
                  )}
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
                : uploadedPlans.length > 0
                  ? "Uploaded Policy Analyses"
                  : "All Indexed Plans"}
            </h3>

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
                      isCompareDisabled={
                        compareIds.size >= MAX_COMPARE_PLANS &&
                        !compareIds.has(plan.id)
                      }
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
            <CriteriaLookup />
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
