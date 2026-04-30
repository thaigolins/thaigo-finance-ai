/* eslint-disable @typescript-eslint/no-explicit-any */
export async function extractTextFromPdfBytes(bytes: Uint8Array): Promise<string> {
  try {
    const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf.mjs" as any);
    if (pdfjsLib?.getDocument) {
      if (pdfjsLib.GlobalWorkerOptions) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = "";
      }
      const doc = await pdfjsLib.getDocument({
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
    }
  } catch (e) {
    console.warn("[pdf-extractor] pdfjs failed:", e);
  }
  return "";
}
