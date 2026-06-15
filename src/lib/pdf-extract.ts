// Client-side PDF text extraction with image fallback for scanned PDFs.
import * as pdfjsLib from "pdfjs-dist";
// Vite-friendly worker import
// @ts-ignore - virtual url import
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc as unknown as string;

export async function extractTextFromPDF(file: File | Blob): Promise<string> {
  console.log("[pdf-extract] starting extraction", {
    size: (file as File).size,
    name: (file as File).name,
    type: (file as File).type,
    workerSrc: pdfjsLib.GlobalWorkerOptions.workerSrc,
  });
  const arrayBuffer = await file.arrayBuffer();
  console.log("[pdf-extract] arrayBuffer bytes:", arrayBuffer.byteLength);
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  console.log("[pdf-extract] pdf loaded, pages:", pdf.numPages);
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = (textContent.items as Array<{ str?: string }>)
      .map((item) => item.str || "")
      .join(" ");
    console.log(`[pdf-extract] page ${i} chars:`, pageText.length);
    fullText += pageText + "\n";
  }
  const trimmed = fullText.trim();
  console.log("[pdf-extract] total extracted chars:", trimmed.length);
  console.log("[pdf-extract] preview:", trimmed.slice(0, 500));
  return trimmed;
}

/** Render the first page of a PDF to a PNG data URL (for scanned-PDF OCR fallback). */
export async function renderPdfFirstPageToDataUrl(file: File | Blob, scale = 2): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
  return canvas.toDataURL("image/png");
}

export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
