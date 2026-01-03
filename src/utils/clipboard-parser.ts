/**
 * Utility functions for parsing Logos clipboard content and BibTeX data
 */

export interface ParsedClipboard {
    mainText: string;
    bibtex: string;
    page: string | null;
    reflyLink?: string | null;
}

/**
 * Parses the Logos clipboard content into structured data
 */
export function parseLogosClipboard(clipboard: string): ParsedClipboard {
    const trimmed = clipboard.trim();

    // Case 1: Clipboard is just the BibTeX entry
    if (trimmed.startsWith('@')) {
        const pageMatch = trimmed.match(/pages\s*=\s*\{([^}]+)\}/i);
        const page = pageMatch ? pageMatch[1] : null;
        const bibtex = trimmed.replace(/pages\s*=\s*\{[^}]*\},?\s*\n?/gi, "");
        return { mainText: "", bibtex, page };
    }

    // Case 2: Clipboard contains both text and BibTeX
    // Split on the last occurrence of whitespace followed by @
    // This is more robust than splitting on only \n
    const parts = trimmed.split(/\s+(?=@[\w]+{)/);

    if (parts.length < 2) {
        return { mainText: trimmed, bibtex: "", page: null };
    }

    const mainTextRaw = parts[0].trim();
    let bibtex = parts[1]?.trim() || "";

    // Extract ref.ly link if present anywhere in the clipboard
    const reflyRegex = /https?:\/\/ref\.ly\/[^\s)}]+/;
    const reflyMatch = trimmed.match(reflyRegex);
    let reflyLink = reflyMatch ? reflyMatch[0] : null;

    // Clean mainText by removing the ref.ly link and its container if it's like "(Resource Link: ...)"
    // only if the link was found in the mainText part
    let mainText = mainTextRaw;
    if (reflyLink && mainTextRaw.includes(reflyLink)) {
        // Remove patterns like " (Resource Link: https://ref.ly/...)" or just the link
        mainText = mainText.replace(new RegExp(`\\s*\\(?Resource Link:\\s*${reflyLink.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)?`, 'i'), "");
        mainText = mainText.replace(reflyLink, "").trim();
    }

    const pageMatch = bibtex.match(/pages\s*=\s*\{([^}]+)\}/i);
    const page = pageMatch ? pageMatch[1] : null;

    bibtex = bibtex.replace(/pages\s*=\s*\{[^}]*\},?\s*\n?/gi, "");

    return { mainText: mainText.trim(), bibtex, page, reflyLink };
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

/**
 * Cleans and transforms formatting in Logos text
 * - Double underscores (__) to <sup>...</sup>
 * - Single underscores (_) to *...*
 */
export function cleanFormattedText(text: string): string {
    if (!text) return text;

    // 1. Handle double underscores first (bold -> superscript)
    let processed = text.replace(/__(.*?)__/g, '<sup>$1</sup>');

    // 2. Handle single underscores (italics -> asterisk)
    processed = processed.replace(/_(.*?)_/g, '*$1*');

    return processed;
}
