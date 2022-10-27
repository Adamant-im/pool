module.exports = {
  env: {
    commonjs: true,
    es2021: true,
    browser: true,
    node: true,
    'jest/globals': true,
  },
  extends: ['eslint:recommended', 'google'],
  plugins: ['jest'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  ignorePatterns: ['src/server/public/**/*.js'],
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
