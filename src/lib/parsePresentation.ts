/**
 * Pure parsing/normalization for AI presentation JSON.
 * Safe to import from client components (no Node/OpenAI deps).
 */
import type { PresentationResponse, SlideContent } from "@/types/presentation";

export function parseAndNormalizeContent(fullText: string): PresentationResponse {
  const jsonMatch = fullText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse AI response as JSON");
  }
  const parsed = JSON.parse(jsonMatch[0]) as PresentationResponse;
  if (!parsed.title || !Array.isArray(parsed.slides)) {
    throw new Error("Invalid presentation structure");
  }
  parsed.slides = parsed.slides.map((slide: SlideContent, index: number) => ({
    ...slide,
    title: slide.title ?? `Slide ${index + 1}`,
    layout: slide.layout ?? (index === 0 ? "title" : index === parsed.slides.length - 1 ? "closing" : "content"),
  }));
  return parsed;
}
