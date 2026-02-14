"use client";

import { useState, useRef, useCallback } from "react";
import TopNav from "@/components/TopNav";
import PresentationForm from "@/components/PresentationForm";
import type { PresentationFormHandle } from "@/components/PresentationForm";

export default function Home() {
  const [showHeader, setShowHeader] = useState(false);
  const [generationStatus, setGenerationStatus] = useState("idle");
  const formRef = useRef<PresentationFormHandle>(null);

  const handleExport = useCallback(() => {
    formRef.current?.exportPptx();
  }, []);

  const isExportEnabled = generationStatus === "ready";

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {showHeader && (
        <TopNav
          projectName="Untitled Presentation"
          onExport={handleExport}
          exportDisabled={!isExportEnabled}
        />
      )}
      <div className="flex-1 min-h-0 overflow-hidden">
        <PresentationForm
          ref={formRef}
          onGenerateStart={() => setShowHeader(true)}
          onStatusChange={setGenerationStatus}
        />
      </div>
    </div>
  );
}
