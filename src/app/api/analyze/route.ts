import { NextRequest, NextResponse } from "next/server";
import { streamLLM } from "@/lib/llm";
import type { ModelProvider, PromptAnalysis } from "@/types/presentation";

export const dynamic = "force-dynamic";

const ANALYSIS_SYSTEM_PROMPT = `You are an intelligent prompt analyzer for a PowerPoint presentation creation tool. Your job is to analyze the user's input and extract structured information.

You must determine:

1. **Has the user provided raw content/text that should be directly converted into slides?**
   - If the user pasted paragraphs of text, notes, article content, meeting notes, or any substantial body text → hasUserContent = true, and copy that content into userContent.
   - If the user is just giving a topic or instruction like "Create a presentation about AI" → hasUserContent = false.

2. **What is the topic?** Extract or infer the presentation topic from the prompt.

3. **Did the user specify the number of slides?** Look for phrases like "5 slides", "10 pages", "one slide", "single slide", etc. If found, extract the number. If not, set to null.

4. **Did the user specify the target audience?** Look for phrases like "for executives", "for students", "for developers", etc. If found, extract it. If not, set to null.

5. **Did the user specify a tone/style?** Look for "professional", "creative", "minimal", "corporate", or similar hints. Map to the closest option. If not mentioned, set to null.

Based on what is MISSING, generate appropriate follow-up questions. If the user has provided everything needed, return an empty questions array.

IMPORTANT RULES:
- If the user provides raw content for a SINGLE slide, set numberOfSlides to 1.
- If the user says "convert this to a PPT" with raw content but doesn't mention slides, suggest a reasonable number based on the content length.
- The assumptions object should contain sensible defaults for any missing fields.
- For style, only use: "professional", "creative", "minimal", or "corporate".

Return ONLY valid JSON in this exact format (no markdown, no code fence, no explanation):
{
  "hasUserContent": true or false,
  "topic": "extracted or inferred topic",
  "userContent": "the raw content text if hasUserContent is true, otherwise null",
  "numberOfSlides": number or null,
  "audience": "specified audience string" or null,
  "style": "professional" or "creative" or "minimal" or "corporate" or null,
  "questions": [
    {
      "field": "fieldName",
      "question": "Human-readable question to ask the user",
      "options": ["option1", "option2"],
      "default": "default value or number"
    }
  ],
  "assumptions": {
    "numberOfSlides": 8,
    "audience": "general business audience",
    "style": "professional"
  }
}`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, modelProvider = "gemini" } = body as {
      prompt: string;
      modelProvider?: ModelProvider;
    };

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    const userPrompt = `Analyze this user prompt for a PPT creation tool:\n\n"""${prompt}"""`;

    let fullText = "";
    for await (const chunk of streamLLM(
      modelProvider,
      ANALYSIS_SYSTEM_PROMPT,
      userPrompt
    )) {
      fullText += chunk;
    }

    // Extract JSON from the response
    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse analysis response as JSON");
    }

    const analysis: PromptAnalysis = JSON.parse(jsonMatch[0]);

    // Validate and sanitize the analysis
    if (!analysis.topic) {
      analysis.topic = "Untitled Presentation";
    }
    if (
      analysis.style &&
      !["professional", "creative", "minimal", "corporate"].includes(
        analysis.style
      )
    ) {
      analysis.style = null;
    }
    if (analysis.numberOfSlides !== null) {
      analysis.numberOfSlides = Math.max(
        1,
        Math.min(20, Math.round(analysis.numberOfSlides))
      );
    }
    if (!analysis.assumptions) {
      analysis.assumptions = {
        numberOfSlides: 8,
        audience: "general business audience",
        style: "professional",
      };
    }
    if (!Array.isArray(analysis.questions)) {
      analysis.questions = [];
    }

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Prompt analysis error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to analyze prompt",
      },
      { status: 500 }
    );
  }
}
