import js from "@eslint/js";
import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";

export default tseslint.config(
    {
        ignores: [
            "node_modules/",
            "main.js",
            "dist/",
            "coverage/",
            "jest.config.js",
            "esbuild.config.mjs",
            "version-bump.mjs",
            "eslint.config.mjs",
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    {
        files: ["**/*.ts"],
        languageOptions: {
            parserOptions: {
                project: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        plugins: {
            "obsidianmd": obsidianmd,
        },
        rules: {
            ...obsidianmd.configs.recommended,
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": ["error", { "args": "none" }],
            "@typescript-eslint/ban-ts-comment": "off",
            "no-prototype-builtins": "off",
            "@typescript-eslint/no-empty-function": "off",
            "@typescript-eslint/no-explicit-any": "warn",
        },
    },
);
