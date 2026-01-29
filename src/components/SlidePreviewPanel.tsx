"use client";

interface SlidePreviewPanelProps {
  children?: React.ReactNode;
  slideIndex?: number;
  totalSlides?: number;
}

export default function SlidePreviewPanel({ children, slideIndex = 1, totalSlides = 1 }: SlidePreviewPanelProps) {
  return (
    <div className="w-[420px] shrink-0 flex flex-col bg-white border-l border-[#e5e5e5]">
      <div className="flex-1 min-h-0 overflow-auto p-4 flex items-center justify-center bg-[#fafafa]">
        {children ?? (
          <div className="text-center text-[#4a4a4a] text-sm">
            <p className="font-medium text-[#1a1a1a] mb-1">Slide preview</p>
            <p>Content will appear here</p>
          </div>
        )}
      </div>
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-t border-[#e5e5e5] bg-white">
        <div className="flex items-center gap-2">
          <button type="button" className="p-1.5 rounded hover:bg-[#f5f5f5] text-[#4a4a4a]" aria-label="Previous slide">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-xs font-medium text-[#4a4a4a]">SLIDE {slideIndex} OF {totalSlides}</span>
          <button type="button" className="p-1.5 rounded hover:bg-[#f5f5f5] text-[#4a4a4a]" aria-label="Next slide">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className="p-1.5 rounded hover:bg-[#f5f5f5] text-[#4a4a4a]" aria-label="Zoom out">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
            </svg>
          </button>
          <span className="text-xs text-[#4a4a4a] min-w-[2.5rem] text-center">68%</span>
          <button type="button" className="p-1.5 rounded hover:bg-[#f5f5f5] text-[#4a4a4a]" aria-label="Zoom in">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button type="button" className="p-1.5 rounded hover:bg-[#f5f5f5] text-[#4a4a4a]" aria-label="Slide overview">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
