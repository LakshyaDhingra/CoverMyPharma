import os
import json
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

def analyze_document(text: str):
    gemini_api_key = os.getenv("GEMINI_API_KEY") or os.getenv("VITE_GEMINI_API_KEY")

    if not gemini_api_key:
        raise ValueError("Missing GEMINI_API_KEY")

    genai.configure(api_key=gemini_api_key)
    model = genai.GenerativeModel("gemini-2.5-flash")

    prompt = f"""
You are helping with a healthcare hackathon project called CoverMyPharma.

Analyze the following insurance or pharmacy-related document text and extract:
1. patient_name
2. medication_name
3. diagnosis
4. insurance_provider
5. prior_auth_required (boolean true/false)
6. summary
7. missing_information
8. recommended_next_steps
9. policy_changes — a JSON array of objects describing explicit policy updates, coverage edits, or version deltas mentioned in the document. Each object must use these keys:
   - field (string): what aspect changed (e.g. "Prior authorization", "Step therapy", "Quantity limits")
   - old_value (string): previous rule or "Not specified" if only a new rule is stated
   - new_value (string): new or current rule
   - change_type (string): one of "addition", "removal", "modification"
   - effective_date (string): ISO date like 2026-01-01 if stated, else empty string
   - quarter (string): calendar quarter like "2026-Q1" if inferable from dates, else empty string
   - payer (string, optional): override only if this row applies to a different payer than insurance_provider
   - drug_name (string, optional): override only if this row applies to a different drug than medication_name
   Use medication_name and insurance_provider as defaults when payer/drug_name are omitted.
   If the document does not describe any discrete policy changes, use an empty array [].

Return only valid JSON. Do not wrap it in markdown. Do not use triple backticks.

Document text:
{text}
"""

    response = model.generate_content(prompt)
    raw_text = response.text.strip()

    cleaned = raw_text
    if cleaned.startswith("```json"):
        cleaned = cleaned[len("```json"):].strip()
    elif cleaned.startswith("```"):
        cleaned = cleaned[len("```"):].strip()

    if cleaned.endswith("```"):
        cleaned = cleaned[:-3].strip()

    try:
        return json.loads(cleaned)
    except Exception:
        return {"raw": raw_text}
