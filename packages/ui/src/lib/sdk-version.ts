// Moved to core (ADR 0020). The subpath import — not the package index —
// keeps core's native modules out of the WebView bundle.
export {
  getSdkHeaders,
  mergeSdkHeaders,
  SDK_VERSION,
} from '@youversion/platform-react-native-expo-core/sdk-version'
export type { SdkHeaders } from '@youversion/platform-react-native-expo-core/sdk-version'
