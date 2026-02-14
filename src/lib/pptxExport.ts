/**
 * PPTX Export: uses dom-to-pptx loaded from CDN.
 * Passes an array of .slide elements so each becomes its own slide in the deck.
 */

const DOM_TO_PPTX_CDN =
  "https://cdn.jsdelivr.net/npm/dom-to-pptx@latest/dist/dom-to-pptx.bundle.js";

declare global {
  interface Window {
    domToPptx?: {
      exportToPptx: (
        targets: HTMLElement[] | HTMLElement,
        options?: { fileName?: string; skipDownload?: boolean; autoEmbedFonts?: boolean }
      ) => Promise<Blob>;
    };
  }
}

function loadDomToPptx(): Promise<void> {
  if (window.domToPptx) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = DOM_TO_PPTX_CDN;
    script.async = true;
    script.onload = () => {
      const check = setInterval(() => {
        if (window.domToPptx) {
          clearInterval(check);
          resolve();
        }
      }, 50);
      setTimeout(() => {
        clearInterval(check);
        if (window.domToPptx) resolve();
        else reject(new Error("dom-to-pptx loaded but window.domToPptx not found"));
      }, 5000);
    };
    script.onerror = () => reject(new Error("Failed to load dom-to-pptx from CDN"));
    document.head.appendChild(script);
  });
}

export async function exportSlidesToPptx(
  containerElement: HTMLElement,
  filename: string
): Promise<void> {
  await loadDomToPptx();

  if (!window.domToPptx) {
    throw new Error("dom-to-pptx library not available.");
  }

  // Grab every .slide element — each one becomes a separate slide in the deck
  const slideElements = Array.from(
    containerElement.querySelectorAll<HTMLElement>(".slide")
  );

  if (slideElements.length === 0) {
    throw new Error("No .slide elements found.");
  }

  // Pass the array of slides — dom-to-pptx creates one PPTX slide per element
  await window.domToPptx.exportToPptx(slideElements, {
    fileName: filename.endsWith(".pptx") ? filename : `${filename}.pptx`,
  });
}
