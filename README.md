# Logos References
![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/MichaelMarvive/logos-references?style=for-the-badge&sort=semver)

Logos References is an overhauled and highly customizable version of the original [logos-refs](https://github.com/joey-kilgore/logos-refs) plugin by Joey Kilgore. This version features a complete architectural overhaul, ongoing maintenance, and many new features for power users.

- Simplify referencing and linking material from Logos Bible Software
- Easily aggregate bibtex references for your note
- **Customizable Callouts**: Change callout titles and use a consistent church icon style with custom colors.
- **Improved Note Naming**: Automatically use book titles for note filenames with special character stripping for OS compatibility.
- **Bible Verse Linking**: Automatically detect Bible verses and link them to Logos with your preferred translation (NIV, ESV, NASB, LSB, NLT).
- **Custom Metadata**: Prepend custom categories/keys to generated notes automatically.

## Example Use
Copy a passage from logos and utilize the paste command within **Logos References** plugin, and automatically generate or reference a citation note.

## Features & Settings
- **Callout Title**: Customize the header of the pasted reference block.
- **Append "References" to Title**: Use `{Book Title} - References` instead of BibTeX IDs.
- **Auto-link Bible Verses**: Toggle verse detection and choose your preferred Bible version for Logos links.
- **Metadata Management**: Enable YAML frontmatter and manage a list of categories to be added to every new reference note as separate properties.
- **Newline Formatting**: Optional clean spacing between links.

## Setup notes
1. Make sure community plugins are turned on, and install the **Logos References** plugin
2. Under the **Logos References** settings, set your reference directory (I like having a `logos-references` folder)
3. In Logos, under program settings, set citation style to `BibTeX Style`
4. You are ready to go!

## Credits
Based on the original work by [Joey Kilgore](https://github.com/joey-kilgore). This version represents a complete overhaul and expansion of the original plugin's capabilities.

## Development
Maintained by **Michael Marvive**. All bugs and feature requests should be filed under the [Issues](https://github.com/Marvive/logos-references/issues).

---

> For those who want to show their appreciation for project development. 👍
>
> - 👉 `Star` the Project
> - ☕️ **Buy me a coffee** @[Github Sponsor](https://github.com/sponsors/Marvive) <iframe src="https://github.com/sponsors/Marvive/button" title="Sponsor Marvive" height="32" width="114" style="border: 0; border-radius: 6px;"></iframe>
> - ❤️ Provide Feedback in [`Issues`](https://github.com/Marvive/logos-references/issues)
<iframe src="https://github.com/sponsors/Marvive/card" title="Sponsor Marvive" height="225" width="600" style="border: 0;"></iframe>
