import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
  type PlanCard,
  type PolicyChange,
} from "./components/mock-data";
import { PlanSnapshotCard } from "./components/plan-card";
import { DetailPanel } from "./components/detail-panel";
import { ComparisonPanel } from "./components/comparison-panel";
import { CriteriaLookup } from "./components/criteria-lookup";
import { PolicyChanges } from "./components/policy-changes";
import { VOICE_OPTIONS } from "./components/tts";
import UploadPage from "./components/upload-page";
import symbol from "@/assets/CoverMyPharmaSymbol.svg";
import { transformBackendResponse } from "@/app/lib/plan-transform";
import { useSavedPlans } from "@/hooks/useSavedPlans";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

type ActiveTab = "search" | "criteria" | "changes";
const MAX_COMPARE_PLANS = 4;

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

const SESSION_OWNER_KEY = "cmp_session_owner";
const SESSION_UPLOADED_PLANS_KEY = "cmp_uploaded_plans";
const SESSION_SHOW_UPLOAD_KEY = "cmp_show_upload";

function isPlanCardLike(value: unknown): value is PlanCard {
  if (!value || typeof value !== "object") {
    return false;
  }

  const plan = value as Partial<PlanCard>;
  return (
    typeof plan.id === "string" &&
    typeof plan.payer === "string" &&
    typeof plan.drugName === "string" &&
    typeof plan.rxNormCode === "string" &&
    typeof plan.coverageStatus === "string" &&
    typeof plan.effectiveDate === "string" &&
    Array.isArray(plan.diagnosisCodes) &&
    !!plan.criteria &&
    typeof plan.criteria === "object"
  );
}

function hasMatchingSessionOwner(ownerId: string) {
  try {
    return sessionStorage.getItem(SESSION_OWNER_KEY) === ownerId;
  } catch {
    return false;
  }
}

function loadSessionUploadedPlans(ownerId: string): PlanCard[] {
  try {
    if (!hasMatchingSessionOwner(ownerId)) {
      return [];
    }

    const raw = sessionStorage.getItem(SESSION_UPLOADED_PLANS_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((plan): plan is PlanCard => isPlanCardLike(plan));
  } catch {
    return [];
  }
}

function loadStoredShowUpload(ownerId: string) {
  try {
    if (!hasMatchingSessionOwner(ownerId)) {
      return true;
    }

    return sessionStorage.getItem(SESSION_SHOW_UPLOAD_KEY) !== "0";
  } catch {
    return true;
  }
}

function persistSessionOwner(ownerId: string) {
  try {
    sessionStorage.setItem(SESSION_OWNER_KEY, ownerId);
  } catch {
    /* sessionStorage unavailable */
  }
}

function persistSessionUploadedPlans(plans: PlanCard[], ownerId: string) {
  try {
    persistSessionOwner(ownerId);
    sessionStorage.setItem(SESSION_UPLOADED_PLANS_KEY, JSON.stringify(plans));
  } catch {
    /* sessionStorage unavailable */
  }
}

function persistShowUploadState(showUpload: boolean, ownerId: string) {
  try {
    persistSessionOwner(ownerId);
    sessionStorage.setItem(SESSION_SHOW_UPLOAD_KEY, showUpload ? "1" : "0");
  } catch {
    /* sessionStorage unavailable */
  }
}

function clearStoredSessionState() {
  try {
    sessionStorage.removeItem(SESSION_OWNER_KEY);
    sessionStorage.removeItem(SESSION_UPLOADED_PLANS_KEY);
    sessionStorage.removeItem(SESSION_SHOW_UPLOAD_KEY);
  } catch {
    /* sessionStorage unavailable */
  }
}

function getPlanIdentity(plan: PlanCard) {
  return plan.documentId ?? plan.id;
}

function mergeRealPlans(uploadedPlans: PlanCard[], savedPlans: PlanCard[]) {
  const merged = new Map<string, PlanCard>();

  uploadedPlans.forEach((plan) => {
    merged.set(getPlanIdentity(plan), plan);
  });

  savedPlans.forEach((plan) => {
    merged.set(getPlanIdentity(plan), plan);
  });

  return [...merged.values()];
}

export default function App() {
  const {
    isAuthenticated,
    isLoading: authLoading,
    loginWithRedirect,
    logout,
    user,
  } = useAuth0();
  const [activeTab, setActiveTab] = useState<ActiveTab>("search");
  const [uploadedPlans, setUploadedPlans] = useState<PlanCard[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [diagnosisSearchQuery, setDiagnosisSearchQuery] = useState("");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [selectedVoiceId, setSelectedVoiceId] = useState(VOICE_OPTIONS[0].id);
  const [selectedPlaybackRate, setSelectedPlaybackRate] = useState(1);
  const [showUpload, setShowUpload] = useState(true);
  const [isSessionHydrated, setIsSessionHydrated] = useState(false);
  const {
    plans: savedPlans,
    isLoading: isSavedPlansLoading,
    error: savedPlansError,
    reload: reloadSavedPlans,
  } = useSavedPlans();
  const sessionOwnerId = user?.sub ?? null;

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!isAuthenticated || !sessionOwnerId) {
      setUploadedPlans([]);
      setShowUpload(true);
      clearStoredSessionState();
      setIsSessionHydrated(true);
      return;
    }

    setUploadedPlans(loadSessionUploadedPlans(sessionOwnerId));
    setShowUpload(loadStoredShowUpload(sessionOwnerId));
    setIsSessionHydrated(true);
  }, [authLoading, isAuthenticated, sessionOwnerId]);

  useEffect(() => {
    if (!isSessionHydrated || !isAuthenticated || !sessionOwnerId) {
      return;
    }

    persistSessionUploadedPlans(uploadedPlans, sessionOwnerId);
  }, [isAuthenticated, isSessionHydrated, sessionOwnerId, uploadedPlans]);

  useEffect(() => {
    if (!isSessionHydrated || !isAuthenticated || !sessionOwnerId) {
      return;
    }

    persistShowUploadState(showUpload, sessionOwnerId);
  }, [isAuthenticated, isSessionHydrated, sessionOwnerId, showUpload]);

  const realPlans = useMemo(
    () => mergeRealPlans(uploadedPlans, savedPlans),
    [uploadedPlans, savedPlans],
  );

  const activePlans = useMemo(
    () => (realPlans.length > 0 ? realPlans : MOCK_PLANS),
    [realPlans],
  );
  const hasRealPlans = realPlans.length > 0;

  const aggregatedPolicyChanges = useMemo((): PolicyChange[] => {
    if (!hasRealPlans) return [];
    return realPlans.flatMap((plan) => plan.policyChanges ?? []);
  }, [hasRealPlans, realPlans]);

  const availablePayers = useMemo(
    () => [...new Set(activePlans.map((plan) => plan.payer))],
    [activePlans],
  );

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

  const activeSelectedPayersRef = useRef(activeSelectedPayers);
  useEffect(() => {
    activeSelectedPayersRef.current = activeSelectedPayers;
  }, [activeSelectedPayers]);

  const availablePayersSet = useMemo(
    () => new Set(availablePayers),
    [availablePayers],
  );

  /** When the set of payers in the data changes, default back to “all payers selected”. */
  const availablePayersKey = useMemo(
    () => [...availablePayers].sort().join("\0"),
    [availablePayers],
  );
  useEffect(() => {
    setSelectedPayers(null);
  }, [availablePayersKey]);

  const handleUploadSuccess = useCallback(
    (
      data: unknown,
      meta?: { documentId?: string; filename?: string },
    ) => {
      const transformedPlan = transformBackendResponse(data, {
        planId: meta?.documentId,
        sourceFilename: meta?.filename,
        documentId: meta?.documentId,
      });

      if (!transformedPlan) {
        return;
      }

      setUploadedPlans((prev) => [...prev, transformedPlan]);
    },
    [],
  );

  const handleDeleteDocument = useCallback(
    async (documentId: string): Promise<boolean> => {
      if (hasSupabaseConfig && supabase && isAuthenticated) {
        const { error } = await supabase
          .from("medical_documents")
          .delete()
          .eq("id", documentId);

        if (error) {
          console.error("Failed to delete document:", error);
          return false;
        }
      }

      setSelectedCardId((id) => (id === documentId ? null : id));
      setCompareIds((prev) => {
        const next = new Set(prev);
        next.delete(documentId);
        return next;
      });
      setUploadedPlans((prev) => prev.filter((p) => p.id !== documentId));
      void reloadSavedPlans();
      return true;
    },
    [isAuthenticated, reloadSavedPlans],
  );

  const filteredPlans = useMemo(() => {
    const drugQ = searchQuery.trim().toLowerCase();
    const diagQ = diagnosisSearchQuery.trim().toLowerCase();

    return activePlans.filter((plan) => {
      if (drugQ) {
        const inBrand = plan.drugName.toLowerCase().includes(drugQ);
        const inGeneric =
          plan.genericName?.toLowerCase().includes(drugQ) ?? false;
        if (!inBrand && !inGeneric) return false;
      }

      if (!activeSelectedPayers.has(plan.payer)) {
        return false;
      }

      if (diagQ) {
        const codeHit = plan.diagnosisCodes.some((code) =>
          code.toLowerCase().includes(diagQ),
        );
        const condHit =
          plan.conditions?.toLowerCase().includes(diagQ) ?? false;
        const labelHit = plan.diagnosisCodes.some((code) => {
          const label = diagnosisLabels.get(code);
          return label?.toLowerCase().includes(diagQ) ?? false;
        });
        if (!codeHit && !condHit && !labelHit) return false;
      }

      return true;
    });
  }, [
    activePlans,
    searchQuery,
    diagnosisSearchQuery,
    activeSelectedPayers,
  ]);

  const selectedPlan = selectedCardId
    ? activePlans.find((plan) => plan.id === selectedCardId) ?? null
    : null;
  const comparePlans = activePlans.filter((plan) => compareIds.has(plan.id));
  const isCompareMode = comparePlans.length >= 2;

  const togglePayer = (payer: string) => {
    setSelectedPayers(() => {
      const next = new Set(activeSelectedPayersRef.current);
      if (next.has(payer)) next.delete(payer);
      else next.add(payer);
      if (next.size === availablePayersSet.size) {
        const allIncluded = [...availablePayersSet].every((p) => next.has(p));
        if (allIncluded) return null;
      }
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
        className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-8 py-4 bg-transparent border-b border-white/20 shadow-lg transition-all duration-300"
        role="banner"
        style={{
          background: "#5b8db8",
        }}
      >
        <div className="flex items-center gap-3 justify-self-start">
          <img
            src={symbol}
            alt="CoverMyPharma"
            className="h-20 w-auto cursor-pointer hover:scale-105 transition-transform duration-200"
            style={{ filter: "brightness(0) invert(1)" }}
            onClick={() => setShowUpload(true)}
          />
        </div>

        <nav aria-label="Main navigation" className="flex justify-center">
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

        <div className="flex items-center gap-3 justify-self-end">
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

              <div className="flex flex-col flex-1 min-w-0 max-w-md">
                <label htmlFor="diagnosis-search" className="text-sm mb-1.5">
                  Diagnosis code or keyword
                </label>
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <input
                    id="diagnosis-search"
                    type="search"
                    placeholder="e.g. C34, lung, Crohn's..."
                    value={diagnosisSearchQuery}
                    onChange={(e) => setDiagnosisSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 min-h-[44px] rounded-lg border border-border bg-input-background text-sm"
                    aria-describedby="diagnosis-search-hint"
                  />
                </div>
                <span id="diagnosis-search-hint" className="sr-only">
                  Filter by ICD-style code, condition text, or diagnosis label
                </span>
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
                : hasRealPlans
                  ? "Uploaded Policy Analyses"
                  : "All Indexed Plans"}
            </h3>
            {isSavedPlansLoading && !realPlans.length && (
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
              playbackRate={selectedPlaybackRate}
              onPlaybackRateChange={setSelectedPlaybackRate}
              onDeleteDocument={handleDeleteDocument}
              onPlanDeleted={(planId) => {
                setCompareIds((prev) => {
                  const next = new Set(prev);
                  next.delete(planId);
                  return next;
                });
                setSelectedCardId((id) => (id === planId ? null : id));
              }}
            />
          ) : selectedPlan ? (
            <DetailPanel
              plan={selectedPlan}
              onClose={() => setSelectedCardId(null)}
              voiceId={selectedVoiceId}
              onVoiceChange={setSelectedVoiceId}
              playbackRate={selectedPlaybackRate}
              onPlaybackRateChange={setSelectedPlaybackRate}
              onDeleteDocument={handleDeleteDocument}
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
              plansDataSource={hasRealPlans ? "uploaded" : "mock"}
              isLoading={isSavedPlansLoading}
              voiceId={selectedVoiceId}
              onVoiceChange={setSelectedVoiceId}
              playbackRate={selectedPlaybackRate}
              onPlaybackRateChange={setSelectedPlaybackRate}
              onDeleteDocument={handleDeleteDocument}
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
            <PolicyChanges
              dbChanges={aggregatedPolicyChanges}
              hasRealPlans={hasRealPlans}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
