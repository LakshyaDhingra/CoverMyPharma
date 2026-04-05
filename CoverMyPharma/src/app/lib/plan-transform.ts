import type { CoverageStatus, PlanCard } from "@/app/components/types";
import type { Database } from "@/lib/supabase";

export interface UploadedAnalysis {
  patient_name?: unknown;
  medication_name?: unknown;
  diagnosis?: unknown;
  insurance_provider?: unknown;
  prior_auth_required?: boolean;
  summary?: unknown;
  missing_information?: unknown;
  recommended_next_steps?: unknown;
}

export interface ParsePdfResponse {
  success?: boolean;
  extracted_text?: unknown;
  analysis?: UploadedAnalysis;
}

type MedicalDocumentRow = Database["public"]["Tables"]["medical_documents"]["Row"];

function truncateText(text: string, maxLength = 240) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}...`;
}

export function flattenToStrings(value: unknown): string[] {
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

export function normalizeText(value: unknown, fallback = "") {
  const parts = flattenToStrings(value);
  return parts.length > 0 ? parts.join("; ") : fallback;
}

export function normalizeStringArray(value: unknown, fallback: string[] = []) {
  const parts = flattenToStrings(value);
  return parts.length > 0 ? parts : fallback;
}

function splitDiagnosisValues(diagnosis: unknown) {
  const values = flattenToStrings(diagnosis);

  return values
    .flatMap((value) => value.split(/[,;/]/))
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizePlanDate(value?: string | null) {
  const parsed = value ? new Date(value) : new Date();
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  return parsed.toISOString().slice(0, 10);
}

function deriveCoverageStatus(
  analysis: UploadedAnalysis,
  storedPriorAuthRequired?: string | null,
): CoverageStatus {
  if (analysis.prior_auth_required) {
    return "Prior Auth Required";
  }

  if (storedPriorAuthRequired?.toLowerCase() === "true") {
    return "Prior Auth Required";
  }

  if (normalizeStringArray(analysis.missing_information).length > 0) {
    return "Covered with Limits";
  }

  return "Preferred";
}

export function transformBackendResponse(response: unknown): PlanCard | null {
  if (!response || typeof response !== "object") {
    return null;
  }

  const payload = response as ParsePdfResponse;
  const analysis = payload.analysis;

  if (!analysis) {
    return null;
  }

  const diagnosisCodes = splitDiagnosisValues(analysis.diagnosis);
  const missingInformation = normalizeStringArray(
    analysis.missing_information,
  );
  const nextSteps = normalizeStringArray(analysis.recommended_next_steps);
  const summary = normalizeText(analysis.summary);
  const extractedText = normalizeText(payload.extracted_text);
  const patientName = normalizeText(analysis.patient_name);
  const medicationName = normalizeText(analysis.medication_name);
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

  return {
    id: crypto.randomUUID(),
    payer: insuranceProvider,
    drugName: medicationName || "Uploaded medication",
    rxNormCode: patientName
      ? `Policy analysis for ${patientName}`
      : "Medical policy PDF analysis",
    coverageStatus: deriveCoverageStatus(analysis),
    effectiveDate: new Date().toISOString().slice(0, 10),
    effectiveDateLabel: "Analyzed",
    sourceLinkLabel: "Source file available in uploaded records",
    hasSourceDocumentLink: false,
    diagnosisCodes: diagnosisCodes.length
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

export function transformStoredDocumentToPlan(
  document: MedicalDocumentRow,
): PlanCard {
  const rawPayload =
    document.raw_extracted_data &&
    typeof document.raw_extracted_data === "object"
      ? (document.raw_extracted_data as ParsePdfResponse)
      : null;
  const transformed = rawPayload
    ? transformBackendResponse(rawPayload)
    : null;
  const uploadedDate = normalizePlanDate(
    document.effective_date || document.uploaded_at,
  );

  if (transformed) {
    return {
      ...transformed,
      id: document.id,
      effectiveDate: uploadedDate,
      effectiveDateLabel: document.effective_date ? "Effective" : "Uploaded",
      sourceLinkLabel: `Source file: ${document.filename}`,
      hasSourceDocumentLink: false,
      criteria: {
        ...transformed.criteria,
        sourceSnippet:
          transformed.criteria.sourceSnippet ||
          document.clinical_criteria ||
          `Saved from ${document.filename}`,
        sourceDocLink: `#${document.filename}`,
      },
    };
  }

  const diagnosisCodes = splitDiagnosisValues(
    document.diagnosis_codes || document.conditions,
  );
  const payer = normalizeText(
    rawPayload?.analysis?.insurance_provider,
    "Uploaded payer",
  );
  const drugName = document.drug_name || "Uploaded medication";
  const diagnosisRequirement = document.conditions || "Not specified";
  const summary = document.clinical_criteria || "No additional notes available.";

  return {
    id: document.id,
    payer,
    drugName,
    rxNormCode: `Saved upload: ${document.filename}`,
    coverageStatus: deriveCoverageStatus(
      rawPayload?.analysis ?? {},
      document.prior_auth_required,
    ),
    effectiveDate: uploadedDate,
    effectiveDateLabel: document.effective_date ? "Effective" : "Uploaded",
    sourceLinkLabel: `Source file: ${document.filename}`,
    hasSourceDocumentLink: false,
    diagnosisCodes: diagnosisCodes.length
      ? diagnosisCodes
      : ["Diagnosis not specified"],
    criteria: {
      trialDuration:
        document.prior_auth_required?.toLowerCase() === "true"
          ? "Prior authorization required based on uploaded document."
          : "No explicit prior authorization requirement was stored.",
      labRequirements: ["Review uploaded summary for full eligibility details."],
      ageLimit: "Not specified in uploaded PDF",
      diagnosisRequirement,
      additionalNotes: summary,
      sourceSnippet: truncateText(summary),
      sourceDocLink: `#${document.filename}`,
    },
  };
}
