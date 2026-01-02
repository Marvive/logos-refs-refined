/**
 * Logos References Plugin - Main Entry Point
 * 
 * A refined plugin for managing Logos Bible Software references in Obsidian.
 */

import { Editor, MarkdownView, Notice, Plugin, TFile, TFolder } from 'obsidian';
import { LogosPluginSettings, DEFAULT_SETTINGS } from './types';
import { LogosPluginSettingTab } from './settings';
import { parseLogosClipboard, extractCiteKey, extractBookTitle } from './utils/clipboard-parser';
import { linkBibleVerses } from './utils/bible-linker';
import { sanitizeNoteName, generateMetadataFrontmatter } from './utils/file-utils';

export default class LogosReferencePlugin extends Plugin {
    settings: LogosPluginSettings;
    private ribbonIconEl: HTMLElement | null = null;

    async onload() {
        await this.loadSettings();
        this.refreshRibbonIcon();

        this.addCommand({
            id: 'paste-logos-reference',
            name: 'Paste Logos reference with BibTeX',
            editorCallback: async (editor: Editor, view: MarkdownView) => {
                await this.handlePasteLogosReference(editor, view);
            }
        });

        this.addCommand({
            id: 'list-bibtex-references',
            name: 'List all BibTeX references',
            editorCallback: async (editor: Editor, view: MarkdownView) => {
                await this.handleListBibtexReferences(editor, view);
            }
        });

        this.addSettingTab(new LogosPluginSettingTab(this.app, this));
    }

    /**
     * Handles the "Paste Logos reference" command
     */
    private async handlePasteLogosReference(editor: Editor, view: MarkdownView): Promise<void> {
        const file = view.file;
        if (!file) {
            new Notice("No active editor");
            return;
        }

        const notePath = file.name;
        const clipboard = await navigator.clipboard.readText();
        let { mainText, bibtex, page } = parseLogosClipboard(clipboard);
        const citeKey = extractCiteKey(bibtex);
        const bookTitle = extractBookTitle(bibtex);
        const folder = this.settings.bibFolder.trim() || '';

        // Determine the note name based on settings
        let noteName = citeKey;
        if (this.settings.appendReferencesToTitle && bookTitle) {
            noteName = `${bookTitle} - References`;
        }
        noteName = sanitizeNoteName(noteName);

        const filePath = folder ? `${folder}/${noteName}.md` : `${noteName}.md`;

        // Auto-detect Bible verses and link them to Logos if enabled
        if (this.settings.autoDetectBibleVerses) {
            mainText = linkBibleVerses(mainText, this.settings.bibleTranslation);
        }

        const pageLabel = page
            ? `, ${page.includes('-') || page.includes('–') ? 'pp.' : 'p.'} ${page}`
            : "";

        // Generate block ID using a persistent counter
        const counters = this.settings.citationCounters;
        if (!counters[notePath]) {
            counters[notePath] = 1;
        } else {
            counters[notePath]++;
        }
        const blockId = `${citeKey.replace(' ', '-')}-${counters[notePath]}`;
        await this.saveSettings();

        // Build the callout block
        const calloutTitle = this.settings.customCalloutTitle || 'Logos Reference';
        const quotedTextParts = [
            `> [!logos] ${calloutTitle}`,
            `> ${mainText.split('\n').join('\n> ')}`
        ];

        if (this.settings.addNewLineBeforeLink) {
            quotedTextParts.push(`> `);
        }

        const linkAlias = this.settings.appendReferencesToTitle
            ? `${noteName}${pageLabel}`
            : `${citeKey}${pageLabel}`;

        quotedTextParts.push(`> [[${filePath}|${linkAlias}]] ^${blockId}`);
        const quotedText = quotedTextParts.join('\n');

        editor.replaceSelection(`${quotedText}\n`);

        // Create or update the reference file
        await this.createOrUpdateReferenceFile(filePath, folder, bibtex, file.basename, blockId, page);
    }

    /**
     * Creates a new reference file or appends a citation to an existing one
     */
    private async createOrUpdateReferenceFile(
        filePath: string,
        folder: string,
        bibtex: string,
        sourceBasename: string,
        blockId: string,
        page: string | null
    ): Promise<void> {
        const abstractFile = this.app.vault.getAbstractFileByPath(filePath);
        const abstractFileFolder = this.app.vault.getAbstractFileByPath(folder);
        const linkBack = `[[${sourceBasename}#^${blockId}]]${page ? ` → p. ${page}` : ''}`;

        if (!abstractFile) {
            // Create folder if needed
            if (folder && (!abstractFileFolder || !(abstractFileFolder instanceof TFolder))) {
                await this.app.vault.createFolder(folder);
            }

            const citationPrefix = this.settings.addNewLineBeforeLink ? '\n' : '';
            const metadata = this.settings.useCustomMetadata
                ? generateMetadataFrontmatter(this.settings.customMetadataFields)
                : '';

            const content = metadata + [
                '```bibtex',
                bibtex.replace(/pages\s*=\s*{[^}]*},?\s*/gi, ""),
                '```',
                '',
                '## Citations',
                `${citationPrefix}- ${linkBack}`
            ].join('\n');

            await this.app.vault.create(filePath, content);
            new Notice(`Created ${filePath}`);
        } else {
            await this.appendCitationToFile(abstractFile, linkBack);
        }
    }

    /**
     * Appends a citation link to an existing reference file
     */
    private async appendCitationToFile(abstractFile: any, linkBack: string): Promise<void> {
        if (!(abstractFile instanceof TFile)) {
            new Notice(`Could not read file: not a valid file`);
            return;
        }

        const refNote = await this.app.vault.read(abstractFile);
        const citationPrefix = this.settings.addNewLineBeforeLink ? '\n' : '';
        const citationLine = `${citationPrefix}- ${linkBack}`;
        let updatedContent: string;

        if (refNote.includes("## Citations")) {
            updatedContent = refNote.replace(
                /## Citations([\s\S]*?)((\n#+\s)|$)/,
                (match, citations, followingHeading) => {
                    if (!match.includes(linkBack)) {
                        return `## Citations\n${citations.trim()}\n${citationLine}\n${followingHeading}`;
                    }
                    return match;
                }
            );
        } else {
            updatedContent = `${refNote.trim()}\n\n## Citations\n${citationLine}`;
        }

        await this.app.vault.modify(abstractFile, updatedContent);
    }

    /**
     * Handles the "List BibTeX references" command
     */
    private async handleListBibtexReferences(editor: Editor, view: MarkdownView): Promise<void> {
        const filePath = view.file?.path;
        if (!filePath) {
            new Notice("No active file");
            return;
        }

        const links = await this.getAllLinksInDocument(filePath);
        if (links.length === 0) {
            new Notice("No references found in the document.");
            return;
        }

        const bibtexReferences = await this.getBibtexFromLinks(links);
        if (bibtexReferences.length === 0) {
            new Notice("No BibTeX references found in linked notes.");
            return;
        }

        const bibtexList = bibtexReferences.join("\n\n");
        const activeFile = this.app.workspace.getActiveFile();

        if (activeFile instanceof TFile) {
            const content = await this.app.vault.read(activeFile);
            const updatedContent = `${content}\n\n## Bibliography\n${bibtexList}`;
            await this.app.vault.modify(activeFile, updatedContent);
            new Notice("BibTeX references added to the document.");
        } else {
            new Notice("Could not read active file: not a valid file.");
        }
    }

    /**
     * Gets all links in a document
     */
    async getAllLinksInDocument(filePath: string): Promise<string[]> {
        const abstractFile = this.app.vault.getAbstractFileByPath(filePath);
        if (!(abstractFile instanceof TFile)) return [];

        const cache = this.app.metadataCache.getFileCache(abstractFile);
        if (!cache || !cache.links) return [];

        return Array.from(new Set(cache.links.map(link => link.link)));
    }

    /**
     * Extracts BibTeX content from linked notes
     */
    async getBibtexFromLinks(links: string[]): Promise<string[]> {
        const bibtexReferences: string[] = [];
        for (const link of links) {
            const file = this.app.vault.getAbstractFileByPath(link);
            if (file instanceof TFile) {
                const content = await this.app.vault.read(file);
                const bibtexMatch = content.match(/```bibtex[\s\S]*?```/);

                if (bibtexMatch) {
                    const bibtexContent = bibtexMatch[0].replace(/```bibtex|```/g, '').trim();
                    bibtexReferences.push(bibtexContent);
                }
            }
        }
        return bibtexReferences;
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    /**
     * Creates or removes the ribbon icon based on settings
     */
    refreshRibbonIcon() {
        if (this.settings.showRibbonIcon && !this.ribbonIconEl) {
            this.ribbonIconEl = this.addRibbonIcon('church', 'Paste Logos Reference', async () => {
                const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (activeView) {
                    await this.handlePasteLogosReference(activeView.editor, activeView);
                } else {
                    new Notice("No active editor found");
                }
            });
        } else if (!this.settings.showRibbonIcon && this.ribbonIconEl) {
            this.ribbonIconEl.remove();
            this.ribbonIconEl = null;
        }
    }
}

// Re-export types for settings tab
export type { LogosPluginSettings };
