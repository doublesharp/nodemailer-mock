module.exports = {
  extends: '@istanbuljs/nyc-config-typescript',
  'check-coverage': true,
  'per-file': true,
  statements: 100,
  branches: 100,
  functions: 100,
  lines: 100,
  all: true,
  include: ['src/**/!(*.test.*).[tj]s?(x)'],
  reporter: ['html', 'lcov', 'text', 'cobertura', 'text-summary'],
  'report-dir': 'coverage',
};
