import { GoogleGenerativeAI } from "@google/generative-ai";
import { PresentationRequest, PresentationResponse, SlideContent } from "@/types/presentation";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

const SYSTEM_PROMPT = `You are an Associate working at PwC. You act as a consultant: research the topic thoroughly, think critically, and produce content that is insightful, evidence-based, and suitable for client or internal presentations. Your job is to generate rich, slide-wise content for a presentation—not limited to bullet points or charts. Use whatever fits each slide best: bullets, narrative, data for charts or tables, key stats, quotes, comparisons, timelines, or any mix. Be creative and varied while maintaining a professional, consultant-grade tone.

For each slide, provide:
- title: a clear slide title
- layout: one of "title" (first slide), "section" (section divider), "closing" (last slide), "content" (everything else)
- Any other fields that fit the slide: bullets (array of strings), narrative (paragraph), chartData (type, labels, values, title), tableData (headers, rows), highlight (key stat or quote), or anything else that helps the designer render the slide well.

Output ONLY valid JSON in this shape (you may add more fields per slide as needed):
{
  "title": "Presentation Title",
  "summary": "Brief summary of the presentation",
  "slides": [
    {
      "title": "Slide Title",
      "layout": "title|content|section|closing",
      "bullets": ["optional"],
      "narrative": "optional",
      "chartData": { "type": "bar|pie|line", "labels": [], "values": [], "title": "optional" },
      "tableData": { "headers": [], "rows": [] },
      "speakerNotes": "optional"
    }
  ]
}`;

function buildContentPrompt(request: PresentationRequest): string {
  const styleHint = request.style;
  return `${SYSTEM_PROMPT}

Create a ${request.numberOfSlides}-slide presentation about: "${request.topic}"

Target audience: ${request.audience}
Presentation style (for tone and content choice): ${styleHint}
${request.additionalInstructions ? `Additional requirements: ${request.additionalInstructions}` : ""}

Rules:
- First slide: layout "title". Last slide: layout "closing". Use "section" for section dividers where it helps.
- Vary content: use bullets, narrative, charts, tables, highlights, or combinations where appropriate. Do not limit yourself to bullets only.
- Research and write as a PwC consultant: clear, credible, and client-ready.
- Output only the JSON object, no markdown or explanation.`;
}

/** Stream content generation; yields text chunks. */
export async function* streamPresentationContent(
  request: PresentationRequest
): AsyncGenerator<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-3-pro-preview" });
  const prompt = buildContentPrompt(request);
  const result = await model.generateContentStream(prompt);
  for await (const chunk of result.stream) {
    const text = chunk.text?.() ?? "";
    if (text) yield text;
  }
}

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

export async function generatePresentation(
  request: PresentationRequest
): Promise<PresentationResponse> {
  try {
    let fullText = "";
    for await (const chunk of streamPresentationContent(request)) {
      fullText += chunk;
    }
    return parseAndNormalizeContent(fullText);
  } catch (error) {
    console.error("Gemini API error:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to generate presentation"
    );
  }
}
