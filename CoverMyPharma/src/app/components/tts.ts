import type { PlanCard } from "./types";
import { getPlanConditions, getPlanPriorAuthRequirement } from "./mock-data";

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
  if (!date) {
    return "Not available";
  }

  const normalizedDate = new Date(date);
  if (Number.isNaN(normalizedDate.getTime())) {
    return "Not available";
  }

  return normalizedDate.toLocaleDateString("en-US", {
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

export function getTtsApiBaseUrl() {
  const configuredTtsBaseUrl = import.meta.env.VITE_TTS_API_BASE_URL?.trim();
  if (configuredTtsBaseUrl) {
    return configuredTtsBaseUrl.replace(/\/$/, "");
  }

  return import.meta.env.DEV ? "http://localhost:3001" : getApiBaseUrl();
}

export async function generateSpeechAudio(text: string, voiceId?: string) {
  const response = await fetch(`${getTtsApiBaseUrl()}/api/tts`, {
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
  const conditions = getPlanConditions(plan);
  const priorAuthRequirement = getPlanPriorAuthRequirement(plan);

  return [
    `${plan.drugName} for ${plan.payer}.`,
    plan.genericName ? `Generic name: ${plan.genericName}.` : "",
    `Conditions or diagnosis: ${conditions}.`,
    `Prior authorization requirement: ${priorAuthRequirement}.`,
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
      const conditions = getPlanConditions(plan);
      const priorAuthRequirement = getPlanPriorAuthRequirement(plan);

      return [
        `${plan.payer} lists ${plan.drugName} as ${plan.coverageStatus}.`,
        plan.genericName ? `Generic name: ${plan.genericName}.` : "",
        `Conditions or diagnosis: ${conditions}.`,
        `Prior authorization requirement: ${priorAuthRequirement}.`,
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
