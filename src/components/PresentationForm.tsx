"use client";

import { useState, useRef, useEffect } from "react";
import { PresentationRequest, PresentationResponse, GenerationStatus } from "@/types/presentation";
import { assembleSlides } from "@/lib/assembly";
import { parseAndNormalizeContent } from "@/lib/gemini";
import SlidePreviewSection from "./SlidePreviewSection";
import AssistantStepsPanel from "./AssistantStepsPanel";

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

type PresentationFormProps = {
  onGenerateStart?: () => void;
};

export default function PresentationForm({ onGenerateStart }: PresentationFormProps) {
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
  const [showReadyModal, setShowReadyModal] = useState(false);
  const [showTwoColumnLayout, setShowTwoColumnLayout] = useState(false);
  const [contentStreamCollapsed, setContentStreamCollapsed] = useState(false);
  const contentEndRef = useRef<HTMLDivElement>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const previewSectionRef = useRef<HTMLDivElement>(null);
  const rightContentScrollRef = useRef<HTMLDivElement>(null);
  const contentStreamBodyRef = useRef<HTMLDivElement>(null);
  const slideSectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (status.status === "ready") {
      setShowReadyModal(true);
      const t = setTimeout(() => setShowReadyModal(false), 4000);
      return () => clearTimeout(t);
    }
  }, [status.status]);

  useEffect(() => {
    const el = contentStreamBodyRef.current;
    if (el && streamedContent) el.scrollTop = el.scrollHeight;
  }, [streamedContent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onGenerateStart?.();
    setShowTwoColumnLayout(true);
    setContentStreamCollapsed(false);
    setStatus({ status: "generating", message: "Creating content..." });
    setPresentation(null);
    setAssembledHtml(null);
    setStreamedContent("");
    setSlideHtmls([]);
    setSlideStreamingHtmls([]);

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
      setContentStreamCollapsed(true);

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

  const isGenerating = status.status === "generating";
  const isDesigning = status.status === "designing";
  const totalSlides = slideHtmls.length;
  const topic = (presentation?.title ?? formData.topic) || "—";
  const tone = STYLE_LABELS[formData.style] ?? formData.style;

  const slideCountForTodos = presentation ? totalSlides : formData.numberOfSlides;
  const todos: { id: string; label: string; done: boolean; current: boolean }[] = [
    { id: "content", label: "Content generation", done: !!presentation, current: isGenerating },
    ...Array.from({ length: slideCountForTodos }, (_, i) => ({
      id: `slide-${i}`,
      label: `Slide ${i + 1}`,
      done: slideHtmls[i] != null,
      current: isDesigning && slideHtmls[i] == null,
    })),
    { id: "ready", label: "Ready", done: status.status === "ready", current: status.status === "ready" },
  ];

  const canGoToSlide = (index: number) => totalSlides > 0 && slideHtmls[index] != null;

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

  // Three sections: Assistant Steps (workflow style) | Preview (stream + slides)
  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Middle: Assistant Steps panel – workflow style; when idle show form, else topic + tone + stages */}
      <AssistantStepsPanel
        topic={topic}
        tone={tone}
        todos={todos}
        onSlideClick={scrollToSlide}
        canGoToSlide={canGoToSlide}
      >
        {(status.status === "idle" || status.status === "error") && !presentation && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-[#1a1a1a] mb-1">Create presentation</h3>
              <p className="text-xs text-[#4a4a4a]">Enter topic, audience, and style.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1a1a1a] mb-1">Presentation topic *</label>
              <input
                type="text"
                required
                placeholder="e.g., Introduction to Machine Learning"
                className="w-full px-3 py-2 border border-[#e5e5e5] rounded-lg text-sm focus:ring-2 focus:ring-[#D04A02] focus:border-[#D04A02] bg-white"
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1a1a1a] mb-1">Target audience *</label>
              <input
                type="text"
                required
                placeholder="e.g., Senior executives"
                className="w-full px-3 py-2 border border-[#e5e5e5] rounded-lg text-sm focus:ring-2 focus:ring-[#D04A02] focus:border-[#D04A02] bg-white"
                value={formData.audience}
                onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1a1a1a] mb-1">Slides: {formData.numberOfSlides}</label>
              <input
                type="range"
                min="3"
                max="20"
                className="w-full h-2 rounded-lg"
                style={{ accentColor: "#D04A02" }}
                value={formData.numberOfSlides}
                onChange={(e) => setFormData({ ...formData, numberOfSlides: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1a1a1a] mb-1">Style</label>
              <div className="flex flex-wrap gap-1">
                {styleOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, style: option.value as PresentationRequest["style"] })}
                    className={`px-2 py-1.5 rounded text-xs font-medium border ${
                      formData.style === option.value ? "border-[#D04A02] bg-[#fef3ef] text-[#D04A02]" : "border-[#e5e5e5] bg-white text-[#4a4a4a]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1a1a1a] mb-1">Additional instructions (optional)</label>
              <textarea
                rows={2}
                placeholder="e.g., Include data visualization..."
                className="w-full px-3 py-2 border border-[#e5e5e5] rounded-lg text-sm focus:ring-2 focus:ring-[#D04A02] focus:border-[#D04A02] bg-white resize-none"
                value={formData.additionalInstructions}
                onChange={(e) => setFormData({ ...formData, additionalInstructions: e.target.value })}
              />
            </div>
            <button
              type="submit"
              className="w-full px-4 py-2.5 bg-[#D04A02] hover:bg-[#b03e02] text-white font-semibold rounded-lg text-sm"
            >
              Generate presentation
            </button>
          </form>
        )}
      </AssistantStepsPanel>

      {/* Right: Preview section – content streaming + slide previews (no Preview/Download bar) */}
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

        {/* Idle: preview section shows placeholder */}
        {(status.status === "idle" || status.status === "error") && !presentation && (
          <div className="flex-1 flex items-center justify-center p-8 text-center text-[#4a4a4a] bg-white">
            <p className="text-sm">Preview will appear here once you generate a presentation.</p>
          </div>
        )}

        {/* Generating / Designing / Ready: preview section = placeholder or streaming + N slide sections (no top bar) */}
        {(status.status === "generating" || status.status === "designing" || status.status === "ready" || presentation) && (
          <div className="flex-1 flex flex-col min-h-0" ref={previewSectionRef}>
            <div
              ref={rightContentScrollRef}
              className={`flex-1 min-h-0 overflow-auto pt-4 ${isGenerating && streamedContent ? "flex flex-col" : ""}`}
            >
                  {/* Before streaming starts: placeholder with emoji */}
                  {isGenerating && !streamedContent && (
                    <div className="flex items-center justify-center p-8 min-h-full text-center text-[#4a4a4a]">
                      <div className="flex flex-col items-center gap-2">
                        <p className="text-5xl mb-1" aria-hidden>📽️</p>
                        <p className="text-lg font-medium flex items-center justify-center gap-0.5">
                          Preview will be displayed here
                          <span className="bubbling-dots ml-0.5" aria-hidden>
                            <span>.</span>
                            <span>.</span>
                            <span>.</span>
                          </span>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Streaming content – show when we have streamed content or when designing/ready with final content */}
                  {((isGenerating && streamedContent) || (presentation && (isDesigning || status.status === "ready"))) && (
                    <div className={`flex flex-col ${isGenerating && streamedContent ? "flex-1 min-h-0" : ""}`}>
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
                        <div
                          className={
                            isGenerating && streamedContent
                              ? "flex flex-col flex-1 min-h-0 border-b border-[#e5e5e5] px-4"
                              : "border-b border-[#e5e5e5] shrink-0 px-4"
                          }
                        >
                          <button
                            type="button"
                            onClick={() => setContentStreamCollapsed((c) => !c)}
                            className="w-full flex items-center justify-between py-3 text-left hover:bg-[#f9f9f9] transition-colors rounded-t-lg -mx-4 px-4"
                          >
                            <span className="text-xs font-semibold text-[#4a4a4a]">Content stream</span>
                            <svg
                              className={`w-4 h-4 text-[#4a4a4a] transition-transform ${contentStreamCollapsed ? "" : "rotate-180"}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {!contentStreamCollapsed && (
                            <div
                              className={
                                isGenerating && streamedContent ? "flex-1 min-h-0 flex flex-col pb-4" : "pb-4"
                              }
                            >
                              <div
                                ref={contentStreamBodyRef}
                                className={
                                  isGenerating && streamedContent
                                    ? "flex-1 min-h-0 overflow-auto bg-[#1a1a1a] rounded-lg p-3 font-mono text-xs text-[#e5e5e5] whitespace-pre-wrap break-words"
                                    : "bg-[#1a1a1a] rounded-lg p-3 max-h-[240px] overflow-auto font-mono text-xs text-[#e5e5e5] whitespace-pre-wrap break-words"
                                }
                              >
                                {streamedContent || "Waiting for content…"}
                                <div ref={contentEndRef} />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* N rows: individual slide previews – show when we have slide count (designing or ready) */}
                      {(isDesigning || status.status === "ready") && totalSlides > 0 && (
                        <div className="p-4 space-y-4 shrink-0">
                          <p className="text-xs font-semibold text-[#4a4a4a] shrink-0">
                            Slide previews
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
                    </div>
                  )}
            </div>
          </div>
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
