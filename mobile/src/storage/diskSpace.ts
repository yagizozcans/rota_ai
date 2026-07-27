import RNFS from 'react-native-fs';

/**
 * Free storage on the device, in bytes — feeds the HUD's remaining-hours
 * estimate (01 §3.6). Native; the pure estimate math lives in ui/hud/hudCompute.
 */
export async function freeStorageBytes(): Promise<number> {
  const info = await RNFS.getFSInfo();
  return info.freeSpace;
}
