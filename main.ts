import { App, Editor, MarkdownEditView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, TFolder } from 'obsidian';
import { FolderSuggest } from 'autocomplete'

interface LogosPluginSettings {
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

const DEFAULT_SETTINGS: LogosPluginSettings = {
	bibFolder: '', // default to vault root
	citationCounters: {},
	customCalloutTitle: '',
	appendReferencesToTitle: false,
	addNewLineBeforeLink: false,
	autoDetectBibleVerses: false,
	bibleTranslation: 'esv',
	useCustomMetadata: false,
	customMetadataFields: [],
};

export default class LogosReferencePlugin extends Plugin {
	settings: LogosPluginSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: 'paste-logos-reference',
			name: 'Paste Logos reference with BibTeX',
			editorCallback: async (editor: Editor, view: MarkdownEditView) => {
				const file = view.file;
				if (!file) {
					new Notice("No active editor");
					return;
				}

				const notePath = file.name
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
				// Strip special characters from note name
				noteName = noteName.replace(/[\\/:]/g, '');

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

				// Determine callout title based on settings
				const calloutTitle = this.settings.customCalloutTitle || 'Logos Ref';

				const quotedTextParts = [
					`> [!logos-ref] ${calloutTitle}`,
					`> ${mainText.split('\n').join('\n> ')}`
				];

				if (this.settings.addNewLineBeforeLink) {
					quotedTextParts.push(`> `);
				}

				// Use descriptive note name as alias if enabled, otherwise use citeKey
				const linkAlias = this.settings.appendReferencesToTitle
					? `${noteName}${pageLabel}`
					: `${citeKey}${pageLabel}`;

				quotedTextParts.push(`> [[${filePath}|${linkAlias}]] ^${blockId}`);

				const quotedText = quotedTextParts.join('\n');

				editor.replaceSelection(`${quotedText}\n`);

				// Check if reference file exists
				const abstractFile = this.app.vault.getAbstractFileByPath(filePath);
				const abstractFileFolder = this.app.vault.getAbstractFileByPath(folder)
				const linkBack = `[[${file.basename}#^${blockId}]]${page ? ` → p. ${page}` : ''}`;

				if (!abstractFile) {
					if (folder && (!abstractFileFolder || !(abstractFileFolder instanceof TFolder))) {
						// if a folder was provided and either
						//   there is no folder, or the folder is not an instance of a folder
						// then we need to create the folder
						await this.app.vault.createFolder(folder);
					}
					// Build content with optional newline before citation
					const citationPrefix = this.settings.addNewLineBeforeLink ? '\n' : '';

					let metadata = '';
					if (this.settings.useCustomMetadata && this.settings.customMetadataFields.length > 0) {
						metadata = '---\n';
						this.settings.customMetadataFields.forEach(field => {
							metadata += `${field}: \n`;
						});
						metadata += '---\n\n';
					}

					const content = metadata + [
						'```bibtex',
						bibtex.replace(/pages\s*=\s*{[^}]*},?\s*/gi, ""),  // optionally remove page field
						'```',
						'',
						'## Citations',
						`${citationPrefix}- ${linkBack}`
					].join('\n');
					await this.app.vault.create(filePath, content);
					new Notice(`Created ${filePath}`);
				} else {
					let refNote = '';
					if (abstractFile instanceof TFile) {
						refNote = await this.app.vault.read(abstractFile);
					} else {
						new Notice(`Could not read ${filePath}: not a valid file`);
						return;
					}
					// Add optional newline before citation link
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
								return match; // don't add if it already exists
							}
						);
					} else {
						updatedContent = `${refNote.trim()}\n\n## Citations\n${citationLine}`;
					}

					if (abstractFile instanceof TFile) {
						await this.app.vault.modify(abstractFile, updatedContent);
					}
				}
			}
		});

		this.addCommand({
			id: 'list-bibtex-references',
			name: 'List all BibTeX references',
			editorCallback: async (editor: Editor, view: MarkdownEditView) => {
				const filePath = view.file.path;
				if (!filePath) {
					new Notice("No active file");
					return;
				}

				// Step 1: Get all the links in the current document (reference to other notes)
				const links = await this.getAllLinksInDocument(filePath);
				if (links.length === 0) {
					new Notice("No references found in the document.");
					return;
				}
				// Step 2: Get BibTeX from all the linked notes
				const bibtexReferences = await this.getBibtexFromLinks(links);
				if (bibtexReferences.length === 0) {
					new Notice("No BibTeX references found in linked notes.");
					return;
				}

				// Step 3: Append BibTeX references at the end of the current document
				const bibtexList = bibtexReferences.join("\n\n");

				const activeFile = this.app.workspace.getActiveFile();
				let content = '';

				if (activeFile instanceof TFile) {
					content = await this.app.vault.read(activeFile);
					const updatedContent = `${content}\n\n## Bibliography\n${bibtexList}`;
					await this.app.vault.modify(activeFile, updatedContent);
				} else {
					new Notice("Could not read active file: not a valid file.");
					return;
				}
				new Notice("BibTeX references added to the document.");
			}
		});

		this.addSettingTab(new LogosPluginSettingTab(this.app, this));
	}

	// Helper function to get all links in a document
	async getAllLinksInDocument(filePath: string): Promise<string[]> {
		const abstractFile = this.app.vault.getAbstractFileByPath(filePath);
		if (!(abstractFile instanceof TFile)) return [];

		const cache = this.app.metadataCache.getFileCache(abstractFile);
		if (!cache || !cache.links) return [];

		// Extract just the link target (removing any alias), and remove duplicates
		const uniqueLinks = Array.from(new Set(cache.links.map(link => link.link)));
		return uniqueLinks;
	}

	// Helper function to get BibTeX from the links
	async getBibtexFromLinks(links: string[]): Promise<string[]> {
		const bibtexReferences: string[] = [];
		for (const link of links) {
			const file = this.app.vault.getAbstractFileByPath(link);
			if (file instanceof TFile) {
				const content = await this.app.vault.read(file);
				// Updated regex to match BibTeX block
				const bibtexMatch = content.match(/```bibtex[\s\S]*?```/);

				if (bibtexMatch) {
					// Extract the content between the '```bibtex' and '```' markers
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
}

function parseLogosClipboard(clipboard: string): {
	mainText: string;
	bibtex: string;
	page: string | null;
} {
	const parts = clipboard.split(/\n(?=@)/); // Split before the bibtex
	const mainText = parts[0].trim();
	let bibtex = parts[1]?.trim() || "";

	// Extract page number BEFORE modifying bibtex
	const pageMatch = bibtex.match(/pages\s*=\s*\{([^}]+)\}/i);
	const page = pageMatch ? pageMatch[1] : null;

	// Clean up bibtex (remove pages field)
	bibtex = bibtex.replace(/pages\s*=\s*\{[^}]*\},?\s*\n?/gi, "");

	return { mainText, bibtex, page };
}

function extractCiteKey(bibtex: string): string {
	const match = bibtex.match(/^@\w+\{([^,]+),/);
	if (!match) throw new Error("Could not extract cite key");

	let citeKey = match[1];
	citeKey = citeKey.replace(/[_\W]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
	return citeKey;
}

function extractPageNumber(text: string): { cleanedText: string, page: string | null } {
	const pageRegex = /[\(\[]?(p{1,2}\.? ?\d+([–-]\d+)?)[\)\]]?\.?$/i;
	const match = text.match(pageRegex);
	if (match) {
		const page = match[1];
		const cleanedText = text.replace(pageRegex, "").trim();
		return { cleanedText, page };
	}
	return { cleanedText: text.trim(), page: null };
}

function extractPagesFromBibtex(bibtex: string): string | null {
	const match = bibtex.match(/pages\s*=\s*[{"']([^}"']+)[}"']/i);
	return match ? match[1] : null;
}

function extractBookTitle(bibtex: string): string | null {
	const titleMatch = bibtex.match(/title\s*=\s*\{([^}]+)\}/i);
	return titleMatch ? titleMatch[1] : null;
}

// Bible book mappings - maps various names and abbreviations to Logos ref codes
const BIBLE_BOOKS: Record<string, string> = {
	// Old Testament
	'genesis': 'Ge', 'gen': 'Ge', 'ge': 'Ge',
	'exodus': 'Ex', 'exod': 'Ex', 'ex': 'Ex',
	'leviticus': 'Lv', 'lev': 'Lv', 'lv': 'Lv',
	'numbers': 'Nu', 'num': 'Nu', 'nu': 'Nu', 'nm': 'Nu',
	'deuteronomy': 'Dt', 'deut': 'Dt', 'dt': 'Dt', 'de': 'Dt',
	'joshua': 'Jos', 'josh': 'Jos', 'jos': 'Jos',
	'judges': 'Jdg', 'judg': 'Jdg', 'jdg': 'Jdg', 'jg': 'Jdg',
	'ruth': 'Ru', 'ru': 'Ru', 'rth': 'Ru',
	'1samuel': '1Sa', '1sam': '1Sa', '1sa': '1Sa', '1sm': '1Sa', 'isamuel': '1Sa', 'isam': '1Sa',
	'2samuel': '2Sa', '2sam': '2Sa', '2sa': '2Sa', '2sm': '2Sa', 'iisamuel': '2Sa', 'iisam': '2Sa',
	'1kings': '1Ki', '1kgs': '1Ki', '1ki': '1Ki', '1kg': '1Ki', 'ikings': '1Ki', 'ikgs': '1Ki',
	'2kings': '2Ki', '2kgs': '2Ki', '2ki': '2Ki', '2kg': '2Ki', 'iikings': '2Ki', 'iikgs': '2Ki',
	'1chronicles': '1Ch', '1chr': '1Ch', '1ch': '1Ch', 'ichronicles': '1Ch', 'ichr': '1Ch',
	'2chronicles': '2Ch', '2chr': '2Ch', '2ch': '2Ch', 'iichronicles': '2Ch', 'iichr': '2Ch',
	'ezra': 'Ezr', 'ezr': 'Ezr',
	'nehemiah': 'Ne', 'neh': 'Ne', 'ne': 'Ne',
	'esther': 'Es', 'esth': 'Es', 'es': 'Es', 'est': 'Es',
	'job': 'Job', 'jb': 'Job',
	'psalms': 'Ps', 'psalm': 'Ps', 'ps': 'Ps', 'psa': 'Ps', 'pss': 'Ps',
	'proverbs': 'Pr', 'prov': 'Pr', 'pr': 'Pr', 'prv': 'Pr',
	'ecclesiastes': 'Ec', 'eccl': 'Ec', 'ecc': 'Ec', 'ec': 'Ec', 'eccles': 'Ec', 'qoh': 'Ec',
	'songofsolomon': 'So', 'songofsongs': 'So', 'song': 'So', 'sos': 'So', 'so': 'So', 'ss': 'So', 'canticles': 'So', 'cant': 'So',
	'isaiah': 'Is', 'isa': 'Is', 'is': 'Is',
	'jeremiah': 'Je', 'jer': 'Je', 'je': 'Je', 'jr': 'Je',
	'lamentations': 'La', 'lam': 'La', 'la': 'La',
	'ezekiel': 'Eze', 'ezek': 'Eze', 'eze': 'Eze', 'ez': 'Eze',
	'daniel': 'Da', 'dan': 'Da', 'da': 'Da', 'dn': 'Da',
	'hosea': 'Ho', 'hos': 'Ho', 'ho': 'Ho',
	'joel': 'Joe', 'joe': 'Joe', 'jl': 'Joe',
	'amos': 'Am', 'am': 'Am',
	'obadiah': 'Ob', 'obad': 'Ob', 'ob': 'Ob',
	'jonah': 'Jon', 'jnh': 'Jon',
	'micah': 'Mic', 'mic': 'Mic', 'mi': 'Mic',
	'nahum': 'Na', 'nah': 'Na', 'na': 'Na',
	'habakkuk': 'Hab', 'hab': 'Hab', 'hb': 'Hab',
	'zephaniah': 'Zep', 'zeph': 'Zep', 'zep': 'Zep',
	'haggai': 'Hag', 'hag': 'Hag', 'hg': 'Hag',
	'zechariah': 'Zec', 'zech': 'Zec', 'zec': 'Zec',
	'malachi': 'Mal', 'mal': 'Mal',
	// New Testament
	'matthew': 'Mt', 'matt': 'Mt', 'mt': 'Mt',
	'mark': 'Mk', 'mk': 'Mk', 'mr': 'Mk',
	'luke': 'Lk', 'lk': 'Lk', 'lu': 'Lk',
	'john': 'Jn', 'jn': 'Jn', 'jhn': 'Jn',
	'acts': 'Ac', 'ac': 'Ac',
	'romans': 'Ro', 'rom': 'Ro', 'ro': 'Ro', 'rm': 'Ro',
	'1corinthians': '1Co', '1cor': '1Co', '1co': '1Co', 'icorinthians': '1Co', 'icor': '1Co',
	'2corinthians': '2Co', '2cor': '2Co', '2co': '2Co', 'iicorinthians': '2Co', 'iicor': '2Co',
	'galatians': 'Ga', 'gal': 'Ga', 'ga': 'Ga',
	'ephesians': 'Eph', 'eph': 'Eph',
	'philippians': 'Php', 'phil': 'Php', 'php': 'Php',
	'colossians': 'Col', 'col': 'Col',
	'1thessalonians': '1Th', '1thess': '1Th', '1th': '1Th', 'ithessalonians': '1Th', 'ithess': '1Th',
	'2thessalonians': '2Th', '2thess': '2Th', '2th': '2Th', 'iithessalonians': '2Th', 'iithess': '2Th',
	'1timothy': '1Ti', '1tim': '1Ti', '1ti': '1Ti', 'itimothy': '1Ti', 'itim': '1Ti',
	'2timothy': '2Ti', '2tim': '2Ti', '2ti': '2Ti', 'iitimothy': '2Ti', 'iitim': '2Ti',
	'titus': 'Tt', 'tit': 'Tt', 'tt': 'Tt',
	'philemon': 'Phm', 'phlm': 'Phm', 'phm': 'Phm',
	'hebrews': 'Heb', 'heb': 'Heb',
	'james': 'Jas', 'jas': 'Jas', 'jm': 'Jas',
	'1peter': '1Pe', '1pet': '1Pe', '1pe': '1Pe', '1pt': '1Pe', 'ipeter': '1Pe', 'ipet': '1Pe',
	'2peter': '2Pe', '2pet': '2Pe', '2pe': '2Pe', '2pt': '2Pe', 'iipeter': '2Pe', 'iipet': '2Pe',
	'1john': '1Jn', '1jn': '1Jn', 'ijohn': '1Jn', 'ijn': '1Jn',
	'2john': '2Jn', '2jn': '2Jn', 'iijohn': '2Jn', 'iijn': '2Jn',
	'3john': '3Jn', '3jn': '3Jn', 'iiijohn': '3Jn', 'iiijn': '3Jn',
	'jude': 'Jud', 'jud': 'Jud',
	'revelation': 'Re', 'rev': 'Re', 're': 'Re', 'apocalypse': 'Re', 'apoc': 'Re',
};

/**
 * Detects Bible verse references in text and converts them to Logos links
 * Supports formats like "John 3:16", "Jn 3:16", "Genesis 1:1-5", "1 John 1:9"
 */
function linkBibleVerses(text: string, version: string = 'esv'): string {
	// Regex to match Bible verse patterns
	// Handles: "John 3:16", "1 John 1:9", "Gen. 1:1-5", "Ps 23:1", etc.
	const verseRegex = /\b((?:[123]|I{1,3})\s*)?([A-Za-z]+)\.?\s+(\d+):(\d+)(?:\s*[-–]\s*(\d+))?\b/g;

	return text.replace(verseRegex, (match, prefix, book, chapter, verse, endVerse) => {
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

		// Build the Logos reference
		const versionUpper = version.toUpperCase();
		const ref = endVerse
			? `${bookCode}${chapter}.${verse}-${endVerse}`
			: `${bookCode}${chapter}.${verse}`;

		return `[${match}](https://ref.ly/logosres/${version}?ref=Bible${versionUpper}.${ref})`;
	});
}

class LogosPluginSettingTab extends PluginSettingTab {
	plugin: LogosReferencePlugin;

	constructor(app: App, plugin: LogosReferencePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(this.containerEl)
			.setName("BibTeX note folder")
			.setDesc("Folder to save BibTeX reference notes")
			.addSearch((text) => {
				new FolderSuggest(this.app, text.inputEl);
				text.setPlaceholder("Example: folder1/folder2")
					.setValue(this.plugin.settings.bibFolder)
					.onChange(async (new_folder) => {
						// Trim folder and Strip ending slash if there
						new_folder = new_folder.trim()
						new_folder = new_folder.replace(/\/$/, "");

						this.plugin.settings.bibFolder = new_folder;
						await this.plugin.saveSettings();
					});
				// @ts-ignore
				text.containerEl.addClass("BibTeX_search");
			});

		new Setting(this.containerEl)
			.setName("Callout title")
			.setDesc("The title for the callout block (default is \"Logos Ref\")")
			.addText((text) =>
				text
					.setPlaceholder("Example: Logos Ref")
					.setValue(this.plugin.settings.customCalloutTitle)
					.onChange(async (value) => {
						this.plugin.settings.customCalloutTitle = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(this.containerEl)
			.setName("Append \"References\" to note title")
			.setDesc("New notes will be named \"{Book Title} - References\" instead of just the cite key")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.appendReferencesToTitle)
					.onChange(async (value) => {
						this.plugin.settings.appendReferencesToTitle = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(this.containerEl)
			.setName("Add newline before linked note")
			.setDesc("Adds an extra blank line before the linked note at the bottom of citations")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.addNewLineBeforeLink)
					.onChange(async (value) => {
						this.plugin.settings.addNewLineBeforeLink = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(this.containerEl)
			.setName("Auto-detect Bible verses")
			.setDesc("Automatically detects Bible verse references (e.g., \"John 3:16\", \"Gen 1:1\") and links them to Logos")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoDetectBibleVerses)
					.onChange(async (value) => {
						this.plugin.settings.autoDetectBibleVerses = value;
						await this.plugin.saveSettings();
						this.display(); // Refresh to show/hide translation dropdown
					})
			);

		if (this.plugin.settings.autoDetectBibleVerses) {
			new Setting(this.containerEl)
				.setName("Preferred Bible translation")
				.setDesc("The translation to use for Logos ref.ly links")
				.addDropdown((dropdown) =>
					dropdown
						.addOptions({
							niv: "NIV",
							esv: "ESV",
							nasb: "NASB",
							lsb: "LSB",
							nlt: "NLT",
						})
						.setValue(this.plugin.settings.bibleTranslation)
						.onChange(async (value) => {
							this.plugin.settings.bibleTranslation = value;
							await this.plugin.saveSettings();
						})
				);
		}

		new Setting(this.containerEl)
			.setName("Use custom metadata")
			.setDesc("Add custom metadata tags to the top of new notes")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.useCustomMetadata)
					.onChange(async (value) => {
						this.plugin.settings.useCustomMetadata = value;
						await this.plugin.saveSettings();
						this.display(); // Refresh to show/hide tag list
					})
			);

		if (this.plugin.settings.useCustomMetadata) {
			new Setting(this.containerEl)
				.setName("Add metadata category")
				.setDesc("Enter a category name (key) to add it to the note properties")
				.addText((text) => {
					text.setPlaceholder("Example: related notes")
						.setDisabled(false);

					const inputEl = text.inputEl;
					inputEl.onkeypress = async (e: KeyboardEvent) => {
						if (e.key === 'Enter' && inputEl.value.trim()) {
							const newField = inputEl.value.trim();
							if (!this.plugin.settings.customMetadataFields.contains(newField)) {
								this.plugin.settings.customMetadataFields.push(newField);
								await this.plugin.saveSettings();
								this.display();
							}
						}
					};
				})
				.addButton((button) => {
					button.setButtonText("Add")
						.setCta()
						.onClick(async () => {
							const inputEl = (this.containerEl.querySelector(".setting-item:last-child input") as HTMLInputElement);
							if (inputEl && inputEl.value.trim()) {
								const newField = inputEl.value.trim();
								if (!this.plugin.settings.customMetadataFields.contains(newField)) {
									this.plugin.settings.customMetadataFields.push(newField);
									await this.plugin.saveSettings();
									this.display();
								}
							}
						});
				});

			this.plugin.settings.customMetadataFields.forEach((field, index) => {
				new Setting(this.containerEl)
					.setName(field)
					.addButton((button) => {
						button.setButtonText("Remove")
							.setWarning()
							.onClick(async () => {
								this.plugin.settings.customMetadataFields.splice(index, 1);
								await this.plugin.saveSettings();
								this.display();
							});
					});
			});
		}
	}
}
