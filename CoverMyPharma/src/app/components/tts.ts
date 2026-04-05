import type { PlanCard } from "./types";

export interface VoiceOption {
  id: string;
  label: string;
}

export const VOICE_OPTIONS: VoiceOption[] = [
  { id: "JBFqnCBsd6RMkjVDRZzb", label: "George" },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Bella" },
  { id: "pNInz6obpgDQGcFmaJgB", label: "Adam" },
];

export function formatEffectiveDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDiagnosisCodesForSpeech(codes: string[]) {
  return codes
    .map((code) => code.replace(".", " point "))
    .join(", ");
}

export function getApiBaseUrl() {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, "");
  }

  return import.meta.env.DEV ? "http://localhost:3001" : "";
}

export async function generateSpeechAudio(text: string, voiceId?: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/tts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, voiceId }),
  });

  if (!response.ok) {
    const errorPayload = await response
      .json()
      .catch(() => ({ error: "Unable to generate speech." }));

    throw new Error(errorPayload.error ?? "Unable to generate speech.");
  }

  return URL.createObjectURL(await response.blob());
}

export function buildPlanSpeechSummary(plan: PlanCard) {
  return [
    `${plan.drugName} for ${plan.payer}.`,
    `Coverage status is ${plan.coverageStatus}.`,
    `Effective ${formatEffectiveDate(plan.effectiveDate)}.`,
    `Diagnosis codes include ${formatDiagnosisCodesForSpeech(plan.diagnosisCodes)}.`,
    `Trial duration: ${plan.criteria.trialDuration}.`,
    `Lab requirements: ${plan.criteria.labRequirements.join("; ")}.`,
    `Age limit: ${plan.criteria.ageLimit}.`,
    `Diagnosis requirement: ${plan.criteria.diagnosisRequirement}.`,
    `Additional notes: ${plan.criteria.additionalNotes}.`,
  ].join(" ");
}

export function buildComparisonSpeechSummary(plans: PlanCard[]) {
  return plans
    .map((plan) => {
      return [
        `${plan.payer} lists ${plan.drugName} as ${plan.coverageStatus}.`,
        `${plan.rxNormCode}.`,
        `Effective ${formatEffectiveDate(plan.effectiveDate)}.`,
        `Diagnosis codes include ${formatDiagnosisCodesForSpeech(plan.diagnosisCodes)}.`,
        `Trial duration: ${plan.criteria.trialDuration}.`,
        `Lab requirements: ${plan.criteria.labRequirements.join("; ")}.`,
        `Age limit: ${plan.criteria.ageLimit}.`,
        `Diagnosis requirement: ${plan.criteria.diagnosisRequirement}.`,
        `Additional notes: ${plan.criteria.additionalNotes}.`,
      ].join(" ");
    })
    .join(" ");
}
