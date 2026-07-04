module.exports = {
  testEnvironment: 'jsdom',
  moduleFileExtensions: ['ts', 'js', 'json', 'vue'],
  transform: {
    '^.+\\.vue$': '<rootDir>/__tests__/vueTransformer.cjs',
    '^.+\\.(ts|js)$': 'babel-jest'
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss)$': '<rootDir>/__tests__/styleMock.cjs'
  },
  testMatch: ['**/__tests__/**/*.test.ts']
};
