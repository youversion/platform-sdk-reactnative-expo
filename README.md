# YouVersion Platform React Native Expo SDK

A React Native SDK for integrating [YouVersion Platform](https://platform.youversion.com/) features into Expo apps using [Expo DOM Components](https://docs.expo.dev/guides/dom-components/).

Built on top of the [React Web SDK](https://github.com/youversion/platform-sdk-react) (`@youversion/platform-react-ui`), wrapping web components as native DOM components while providing native affordances (sheets, navigation, storage) via React Native.

## Prerequisites

- Node.js >= 20.0.0
- pnpm 9+
- Expo SDK 55+

## Getting Started

```bash
# Install dependencies
pnpm install

# Start the example app
cd apps/example
pnpm start
```

## Project Structure

```
packages/ui/src/
├── dom/           ← Expo DOM components ("use dom") wrapping the React Web SDK
├── native/        ← React Native components (sheets, pickers, screens)
└── lib/           ← Native adapters, hooks, constants
```

## Contributing

> [!NOTE]
> We are not yet accepting pull requests from external contributors, though we intend to do so in the future. In the meantime, we welcome you to use the SDK, report bugs via [GitHub Issues](https://github.com/youversion/platform-sdk-reactnative-expo/issues), and share feedback.

## License

This SDK is licensed under [Apache 2.0](./LICENSE).