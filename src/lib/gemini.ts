import OpenAI from "openai";
import { PresentationRequest, PresentationResponse } from "@/types/presentation";
import { parseAndNormalizeContent } from "@/lib/parsePresentation";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = "gpt-5.2";

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
  const prompt = buildContentPrompt(request);
  const stream = await client.responses.create({
    model: MODEL,
    input: prompt,
    stream: true,
  });
  for await (const event of stream) {
    if (event.type === "response.output_text.delta" && event.delta) {
      yield event.delta;
    }
  }
}

export { parseAndNormalizeContent } from "@/lib/parsePresentation";

export async function generatePresentation(
  request: PresentationRequest
): Promise<PresentationResponse> {
  try {
    const prompt = buildContentPrompt(request);
    const response = await client.responses.create({
      model: MODEL,
      input: prompt,
    });
    const fullText = response.output_text ?? "";
    return parseAndNormalizeContent(fullText);
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to generate presentation"
    );
  }
}
