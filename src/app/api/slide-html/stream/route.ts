import { NextRequest } from "next/server";
import { streamSlideHtml } from "@/lib/htmlSlideAgent";
import { SlideContent, ModelProvider } from "@/types/presentation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slideContent, style, index, presentationTitle, modelProvider } = body as {
      slideContent: SlideContent;
      style: string;
      index: number;
      presentationTitle?: string;
      modelProvider?: ModelProvider;
    };

    if (!slideContent || typeof index !== "number") {
      return new Response(
        JSON.stringify({ error: "Missing slideContent or index" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamSlideHtml(
            slideContent,
            style ?? "professional",
            index,
            presentationTitle ?? "Presentation",
            modelProvider ?? "openai"
          )) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        } catch (e) {
          controller.error(e);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Slide HTML stream error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to stream slide HTML",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
