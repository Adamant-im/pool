import js from "@eslint/js";
import globals from "globals";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import {defineConfig, globalIgnores} from 'eslint/config';
import pluginJest from 'eslint-plugin-jest';

export default defineConfig([
  globalIgnores(['package-lock.json']),
  { files: ["**/*.{js,mjs,cjs}"], plugins: { js  }, extends: ["js/recommended"], },
  { files: ["**/*.test.js"], plugins: { jest: pluginJest }, languageOptions: { globals: pluginJest.environments.globals.globals }},
  { files: ["**/*.{js,mjs,cjs}"], languageOptions: { globals: globals.browser } },
  { files: ["**/*.json"], plugins: { json }, language: "json/json", extends: ["json/recommended"] },
  { files: ["**/*.jsonc"], plugins: { json }, language: "json/jsonc", extends: ["json/recommended"] },
  { files: ["**/*.md"], plugins: { markdown }, language: "markdown/gfm", extends: ["markdown/recommended"] },
]);
