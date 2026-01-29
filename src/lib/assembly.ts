/**
 * Assembly Agent: combines N slide HTML strings into one presentation document
 * with consistent styling and slide order.
 */
const BASE_STYLES = `
  .presentation-slides-inner { display: flex; flex-direction: column; width: 100%; }
  .presentation-slides-inner .slide {
    flex: 0 0 auto;
    width: 100%;
    height: var(--slide-h, 70vh);
    min-height: var(--slide-h, 70vh);
    box-sizing: border-box;
  }
  @media print {
    .presentation-slides-inner .slide { page-break-after: always; height: 100vh !important; min-height: 100vh !important; }
  }
`;

export function assembleSlides(slideHtmlStrings: string[]): string {
  return `<style>${BASE_STYLES}</style><div class="presentation-slides-inner">${slideHtmlStrings.join("")}</div>`;
}
