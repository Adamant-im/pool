import globals from 'globals';
import js from '@eslint/js';
import json from '@eslint/json';
import markdown from '@eslint/markdown';
import pluginJest from 'eslint-plugin-jest';
import stylistic from '@stylistic/eslint-plugin';

import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
    globalIgnores(['package-lock.json']),
    {
        files: ['**/*.{js,mjs,cjs}'],
        plugins: { js, '@stylistic': stylistic },
        languageOptions: { globals: globals.node },
        extends: ['js/recommended'],
        rules: {
            '@stylistic/semi': ['error', 'always'],
            '@stylistic/no-trailing-spaces' : ['error'],
            '@stylistic/object-curly-spacing': ['error', 'always'],
            '@stylistic/quotes': ['error', 'single'],
            '@stylistic/comma-dangle': ['error', 'always-multiline'],
            'sort-imports': ['error', {
                    'memberSyntaxSortOrder': ['none', 'all', 'multiple', 'single'],
                    'allowSeparatedGroups': true,
                },
            ],
        },
    },
    {
        files: ['**/*.test.js'],
        plugins: { jest: pluginJest },
        languageOptions: { globals: pluginJest.environments.globals.globals },
    },
    // { files: ["**/*.{js,mjs,cjs}"], languageOptions: { globals: globals.browser } },
    { files: ['**/*.json'], plugins: { json }, language: 'json/json', extends: ['json/recommended'] },
    { files: ['**/*.jsonc'], plugins: { json }, language: 'json/jsonc', extends: ['json/recommended'] },
    { files: ['**/*.md'], plugins: { markdown }, language: 'markdown/gfm', extends: ['markdown/recommended'] },
]);
