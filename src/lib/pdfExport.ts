/**
 * PDF Agent: converts assembled HTML slides into a single PDF and triggers download.
 * Uses html2canvas + jsPDF when available; falls back to window.print().
 */
export async function exportSlidesToPdf(
  containerElement: HTMLElement,
  filename: string
): Promise<void> {
  try {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    const slideList = Array.from(containerElement.querySelectorAll<HTMLElement>(".slide"));
    if (slideList.length === 0) throw new Error("No slides found");

    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    for (let i = 0; i < slideList.length; i++) {
      const slide = slideList[i];
      const canvas = await html2canvas(slide, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png", 1.0);
      const imgW = pageWidth;
      const imgH = (canvas.height * imgW) / canvas.width;

      if (imgH > pageHeight) {
        pdf.addImage(imgData, "PNG", 0, 0, imgW, pageHeight);
      } else {
        pdf.addImage(imgData, "PNG", 0, 0, imgW, imgH);
      }

      if (i < slideList.length - 1) pdf.addPage();
    }

    pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
  } catch (e) {
    console.warn("PDF export failed, falling back to print:", e);
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(containerElement.innerHTML);
      printWindow.document.close();
      printWindow.print();
      printWindow.close();
    } else {
      window.print();
    }
  }
}
