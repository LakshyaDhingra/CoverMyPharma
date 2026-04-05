import {
  useState,
  useRef,
  useCallback,
  useEffect,
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
import { useAuth0 } from "@auth0/auth0-react";
import type { ParsePdfResponse } from "@/app/lib/plan-transform";
import { backendUrl } from "@/lib/api-base";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";

import logo from "@/assets/CoverMyPharma.svg";
import symbol from "@/assets/CoverMyPharmaSymbol.svg";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  status: "uploading" | "processing" | "done" | "error";
  errorMessage?: string;
}

interface UploadPageProps {
  onContinue: () => void;
  onUploadSuccess: (
    data: unknown,
    meta?: { documentId?: string; filename?: string },
  ) => void;
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
    desc: "See company coverage information side by side in one matrix - no more hunting through separate documents.",
  },
  {
    icon: <Shield className="w-4 h-4" />,
    title: "Immutable change log",
    desc: "Every policy update is timestamped and recorded on-chain so you always know what changed and when.",
  },
];

/** After login, continue to the main app (comparison / coverage search). */
const POST_LOGIN_CONTINUE_KEY = "cmp_post_login_continue_to_app";

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

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadPage({
  onContinue,
  onUploadSuccess,
}: UploadPageProps) {
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

  useSupabaseUser();

  useEffect(() => {
    if (!isAuthenticated) return;
    try {
      if (sessionStorage.getItem(POST_LOGIN_CONTINUE_KEY) === "1") {
        sessionStorage.removeItem(POST_LOGIN_CONTINUE_KEY);
        onContinue();
      }
    } catch {
      /* sessionStorage unavailable */
    }
  }, [isAuthenticated, onContinue]);

  const handleViewComparison = useCallback(() => {
    if (isAuthenticated) {
      onContinue();
      return;
    }
    try {
      sessionStorage.setItem(POST_LOGIN_CONTINUE_KEY, "1");
    } catch {
      /* sessionStorage unavailable */
    }
    loginWithRedirect();
  }, [isAuthenticated, loginWithRedirect, onContinue]);

  const persistUploadedDocument = useCallback(
    async (file: File, responseData: ParsePdfResponse) => {
      if (!hasSupabaseConfig || !supabase || !user?.sub) {
        return undefined;
      }

      const { data: userData, error: userError } = await supabase
        .from("users")
        .upsert(
          {
            auth0_id: user.sub,
            email: user.email ?? "",
            name: user.name ?? null,
          },
          { onConflict: "auth0_id" },
        )
        .select()
        .single();

      if (userError) {
        throw userError;
      }

      const analysis = responseData.analysis;
      const diagnosis = normalizeText(analysis?.diagnosis);
      const medication = normalizeText(analysis?.medication_name);
      const summary = normalizeText(analysis?.summary);

      const { data: inserted, error: docError } = await supabase
        .from("medical_documents")
        .insert({
          user_id: userData.id,
          filename: file.name,
          file_size: file.size,
          drug_name: medication || null,
          conditions: diagnosis || null,
          prior_auth_required:
            analysis?.prior_auth_required == null
              ? null
              : String(analysis.prior_auth_required),
          clinical_criteria: summary || null,
          diagnosis_codes: diagnosis || null,
          effective_date: null,
          policy_changes: Array.isArray(analysis?.policy_changes)
            ? analysis.policy_changes
            : [],
          raw_extracted_data: responseData,
        })
        .select()
        .single();

      if (docError) {
        throw docError;
      }

      return inserted?.id as string | undefined;
    },
    [user],
  );

  const handlePdfProcessing = useCallback(
    async (file: File, fileId: string) => {
      if (processingRef.current.has(fileId)) return;
      processingRef.current.add(fileId);

      try {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? { ...f, status: "processing", errorMessage: undefined }
              : f,
          ),
        );

        const token = await getAccessTokenSilently();
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(backendUrl("/api/parse-pdf"), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        const data = (await res.json()) as ParsePdfResponse & {
          detail?: string;
          error?: string;
        };

        if (!res.ok) {
          throw new Error(
            data?.detail || data?.error || `API error: ${res.status}`,
          );
        }

        let documentId: string | undefined;
        try {
          documentId = await persistUploadedDocument(file, data);
        } catch (persistError) {
          console.warn("Supabase persistence skipped:", persistError);
        }

        onUploadSuccess(data, { documentId, filename: file.name });

        setFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, status: "done" } : f)),
        );
      } catch (err) {
        console.error("PDF processing failed:", err);
        const errorMessage =
          err instanceof Error ? err.message : "PDF processing failed";

        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId ? { ...f, status: "error", errorMessage } : f,
          ),
        );
      } finally {
        processingRef.current.delete(fileId);
      }
    },
    [getAccessTokenSilently, onUploadSuccess, persistUploadedDocument],
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
          <button
            type="button"
            onClick={handleViewComparison}
            className="text-sm px-4 py-2 rounded-lg transition-all duration-200 hover:shadow-md text-white border border-white/25 hover:bg-white/20"
            aria-label={
              isAuthenticated
                ? "Open coverage comparison and search"
                : "Sign in to open coverage comparison and search"
            }
          >
            Coverage comparison
          </button>
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
        </div>
      </header>

      <div
        className="w-full py-16 px-8 text-center"
        style={{
          background: "linear-gradient(135deg, #2c3e50 0%, #34495e 100%)",
        }}
      >
        <img
          src={logo}
          alt="CoverMyPharma"
          className="h-90 0 w-auto mx-auto mb-6 opacity-90"
          style={{ filter: "brightness(0) invert(1)" }}
        />

        <h1 className="text-4xl font-semibold text-white leading-tight mb-4">
          Medical policy docs, {" "}
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

        {isAuthenticated && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-10 w-full max-w-2xl">
            <h2
              className="text-xl font-semibold mb-1"
              style={{ color: "#3d3d3d" }}
            >
              UPLOAD POLICY DOCUMENTS
            </h2>
            <p className="text-sm mb-6" style={{ color: "#9ca3af" }}>
              PDF files only - Multiple files supported
            </p>

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
                or {" "}
                <span
                  className="underline cursor-pointer"
                  style={{ color: "#5b8db8" }}
                >
                  browse files
                </span>
              </p>
            </div>

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
                          -
                        </span>
                        <span className="text-xs" style={{ color: "#9ca3af" }}>
                          {formatBytes(f.size)}
                        </span>
                      </div>
                      {f.status === "error" && f.errorMessage && (
                        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
                          <p className="font-semibold">PDF processing failed</p>
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

        <div className="w-full max-w-2xl grid grid-cols-3 gap-6 pb-12">
          {FEATURES.map((feature, index) => (
            <div key={index} className="text-center">
              <p className="text-sm font-semibold text-white mb-1">{feature.title}</p>
              <p
                className="text-xs leading-relaxed"
                style={{ color: "rgba(255,255,255,0.6)" }}
              >
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
