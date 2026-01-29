import { GoogleGenerativeAI } from "@google/generative-ai";
import { SlideContent } from "@/types/presentation";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

const HTML_SLIDE_PROMPT = `You are a creative presentation designer (HTML Slide Agent). Your job is to turn slide content into a single, visually rich HTML slide.

Rules:
1. Output ONLY the HTML for one slide. No markdown, no code fence, no explanation.
2. The slide must be one root element: a <div> with class="slide" and data-slide-index set to the given index. Use inline styles only (no external CSS).
3. RESPONSIVE LAYOUT (critical): The slide is rendered in a fixed 960x540 viewport. Your HTML MUST be fully responsive and never get cut off.
   - Root slide div MUST have: width:100%; height:100%; min-height:100%; max-width:100%; box-sizing:border-box; overflow:hidden; (inline styles). No fixed pixel width/height on the root.
   - Use only relative/fluid sizing: percentages (width:100%, max-width:100%), em/rem for fonts (e.g. 1rem, 1.2em, 14px max for body). Never use min-width or width in px that exceed 960.
   - Use padding/margin in % or small values (e.g. padding: 2% 4%; margin: 0.5em). Avoid large fixed px that break layout on small viewports.
   - Tables/charts: use width:100%; table-layout:fixed or flex with flex:1; overflow:auto so they fit. No fixed column widths over 100%.
   - All inner containers: prefer max-width:100% and width:100% so content scales. This ensures every slide displays correctly without cutoff.
4. Design everything yourself based on the presentation style:
   - Choose the color scheme, typography, spacing, and layout to match the style (professional, creative, minimal, corporate).
   - Use shapes, icons (Unicode or simple SVG/CSS), dividers, cards, or any visual element where it helps.
   - If the content has bullets, render them well; if it has chartData or tableData, render charts or tables; if narrative, use typography and layout. Use whatever fits—do not limit yourself.
5. Be creative and polished. The slide should look like a modern, presentation-ready design. No rigid templates—vary layout and visuals per slide.
6. Keep the slide self-contained: all styles inline, no external resources.`;

/**
 * HTML Slide Agent: asks the model to generate one creative HTML slide from content + style.
 */
export async function generateSlideHtml(
  slideContent: SlideContent,
  style: string,
  index: number,
  presentationTitle: string
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-3-pro-preview" });

  const contentJson = JSON.stringify(slideContent, null, 2);

  const prompt = `${HTML_SLIDE_PROMPT}

Presentation style: ${style}
Presentation title: ${presentationTitle}
Slide index (0-based): ${index}

Slide content (JSON):
${contentJson}

Output only the single <div class="slide" ...>...</div> HTML for this slide.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().trim();

    // Strip markdown code fence if present
    const codeMatch = text.match(/```(?:html)?\s*([\s\S]*?)```/);
    if (codeMatch) text = codeMatch[1].trim();

    let html = text;

    // Ensure one root div with class "slide" and data-slide-index
    if (!html.includes('class="slide') && !html.includes("class='slide")) {
      html = `<div class="slide" data-slide-index="${index}" style="width:100%;height:100%;min-height:100%;max-width:100%;box-sizing:border-box;overflow:hidden;padding:2%;">${html}</div>`;
    } else if (!html.includes("data-slide-index")) {
      html = html.replace(/<div([^>]*class="[^"]*slide[^"]*")/i, `<div$1 data-slide-index="${index}"`);
    }

    return html;
  } catch (error) {
    console.error("HTML Slide Agent error:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to generate slide HTML"
    );
  }
}

/** Stream slide HTML generation; yields text chunks. */
export async function* streamSlideHtml(
  slideContent: SlideContent,
  style: string,
  index: number,
  presentationTitle: string
): AsyncGenerator<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-3-pro-preview" });
  const contentJson = JSON.stringify(slideContent, null, 2);
  const prompt = `${HTML_SLIDE_PROMPT}

Presentation style: ${style}
Presentation title: ${presentationTitle}
Slide index (0-based): ${index}

Slide content (JSON):
${contentJson}

Output only the single <div class="slide" ...>...</div> HTML for this slide.`;

  const result = await model.generateContentStream(prompt);
  for await (const chunk of result.stream) {
    const text = chunk.text?.() ?? "";
    if (text) yield text;
  }
}
