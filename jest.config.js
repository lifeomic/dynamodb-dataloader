module.exports = {
  ...require('@lifeomic/typescript-tools/config/jest'),
  clearMocks: true,
  collectCoverage: true,
  coverageThreshold: {
    global: {
      branches: 100,
      statements: 100,
      functions: 100,
      lines: 100
    }
  },
  collectCoverageFrom: ['<rootDir>/src/**/*.ts']
};
