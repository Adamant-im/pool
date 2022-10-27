module.exports = {
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  env: {
    es2021: true,
    browser: true,
  },
  extends: ['eslint:recommended', 'google'],
  plugins: [
    'svelte3',
  ],
  ignorePatterns: ['dist/**/*'],
  overrides: [
    {
      files: ['src/*.svelte'],
      processor: 'svelte3/svelte3',
    },
  ],
  rules: {
    'max-len': [
      'error',
      {
        code: 200,
        ignoreTrailingComments: true,
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignoreRegExpLiterals: true,
      },
    ],
    'require-jsdoc': 'off',
    'quote-props': 'off',
  },
};
