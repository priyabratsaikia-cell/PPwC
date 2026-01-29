"use client";

import { useState } from "react";
import TopNav from "@/components/TopNav";
import PresentationForm from "@/components/PresentationForm";

export default function Home() {
  const [showHeader, setShowHeader] = useState(false);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {showHeader && (
        <TopNav projectName="Untitled Presentation" />
      )}
      <div className="flex-1 min-h-0 overflow-hidden">
        <PresentationForm onGenerateStart={() => setShowHeader(true)} />
      </div>
    </div>
  );
}
