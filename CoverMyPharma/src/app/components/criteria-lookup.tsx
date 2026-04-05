import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Search, Info } from "lucide-react";
import type { PlanCard } from "./mock-data";
import { CriteriaLookupResultDocument } from "./criteria-lookup-document";

type PlansDataSource = "mock" | "uploaded" | "empty";

const LOOKUP_FOCUS_CARD =
  "rounded-xl border-2 border-primary bg-card shadow-lg ring-2 ring-primary/40";

const LOOKUP_FOCUS_PLACEHOLDER =
  "rounded-xl border-2 border-dashed border-primary bg-card shadow-lg ring-2 ring-primary/40";

function sortPlansByEffectiveDateDesc(plans: PlanCard[]): PlanCard[] {
  return [...plans].sort((a, b) => {
    const ta = Date.parse(a.effectiveDate);
    const tb = Date.parse(b.effectiveDate);
    if (!Number.isNaN(tb) && !Number.isNaN(ta)) return tb - ta;
    if (!Number.isNaN(tb)) return 1;
    if (!Number.isNaN(ta)) return -1;
    return 0;
  });
}

function tokenMatches(haystack: string, needle: string): boolean {
  const n = needle.trim().toLowerCase();
  if (!n) return true;
  return haystack.toLowerCase().includes(n);
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map((s) => s.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

const MAX_SUGGESTIONS = 12;

export function CriteriaLookup({
  plans,
  plansDataSource,
  isLoading = false,
  voiceId,
  onVoiceChange,
  playbackRate = 1,
  onPlaybackRateChange,
  onDeleteDocument,
}: {
  plans: PlanCard[];
  plansDataSource: PlansDataSource;
  isLoading?: boolean;
  voiceId?: string;
  onVoiceChange?: (voiceId: string) => void;
  playbackRate?: number;
  onPlaybackRateChange?: (playbackRate: number) => void;
  onDeleteDocument?: (documentId: string) => boolean | Promise<boolean>;
}) {
  const allPayers = useMemo(
    () => uniqueSorted(plans.map((p) => p.payer)),
    [plans],
  );
  const allDrugs = useMemo(
    () => uniqueSorted(plans.map((p) => p.drugName)),
    [plans],
  );

  const [payerQuery, setPayerQuery] = useState("");
  const [drugQuery, setDrugQuery] = useState("");
  const [lookupResults, setLookupResults] = useState<PlanCard[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const [payerListOpen, setPayerListOpen] = useState(false);
  const [drugListOpen, setDrugListOpen] = useState(false);
  const [payerHighlight, setPayerHighlight] = useState(0);
  const [drugHighlight, setDrugHighlight] = useState(0);

  const payerWrapRef = useRef<HTMLDivElement>(null);
  const drugWrapRef = useRef<HTMLDivElement>(null);

  const payerSuggestions = useMemo(() => {
    const q = payerQuery.trim().toLowerCase();
    const pool = q
      ? allPayers.filter((p) => p.toLowerCase().includes(q))
      : allPayers;
    return pool.slice(0, MAX_SUGGESTIONS);
  }, [allPayers, payerQuery]);

  const drugSuggestions = useMemo(() => {
    const q = drugQuery.trim().toLowerCase();
    const drugsFromMatchingPayer = payerQuery.trim()
      ? uniqueSorted(
          plans
            .filter((p) => tokenMatches(p.payer, payerQuery))
            .map((p) => p.drugName),
        )
      : allDrugs;
    const pool = q
      ? drugsFromMatchingPayer.filter((d) => d.toLowerCase().includes(q))
      : drugsFromMatchingPayer;
    return pool.slice(0, MAX_SUGGESTIONS);
  }, [allDrugs, drugQuery, payerQuery, plans]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (payerWrapRef.current && !payerWrapRef.current.contains(t)) {
        setPayerListOpen(false);
      }
      if (drugWrapRef.current && !drugWrapRef.current.contains(t)) {
        setDrugListOpen(false);
      }
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const runLookup = useCallback(() => {
    setHasSearched(true);
    setPayerListOpen(false);
    setDrugListOpen(false);
    const matches = plans.filter((p) => {
      const drugHaystack = [p.drugName, p.genericName].filter(Boolean).join(" ");
      return (
        tokenMatches(p.payer, payerQuery) && tokenMatches(drugHaystack, drugQuery)
      );
    });
    setLookupResults(sortPlansByEffectiveDateDesc(matches));
  }, [plans, payerQuery, drugQuery]);

  const handleLookupDelete = useCallback(
    async (documentId: string) => {
      if (!onDeleteDocument) return false;
      const ok = await onDeleteDocument(documentId);
      if (ok) {
        setLookupResults((prev) => prev.filter((p) => p.id !== documentId));
      }
      return ok;
    },
    [onDeleteDocument],
  );

  useEffect(() => {
    setPayerHighlight(0);
  }, [payerQuery, payerListOpen]);

  useEffect(() => {
    setDrugHighlight(0);
  }, [drugQuery, drugListOpen]);

  if (plansDataSource === "empty" || plans.length === 0) {
    return (
      <div className="w-full">
        <h2 className="mt-0 mb-1">Criteria Lookup</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Look up stored coverage fields by insurance provider and drug (same data as Coverage Search).
        </p>
        <div
          className="border-2 border-dashed border-border rounded-xl bg-muted/30 p-8 text-center"
          role="status"
        >
          <Info className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" aria-hidden="true" />
          <p className="text-muted-foreground mb-1">No plans available</p>
          <p className="text-sm text-muted-foreground mb-0">
            Upload policy PDFs or sign in so saved documents appear here.
          </p>
        </div>
      </div>
    );
  }

  const canSearch = plans.length > 0;
  const showVoice =
    voiceId != null && onVoiceChange != null && onPlaybackRateChange != null;

  return (
    <div className="w-full">
      <h2 className="mt-0 mb-1">Criteria Lookup</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Type any part of a provider or drug name; suggestions come from your indexed plans. An empty field matches any value for that column.
      </p>
      {isLoading ? (
        <p className="text-sm text-muted-foreground mb-4" role="status">
          Loading saved policy records…
        </p>
      ) : null}

      <div className={`${LOOKUP_FOCUS_CARD} p-5 mb-6 w-full`}>
        <div className="flex flex-col lg:flex-row gap-4 lg:items-end">
          <div ref={payerWrapRef} className="flex-1 min-w-0 relative">
            <label htmlFor="criteria-payer-search" className="block text-sm mb-1.5 font-medium">
              Insurance provider
            </label>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="criteria-payer-search"
                type="search"
                autoComplete="off"
                role="combobox"
                aria-expanded={payerListOpen}
                aria-controls="criteria-payer-listbox"
                aria-autocomplete="list"
                value={payerQuery}
                onChange={(e) => {
                  setPayerQuery(e.target.value);
                  setPayerListOpen(true);
                  setHasSearched(false);
                }}
                onFocus={() => setPayerListOpen(true)}
                onKeyDown={(e) => {
                  if (!payerListOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                    setPayerListOpen(true);
                    return;
                  }
                  if (e.key === "Escape") {
                    setPayerListOpen(false);
                    return;
                  }
                  if (e.key === "Enter") {
                    if (payerListOpen && payerSuggestions.length > 0) {
                      e.preventDefault();
                      setPayerQuery(
                        payerSuggestions[payerHighlight] ?? payerSuggestions[0]!,
                      );
                      setPayerListOpen(false);
                    } else {
                      runLookup();
                    }
                    return;
                  }
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setPayerHighlight((i) =>
                      Math.min(i + 1, Math.max(0, payerSuggestions.length - 1)),
                    );
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setPayerHighlight((i) => Math.max(0, i - 1));
                  }
                }}
                placeholder="e.g. Aetna, UHC…"
                className="w-full pl-10 pr-3 py-2.5 min-h-[44px] rounded-lg border border-border bg-input-background text-sm"
              />
            </div>
            {payerListOpen && payerSuggestions.length > 0 ? (
              <ul
                id="criteria-payer-listbox"
                role="listbox"
                className="absolute z-30 mt-1 w-full max-h-52 overflow-y-auto rounded-lg border border-border bg-card shadow-lg py-1"
              >
                {payerSuggestions.map((s, idx) => (
                  <li key={s} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={idx === payerHighlight}
                      className={`w-full text-left px-3 py-2.5 text-sm min-h-[44px] hover:bg-muted ${
                        idx === payerHighlight ? "bg-muted" : ""
                      }`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setPayerQuery(s);
                        setPayerListOpen(false);
                        setHasSearched(false);
                      }}
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div ref={drugWrapRef} className="flex-1 min-w-0 relative">
            <label htmlFor="criteria-drug-search" className="block text-sm mb-1.5 font-medium">
              Drug name
            </label>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="criteria-drug-search"
                type="search"
                autoComplete="off"
                role="combobox"
                aria-expanded={drugListOpen}
                aria-controls="criteria-drug-listbox"
                aria-autocomplete="list"
                value={drugQuery}
                onChange={(e) => {
                  setDrugQuery(e.target.value);
                  setDrugListOpen(true);
                  setHasSearched(false);
                }}
                onFocus={() => setDrugListOpen(true)}
                onKeyDown={(e) => {
                  if (!drugListOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                    setDrugListOpen(true);
                    return;
                  }
                  if (e.key === "Escape") {
                    setDrugListOpen(false);
                    return;
                  }
                  if (e.key === "Enter") {
                    if (drugListOpen && drugSuggestions.length > 0) {
                      e.preventDefault();
                      setDrugQuery(
                        drugSuggestions[drugHighlight] ?? drugSuggestions[0]!,
                      );
                      setDrugListOpen(false);
                    } else {
                      runLookup();
                    }
                    return;
                  }
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setDrugHighlight((i) =>
                      Math.min(i + 1, Math.max(0, drugSuggestions.length - 1)),
                    );
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setDrugHighlight((i) => Math.max(0, i - 1));
                  }
                }}
                placeholder="e.g. Keytruda, Humira…"
                className="w-full pl-10 pr-3 py-2.5 min-h-[44px] rounded-lg border border-border bg-input-background text-sm"
              />
            </div>
            {drugListOpen && drugSuggestions.length > 0 ? (
              <ul
                id="criteria-drug-listbox"
                role="listbox"
                className="absolute z-30 mt-1 w-full max-h-52 overflow-y-auto rounded-lg border border-border bg-card shadow-lg py-1"
              >
                {drugSuggestions.map((s, idx) => (
                  <li key={s} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={idx === drugHighlight}
                      className={`w-full text-left px-3 py-2.5 text-sm min-h-[44px] hover:bg-muted ${
                        idx === drugHighlight ? "bg-muted" : ""
                      }`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setDrugQuery(s);
                        setDrugListOpen(false);
                        setHasSearched(false);
                      }}
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="flex items-end shrink-0">
            <button
              type="button"
              onClick={runLookup}
              disabled={!canSearch}
              className={`inline-flex items-center gap-2 px-6 py-2.5 min-h-[44px] rounded-lg text-sm transition-colors ${
                canSearch
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              }`}
            >
              <Search className="w-4 h-4" aria-hidden="true" />
              Search
            </button>
          </div>
        </div>
      </div>

      {hasSearched && lookupResults.length > 0 ? (
        <div className="w-full space-y-6" aria-label="Matching criteria documents">
          {lookupResults.map((plan) => (
            <CriteriaLookupResultDocument
              key={plan.id}
              plan={plan}
              voiceId={showVoice ? voiceId : undefined}
              onVoiceChange={showVoice ? onVoiceChange : undefined}
              playbackRate={playbackRate}
              onPlaybackRateChange={showVoice ? onPlaybackRateChange : undefined}
              onDeleteDocument={
                onDeleteDocument ? handleLookupDelete : undefined
              }
            />
          ))}
        </div>
      ) : hasSearched && lookupResults.length === 0 ? (
        <div className={`${LOOKUP_FOCUS_CARD} p-8 text-center w-full`} role="status">
          <Info className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" aria-hidden="true" />
          <p className="text-muted-foreground mb-1">No matching plan</p>
          <p className="text-sm text-muted-foreground mb-0">
            No indexed plan matches both fields. Try different keywords or leave one field empty.
          </p>
        </div>
      ) : (
        <div className={`${LOOKUP_FOCUS_PLACEHOLDER} p-8 text-center w-full`} role="status">
          <Search className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" aria-hidden="true" />
          <p className="text-muted-foreground mb-1">Search your plans</p>
          <p className="text-sm text-muted-foreground mb-0">
            Results use the same document layout as Coverage Search details. Multiple matches stack below.
          </p>
        </div>
      )}
    </div>
  );
}
