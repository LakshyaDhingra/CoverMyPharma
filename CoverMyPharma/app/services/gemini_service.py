import os
import json
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

def analyze_document(text: str):
    gemini_api_key = os.getenv("GEMINI_API_KEY")

    if not gemini_api_key:
        raise ValueError("Missing GEMINI_API_KEY")

    genai.configure(api_key=gemini_api_key)
    model = genai.GenerativeModel("gemini-2.5-flash")

    prompt = f"""
You are helping with a healthcare hackathon project called CoverMyPharma.

The app's goal is to analyze pharmacy, insurance, prior-authorization, and medical policy PDFs and return structured information that helps a user understand coverage requirements faster.

Analyze the following document text and extract:
1. patient_name
2. medication_name
3. diagnosis
4. insurance_provider
5. prior_auth_required (boolean true/false)
6. summary
7. missing_information
8. recommended_next_steps

Important rules:
- The document may be a medical policy PDF, not a patient-specific prior-authorization packet.
- Only extract what is actually supported by the document text.
- If patient_name is not present, return null.
- If medication_name or insurance_provider are not explicit, return null instead of guessing.
- diagnosis may be a string or array if multiple diagnoses/indications are clearly listed.
- missing_information and recommended_next_steps must always be arrays.
- prior_auth_required should be true only if the document indicates prior authorization is required; false only if the document clearly indicates it is not required; otherwise use false and explain uncertainty in summary.
- summary should describe the document's coverage or policy meaning in plain language.
- recommended_next_steps should be action-oriented for a user reviewing the policy.

Return only valid JSON matching this shape:
{{
  "patient_name": null,
  "medication_name": null,
  "diagnosis": null,
  "insurance_provider": null,
  "prior_auth_required": false,
  "summary": "",
  "missing_information": [],
  "recommended_next_steps": []
}}

Do not wrap the JSON in markdown. Do not use triple backticks.

Document text:
{text}
"""

    try:
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

    except Exception as e:
        message = str(e)
        if (
            "ResourceExhausted" in message
            or "429" in message
            or "quota" in message.lower()
        ):
            raise ValueError(
                "Gemini quota exceeded. Please wait a minute and try again."
            )
        raise ValueError(f"Gemini processing failed: {message}")
