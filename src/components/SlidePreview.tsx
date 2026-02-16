"use client";

import { PresentationResponse, SlideContent } from "@/types/presentation";

interface SlidePreviewProps {
  presentation: PresentationResponse;
  style: string;
}

const themeColors: Record<string, { primary: string; secondary: string; accent: string }> = {
  professional: {
    primary: "bg-blue-900",
    secondary: "bg-blue-800",
    accent: "text-blue-500",
  },
  creative: {
    primary: "bg-purple-800",
    secondary: "bg-purple-700",
    accent: "text-purple-400",
  },
  minimal: {
    primary: "bg-zinc-900",
    secondary: "bg-zinc-800",
    accent: "text-zinc-400",
  },
  corporate: {
    primary: "bg-slate-900",
    secondary: "bg-blue-700",
    accent: "text-blue-400",
  },
};

function SlideCard({ slide, index, theme }: { slide: SlideContent; index: number; theme: typeof themeColors.professional }) {
  const isTitle = slide.layout === "title" || index === 0;
  const isSection = slide.layout === "section";
  const isClosing = slide.layout === "closing";
  const bullets = slide.bullets as string[] | undefined;

  if (isTitle || isSection || isClosing) {
    return (
      <div className={`aspect-video ${isSection ? theme.secondary : theme.primary} rounded-lg p-6 flex flex-col justify-center shadow-lg`}>
        <h3 className="text-white text-xl font-bold text-center mb-2">
          {slide.title}
        </h3>
        {bullets && bullets.length > 0 && !isSection && (
          <p className="text-gray-300 text-sm text-center">
            {bullets[0]}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="aspect-video bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
      <div className={`${theme.primary} px-4 py-3`}>
        <h3 className="text-white font-semibold truncate">{slide.title}</h3>
      </div>
      <div className="p-4">
        <ul className="space-y-2">
          {bullets?.slice(0, 4).map((bullet, i) => (
            <li key={i} className="flex items-start text-sm text-gray-700">
              <span className={`mr-2 ${theme.accent}`}>•</span>
              <span className="line-clamp-2">{bullet}</span>
            </li>
          ))}
          {bullets && bullets.length > 4 && (
            <li className="text-xs text-gray-400">
              +{bullets.length - 4} more points...
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

export default function SlidePreview({ presentation, style }: SlidePreviewProps) {
  const theme = themeColors[style] || themeColors.professional;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{presentation.title}</h2>
          <p className="text-gray-600 mt-1">{presentation.summary}</p>
        </div>
        <span className="px-3 py-1 text-sm font-medium bg-green-100 text-green-800 rounded-full">
          {presentation.slides.length} slides
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {presentation.slides.map((slide, index) => (
          <div key={index} className="relative group">
            <div className="absolute -top-2 -left-2 w-6 h-6 bg-purple-600 text-white text-xs font-bold rounded-full flex items-center justify-center z-10">
              {index + 1}
            </div>
            <SlideCard slide={slide} index={index} theme={theme} />
            {typeof slide.speakerNotes === "string" && slide.speakerNotes && (
              <div className="absolute inset-0 bg-black/80 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-4">
                <div className="text-white text-xs">
                  <p className="font-semibold mb-1">Speaker Notes:</p>
                  <p className="line-clamp-4">{String(slide.speakerNotes)}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
