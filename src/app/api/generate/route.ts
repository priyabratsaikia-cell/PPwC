import { NextRequest, NextResponse } from "next/server";
import { generatePresentation } from "@/lib/gemini";
import { PresentationRequest } from "@/types/presentation";

export async function POST(request: NextRequest) {
  try {
    const body: PresentationRequest = await request.json();

    // Validate required fields
    if (!body.topic || !body.numberOfSlides || !body.audience || !body.style) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate number of slides
    if (body.numberOfSlides < 3 || body.numberOfSlides > 20) {
      return NextResponse.json(
        { error: "Number of slides must be between 3 and 20" },
        { status: 400 }
      );
    }

    const presentation = await generatePresentation(body);

    return NextResponse.json(presentation);
  } catch (error) {
    console.error("Generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate presentation" },
      { status: 500 }
    );
  }
}
