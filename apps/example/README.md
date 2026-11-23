# YouVersion SDK Demo

A demo app showcasing `@youversion/platform-react-native-expo-ui` components.

## Setup

```bash
cp .env.example .env
# Add your YouVersion App Key (EXPO_PUBLIC_YOUVERSION_APP_KEY) to .env
pnpm install

# Build the dev client (first run only — Expo Go is not supported)
pnpm build:ios       # or: pnpm build:android

# Subsequent runs
pnpm start
```

Get an App Key from the [YouVersion Platform Developer Console](https://platform.youversion.com).

For **Sign in with YouVersion**, also register `yvp-rn-example://callback` as a Callback URI in the console for your App Key.

## Tabs

- **Bible** — Full interactive Bible reader with chapter and version navigation
- **Content** — Verse-art images in a grid. Search uses the reader's Bible version, and Load more fetches the next page. Open an image to shuffle through other art for that passage, view it full screen, share it, or read the passage in the Bible tab.
- **Examples** — Verse of the Day and Bible Card. Each opens on its own screen, and the back button returns to the list.
- **Profile** — Sign in with YouVersion

## React SDK Components Used

- **Bible Reader** — Full interactive Bible reader with chapter/version navigation
- **Verse of the Day** — Daily verse card, under Examples
- **Bible Card** — Embeddable Bible passage card, under Examples
- **Sign in with YouVersion Button** — Authentication with YouVersion

## Troubleshooting

If the dev client won't build or start, or you see peer-dependency version warnings — usually after a fresh install or an Expo SDK bump — your packages are likely out of sync with the SDK. Realign them to the versions Expo expects, then rebuild:

```bash
pnpm fix:deps          # runs: expo install --fix
pnpm build:ios         # or: pnpm build:android
```

`expo install --fix` only realigns versions of packages already in `package.json`; it does not add missing peer dependencies. Run it any time you change the Expo SDK version.
