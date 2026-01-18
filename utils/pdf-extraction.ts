import * as pdfjsLib from 'pdfjs-dist';
import { TextItem } from 'pdfjs-dist/types/src/display/api';

// Configure worker using a CDN to avoid webpack issues in Next.js
// We use the version matching the installed package to ensure compatibility
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface ExtractedData {
    title: string;
    abstract: string;
}

export async function extractTextFromPdf(file: File): Promise<ExtractedData> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = "";
    let title = "";

    // Scan up to the first 3 pages
    const maxPages = Math.min(pdf.numPages, 3);

    for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
            .filter((item): item is TextItem => 'str' in item && item.str.trim().length > 0)
            .map(item => item.str)
            .join(" ");

        fullText += pageText + " ";

        // Try to find title on the first page
        if (i === 1) {
            const items = textContent.items.filter((item): item is TextItem => 'str' in item && item.str.trim().length > 0);
            if (items.length > 0) {
                title = items[0].str;
                if (items.length > 1 && items[1].str.length > 0) {
                    title += " " + items[1].str;
                }
            }
        }
    }

    let abstract = "";

    // Heuristic for Abstract
    // Look for "Abstract" followed by text, until "Introduction" or similar headers
    // We use a case-insensitive regex.
    // The regex looks for:
    // 1. "Abstract" (optionally followed by punctuation)
    // 2. The content (lazy match)
    // 3. The end marker: "Introduction", "1. Introduction", "I. Introduction", "Keywords", or end of string.
    const abstractMatch = fullText.match(/Abstract[:.]?\s*(.*?)(?=(?:Introduction|1\.?\s*Introduction|I\.?\s*Introduction|Keywords|$))/i);

    if (abstractMatch && abstractMatch[1]) {
        abstract = abstractMatch[1].trim();

        // Safety check: if the abstract is suspiciously long (e.g. > 3000 chars), it might have missed the end marker.
        // In that case, we might want to truncate or try a stricter match, but for now let's just take it.
    } else {
        // Fallback: If "Abstract" keyword isn't found, maybe it's just the text after the title?
        // That's too risky. Let's stick to the keyword.
    }

    return { title, abstract };
}
