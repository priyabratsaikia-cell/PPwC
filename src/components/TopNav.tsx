"use client";

const PWC_ORANGE = "#D04A02";

export default function TopNav({ projectName = "Untitled.pptx" }: { projectName?: string }) {
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
        <div className="flex items-center gap-2 pl-2 border-l border-[#e5e5e5]">
          <span className="text-xs font-medium text-[#4a4a4a]">THEME:</span>
          <div className="flex gap-1">
            <button type="button" className="w-5 h-5 rounded-full border-2 border-[#e5e5e5]" style={{ backgroundColor: PWC_ORANGE }} aria-label="Orange theme" />
            <button type="button" className="w-5 h-5 rounded-full bg-[#1a1a1a] border-2 border-[#e5e5e5]" aria-label="Black theme" />
            <button type="button" className="w-5 h-5 rounded-full bg-[#dc2626] border-2 border-[#e5e5e5]" aria-label="Red theme" />
          </div>
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-1 text-xs text-[#4a4a4a] hover:bg-[#f5f5f5] rounded"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            CUSTOMIZE
          </button>
        </div>
      </div>
    </header>
  );
}
