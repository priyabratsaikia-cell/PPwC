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

// ── Legacy request shape (still used internally after analysis) ──────────

export interface PresentationRequest {
  topic: string;
  numberOfSlides: number;
  audience: string;
  style: "professional" | "creative" | "minimal" | "corporate";
  additionalInstructions?: string;
  modelProvider?: ModelProvider;
  /** When the user supplies raw content, this holds it so the content agent
   *  structures it into slides instead of generating from scratch. */
  userContent?: string;
  /** Signals the content agent to structure user-provided text. */
  hasUserContent?: boolean;
}

export interface PresentationResponse {
  title: string;
  slides: SlideContent[];
  summary: string;
}

// ── Agentic prompt analysis types ────────────────────────────────────────

export interface FollowUpQuestion {
  field: string;
  question: string;
  options?: string[];
  default: string | number;
}

export interface PromptAnalysis {
  /** True when the user pasted raw text/content to be converted into slides. */
  hasUserContent: boolean;
  /** Extracted or inferred topic. */
  topic: string;
  /** The raw content the user provided (if hasUserContent is true). */
  userContent?: string;
  /** Number of slides if explicitly mentioned by user, otherwise null. */
  numberOfSlides: number | null;
  /** Target audience if mentioned, otherwise null. */
  audience: string | null;
  /** Style/tone if mentioned, otherwise null. */
  style: "professional" | "creative" | "minimal" | "corporate" | null;
  /** Follow-up questions the agent wants to ask the user. */
  questions: FollowUpQuestion[];
  /** Default assumptions the agent will use if the user doesn't answer. */
  assumptions: {
    numberOfSlides: number;
    audience: string;
    style: "professional" | "creative" | "minimal" | "corporate";
  };
}

// ── Generation status ────────────────────────────────────────────────────

export type GenerationStatus =
  | { status: "idle" }
  | { status: "analyzing"; message?: string }
  | { status: "asking"; message?: string }
  | { status: "generating"; message?: string }
  | { status: "designing"; message?: string; completedSlides?: number; totalSlides?: number }
  | { status: "assembling"; message?: string }
  | { status: "ready"; message?: string }
  | { status: "previewing" }
  | { status: "downloading"; message?: string }
  | { status: "error"; message?: string };
