# PantryScout roadmap

## Milestone 1 — Connected client foundation

- [x] Expo / React Native app shell for Android and iOS
- [x] Today, cookbook, pantry, planner, shopping list, and cook-mode views
- [x] Local persistence for personal recipes, pantry, plan, and shopping list
- [x] Manual recipe creation and pasted-text/link inbox
- [x] Pantry matching and first local recipe-creation flow
- [ ] Replace sample content with a first-run onboarding flow
- [ ] Improve generated recipe structure and let the user constrain pantry-only versus allowed missing items

## Milestone 2 — Recipe capture that works in real life

- [ ] Native share sheet / Android intent capture
- [ ] Web recipe-page parser with source and attribution metadata
- [ ] Import review screen with ingredient and instruction confidence
- [ ] Photo and handwritten recipe OCR
- [ ] Social-video import through supported share/content access, with transcript/caption fallbacks
- [ ] Duplicate detection and import error recovery

## Milestone 3 — Household kitchen data

- [ ] Pantry categories, quantity units, freezer/fridge/cupboard locations, and expiry reminders
- [x] Barcode lookup, fridge-photo food labels, and receipt OCR with an editable confirmation step (on-device image processing; barcode product lookup uses Open Food Facts)
- [ ] Improve receipt-line parsing and validate Lidl, Aldi, Auchan, Carrefour, and other French receipt layouts against a real receipt corpus
- [ ] PDF / retailer-account order import, image-label coverage improvements, expiry suggestions, and pantry location selection
- [ ] Update pantry from cooking and completed shopping lists
- [ ] Preferences, servings, equipment, time budget, hard allergy exclusions, and disliked ingredients
- [ ] Export and restore user data

## Milestone 4 — Planning and collaboration

- [ ] Household accounts and encrypted-in-transit cloud sync
- [ ] Shared cookbooks, pantry, meal plan, and shopping list
- [ ] Meal-plan reuse, leftovers, and ingredient overlap optimization
- [ ] Store/aisle organization and regional units/localization

## Milestone 5 — Release readiness

- [ ] Accessibility pass and localization
- [ ] Privacy disclosures, data deletion/export, and platform permission review
- [ ] Android/iOS release builds and store assets
- [ ] Crash reporting and consent-aware product analytics
- [ ] Device testing, import corpus evaluation, and release checklist
