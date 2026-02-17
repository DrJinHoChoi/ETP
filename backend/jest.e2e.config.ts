import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.e2e-spec.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@etp/shared(.*)$': '<rootDir>/../shared/src$1',
    '^uuid$': '<rootDir>/src/__mocks__/uuid.ts',
  },
  testTimeout: 30000,
};

export default config;
