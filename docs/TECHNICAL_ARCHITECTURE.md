# PPT Agent — Technical Architecture

This document describes how PowerPoint (.pptx) files are generated end-to-end in the PPT Agent application.

---

## High-Level Flow

```
User (Browser) → Form Submit → API: Generate → OpenAI → JSON Response
                                                      ↓
User sees preview ← JSON ← API returns JSON
                                                      ↓
User clicks Download → API: Download → PptxGenJS → .pptx buffer → Browser download
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER (Client)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  page.tsx                                                                    │
│    └── PresentationForm.tsx                                                  │
│          • Form: topic, audience, numberOfSlides (3–20), style, optional    │
│          • POST /api/generate  →  receives PresentationResponse (JSON)      │
│          • POST /api/download  →  receives binary .pptx, triggers download  │
│          • SlidePreview.tsx (preview), LoadingState.tsx (loading UI)        │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                │ HTTP (JSON / binary)
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NEXT.JS SERVER (App Router)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  /api/generate/route.ts          /api/download/route.ts                      │
│    • Validate request body         • Validate presentation + style           │
│    • Call generatePresentation()   • Call createPptx()                       │
│    • Return JSON                   • Return buffer + attachment headers      │
└───────────────┬─────────────────────────────┬───────────────────────────────┘
                │                             │
                ▼                             ▼
┌───────────────────────────────┐   ┌─────────────────────────────────────────┐
│  lib/gemini.ts                 │   │  lib/pptx.ts                            │
│  • GoogleGenerativeAI client   │   │  • PptxGenJS instance                   │
│  • Model: gpt-5.2              │   │  • Theme colors by style                │
│  • Build prompt from request   │   │  • Slide masters (title, content)       │
│  • Parse JSON from AI response │   │  • One slide per SlideContent            │
│  • Return PresentationResponse │   │  • write({ outputType: "nodebuffer" })   │
└───────────────┬───────────────┘   └─────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────┐
│  OpenAI Responses API         │
│  • Receives text prompt       │
│  • Returns JSON-shaped text   │
└───────────────────────────────┘
```

---

## Step-by-Step: How a PPT Is Generated

### Phase 1: User Input and Content Generation

| Step | Where | What Happens |
|------|--------|----------------|
| **1** | `PresentationForm.tsx` | User fills form: **topic**, **audience**, **number of slides** (3–20), **style** (professional / creative / minimal / corporate), optional **additional instructions**. Clicks “Generate Presentation”. |
| **2** | `PresentationForm.tsx` → `handleSubmit` | Client sends `POST /api/generate` with body: `PresentationRequest` (topic, numberOfSlides, audience, style, additionalInstructions?). |
| **3** | `api/generate/route.ts` | Server validates: required fields present, `numberOfSlides` between 3 and 20. Returns 400 if invalid. |
| **4** | `api/generate/route.ts` | Calls `generatePresentation(body)` from `lib/gemini.ts`. |
| **5** | `lib/gemini.ts` | Builds a single **prompt** string: system instructions + “Create an N-slide presentation about: &lt;topic&gt;”, audience, style description, optional instructions, and strict JSON output format. |
| **6** | `lib/gemini.ts` | Calls OpenAI `client.responses.create({ model: "gpt-5.2", input: prompt })`. |
| **7** | OpenAI API | Generates text that includes a JSON object matching the requested structure. |
| **8** | `lib/gemini.ts` | Extracts JSON with regex `/\{[\s\S]*\}/`, parses it, validates `title` and `slides` array, normalizes each slide (title, bullets, speakerNotes, layout). Returns `PresentationResponse`. |
| **9** | `api/generate/route.ts` | Returns `PresentationResponse` as JSON to the client. |
| **10** | `PresentationForm.tsx` | Stores response in state, sets status to `previewing`, and renders `SlidePreview` with the presentation data. |

### Phase 2: Preview (No File Yet)

| Step | Where | What Happens |
|------|--------|----------------|
| **11** | `SlidePreview.tsx` | Renders slides in the browser using the same `PresentationResponse` (title, slides with title, bullets, speakerNotes, layout). No .pptx file exists yet. |

### Phase 3: PPTX Creation and Download

| Step | Where | What Happens |
|------|--------|----------------|
| **12** | `PresentationForm.tsx` → `handleDownload` | User clicks “Download PowerPoint”. Client sends `POST /api/download` with body: `{ presentation: PresentationResponse, style: string }`. |
| **13** | `api/download/route.ts` | Validates `presentation` and `presentation.slides`. Calls `createPptx(presentation, style)` from `lib/pptx.ts`. |
| **14** | `lib/pptx.ts` | Creates a new `PptxGenJS()` instance, selects **theme** (hex colors) by `style`. Sets metadata: author, title, subject, company. |
| **15** | `lib/pptx.ts` | Defines slide masters: **TITLE_SLIDE** (full-width colored background, title placeholder), **CONTENT_SLIDE** (header bar + title area). |
| **16** | `lib/pptx.ts` | For each item in `presentation.slides`: adds a slide with `pptx.addSlide()`, then based on `layout` and index: **title** (first slide): colored background, centered title, optional subtitle from first bullet; **section**: colored background, centered section title; **closing**: colored background, title, optional bullets; **content** (default): header bar, slide title, bullet list with theme styling. Adds speaker notes when `speakerNotes` is present. |
| **17** | `lib/pptx.ts` | Calls `pptx.write({ outputType: "nodebuffer" })`, returns a `Buffer`. |
| **18** | `api/download/route.ts` | Converts buffer to `Uint8Array`, returns `NextResponse` with `Content-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation` and `Content-Disposition: attachment; filename="...pptx"`. |
| **19** | `PresentationForm.tsx` | Receives blob, creates object URL, programmatically clicks an `<a download="...">` to save the file, revokes the URL. User gets a .pptx file on disk. |

---

## Data Models (Types)

- **`PresentationRequest`** (input): `topic`, `numberOfSlides`, `audience`, `style`, optional `additionalInstructions`.
- **`SlideContent`**: `title`, `bullets[]`, optional `speakerNotes`, optional `layout` (title | content | section | closing).
- **`PresentationResponse`** (AI + API output): `title`, `slides: SlideContent[]`, `summary`.

These types are shared across the form, API routes, OpenAI, and PptxGenJS so the same structure flows from user input → AI → preview → file generation.

---

## Key Technologies

| Layer | Technology |
|-------|------------|
| Frontend | React, Next.js App Router, Tailwind CSS |
| API | Next.js Route Handlers (`route.ts` in `app/api/`) |
| AI content | OpenAI SDK, model: `gpt-5.2` (Responses API) |
| PPTX file | PptxGenJS — in-memory slide construction, then `write("nodebuffer")` |
| Env | `OPENAI_API_KEY` in `.env` / `.env.local` (used by `lib/gemini.ts` and `lib/htmlSlideAgent.ts`) |

---

## File Map

| Path | Responsibility |
|------|----------------|
| `src/app/page.tsx` | Landing page; renders `PresentationForm`. |
| `src/components/PresentationForm.tsx` | Form state, calls `/api/generate` and `/api/download`, preview/download UI. |
| `src/components/SlidePreview.tsx` | Renders slide list from `PresentationResponse` in the browser. |
| `src/components/LoadingState.tsx` | Loading UI during generation. |
| `src/app/api/generate/route.ts` | Validates request, calls OpenAI flow, returns JSON. |
| `src/app/api/download/route.ts` | Validates body, builds PPTX, returns binary response. |
| `src/lib/gemini.ts` | Prompt building, OpenAI API call, JSON parse and normalization. |
| `src/lib/pptx.ts` | PptxGenJS setup, themes, slide layout logic, buffer output. |
| `src/types/presentation.ts` | `PresentationRequest`, `PresentationResponse`, `SlideContent`, `GenerationStatus`. |

---

## Summary

1. **Content** is created by **OpenAI** from a structured prompt; the model returns **JSON** that is parsed and normalized into `PresentationResponse`.
2. **Preview** is pure React: the same JSON is rendered in the browser; no .pptx is created until the user downloads.
3. **File** is created only on **Download**: the server uses **PptxGenJS** to turn `PresentationResponse` + `style` into a binary .pptx and sends it with attachment headers so the browser saves the file.

End-to-end: **Form → Generate API → OpenAI → JSON → Preview → Download API → PptxGenJS → .pptx file.**
