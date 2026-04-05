import type {
  CoverageStatus,
  PlanCard,
  PolicyChange,
} from "@/app/components/types";
import type { Database } from "@/lib/supabase";

export type MedicalDocumentRow = Database["public"]["Tables"]["medical_documents"]["Row"];

export interface UploadedAnalysis {
  patient_name?: unknown;
  medication_name?: unknown;
  generic_name?: unknown;
  diagnosis?: unknown;
  insurance_provider?: unknown;
  prior_auth_required?: unknown;
  summary?: unknown;
  missing_information?: unknown;
  recommended_next_steps?: unknown;
  /** Array of change objects from Gemini (snake_case keys) */
  policy_changes?: unknown;
}

export interface ParsePdfResponse {
  success?: boolean;
  analysis?: UploadedAnalysis;
  extracted_text?: unknown;
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

/** True when trailing "(...)" looks like a model explanation, not a real plan name. */
function isExplanatoryPayerParenthetical(inner: string): boolean {
  const t = inner.trim().toLowerCase();
  if (!t) return false;
  if (/^(unspecified(\s+name)?|unknown|not\s+specified|n\/a)\b/.test(t)) {
    return true;
  }
  if (t.includes("generic name") && t.includes("provider")) return true;
  if (t.includes("no specific provider")) return true;
  if (t.includes("not provided") && t.includes("provider")) return true;
  return false;
}

/** Strip model-invented parentheticals (e.g. "Health Plan (unspecified name)"). */
function sanitizePayerDisplay(raw: string): string {
  let s = raw.trim().replace(/\s+/g, " ");
  if (!s) return "";
  let prev: string;
  do {
    prev = s;
    const m = s.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    if (m && isExplanatoryPayerParenthetical(m[2]!)) {
      s = m[1]!.trim();
      continue;
    }
    const junkSuffix =
      /\s*\((?:unspecified\s+name|unspecified|unknown|not\s+specified|n\/a)\)\s*$/i;
    s = s.replace(junkSuffix, "").trim();
  } while (s !== prev);
  return s;
}

/** Shorten legal-style suffixes on payer names (e.g. "Cigna Companies" -> "Cigna"). */
function normalizePayerBrand(s: string): string {
  let t = s.trim().replace(/\s+/g, " ");
  if (!t) return "";
  t = t.replace(/\s+Companies\s*$/i, "").trim();
  t = t.replace(/\s+Company\s*$/i, "").trim();
  return t;
}

const DEFAULT_PAYER_LABEL = "Health Plan";

function formatPayerForDisplay(raw: string): string {
  const cleaned = normalizePayerBrand(sanitizePayerDisplay(raw));
  return cleaned || DEFAULT_PAYER_LABEL;
}

/**
 * Reduce verbose parser/PDF medication strings to a recognizable brand/common name.
 */
export function shortenMedicationName(raw: string): string {
  let s = raw.trim();
  if (!s) return s;

  const firstClause = s.split(/[;]/)[0]?.trim() ?? s;
  s = firstClause;

  if (s.includes("—")) {
    s = s.split("—")[0]!.trim();
  } else if (s.length > 72 && s.includes(" - ")) {
    s = s.split(" - ")[0]!.trim();
  }

  if (s.length > 56) {
    s = s
      .replace(
        /\s*\([^)]*(?:tablet|capsule|caplet|injection|injectable|prefilled|syringe|vial|pen|mg\/|mcg\/|\d+\s*mg)[^)]*\)\s*$/i,
        "",
      )
      .trim();
  }

  s = s.replace(/\s+/g, " ").trim();
  if (s.length > 72) {
    s = `${s.slice(0, 69).trimEnd()}…`;
  }
  return s;
}

function extractIcdCodes(text: string): string[] {
  const re = /\b([A-TV-Z][0-9]{2}(?:\.[0-9A-Za-z]{1,4})?)\b/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push(m[1]!);
  }
  return [...new Set(out)];
}

function inferCoverageStatus(priorAuth: unknown): CoverageStatus {
  if (
    priorAuth === false ||
    priorAuth === "false" ||
    priorAuth === "False" ||
    priorAuth === "no" ||
    priorAuth === "No"
  ) {
    return "Preferred";
  }
  return "Prior Auth Required";
}

function quarterFromIsoDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${y}-Q${q}`;
}

/**
 * Normalizes raw `policy_changes` JSON (DB or parse-pdf) into `PolicyChange` rows.
 */
export function normalizePolicyChangesRaw(
  raw: unknown,
  opts: {
    documentId: string;
    defaultPayer: string;
    defaultDrug: string;
  },
): PolicyChange[] {
  if (!Array.isArray(raw)) return [];

  const out: PolicyChange[] = [];

  raw.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const o = item as Record<string, unknown>;
    const field = normalizeText(o.field, "").trim();
    if (!field) return;

    let changeType = String(
      o.change_type ?? o.changeType ?? "modification",
    ).toLowerCase();
    if (
      changeType !== "addition" &&
      changeType !== "removal" &&
      changeType !== "modification"
    ) {
      changeType = "modification";
    }

    const effectiveDate =
      normalizeText(o.effective_date ?? o.effectiveDate, "").trim() || "";
    let quarter = normalizeText(o.quarter, "").trim();
    if (!quarter && effectiveDate) {
      quarter = quarterFromIsoDate(effectiveDate);
    }
    if (!quarter) quarter = "Unknown";

    const rowPayer = normalizeText(o.payer, "").trim();
    const payer = rowPayer
      ? normalizePayerBrand(sanitizePayerDisplay(rowPayer)) || opts.defaultPayer
      : opts.defaultPayer;
    const drugNameRaw =
      normalizeText(o.drug_name ?? o.drugName, "").trim() ||
      opts.defaultDrug;
    const drugName = shortenMedicationName(drugNameRaw);

    const oldValue =
      normalizeText(o.old_value ?? o.oldValue, "").trim() ||
      "Not specified";
    const newValue =
      normalizeText(o.new_value ?? o.newValue, "").trim() ||
      "Not specified";

    out.push({
      id: `${opts.documentId}-pc-${index}`,
      payer,
      drugName,
      field,
      oldValue,
      newValue,
      changeType: changeType as PolicyChange["changeType"],
      effectiveDate: effectiveDate || "Not specified",
      quarter,
    });
  });

  return out;
}

function emptyCriteriaBlock(notes: string): PlanCard["criteria"] {
  return {
    trialDuration: "Not specified in extracted data",
    labRequirements: [],
    ageLimit: "Not specified in extracted data",
    diagnosisRequirement: "See diagnosis / summary fields",
    additionalNotes: notes || "—",
    sourceSnippet:
      notes.slice(0, 400) ||
      "Excerpt not available — open the original PDF from your upload history.",
    sourceDocLink: "#uploaded-policy",
  };
}

export interface TransformOptions {
  planId?: string;
  sourceFilename?: string;
  documentId?: string;
}

/**
 * Maps `/api/parse-pdf` JSON (and equivalent Supabase `raw_extracted_data`) to a PlanCard.
 */
export function transformBackendResponse(
  data: unknown,
  options?: TransformOptions,
): PlanCard | null {
  const payload = data as ParsePdfResponse;
  const a = payload?.analysis;
  if (!a || typeof a !== "object") {
    return null;
  }

  const drugNameRaw = normalizeText(a.medication_name);
  if (!drugNameRaw) {
    return null;
  }
  const drugName = shortenMedicationName(drugNameRaw);

  const payer = formatPayerForDisplay(
    normalizeText(a.insurance_provider).trim(),
  );
  const conditions = normalizeText(a.diagnosis);
  const summary = normalizeText(a.summary);
  const genericNameRaw = normalizeText(a.generic_name);
  const genericName = genericNameRaw
    ? shortenMedicationName(genericNameRaw)
    : "";
  const id = options?.planId ?? crypto.randomUUID();
  /** Always set so session uploads (no Supabase row) still show delete; matches DB id when persisted. */
  const documentId = options?.documentId ?? options?.planId ?? id;
  const diagnosisText = [conditions, summary].filter(Boolean).join(" ");
  const codesFromText = extractIcdCodes(diagnosisText);

  const coverageStatus = inferCoverageStatus(a.prior_auth_required);

  const policyChanges = normalizePolicyChangesRaw(a.policy_changes, {
    documentId: id,
    defaultPayer: payer,
    defaultDrug: drugName,
  });

  return {
    id,
    documentId,
    payer,
    drugName,
    genericName: genericName || undefined,
    conditions: conditions || undefined,
    clinicalCriteria: summary || undefined,
    priorAuthRequirement: coverageStatus === "Prior Auth Required" ? "Required" : "Not required",
    rxNormCode: "Not extracted",
    coverageStatus,
    effectiveDate: "",
    sourceLinkLabel: "Source from uploaded policy",
    hasSourceDocumentLink: false,
    sourceFilename: options?.sourceFilename,
    diagnosisCodes: codesFromText,
    criteria: emptyCriteriaBlock(summary),
    policyChanges: policyChanges.length > 0 ? policyChanges : undefined,
  };
}

/**
 * Hydrate a PlanCard from a persisted `medical_documents` row.
 */
export function planFromMedicalDocumentRow(
  row: MedicalDocumentRow,
): PlanCard | null {
  const raw = row.raw_extracted_data as ParsePdfResponse | null;
  const base = transformBackendResponse(raw ?? { analysis: {} }, {
    planId: row.id,
    documentId: row.id,
    sourceFilename: row.filename,
  });

  if (!base) {
    const drugName = shortenMedicationName(
      row.drug_name?.trim() || "Unknown medication",
    );
    const payer = "Uploaded policy";
    const policyChanges = normalizePolicyChangesRaw(
      row.policy_changes ??
        (raw?.analysis as UploadedAnalysis | undefined)?.policy_changes,
      {
        documentId: row.id,
        defaultPayer: payer,
        defaultDrug: drugName,
      },
    );
    return {
      id: row.id,
      documentId: row.id,
      payer,
      drugName,
      conditions: row.conditions ?? undefined,
      clinicalCriteria: row.clinical_criteria ?? undefined,
      priorAuthRequirement: row.prior_auth_required ?? undefined,
      rxNormCode: "Not extracted",
      coverageStatus: inferCoverageStatus(row.prior_auth_required),
      effectiveDate: row.effective_date ?? "",
      sourceFilename: row.filename,
      sourceLinkLabel: "Source from uploaded policy",
      hasSourceDocumentLink: false,
      diagnosisCodes: extractIcdCodes(
        [row.conditions, row.diagnosis_codes, row.clinical_criteria]
          .filter(Boolean)
          .join(" "),
      ),
      criteria: emptyCriteriaBlock(row.clinical_criteria ?? row.conditions ?? ""),
      policyChanges: policyChanges.length > 0 ? policyChanges : undefined,
    };
  }

  const policyChanges = normalizePolicyChangesRaw(
    row.policy_changes ??
      (raw?.analysis as UploadedAnalysis | undefined)?.policy_changes,
    {
      documentId: row.id,
      defaultPayer: base.payer,
      defaultDrug: base.drugName,
    },
  );

  return {
    ...base,
    id: row.id,
    documentId: row.id,
    sourceFilename: row.filename,
    conditions: row.conditions ?? base.conditions,
    clinicalCriteria: row.clinical_criteria ?? base.clinicalCriteria,
    priorAuthRequirement: row.prior_auth_required ?? base.priorAuthRequirement,
    effectiveDate: row.effective_date ?? base.effectiveDate,
    diagnosisCodes:
      base.diagnosisCodes.length > 0
        ? base.diagnosisCodes
        : extractIcdCodes(
            [row.diagnosis_codes, row.conditions].filter(Boolean).join(" "),
          ),
    policyChanges:
      policyChanges.length > 0
        ? policyChanges
        : base.policyChanges,
  };
}
