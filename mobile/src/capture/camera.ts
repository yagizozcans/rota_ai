import type { Camera } from 'react-native-vision-camera';
import type { PhotoResult } from './captureController';

/**
 * Thin wrapper over vision-camera's still capture. Captures at native
 * resolution (no downscale) so distant/small signs survive for the AI pipeline
 * (02 §2, plan Q10). The <Camera> component and its ref live in the UI; this
 * only turns a ref into a photo, so the capture layer never imports UI.
 */
export async function takePhoto(camera: Camera): Promise<PhotoResult> {
  const photo = await camera.takePhoto({ flash: 'off', enableShutterSound: false });
  return {
    path: photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`,
    width: photo.width,
    height: photo.height,
  };
}
