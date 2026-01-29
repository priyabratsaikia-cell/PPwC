"use client";

import { useState, useRef, useEffect } from "react";
import { exportSlidesToPdf } from "@/lib/pdfExport";

interface SlideshowViewProps {
  assembledHtml: string;
  slideCount: number;
  presentationTitle: string;
  onReset?: () => void;
  /** When set, show Back button instead of Create New; call on Back to return to slide list. */
  onBack?: () => void;
}

type TabId = "preview" | "raw";

export default function SlideshowView({
  assembledHtml,
  slideCount,
  presentationTitle,
  onReset,
  onBack,
}: SlideshowViewProps) {
  const [activeTab, setActiveTab] = useState<TabId>("preview");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [slideHeight, setSlideHeight] = useState(540);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const slidesContainerRef = useRef<HTMLDivElement>(null);

  const handleGeneratePdf = async () => {
    if (!slidesContainerRef.current) return;
    setIsPdfGenerating(true);
    try {
      const filename = `${presentationTitle.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
      await exportSlidesToPdf(slidesContainerRef.current, filename);
    } finally {
      setIsPdfGenerating(false);
    }
  };

  const goPrev = () => setCurrentIndex((i) => Math.max(0, i - 1));
  const goNext = () => setCurrentIndex((i) => Math.min(slideCount - 1, i + 1));

  const MIN_SLIDE_HEIGHT = 400;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateHeight = () => {
      const h = el.clientHeight;
      setSlideHeight(h > 0 ? h : MIN_SLIDE_HEIGHT);
    };
    updateHeight();
    const ro = new ResizeObserver(updateHeight);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isFullscreen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, slideCount]);

  useEffect(() => {
    if (!wrapperRef.current) return;
    const h = isFullscreen ? window.innerHeight : slideHeight;
    wrapperRef.current.style.transform = `translateY(-${currentIndex * h}px)`;
  }, [currentIndex, isFullscreen, slideHeight]);

  return (
    <div className="space-y-6 p-6 border-t border-[#e5e5e5]">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#1a1a1a]">{presentationTitle}</h2>
          <p className="text-[#4a4a4a] font-medium mt-1">{slideCount} slides · Preview or Raw HTML, then export PDF.</p>
        </div>
      </div>

      {/* Tabs: Preview | Raw – selected = underline in color, no full highlight */}
      <div className="flex border-b border-[#e5e5e5]">
        <button
          type="button"
          onClick={() => setActiveTab("preview")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === "preview"
              ? "border-[#D04A02] text-[#D04A02]"
              : "border-transparent text-[#4a4a4a] hover:text-[#1a1a1a]"
          }`}
        >
          Preview
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("raw")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === "raw"
              ? "border-[#D04A02] text-[#D04A02]"
              : "border-transparent text-[#4a4a4a] hover:text-[#1a1a1a]"
          }`}
        >
          Raw
        </button>
      </div>

      {/* Preview: viewport = one slide; wrapper = all slides, translated to show current */}
      <div
        className={`relative rounded-xl border border-[#e5e5e5] shadow-sm bg-[#f5f5f5] ${
          isFullscreen ? "fixed inset-0 z-50 rounded-none" : "aspect-video max-h-[70vh] min-h-[400px]"
        } ${activeTab === "raw" ? "hidden" : ""}`}
        ref={containerRef}
        style={
          isFullscreen
            ? { height: "100vh", maxHeight: "none", ["--slide-h" as string]: "100vh" }
            : { ["--slide-h" as string]: `${slideHeight}px` }
        }
      >
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ height: "100%" }}
        >
          <div
            ref={wrapperRef}
            className="transition-transform duration-300 ease-out"
            style={{
              height: isFullscreen ? `${slideCount * 100}vh` : `${slideCount * slideHeight}px`,
              width: "100%",
            }}
          >
            <div
              ref={slidesContainerRef}
              className="w-full"
              style={{
                height: isFullscreen ? `${slideCount * 100}vh` : `${slideCount * slideHeight}px`,
              }}
              dangerouslySetInnerHTML={{ __html: assembledHtml }}
            />
          </div>
        </div>

        {/* Navigation */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#1a1a1a]/90 rounded-full px-4 py-2 text-white">
          <button
            type="button"
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="p-2 rounded-full hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Previous slide"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-medium min-w-[4rem] text-center">
            {currentIndex + 1} / {slideCount}
          </span>
          <button
            type="button"
            onClick={goNext}
            disabled={currentIndex === slideCount - 1}
            className="p-2 rounded-full hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Next slide"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="absolute top-4 right-4 p-2 rounded-lg bg-[#1a1a1a]/70 text-white hover:bg-[#1a1a1a]"
          aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          )}
        </button>
      </div>

      {/* Raw tab: assembled HTML */}
      {activeTab === "raw" && (
        <div className="rounded-xl border border-[#e5e5e5] bg-[#1a1a1a] overflow-hidden">
          <div className="px-3 py-2 border-b border-[#333] text-xs text-[#999] font-mono">
            Assembled HTML ({assembledHtml.length} chars)
          </div>
          <pre className="p-4 text-sm text-[#e5e5e5] font-mono overflow-auto max-h-[70vh] whitespace-pre-wrap break-all">
            {assembledHtml}
          </pre>
        </div>
      )}

      {/* Actions: PDF + Reset */}
      <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-[#e5e5e5]">
        <button
          type="button"
          onClick={handleGeneratePdf}
          disabled={isPdfGenerating}
          className="flex-1 py-3 px-6 bg-[#D04A02] hover:bg-[#b03e02] text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isPdfGenerating ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Generating PDF...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Generate PDF
            </>
          )}
        </button>
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex-1 py-3 px-6 bg-[#f5f5f5] text-[#1a1a1a] font-semibold rounded-lg hover:bg-[#e5e5e5] border border-[#e5e5e5] transition flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to slides
          </button>
        ) : onReset ? (
          <button
            type="button"
            onClick={onReset}
            className="flex-1 py-3 px-6 bg-[#f5f5f5] text-[#1a1a1a] font-semibold rounded-lg hover:bg-[#e5e5e5] border border-[#e5e5e5] transition flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Create New Presentation
          </button>
        ) : null}
      </div>
    </div>
  );
}
