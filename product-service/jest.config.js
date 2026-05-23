module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/lambda"],
  testMatch: ["**/*.spec.ts"],
  moduleFileExtensions: ["ts", "js"],
  transform: {
    "^.+\\.ts$": ["ts-jest", {
      tsconfig: {
        esModuleInterop: true,
      },
    }],
  },
  transformIgnorePatterns: [
    "node_modules/(?!(uuid)/)",
  ],
  collectCoverageFrom: ["lambda/**/*.ts", "!lambda/**/*.spec.ts"],
};
