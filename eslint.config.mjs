import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";

export default [
    {
        files: ["**/*.ts"],
        plugins: {
            "@typescript-eslint": typescriptEslint,
            import: importPlugin,
        },

        languageOptions: {
            parser: tsParser,
            ecmaVersion: 2022,
            sourceType: "module",
        },

        rules: {
            // 🔤 Nommage clair
            "@typescript-eslint/naming-convention": [
                "warn",
                {
                    selector: "variable",
                    format: ["camelCase", "UPPER_CASE"],
                },
                {
                    selector: "function",
                    format: ["camelCase"],
                },
                {
                    selector: "typeLike",
                    format: ["PascalCase"],
                },
                {
                    selector: "import",
                    format: ["camelCase", "PascalCase"],
                },
            ],

            // 🔄 Bonnes pratiques JS/TS
            curly: "warn",          // Toujours utiliser des accolades
            eqeqeq: "warn",         // Toujours === / !==
            "no-throw-literal": "warn",
            semi: "warn",

            // 📦 Organisation des imports
            "import/order": [
                "warn",
                {
                    groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
                },
            ],
            "sort-imports": [
                "warn",
                {
                    ignoreCase: true,
                    ignoreDeclarationSort: true,
                },
            ],

            // ❌ Debugging
            "no-debugger": "error",
        },
    },
];
