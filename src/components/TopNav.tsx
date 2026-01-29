"use client";

import { useState, useCallback, useEffect } from "react";

const PWC_ORANGE = "#D04A02";

export default function TopNav({ projectName = "Untitled.pptx" }: { projectName?: string }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (typeof document === "undefined") return;
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // Fullscreen API not supported or denied
    }
  }, []);

  return (
    <header className="shrink-0 h-12 flex items-center justify-between px-4 bg-white border-b border-[#e5e5e5]">
      <div className="flex items-center gap-2">
        <h1 className="text-sm font-semibold text-[#1a1a1a]">AI Slide Deck Generator</h1>
        <button
          type="button"
          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[#4a4a4a] hover:bg-[#f5f5f5] border border-transparent hover:border-[#e5e5e5]"
        >
          <span className="truncate max-w-[180px]">{projectName}</span>
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleFullscreen}
          className="flex items-center justify-center w-8 h-8 rounded text-[#4a4a4a] hover:bg-[#f5f5f5] border border-transparent"
          aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
        >
          {isFullscreen ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 4.5H4.5M9 15v4.5M9 19.5H4.5M15 9h4.5M19.5 9V4.5M15 15h4.5M19.5 15v4.5" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            </svg>
          )}
        </button>
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#4a4a4a] hover:bg-[#f5f5f5] rounded border border-transparent"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          SHARE
        </button>
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded border-0"
          style={{ backgroundColor: PWC_ORANGE }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          EXPORT
        </button>
      </div>
    </header>
  );
}
