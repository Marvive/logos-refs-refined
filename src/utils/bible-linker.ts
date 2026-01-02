/**
 * Utility functions for Bible verse detection and Logos linking
 */

import { BIBLE_BOOKS, VERSION_MAPPING } from '../constants/bible-books';

/**
 * Detects Bible verse references in text and converts them to Logos links
 * Supports formats like "John 3:16", "Jn 3:16", "Genesis 1:1-5", "1 John 1:9"
 */
export function linkBibleVerses(text: string, version: string = 'esv'): string {
    const logosVersion = VERSION_MAPPING[version.toLowerCase()] || version;

    // Regex to match Bible verse patterns
    // Handles: "John 3:16", "1 John 1:9", "Gen. 1:1-5", "Ps 23:1", etc.
    const verseRegex = /\b((?:[123]|I{1,3})\s*)?([A-Za-z]+)\.?\s+(\d+):(\d+)(?:\s*[-–]\s*(\d+))?\b/g;

    return text.replace(verseRegex, (match: string, prefix: string | undefined, book: string, chapter: string, verse: string, endVerse: string | undefined) => {
        // Normalize the book name by combining prefix and book, removing spaces
        let normalizedBook = ((prefix || '') + book).toLowerCase().replace(/\s+/g, '');

        // Handle Roman numeral prefixes (I, II, III -> 1, 2, 3)
        normalizedBook = normalizedBook
            .replace(/^iii/, '3')
            .replace(/^ii/, '2')
            .replace(/^i/, '1');

        const bookCode = BIBLE_BOOKS[normalizedBook];

        if (!bookCode) {
            return match; // Not a recognized Bible book, return original text
        }

        // Build the Logos reference using the simpler ref.ly format
        const ref = endVerse
            ? `${bookCode}${chapter}.${verse}-${endVerse}`
            : `${bookCode}${chapter}.${verse}`;

        return `[${match}](https://ref.ly/${ref};${logosVersion})`;
    });
}

/**
 * Returns the Logos version code for a given translation
 */
export function getLogosVersionCode(version: string): string {
    return VERSION_MAPPING[version.toLowerCase()] || version;
}
