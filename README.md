# Logos-refs Refined
![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/Marvive/logos-refs-refined?style=for-the-badge&sort=semver)

- Simplify referencing and linking material from Logos Bible Software
- Easily aggregate bibtex references for your note
- **Customizable Callouts**: Change callout titles and use a consistent church icon style with custom colors.
- **Improved Note Naming**: Automatically use book titles for note filenames with special character stripping for OS compatibility.
- **Bible Verse Linking**: Automatically detect Bible verses and link them to Logos with your preferred translation (NIV, ESV, NASB, LSB, NLT).
- **Custom Metadata**: Prepend custom categories/keys to generated notes automatically.

## Example Use
Copy a passage from logos and utilize the paste command within logos-ref plugin, and automatically generate or reference a citation note.

## Features & Settings
- **Callout Title**: Customize the header of the pasted reference block.
- **Append "References" to Title**: Use `{Book Title} - References` instead of BibTeX IDs.
- **Auto-link Bible Verses**: Toggle verse detection and choose your preferred Bible version for Logos links.
- **Metadata Management**: Enable YAML frontmatter and manage a list of categories to be added to every new reference note as separate properties.
- **Newline Formatting**: Optional clean spacing between links.

## Setup notes
1. Make sure community plugins are turned on, and install the logos-refs-refined plugin
2. Under the logos-refs settings, set your reference directory (I like having a `refs` folder)
3. In Logos, under program settings, set citation style to `BibTeX Style`
4. You are ready to go!

## Development
This refined version is maintained by Michael Marvive. All bugs and feature requests should be filed under the [Issues](https://github.com/Marvive/logos-refs-refined/issues) in this repo.

---

> For those who want to show their appreciation for project development. 👍
>
> - 👉 `Star` the Project
> - ☕️ **Buy me a coffee** @[Github Sponsor](https://github.com/sponsors/michaelmarvive)
> - ❤️ Provide Feedback in [`Issues`](https://github.com/Marvive/logos-refs-refined/issues) 
