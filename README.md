# PantryScout

**Save it. Stock it. Plan it. Cook it.**

PantryScout brings recipes, pantry tracking, meal planning, shopping, and cook mode into one home-cooking app. It helps you find a useful next meal from the food you already have, while keeping your own recipe collection close at hand.

> PantryScout is an active preview build. Some flows are still being validated, and this is not a production or app-store release.

## What you can do

- **Keep a personal cookbook.** Create and edit recipes, search saved recipes, and preserve the source link when you import one.
- **Capture recipes.** Paste recipe text or a link. Recipe pages that expose structured Recipe data can be imported; if a page cannot be read, keep the link and finish the recipe later.
- **Discover online recipes.** Search by dish or ingredient, compare a result with your pantry, open the original source, and save recipes to your collection.
- **Track your pantry.** Add items manually, scan product barcodes, photograph food for on-device label suggestions, or scan a grocery receipt. Review and edit detected items before adding them.
- **Get ideas from what you have.** Ask PantryScout to create a recipe idea from the current pantry. On supported Android builds, the bundled local model generates the idea; a deterministic fallback is available when the model cannot run.
- **Plan meals and shop.** Assign saved recipes to days, build a shopping list from ingredients you are missing, and check items off as you shop.
- **Cook step by step.** Open a saved recipe in cook mode and follow its instructions from your phone.
- **Choose your look.** Light, dark, and system appearance modes are available.

## Screenshots

Screenshots of the live app will be added here after they can be captured from a running device build. The design reference image is intentionally not presented as an app screenshot.

## Local AI and privacy

The Android APK bundles the **Qwen3 0.6B** language model. PantryScout copies it into the app's private storage on first use and runs inference on the device CPU. Receipt photos are processed with on-device text recognition; the bundled model can normalize the recognized lines. Pantry-based recipe ideas are also generated locally on supported Android builds. The app validates the model's structured output and shows detected pantry items for review before saving them.

The model adds roughly **330 MiB** to the Android APK. Model provenance and license information are documented in [docs/THIRD_PARTY_MODELS.md](docs/THIRD_PARTY_MODELS.md). No cloud language-model API is used for these local-AI flows.

Some other features do use online services: online recipe discovery uses TheMealDB, and barcode lookup queries Open Food Facts. Recipe searches require an internet connection. Recipe and pantry data are otherwise stored locally on the device in this preview build; household accounts and cloud sync are not included.

## Current limitations

- Automatic recipe import depends on the source page exposing readable structured recipe data. Social-video extraction and broad site-specific import support are not included.
- Barcode lookup depends on the product being listed in Open Food Facts. You can enter an unmatched product manually.
- Fridge-photo recognition proposes likely food labels; it is not guaranteed to identify every item. Receipt parsing can also miss or misread lines. Review all suggestions before adding them.
- Receipt layouts from Lidl, Aldi, Auchan, Carrefour, and other retailers still need broader validation against real receipts.
- TheMealDB development key is intended for development and educational use. A supporter key is needed before a public app-store release.
- Household sync, retailer account/order integrations, expiry notifications, and comprehensive allergy/dietary preference controls are not part of this preview.

See [docs/PRODUCT.md](docs/PRODUCT.md) for the product scope and [docs/ROADMAP.md](docs/ROADMAP.md) for the current implementation status.

## Run the app

Requirements: Node.js and npm. Android development additionally needs Android Studio/SDK; iOS development needs macOS and Xcode.

```sh
npm install
npm run start
```

Use Expo Go for a basic UI preview. Native camera, share-target, barcode, and bundled-model features require a native development build or the Android APK. To run the web preview:

```sh
npm run web
```

## Install an Android test APK

The **Android APK** GitHub Actions workflow creates a self-contained release APK on pull requests and pushes. Open the completed workflow run and download the `pantryscout-android-release` artifact. The APK includes its JavaScript bundle and does not need Metro or a computer running next to the phone.

This is a test build signed with the repository's debug key. It is not suitable for publishing to Google Play. The large bundled model also means APK downloads can take a while.

## Built with

- Expo, React Native, and TypeScript
- AsyncStorage for on-device app data
- LiteRT-LM with a bundled Qwen3 0.6B model on Android
- ML Kit text recognition and image labeling
- TheMealDB for online recipe discovery
- Open Food Facts for barcode product lookup

## Contributing

PantryScout is being developed in the open. Before building on a feature, check the current [product brief](docs/PRODUCT.md) and [roadmap](docs/ROADMAP.md). Please include device and OS details when reporting a mobile issue, and remove personal details from any receipt or pantry photos attached to an issue.
