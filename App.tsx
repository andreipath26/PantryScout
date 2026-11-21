import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useShareIntent } from 'expo-share-intent';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fetchRecipePage } from './recipe-import';
import { searchOnlineMeals, type OnlineMeal } from './online-recipes';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  BackHandler,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  type ScrollViewInstance,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type Tab = 'Today' | 'Recipes' | 'Pantry' | 'Plan' | 'Shop';
type Recipe = {
  id: string;
  title: string;
  description: string;
  minutes: number;
  servings: number;
  ingredients: string[];
  steps: string[];
  tags: string[];
  source?: string;
  imageUrl?: string;
  imageKey?: 'skillet' | 'omelette' | 'bowl' | 'pasta';
  sourceName?: string;
  status?: 'ready' | 'review';
  saved?: boolean;
};
type PantryItem = { id: string; name: string; quantity: string; expires?: string };
type ShopItem = { id: string; name: string; checked: boolean };
type ThemeMode = 'system' | 'light' | 'dark';
type ModalKind = 'import' | 'create' | 'edit' | 'pantry' | 'shop-add' | 'recipe' | 'online-preview' | 'settings' | 'cook' | 'picker' | null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function isPantryItem(value: unknown): value is PantryItem {
  return isRecord(value) && typeof value.id === 'string' && typeof value.name === 'string' && typeof value.quantity === 'string' && (value.expires === undefined || typeof value.expires === 'string');
}
function isShopItem(value: unknown): value is ShopItem {
  return isRecord(value) && typeof value.id === 'string' && typeof value.name === 'string' && typeof value.checked === 'boolean';
}
function isRecipe(value: unknown): value is Recipe {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.description === 'string'
    && typeof value.minutes === 'number'
    && typeof value.servings === 'number'
    && Array.isArray(value.ingredients) && value.ingredients.every((item) => typeof item === 'string')
    && Array.isArray(value.steps) && value.steps.every((item) => typeof item === 'string')
    && Array.isArray(value.tags) && value.tags.every((item) => typeof item === 'string')
    && (value.source === undefined || typeof value.source === 'string')
    && (value.imageUrl === undefined || typeof value.imageUrl === 'string')
    && (value.imageKey === undefined || value.imageKey === 'skillet' || value.imageKey === 'omelette' || value.imageKey === 'bowl' || value.imageKey === 'pasta')
    && (value.sourceName === undefined || typeof value.sourceName === 'string')
    && (value.status === undefined || value.status === 'ready' || value.status === 'review')
    && (value.saved === undefined || typeof value.saved === 'boolean');
}

const STORAGE_KEY = 'pantryscout.v1';
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const RECIPE_IMAGES = {
  skillet: require('./assets/recipes/tomato-chickpea-skillet.jpg'),
  omelette: require('./assets/recipes/spinach-feta-omelette.jpg'),
  bowl: require('./assets/recipes/chickpea-rice-bowl.jpg'),
  pasta: require('./assets/recipes/creamy-tomato-pasta.jpg'),
};
const SEED_PANTRY: PantryItem[] = [
  { id: 'p1', name: 'Eggs', quantity: '6', expires: 'Use soon' },
  { id: 'p2', name: 'Pasta', quantity: '500 g' },
  { id: 'p3', name: 'Spinach', quantity: '1 bag', expires: 'Use soon' },
  { id: 'p4', name: 'Tomatoes', quantity: '4' },
  { id: 'p5', name: 'Chickpeas', quantity: '2 cans' },
  { id: 'p6', name: 'Feta', quantity: '150 g' },
];
const SEED_RECIPES: Recipe[] = [
  {
    id: 'r1', title: 'Tomato & chickpea skillet', description: 'A cozy one-pan dinner with greens and warm spices.', minutes: 25, servings: 2,
    ingredients: ['1 can chickpeas', '3 tomatoes', '2 handfuls spinach', '2 cloves garlic', '1 tsp smoked paprika', 'Olive oil'], imageKey: 'skillet',
    steps: ['Warm olive oil in a skillet and soften the garlic.', 'Add chopped tomatoes, chickpeas and smoked paprika. Simmer for 12 minutes.', 'Fold in the spinach until wilted. Taste, season and serve with bread or rice.'], tags: ['One pan', 'Vegetarian', '25 min'], saved: true,
  },
  {
    id: 'r2', title: 'Spinach & feta omelette', description: 'Fluffy eggs, salty feta and a handful of greens.', minutes: 12, servings: 1,
    ingredients: ['2 eggs', '1 handful spinach', '30 g feta', '1 tsp butter', 'Black pepper'], imageKey: 'omelette',
    steps: ['Beat the eggs with a pinch of pepper.', 'Wilt spinach in butter in a small pan.', 'Pour in the eggs. When nearly set, crumble feta over one half, fold and serve.'], tags: ['Quick', 'High protein', '12 min'], saved: true,
  },
  {
    id: 'r3', title: 'Creamy tomato pasta', description: 'A weeknight classic with a silky tomato sauce.', minutes: 20, servings: 2,
    ingredients: ['200 g pasta', '3 tomatoes', '80 ml cream', '30 g parmesan', '1 clove garlic'], imageKey: 'pasta',
    steps: ['Cook pasta in salted water until just tender. Save a mug of pasta water.', 'Cook garlic and chopped tomatoes in olive oil until saucy.', 'Stir in cream, parmesan and a splash of pasta water. Toss with pasta.'], tags: ['Comfort food', 'Family favourite', '20 min'], saved: true,
  },
  {
    id: 'r4', title: 'Crispy chickpea rice bowls', description: 'Bright, filling bowls with lemon and crunchy chickpeas.', minutes: 30, servings: 2,
    ingredients: ['1 can chickpeas', '150 g rice', '1 lemon', '1 cucumber', '2 tbsp yogurt', '1 tsp cumin'], imageKey: 'bowl',
    steps: ['Cook rice according to the packet.', 'Pat chickpeas dry, toss with oil and cumin, then roast or pan-fry until crisp.', 'Serve over rice with chopped cucumber, yogurt and lemon.'], tags: ['Meal prep', 'Vegetarian', '30 min'], saved: false,
  },
  {
    id: 'r5', title: 'Potato, spinach & egg hash', description: 'Golden potatoes topped with soft eggs and greens.', minutes: 28, servings: 2,
    ingredients: ['400 g potatoes', '2 eggs', '2 handfuls spinach', '1 small onion', '1 tbsp olive oil'], imageKey: 'omelette',
    steps: ['Dice potatoes small and pan-fry with onion until tender and crisp.', 'Stir spinach through the pan until it wilts.', 'Make two spaces, crack in the eggs, cover and cook until set to your liking.'], tags: ['Use-it-up', 'Gluten free', '28 min'], saved: false,
  },
];

const LIGHT_COLORS = {
  ink: '#20342C', muted: '#738078', green: '#2F6049', greenSoft: '#E3ECE1', cream: '#F5F3EC', white: '#FFFDF9',
  line: '#E5E5DB', orange: '#E76F43', orangeSoft: '#FCE8DD', yellow: '#E6BC58', card: '#FFFEFB', pale: '#EAEFE7', warning: '#FFF0D4', warningText: '#79562A', buttonText: '#FFFFFF',
};
const DARK_COLORS: typeof LIGHT_COLORS = {
  ink: '#F4F3EA', muted: '#A7B2A8', green: '#91C49B', greenSoft: '#263B2D', cream: '#111713', white: '#1A231D',
  line: '#303A33', orange: '#F18A60', orangeSoft: '#412B22', yellow: '#E6C264', card: '#1A231D', pale: '#242E28', warning: '#3A3223', warningText: '#E6CB83', buttonText: '#111713',
};
type Palette = typeof LIGHT_COLORS;

function id() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }
function normalized(value: string) { return value.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim(); }
function ingredientKey(value: string) {
  return value.toLowerCase()
    .replace(/½/g, ' 1/2 ').replace(/¼/g, ' 1/4 ').replace(/¾/g, ' 3/4 ')
    .replace(/⅓/g, ' 1/3 ').replace(/⅔/g, ' 2/3 ').replace(/⅛/g, ' 1/8 ')
    .replace(/⅜/g, ' 3/8 ').replace(/⅝/g, ' 5/8 ').replace(/⅞/g, ' 7/8 ')
    .replace(/[^a-z0-9./ ]/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/^\d+\/\d+\s*/, '')
    .replace(/^\d+(?:\s*[x×]\s*\d+(?:\.\d+)?)?\s*/, '')
    .replace(/^(?:(?:g|kg|mg|ml|l|cl|oz|lb|lbs|cup|cups|tbsp|tsp|tablespoon|teaspoon|can|cans|tin|tins|clove|cloves|handful|handfuls|piece|pieces|slice|slices|pinch|dash)\s+)+/, '')
    .replace(/^(?:of|a|an|some)\s+/, '')
    .trim().split(/\s+/).map((word) => word.endsWith('ies') ? `${word.slice(0, -3)}y` : word.endsWith('oes') ? word.slice(0, -2) : word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word).join(' ');
}
function hasPantryIngredient(ingredient: string, pantry: PantryItem[]) {
  const recipeKey = ingredientKey(ingredient);
  return pantry.some((item) => {
    const pantryKey = ingredientKey(item.name);
    return pantryKey && (recipeKey === pantryKey || recipeKey.startsWith(`${pantryKey} `));
  });
}
function isUseSoon(expires?: string) {
  if (!expires) return false;
  if (expires.toLowerCase() === 'use soon') return true;
  const match = expires.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const expiry = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return expiry.getTime() <= today.getTime() + 3 * 24 * 60 * 60 * 1000;
}
function recipeMatch(recipe: Recipe, pantry: PantryItem[]) {
  return recipe.ingredients.filter((ingredient) => hasPantryIngredient(ingredient, pantry)).length;
}
const AISLES = ['Produce', 'Meat & seafood', 'Dairy & eggs', 'Bakery', 'Frozen', 'Pantry & staples', 'Other'];
function shoppingAisle(name: string) {
  const item = ingredientKey(name);
  if (/apple|apricot|avocado|banana|berry|broccoli|carrot|celery|cucumber|garlic|ginger|herb|kale|lemon|lettuce|lime|mushroom|onion|orange|pepper|potato|spinach|tomato|zucchini|courgette/.test(item)) return 'Produce';
  if (/beef|chicken|duck|fish|lamb|pork|salmon|sausage|shrimp|prawn|turkey|tuna/.test(item)) return 'Meat & seafood';
  if (/butter|cheese|cream|egg|feta|milk|parmesan|yogurt/.test(item)) return 'Dairy & eggs';
  if (/bagel|bread|bun|croissant|pita|roll|tortilla/.test(item)) return 'Bakery';
  if (/frozen|ice cream/.test(item)) return 'Frozen';
  if (/bean|broth|cereal|chickpea|flour|lentil|oil|pasta|rice|salt|sauce|spice|sugar|vinegar/.test(item)) return 'Pantry & staples';
  return 'Other';
}
function getSourceTitle(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, '').split('.')[0].replace(/[-_]/g, ' '); }
  catch { return 'Saved recipe'; }
}
function parseImportedText(raw: string, source: string): Recipe {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const heading = lines.find((line) => !/^(ingredients?|method|instructions?|directions?|steps?)\s*:?[ ]*$/i.test(line) && !/^[-•*\d]/.test(line));
  const ingredientHeader = lines.findIndex((line) => /^ingredients?\s*:?[ ]*$/i.test(line));
  const stepHeader = lines.findIndex((line) => /^(method|instructions?|directions?|steps?)\s*:?[ ]*$/i.test(line));
  const ingredients = ingredientHeader >= 0
    ? lines.slice(ingredientHeader + 1, stepHeader > ingredientHeader ? stepHeader : undefined).filter((line) => !/^(method|instructions?|directions?|steps?)\s*:?[ ]*$/i.test(line)).map((line) => line.replace(/^[-•*\d.)\s]+/, '')).filter(Boolean)
    : [];
  const steps = stepHeader >= 0
    ? lines.slice(stepHeader + 1).map((line) => line.replace(/^[-•*\d.)\s]+/, '')).filter(Boolean)
    : [];
  return {
    id: id(), title: heading || getSourceTitle(source), description: 'Imported recipe — review the details before cooking.', minutes: 30, servings: 2,
    ingredients, steps, tags: ['Imported'], source, status: ingredients.length && steps.length ? 'ready' : 'review', saved: true,
  };
}

function PantryScoutApp() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent({ scheme: 'pantryscout' });
  const insets = useSafeAreaInsets();
  const systemScheme = useColorScheme();
  const mainScroll = useRef<ScrollViewInstance | null>(null);
  const [tab, setTab] = useState<Tab>('Today');
  const [modal, setModal] = useState<ModalKind>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [pantry, setPantry] = useState<PantryItem[]>(SEED_PANTRY);
  const [recipes, setRecipes] = useState<Recipe[]>(SEED_RECIPES);
  const [shopping, setShopping] = useState<ShopItem[]>([]);
  const [plan, setPlan] = useState<Record<string, string>>({ Mon: 'r1', Tue: 'r2', Wed: 'r3' });
  const [queue, setQueue] = useState<string[]>([]);
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState('');
  const [recipeView, setRecipeView] = useState<'saved' | 'online'>('saved');
  const [onlineQuery, setOnlineQuery] = useState('');
  const [onlineResults, setOnlineResults] = useState<OnlineMeal[]>([]);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [onlineError, setOnlineError] = useState('');
  const [selectedOnlineMeal, setSelectedOnlineMeal] = useState<OnlineMeal | null>(null);
  const [pantryName, setPantryName] = useState('');
  const [pantryQuantity, setPantryQuantity] = useState('1');
  const [pantryExpiry, setPantryExpiry] = useState('');
  const [shopName, setShopName] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newIngredients, setNewIngredients] = useState('');
  const [newSteps, setNewSteps] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cookStep, setCookStep] = useState(0);
  const [checkedCookIngredients, setCheckedCookIngredients] = useState<string[]>([]);
  const [pickerDay, setPickerDay] = useState('Mon');
  const [recipeFilter, setRecipeFilter] = useState<'all' | 'saved' | 'pantry'>('all');
  const lastBackPress = useRef(0);
  const isDark = themeMode === 'dark' || (themeMode === 'system' && systemScheme === 'dark');
  const COLORS = isDark ? DARK_COLORS : LIGHT_COLORS;
  const styles = useMemo(() => createStyles(COLORS), [isDark]);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (modal) {
        setModal(null);
        return true;
      }
      if (tab !== 'Today') {
        setTab('Today');
        setSearch('');
        lastBackPress.current = 0;
        return true;
      }
      const now = Date.now();
      if (now - lastBackPress.current < 2000) return false;
      lastBackPress.current = now;
      ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
      return true;
    });
    return () => subscription.remove();
  }, [modal, tab]);

  useEffect(() => {
    mainScroll.current?.scrollTo({ y: 0, animated: false });
  }, [tab]);

  useEffect(() => {
    if (modal !== 'cook' || !selectedRecipe) return undefined;
    activateKeepAwakeAsync('pantryscout-cook').catch(() => {});
    return () => { deactivateKeepAwake('pantryscout-cook'); };
  }, [modal, selectedRecipe]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved) {
        const data: unknown = JSON.parse(saved);
        if (isRecord(data)) {
          if (Array.isArray(data.pantry)) setPantry(data.pantry.filter(isPantryItem));
          if (Array.isArray(data.recipes)) setRecipes(data.recipes.filter(isRecipe));
          if (Array.isArray(data.shopping)) setShopping(data.shopping.filter(isShopItem));
          if (Array.isArray(data.queue)) setQueue(data.queue.filter((value): value is string => typeof value === 'string'));
          if (data.themeMode === 'light' || data.themeMode === 'dark' || data.themeMode === 'system') setThemeMode(data.themeMode);
          if (isRecord(data.plan)) {
            setPlan(Object.fromEntries(Object.entries(data.plan).filter((entry): entry is [string, string] => DAYS.includes(entry[0]) && typeof entry[1] === 'string')));
          }
        }
      }
    }).catch(() => {}).finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!hasShareIntent) return;
    const sharedText = shareIntent.text?.trim() || '';
    const url = shareIntent.webUrl || sharedText.match(/https?:\/\/[^\s)]+/i)?.[0]?.replace(/[.,!?]+$/, '') || '';
    const textWithoutUrl = url ? sharedText.replace(url, '').trim() : sharedText;
    setImportUrl(url);
    setImportText(textWithoutUrl);
    setImportError('');
    setRecipeView('saved');
    setTab('Recipes');
    setModal('import');
    resetShareIntent();
  }, [hasShareIntent, shareIntent, resetShareIntent]);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ pantry, recipes, shopping, plan, queue, themeMode })).catch(() => {});
  }, [ready, pantry, recipes, shopping, plan, queue, themeMode]);

  const matches = useMemo(() => recipes
    .map((recipe) => ({ recipe, count: recipeMatch(recipe, pantry), useSoon: recipe.ingredients.filter((ingredient) => pantry.some((item) => isUseSoon(item.expires) && hasPantryIngredient(ingredient, [item]))).length }))
    .sort((a, b) => b.count - a.count || b.useSoon - a.useSoon || a.recipe.minutes - b.recipe.minutes), [recipes, pantry]);
  const visibleRecipes = recipes.filter((recipe) => {
    if (!normalized(`${recipe.title} ${recipe.tags.join(' ')}`).includes(normalized(search))) return false;
    if (recipeFilter === 'saved' && !recipe.saved) return false;
    if (recipeFilter === 'pantry' && recipeMatch(recipe, pantry) === 0) return false;
    return true;
  });
  const plannedRecipe = (day: string) => recipes.find((recipe) => recipe.id === plan[day]);

  if (!ready) {
    return <SafeAreaView style={styles.safe}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={styles.loading}><ActivityIndicator color={COLORS.green} /><Text style={styles.loadingText}>Loading your kitchen…</Text></View>
    </SafeAreaView>;
  }

  function openRecipe(recipe: Recipe) { setSelectedRecipe(recipe); setModal('recipe'); }
  function toSavedOnlineRecipe(meal: OnlineMeal): Recipe {
    return {
      id: `mealdb-${meal.id}`, title: meal.title,
      description: [meal.cuisine, meal.category].filter(Boolean).join(' · ') || 'Recipe found online.',
      minutes: 0, servings: 0, ingredients: meal.ingredients, steps: meal.steps,
      tags: ['Online recipe', ...(meal.category ? [meal.category] : []), ...(meal.cuisine ? [meal.cuisine] : [])],
      source: meal.sourceUrl, sourceName: 'TheMealDB', imageUrl: meal.imageUrl,
      status: meal.ingredients.length && meal.steps.length ? 'ready' : 'review', saved: true,
    };
  }
  function openOnlineMeal(meal: OnlineMeal) { setSelectedOnlineMeal(meal); setModal('online-preview'); }
  function saveOnlineMeal(meal: OnlineMeal) {
    const recipe = toSavedOnlineRecipe(meal);
    setRecipes((items) => items.some((item) => item.id === recipe.id) ? items : [recipe, ...items]);
    setSelectedRecipe(recipe);
    setSelectedOnlineMeal(null);
    setModal('recipe');
  }
  async function runOnlineSearch(query = onlineQuery, byIngredient = false) {
    const term = query.trim();
    if (!term || onlineLoading) return;
    setOnlineQuery(term);
    setOnlineLoading(true);
    setOnlineError('');
    setOnlineResults([]);
    try {
      setOnlineResults(await searchOnlineMeals(term, byIngredient));
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Online recipe search failed. Please try again.');
    } finally {
      setOnlineLoading(false);
    }
  }
  function addPantryItem() {
    if (!pantryName.trim()) return;
    setPantry((items) => [...items, { id: id(), name: pantryName.trim(), quantity: pantryQuantity.trim() || '1', expires: pantryExpiry.trim() || undefined }]);
    setPantryName(''); setPantryQuantity('1'); setPantryExpiry(''); setModal(null);
  }
  function addShopItem() {
    if (!shopName.trim()) return;
    setShopping((items) => [...items, { id: id(), name: shopName.trim(), checked: false }]);
    setShopName(''); setModal(null);
  }
  function createFromPantry() {
    if (!pantry.length) { setTab('Pantry'); setModal('pantry'); return; }
    const names = [...pantry].sort((a, b) => Number(isUseSoon(b.expires)) - Number(isUseSoon(a.expires))).slice(0, 5).map((item) => item.name);
    const hasPasta = names.some((name) => /pasta|noodle/i.test(name));
    const hasEgg = names.some((name) => /egg/i.test(name));
    const title = hasPasta ? 'Pantry pasta toss' : hasEgg ? 'Fridge-clear veggie scramble' : 'Pantry freestyle skillet';
    const steps = hasPasta
      ? ['Cook the pasta until just tender and save a little cooking water.', 'While it cooks, sauté a few of your listed ingredients in a pan until tender.', 'Toss everything together with a splash of pasta water. Season to taste and serve.']
      : hasEgg
        ? ['Chop any larger vegetables and cook them in a lightly oiled pan until tender.', 'Beat the eggs, pour them over the vegetables and cook gently until just set.', 'Finish with any herbs, cheese or seasoning you have, then serve warm.']
        : ['Choose the ingredients that need using first and chop them into similar-sized pieces.', 'Cook the firmer ingredients in a pan first; add softer ingredients near the end.', 'Season with pantry staples, taste, and serve as a skillet or over any grain you have.'];
    const item: Recipe = {
      id: id(), title, description: `A flexible idea built around ${names.slice(0, 3).join(', ')}. Adjust the method to suit what is actually in your kitchen.`,
      minutes: 20, servings: 2, ingredients: [...names, 'Oil, salt and pepper if available'], steps,
      tags: ['Pantry creation', 'Use what you have'], imageKey: hasPasta ? 'pasta' : hasEgg ? 'omelette' : 'skillet', status: 'ready', saved: true,
    };
    setRecipes((items) => [item, ...items]); setSelectedRecipe(item); setRecipeView('saved'); setTab('Recipes'); setModal('recipe');
  }
  function createRecipe() {
    if (!newTitle.trim()) return;
    const ingredients = newIngredients.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    const steps = newSteps.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    const item: Recipe = {
      id: id(), title: newTitle.trim(), description: 'Your recipe, ready to make your own.', minutes: 30, servings: 2,
      ingredients, steps, tags: ['My recipes'], imageKey: /egg|omelette|breakfast/i.test(newTitle) ? 'omelette' : /rice|bowl|salad/i.test(newTitle) ? 'bowl' : /pasta|noodle/i.test(newTitle) ? 'pasta' : 'skillet',
      status: ingredients.length && steps.length ? 'ready' : 'review', saved: true,
    };
    setRecipes((items) => [item, ...items]); setNewTitle(''); setNewIngredients(''); setNewSteps(''); setRecipeView('saved'); setModal(null); setTab('Recipes');
  }
  function beginEditRecipe(recipe: Recipe) {
    setEditingId(recipe.id); setNewTitle(recipe.title); setNewIngredients(recipe.ingredients.join('\n')); setNewSteps(recipe.steps.join('\n')); setModal('edit');
  }
  function saveEditedRecipe() {
    if (!editingId || !newTitle.trim()) return;
    const ingredients = newIngredients.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    const steps = newSteps.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    setRecipes((items) => items.map((item) => item.id === editingId ? { ...item, title: newTitle.trim(), ingredients, steps, status: ingredients.length && steps.length ? 'ready' : 'review' } : item));
    setSelectedRecipe((item) => item?.id === editingId ? { ...item, title: newTitle.trim(), ingredients, steps, status: ingredients.length && steps.length ? 'ready' : 'review' } : item);
    setEditingId(null); setNewTitle(''); setNewIngredients(''); setNewSteps(''); setModal('recipe');
  }
  async function importRecipe() {
    if (!importUrl.trim() && !importText.trim()) return;
    const source = importUrl.trim();
    setImporting(true); setImportError('');
    try {
    let importMessage = '';
    let pageRecipe: Awaited<ReturnType<typeof fetchRecipePage>> = null;
    if (source) {
      try { pageRecipe = await fetchRecipePage(source); }
      catch (error) {
        importMessage = error instanceof Error ? error.message : 'The page could not be read. You can still save the link for later.';
        setImportError(importMessage);
      }
    }
    const pasted = importText.trim() ? parseImportedText(importText.trim(), source) : null;
    const hasPastedRecipe = Boolean(pasted && (pasted.ingredients.length || pasted.steps.length));
    const item: Recipe = hasPastedRecipe && pasted
      ? pasted
      : pageRecipe
        ? { id: id(), ...pageRecipe, tags: ['Imported'], source, status: pageRecipe.ingredients.length && pageRecipe.steps.length ? 'ready' : 'review', saved: true }
        : pasted
          ? { ...pasted, source: source || undefined, status: 'review', description: importMessage || pasted.description }
        : {
          id: id(), title: source ? getSourceTitle(source) : 'Saved recipe', description: importMessage || 'Recipe link saved. Add the ingredients and method when you review it.',
          minutes: 30, servings: 2, ingredients: [], steps: [], tags: ['Imported'], source, status: 'review', saved: true,
        };
    if (!pageRecipe && source && !importText.trim() && !importMessage) {
      importMessage = 'This site does not expose a readable recipe. The link was saved so you can complete it.';
      item.description = importMessage;
    }
    setRecipes((items) => [item, ...items]); setImportUrl(''); setImportText(''); setImportError(''); setRecipeView('saved'); setModal(null); setTab('Recipes');
    setSelectedRecipe(item); setModal('recipe');
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'The recipe could not be imported. Please try again.');
    } finally {
      setImporting(false);
    }
  }
  function addToShopping(recipe: Recipe) {
    const missing = recipe.ingredients.filter((ingredient) => !hasPantryIngredient(ingredient, pantry));
    setShopping((items) => {
      const have = new Set(items.map((x) => ingredientKey(x.name)));
      const additions: string[] = [];
      for (const name of missing) { const key = ingredientKey(name); if (key && !have.has(key)) { have.add(key); additions.push(name); } }
      return [...items, ...additions.map((name) => ({ id: id(), name, checked: false }))];
    });
    setModal(null); setTab('Shop');
  }
  function toggleUseSoon(itemId: string) {
    setPantry((items) => items.map((item) => item.id === itemId ? { ...item, expires: isUseSoon(item.expires) ? undefined : 'Use soon' } : item));
  }
  function toggleShopping(itemId: string) { setShopping((items) => items.map((item) => item.id === itemId ? { ...item, checked: !item.checked } : item)); }
  function removePantry(itemId: string) { setPantry((items) => items.filter((item) => item.id !== itemId)); }
  function toggleSaved(recipeId: string) { setRecipes((items) => items.map((item) => item.id === recipeId ? { ...item, saved: !item.saved } : item)); }
  function toggleQueue(recipeId: string) { setQueue((items) => items.includes(recipeId) ? items.filter((item) => item !== recipeId) : [...items, recipeId]); }
  function assignPlan(recipeId: string) { setPlan((current) => ({ ...current, [pickerDay]: recipeId })); setQueue((items) => items.filter((item) => item !== recipeId)); setModal(null); }

  const Pill = ({ children, color = COLORS.pale }: { children: React.ReactNode; color?: string }) => (
    <View style={[styles.pill, { backgroundColor: color }]}><Text style={styles.pillText}>{children}</Text></View>
  );
  const Button = ({ label, onPress, secondary = false, compact = false, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; compact?: boolean; disabled?: boolean }) => (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, compact && styles.buttonCompact, (pressed || disabled) && { opacity: disabled ? 0.55 : 0.82 }]}>
      <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary, compact && styles.buttonTextCompact]}>{label}</Text>
    </Pressable>
  );
  const SectionTitle = ({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) => (
    <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text>{action ? <Pressable onPress={onPress}><Text style={styles.link}>{action}</Text></Pressable> : null}</View>
  );
  const RecipeCard = ({ recipe, compact = false }: { recipe: Recipe; compact?: boolean }) => {
    const count = recipeMatch(recipe, pantry);
    const imageSource = recipe.imageKey ? RECIPE_IMAGES[recipe.imageKey] : recipe.imageUrl ? { uri: recipe.imageUrl } : null;
    return (
      <Pressable onPress={() => openRecipe(recipe)} style={[styles.recipeCard, compact && styles.recipeCardCompact]}>
        <View style={[styles.recipeImage, compact && styles.recipeImageCompact]}>{imageSource ? <Image source={imageSource} style={styles.recipePhoto} resizeMode="cover" /> : <View style={styles.recipeImageFallback}><Text style={styles.recipeEmoji}>✦</Text></View>}<View style={styles.recipeImageTint} /><Pressable accessibilityRole="button" accessibilityLabel={recipe.saved ? `Remove ${recipe.title} from saved recipes` : `Save ${recipe.title}`} accessibilityState={{ selected: Boolean(recipe.saved) }} onPress={(event) => { event.stopPropagation(); toggleSaved(recipe.id); }} style={styles.heart}><Text style={styles.heartGlyph}>{recipe.saved ? '♥' : '♡'}</Text></Pressable><View style={styles.matchBadge}><Text style={styles.matchBadgeText}>{count}/{recipe.ingredients.length} ON HAND</Text></View></View>
        <View style={styles.recipeInfo}><Text style={styles.recipeTitle}>{recipe.title}</Text><Text style={styles.recipeSub}>{recipe.minutes > 0 ? `${recipe.minutes} min  ·  ` : ''}{recipe.servings > 0 ? `${recipe.servings} servings  ·  ` : ''}{recipe.tags[0] || 'Fresh idea'}</Text>
          <View style={styles.tagRow}>{recipe.tags.slice(0, 2).map((tag) => <Pill key={tag}>{tag}</Pill>)}</View>
          {recipe.status === 'review' ? <Text style={styles.reviewNote}>Needs a quick review</Text> : null}
        </View>
      </Pressable>
    );
  };

  function renderToday() {
    const top = matches.slice(0, 3);
    const heroRecipe = top[0]?.recipe || recipes[0];
    const heroImage = heroRecipe.imageKey ? RECIPE_IMAGES[heroRecipe.imageKey] : heroRecipe.imageUrl ? { uri: heroRecipe.imageUrl } : RECIPE_IMAGES.skillet;
    const useSoon = pantry.filter((item) => isUseSoon(item.expires));
    return <>
      <View style={styles.greetingRow}><View><Text style={styles.eyebrow}>GOOD FOOD · LESS WASTE</Text><Text style={styles.greetingTitle}>Good evening</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Search online recipes" style={styles.headerSearch} onPress={() => { setRecipeView('online'); setTab('Recipes'); }}><Text style={styles.headerSearchGlyph}>⌕</Text></Pressable></View>
      <ImageBackground source={heroImage} imageStyle={styles.heroImageStyle} style={styles.heroImage}>
        <View style={styles.heroImageShade} />
        <View style={styles.heroContent}><View style={styles.heroPill}><Text style={styles.heroPillText}>TONIGHT’S PICK</Text></View><View style={styles.heroSpacer} /><Text style={styles.heroTitle}>Dinner, from{ '\n' }what you have.</Text><Text style={styles.heroCopy}>{heroRecipe.title} · {heroRecipe.minutes} min</Text><View style={styles.heroBottom}><Text style={styles.heroMatch}>{recipeMatch(heroRecipe, pantry)}/{heroRecipe.ingredients.length} ingredients here</Text><Pressable accessibilityRole="button" onPress={() => openRecipe(heroRecipe)} style={styles.heroGo}><Text style={styles.heroGoText}>Cook it  →</Text></Pressable></View></View>
      </ImageBackground>
      {useSoon.length > 0 && <Pressable onPress={() => setTab('Pantry')} style={styles.useSoon}><View style={styles.useSoonDot} /><View style={styles.useSoonCopy}><Text style={styles.useSoonHeading}>USE THESE FIRST</Text><Text style={styles.useSoonText}>{useSoon.map((item) => item.name).join('  ·  ')}</Text></View><Text style={styles.useSoonArrow}>›</Text></Pressable>}
      <View style={styles.homeSectionHeading}><View><Text style={styles.sectionKicker}>MADE FOR YOUR PANTRY</Text><Text style={styles.sectionTitle}>Ideas for tonight</Text></View><Pressable onPress={() => { setTab('Recipes'); setRecipeFilter('pantry'); }}><Text style={styles.link}>See all  →</Text></Pressable></View>
      <Text style={styles.sectionHint}>Recipes ranked by what’s already in your kitchen.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recipeRail}>{top.map(({ recipe }) => <RecipeCard key={recipe.id} recipe={recipe} compact />)}</ScrollView>
      <View style={styles.homeShortcuts}><Pressable style={styles.shortcutCard} onPress={() => setTab('Pantry')}><Text style={styles.shortcutIcon}>▤</Text><View><Text style={styles.shortcutTitle}>{pantry.length} things in your pantry</Text><Text style={styles.shortcutCopy}>{useSoon.length} to use soon  ·  update list</Text></View><Text style={styles.chevron}>›</Text></Pressable><Pressable style={[styles.shortcutCard, styles.shortcutOrange]} onPress={() => { setRecipeView('online'); setTab('Recipes'); }}><Text style={styles.shortcutIcon}>⌕</Text><View><Text style={styles.shortcutTitle}>Find a new favorite</Text><Text style={styles.shortcutCopy}>Search ideas from around the web</Text></View><Text style={styles.chevron}>›</Text></Pressable></View>
    </>;
  }
  function renderRecipes() {
    return <>
      <View style={styles.pageIntro}><Text style={styles.eyebrow}>{recipeView === 'online' ? 'FIND SOMETHING NEW' : 'YOUR COOKBOOK'}</Text><Text style={styles.pageTitle}>{recipeView === 'online' ? 'Online ideas' : 'Recipes'}</Text><Text style={styles.pageCopy}>{recipeView === 'online' ? 'Search a large recipe collection, check what matches your pantry, and save the ones you like.' : 'Saved from anywhere, created by you, ready when you need them.'}</Text></View>
      <View style={styles.filterLine}>
        {(['saved', 'online'] as const).map((view) => <Pressable key={view} accessibilityRole="tab" accessibilityState={{ selected: recipeView === view }} onPress={() => setRecipeView(view)}><Pill color={recipeView === view ? COLORS.greenSoft : COLORS.pale}>{view === 'saved' ? 'My recipes' : 'Online ideas'}</Pill></Pressable>)}
      </View>
      {recipeView === 'online' ? <>
        <View style={styles.onlineSearchRow}><View style={[styles.searchBox, styles.onlineSearchBox]}><Text style={styles.searchIcon}>⌕</Text><TextInput value={onlineQuery} onChangeText={setOnlineQuery} onSubmitEditing={() => runOnlineSearch()} returnKeyType="search" placeholder="Dish or cuisine" placeholderTextColor={COLORS.muted} style={styles.searchInput} /></View><Button label="Search" onPress={() => runOnlineSearch()} disabled={!onlineQuery.trim() || onlineLoading} compact /></View>
        <Text style={styles.sectionHint}>Or search using an ingredient you already have:</Text>
        <View style={styles.filterLine}>{pantry.slice(0, 6).map((item) => <Pressable key={item.id} disabled={onlineLoading} onPress={() => runOnlineSearch(item.name, true)}><Pill color={COLORS.greenSoft}>{item.name}</Pill></Pressable>)}</View>
        {onlineLoading ? <View style={styles.searchLoading}><ActivityIndicator color={COLORS.green} /><Text style={styles.sectionHint}>Finding recipes…</Text></View> : null}
        {onlineError ? <View style={styles.reviewBox}><Text style={styles.reviewBoxText}>{onlineError}</Text></View> : null}
        {!onlineLoading && !onlineError && onlineResults.length === 0 ? <View style={styles.emptyCard}><Text style={styles.emptyEmoji}>🌐</Text><Text style={styles.emptyTitle}>What are you in the mood for?</Text><Text style={styles.emptyText}>Search by dish or cuisine. Tap a pantry ingredient to find recipes that use it.</Text></View> : null}
        {onlineResults.map((meal) => {
          const recipe = toSavedOnlineRecipe(meal);
          const count = recipeMatch(recipe, pantry);
          const alreadySaved = recipes.some((item) => item.id === recipe.id);
          const openResult = () => alreadySaved ? openRecipe(recipe) : openOnlineMeal(meal);
          return <Pressable key={meal.id} onPress={openResult} style={styles.onlineResultCard}>
            {meal.imageUrl ? <Image source={{ uri: meal.imageUrl }} style={styles.onlineResultImage} resizeMode="cover" /> : <View style={[styles.onlineResultImage, styles.onlineImageFallback]}><Text style={styles.recipeEmoji}>🍽️</Text></View>}
            <View style={styles.onlineResultInfo}><Text style={styles.recipeTitle}>{meal.title}</Text><Text style={styles.recipeSub}>{[meal.cuisine, meal.category].filter(Boolean).join(' · ') || 'Recipe'} · {count}/{recipe.ingredients.length} pantry items</Text><Button label={alreadySaved ? 'Saved · view recipe' : 'Preview recipe'} onPress={openResult} secondary compact /></View>
          </Pressable>;
        })}
        {onlineResults.length > 0 ? <Text style={styles.attribution}>Recipe data and photos provided by TheMealDB.</Text> : null}
      </> : <>
      <View style={styles.searchBox}><Text style={styles.searchIcon}>⌕</Text><TextInput value={search} onChangeText={setSearch} placeholder="Search recipes or tags" placeholderTextColor={COLORS.muted} style={styles.searchInput} /></View>
      <View style={styles.inlineActions}><Button label="＋ Import" onPress={() => setModal('import')} compact /><Button label="＋ Create" onPress={() => setModal('create')} secondary compact /></View>
      <View style={styles.filterLine}>
        {(['all', 'saved', 'pantry'] as const).map((filter) => {
          const label = filter === 'all' ? `All ${recipes.length}` : filter === 'saved' ? `Saved ${recipes.filter((recipe) => recipe.saved).length}` : 'From pantry';
          const active = recipeFilter === filter;
          return <Pressable key={filter} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => setRecipeFilter(filter)}><Pill color={active ? COLORS.greenSoft : COLORS.pale}>{label}</Pill></Pressable>;
        })}
      </View>
      {visibleRecipes.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} />)}
      {visibleRecipes.length === 0 && <Text style={styles.emptyText}>No recipes match that search. Try another ingredient or title.</Text>}
      </>}
    </>;
  }
  function renderPantry() {
    return <>
      <View style={styles.pageIntro}><Text style={styles.eyebrow}>WHAT YOU HAVE AT HOME</Text><Text style={styles.pageTitle}>Pantry</Text><Text style={styles.pageCopy}>Keep a lightweight list. Add items as you shop or cook.</Text></View>
      <View style={styles.inventorySummary}><Text style={styles.inventoryCount}>{pantry.length}</Text><View><Text style={styles.inventoryTitle}>ingredients on hand</Text><Text style={styles.inventorySub}>{pantry.filter((x) => isUseSoon(x.expires)).length} to use soon</Text></View><Text style={styles.inventoryEmoji}>✳</Text></View>
      <Button label="＋ Add pantry item" onPress={() => setModal('pantry')} />
      <SectionTitle title="Your ingredients" />
      {pantry.length ? pantry.map((item) => <View key={item.id} style={styles.ingredientRow}><View style={styles.ingredientDot}><Text style={styles.ingredientGlyph}>{item.name.slice(0, 1).toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text style={styles.ingredientName}>{item.name}</Text><Text style={styles.ingredientMeta}>{item.quantity}{item.expires ? ` · ${item.expires}` : ''}</Text></View><Pressable onPress={() => toggleUseSoon(item.id)} hitSlop={8}><Text style={styles.link}>{isUseSoon(item.expires) ? 'Use soon ✓' : 'Use soon'}</Text></Pressable><Pressable onPress={() => removePantry(item.id)} hitSlop={10} style={{ marginLeft: 8 }}><Text style={styles.remove}>−</Text></Pressable></View>) : <Text style={styles.emptyText}>Your pantry is empty. Add a few ingredients to get tailored ideas.</Text>}
      <View style={styles.tipCard}><Text style={styles.tipTitle}>Small list, useful suggestions</Text><Text style={styles.tipCopy}>You can start with a few staples. PantryScout will use your list to rank recipes and calculate what you need to shop for.</Text></View>
    </>;
  }
  function renderPlan() {
    const queuedRecipes = queue.map((recipeId) => recipes.find((recipe) => recipe.id === recipeId)).filter((recipe): recipe is Recipe => Boolean(recipe));
    return <>
      <View style={styles.pageIntro}><Text style={styles.eyebrow}>MAKE THE WEEK EASIER</Text><Text style={styles.pageTitle}>Meal plan</Text><Text style={styles.pageCopy}>Choose what to cook. Your shopping list can follow the plan.</Text></View>
      <SectionTitle title={`Cook soon${queuedRecipes.length ? ` · ${queuedRecipes.length}` : ''}`} action="Browse recipes" onPress={() => setTab('Recipes')} />
      <Text style={styles.sectionHint}>Keep good ideas here until you know which day they fit.</Text>
      {queuedRecipes.length ? queuedRecipes.map((recipe) => <View key={recipe.id} style={styles.queueRow}><Pressable style={{ flex: 1 }} onPress={() => openRecipe(recipe)}><Text style={styles.pickerTitle}>{recipe.title}</Text><Text style={styles.ingredientMeta}>{recipe.minutes} min · {recipeMatch(recipe, pantry)}/{recipe.ingredients.length} ingredients at home</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Remove ${recipe.title} from Cook soon`} onPress={() => toggleQueue(recipe.id)} style={styles.queueRemove}><Text style={styles.remove}>×</Text></Pressable></View>) : <View style={styles.emptyQueue}><Text style={styles.emptyText}>Save recipes here before assigning them to a day.</Text><Button label="Find recipes" onPress={() => setTab('Recipes')} secondary compact /></View>}
      <SectionTitle title="This week" />
      <View style={styles.weekCard}>{DAYS.map((day) => {
        const recipe = plannedRecipe(day);
        return <Pressable key={day} style={styles.dayRow} onPress={() => { setPickerDay(day); setModal('picker'); }}><View style={styles.dayBadge}><Text style={styles.dayText}>{day}</Text></View><View style={{ flex: 1 }}><Text style={styles.dayMeal}>{recipe?.title || 'Choose a meal'}</Text><Text style={styles.dayMeta}>{recipe ? `${recipe.minutes} min · ${recipe.servings} servings` : 'Tap to add a recipe'}</Text></View><Text style={styles.chevron}>›</Text></Pressable>;
      })}</View>
      <Button label="Build shopping list from plan" onPress={() => {
        const planned = Object.values(plan).map((rid) => recipes.find((r) => r.id === rid)).filter((r): r is Recipe => Boolean(r));
        const missing = planned.flatMap((r) => r.ingredients.filter((ingredient) => !hasPantryIngredient(ingredient, pantry)));
        setShopping((items) => {
          const current = new Set(items.map((x) => ingredientKey(x.name)));
          const additions: string[] = [];
          for (const name of missing) {
            const key = ingredientKey(name);
            if (key && !current.has(key)) { current.add(key); additions.push(name); }
          }
          return [...items, ...additions.map((name) => ({ id: id(), name, checked: false }))];
        });
        setTab('Shop');
      }} />
      <View style={styles.tipCard}><Text style={styles.tipTitle}>A plan that uses what you have</Text><Text style={styles.tipCopy}>Recipe matching starts with your pantry, then the shopping list only includes ingredients you don’t already have.</Text></View>
    </>;
  }
  function renderShop() {
    const unchecked = shopping.filter((item) => !item.checked);
    const checked = shopping.filter((item) => item.checked);
    const renderGrouped = (items: ShopItem[]) => AISLES.map((aisle) => {
      const group = items.filter((item) => shoppingAisle(item.name) === aisle);
      return group.length ? <View key={aisle}><Text style={styles.aisleTitle}>{aisle}</Text>{group.map((item) => <Pressable key={item.id} accessibilityRole="checkbox" accessibilityState={{ checked: item.checked }} onPress={() => toggleShopping(item.id)} style={styles.shopRow}><View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>{item.checked ? <Text style={styles.checkmark}>✓</Text> : null}</View><Text style={[styles.shopName, item.checked && styles.shopDone]}>{item.name}</Text></Pressable>)}</View> : null;
    });
    return <>
      <View style={styles.pageIntro}><Text style={styles.eyebrow}>READY FOR THE SHOP</Text><Text style={styles.pageTitle}>Shopping list</Text><Text style={styles.pageCopy}>{unchecked.length} items left · built from recipes and your meal plan</Text></View>
      <View style={styles.shopActions}><Button label="＋ Add item" onPress={() => setModal('shop-add')} compact /><Button label="Clear checked" onPress={() => setShopping((items) => items.filter((item) => !item.checked))} secondary compact disabled={!checked.length} /></View>
      {shopping.length === 0 ? <View style={styles.emptyCard}><Text style={styles.emptyEmoji}>🛒</Text><Text style={styles.emptyTitle}>Your list is ready when you are</Text><Text style={styles.emptyText}>Open a recipe or build a weekly plan. PantryScout will add only what’s missing.</Text></View> : <>
        {unchecked.length > 0 && <>{renderGrouped(unchecked)}</>}
        {checked.length > 0 && <><SectionTitle title="In your basket" /><Text style={styles.sectionHint}>Tap an item to move it back to your list.</Text>{renderGrouped(checked)}</>}
      </>}
    </>;
  }

  function renderModalContent() {
    if (modal === 'settings') return <>
      <Text style={styles.modalEyebrow}>PERSONALISE PANTRYSCOUT</Text><Text style={styles.modalTitle}>Appearance</Text><Text style={styles.modalCopy}>Choose how PantryScout looks. System follows your device setting.</Text>
      <View style={styles.themeOptions}>{(['light', 'dark', 'system'] as const).map((mode) => <Pressable key={mode} accessibilityRole="radio" accessibilityState={{ checked: themeMode === mode }} onPress={() => setThemeMode(mode)} style={[styles.themeOption, themeMode === mode && styles.themeOptionSelected]}><View style={styles.themeOptionCopy}><Text style={styles.themeOptionTitle}>{mode === 'light' ? 'Light' : mode === 'dark' ? 'Dark' : 'System'}</Text><Text style={styles.themeOptionDescription}>{mode === 'system' ? 'Match your device appearance' : `${mode[0].toUpperCase()}${mode.slice(1)} colours, always`}</Text></View><View style={[styles.radioOuter, themeMode === mode && styles.radioOuterSelected]}>{themeMode === mode ? <View style={styles.radioInner} /> : null}</View></Pressable>)}</View>
    </>;
    if (modal === 'online-preview' && selectedOnlineMeal) {
      const recipe = toSavedOnlineRecipe(selectedOnlineMeal);
      return <>
        {selectedOnlineMeal.imageUrl ? <Image source={{ uri: selectedOnlineMeal.imageUrl }} style={styles.previewImage} resizeMode="cover" /> : null}
        <Text style={styles.modalEyebrow}>ONLINE RECIPE · {selectedOnlineMeal.cuisine || 'DISCOVER'}</Text><Text style={styles.modalTitle}>{selectedOnlineMeal.title}</Text><Text style={styles.modalCopy}>{[selectedOnlineMeal.category, `${recipeMatch(recipe, pantry)} of ${selectedOnlineMeal.ingredients.length} ingredients in your pantry`].filter(Boolean).join(' · ')}</Text>
        <SectionTitle title="Ingredients" />
        {selectedOnlineMeal.ingredients.length ? selectedOnlineMeal.ingredients.map((ingredient, index) => <Text key={`${ingredient}-${index}`} style={styles.detailLine}>•  {ingredient}</Text>) : <Text style={styles.emptyText}>Ingredients aren’t available from this listing.</Text>}
        {selectedOnlineMeal.steps.length ? <><SectionTitle title="Method" />{selectedOnlineMeal.steps.map((step, index) => <Text key={`${index}-${step.slice(0, 16)}`} style={styles.detailStep}><Text style={styles.stepNumber}>{index + 1}. </Text>{step}</Text>)}</> : null}
        <Text style={styles.sourceLine}>Recipe source: TheMealDB · open the original page to verify details.</Text>
        <View style={styles.modalButtonStack}><Button label="Save to my recipes" onPress={() => saveOnlineMeal(selectedOnlineMeal)} /><Button label="Open original recipe" onPress={() => { Linking.openURL(selectedOnlineMeal.sourceUrl).catch(() => {}); }} secondary /></View>
      </>;
    }
    if (modal === 'pantry') return <>
      <Text style={styles.modalEyebrow}>YOUR KITCHEN</Text><Text style={styles.modalTitle}>Add an item</Text><Text style={styles.modalCopy}>Keep the pantry list quick and easy to update.</Text>
      <TextInput value={pantryName} onChangeText={setPantryName} placeholder="Ingredient (e.g. brown rice)" placeholderTextColor={COLORS.muted} style={styles.input} autoFocus />
      <TextInput value={pantryQuantity} onChangeText={setPantryQuantity} placeholder="Amount (optional)" placeholderTextColor={COLORS.muted} style={styles.input} />
      <TextInput value={pantryExpiry} onChangeText={setPantryExpiry} placeholder="Use-by date (YYYY-MM-DD, optional)" placeholderTextColor={COLORS.muted} style={styles.input} autoCapitalize="none" />
      <Button label="Add to pantry" onPress={addPantryItem} />
    </>;
    if (modal === 'shop-add') return <>
      <Text style={styles.modalEyebrow}>SHOPPING LIST</Text><Text style={styles.modalTitle}>Add an item</Text><Text style={styles.modalCopy}>Add anything you need, even if it isn’t part of a saved recipe.</Text>
      <TextInput value={shopName} onChangeText={setShopName} placeholder="Item to buy" placeholderTextColor={COLORS.muted} style={styles.input} autoFocus />
      <Button label="Add to shopping list" onPress={addShopItem} />
    </>;
    if (modal === 'create') return <>
      <Text style={styles.modalEyebrow}>YOUR OWN RECIPE</Text><Text style={styles.modalTitle}>Create a recipe</Text><Text style={styles.modalCopy}>Save a family favourite or make a new idea of your own.</Text>
      <TextInput value={newTitle} onChangeText={setNewTitle} placeholder="Recipe name" placeholderTextColor={COLORS.muted} style={styles.input} autoFocus />
      <TextInput value={newIngredients} onChangeText={setNewIngredients} placeholder={'Ingredients, one per line\ne.g. 2 eggs'} placeholderTextColor={COLORS.muted} style={[styles.input, styles.textArea]} multiline />
      <TextInput value={newSteps} onChangeText={setNewSteps} placeholder={'Method, one step per line\nBeat the eggs...'} placeholderTextColor={COLORS.muted} style={[styles.input, styles.textArea]} multiline />
      <Button label="Save to recipes" onPress={createRecipe} />
    </>;
    if (modal === 'edit') return <>
      <Text style={styles.modalEyebrow}>RECIPE DETAILS</Text><Text style={styles.modalTitle}>Edit recipe</Text><Text style={styles.modalCopy}>Correct an import or update your own recipe. Put each ingredient and step on its own line.</Text>
      <TextInput value={newTitle} onChangeText={setNewTitle} placeholder="Recipe name" placeholderTextColor={COLORS.muted} style={styles.input} autoFocus />
      <TextInput value={newIngredients} onChangeText={setNewIngredients} placeholder="Ingredients, one per line" placeholderTextColor={COLORS.muted} style={[styles.input, styles.textArea]} multiline />
      <TextInput value={newSteps} onChangeText={setNewSteps} placeholder="Method, one step per line" placeholderTextColor={COLORS.muted} style={[styles.input, styles.textArea]} multiline />
      <Button label="Save changes" onPress={saveEditedRecipe} />
    </>;
    if (modal === 'import') return <>
      <Text style={styles.modalEyebrow}>SAVE FROM ANYWHERE</Text><Text style={styles.modalTitle}>Import a recipe</Text><Text style={styles.modalCopy}>Paste a recipe link and/or its text. Keep the source attached so you can revisit it.</Text>
      <TextInput value={importUrl} onChangeText={setImportUrl} placeholder="Paste a recipe or social link" placeholderTextColor={COLORS.muted} autoCapitalize="none" keyboardType="url" style={styles.input} />
      <TextInput value={importText} onChangeText={setImportText} placeholder={'Paste recipe text here\nTitle, ingredients and method'} placeholderTextColor={COLORS.muted} style={[styles.input, styles.textArea]} multiline />
      <Text style={styles.importNote}>We’ll try to read recipe details published by the page. If the site blocks access, save the link and add the details yourself.</Text>
      {importError ? <Text style={styles.reviewNote}>{importError}</Text> : null}
      <Button label={importing ? 'Reading recipe…' : 'Import recipe'} onPress={importRecipe} disabled={importing} />
    </>;
    if (modal === 'recipe' && selectedRecipe) return <>
      {selectedRecipe.imageUrl || selectedRecipe.imageKey ? <Image source={selectedRecipe.imageUrl ? { uri: selectedRecipe.imageUrl } : RECIPE_IMAGES[selectedRecipe.imageKey as keyof typeof RECIPE_IMAGES]} style={styles.previewImage} resizeMode="cover" /> : null}
      <Text style={styles.modalEyebrow}>{selectedRecipe.tags.join(' · ')}</Text><Text style={styles.modalTitle}>{selectedRecipe.title}</Text><Text style={styles.modalCopy}>{selectedRecipe.description}</Text>
      <View style={styles.detailStats}>{selectedRecipe.minutes > 0 ? <Pill color={COLORS.orangeSoft}>{selectedRecipe.minutes} minutes</Pill> : null}{selectedRecipe.servings > 0 ? <Pill>{selectedRecipe.servings} servings</Pill> : null}<Pill color={COLORS.greenSoft}>{recipeMatch(selectedRecipe, pantry)} ingredients in pantry</Pill></View>
      {selectedRecipe.source ? <Pressable onPress={() => { Linking.openURL(selectedRecipe.source as string).catch(() => {}); }}><Text style={styles.sourceLine}>Source: {selectedRecipe.sourceName || selectedRecipe.source} ↗</Text></Pressable> : null}
      {selectedRecipe.status === 'review' ? <Text style={styles.reviewBox}>This recipe needs a quick review before cooking.</Text> : null}
      <SectionTitle title="Ingredients" />
      {selectedRecipe.ingredients.length ? selectedRecipe.ingredients.map((ingredient, index) => <Text key={`${ingredient}-${index}`} style={styles.detailLine}>•  {ingredient}</Text>) : <Text style={styles.emptyText}>No ingredients detected yet.</Text>}
      {selectedRecipe.steps.length ? <><SectionTitle title="Method" />{selectedRecipe.steps.map((step, index) => <Text key={`${step}-${index}`} style={styles.detailStep}><Text style={styles.stepNumber}>{index + 1}. </Text>{step}</Text>)}</> : null}
      <View style={styles.modalButtonStack}><Button label="Edit recipe" onPress={() => beginEditRecipe(selectedRecipe)} secondary /><Button label={queue.includes(selectedRecipe.id) ? 'Remove from Cook soon' : '＋ Add to Cook soon'} onPress={() => toggleQueue(selectedRecipe.id)} secondary /><Button label="Start cook mode" onPress={() => { setCookStep(0); setCheckedCookIngredients([]); setModal('cook'); }} /><Button label="Add missing ingredients to list" onPress={() => addToShopping(selectedRecipe)} secondary /></View>
    </>;
    if (modal === 'cook' && selectedRecipe) return <>
      <Text style={styles.modalEyebrow}>COOK MODE · SCREEN STAYS AWAKE</Text><Text style={styles.modalTitle}>Step {Math.min(cookStep + 1, selectedRecipe.steps.length || 1)} of {selectedRecipe.steps.length || 1}</Text><Text style={styles.modalCopy}>{selectedRecipe.title} · tap ingredients as you use them</Text>
      <View style={styles.cookStepCard}><Text style={styles.cookStepText}>{selectedRecipe.steps[cookStep] || 'Add the ingredients and method to this recipe to use cook mode.'}</Text></View>
      <Text style={styles.modalCopy}>Ingredients · {checkedCookIngredients.length}/{selectedRecipe.ingredients.length} ready</Text>
      {selectedRecipe.ingredients.map((item) => { const checked = checkedCookIngredients.includes(item); return <Pressable key={item} accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => setCheckedCookIngredients((items) => checked ? items.filter((value) => value !== item) : [...items, item])} style={styles.cookIngredient}><View style={[styles.checkbox, checked && styles.checkboxChecked]}>{checked ? <Text style={styles.checkmark}>✓</Text> : null}</View><Text style={[styles.shopName, checked && styles.shopDone]}>{item}</Text></Pressable>; })}
      <View style={styles.modalButtonStack}>{cookStep > 0 && <Button label="← Previous step" onPress={() => setCookStep((step) => Math.max(0, step - 1))} secondary />}{selectedRecipe.steps.length > 0 && <Button label={cookStep + 1 >= selectedRecipe.steps.length ? 'Finish cooking' : 'Next step →'} onPress={() => { if (cookStep + 1 >= selectedRecipe.steps.length) setModal('recipe'); else setCookStep((step) => step + 1); }} />}{selectedRecipe.steps.length === 0 && <Button label="Back to recipe" onPress={() => setModal('recipe')} secondary />}</View>
    </>;
    if (modal === 'picker') return <>
      <Text style={styles.modalEyebrow}>WEEKLY MEAL PLAN</Text><Text style={styles.modalTitle}>Choose for {pickerDay}</Text><Text style={styles.modalCopy}>Pick a saved recipe. Add another one to your cookbook if it’s missing.</Text>
      {recipes.map((recipe) => <Pressable key={recipe.id} style={styles.pickerRow} onPress={() => assignPlan(recipe.id)}><View style={{ flex: 1 }}><Text style={styles.pickerTitle}>{recipe.title}</Text><Text style={styles.ingredientMeta}>{recipe.minutes} min · matches {recipeMatch(recipe, pantry)} pantry items</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}
      <Button label="＋ Create a recipe" onPress={() => setModal('create')} secondary />
    </>;
    return null;
  }

  const tabs: { name: Tab; icon: string }[] = [
    { name: 'Today', icon: '⌂' }, { name: 'Recipes', icon: '⌕' }, { name: 'Pantry', icon: '▤' }, { name: 'Plan', icon: '▦' }, { name: 'Shop', icon: '◷' },
  ];
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={styles.topBar}><View style={styles.brandMark}><Text style={styles.brandIcon}>P</Text></View><View style={styles.brandCopy}><Text style={styles.brandName}>PantryScout</Text><Text style={styles.brandLine}>COOK WELL · WASTE LESS</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Appearance settings" style={styles.topAction} onPress={() => setModal('settings')}><Text style={styles.themeActionText}>◐</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Import a recipe" style={[styles.topAction, styles.topActionAdd]} onPress={() => setModal('import')}><Text style={styles.topActionText}>＋</Text></Pressable></View>
      <ScrollView ref={mainScroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {tab === 'Today' ? renderToday() : tab === 'Recipes' ? renderRecipes() : tab === 'Pantry' ? renderPantry() : tab === 'Plan' ? renderPlan() : renderShop()}
        <View style={{ height: 22 }} />
      </ScrollView>
      <View style={styles.tabBar}>{tabs.map((item) => <Pressable key={item.name} accessibilityRole="tab" accessibilityLabel={item.name} accessibilityState={{ selected: tab === item.name }} hitSlop={4} style={[styles.tabItem, tab === item.name && styles.tabItemActive]} onPress={() => { setTab(item.name); setSearch(''); }}><Text style={[styles.tabIcon, tab === item.name && styles.tabIconActive]}>{item.icon}</Text><Text style={[styles.tabLabel, tab === item.name && styles.tabLabelActive]}>{item.name}</Text></Pressable>)}</View>
      <Modal visible={Boolean(modal)} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setModal(null)}>
        <View style={styles.modalBackdrop}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardWrap}>
          <View style={[styles.modalSheet, { paddingBottom: Math.max(20, insets.bottom + 12) }]}><View style={styles.modalGrabber} /><Pressable accessibilityRole="button" accessibilityLabel="Close dialog" style={styles.modalClose} onPress={() => setModal(null)}><Text style={styles.modalCloseText}>×</Text></Pressable><ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">{renderModalContent()}<View style={{ height: 24 }} /></ScrollView></View>
        </KeyboardAvoidingView></View>
      </Modal>
    </SafeAreaView>
  );
}

export default function App() {
  return <SafeAreaProvider><PantryScoutApp /></SafeAreaProvider>;
}

function createStyles(COLORS: Palette) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }, loadingText: { color: COLORS.muted, fontSize: 13 },
  topBar: { height: 70, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cream },
  brandMark: { width: 42, height: 42, borderRadius: 15, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center' }, brandIcon: { color: COLORS.buttonText, fontFamily: 'serif', fontSize: 27, fontWeight: '700', marginTop: -2 },
  brandCopy: { marginLeft: 11, flex: 1 }, brandName: { fontFamily: 'serif', fontSize: 20, color: COLORS.ink, fontWeight: '700', letterSpacing: -0.5 }, brandLine: { color: COLORS.muted, fontSize: 8, fontWeight: '800', letterSpacing: 1.3, marginTop: 2 },
  topAction: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.line, marginLeft: 8 }, topActionAdd: { backgroundColor: COLORS.green, borderColor: COLORS.green }, topActionText: { fontSize: 25, color: COLORS.buttonText, lineHeight: 29 }, themeActionText: { fontSize: 20, color: COLORS.green, lineHeight: 24 },
  content: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 20, maxWidth: 700, width: '100%', alignSelf: 'center' },
  greetingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 7, marginBottom: 15 }, greetingTitle: { color: COLORS.ink, fontFamily: 'serif', fontSize: 27, fontWeight: '700', marginTop: 3 }, headerSearch: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center' }, headerSearchGlyph: { fontSize: 25, color: COLORS.green, marginTop: -2 }, eyebrow: { color: COLORS.green, fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  heroImage: { height: 266, borderRadius: 25, overflow: 'hidden', marginBottom: 16, backgroundColor: '#30251E' }, heroImageStyle: { borderRadius: 25 }, heroImageShade: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(10,16,12,0.19)' }, heroContent: { flex: 1, padding: 18, justifyContent: 'flex-start' }, heroPill: { alignSelf: 'flex-start', backgroundColor: COLORS.orange, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 }, heroPillText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 1.15 }, heroSpacer: { flex: 1 }, heroTitle: { fontFamily: 'serif', fontSize: 30, lineHeight: 33, color: '#FFFFFF', fontWeight: '700', letterSpacing: -0.45, textShadowColor: '#171C17', textShadowRadius: 8 }, heroCopy: { color: '#F1F0E9', fontSize: 12, fontWeight: '600', marginTop: 5, textShadowColor: '#171C17', textShadowRadius: 7 }, heroBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }, heroMatch: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' }, heroGo: { backgroundColor: '#FFFDF9', borderRadius: 22, paddingHorizontal: 13, paddingVertical: 9 }, heroGoText: { color: '#244B39', fontSize: 11, fontWeight: '800' },
  button: { backgroundColor: COLORS.green, borderRadius: 15, paddingHorizontal: 17, minHeight: 49, justifyContent: 'center', alignItems: 'center', marginVertical: 4 }, buttonSecondary: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line }, buttonCompact: { minHeight: 40, borderRadius: 20, paddingHorizontal: 15 }, buttonText: { color: COLORS.buttonText, fontSize: 14, fontWeight: '800' }, buttonTextSecondary: { color: COLORS.green }, buttonTextCompact: { fontSize: 12 },
  pantryPeek: { borderRadius: 18, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }, pantryPeekTitle: { color: COLORS.ink, fontSize: 14, fontWeight: '800' }, pantryPeekCopy: { color: COLORS.muted, fontSize: 12, marginTop: 4 }, link: { color: COLORS.green, fontWeight: '800', fontSize: 12 },
  useSoon: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.warning, borderRadius: 17, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 18, borderWidth: 1, borderColor: COLORS.orangeSoft }, useSoonDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: COLORS.orange, marginRight: 11 }, useSoonCopy: { flex: 1 }, useSoonHeading: { fontSize: 9, color: COLORS.warningText, fontWeight: '900', letterSpacing: 1.15 }, useSoonArrow: { color: COLORS.warningText, fontSize: 24, marginLeft: 8 }, useSoonIcon: { fontSize: 16, marginRight: 8 }, useSoonText: { color: COLORS.warningText, fontSize: 12, fontWeight: '700', flex: 1, marginTop: 3 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 8 }, homeSectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 5, marginBottom: 5 }, sectionKicker: { color: COLORS.orange, fontSize: 8, fontWeight: '900', letterSpacing: 1.3, marginBottom: 4 }, sectionTitle: { fontSize: 21, fontFamily: 'serif', fontWeight: '700', color: COLORS.ink, letterSpacing: -0.3 }, sectionHint: { fontSize: 11, lineHeight: 16, color: COLORS.muted, marginBottom: 9 },
  recipeRail: { paddingRight: 6, paddingBottom: 8 }, recipeCard: { flexDirection: 'row', borderRadius: 19, overflow: 'hidden', backgroundColor: COLORS.card, marginBottom: 12, borderWidth: 1, borderColor: COLORS.line, minHeight: 130 }, recipeCardCompact: { width: 236, flexDirection: 'column', marginBottom: 0, marginRight: 11 }, recipeImage: { width: 116, minHeight: 132, backgroundColor: COLORS.pale, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, recipeImageCompact: { width: '100%', height: 146, minHeight: 146 }, recipePhoto: { width: '100%', height: '100%', position: 'absolute' }, recipeImageTint: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(8,16,12,0.05)' }, recipeImageFallback: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }, recipeEmoji: { fontSize: 35, color: COLORS.green }, heart: { position: 'absolute', right: 9, top: 9, backgroundColor: 'rgba(255,253,249,0.96)', height: 31, width: 31, borderRadius: 16, justifyContent: 'center', alignItems: 'center' }, heartGlyph: { color: COLORS.orange, fontSize: 16 }, matchBadge: { position: 'absolute', left: 9, bottom: 9, backgroundColor: '#FFFDF9', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 }, matchBadgeText: { color: '#315B45', fontSize: 8, fontWeight: '900', letterSpacing: 0.45 }, recipeInfo: { flex: 1, paddingHorizontal: 12, paddingVertical: 12, justifyContent: 'center' }, recipeTitle: { color: COLORS.ink, fontSize: 14, lineHeight: 18, fontWeight: '800' }, recipeSub: { fontSize: 10, color: COLORS.muted, marginTop: 5 }, tagRow: { flexDirection: 'row', gap: 5, marginTop: 9, flexWrap: 'wrap' }, pill: { backgroundColor: COLORS.pale, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5, alignSelf: 'flex-start' }, pillText: { color: COLORS.green, fontSize: 9, fontWeight: '800' }, reviewNote: { color: COLORS.orange, marginTop: 8, fontSize: 11, fontWeight: '700' },
  homeShortcuts: { marginTop: 9, gap: 8 }, shortcutCard: { minHeight: 66, borderRadius: 17, backgroundColor: COLORS.greenSoft, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, gap: 11 }, shortcutOrange: { backgroundColor: COLORS.orangeSoft }, shortcutIcon: { fontSize: 22, fontWeight: '700', color: COLORS.green, width: 28, textAlign: 'center' }, shortcutTitle: { color: COLORS.ink, fontWeight: '800', fontSize: 12 }, shortcutCopy: { color: COLORS.muted, fontSize: 10, marginTop: 3 },
  featureCard: { backgroundColor: COLORS.pale, borderRadius: 21, padding: 18, marginTop: 8 }, featureKicker: { color: COLORS.orange, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 }, featureTitle: { fontSize: 20, lineHeight: 25, fontWeight: '800', color: COLORS.ink, marginTop: 7 }, featureCopy: { fontSize: 12, lineHeight: 18, color: COLORS.muted, marginVertical: 8 },
  pageIntro: { marginTop: 12, marginBottom: 18 }, pageTitle: { fontFamily: 'serif', fontSize: 34, lineHeight: 38, fontWeight: '700', color: COLORS.ink, letterSpacing: -0.8, marginTop: 5 }, pageCopy: { fontSize: 12, lineHeight: 18, color: COLORS.muted, marginTop: 6, maxWidth: 330 }, searchBox: { height: 49, backgroundColor: COLORS.card, borderRadius: 17, borderWidth: 1, borderColor: COLORS.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginBottom: 12 }, searchIcon: { color: COLORS.green, fontSize: 24, marginRight: 7 }, searchInput: { flex: 1, paddingVertical: 0, color: COLORS.ink, fontSize: 13 }, inlineActions: { flexDirection: 'row', gap: 8 }, filterLine: { flexDirection: 'row', gap: 7, marginVertical: 8, flexWrap: 'wrap' }, emptyText: { color: COLORS.muted, fontSize: 13, lineHeight: 20, marginVertical: 8 },
  onlineSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 }, onlineSearchBox: { flex: 1, marginBottom: 0 }, searchLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 18 }, onlineResultCard: { flexDirection: 'row', overflow: 'hidden', minHeight: 128, backgroundColor: COLORS.card, borderRadius: 19, borderWidth: 1, borderColor: COLORS.line, marginBottom: 11 }, onlineResultImage: { width: 116, minHeight: 128, backgroundColor: COLORS.pale }, onlineImageFallback: { alignItems: 'center', justifyContent: 'center' }, onlineResultInfo: { flex: 1, padding: 12, justifyContent: 'center' }, previewImage: { width: '100%', height: 210, borderRadius: 20, backgroundColor: COLORS.pale, marginBottom: 12 }, attribution: { color: COLORS.muted, fontSize: 10, textAlign: 'center', marginVertical: 12 },
  themeOptions: { gap: 9, marginTop: 7 }, themeOption: { minHeight: 70, backgroundColor: COLORS.white, borderRadius: 15, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, themeOptionSelected: { borderColor: COLORS.green, backgroundColor: COLORS.greenSoft }, themeOptionCopy: { flex: 1 }, themeOptionTitle: { fontSize: 14, fontWeight: '800', color: COLORS.ink }, themeOptionDescription: { color: COLORS.muted, fontSize: 11, marginTop: 4 }, radioOuter: { width: 21, height: 21, borderRadius: 11, borderWidth: 1.5, borderColor: COLORS.muted, alignItems: 'center', justifyContent: 'center', marginLeft: 12 }, radioOuterSelected: { borderColor: COLORS.green }, radioInner: { width: 11, height: 11, borderRadius: 6, backgroundColor: COLORS.green }, reviewBoxText: { color: COLORS.warningText, fontSize: 12, lineHeight: 17 },
  inventorySummary: { backgroundColor: COLORS.green, borderRadius: 22, padding: 18, flexDirection: 'row', alignItems: 'center', marginBottom: 13 }, inventoryCount: { color: COLORS.buttonText, fontFamily: 'serif', fontSize: 42, fontWeight: '700', marginRight: 13 }, inventoryTitle: { color: COLORS.buttonText, fontSize: 14, fontWeight: '800' }, inventorySub: { color: COLORS.buttonText, opacity: 0.78, fontSize: 11, marginTop: 3 }, inventoryEmoji: { fontSize: 29, marginLeft: 'auto', color: COLORS.buttonText }, ingredientRow: { backgroundColor: COLORS.card, borderRadius: 17, borderWidth: 1, borderColor: COLORS.line, flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 8 }, ingredientDot: { width: 40, height: 40, borderRadius: 14, backgroundColor: COLORS.greenSoft, alignItems: 'center', justifyContent: 'center', marginRight: 10 }, ingredientGlyph: { color: COLORS.green, fontFamily: 'serif', fontSize: 18, fontWeight: '700' }, ingredientName: { color: COLORS.ink, fontSize: 13, fontWeight: '800' }, ingredientMeta: { color: COLORS.muted, fontSize: 10, marginTop: 3 }, remove: { color: COLORS.orange, fontSize: 22, paddingHorizontal: 7 }, tipCard: { borderRadius: 19, backgroundColor: COLORS.pale, padding: 16, marginTop: 16 }, tipTitle: { color: COLORS.ink, fontSize: 15, fontWeight: '800' }, tipCopy: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  weekCard: { backgroundColor: COLORS.card, borderRadius: 21, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 13, marginBottom: 14 }, dayRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', borderBottomColor: COLORS.line, borderBottomWidth: 1, gap: 11 }, dayBadge: { width: 43, height: 43, borderRadius: 15, backgroundColor: COLORS.orangeSoft, alignItems: 'center', justifyContent: 'center' }, dayText: { color: COLORS.orange, fontSize: 11, fontWeight: '900' }, dayMeal: { color: COLORS.ink, fontSize: 13, fontWeight: '800' }, dayMeta: { color: COLORS.muted, fontSize: 10, marginTop: 4 }, chevron: { color: COLORS.muted, fontSize: 24, marginHorizontal: 5 },
  queueRow: { flexDirection: 'row', alignItems: 'center', minHeight: 64, backgroundColor: COLORS.white, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 13, marginBottom: 8 }, queueRemove: { paddingHorizontal: 6, paddingVertical: 4 }, emptyQueue: { backgroundColor: COLORS.white, borderRadius: 15, borderWidth: 1, borderColor: COLORS.line, padding: 13, marginBottom: 12 },
  shopActions: { flexDirection: 'row', gap: 8 }, aisleTitle: { fontSize: 13, color: COLORS.green, fontWeight: '800', marginTop: 13, marginBottom: 7 }, shopRow: { minHeight: 54, backgroundColor: COLORS.white, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, marginBottom: 8 }, cookIngredient: { minHeight: 50, backgroundColor: COLORS.white, borderRadius: 13, borderWidth: 1, borderColor: COLORS.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginBottom: 7 }, checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: COLORS.muted, marginRight: 11, justifyContent: 'center', alignItems: 'center' }, checkboxChecked: { backgroundColor: COLORS.green, borderColor: COLORS.green }, checkmark: { color: COLORS.buttonText, fontSize: 13, fontWeight: '800' }, shopName: { color: COLORS.ink, fontSize: 13, flex: 1 }, shopDone: { textDecorationLine: 'line-through', color: COLORS.muted }, shopArrow: { fontSize: 20, color: COLORS.muted }, emptyCard: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 20, alignItems: 'center', padding: 25, marginTop: 14 }, emptyEmoji: { fontSize: 42 }, emptyTitle: { color: COLORS.ink, fontSize: 17, fontWeight: '800', marginTop: 10, textAlign: 'center' },
  tabBar: { minHeight: 72, backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.line, paddingHorizontal: 7, paddingTop: 7, paddingBottom: Platform.OS === 'ios' ? 8 : 6, flexDirection: 'row', justifyContent: 'space-around' }, tabItem: { minWidth: 56, minHeight: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, tabItemActive: { backgroundColor: COLORS.greenSoft }, tabIcon: { fontSize: 20, color: COLORS.muted, lineHeight: 24 }, tabIconActive: { color: COLORS.green, fontWeight: '900' }, tabLabel: { fontSize: 9, color: COLORS.muted, marginTop: 1 }, tabLabelActive: { color: COLORS.green, fontWeight: '900' },
  modalBackdrop: { flex: 1, backgroundColor: '#000000B8', justifyContent: 'flex-end' }, keyboardWrap: { justifyContent: 'flex-end', flex: 1 }, modalSheet: { maxHeight: '92%', backgroundColor: COLORS.cream, borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20, paddingTop: 13 }, modalGrabber: { height: 4, width: 38, borderRadius: 3, backgroundColor: COLORS.line, alignSelf: 'center', marginBottom: 15 }, modalClose: { position: 'absolute', top: 10, right: 18, width: 34, height: 34, alignItems: 'center', justifyContent: 'center', zIndex: 2 }, modalCloseText: { color: COLORS.muted, fontSize: 26, lineHeight: 30 }, modalEyebrow: { color: COLORS.green, fontSize: 10, fontWeight: '800', letterSpacing: 1.3, marginTop: 8 }, modalTitle: { fontFamily: 'serif', fontSize: 25, lineHeight: 30, color: COLORS.ink, fontWeight: '700', marginTop: 5, marginRight: 28 }, modalCopy: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 6, marginBottom: 12 }, input: { minHeight: 47, backgroundColor: COLORS.white, borderRadius: 13, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 13, paddingVertical: 11, color: COLORS.ink, fontSize: 13, marginBottom: 9 }, textArea: { minHeight: 88, textAlignVertical: 'top' }, importNote: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginBottom: 8 }, detailStats: { flexDirection: 'row', gap: 7, flexWrap: 'wrap', marginVertical: 7 }, sourceLine: { color: COLORS.muted, fontSize: 11, marginBottom: 7 }, reviewBox: { color: COLORS.warningText, backgroundColor: COLORS.warning, padding: 11, borderRadius: 12, fontSize: 12, lineHeight: 17, marginVertical: 7 }, detailLine: { fontSize: 13, color: COLORS.ink, lineHeight: 21, marginBottom: 3 }, detailStep: { color: COLORS.muted, fontSize: 13, lineHeight: 20, marginBottom: 9 }, stepNumber: { color: COLORS.green, fontWeight: '800' }, modalButtonStack: { marginTop: 10 }, cookStepCard: { backgroundColor: COLORS.greenSoft, borderRadius: 18, padding: 18, marginVertical: 13, minHeight: 145, justifyContent: 'center' }, cookStepText: { fontSize: 19, lineHeight: 28, color: COLORS.ink, fontWeight: '700' }, pickerRow: { flexDirection: 'row', alignItems: 'center', minHeight: 59, borderBottomWidth: 1, borderBottomColor: COLORS.line }, pickerTitle: { color: COLORS.ink, fontSize: 13, fontWeight: '700' },
  });
}
