import { GoogleGenerativeAI } from "@google/generative-ai";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const client = jwksClient({
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, function (err, key) {
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { fileData, accessToken } = req.body;

  if (!fileData || !accessToken) {
    return res.status(400).json({ error: "Missing fileData or accessToken" });
  }

  try {
    // Verify the access token
    const decoded = await new Promise((resolve, reject) => {
      jwt.verify(
        accessToken,
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

    // Optional: Add risk assessment here
    // const riskScore = await checkUserRisk(decoded.sub);

    // Process the PDF with Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const filePart = {
      inlineData: {
        data: fileData,
        mimeType: "application/pdf",
      },
    };

    const result = await model.generateContent([
      "Extract the coverage rules, PA criteria, and diagnosis codes from this PDF. Provide structured output.",
      filePart,
    ]);

    const parsedText = result.response.text();

    res.status(200).json({
      parsedText,
      userId: decoded.sub,
      processedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error processing PDF:", error);
    res.status(500).json({ error: "Failed to process PDF" });
  }
}
