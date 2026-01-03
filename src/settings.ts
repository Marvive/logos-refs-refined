/**
 * Settings tab UI for the Logos References Plugin
 */

import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { FolderSuggest } from './ui/folder-suggest';
import { LogosPluginSettings } from './types';

interface PluginWithSettings extends Plugin {
    settings: LogosPluginSettings;
    saveSettings(): Promise<void>;
}

export class LogosPluginSettingTab extends PluginSettingTab {
    plugin: PluginWithSettings;
    private dragIndex: number | null = null;

    constructor(app: App, plugin: PluginWithSettings) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        new Setting(this.containerEl)
            .setName("Bibtex note folder")
            .setDesc("Folder to save bibtex reference notes")
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
                text.inputEl.parentElement?.classList.add("bibtex-search");
            });

        new Setting(this.containerEl)
            .setName("Callout title")
            .setDesc("The title for the callout block (default is \"logos reference\")")
            .addText((text) =>
                text
                    .setPlaceholder("Example: logos reference")
                    .setValue(this.plugin.settings.customCalloutTitle)
                    .onChange(async (value) => {
                        this.plugin.settings.customCalloutTitle = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(this.containerEl)
            .setName("Append \"references\" to note title")
            .setDesc("New book notes will be named \"{Book Title} - references\" instead of just the cite key")
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
            .setName("Add space after callout")
            .setDesc("Adds an extra blank line after the callout block so that there is space before what you type next")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.addNewLineAfterCallout)
                    .onChange(async (value) => {
                        this.plugin.settings.addNewLineAfterCallout = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(this.containerEl)
            .setName("Include Logos resource link")
            .setDesc("When enabled, the Logos ref.ly hyperlink will be included above the note link")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.includeReflyLink)
                    .onChange(async (value) => {
                        this.plugin.settings.includeReflyLink = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(this.containerEl)
            .setName("Auto-detect bible verses")
            .setDesc("Automatically detects bible verse references and links them to logos")
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
                .setName("Preferred bible translation")
                .setDesc("The translation to use for logos ref.ly links")
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
            .setDesc("Add custom metadata categories to the top of new book notes")
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
                    addFieldInput.addEventListener('keydown', (e: KeyboardEvent) => {
                        if (e.key === 'Enter' && addFieldInput.value.trim()) {
                            const newField = addFieldInput.value.trim();
                            if (!this.plugin.settings.customMetadataFields.includes(newField)) {
                                this.plugin.settings.customMetadataFields.push(newField);
                                void this.plugin.saveSettings().then(() => {
                                    this.display();
                                });
                            }
                        }
                    });
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
                const setting = new Setting(this.containerEl)
                    .setName(field)
                    .addExtraButton(btn => {
                        btn.setIcon("grip-vertical")
                            .setTooltip("Drag to reorder")
                            .extraSettingsEl.classList.add("metadata-grab-handle");
                        btn.extraSettingsEl.draggable = true;

                        btn.extraSettingsEl.addEventListener("dragstart", (e) => {
                            this.dragIndex = index;
                            setting.settingEl.classList.add("is-being-dragged");
                            if (e.dataTransfer) {
                                e.dataTransfer.effectAllowed = "move";
                            }
                        });

                        btn.extraSettingsEl.addEventListener("dragend", () => {
                            this.dragIndex = null;
                            setting.settingEl.classList.remove("is-being-dragged");
                        });
                    });

                const settingEl = setting.settingEl;

                settingEl.addEventListener("dragover", (e) => {
                    if (this.dragIndex !== null && this.dragIndex !== index) {
                        e.preventDefault();
                        if (e.dataTransfer) {
                            e.dataTransfer.dropEffect = "move";
                        }
                        settingEl.classList.add("drag-over");
                    }
                });

                settingEl.addEventListener("dragleave", () => {
                    settingEl.classList.remove("drag-over");
                });

                settingEl.addEventListener("drop", (e) => {
                    e.preventDefault();
                    settingEl.classList.remove("drag-over");
                    if (this.dragIndex === null || this.dragIndex === index) return;

                    const fields = this.plugin.settings.customMetadataFields;
                    const draggedField = fields[this.dragIndex];
                    fields.splice(this.dragIndex, 1);
                    fields.splice(index, 0, draggedField);

                    void this.plugin.saveSettings().then(() => {
                        this.display();
                    });
                });

                setting.addButton((button) => {
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

        new Setting(this.containerEl)
            .setName("Retain formatting")
            .setDesc("When enabled, italics, bold, and superscript formatting from logos will be preserved")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.retainFormatting)
                    .onChange(async (value) => {
                        this.plugin.settings.retainFormatting = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(this.containerEl)
            .setName("Show ribbon icon")
            .setDesc("Toggle the church icon in the Obsidian ribbon for one-click pasting")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.showRibbonIcon)
                    .onChange(async (value) => {
                        this.plugin.settings.showRibbonIcon = value;
                        await this.plugin.saveSettings();
                        (this.plugin as unknown as { refreshRibbonIcon: () => void }).refreshRibbonIcon();
                    })
            );
    }
}
