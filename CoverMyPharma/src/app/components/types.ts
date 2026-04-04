// ── Centralized type definitions ──
// Reshape these interfaces as real data models emerge from PDF parsing.

export type CoverageStatus =
  | "Preferred"
  | "Prior Auth Required"
  | "Step Therapy"
  | "Not Covered"
  | "Covered with Limits";

export type Payer = "Aetna" | "UHC" | "Cigna";

export interface ClinicalCriteria {
  trialDuration: string;
  labRequirements: string[];
  ageLimit: string;
  diagnosisRequirement: string;
  additionalNotes: string;
  sourceSnippet: string;
  sourceDocLink: string;
}

export interface PlanCard {
  id: string;
  payer: Payer;
  drugName: string;
  rxNormCode: string;
  coverageStatus: CoverageStatus;
  effectiveDate: string;
  diagnosisCodes: string[];
  criteria: ClinicalCriteria;
}

export interface DiagnosisOption {
  value: string;
  label: string;
}

export interface PolicyChange {
  id: string;
  payer: Payer;
  drugName: string;
  field: string;
  oldValue: string;
  newValue: string;
  changeType: "addition" | "removal" | "modification";
  effectiveDate: string;
  quarter: string;
}

export interface QuarterOption {
  value: string;
  label: string;
}
