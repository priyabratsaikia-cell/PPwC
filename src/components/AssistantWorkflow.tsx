"use client";

import { useState } from "react";

export default function AssistantWorkflow({ children }: { children: React.ReactNode }) {
  const [activeTab, setActiveTab] = useState<"preview" | "outline">("preview");

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#f0f0f0]">
      <div className="shrink-0 px-4 pt-4 pb-2 border-b border-[#e5e5e5] bg-[#f0f0f0]">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#4a4a4a]">Assistant Workflow</h2>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#e5e5e5] text-[#4a4a4a] font-medium">V2.4</span>
        </div>
        <div className="flex gap-4 border-b border-[#e5e5e5] -mb-[1px]">
          <button
            type="button"
            onClick={() => setActiveTab("preview")}
            className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wide border-b-2 transition-colors ${
              activeTab === "preview" ? "text-[#D04A02] border-[#D04A02]" : "text-[#4a4a4a] border-transparent hover:text-[#1a1a1a]"
            }`}
          >
            PREVIEW
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("outline")}
            className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wide border-b-2 transition-colors ${
              activeTab === "outline" ? "text-[#D04A02] border-[#D04A02]" : "text-[#4a4a4a] border-transparent hover:text-[#1a1a1a]"
            }`}
          >
            OUTLINE
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
        <div className="shrink-0 px-4 py-2 text-[10px] text-[#9ca3af] border-t border-[#e5e5e5] bg-[#f0f0f0]">
          MODEL: gpt-5.2
        </div>
      </div>
    </div>
  );
}
