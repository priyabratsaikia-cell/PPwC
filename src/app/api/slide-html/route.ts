import { NextRequest, NextResponse } from "next/server";
import { generateSlideHtml } from "@/lib/htmlSlideAgent";
import { SlideContent } from "@/types/presentation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slideContent, style, index, presentationTitle } = body as {
      slideContent: SlideContent;
      style: string;
      index: number;
      presentationTitle?: string;
    };

    if (!slideContent || typeof index !== "number") {
      return NextResponse.json(
        { error: "Missing slideContent or index" },
        { status: 400 }
      );
    }

    const html = await generateSlideHtml(
      slideContent,
      style ?? "professional",
      index,
      presentationTitle ?? "Presentation"
    );
    return NextResponse.json({ html });
  } catch (error) {
    console.error("Slide HTML error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate slide HTML" },
      { status: 500 }
    );
  }
}
