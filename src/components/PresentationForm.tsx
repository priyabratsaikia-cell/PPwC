"use client";

import { useState, useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from "react";
import { PresentationRequest, PresentationResponse, GenerationStatus, ModelProvider, PromptAnalysis, FollowUpQuestion } from "@/types/presentation";
import { assembleSlides } from "@/lib/assembly";
import { parseAndNormalizeContent } from "@/lib/parsePresentation";
import { exportSlidesToPptx } from "@/lib/pptxExport";
import SlidePreviewSection from "./SlidePreviewSection";
import AssistantStepsPanel from "./AssistantStepsPanel";

const STYLE_LABELS: Record<string, string> = {
  professional: "Professional",
  creative: "Creative",
  minimal: "Minimal",
  corporate: "Corporate",
};

const modelProviderOptions: { value: ModelProvider; label: string; model: string }[] = [
  { value: "openai", label: "OpenAI", model: "GPT-5.2" },
  { value: "gemini", label: "Google", model: "Gemini 3 Pro" },
  { value: "anthropic", label: "Anthropic", model: "Claude Opus 4.5" },
];

const FOLLOW_UP_TIMEOUT_SECONDS = 30;

// ── Motivational quotes shown while the agent is analyzing ──
const ANALYZING_QUOTES = [
  { emoji: "🎯", text: "We're here so you can focus on what truly matters" },
  { emoji: "🚀", text: "No more drag-and-drop overhead — just ideas to slides" },
  { emoji: "🧠", text: "Thinking through your content like a real consultant" },
  { emoji: "✨", text: "Turning your thoughts into polished presentations" },
  { emoji: "⚡", text: "Great ideas deserve great slides — we handle the rest" },
  { emoji: "🎨", text: "Crafting pixel-perfect slides while you sip your coffee" },
  { emoji: "📐", text: "Aligning, formatting, designing — all on autopilot" },
  { emoji: "💡", text: "Your expertise, our formatting — a perfect match" },
  { emoji: "🏆", text: "Presentation-ready in seconds, not hours" },
  { emoji: "🌟", text: "From raw ideas to boardroom-ready decks" },
  { emoji: "🤝", text: "Your AI co-pilot for every presentation" },
  { emoji: "📊", text: "Charts, layouts, narratives — we've got it all covered" },
  { emoji: "🎬", text: "Lights, camera, slides — your show is almost ready" },
  { emoji: "🧩", text: "Piecing together the perfect story for your audience" },
  { emoji: "🔮", text: "Reading between the lines of your prompt right now" },
];

function useRotatingQuote(active: boolean, intervalMs = 3000) {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * ANALYZING_QUOTES.length));
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!active) return;
    // Randomize starting index each time analysis starts
    setIndex(Math.floor(Math.random() * ANALYZING_QUOTES.length));
    setVisible(true);

    const timer = setInterval(() => {
      // Fade out
      setVisible(false);
      // After fade-out, switch quote and fade in
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % ANALYZING_QUOTES.length);
        setVisible(true);
      }, 400);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [active, intervalMs]);

  return { quote: ANALYZING_QUOTES[index], visible };
}

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

export type PresentationFormHandle = {
  exportPptx: () => Promise<void>;
};

type PresentationFormProps = {
  onGenerateStart?: () => void;
  onStatusChange?: (status: string) => void;
};

const PresentationForm = forwardRef<PresentationFormHandle, PresentationFormProps>(function PresentationForm({ onGenerateStart, onStatusChange }, ref) {
  // ── Form state ──
  const [prompt, setPrompt] = useState("");
  const [modelProvider, setModelProvider] = useState<ModelProvider>("gemini");

  // ── Agentic flow state ──
  const [analysis, setAnalysis] = useState<PromptAnalysis | null>(null);
  const [followUpAnswers, setFollowUpAnswers] = useState<Record<string, string | number>>({});
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSubmitRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Generation state ──
  const [status, setStatus] = useState<GenerationStatus>({ status: "idle" });
  const [streamedContent, setStreamedContent] = useState("");
  const [presentation, setPresentation] = useState<PresentationResponse | null>(null);
  const [slideHtmls, setSlideHtmls] = useState<(string | null)[]>([]);
  const [slideStreamingHtmls, setSlideStreamingHtmls] = useState<(string | null)[]>([]);
  const [assembledHtml, setAssembledHtml] = useState<string | null>(null);
  const [showReadyModal, setShowReadyModal] = useState(false);
  const [showTwoColumnLayout, setShowTwoColumnLayout] = useState(false);
  const [contentStreamCollapsed, setContentStreamCollapsed] = useState(false);
  const [isPptxGenerating, setIsPptxGenerating] = useState(false);
  const contentEndRef = useRef<HTMLDivElement>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const previewSectionRef = useRef<HTMLDivElement>(null);
  const rightContentScrollRef = useRef<HTMLDivElement>(null);
  const contentStreamBodyRef = useRef<HTMLDivElement>(null);
  const slideSectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Rotating quote during analysis AND pre-stream generating (hook must be called unconditionally)
  const showQuotes = status.status === "analyzing" || (status.status === "generating" && !streamedContent);
  const { quote: activeQuote, visible: quoteVisible } = useRotatingQuote(showQuotes);

  // Expose exportPptx to parent via ref
  useImperativeHandle(ref, () => ({
    exportPptx: handleExportPptxInternal,
  }));

  // Notify parent of status changes
  useEffect(() => {
    onStatusChange?.(status.status);
  }, [status.status, onStatusChange]);

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

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (autoSubmitRef.current) clearTimeout(autoSubmitRef.current);
    };
  }, []);

  // ── Step 1: Analyze the prompt (stays on input page) ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setContentStreamCollapsed(false);
    setStatus({ status: "analyzing", message: "Analyzing your prompt..." });
    setPresentation(null);
    setAssembledHtml(null);
    setStreamedContent("");
    setSlideHtmls([]);
    setSlideStreamingHtmls([]);
    setAnalysis(null);
    setFollowUpAnswers({});
    setCountdown(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, modelProvider }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Failed to analyze prompt");
      }

      const analysisResult: PromptAnalysis = await res.json();
      setAnalysis(analysisResult);

      // Skip questions entirely if the three key fields are already present
      const hasAllInfo =
        analysisResult.numberOfSlides != null &&
        analysisResult.audience != null &&
        analysisResult.style != null;

      if (analysisResult.questions.length > 0 && !hasAllInfo) {
        setStatus({ status: "asking", message: "Need a few more details..." });
        const defaults: Record<string, string | number> = {};
        for (const q of analysisResult.questions) {
          defaults[q.field] = q.default;
        }
        setFollowUpAnswers(defaults);
        startCountdown(analysisResult);
      } else {
        await proceedWithGeneration(analysisResult, {});
      }
    } catch (error) {
      setStatus({
        status: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      });
    }
  };

  // ── Countdown timer for follow-up questions ──
  const startCountdown = useCallback((analysisResult: PromptAnalysis) => {
    setCountdown(FOLLOW_UP_TIMEOUT_SECONDS);

    if (countdownRef.current) clearInterval(countdownRef.current);
    if (autoSubmitRef.current) clearTimeout(autoSubmitRef.current);

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    autoSubmitRef.current = setTimeout(() => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      setCountdown(null);
      const defaults: Record<string, string | number> = {};
      for (const q of analysisResult.questions) {
        defaults[q.field] = q.default;
      }
      proceedWithGeneration(analysisResult, defaults);
    }, FOLLOW_UP_TIMEOUT_SECONDS * 1000);
  }, []);

  // ── User submits follow-up answers ──
  const handleFollowUpSubmit = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (autoSubmitRef.current) clearTimeout(autoSubmitRef.current);
    setCountdown(null);
    if (analysis) {
      proceedWithGeneration(analysis, followUpAnswers);
    }
  };

  // ── User skips questions — proceed with AI assumptions ──
  const handleSkipQuestions = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (autoSubmitRef.current) clearTimeout(autoSubmitRef.current);
    setCountdown(null);
    if (analysis) {
      const defaults: Record<string, string | number> = {};
      for (const q of analysis.questions) {
        defaults[q.field] = q.default;
      }
      proceedWithGeneration(analysis, defaults);
    }
  };

  // ── Step 2: Generate content (NOW switch to two-column layout) ──
  const proceedWithGeneration = async (
    analysisResult: PromptAnalysis,
    answers: Record<string, string | number>
  ) => {
    onGenerateStart?.();
    setShowTwoColumnLayout(true);
    setStatus({ status: "generating", message: "Creating content..." });

    const numberOfSlides =
      (answers.numberOfSlides as number) ??
      analysisResult.numberOfSlides ??
      analysisResult.assumptions.numberOfSlides;

    const audience =
      (answers.audience as string) ??
      analysisResult.audience ??
      analysisResult.assumptions.audience;

    const style = (
      (answers.style as string) ??
      analysisResult.style ??
      analysisResult.assumptions.style
    ) as PresentationRequest["style"];

    const requestBody: PresentationRequest = {
      topic: analysisResult.topic,
      numberOfSlides,
      audience,
      style,
      modelProvider,
      hasUserContent: analysisResult.hasUserContent,
      userContent: analysisResult.userContent ?? undefined,
    };

    try {
      const res = await fetch("/api/generate/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
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
            style: requestBody.style,
            index,
            presentationTitle: data.title,
            modelProvider: requestBody.modelProvider,
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
    setAnalysis(null);
    setFollowUpAnswers({});
    setCountdown(null);
    setStatus({ status: "idle" });
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (autoSubmitRef.current) clearTimeout(autoSubmitRef.current);
  };

  const handleExportPptxInternal = async () => {
    if (!pdfContainerRef.current) return;
    setIsPptxGenerating(true);
    try {
      const title = presentation?.title ?? "presentation";
      const safeName = title.replace(/[^a-zA-Z0-9]/g, "_");
      await exportSlidesToPptx(pdfContainerRef.current, `${safeName}.pptx`);
    } catch (err) {
      console.error("PPTX export failed:", err);
      alert("Failed to export PPTX. Please try again.");
    } finally {
      setIsPptxGenerating(false);
    }
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

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (prompt.trim()) {
        handleSubmit(e as unknown as React.FormEvent);
      }
    }
  };

  const isAnalyzing = status.status === "analyzing";
  const isAsking = status.status === "asking";
  const isGenerating = status.status === "generating";
  const isDesigning = status.status === "designing";
  const totalSlides = slideHtmls.length;
  const topic = (presentation?.title ?? analysis?.topic) || "—";
  const tone = STYLE_LABELS[
    analysis?.style ??
    (followUpAnswers.style as string) ??
    analysis?.assumptions?.style ??
    "professional"
  ] ?? "Professional";

  const slideCountForTodos = presentation ? totalSlides : (analysis?.numberOfSlides ?? analysis?.assumptions?.numberOfSlides ?? 0);
  const todos: { id: string; label: string; done: boolean; current: boolean }[] = [
    { id: "analyze", label: "Prompt analysis", done: !!analysis, current: isAnalyzing },
    ...(isAsking ? [{ id: "asking", label: "Gathering details", done: false, current: true }] : []),
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

  // Whether the input bar should be in compact mode (analyzing / asking / error-before-generation)
  const isCompact = isAnalyzing || isAsking || (status.status === "error" && !showTwoColumnLayout);

  // ════════════════════════════════════════════════════════════════════════
  // HOME / INPUT PAGE — idle, analyzing, asking, error (before generation)
  // ════════════════════════════════════════════════════════════════════════
  if (!showTwoColumnLayout) {
    return (
      <div className="h-full flex flex-col min-h-0 bg-[#fafafa] overflow-hidden">
        {/* ── Top area: greeting (idle) or empty spacer (compact) ── */}
        {!isCompact ? (
          <div className="flex-1 overflow-auto flex items-center justify-center p-6">
            <div className="text-center max-w-lg text-[#4a4a4a]">
              <p className="text-4xl mb-4" aria-hidden>📊</p>
              <h2 className="text-xl font-semibold text-[#1a1a1a] mb-2">What would you like to present?</h2>
              <p className="text-sm">
                Just describe what you need — a topic, raw text, or detailed instructions.
                The agent will figure out the rest. If anything is unclear, it will ask you.
              </p>
            </div>
          </div>
        ) : (
          /* ── Analyzing / Asking spacer with rotating quotes ── */
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 overflow-hidden">
            {isAnalyzing && (
              <div className="flex flex-col items-center gap-5 max-w-md text-center">
                {/* Rotating emoji + quote */}
                <div
                  className={`transition-opacity duration-300 ease-in-out flex flex-col items-center gap-3 ${
                    quoteVisible ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <span className="text-5xl quote-float">{activeQuote.emoji}</span>
                  <p className="text-[15px] text-[#4a4a4a] font-medium leading-relaxed">
                    {activeQuote.text}
                  </p>
                </div>

                {/* Bubbling dots indicator */}
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="analyzing-dot" style={{ animationDelay: "0s" }} />
                  <span className="analyzing-dot" style={{ animationDelay: "0.15s" }} />
                  <span className="analyzing-dot" style={{ animationDelay: "0.3s" }} />
                </div>
                <p className="text-[11px] text-[#9ca3af]">Analyzing your prompt...</p>
              </div>
            )}
          </div>
        )}

        {/* ── Bottom area: input + optional questions panel ── */}
        <div className="shrink-0 px-4 sm:px-6 lg:px-8 py-4">
          <div className="max-w-2xl mx-auto relative">

            {/* ── Questions panel (asking state) — grows UP from input ── */}
            {isAsking && analysis && analysis.questions.length > 0 && (
              <div className="rounded-t-2xl border border-b-0 border-[#e5e5e5] bg-white px-5 pt-5 pb-4 shadow-sm animate-[slideIn_0.25s_ease-out]">
                {/* Header */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-full bg-[#fef3ef] flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-[#D04A02]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1a1a1a]">A few quick questions</p>
                    <p className="text-[11px] text-[#4a4a4a]">
                      Answer below or wait — auto-continuing
                      {countdown !== null && (
                        <span className="font-semibold text-[#D04A02] ml-1">in {countdown}s</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Countdown progress bar */}
                {countdown !== null && (
                  <div className="w-full h-1 bg-[#e5e5e5] rounded-full overflow-hidden mb-4">
                    <div
                      className="h-full bg-[#D04A02] rounded-full transition-all duration-1000 ease-linear"
                      style={{ width: `${(countdown / FOLLOW_UP_TIMEOUT_SECONDS) * 100}%` }}
                    />
                  </div>
                )}

                {/* What the agent understood */}
                {analysis.topic && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-4 text-[11px]">
                    <span className="px-2 py-0.5 rounded bg-[#f5f5f5] text-[#4a4a4a]">
                      Topic: <span className="font-medium text-[#1a1a1a]">{analysis.topic}</span>
                    </span>
                    {analysis.hasUserContent && (
                      <span className="px-2 py-0.5 rounded bg-[#fef3ef] text-[#D04A02] font-medium">
                        Content detected
                      </span>
                    )}
                    {analysis.numberOfSlides && (
                      <span className="px-2 py-0.5 rounded bg-[#f5f5f5] text-[#4a4a4a]">
                        {analysis.numberOfSlides} slides
                      </span>
                    )}
                    {analysis.audience && (
                      <span className="px-2 py-0.5 rounded bg-[#f5f5f5] text-[#4a4a4a]">
                        {analysis.audience}
                      </span>
                    )}
                    {analysis.style && (
                      <span className="px-2 py-0.5 rounded bg-[#f5f5f5] text-[#4a4a4a]">
                        {STYLE_LABELS[analysis.style]}
                      </span>
                    )}
                  </div>
                )}

                {/* Questions */}
                <div className="space-y-4">
                  {analysis.questions.map((q: FollowUpQuestion) => {
                    const currentVal = followUpAnswers[q.field];
                    const isCustom = q.options && q.options.length > 0 && !q.options.includes(String(currentVal));
                    return (
                      <div key={q.field}>
                        <label className="block text-xs font-semibold text-[#1a1a1a] mb-1.5">
                          {q.question}
                        </label>
                        {q.options && q.options.length > 0 ? (
                          <div className="space-y-2">
                            {/* Preset options */}
                            <div className="flex flex-wrap gap-1.5">
                              {q.options.map((opt) => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() =>
                                    setFollowUpAnswers((prev) => ({ ...prev, [q.field]: opt }))
                                  }
                                  className={`px-3 py-1.5 rounded text-xs font-medium border transition ${
                                    String(currentVal) === String(opt)
                                      ? "border-[#D04A02] bg-[#fef3ef] text-[#D04A02]"
                                      : "border-[#e5e5e5] bg-white text-[#4a4a4a] hover:border-[#D04A02]"
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                            {/* Custom input alongside options */}
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-[#9ca3af] shrink-0">or</span>
                              <input
                                type={typeof q.default === "number" ? "number" : "text"}
                                placeholder="Type your own..."
                                className={`flex-1 px-3 py-1.5 border rounded-lg text-xs focus:ring-2 focus:ring-[#D04A02] focus:border-[#D04A02] bg-[#fafafa] ${
                                  isCustom ? "border-[#D04A02]" : "border-[#e5e5e5]"
                                }`}
                                value={isCustom ? String(currentVal) : ""}
                                onChange={(e) =>
                                  setFollowUpAnswers((prev) => ({
                                    ...prev,
                                    [q.field]:
                                      typeof q.default === "number"
                                        ? parseInt(e.target.value) || q.default
                                        : e.target.value,
                                  }))
                                }
                                min={typeof q.default === "number" ? 1 : undefined}
                                max={typeof q.default === "number" ? 20 : undefined}
                              />
                            </div>
                          </div>
                        ) : (
                          <input
                            type={typeof q.default === "number" ? "number" : "text"}
                            className="w-full px-3 py-2 border border-[#e5e5e5] rounded-lg text-sm focus:ring-2 focus:ring-[#D04A02] focus:border-[#D04A02] bg-[#fafafa]"
                            value={followUpAnswers[q.field] ?? q.default}
                            onChange={(e) =>
                              setFollowUpAnswers((prev) => ({
                                ...prev,
                                [q.field]:
                                  typeof q.default === "number"
                                    ? parseInt(e.target.value) || q.default
                                    : e.target.value,
                              }))
                            }
                            min={typeof q.default === "number" ? 1 : undefined}
                            max={typeof q.default === "number" ? 20 : undefined}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Continue + Skip buttons */}
                <div className="flex items-center gap-2 mt-4">
                  <button
                    type="button"
                    onClick={handleFollowUpSubmit}
                    className="flex-1 px-4 py-2.5 bg-[#D04A02] hover:bg-[#b03e02] text-white font-semibold rounded-lg text-sm transition"
                  >
                    Continue
                  </button>
                  <button
                    type="button"
                    onClick={handleSkipQuestions}
                    className="px-4 py-2.5 border border-[#e5e5e5] hover:border-[#D04A02] text-[#4a4a4a] hover:text-[#D04A02] font-medium rounded-lg text-sm transition"
                  >
                    Skip
                  </button>
                </div>
              </div>
            )}

            {/* ── Error panel (pre-generation) ── */}
            {status.status === "error" && !showTwoColumnLayout && (
              <div className="rounded-t-2xl border border-b-0 border-[#e5e5e5] bg-white p-5 shadow-sm">
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-3">
                  <p className="text-red-700 font-medium text-sm">Error</p>
                  <p className="text-red-600 text-xs mt-1">{status.message}</p>
                </div>
                <button
                  onClick={handleReset}
                  className="w-full px-4 py-2.5 bg-[#D04A02] hover:bg-[#b03e02] text-white font-semibold rounded-lg text-sm"
                >
                  Try again
                </button>
              </div>
            )}

            {/* ── Input section ── */}
            {!isCompact ? (
              /* ─── Full input form (idle) ─── */
              <div className="rounded-2xl border border-[#e5e5e5] bg-white p-4 sm:p-5 shadow-sm">
                <form onSubmit={handleSubmit} className="space-y-3">
                  <textarea
                    ref={textareaRef}
                    required
                    rows={3}
                    placeholder='e.g., "Create a 5-slide presentation on AI in Healthcare for senior executives" or paste your raw content here...'
                    className="w-full px-4 py-3 border border-[#e5e5e5] rounded-lg text-sm bg-[#fafafa] focus:ring-2 focus:ring-[#D04A02] focus:border-[#D04A02] resize-none"
                    value={prompt}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                  />
                  <div className="flex items-center gap-2">
                    <select
                      value={modelProvider}
                      onChange={(e) => setModelProvider(e.target.value as ModelProvider)}
                      className="px-3 py-2.5 border border-[#e5e5e5] rounded-lg text-sm bg-[#fafafa] focus:ring-2 focus:ring-[#D04A02] focus:border-[#D04A02]"
                      aria-label="AI Model"
                    >
                      {modelProviderOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label} — {opt.model}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      disabled={!prompt.trim()}
                      className="flex-1 px-6 py-2.5 bg-[#D04A02] hover:bg-[#b03e02] disabled:bg-[#e5e5e5] disabled:text-[#9ca3af] text-white font-semibold rounded-lg transition text-sm"
                    >
                      Generate PPT
                    </button>
                  </div>
                  <p className="text-[11px] text-[#9ca3af] text-center">
                    Ctrl+Enter to submit. The agent will analyze your prompt and ask follow-up questions if needed.
                  </p>
                </form>
              </div>
            ) : (
              /* ─── Compact input bar (analyzing / asking) ─── */
              <div
                className={`${
                  isAsking || (status.status === "error" && !showTwoColumnLayout)
                    ? "rounded-b-2xl border border-t-0"
                    : "rounded-2xl border"
                } border-[#e5e5e5] bg-white px-4 py-3 shadow-sm`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    readOnly
                    value={prompt}
                    className="flex-1 min-w-0 px-3 py-2 bg-[#fafafa] border border-[#e5e5e5] rounded-lg text-sm text-[#4a4a4a] truncate cursor-default"
                  />
                  {/* Orange spinner */}
                  {isAnalyzing && (
                    <div className="w-8 h-8 shrink-0 rounded-full border-[3px] border-[#D04A02] border-t-transparent animate-spin" />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // TWO-COLUMN LAYOUT — during & after generation
  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Left: Assistant Steps panel */}
      <AssistantStepsPanel
        topic={topic}
        tone={tone}
        todos={todos}
        onSlideClick={scrollToSlide}
        canGoToSlide={canGoToSlide}
        modelLabel={modelProviderOptions.find((m) => m.value === modelProvider)?.model ?? "Gemini 3 Pro"}
      >
        {/* Error state: show inline retry */}
        {status.status === "error" && !presentation && (
          <div className="space-y-3">
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 font-medium text-sm">Error</p>
              <p className="text-red-600 text-xs mt-1">{status.message}</p>
            </div>
            <button
              onClick={handleReset}
              className="w-full px-4 py-2.5 bg-[#D04A02] hover:bg-[#b03e02] text-white font-semibold rounded-lg text-sm"
            >
              Try again
            </button>
          </div>
        )}
      </AssistantStepsPanel>

      {/* Right: Preview section */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {/* Error in main panel */}
        {status.status === "error" && (
          <div className="p-4 m-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 font-medium">Error</p>
            <p className="text-red-600 text-sm">{status.message}</p>
            <button
              onClick={handleReset}
              className="mt-2 text-sm text-red-700 underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Generating / Designing / Ready: streaming + slides */}
        {(isGenerating || isDesigning || status.status === "ready" || presentation) && (
          <div className="flex-1 flex flex-col min-h-0" ref={previewSectionRef}>
            <div
              ref={rightContentScrollRef}
              className={`flex-1 min-h-0 overflow-auto pt-4 ${isGenerating && streamedContent ? "flex flex-col" : ""}`}
            >
              {/* Before streaming starts: rotating quotes */}
              {isGenerating && !streamedContent && (
                <div className="flex items-center justify-center p-8 min-h-full text-center text-[#4a4a4a]">
                  <div className="flex flex-col items-center gap-5 max-w-md">
                    {/* Rotating emoji + quote */}
                    <div
                      className={`transition-opacity duration-300 ease-in-out flex flex-col items-center gap-3 ${
                        quoteVisible ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      <span className="text-5xl quote-float">{activeQuote.emoji}</span>
                      <p className="text-[15px] text-[#4a4a4a] font-medium leading-relaxed">
                        {activeQuote.text}
                      </p>
                    </div>

                    {/* Bubbling dots */}
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="analyzing-dot" style={{ animationDelay: "0s" }} />
                      <span className="analyzing-dot" style={{ animationDelay: "0.15s" }} />
                      <span className="analyzing-dot" style={{ animationDelay: "0.3s" }} />
                    </div>
                    <p className="text-xs text-[#9ca3af]">
                      {analysis?.hasUserContent
                        ? "Structuring your content into slides..."
                        : "Creating your presentation..."}
                    </p>
                  </div>
                </div>
              )}

              {/* Streaming content + slide previews */}
              {((isGenerating && streamedContent) || (presentation && (isDesigning || status.status === "ready"))) && (
                <div className={`flex flex-col ${isGenerating && streamedContent ? "flex-1 min-h-0" : ""}`}>
                  {/* Off-screen PPTX export container */}
                  {assembledHtml && (
                    <div
                      ref={pdfContainerRef}
                      className="fixed w-[960px]"
                      style={{ left: "-9999px", top: 0, pointerEvents: "none", zIndex: -1 }}
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

                  {/* Slide previews */}
                  {(isDesigning || status.status === "ready") && totalSlides > 0 && (
                    <div className="p-4 space-y-4 shrink-0">
                      <p className="text-xs font-semibold text-[#4a4a4a] shrink-0">Slide previews</p>
                      <div className="space-y-4">
                        {slideHtmls.map((html, index) => (
                          <div
                            key={index}
                            ref={(el) => { slideSectionRefs.current[index] = el; }}
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

        {/* Completion modal */}
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
});

export default PresentationForm;
