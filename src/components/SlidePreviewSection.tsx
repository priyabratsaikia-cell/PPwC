"use client";

import { useRef, useState, useEffect } from "react";

const SLIDE_LOGIC_WIDTH = 960;
const SLIDE_LOGIC_HEIGHT = 540; // 16:9

type TabId = "preview" | "raw";

interface SlidePreviewSectionProps {
  html: string | null;
  streamedHtml?: string | null;
  slideNumber: number;
  isDesigning?: boolean;
}

export default function SlidePreviewSection({
  html,
  streamedHtml = null,
  slideNumber,
  isDesigning = false,
}: SlidePreviewSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const streamPreRef = useRef<HTMLPreElement>(null);
  const [scale, setScale] = useState(1);
  const [activeTab, setActiveTab] = useState<TabId>("preview");
  const [copyLabel, setCopyLabel] = useState<"Copy" | "Copied!">("Copy");

  const showTabs = html != null;
  const showStreaming = isDesigning && html == null;
  const PLACEHOLDER_TEXT = "Code will stream here as it's generated...";
  const streamedCodeDisplay =
    typeof streamedHtml === "string" && streamedHtml.length > 0 ? streamedHtml : PLACEHOLDER_TEXT;
  const isPlaceholder = streamedCodeDisplay === PLACEHOLDER_TEXT;

  useEffect(() => {
    if (showStreaming && streamPreRef.current) {
      streamPreRef.current.scrollTop = streamPreRef.current.scrollHeight;
    }
  }, [showStreaming, streamedHtml]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || html == null) return;
    const updateScale = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) {
        const s = Math.min(w / SLIDE_LOGIC_WIDTH, h / SLIDE_LOGIC_HEIGHT);
        setScale(s);
      }
    };
    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(el);
    return () => ro.disconnect();
  }, [html]);

  const copyRawHtml = async () => {
    const toCopy = html ?? streamedHtml;
    if (toCopy == null) return;
    try {
      await navigator.clipboard.writeText(toCopy);
      setCopyLabel("Copied!");
      setTimeout(() => setCopyLabel("Copy"), 2000);
    } catch {
      setCopyLabel("Copy");
    }
  };

  return (
    <div className="rounded-lg border border-[#e5e5e5] overflow-hidden bg-white flex flex-col shrink-0">
      <div className="px-3 py-2 bg-[#f5f5f5] border-b border-[#e5e5e5] shrink-0 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-[#4a4a4a]">Slide {slideNumber}</span>
        {showTabs && (
          <div className="flex rounded-md border border-[#e5e5e5] overflow-hidden">
            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === "preview"
                  ? "bg-[var(--pwc-orange)] text-white"
                  : "bg-white text-[#4a4a4a] hover:bg-[#f0f0f0]"
              }`}
            >
              Preview
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("raw")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === "raw"
                  ? "bg-[var(--pwc-orange)] text-white"
                  : "bg-white text-[#4a4a4a] hover:bg-[#f0f0f0]"
              }`}
            >
              Raw
            </button>
          </div>
        )}
      </div>

      {showStreaming ? (
        <div className="flex flex-col bg-[#1e1e1e] min-h-[280px] flex-1" style={{ aspectRatio: "16 / 9", minHeight: 280 }}>
          <div className="px-3 py-2 border-b border-[#333] shrink-0 flex items-center gap-2 text-xs text-[#888]">
            <span className="font-medium text-[#aaa]">Code</span>
            <span>{streamedHtml ? "Streaming…" : "Waiting for stream…"}</span>
            <span className="bubbling-dots" aria-hidden>
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </div>
          {isPlaceholder ? (
            <div className="flex-1 flex items-center justify-center min-h-0 p-4">
              <p className="text-sm text-[#888] font-mono text-center">{streamedCodeDisplay}</p>
            </div>
          ) : (
            <pre
              ref={streamPreRef}
              className="flex-1 overflow-auto p-3 m-0 text-xs text-[#d4d4d4] font-mono whitespace-pre-wrap break-all min-h-0"
            >
              <code>{streamedCodeDisplay}</code>
            </pre>
          )}
        </div>
      ) : activeTab === "preview" ? (
        <div
          ref={containerRef}
          className="w-full overflow-hidden bg-[#f0f0f0] flex items-center justify-center slide-preview-wrapper"
          style={{ aspectRatio: "16 / 9" }}
        >
          {html == null ? (
            <div className="text-[#4a4a4a] text-sm">—</div>
          ) : (
            <div
              className="origin-top-left overflow-hidden slide-preview-scaled"
              style={{
                width: SLIDE_LOGIC_WIDTH,
                height: SLIDE_LOGIC_HEIGHT,
                transform: `scale(${scale})`,
                transformOrigin: "0 0",
              }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </div>
      ) : (
        <div className="flex flex-col bg-[#1e1e1e] min-h-[200px]" style={{ aspectRatio: "16 / 9" }}>
          <div className="px-2 py-1.5 border-b border-[#333] flex justify-end shrink-0">
            <button
              type="button"
              onClick={copyRawHtml}
              disabled={html == null}
              className="px-3 py-1 text-xs font-medium rounded bg-[var(--pwc-orange)] text-white hover:bg-[var(--pwc-orange-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {copyLabel}
            </button>
          </div>
          <pre className="flex-1 overflow-auto p-3 m-0 text-xs text-[#d4d4d4] font-mono whitespace-pre-wrap break-all">
            <code>{html ?? "—"}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
