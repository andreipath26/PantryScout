# PantryScout

**Save recipes from anywhere. Know what is in your kitchen. Get dinner sorted.**

PantryScout is a personal cooking app built around the full path from finding a recipe to cooking and shopping for it. Pantry based meal ideas are one feature, not the whole product.

## Product areas

- **Recipe inbox:** share a recipe URL from another app or paste a link/text, keep its source, and review the imported result. Recipe pages that publish Schema.org Recipe data are parsed into ingredients, steps, timing, and servings; other links are saved for manual completion.
- **Personal cookbook:** save, search, tag, create, and revisit recipes.
- **Online recipe discovery:** search by dish or cuisine, tap a pantry ingredient for matching ideas, preview the full recipe and source, then save it to the cookbook.
- **Pantry:** keep a lightweight list of ingredients and items to use soon.
- **PantryScout ideas:** rank saved recipes by pantry match and create a flexible recipe idea from available ingredients.
- **Meal planner:** assign cookbook recipes to days of the week.
- **Shopping list:** combine missing ingredients from recipes and plans, check items off, and add freeform items.
- **Cook mode:** follow one recipe step at a time from a phone.
- **Appearance:** choose Light, Dark, or System; the choice is saved on the device.

## Current build

The initial mobile app foundation is an Expo + React Native + TypeScript app for Android and iOS, with a web preview target. It stores the cookbook, pantry, plan, and shopping list locally on the device. It includes sample content so the connected flows are visible immediately.

Recipe text can be pasted into the importer and the source link is retained. A link without readable recipe text is saved for review. Direct extraction from social video, webpage parsing, photo/OCR import, cloud accounts, and household syncing need the next service layer; this build does not claim those integrations are complete.

Online recipe discovery uses TheMealDB's development key for this private test build. TheMealDB says its development key is for development or educational use and requires a supporter key for a public app-store release. Recipe results show TheMealDB attribution and preserve the original recipe source.

## Run it

```sh
npm install
npm run start
```

Then use Expo Go for the UI preview. Incoming system shares require a native development build or the Android APK because Expo Go cannot register PantryScout as a share target. For the web preview, run `npm run web`.

## Android preview build

The GitHub Actions **Android APK** workflow builds a self-contained release APK on pull requests and pushes. Download the `pantryscout-android-release` artifact from the completed workflow run and install it on an Android device. It includes the JavaScript bundle and does not need Metro or a computer running beside the phone. The test APK uses the repository's debug signing key and is not a Play Store release.

## Working principles

- Keep imported and user-created content clearly distinguished and editable.
- Preserve the source URL and creator attribution when a recipe is imported.
- Make the pantry quick to maintain; do not require perfect quantities to get useful ideas.
- Show what a pantry suggestion uses and what it still needs.
- Treat allergies and dietary exclusions as explicit user constraints, not soft preferences.
- Keep the app useful even when a social platform does not allow automatic extraction.
# PantryScout local AI

Android builds bundle the Qwen3 0.6B LiteRT-LM model inside the APK. The first local-AI request copies the model to the app's private storage; inference runs on the CPU. Receipt images are OCR'd on-device, then the local model proposes structured receipt lines that are checked against the OCR text before the user reviews them. Pantry recipe suggestions are constrained to exact names from the local inventory and validated before they are saved. If local inference fails, the app uses its existing deterministic receipt parser and pantry recipe fallback.

The APK is roughly 330 MiB larger because of the included model. Model source and license details are in [docs/THIRD_PARTY_MODELS.md](docs/THIRD_PARTY_MODELS.md).

Android builds need network access in GitHub Actions to fetch the pinned public model artifact. The workflow verifies its size and SHA-256 before packaging it.
