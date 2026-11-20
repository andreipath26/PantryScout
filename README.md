# PantryScout

**Save recipes from anywhere. Know what is in your kitchen. Get dinner sorted.**

PantryScout is a personal cooking app built around the full path from finding a recipe to cooking and shopping for it. Pantry based meal ideas are one feature, not the whole product.

## Product areas

- **Recipe inbox:** capture a recipe link or pasted recipe text, keep its source, and review the imported result. Recipe pages that publish Schema.org Recipe data are parsed into ingredients, steps, timing, and servings; other links are saved for manual completion.
- **Personal cookbook:** save, search, tag, create, and revisit recipes.
- **Pantry:** keep a lightweight list of ingredients and items to use soon.
- **PantryScout ideas:** rank saved recipes by pantry match and create a flexible recipe idea from available ingredients.
- **Meal planner:** assign cookbook recipes to days of the week.
- **Shopping list:** combine missing ingredients from recipes and plans, check items off, and add freeform items.
- **Cook mode:** follow one recipe step at a time from a phone.

## Current build

The initial mobile app foundation is an Expo + React Native + TypeScript app for Android and iOS, with a web preview target. It stores the cookbook, pantry, plan, and shopping list locally on the device. It includes sample content so the connected flows are visible immediately.

Recipe text can be pasted into the importer and the source link is retained. A link without readable recipe text is saved for review. Direct extraction from social video, webpage parsing, photo/OCR import, cloud accounts, and household syncing need the next service layer; this build does not claim those integrations are complete.

## Run it

```sh
npm install
npm run start
```

Then use Expo Go or a development build on Android/iOS. For the web preview, run `npm run web`.

## Android preview build

The GitHub Actions **Android APK** workflow builds a debug APK on pull requests and pushes. Download the `pantryscout-android-debug` artifact from the completed workflow run, install the APK on an Android device, and open PantryScout. The APK is unsigned for Play Store release, but can be installed for direct testing.

## Working principles

- Keep imported and user-created content clearly distinguished and editable.
- Preserve the source URL and creator attribution when a recipe is imported.
- Make the pantry quick to maintain; do not require perfect quantities to get useful ideas.
- Show what a pantry suggestion uses and what it still needs.
- Treat allergies and dietary exclusions as explicit user constraints, not soft preferences.
- Keep the app useful even when a social platform does not allow automatic extraction.
