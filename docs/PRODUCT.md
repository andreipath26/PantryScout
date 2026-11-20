# PantryScout product brief

## The job to be done

People collect recipes in social saves, browser tabs, screenshots, messages, notes, and family cookbooks. They then have to remember what is in the kitchen, decide what to cook, work out what to buy, and keep scrolling while cooking. PantryScout should connect those jobs in one home cooking workspace.

## Product promise

**Save it. Stock it. Plan it. Cook it.**

PantryScout helps a household turn recipes and ingredients into meals with less searching, planning, and waste.

## Core experiences

1. **Capture:** share or paste a link, paste recipe text, scan or photograph a printed/handwritten recipe, and later import supported video content. Preserve the source and show an editable extraction preview.
2. **Organize:** search and tag a personal cookbook, deduplicate imports, edit ingredients and steps, scale servings, and share recipes with a household.
3. **Know the kitchen:** add pantry and fridge items by typing, barcode/receipt/photo input, or shopping-list import; quantities can be approximate; optionally track use-by dates.
4. **Find or create dinner:** rank saved recipes by pantry fit; offer “only what I have,” “use soon,” and “up to N missing items”; generate an original recipe idea from chosen ingredients and the cook’s time, equipment, servings, and preferences.
5. **Plan and shop:** put recipes on a weekly calendar, combine missing ingredients, remove items already in stock, group the list for shopping, and share it.
6. **Cook:** show one step at a time, keep the screen awake, provide timers and serving adjustments, and let the cook mark what was used so the pantry can be corrected.

## Design principles

- **Fast capture first.** A recipe should be saveable in seconds, including when automatic extraction fails.
- **Useful without perfect inventory.** Users can add items loosely and update them as they cook.
- **Transparent suggestions.** Show pantry matches, missing ingredients, estimated time, and whether content was imported or generated.
- **User control.** People review extracted recipes, edit AI output, remove items, export their data, and choose whether to sync.
- **Safety by design.** Treat allergies as hard exclusions in matching and flag that labels must still be checked. Do not make medical or nutrition-treatment claims.
- **Respect source platforms and creators.** Use supported sharing/import mechanisms, retain attribution, and avoid unauthorized scraping or redistributing full copyrighted material.

## First MVP acceptance path

A new user can open PantryScout, see example recipes and a sample pantry, add or remove pantry items, save or create a recipe, get a pantry-ranked idea, place a recipe on a day, generate a missing-items list, check items off, and follow cook mode. Data persists locally across app launches.

## Explicitly not complete in the first client build

Social/video extraction, OCR, barcode and receipt scanning, authentication, cloud sync, household collaboration, retailer integrations, generated-recipe quality controls, nutrition calculations, notifications, and production privacy/security review require dedicated implementation and validation.
