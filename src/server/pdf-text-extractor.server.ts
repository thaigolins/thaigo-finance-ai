/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-expect-error - no types for legacy build
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

export async function extractTextFromPdfBytes(bytes: Uint8Array): Promise<string> {
  try {
    if ((pdfjsLib as any).GlobalWorkerOptions) {
      (pdfjsLib as any).GlobalWorkerOptions.workerSrc = "";
    }
    const doc = await (pdfjsLib as any).getDocument({
      data: bytes,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;
    const pages: string[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const items = content.items as Array<{ str: string; transform: number[] }>;
      const byY = new Map<number, string[]>();
      for (const item of items) {
        const y = Math.round(item.transform[5]);
        if (!byY.has(y)) byY.set(y, []);
        byY.get(y)!.push(item.str);
      }
      const sortedYs = Array.from(byY.keys()).sort((a, b) => b - a);
      for (const y of sortedYs) {
        pages.push(byY.get(y)!.join(" "));
      }
    }
    return pages.join("\n");
  } catch (e) {
    console.warn("[pdf-extractor] pdfjs failed:", e);
    return "";
  }
}
