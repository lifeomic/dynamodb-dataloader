module.exports = {
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  testMatch: [
    '<rootDir>/src/**/*.test.{js,jsx,ts,tsx}',
    '<rootDir>/test/**/*.test.{js,jsx,ts,tsx}',
    '<rootDir>/lambda/**/*.test.{js,jsx,ts,tsx}'
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node', 'mjs'],
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
