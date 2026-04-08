import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import vuePlugin from "eslint-plugin-vue";
import astroPlugin from "eslint-plugin-astro";
import * as mdxPlugin from "eslint-plugin-mdx";
import htmlPlugin from "@html-eslint/eslint-plugin";
import htmlParser from "@html-eslint/parser";

const reactRecommended = reactPlugin.configs.flat.recommended;
const reactJsxRuntime = reactPlugin.configs.flat["jsx-runtime"];
const reactHooksRecommended = reactHooksPlugin.configs.flat.recommended;

function toWarnLevel(ruleSetting) {
    if (ruleSetting === "off" || ruleSetting === 0) {
        return ruleSetting;
    }

    if (ruleSetting === "error" || ruleSetting === 2) {
        return "warn";
    }

    if (ruleSetting === "warn" || ruleSetting === 1) {
        return "warn";
    }

    if (Array.isArray(ruleSetting)) {
        const [severity, ...rest] = ruleSetting;
        if (severity === "off" || severity === 0) {
            return ruleSetting;
        }
        return ["warn", ...rest];
    }

    return ruleSetting;
}

function toWarnRules(rules = {}) {
    return Object.fromEntries(
        Object.entries(rules).map(([ruleName, setting]) => [ruleName, toWarnLevel(setting)])
    );
}

function withWarnPluginRules(config) {
    if (!config || !config.rules) {
        return config;
    }

    return {
        ...config,
        rules: toWarnRules(config.rules),
    };
}

export default [
    {
        ignores: ["dist/**", "out/**", "node_modules/**"],
    },
    {
        files: ["**/*.{js,cjs,mjs,jsx,ts,tsx}"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
        },
        rules: {
            curly: "warn",
            eqeqeq: "warn",
            "no-throw-literal": "warn",
            semi: "warn",
        },
    },
    {
        files: ["**/*.{ts,tsx}"],
        plugins: {
            "@typescript-eslint": typescriptEslint,
        },
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 2022,
                sourceType: "module",
                ecmaFeatures: {
                    jsx: true,
                },
            },
        },
        rules: {
            "@typescript-eslint/naming-convention": ["warn", {
                selector: "import",
                format: ["camelCase", "PascalCase"],
            }],
        },
    },
    {
        files: ["**/*.{jsx,tsx}"],
        plugins: {
            ...reactRecommended.plugins,
            ...reactHooksRecommended.plugins,
        },
        languageOptions: {
            ...(reactRecommended.languageOptions || {}),
            parserOptions: {
                ...(reactRecommended.languageOptions?.parserOptions || {}),
                ecmaFeatures: {
                    ...(reactRecommended.languageOptions?.parserOptions?.ecmaFeatures || {}),
                    jsx: true,
                },
            },
        },
        settings: {
            react: {
                version: "detect",
            },
        },
        rules: {
            ...toWarnRules(reactRecommended.rules),
            ...toWarnRules(reactJsxRuntime.rules),
            ...toWarnRules(reactHooksRecommended.rules),
        },
    },
    ...vuePlugin.configs["flat/recommended"].map(withWarnPluginRules),
    ...astroPlugin.configs["flat/recommended"].map(withWarnPluginRules),
    {
        files: ["**/*.html"],
        plugins: {
            "@html-eslint": htmlPlugin,
        },
        languageOptions: {
            parser: htmlParser,
        },
        rules: {
            "@html-eslint/require-doctype": "warn",
            "@html-eslint/require-lang": "warn",
            "@html-eslint/require-title": "warn",
            "@html-eslint/require-img-alt": "warn",
            "@html-eslint/no-duplicate-id": "warn",
            "@html-eslint/no-duplicate-attrs": "warn",
            "@html-eslint/no-obsolete-tags": "warn",
            "@html-eslint/no-obsolete-attrs": "warn",
        },
    },
    {
        ...mdxPlugin.flat,
        rules: toWarnRules(mdxPlugin.flat.rules),
        plugins: {
            ...mdxPlugin.flat.plugins,
            react: reactPlugin,
        },
    },
    {
        ...mdxPlugin.flatCodeBlocks,
        rules: toWarnRules(mdxPlugin.flatCodeBlocks.rules),
    },
];