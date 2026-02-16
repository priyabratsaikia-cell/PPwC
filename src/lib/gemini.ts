import { PresentationRequest, PresentationResponse, ModelProvider } from "@/types/presentation";
import { parseAndNormalizeContent } from "@/lib/parsePresentation";
import { streamLLM } from "@/lib/llm";

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

const STRUCTURE_CONTENT_SYSTEM_PROMPT = `You are an Associate working at PwC. You act as a consultant who is expert at converting raw text, notes, articles, or any unstructured content into well-structured presentation slides. Your job is to take the user's raw content and organize it into slide-wise content for a presentation.

Rules:
- Preserve the user's key information and data faithfully. Do NOT invent new facts or statistics.
- Reorganize, rephrase, and structure the content so it works well on slides.
- Use whatever fits each slide best: bullets, narrative, data for charts or tables, key stats, quotes, comparisons, timelines, or any mix.
- If the content is short (one paragraph or a few points), create just the number of slides requested—even a single slide is fine.
- Maintain a professional, consultant-grade tone.

For each slide, provide:
- title: a clear slide title
- layout: one of "title" (first slide), "section" (section divider), "closing" (last slide), "content" (everything else). For single-slide presentations, use "content".
- Any other fields that fit the slide: bullets (array of strings), narrative (paragraph), chartData, tableData, highlight, or anything else useful.

Output ONLY valid JSON in this shape:
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

function buildUserPrompt(request: PresentationRequest): string {
  const styleHint = request.style;
  return `Create a ${request.numberOfSlides}-slide presentation about: "${request.topic}"

Target audience: ${request.audience}
Presentation style (for tone and content choice): ${styleHint}
${request.additionalInstructions ? `Additional requirements: ${request.additionalInstructions}` : ""}

Rules:
- First slide: layout "title". Last slide: layout "closing". Use "section" for section dividers where it helps.
- Vary content: use bullets, narrative, charts, tables, highlights, or combinations where appropriate. Do not limit yourself to bullets only.
- Research and write as a PwC consultant: clear, credible, and client-ready.
- Output only the JSON object, no markdown or explanation.`;
}

function buildUserPromptFromContent(request: PresentationRequest): string {
  const slideCount = request.numberOfSlides;
  const isSingle = slideCount === 1;

  return `Convert the following raw content into ${slideCount} presentation slide${isSingle ? "" : "s"}.

Topic: "${request.topic}"
Target audience: ${request.audience}
Presentation style: ${request.style}
${request.additionalInstructions ? `Additional requirements: ${request.additionalInstructions}` : ""}

Raw content to structure into slides:
"""
${request.userContent}
"""

Rules:
${isSingle
    ? `- Create exactly 1 slide with layout "content". Make it comprehensive and well-designed.`
    : `- Create exactly ${slideCount} slides. First slide: layout "title". Last slide: layout "closing". Use "section" for section dividers where it helps.`
  }
- Preserve the user's key information faithfully—do not invent facts.
- Reorganize and rephrase for slide-friendly presentation format.
- Vary slide content: use bullets, narrative, charts, tables, highlights, or combinations as appropriate.
- Output only the JSON object, no markdown or explanation.`;
}

/** Stream content generation; yields text chunks. */
export async function* streamPresentationContent(
  request: PresentationRequest
): AsyncGenerator<string> {
  const provider: ModelProvider = request.modelProvider ?? "openai";

  if (request.hasUserContent && request.userContent) {
    const userPrompt = buildUserPromptFromContent(request);
    yield* streamLLM(provider, STRUCTURE_CONTENT_SYSTEM_PROMPT, userPrompt);
  } else {
    const userPrompt = buildUserPrompt(request);
    yield* streamLLM(provider, SYSTEM_PROMPT, userPrompt);
  }
}

export { parseAndNormalizeContent } from "@/lib/parsePresentation";

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
    console.error("LLM API error:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to generate presentation"
    );
  }
}
