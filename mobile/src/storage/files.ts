import RNFS from 'react-native-fs';

/**
 * Durable on-device JPEG storage for captured frames. vision-camera writes to a
 * temp/cache path the OS may reclaim; we move each photo into the app's document
 * directory so it survives until upload (offline-first durability, 01 §3.3).
 * Deletion after confirmed upload is added in the sync slice.
 */

const FRAME_DIR = `${RNFS.DocumentDirectoryPath}/frames`;

/** Where captured JPEGs are stored on device (shown in the HUD path tag, 01 §3.6). */
export function frameStoreDir(): string {
  return FRAME_DIR;
}

/** Path RNFS expects (no file:// scheme). */
function toFsPath(path: string): string {
  return path.startsWith('file://') ? path.replace('file://', '') : path;
}

/** Move a freshly captured photo into durable storage; returns its stored path. */
export async function persistPhoto(tempPath: string, frameId: string): Promise<string> {
  const exists = await RNFS.exists(FRAME_DIR);
  if (!exists) {
    await RNFS.mkdir(FRAME_DIR);
  }
  const dest = `${FRAME_DIR}/${frameId}.jpg`;
  await RNFS.moveFile(toFsPath(tempPath), dest);
  return dest;
}
