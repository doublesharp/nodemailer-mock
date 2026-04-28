const typescriptEslint = require('@typescript-eslint/eslint-plugin');

const nodeGlobals = {
  Buffer: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  clearImmediate: 'readonly',
  clearInterval: 'readonly',
  clearTimeout: 'readonly',
  console: 'readonly',
  exports: 'writable',
  global: 'readonly',
  module: 'readonly',
  process: 'readonly',
  require: 'readonly',
  setImmediate: 'readonly',
  setInterval: 'readonly',
  setTimeout: 'readonly',
};

const testGlobals = {
  after: 'readonly',
  afterEach: 'readonly',
  before: 'readonly',
  beforeEach: 'readonly',
  describe: 'readonly',
  expect: 'readonly',
  it: 'readonly',
  jest: 'readonly',
  test: 'readonly',
  vi: 'readonly',
};

module.exports = [
  {
    ignores: ['coverage/**', 'node_modules/**', 'lib-cov/**', 'build/**', 'tmp/**', 'dist/**'],
  },
  ...typescriptEslint.configs['flat/recommended'],
  {
    files: ['**/*.{js,cjs,mjs,ts}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...nodeGlobals,
        ...testGlobals,
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'max-len': [
        'error',
        120,
        2,
        {
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
        },
      ],
      quotes: [
        'error',
        'single',
        {
          avoidEscape: true,
        },
      ],
    },
  },
];
