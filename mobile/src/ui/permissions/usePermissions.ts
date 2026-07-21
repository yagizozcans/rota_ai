import { useCallback, useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { useCameraPermission } from 'react-native-vision-camera';

/**
 * Camera + fine-location permission gate. Every failure mode is an explicit UI
 * state (ARCHITECTURE RULES): 'checking' while unresolved, 'granted' to enter
 * the capture screen, 'denied' to show the rationale + retry.
 */
export type PermStatus = 'checking' | 'granted' | 'denied';

export function usePermissions() {
  const { hasPermission: hasCamera, requestPermission: requestCamera } = useCameraPermission();
  const [hasLocation, setHasLocation] = useState<boolean | null>(null);
  const requestedOnce = useRef(false);

  const request = useCallback(async (): Promise<boolean> => {
    const cam = hasCamera || (await requestCamera());
    let loc = true;
    if (Platform.OS === 'android') {
      const res = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      loc = res === PermissionsAndroid.RESULTS.GRANTED;
    }
    setHasLocation(loc);
    return cam && loc;
  }, [hasCamera, requestCamera]);

  useEffect(() => {
    if (requestedOnce.current) {
      return;
    }
    requestedOnce.current = true;
    request();
  }, [request]);

  const status: PermStatus =
    hasLocation == null ? 'checking' : hasCamera && hasLocation ? 'granted' : 'denied';

  return { status, request };
}
