module.exports = {
  extends: '@istanbuljs/nyc-config-typescript',
  'check-coverage': true,
  all: true,
  include: ['src/**/!(*.test.*).[tj]s?(x)'],
  reporter: ['html', 'lcov', 'text', 'cobertura', 'text-summary'],
  'report-dir': 'coverage',
};
