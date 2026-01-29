import { NextRequest } from "next/server";
import { streamPresentationContent } from "@/lib/gemini";
import { PresentationRequest } from "@/types/presentation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as PresentationRequest;

  if (!body.topic || !body.numberOfSlides || !body.audience || !body.style) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
  }
  if (body.numberOfSlides < 3 || body.numberOfSlides > 20) {
    return new Response(JSON.stringify({ error: "Number of slides must be between 3 and 20" }), { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamPresentationContent(body)) {
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
      "Connection": "keep-alive",
    },
  });
}
