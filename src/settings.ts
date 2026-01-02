/**
 * Settings tab UI for the Logos References Plugin
 */

import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { FolderSuggest } from './autocomplete';
import { LogosPluginSettings } from './types';

interface PluginWithSettings extends Plugin {
    settings: LogosPluginSettings;
    saveSettings(): Promise<void>;
}

export class LogosPluginSettingTab extends PluginSettingTab {
    plugin: PluginWithSettings;

    constructor(app: App, plugin: PluginWithSettings) {
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
                        new_folder = new_folder.trim();
                        new_folder = new_folder.replace(/\/$/, "");

                        this.plugin.settings.bibFolder = new_folder;
                        await this.plugin.saveSettings();
                    });
                // @ts-ignore
                text.containerEl.addClass("BibTeX_search");
            });

        new Setting(this.containerEl)
            .setName("Callout title")
            .setDesc("The title for the callout block (default is \"Logos Reference\")")
            .addText((text) =>
                text
                    .setPlaceholder("Example: Logos Reference")
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
                        this.display();
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
            .setDesc("Add custom metadata categories to the top of new notes")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.useCustomMetadata)
                    .onChange(async (value) => {
                        this.plugin.settings.useCustomMetadata = value;
                        await this.plugin.saveSettings();
                        this.display();
                    })
            );

        if (this.plugin.settings.useCustomMetadata) {
            let addFieldInput: HTMLInputElement;
            new Setting(this.containerEl)
                .setName("Add metadata category")
                .setDesc("Enter a category name (key) to add it to the note properties")
                .addText((text) => {
                    text.setPlaceholder("Example: related notes")
                        .setDisabled(false);

                    addFieldInput = text.inputEl;
                    addFieldInput.onkeypress = async (e: KeyboardEvent) => {
                        if (e.key === 'Enter' && addFieldInput.value.trim()) {
                            const newField = addFieldInput.value.trim();
                            if (!this.plugin.settings.customMetadataFields.includes(newField)) {
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
                            if (addFieldInput && addFieldInput.value.trim()) {
                                const newField = addFieldInput.value.trim();
                                if (!this.plugin.settings.customMetadataFields.includes(newField)) {
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
