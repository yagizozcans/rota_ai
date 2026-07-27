/**
 * @format
 */

// Must be imported before any uuid usage — provides crypto.getRandomValues on RN.
import 'react-native-get-random-values';
import { AppRegistry } from 'react-native';
import App from './src/ui/App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
