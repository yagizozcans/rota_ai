module.exports = {
  preset: '@react-native/jest-preset',
  // Ignore macOS AppleDouble sidecar files (._*). They are created on non-APFS
  // volumes and would otherwise be picked up as bogus test suites. They never
  // appear on a normal dev machine / CI; this is belt-and-suspenders.
  testPathIgnorePatterns: ['/node_modules/', '/\\._'],
};
