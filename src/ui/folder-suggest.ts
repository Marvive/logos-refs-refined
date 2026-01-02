/**
 * Custom auto-completion and suggestion engine for Logos References
 */

import { AbstractInputSuggest, App, TFolder } from "obsidian";

/**
 * Enhanced suggestion engine tailored for folder selection
 */
export class FolderSuggest extends AbstractInputSuggest<TFolder> {
    constructor(app: App, inputEl: HTMLInputElement) {
        super(app, inputEl);
    }

    getSuggestions(query: string): TFolder[] {
        const lowerCaseQuery = query.toLowerCase();
        return this.app.vault.getAllLoadedFiles()
            .filter((f): f is TFolder => f instanceof TFolder && f.path.toLowerCase().includes(lowerCaseQuery))
            .slice(0, 100);
    }

    renderSuggestion(folder: TFolder, el: HTMLElement): void {
        el.setText(folder.path);
    }

    selectSuggestion(folder: TFolder): void {
        this.setValue(folder.path);
        this.close();
    }
}
