import { GoogleGenerativeAI } from "@google/generative-ai";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const client = jwksClient({
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
});

// ── Auth helpers ──────────────────────────────────────────────────────────────

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

function verifyToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        audience: process.env.AUTH0_AUDIENCE,
        issuer: `https://${process.env.AUTH0_DOMAIN}/`,
        algorithms: ["RS256"],
      },
      (err, decoded) => {
        if (err) reject(err);
        else resolve(decoded);
      },
    );
  });
}

// ── Gemini helpers ────────────────────────────────────────────────────────────

function buildFilePart(fileData) {
  return {
    inlineData: {
      data: fileData,
      mimeType: "application/pdf",
    },
  };
}

function stripJsonFences(text) {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

async function validateDocument(model, filePart) {
  const prompt = `You are a medical policy document classifier.

Respond with JSON only. No markdown. No backticks. No explanation outside the JSON.

Analyze this document and determine if it is a legitimate medical benefit drug policy document.

A valid medical policy document MUST contain ALL of the following:
1. A specific drug, biologic, or drug class being covered or reviewed
2. Clinical criteria, coverage indications, or medical necessity requirements
3. An issuing organization (health plan, insurer, government contractor, MAC, PBM, etc.)
4. An effective date or review date

Reject the document if it is any of the following:
- Academic research paper or clinical trial report
- Invoice, receipt, or billing statement
- Assignment, essay, or student homework
- News article, blog post, or general health information
- Marketing or promotional material
- Meeting minutes without coverage criteria
- Any document with no drug or treatment explicitly mentioned

Return exactly this JSON shape and nothing else:
{
  "isValid": true or false,
  "confidence": integer between 0 and 100,
  "rejectionReason": "specific reason if invalid, or null if valid",
  "documentType": "one of: LCD / Commercial Drug Policy / PBM Policy / Medicare Policy / Medicaid Policy / Other",
  "detectedDrug": "primary drug name or null",
  "detectedPayer": "payer or organization name or null",
  "detectedEffectiveDate": "effective or review date or null"
}`;

  const result = await model.generateContent([prompt, filePart]);
  const raw = stripJsonFences(result.response.text());

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Gemini returned unparseable validation response.");
  }
}

async function extractDocument(model, filePart) {
  const prompt = `You are a medical policy data extractor.

This document has already been confirmed as a valid medical policy document.
Extract ALL relevant coverage information from it.

Rules:
- Respond with JSON only. No markdown. No backticks. No explanation.
- Do NOT use a fixed schema — extract whatever structure fits this specific document.
- Use clear descriptive camelCase key names.
- If something has multiple items, use an array.
- If something has sub-conditions (e.g. criteria per indication), nest them as objects.
- Extract every piece of information useful to someone trying to get a drug approved
  or understand coverage rules — criteria, exceptions, limitations, codes, dosing, etc.
- Do NOT hallucinate or infer. Only extract what is explicitly stated in the document.
- If a field is not present in the document, omit that key entirely. Do not use null placeholders.

Always include these top-level keys when present in the document:
- drug
- brandNames
- payer
- policyNumber
- effectiveDate
- lastReviewDate
- documentType
- coverageStatus
- linesOfBusiness
- coveredIndications
- priorAuthRequired
- priorAuthCriteria
- stepTherapyRequired
- stepTherapyCriteria
- preferredProducts
- nonPreferredProducts
- contraindications
- limitations
- diagnosisCodes
- billingCodes
- dosingSchedule
- specialistRequirements
- approvalDuration
- documentationRequired
- revisionHistory
- additionalNotes

Beyond those, extract any other fields that appear in this specific document and
are clinically or operationally relevant. The output shape should reflect the
actual content of the document, not a predetermined template.`;

  const result = await model.generateContent([prompt, filePart]);
  const raw = stripJsonFences(result.response.text());

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Gemini returned unparseable extraction response.");
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { fileData, accessToken } = req.body;

  if (!fileData) {
    return res.status(400).json({ error: "Missing fileData" });
  }

  if (!accessToken) {
    return res.status(400).json({ error: "Missing accessToken" });
  }

  // ── 1. Verify Auth0 token ──
  let decoded;
  try {
    decoded = await verifyToken(accessToken);
  } catch (err) {
    console.error("Token verification failed:", err.message);
    return res
      .status(401)
      .json({ error: "Unauthorized: invalid or expired token" });
  }

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const filePart = buildFilePart(fileData);

  // ── 2. Validate document ──
  let validation;
  try {
    validation = await validateDocument(model, filePart);
  } catch (err) {
    console.error("Validation step failed:", err.message);
    return res
      .status(500)
      .json({ error: "Failed to validate document. Please try again." });
  }

  if (!validation.isValid || validation.confidence < 70) {
    return res.status(400).json({
      error: validation.rejectionReason
        ? `Not a valid medical policy document: ${validation.rejectionReason}`
        : "This does not appear to be a medical policy document. Please upload a valid payer policy PDF.",
      validation,
    });
  }

  // ── 3. Extract structured data ──
  let extraction;
  try {
    extraction = await extractDocument(model, filePart);
  } catch (err) {
    console.error("Extraction step failed:", err.message);
    return res
      .status(500)
      .json({
        error: "Failed to extract data from document. Please try again.",
      });
  }

  // ── 4. Return result ──
  return res.status(200).json({
    validation,
    extraction,
    userId: decoded.sub,
    processedAt: new Date().toISOString(),
  });
}
