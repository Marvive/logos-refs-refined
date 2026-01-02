/**
 * Settings interface for the Logos References Plugin
 */
export interface LogosPluginSettings {
    bibFolder: string;
    citationCounters: Record<string, number>;
    customCalloutTitle: string;
    appendReferencesToTitle: boolean;
    addNewLineBeforeLink: boolean;
    autoDetectBibleVerses: boolean;
    bibleTranslation: string;
    useCustomMetadata: boolean;
    customMetadataFields: string[];
}

export const DEFAULT_SETTINGS: LogosPluginSettings = {
    bibFolder: '',
    citationCounters: {},
    customCalloutTitle: '',
    appendReferencesToTitle: false,
    addNewLineBeforeLink: false,
    autoDetectBibleVerses: false,
    bibleTranslation: 'esv',
    useCustomMetadata: false,
    customMetadataFields: [],
};
