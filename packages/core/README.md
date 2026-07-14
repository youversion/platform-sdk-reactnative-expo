![License](https://img.shields.io/badge/license-Apache%202.0-blue)

# @youversion/platform-react-native-expo-core

Auth and storage primitives for the YouVersion Platform React Native (Expo) SDK: installation id, optional PKCE OAuth, and token storage.

## When to use this package

Use `@youversion/platform-react-native-expo-core` when you need:

- ✅ Sign-in via optional PKCE OAuth (`useYVAuth`, `auth` config on the provider)
- ✅ A YouVersion installation id for your app
- ✅ Token storage handled for you (`expo-secure-store` + MMKV)

**Use other packages instead if you:**

- ❌ Want ready-made Bible UI → use [@youversion/platform-react-native-expo-ui](https://www.npmjs.com/package/@youversion/platform-react-native-expo-ui)

Most apps get this package as a dependency of the UI package, but install it directly so TypeScript resolves the auth APIs. Import Bible components from the UI package; import `useYVAuth` from core.

## Install

```bash
npx expo install @youversion/platform-react-native-expo-core
```

Requires Expo SDK 56+, React 19, and a [development build](https://docs.expo.dev/develop/development-builds/introduction/) (not Expo Go — the SDK relies on native modules). Peer dependencies are listed in [`package.json`](./package.json).

Get your App Key at [platform.youversion.com](https://platform.youversion.com/).

## Usage

Configure `auth` on the provider, then read auth state with `useYVAuth`:

```tsx
import { Text } from 'react-native'
import { YouVersionProvider, useYVAuth } from '@youversion/platform-react-native-expo-core'

function Profile() {
  const { isAuthenticated, userInfo, signIn, signOut } = useYVAuth()
  return <Text>{isAuthenticated ? userInfo?.name : 'Signed out'}</Text>
}

export default function App() {
  return (
    <YouVersionProvider appKey="YOUR_APP_KEY" auth={{ redirectUri: 'yourapp://callback' }}>
      <Profile />
    </YouVersionProvider>
  )
}
```

## Documentation and API Reference

- [React Native (Expo) SDK Quick Start](https://developers.youversion.com/sdks/react-native)

## License

This SDK is licensed under [Apache 2.0](./LICENSE).

Licensing information for the Bible versions is available at the [YouVersion Platform](https://platform.youversion.com/) site.
