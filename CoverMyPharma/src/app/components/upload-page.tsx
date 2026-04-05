import {
  useState,
  useRef,
  useCallback,
  type DragEvent,
  type ChangeEvent,
} from "react";
import {
  Upload,
  FileText,
  X,
  CheckCircle,
  Loader2,
  Shield,
  Zap,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { useAuth0 } from "@auth0/auth0-react";

import logo from "@/assets/CoverMyPharma.svg";
import symbol from "@/assets/CoverMyPharmaSymbol.svg";
// Logo colors from the caduceus:
// Charcoal #3d3d3d — main text, icon, buttons
// Steel blue #5b8db8 — the "Rx" accent, highlights
// Light gray #f5f6f8 — page background

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  status: "uploading" | "processing" | "done" | "error";
  errorMessage?: string;
}

interface UploadPageProps {
  onContinue: () => void;
}

const FEATURES = [
  {
    icon: <Zap className="w-4 h-4" />,
    title: "AI-powered extraction",
    desc: "Gemini reads your PDFs and pulls out coverage rules, PA criteria, and diagnosis codes automatically.",
  },
  {
    icon: <TrendingUp className="w-4 h-4" />,
    title: "Cross-payer comparison",
    desc: "See company coverage information side by side in one matrix — no more hunting through separate documents.",
  },
  {
    icon: <Shield className="w-4 h-4" />,
    title: "Immutable change log",
    desc: "Every policy update is timestamped and recorded on-chain so you always know what changed and when.",
  },
];

const FIELD_LABELS: Record<string, string> = {
  drugName: "Drug Name / Generic Name",
  conditions: "Conditions / Diagnoses",
  priorAuthRequired: "Prior Auth Requirement",
  clinicalCriteria: "Clinical Criteria",
  diagnosisCodes: "Diagnosis Codes",
  effectiveDate: "Effective Date",
};

function normalizeMissingField(field: string) {
  return (
    FIELD_LABELS[field] ??
    field.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadPage({ onContinue }: UploadPageProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef<Set<string>>(new Set());
  const {
    loginWithRedirect,
    logout,
    user,
    isAuthenticated,
    getAccessTokenSilently,
  } = useAuth0();

  const handlePdfProcessing = useCallback(
    async (file: File, fileId: string) => {
      // Prevent duplicate processing
      if (processingRef.current.has(fileId)) return;
      processingRef.current.add(fileId);

      try {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId ? { ...f, status: "processing" } : f,
          ),
        );

        const fileData = await file.arrayBuffer();
        const uint8Array = new Uint8Array(fileData);
        let binary = "";
        for (let i = 0; i < uint8Array.length; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }
        const base64Data = btoa(binary);

        // Always use frontend Gemini call (hackathon mode)
        const genAI = new GoogleGenerativeAI(
          import.meta.env.VITE_GEMINI_API_KEY,
        );
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent([
          `Analyze this PDF document and extract the following required fields for pharmaceutical coverage/policy information. Return a JSON object with this exact structure:

{
  "validation": {
    "isValid": boolean,
    "missingFields": string[] (list of missing required fields)
  },
  "data": {
    "drugName": "string or null",
    "conditions": "string or null", 
    "priorAuthRequired": "string or null",
    "clinicalCriteria": "string or null",
    "diagnosisCodes": "string or null",
    "effectiveDate": "string or null"
  }
}

Required fields to check for:
- Drug Name/generic Name
- Conditions/Diagnoses
- Prior Auth Req for Drug  
- Clinical Criteria
- Diagnosis Codes
- Effective date

Set isValid to true only if ALL required fields are present and contain meaningful content. If any field is missing or empty, set isValid to false and list the missing fields in missingFields array.`,
          {
            inlineData: { data: base64Data, mimeType: "application/pdf" },
          },
        ]);

        const response = await result.response;
        const text = await response.text();
        console.log("Gemini response:", text);

        try {
          // Extract JSON from markdown code blocks if present
          let jsonText = text.trim();

          // Check if response is wrapped in ```json ... ```
          const jsonMatch = jsonText.match(/```json\s*(\{[\s\S]*?\})\s*```/);
          if (jsonMatch) {
            jsonText = jsonMatch[1];
          } else {
            // Try to find JSON object directly
            const jsonStart = jsonText.indexOf("{");
            const jsonEnd = jsonText.lastIndexOf("}");
            if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
              jsonText = jsonText.substring(jsonStart, jsonEnd + 1);
            }
          }

          // Parse the JSON response
          const parsed = JSON.parse(jsonText);

          if (!parsed.validation?.isValid) {
            const missing = parsed.validation?.missingFields || [
              "unknown fields",
            ];
            const friendlyFields = missing.map(normalizeMissingField);
            throw new Error(
              `PDF validation failed. Missing required fields: ${friendlyFields.join(", ")}. Please upload a complete pharmaceutical coverage/policy document.`,
            );
          }

          console.log("✓ PDF validated and parsed successfully");
          setFiles((prev) =>
            prev.map((f) => (f.id === fileId ? { ...f, status: "done" } : f)),
          );
        } catch (parseErr) {
          console.error("✗ PDF validation failed:", parseErr);
          const errorMessage =
            parseErr instanceof Error ? parseErr.message : String(parseErr);

          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileId ? { ...f, status: "error", errorMessage } : f,
            ),
          );
        }
      } catch (err) {
        console.error("✗ PDF processing failed:", err);
        setFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, status: "error" } : f)),
        );
      } finally {
        processingRef.current.delete(fileId);
      }
    },
    [],
  );

  const addFiles = useCallback(
    (incoming: FileList | null) => {
      if (!incoming) return;
      if (!isAuthenticated) {
        loginWithRedirect();
        return;
      }

      Array.from(incoming).forEach((file) => {
        if (file.type !== "application/pdf") return;
        const fileId = crypto.randomUUID();
        setFiles((prev) => [
          ...prev,
          { id: fileId, name: file.name, size: file.size, status: "uploading" },
        ]);
        handlePdfProcessing(file, fileId);
      });
    },
    [isAuthenticated, loginWithRedirect, handlePdfProcessing],
  );

  const removeFile = (id: string) =>
    setFiles((prev) => prev.filter((f) => f.id !== id));

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const doneCount = files.filter((f) => f.status === "done").length;
  const canContinue = doneCount > 0;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: "#5b8db8",
      }}
    >
      {/* ── Top nav ── */}
      <header className="flex items-center justify-between px-8 py-4 bg-transparent border-b border-white/20 shadow-lg transition-all duration-300">
        <div className="flex items-center gap-3">
          <img
            src={symbol}
            alt="CoverMyPharma"
            className="h-20 w-auto cursor-pointer hover:scale-105 transition-transform duration-200"
            style={{ filter: "brightness(0) invert(1)" }}
            onClick={() => (window.location.href = "/")}
          />
        </div>

        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <span className="text-sm text-white">Hello, {user?.name}</span>
              <button
                onClick={() =>
                  logout({ logoutParams: { returnTo: window.location.origin } })
                }
                className="text-sm px-4 py-2 rounded-lg hover:bg-white/20 transition-all duration-200 hover:shadow-md text-white"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => loginWithRedirect()}
                className="text-sm px-4 py-2 rounded-lg hover:bg-white/20 transition-all duration-200 hover:shadow-md text-white"
              >
                Sign in
              </button>
              <button
                onClick={() => loginWithRedirect()}
                className="text-sm font-medium px-4 py-2 rounded-lg text-white hover:opacity-90 transition-all duration-200 hover:shadow-md"
                style={{
                  background: "#3d3d3d",
                }}
              >
                Get started
              </button>
            </>
          )}
          {isAuthenticated && (
            <button
              onClick={onContinue}
              disabled={doneCount === 0}
              className="text-sm font-medium px-4 py-2 rounded-lg transition-all duration-200"
              style={{
                background: doneCount > 0 ? "#3d3d3d" : "#9ca3af",
                color: doneCount > 0 ? "white" : "#d1d5db",
                cursor: doneCount > 0 ? "pointer" : "not-allowed",
              }}
            >
              {doneCount > 0 ? "Continue to analysis" : "Upload docs first"}
            </button>
          )}
        </div>
      </header>

      {/* ── Dark hero band ── */}
      <div
        className="w-full py-16 px-8 text-center"
        style={{
          background: "linear-gradient(135deg, #2c3e50 0%, #34495e 100%)",
        }}
      >
        <img
          src={logo}
          alt="CoverMyPharma"
          className="h-90
          0 w-auto mx-auto mb-6 opacity-90"
          style={{ filter: "brightness(0) invert(1)" }}
        />

        <h1 className="text-4xl font-semibold text-white leading-tight mb-4">
          Medical policy docs,{" "}
          <span style={{ color: "#5b8db8" }}>finally decoded.</span>
        </h1>
        <p
          className="text-base max-w-xl mx-auto leading-relaxed"
          style={{ color: "#9ca3af" }}
        >
          Upload payer policy PDFs and instantly see which plans cover which
          drugs, what prior auth criteria apply, and what changed this quarter.
        </p>
      </div>

      <main className="flex-1 w-full px-8 py-12 flex flex-col items-center gap-10">
        {/* Login Required Message */}
        {!isAuthenticated && (
          <div className="bg-white rounded-2xl border-2 border-red-200 shadow-lg p-10 w-full max-w-2xl text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <h2
              className="text-2xl font-semibold mb-2"
              style={{ color: "#3d3d3d" }}
            >
              Sign in to upload
            </h2>
            <p className="text-base mb-6" style={{ color: "#9ca3af" }}>
              You need to be logged in to upload and process policy documents
              with our secure AI system.
            </p>
            <button
              onClick={() => loginWithRedirect()}
              className="px-8 py-3 rounded-lg text-white font-medium transition-all hover:shadow-lg"
              style={{
                background: "#5b8db8",
              }}
            >
              Sign in now
            </button>
          </div>
        )}

        {/* Upload card — only show if authenticated */}
        {isAuthenticated && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-10 w-full max-w-2xl">
            <h2
              className="text-xl font-semibold mb-1"
              style={{ color: "#3d3d3d" }}
            >
              UPLOAD POLICY DOCUMENTS
            </h2>
            <p className="text-sm mb-6" style={{ color: "#9ca3af" }}>
              PDF files only · Multiple files supported
            </p>

            {/* Drop zone — taller */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed rounded-xl py-16 text-center cursor-pointer transition-all"
              style={{
                borderColor: isDragging ? "#5b8db8" : "#e5e7eb",
                background: isDragging ? "rgba(91,141,184,0.04)" : "#fafafa",
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf"
                multiple
                className="hidden"
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  addFiles(e.target.files)
                }
              />
              <Upload
                className="w-8 h-8 mx-auto mb-3"
                style={{ color: "#5b8db8" }}
              />
              <p
                className="text-base font-medium mb-1"
                style={{ color: "#3d3d3d" }}
              >
                Drop policy PDFs here
              </p>
              <p className="text-sm" style={{ color: "#9ca3af" }}>
                or{" "}
                <span
                  className="underline cursor-pointer"
                  style={{ color: "#5b8db8" }}
                >
                  browse files
                </span>
              </p>
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="mt-4 flex flex-col gap-2">
                {files.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-3 p-3 rounded-lg border"
                    style={{ background: "#f9fafb", borderColor: "#f3f4f6" }}
                  >
                    <FileText
                      className="w-4 h-4 flex-shrink-0"
                      style={{ color: "#9ca3af" }}
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-xs font-medium truncate"
                        style={{ color: "#3d3d3d" }}
                      >
                        {f.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {(f.status === "uploading" ||
                          f.status === "processing") && (
                          <Loader2
                            className="w-3 h-3 animate-spin"
                            style={{ color: "#5b8db8" }}
                          />
                        )}
                        {f.status === "done" && (
                          <CheckCircle className="w-3 h-3 text-emerald-500" />
                        )}
                        {f.status === "error" && (
                          <X className="w-3 h-3 text-red-400" />
                        )}
                        <span
                          className="text-xs"
                          style={{
                            color:
                              f.status === "done"
                                ? "#10b981"
                                : f.status === "error"
                                  ? "#ef4444"
                                  : "#5b8db8",
                          }}
                        >
                          {f.status === "uploading"
                            ? "Uploading..."
                            : f.status === "processing"
                              ? "AI processing..."
                              : f.status === "done"
                                ? "Ready"
                                : "Failed"}
                        </span>
                        <span className="text-xs" style={{ color: "#d1d5db" }}>
                          ·
                        </span>
                        <span className="text-xs" style={{ color: "#9ca3af" }}>
                          {formatBytes(f.size)}
                        </span>
                      </div>
                      {f.status === "error" && f.errorMessage && (
                        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
                          <p className="font-semibold">PDF validation failed</p>
                          <p className="mt-1 break-words">{f.errorMessage}</p>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => removeFile(f.id)}
                      className="hover:opacity-70 transition-opacity"
                      style={{ color: "#d1d5db" }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* CTA */}
            <button
              onClick={onContinue}
              disabled={!canContinue}
              className="mt-6 w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all"
              style={{
                background: canContinue ? "#3d3d3d" : "#f3f4f6",
                color: canContinue ? "#ffffff" : "#9ca3af",
                cursor: canContinue ? "pointer" : "not-allowed",
              }}
            >
              {canContinue ? (
                <>
                  View coverage for {doneCount} document
                  {doneCount > 1 ? "s" : ""}
                  <ChevronRight className="w-4 h-4" />
                </>
              ) : (
                "Upload at least one PDF to continue"
              )}
            </button>
          </div>
        )}

        {/* Features — simple 3-column row underneath */}
        <div className="w-full max-w-2xl grid grid-cols-3 gap-6 pb-12">
          {FEATURES.map((f, i) => (
            <div key={i} className="text-center">
              <p className="text-sm font-semibold text-white mb-1">{f.title}</p>
              <p
                className="text-xs leading-relaxed"
                style={{ color: "rgba(255,255,255,0.6)" }}
              >
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
