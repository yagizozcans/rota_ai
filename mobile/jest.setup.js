/* eslint-env jest */
/**
 * Mocks for native modules that have no JS implementation under jest. Keeps the
 * component render smoke-test able to mount the tree without a device. Pure
 * logic (capture triggers, storage SQL, HUD math) is tested directly elsewhere.
 */

// uuid v9 ships ESM that jest won't transform under node_modules; the app code
// under test injects its own id factory, so a stub is sufficient here.
jest.mock('uuid', () => ({ v4: () => '00000000-0000-4000-8000-000000000000' }));

jest.mock('react-native-vision-camera', () => ({
  Camera: 'Camera',
  useCameraDevice: () => ({ id: 'back-camera' }),
  useCameraPermission: () => ({
    hasPermission: false,
    requestPermission: jest.fn(async () => false),
  }),
}));

jest.mock('react-native-geolocation-service', () => ({
  __esModule: true,
  default: { watchPosition: jest.fn(() => 1), clearWatch: jest.fn() },
}));

jest.mock('react-native-fs', () => ({
  __esModule: true,
  default: {
    DocumentDirectoryPath: '/mock/docs',
    mkdir: jest.fn(async () => undefined),
    moveFile: jest.fn(async () => undefined),
    exists: jest.fn(async () => true),
    getFSInfo: jest.fn(async () => ({ freeSpace: 1_000_000_000, totalSpace: 2_000_000_000 })),
    stat: jest.fn(async () => ({ size: 0 })),
  },
}));

jest.mock('react-native-sqlite-storage', () => ({
  __esModule: true,
  default: {
    enablePromise: jest.fn(),
    openDatabase: jest.fn(async () => ({
      executeSql: jest.fn(async () => [{ rows: { length: 0, item: () => ({}) } }]),
    })),
  },
}));
