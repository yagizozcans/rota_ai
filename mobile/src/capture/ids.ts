import { v4 as uuidv4 } from 'uuid';

/**
 * UUID v4 generator for client-minted ids (frame_id, session_id — plan Q1).
 * Requires the `react-native-get-random-values` polyfill, imported once at app
 * entry (index.js) before this is used on device.
 */
export const newUuid = (): string => uuidv4();
