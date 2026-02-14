/**
 * Flexible slide content: the content agent can output any structure.
 * The HTML agent receives this and designs the slide creatively.
 */
export interface SlideContent {
  title: string;
  /** Free-form: bullets, narrative, chart/table data, stats, quotes, or any mix. */
  [key: string]: unknown;
}

export type ModelProvider = "openai" | "gemini" | "anthropic";

export interface PresentationRequest {
  topic: string;
  numberOfSlides: number;
  audience: string;
  style: "professional" | "creative" | "minimal" | "corporate";
  additionalInstructions?: string;
  modelProvider?: ModelProvider;
}

export interface PresentationResponse {
  title: string;
  slides: SlideContent[];
  summary: string;
}

export type GenerationStatus =
  | { status: "idle" }
  | { status: "generating"; message?: string }
  | { status: "designing"; message?: string; completedSlides?: number; totalSlides?: number }
  | { status: "assembling"; message?: string }
  | { status: "ready"; message?: string }
  | { status: "previewing" }
  | { status: "downloading"; message?: string }
  | { status: "error"; message?: string };
