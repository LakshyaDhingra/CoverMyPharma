import { useState } from "react";
import { Search, FileText, ExternalLink, FlaskConical, Clock, Calendar, Stethoscope, StickyNote, Info } from "lucide-react";
import { MOCK_PLANS, PAYER_COLORS, STATUS_STYLES } from "./mock-data";

const PAYER_OPTIONS = ["Aetna", "UHC", "Cigna"] as const;
const DRUG_OPTIONS = [...new Set(MOCK_PLANS.map((p) => p.drugName))];

export function CriteriaLookup() {
  const [selectedPayer, setSelectedPayer] = useState("");
  const [selectedDrug, setSelectedDrug] = useState("");
  const [lookupResult, setLookupResult] = useState<typeof MOCK_PLANS[number] | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [showSource, setShowSource] = useState(false);

  const handleLookup = () => {
    setHasSearched(true);
    setShowSource(false);
    const match = MOCK_PLANS.find(
      (p) => p.payer === selectedPayer && p.drugName === selectedDrug
    );
    setLookupResult(match || null);
  };

  const canSearch = selectedPayer && selectedDrug;

  return (
    <div>
      <h2 className="mt-0 mb-1">Criteria Lookup</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Select a specific plan and drug to view detailed prior authorization criteria.
      </p>

      {/* Selection controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 max-w-xs">
          <label htmlFor="plan-select" className="block text-sm mb-1.5">
            Plan (Payer)
          </label>
          <select
            id="plan-select"
            value={selectedPayer}
            onChange={(e) => { setSelectedPayer(e.target.value); setHasSearched(false); }}
            className="w-full px-3 py-2.5 min-h-[44px] rounded-lg border border-border bg-input-background text-sm"
          >
            <option value="">-- Select a Plan --</option>
            {PAYER_OPTIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 max-w-xs">
          <label htmlFor="drug-select" className="block text-sm mb-1.5">
            Drug Name
          </label>
          <select
            id="drug-select"
            value={selectedDrug}
            onChange={(e) => { setSelectedDrug(e.target.value); setHasSearched(false); }}
            className="w-full px-3 py-2.5 min-h-[44px] rounded-lg border border-border bg-input-background text-sm"
          >
            <option value="">-- Select a Drug --</option>
            {DRUG_OPTIONS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <button
            onClick={handleLookup}
            disabled={!canSearch}
            className={`inline-flex items-center gap-2 px-6 py-2.5 min-h-[44px] rounded-lg text-sm transition-colors ${
              canSearch
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
            aria-label={`Look up prior auth criteria for ${selectedDrug || "drug"} under ${selectedPayer || "plan"}`}
          >
            <Search className="w-4 h-4" aria-hidden="true" />
            Look Up Criteria
          </button>
        </div>
      </div>

      {/* Results section */}
      {hasSearched && lookupResult ? (
        <section
          className="border-2 border-border rounded-xl bg-card p-6"
          aria-label={`Prior authorization criteria for ${lookupResult.drugName} under ${lookupResult.payer}`}
          role="region"
        >
          {/* Context header */}
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h3 className="mt-0 mb-0">{lookupResult.drugName}</h3>
            <span className={`px-2.5 py-0.5 rounded-full text-sm ${PAYER_COLORS[lookupResult.payer].bg} ${PAYER_COLORS[lookupResult.payer].text}`}>
              {lookupResult.payer}
            </span>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm ${STATUS_STYLES[lookupResult.coverageStatus].bg} ${STATUS_STYLES[lookupResult.coverageStatus].text}`}>
              <span aria-hidden="true">{STATUS_STYLES[lookupResult.coverageStatus].icon}</span>
              {lookupResult.coverageStatus}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mb-5">
            {lookupResult.rxNormCode} &middot; Effective {lookupResult.effectiveDate}
          </p>

          {/* Structured criteria display */}
          <h4 className="mb-3">Prior Authorization Criteria</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CriteriaBlock icon={<Clock className="w-4 h-4" />} label="Trial Duration" value={lookupResult.criteria.trialDuration} />
            <CriteriaBlock icon={<FlaskConical className="w-4 h-4" />} label="Lab Requirements">
              <ul className="list-disc list-inside text-sm space-y-1 mt-1">
                {lookupResult.criteria.labRequirements.map((lab, i) => (
                  <li key={i}>{lab}</li>
                ))}
              </ul>
            </CriteriaBlock>
            <CriteriaBlock icon={<Calendar className="w-4 h-4" />} label="Age Limit" value={lookupResult.criteria.ageLimit} />
            <CriteriaBlock icon={<Stethoscope className="w-4 h-4" />} label="Diagnosis Requirement" value={lookupResult.criteria.diagnosisRequirement} />
            <CriteriaBlock icon={<StickyNote className="w-4 h-4" />} label="Additional Notes" value={lookupResult.criteria.additionalNotes} className="md:col-span-2" />
          </div>

          {/* Applicable ICD-10 codes */}
          <div className="mt-4">
            <h4 className="mb-2">Applicable Diagnosis Codes (ICD-10)</h4>
            <div className="flex flex-wrap gap-2">
              {lookupResult.diagnosisCodes.map((code) => (
                <span key={code} className="px-2.5 py-1 bg-muted rounded-md text-sm text-foreground">
                  {code}
                </span>
              ))}
            </div>
          </div>

          {/* Source verification */}
          <div className="mt-5 pt-4 border-t border-border">
            <button
              onClick={() => setShowSource(!showSource)}
              className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-lg bg-muted hover:bg-accent transition-colors text-sm border border-border"
              aria-expanded={showSource}
              aria-controls="criteria-source-panel"
            >
              <FileText className="w-4 h-4" aria-hidden="true" />
              {showSource ? "Hide Source Document" : "View Source Document"}
            </button>
            {showSource && (
              <div id="criteria-source-panel" className="mt-3 p-4 bg-muted/50 rounded-lg border border-border" role="region" aria-label="Source document excerpt">
                <p className="text-sm italic text-foreground leading-relaxed mb-2">"{lookupResult.criteria.sourceSnippet}"</p>
                <a
                  href={lookupResult.criteria.sourceDocLink}
                  className="inline-flex items-center gap-1.5 min-h-[44px] text-sm text-primary underline hover:text-primary/80"
                >
                  <ExternalLink className="w-4 h-4" aria-hidden="true" />
                  Open source document
                  <span className="sr-only">(opens in new window)</span>
                </a>
              </div>
            )}
          </div>
        </section>
      ) : hasSearched && !lookupResult ? (
        <div className="border-2 border-border rounded-xl bg-card p-8 text-center" role="status">
          <Info className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" aria-hidden="true" />
          <p className="text-muted-foreground mb-1">No coverage data found</p>
          <p className="text-sm text-muted-foreground">
            No criteria found for <strong>{selectedDrug}</strong> under <strong>{selectedPayer}</strong>. This plan may not cover this drug.
          </p>
        </div>
      ) : (
        <div className="border-2 border-dashed border-border rounded-xl bg-muted/30 p-8 text-center" role="status">
          <Search className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" aria-hidden="true" />
          <p className="text-muted-foreground mb-1">Select a plan and drug above</p>
          <p className="text-sm text-muted-foreground">
            Choose a payer and drug name, then click "Look Up Criteria" to view detailed prior authorization requirements.
          </p>
        </div>
      )}
    </div>
  );
}

function CriteriaBlock({
  icon, label, value, children, className = ""
}: {
  icon: React.ReactNode; label: string; value?: string; children?: React.ReactNode; className?: string;
}) {
  return (
    <div className={`p-4 rounded-lg bg-muted/40 border border-border ${className}`}>
      <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
        <span aria-hidden="true">{icon}</span>
        <span className="text-sm uppercase tracking-wide">{label}</span>
      </div>
      {value ? <p className="text-sm mb-0">{value}</p> : children}
    </div>
  );
}
