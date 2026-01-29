"use client";

import { useState, useRef, useEffect } from "react";
import { PresentationRequest, PresentationResponse, GenerationStatus } from "@/types/presentation";
import { assembleSlides } from "@/lib/assembly";
import { parseAndNormalizeContent } from "@/lib/gemini";
import { exportSlidesToPdf } from "@/lib/pdfExport";
import SlideshowView from "./SlideshowView";
import SlidePreviewSection from "./SlidePreviewSection";

const styleOptions = [
  { value: "professional", label: "Professional", description: "Formal business style" },
  { value: "creative", label: "Creative", description: "Engaging and colorful" },
  { value: "minimal", label: "Minimal", description: "Clean and simple" },
  { value: "corporate", label: "Corporate", description: "Executive-ready" },
];

const STYLE_LABELS: Record<string, string> = {
  professional: "Professional",
  creative: "Creative",
  minimal: "Minimal",
  corporate: "Corporate",
};

function normalizeStreamedSlideHtml(raw: string, index: number): string {
  let html = raw.trim();
  const codeMatch = html.match(/```(?:html)?\s*([\s\S]*?)```/);
  if (codeMatch) html = codeMatch[1].trim();
  if (!html.includes('class="slide') && !html.includes("class='slide")) {
    html = `<div class="slide" data-slide-index="${index}" style="width:100%;height:100%;min-height:100%;max-width:100%;box-sizing:border-box;overflow:hidden;padding:2%;">${html}</div>`;
  } else if (!html.includes("data-slide-index")) {
    html = html.replace(/<div([^>]*class="[^"]*slide[^"]*")/i, `<div$1 data-slide-index="${index}"`);
  }
  return html;
}

export default function PresentationForm() {
  const [formData, setFormData] = useState<PresentationRequest>({
    topic: "",
    numberOfSlides: 8,
    audience: "",
    style: "professional",
    additionalInstructions: "",
  });

  const [status, setStatus] = useState<GenerationStatus>({ status: "idle" });
  const [streamedContent, setStreamedContent] = useState("");
  const [presentation, setPresentation] = useState<PresentationResponse | null>(null);
  const [slideHtmls, setSlideHtmls] = useState<(string | null)[]>([]);
  const [slideStreamingHtmls, setSlideStreamingHtmls] = useState<(string | null)[]>([]);
  const [assembledHtml, setAssembledHtml] = useState<string | null>(null);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [showReadyModal, setShowReadyModal] = useState(false);
  const [showTwoColumnLayout, setShowTwoColumnLayout] = useState(false);
  const contentEndRef = useRef<HTMLDivElement>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const previewSectionRef = useRef<HTMLDivElement>(null);
  const rightContentScrollRef = useRef<HTMLDivElement>(null);
  const slideSectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (status.status === "ready") {
      setShowReadyModal(true);
      const t = setTimeout(() => setShowReadyModal(false), 4000);
      return () => clearTimeout(t);
    }
  }, [status.status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowTwoColumnLayout(true);
    setStatus({ status: "generating", message: "Creating content..." });
    setPresentation(null);
    setAssembledHtml(null);
    setStreamedContent("");
    setSlideHtmls([]);
    setSlideStreamingHtmls([]);
    setShowFullPreview(false);

    try {
      const res = await fetch("/api/generate/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Failed to generate content");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let full = "";
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          full += chunk;
          setStreamedContent(full);
        }
      }

      const data = parseAndNormalizeContent(full);
      setPresentation(data);

      const totalSlides = data.slides.length;
      setStatus({ status: "designing", message: "Crafting HTML slides...", completedSlides: 0, totalSlides });
      setSlideHtmls(Array(totalSlides).fill(null));
      setSlideStreamingHtmls(Array(totalSlides).fill(null));

      const htmlPromises = data.slides.map(async (slideContent, index) => {
        const res = await fetch("/api/slide-html/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slideContent,
            style: formData.style,
            index,
            presentationTitle: data.title,
          }),
        });
        if (!res.ok) throw new Error("Failed to stream slide HTML");
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let full = "";
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            full += chunk;
            setSlideStreamingHtmls((prev) => {
              const next = [...prev];
              next[index] = full;
              return next;
            });
          }
        }
        const html = normalizeStreamedSlideHtml(full, index);
        setSlideHtmls((prev) => {
          const next = [...prev];
          next[index] = html;
          return next;
        });
        setSlideStreamingHtmls((prev) => {
          const next = [...prev];
          next[index] = null;
          return next;
        });
        setStatus((prev) => {
          if (prev.status !== "designing") return prev;
          const completed = (prev.completedSlides ?? 0) + 1;
          return { ...prev, completedSlides: completed };
        });
        return html;
      });

      const slideHtmlStrings = await Promise.all(htmlPromises);
      const assembled = assembleSlides(slideHtmlStrings);
      setAssembledHtml(assembled);
      setStatus({ status: "ready", message: "Done." });
    } catch (error) {
      setStatus({
        status: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      });
    }
  };

  const handleReset = () => {
    setPresentation(null);
    setAssembledHtml(null);
    setStreamedContent("");
    setSlideHtmls([]);
    setSlideStreamingHtmls([]);
    setShowFullPreview(false);
    setShowReadyModal(false);
    setShowTwoColumnLayout(false);
    setStatus({ status: "idle" });
  };

  const scrollToSlide = (index: number) => {
    const container = rightContentScrollRef.current;
    const slideEl = slideSectionRefs.current[index];
    if (container && slideEl) {
      const containerRect = container.getBoundingClientRect();
      const slideRect = slideEl.getBoundingClientRect();
      const top = container.scrollTop + (slideRect.top - containerRect.top);
      container.scrollTo({ top, behavior: "smooth" });
    }
  };

  const handleDownloadPdf = async () => {
    if (!pdfContainerRef.current || !presentation) return;
    setIsPdfGenerating(true);
    try {
      const filename = `${presentation.title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
      await exportSlidesToPdf(pdfContainerRef.current, filename);
    } finally {
      setIsPdfGenerating(false);
    }
  };

  const isGenerating = status.status === "generating";
  const isDesigning = status.status === "designing";
  const totalSlides = slideHtmls.length;
  const allSlidesReady = totalSlides > 0 && slideHtmls.every((h) => h != null);
  const topic = (presentation?.title ?? formData.topic) || "—";
  const tone = STYLE_LABELS[formData.style] ?? formData.style;

  const slideCountForTodos = presentation ? totalSlides : formData.numberOfSlides;
  const todos = [
    { id: "content", label: "Content generation", done: !!presentation, current: isGenerating },
    ...Array.from({ length: slideCountForTodos }, (_, i) => ({
      id: `slide-${i}`,
      label: `Slide ${i + 1}`,
      done: slideHtmls[i] != null,
      current: isDesigning && slideHtmls[i] == null,
    })),
    { id: "ready", label: "Ready", done: status.status === "ready", current: status.status === "ready" },
  ];

  const getSlideIndex = (id: string) => {
    const m = id.match(/^slide-(\d+)$/);
    return m ? parseInt(m[1], 10) : -1;
  };

  // Chatbot home layout – show until user clicks Generate (fills viewport, no scroll)
  if (!showTwoColumnLayout) {
    return (
      <div className="h-full flex flex-col min-h-0 bg-[#fafafa] overflow-hidden">
        {/* Message area – standard chatbot top */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-6">
          <div className="text-center max-w-md text-[#4a4a4a]">
            <p className="text-4xl mb-4" aria-hidden>📊</p>
            <h2 className="text-xl font-semibold text-[#1a1a1a] mb-2">Create your presentation</h2>
            <p className="text-sm">Enter your topic, audience, and preferences below. Click Generate to build your slides.</p>
          </div>
        </div>
        {/* Input area – one big section with left/right space and rounded corners */}
        <div className="shrink-0 px-4 sm:px-6 lg:px-8 py-4">
          <div className="max-w-2xl mx-auto rounded-2xl border border-[#e5e5e5] bg-white p-4 sm:p-5 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                <select
                  value={formData.style}
                  onChange={(e) =>
                    setFormData({ ...formData, style: e.target.value as PresentationRequest["style"] })
                  }
                  className="px-3 py-2 border border-[#e5e5e5] rounded-lg text-sm bg-[#fafafa] focus:ring-2 focus:ring-[#D04A02] focus:border-[#D04A02]"
                  aria-label="Tone"
                >
                  {styleOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      Tone: {opt.label}
                    </option>
                  ))}
                </select>
                <select
                  value={formData.numberOfSlides}
                  onChange={(e) =>
                    setFormData({ ...formData, numberOfSlides: parseInt(e.target.value) })
                  }
                  className="px-3 py-2 border border-[#e5e5e5] rounded-lg text-sm bg-[#fafafa] focus:ring-2 focus:ring-[#D04A02] focus:border-[#D04A02]"
                  aria-label="Number of slides"
                >
                  {Array.from({ length: 18 }, (_, i) => i + 3).map((n) => (
                    <option key={n} value={n}>
                      {n} slides
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                required
                placeholder="Presentation topic *"
                className="w-full px-4 py-3 border border-[#e5e5e5] rounded-lg text-sm bg-[#fafafa] focus:ring-2 focus:ring-[#D04A02] focus:border-[#D04A02]"
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Target audience *"
                  className="flex-1 px-4 py-3 border border-[#e5e5e5] rounded-lg text-sm bg-[#fafafa] focus:ring-2 focus:ring-[#D04A02] focus:border-[#D04A02]"
                  value={formData.audience}
                  onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Additional instructions (optional)"
                  className="flex-1 px-4 py-3 border border-[#e5e5e5] rounded-lg text-sm bg-[#fafafa] focus:ring-2 focus:ring-[#D04A02] focus:border-[#D04A02]"
                  value={formData.additionalInstructions}
                  onChange={(e) =>
                    setFormData({ ...formData, additionalInstructions: e.target.value })
                  }
                />
              </div>
              <button
                type="submit"
                className="w-full px-6 py-3 bg-[#D04A02] hover:bg-[#b03e02] text-white font-semibold rounded-lg transition text-sm"
              >
                Generate presentation
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Two-column layout – left sidebar + right content (fills viewport, no scroll)
  return (
    <div className="flex flex-col md:flex-row h-full min-h-0 overflow-hidden">
      {/* Left section: static (does not scroll with page) */}
      <aside className="w-full md:w-72 shrink-0 md:sticky md:top-0 md:h-screen md:overflow-y-auto border-b md:border-b-0 md:border-r border-[#e5e5e5] bg-[#fafafa] p-4 flex flex-col">
        <div className="mb-4 pb-4 border-b border-[#e5e5e5]">
          <p className="text-xs font-semibold text-[#4a4a4a] uppercase tracking-wide">Presentation</p>
          <p className="font-semibold text-[#1a1a1a] mt-1 break-words">{topic}</p>
          <p className="text-xs text-[#4a4a4a] mt-1">Tone: {tone}</p>
        </div>
        <p className="text-xs font-semibold text-[#4a4a4a] uppercase tracking-wide mb-2">Stages</p>
        <ul className="space-y-1.5">
          {todos.map((todo) => {
            const slideIndex = getSlideIndex(todo.id);
            const canGoToSlide = slideIndex >= 0 && totalSlides > 0 && slideHtmls[slideIndex] != null;
            return (
              <li
                key={todo.id}
                className={`flex items-center gap-2 text-sm ${
                  todo.current ? "text-[#D04A02] font-medium" : todo.done ? "text-[#1a1a1a]" : "text-[#4a4a4a]"
                } ${canGoToSlide ? "cursor-pointer hover:opacity-80" : ""}`}
                onClick={canGoToSlide ? () => scrollToSlide(slideIndex) : undefined}
                onKeyDown={
                  canGoToSlide
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          scrollToSlide(slideIndex);
                        }
                      }
                    : undefined
                }
                role={canGoToSlide ? "button" : undefined}
                tabIndex={canGoToSlide ? 0 : undefined}
              >
                {todo.done ? (
                  <span className="text-green-600 shrink-0" aria-hidden>✓</span>
                ) : todo.current ? (
                  <span className="w-4 h-4 border-2 border-[#D04A02] border-t-transparent rounded-full animate-spin shrink-0" />
                ) : (
                  <span className="w-4 h-4 rounded-full border border-[#e5e5e5] shrink-0" />
                )}
                <span>{todo.label}</span>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Right section: main never scrolls; only inner content area scrolls so bar stays fixed */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {status.status === "error" && (
          <div className="p-4 m-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 font-medium">Error</p>
            <p className="text-red-600 text-sm">{status.message}</p>
            <button
              onClick={() => setStatus({ status: "idle" })}
              className="mt-2 text-sm text-red-700 underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Idle: show form in right section (scrollable wrapper so main doesn't scroll) */}
        {(status.status === "idle" || status.status === "error") && !presentation && (
          <div className="flex-1 min-h-0 overflow-auto">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="max-w-xl">
              <h1 className="text-xl font-bold text-[#1a1a1a]">Create presentation</h1>
              <p className="text-[#4a4a4a] mt-1 text-sm">Enter topic, audience, and style.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-[#1a1a1a] mb-1">Presentation topic *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Introduction to Machine Learning"
                  className="w-full px-4 py-3 border border-[#e5e5e5] rounded-lg focus:ring-2 focus:ring-[#D04A02] focus:border-[#D04A02] transition bg-white"
                  value={formData.topic}
                  onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#1a1a1a] mb-1">Target audience *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Senior executives"
                  className="w-full px-4 py-3 border border-[#e5e5e5] rounded-lg focus:ring-2 focus:ring-[#D04A02] focus:border-[#D04A02] transition bg-white"
                  value={formData.audience}
                  onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#1a1a1a] mb-1">Slides: {formData.numberOfSlides}</label>
                <input
                  type="range"
                  min="3"
                  max="20"
                  className="w-full h-2 rounded-lg"
                  style={{ accentColor: "#D04A02" }}
                  value={formData.numberOfSlides}
                  onChange={(e) =>
                    setFormData({ ...formData, numberOfSlides: parseInt(e.target.value) })
                  }
                />
                <div className="flex justify-between text-xs text-[#4a4a4a] mt-0.5">
                  <span>3</span>
                  <span>20</span>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#1a1a1a] mb-2">Style</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {styleOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        style: option.value as PresentationRequest["style"],
                      })
                    }
                    className={`p-3 rounded-lg border-2 text-left transition text-sm ${
                      formData.style === option.value
                        ? "border-[#D04A02] bg-[#fef3ef]"
                        : "border-[#e5e5e5] hover:border-[#ccc] bg-white"
                    }`}
                  >
                    <p className="font-medium text-[#1a1a1a]">{option.label}</p>
                    <p className="text-xs text-[#4a4a4a] mt-0.5">{option.description}</p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#1a1a1a] mb-1">Additional instructions (optional)</label>
              <textarea
                rows={2}
                placeholder="e.g., Include data visualization..."
                className="w-full px-4 py-3 border border-[#e5e5e5] rounded-lg focus:ring-2 focus:ring-[#D04A02] focus:border-[#D04A02] transition resize-none bg-white"
                value={formData.additionalInstructions}
                onChange={(e) =>
                  setFormData({ ...formData, additionalInstructions: e.target.value })
                }
              />
            </div>
            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-3 bg-[#D04A02] hover:bg-[#b03e02] text-white font-semibold rounded-lg transition"
            >
              Generate presentation
            </button>
          </form>
          </div>
        )}

        {/* Generating / Designing / Ready: right content = top bar (Preview, Download PDF) + placeholder or streaming + N slide sections */}
        {(status.status === "generating" || status.status === "designing" || status.status === "ready" || presentation) && (
          <>
            {showFullPreview && assembledHtml && presentation ? (
              <div className="flex-1 min-h-0 overflow-auto border-t border-[#e5e5e5]">
                <SlideshowView
                  assembledHtml={assembledHtml}
                  slideCount={presentation.slides.length}
                  presentationTitle={presentation.title}
                  onBack={() => setShowFullPreview(false)}
                />
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0" ref={previewSectionRef}>
                {/* Top bar: always in place (sibling of scroll area, never scrolls) */}
                <div className="shrink-0 flex items-center justify-end gap-3 p-4 border-b border-[#e5e5e5] bg-white">
                  <button
                    type="button"
                    onClick={() => setShowFullPreview(true)}
                    disabled={!allSlidesReady}
                    className="px-4 py-2 bg-[#D04A02] hover:bg-[#b03e02] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition text-sm"
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    disabled={!allSlidesReady || isPdfGenerating}
                    className="px-4 py-2 bg-[#1a1a1a] hover:bg-[#333] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition text-sm flex items-center gap-2"
                  >
                    {isPdfGenerating ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Downloading…
                      </>
                    ) : (
                      "Download PDF"
                    )}
                  </button>
                </div>

                {/* Scrollable area only – bar stays fixed; only this div scrolls */}
                <div ref={rightContentScrollRef} className="flex-1 min-h-0 overflow-auto">
                  {/* Before streaming starts: placeholder with emoji */}
                  {isGenerating && !streamedContent && (
                    <div className="flex items-center justify-center p-8 min-h-full text-center text-[#4a4a4a]">
                      <div>
                        <p className="text-5xl mb-3" aria-hidden>📽️</p>
                        <p className="text-lg font-medium">Preview will be displayed here</p>
                        <p className="text-sm mt-1">Content is being generated…</p>
                      </div>
                    </div>
                  )}

                  {/* Streaming content – show when we have streamed content or when designing/ready with final content */}
                  {((isGenerating && streamedContent) || (presentation && (isDesigning || status.status === "ready"))) && (
                    <>
                      {/* Off-screen container for PDF export (in DOM so html2canvas can capture .slide elements) */}
                      {assembledHtml && (
                        <div
                          ref={pdfContainerRef}
                          className="absolute left-[-9999px] top-0 w-[960px]"
                          style={{ visibility: "hidden" }}
                          aria-hidden
                          dangerouslySetInnerHTML={{ __html: assembledHtml }}
                        />
                      )}

                      {(isGenerating || streamedContent) && (
                        <div className="p-4 border-b border-[#e5e5e5] shrink-0">
                          <p className="text-xs font-semibold text-[#4a4a4a] mb-2">Content stream</p>
                          <div className="bg-[#1a1a1a] rounded-lg p-3 max-h-[240px] overflow-auto font-mono text-xs text-[#e5e5e5] whitespace-pre-wrap break-words">
                            {streamedContent || "Waiting for content…"}
                            <div ref={contentEndRef} />
                          </div>
                        </div>
                      )}

                      {/* N rows: individual slide previews – show when we have slide count (designing or ready) */}
                      {(isDesigning || status.status === "ready") && totalSlides > 0 && (
                        <div className="p-4 space-y-4">
                          <p className="text-xs font-semibold text-[#4a4a4a] shrink-0">
                            Slide previews ({totalSlides} slides · 16:9, each rendered as individual HTML)
                          </p>
                          <div className="space-y-4">
                            {slideHtmls.map((html, index) => (
                              <div
                                key={index}
                                ref={(el) => {
                                  slideSectionRefs.current[index] = el;
                                }}
                                data-slide-index={index}
                              >
                                <SlidePreviewSection
                                  html={html}
                                  streamedHtml={slideStreamingHtmls[index] ?? undefined}
                                  slideNumber={index + 1}
                                  isDesigning={isDesigning}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Completion modal – PwC theme */}
        {showReadyModal && (
          <div className="fixed inset-x-0 top-0 z-50 flex justify-center pt-6 px-4 pointer-events-none">
            <div
              className="bg-white text-[#1a1a1a] px-6 py-4 rounded-lg shadow-lg border-t-4 border-[#D04A02] animate-[slideIn_0.3s_ease-out] pointer-events-auto"
              role="alert"
            >
              <p className="font-semibold text-lg text-[#1a1a1a]">Your Presentation is ready!!</p>
              <button
                type="button"
                onClick={() => setShowReadyModal(false)}
                className="mt-2 text-sm text-[#D04A02] hover:text-[#b03e02] font-medium underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
