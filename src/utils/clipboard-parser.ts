/**
 * Utility functions for parsing Logos clipboard content and BibTeX data
 */

export interface ParsedClipboard {
    mainText: string;
    bibtex: string;
    page: string | null;
}

/**
 * Parses the Logos clipboard content into structured data
 */
export function parseLogosClipboard(clipboard: string): ParsedClipboard {
    const parts = clipboard.split(/\n(?=@)/);
    const mainText = parts[0].trim();
    let bibtex = parts[1]?.trim() || "";

    const pageMatch = bibtex.match(/pages\s*=\s*\{([^}]+)\}/i);
    const page = pageMatch ? pageMatch[1] : null;

    bibtex = bibtex.replace(/pages\s*=\s*\{[^}]*\},?\s*\n?/gi, "");

    return { mainText, bibtex, page };
}

/**
 * Extracts the cite key from BibTeX content
 */
export function extractCiteKey(bibtex: string): string {
    const match = bibtex.match(/^@\w+\{([^,]+),/);
    if (!match) throw new Error("Could not extract cite key");

    let citeKey = match[1];
    citeKey = citeKey.replace(/[_\W]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return citeKey;
}

/**
 * Extracts page number from text (typically at the end of a citation)
 */
export function extractPageNumber(text: string): { cleanedText: string, page: string | null } {
    const pageRegex = /[([ ]?(p{1,2}\.? ?\d+([–-]\d+)?)[)\]]?\.?$/i;
    const match = text.match(pageRegex);
    if (match) {
        const page = match[1];
        const cleanedText = text.replace(pageRegex, "").trim();
        return { cleanedText, page };
    }
    return { cleanedText: text.trim(), page: null };
}

/**
 * Extracts pages field from BibTeX content
 */
export function extractPagesFromBibtex(bibtex: string): string | null {
    const match = bibtex.match(/pages\s*=\s*[{"']([^}"']+)[}"']/i);
    return match ? match[1] : null;
}

/**
 * Extracts book title from BibTeX content
 */
export function extractBookTitle(bibtex: string): string | null {
    const titleMatch = bibtex.match(/title\s*=\s*\{([^}]+)\}/i);
    return titleMatch ? titleMatch[1] : null;
}
