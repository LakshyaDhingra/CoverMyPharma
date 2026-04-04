import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
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
    desc: "See Aetna vs UHC vs Cigna side by side in one matrix — no more hunting through separate documents.",
  },
  {
    icon: <Shield className="w-4 h-4" />,
    title: "Immutable change log",
    desc: "Every policy update is timestamped and recorded on-chain so you always know what changed and when.",
  },
];

const SAMPLE_DRUGS = ["Keytruda", "Humira", "Dupixent", "Ocrevus", "Stelara"];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadPage({ onContinue }: UploadPageProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const simulateProcessing = (id: string) => {
    setTimeout(() => {
      setFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, status: "processing" } : f)),
      );
      setTimeout(() => {
        setFiles((prev) =>
          prev.map((f) => (f.id === id ? { ...f, status: "done" } : f)),
        );
      }, 2000);
    }, 1000);
  };

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    Array.from(incoming).forEach((f) => {
      if (f.type !== "application/pdf") return;
      const newFile: UploadedFile = {
        id: crypto.randomUUID(),
        name: f.name,
        size: f.size,
        status: "uploading",
      };
      setFiles((prev) => [...prev, newFile]);
      simulateProcessing(newFile.id);
    });
  };

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
      style={{ background: "#f5f6f8" }}
    >
      {/* ── Top nav ── */}
      <header className="flex items-center justify-between px-8 py-2 bg-white border-b border-gray-100">
        <div className="flex items-center gap-3">
          <img src={symbol} alt="CoverMyPharma" className="h-30 w-auto" />
        </div>

        <div className="flex items-center gap-2">
          <button
            className="text-sm px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            style={{ color: "#3d3d3d" }}
          >
            Sign in
          </button>
          <button
            className="text-sm font-medium px-4 py-2 rounded-lg text-white hover:opacity-90 transition-opacity"
            style={{ background: "#3d3d3d" }}
          >
            Get started
          </button>
        </div>
      </header>

      {/* ── Dark hero band ── */}
      <div
        className="w-full py-16 px-8 text-center"
        style={{ background: "#3d3d3d" }}
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

      {/* ── Upload + features ── */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12 grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
        {/* Upload card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <h2
            className="text-lg font-semibold mb-1"
            style={{ color: "#3d3d3d" }}
          >
            Upload policy documents
          </h2>
          <p className="text-sm mb-6" style={{ color: "#9ca3af" }}>
            PDF files only · Multiple files supported
          </p>

          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all"
            style={{
              borderColor: isDragging ? "#5b8db8" : "#e5e7eb",
              background: isDragging ? "rgba(91,141,184,0.04)" : "transparent",
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
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
              style={{ background: "rgba(91,141,184,0.1)" }}
            >
              <Upload className="w-5 h-5" style={{ color: "#5b8db8" }} />
            </div>
            <p
              className="text-sm font-medium mb-1"
              style={{ color: "#3d3d3d" }}
            >
              Drop policy PDFs here
            </p>
            <p className="text-xs" style={{ color: "#9ca3af" }}>
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
                View coverage for {doneCount} document{doneCount > 1 ? "s" : ""}
                <ChevronRight className="w-4 h-4" />
              </>
            ) : (
              "Upload at least one PDF to continue"
            )}
          </button>

          <p className="text-center text-xs mt-4" style={{ color: "#9ca3af" }}>
            No account required to try ·{" "}
            <span
              className="underline cursor-pointer"
              style={{ color: "#5b8db8" }}
            >
              Sign in
            </span>{" "}
            to save results
          </p>
        </div>

        {/* Feature list */}
        <div className="flex flex-col gap-6 pt-2">
          <p
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: "#5b8db8" }}
          >
            What Cover My Pharma does
          </p>

          {FEATURES.map((f, i) => (
            <div key={i} className="flex gap-4">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: "rgba(61,61,61,0.06)" }}
              >
                <span style={{ color: "#3d3d3d" }}>{f.icon}</span>
              </div>
              <div>
                <p
                  className="text-sm font-semibold mb-1"
                  style={{ color: "#3d3d3d" }}
                >
                  {f.title}
                </p>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "#9ca3af" }}
                >
                  {f.desc}
                </p>
              </div>
            </div>
          ))}

          {/* Payer badges */}
          <div className="mt-4 pt-6 border-t border-gray-100">
            <p className="text-xs mb-3" style={{ color: "#9ca3af" }}>
              Currently tracking policies from
            </p>
            <div className="flex gap-2 flex-wrap">
              {["Aetna", "UHC", "Cigna"].map((payer) => (
                <span
                  key={payer}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border bg-white"
                  style={{ color: "#3d3d3d", borderColor: "#e5e7eb" }}
                >
                  {payer}
                </span>
              ))}
              <span
                className="text-xs px-3 py-1.5 rounded-lg border border-dashed"
                style={{ color: "#9ca3af", borderColor: "#d1d5db" }}
              >
                + more coming
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
