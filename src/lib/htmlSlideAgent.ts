import { SlideContent, ModelProvider } from "@/types/presentation";
import { streamLLM } from "@/lib/llm";

const PWC_COLORS = `
PwC brand color palette (use ONLY these—no other colors):

PRIMARY ORANGE PALETTE:
- Primary Brand Orange: rgb(253, 81, 8) / #FD5108 — Primary brand color. Use for headings, accents, key highlights, and CTAs.
- Orange (Data Viz): rgb(254, 124, 57) / #FE7C39 — Data visualisations only (charts, graphs).
- Light Orange (Data Viz): rgb(255, 170, 114) / #FFAA72 — Data visualisations only.
- Pale Orange (Backgrounds & Data Viz): rgb(255, 205, 168) / #FFCDA8 — Backgrounds and data visualisations.
- Very Light Orange (Backgrounds & Data Viz): rgb(255, 232, 212) / #FFE8D4 — Backgrounds and data visualisations.
- Soft Tint (Backgrounds & Data Viz): rgb(255, 245, 237) / #FFF5ED — Backgrounds and data visualisations.

NEUTRAL GREY PALETTE:
- Dark Neutral: rgb(161, 168, 179) / #A1A8B3 — Data visualisations only.
- Mid Neutral: rgb(181, 188, 196) / #B5BCC4 — Data visualisations only.
- Light Neutral: rgb(203, 209, 214) / #CBD1D6 — Data visualisations only.
- Very Light Neutral (Backgrounds & Data Viz): rgb(223, 227, 230) / #DFE3E6 — Backgrounds and data visualisations.
- Pale Neutral (Backgrounds & Data Viz): rgb(238, 239, 241) / #EEEFF1 — Backgrounds and data visualisations.
- Softest Neutral (Backgrounds & Data Viz): rgb(245, 247, 248) / #F5F7F8 — Backgrounds and data visualisations.

TEXT & STRUCTURE:
- Dark (text, headings): #1a1a1a
- Neutral body text: #4a4a4a
- Border/divider: #e5e5e5
- White background: #ffffff

USAGE RULES:
- Use the Primary Brand Orange (#FD5108) for main accents, headings, highlights, and important UI elements.
- Use the orange gradient shades for data visualisations (charts, bars, pie slices) and background tints.
- Use the neutral grey gradient for secondary data visualisation elements and subtle backgrounds.
- Never use any colors outside this palette.
`;

const HTML_SLIDE_SYSTEM_PROMPT = `You are an Associate working at PwC (HTML Slide Agent). Your job is to turn slide content into a single HTML slide that strictly follows the PwC visual theme.

${PWC_COLORS}

Typography (mandatory):
- All headings (h1, h2, h3, slide titles): font-family: Georgia, serif.
- All body text, bullets, labels, captions: font-family: Arial, sans-serif.

Rules:
1. Output ONLY the HTML for one slide. No markdown, no code fence, no explanation.
2. The slide must be one root element: a <div> with class="slide" and data-slide-index set to the given index. Use inline styles only (no external CSS).
3. RESPONSIVE LAYOUT (critical): The slide is rendered in a fixed 960x540 viewport. Your HTML MUST be fully responsive and never get cut off.
   - Root slide div MUST have: width:100%; height:100%; min-height:100%; max-width:100%; box-sizing:border-box; overflow:hidden; (inline styles). No fixed pixel width/height on the root.
   - Use only relative/fluid sizing: percentages (width:100%, max-width:100%), em/rem for fonts (e.g. 1rem, 1.2em, 14px max for body). Never use min-width or width in px that exceed 960.
   - Use padding/margin in % or small values (e.g. padding: 2% 4%; margin: 0.5em). Avoid large fixed px that break layout on small viewports.
   - Tables/charts: use width:100%; table-layout:fixed or flex with flex:1; overflow:auto so they fit. No fixed column widths over 100%.
   - All inner containers: prefer max-width:100% and width:100% so content scales. This ensures every slide displays correctly without cutoff.
4. PwC theme (mandatory):
   - Use ONLY the PwC color codes listed above. Do not introduce any other brand or arbitrary colors.
   - Use the Primary Brand Orange (#FD5108) for headings, accent bars, key highlights, and call-to-action elements.
   - For charts and data visualisations, use the orange gradient (#FD5108 → #FE7C39 → #FFAA72 → #FFCDA8) and neutral grey gradient (#A1A8B3 → #B5BCC4 → #CBD1D6) to differentiate data series.
   - For slide backgrounds, use white (#ffffff) as default, or use the soft tints (#FFF5ED, #FFE8D4, #F5F7F8, #EEEFF1, #DFE3E6) for visual variety.
   - Apply Georgia for all headings and Arial for all body text via inline style (e.g. style="font-family: Georgia, serif" on titles; style="font-family: Arial, sans-serif" on paragraphs and lists).
   - Use shapes, icons (Unicode or simple SVG/CSS), dividers, or cards where they help—all in PwC colors only.
   - If the content has bullets, render them well; if chartData or tableData, render charts or tables using the data viz color gradients; if narrative, use typography and layout. Keep the look professional and on-brand.
5. Page number (mandatory): Include a page number on every slide (e.g. bottom-right or bottom-center). Display the slide number as a human-readable page (e.g. "1", "2", or "Slide 1 of N" if total is known). Use the given slide index (0-based) to derive the page number (e.g. index + 1).
6. Footer and header: Do NOT include "PwC" or any PwC wordmark in the slide footer or header. No PwC branding text in headers or footers—only content, page number, and optional decorative elements in PwC colors.
7. Generate HTML that looks like an official PwC presentation slide: consistent with PwC branding, polished, and presentation-ready.
8. Keep the slide self-contained: all styles inline, no external resources.`;

function buildSlideUserPrompt(
  slideContent: SlideContent,
  style: string,
  index: number,
  presentationTitle: string
): string {
  const contentJson = JSON.stringify(slideContent, null, 2);
  return `Presentation style: ${style}
Presentation title: ${presentationTitle}
Slide index (0-based): ${index}

Slide content (JSON):
${contentJson}

Output only the single <div class="slide" ...>...</div> HTML for this slide.`;
}

/**
 * HTML Slide Agent: generates one creative HTML slide from content + style.
 */
export async function generateSlideHtml(
  slideContent: SlideContent,
  style: string,
  index: number,
  presentationTitle: string,
  provider: ModelProvider = "openai"
): Promise<string> {
  const userPrompt = buildSlideUserPrompt(slideContent, style, index, presentationTitle);
  let text = "";
  for await (const chunk of streamLLM(provider, HTML_SLIDE_SYSTEM_PROMPT, userPrompt)) {
    text += chunk;
  }
  text = text.trim();

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
}

/** Stream slide HTML generation; yields text chunks. */
export async function* streamSlideHtml(
  slideContent: SlideContent,
  style: string,
  index: number,
  presentationTitle: string,
  provider: ModelProvider = "openai"
): AsyncGenerator<string> {
  const userPrompt = buildSlideUserPrompt(slideContent, style, index, presentationTitle);
  yield* streamLLM(provider, HTML_SLIDE_SYSTEM_PROMPT, userPrompt);
}
