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
  ink: '#181922', muted: '#777985', green: '#C29125', greenSoft: '#F4E9C9', cream: '#F6F4F0', white: '#FFFFFF',
  line: '#E5E2DC', orange: '#F36F45', orangeSoft: '#F9E4DA', yellow: '#E8BD4A', card: '#FFFEFC', pale: '#EEEBE5', warning: '#FFF0D5', warningText: '#805627', buttonText: '#FFFFFF',
};
const DARK_COLORS: typeof LIGHT_COLORS = {
  ink: '#F5F4F2', muted: '#A0A1AA', green: '#F0C958', greenSoft: '#302A1D', cream: '#101117', white: '#1A1B24',
  line: '#2D2E38', orange: '#FF744A', orangeSoft: '#39231F', yellow: '#F0CB62', card: '#1B1C25', pale: '#24252F', warning: '#3A2B22', warningText: '#F3C79C', buttonText: '#FFFFFF',
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
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const [chefPoints, setChefPoints] = useState(0);
  const [homeCategory, setHomeCategory] = useState('For you');
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
          if (typeof data.chefPoints === 'number' && Number.isFinite(data.chefPoints)) setChefPoints(Math.max(0, data.chefPoints));
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
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ pantry, recipes, shopping, plan, queue, themeMode, chefPoints })).catch(() => {});
  }, [ready, pantry, recipes, shopping, plan, queue, themeMode, chefPoints]);

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

  const Pill = ({ children, color = COLORS.pale, textColor = COLORS.ink }: { children: React.ReactNode; color?: string; textColor?: string }) => (
    <View style={[styles.pill, { backgroundColor: color }]}><Text style={[styles.pillText, { color: textColor }]}>{children}</Text></View>
  );
  const Button = ({ label, onPress, secondary = false, compact = false, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; compact?: boolean; disabled?: boolean }) => (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, compact && styles.buttonCompact, (pressed || disabled) && { opacity: disabled ? 0.55 : 0.78 }]}>
      <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary, compact && styles.buttonTextCompact]}>{label}</Text>
    </Pressable>
  );
  const SectionTitle = ({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) => (
    <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text>{action ? <Pressable onPress={onPress}><Text style={styles.link}>{action}</Text></Pressable> : null}</View>
  );
  const RecipeCard = ({ recipe, compact = false }: { recipe: Recipe; compact?: boolean }) => {
    const count = recipeMatch(recipe, pantry);
    const source = recipe.imageKey ? RECIPE_IMAGES[recipe.imageKey] : recipe.imageUrl ? { uri: recipe.imageUrl } : null;
    return <Pressable onPress={() => openRecipe(recipe)} style={[styles.recipeCard, compact && styles.recipeCardCompact]}>
      <View style={[styles.recipeImage, compact && styles.recipeImageCompact]}>
        {source ? <Image source={source} style={styles.recipePhoto} resizeMode="cover" /> : <View style={styles.recipeImageFallback}><Text style={styles.fallbackGlyph}>✦</Text></View>}
        <View style={styles.recipeImageShade} />
        <View style={styles.cardPhotoTop}><Pill color="rgba(15,16,22,0.82)" textColor="#FFFFFF">{count}/{recipe.ingredients.length} IN YOUR KITCHEN</Pill><Pressable accessibilityRole="button" accessibilityLabel={recipe.saved ? "Remove from saved recipes" : "Save recipe"} onPress={(event) => { event.stopPropagation(); toggleSaved(recipe.id); }} style={styles.heart}><Text style={styles.heartGlyph}>{recipe.saved ? '♥' : '♡'}</Text></Pressable></View>
      </View>
      <View style={styles.recipeInfo}><Text style={styles.recipeTitle}>{recipe.title}</Text><Text style={styles.recipeSub}>{recipe.minutes > 0 ? recipe.minutes + ' min' : 'Online'}  ·  {recipe.servings > 0 ? recipe.servings + ' servings' : recipe.tags[0] || 'Recipe'}</Text><View style={styles.recipeBottomLine}><Text style={styles.recipeTag}>{recipe.tags[0] || 'Chef’s pick'}</Text>{recipe.status === 'review' ? <Text style={styles.reviewNote}>Needs review</Text> : <Text style={styles.recipeMatchText}>{count} match{count === 1 ? '' : 'es'}</Text>}</View></View>
    </Pressable>;
  };

  function renderToday() {
    const top = matches[0]?.recipe || recipes[0];
    const useSoon = pantry.filter((item) => isUseSoon(item.expires));
    const categoryMatches = homeCategory === 'Quick' ? matches.filter((x) => x.recipe.minutes > 0 && x.recipe.minutes <= 25)
      : homeCategory === 'Vegetarian' ? matches.filter((x) => x.recipe.tags.some((tag) => /vegetarian|plant/i.test(tag)))
      : homeCategory === 'Use soon' ? matches.filter((x) => x.useSoon > 0)
      : matches;
    const heroRecipe = categoryMatches[0]?.recipe || top;
    const heroSource = heroRecipe.imageKey ? RECIPE_IMAGES[heroRecipe.imageKey] : heroRecipe.imageUrl ? { uri: heroRecipe.imageUrl } : RECIPE_IMAGES.skillet;
    const level = Math.floor(chefPoints / 300) + 1;
    const levelProgress = Math.round((chefPoints % 300) / 3);
    return <>
      <View style={styles.homeHeading}><View><Text style={styles.eyebrow}>YOUR KITCHEN, YOUR NEXT ADVENTURE</Text><Text style={styles.greetingTitle}>Let’s make something good.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Add a pantry item" onPress={() => setModal('pantry')} style={styles.addCircle}><Text style={styles.addCircleText}>＋</Text></Pressable></View>
      <Pressable onPress={() => openRecipe(heroRecipe)} style={styles.heroCard}>
        <ImageBackground source={heroSource} imageStyle={styles.heroPhotoImage} style={styles.heroPhoto}>
          <View style={styles.heroScrim} />
          <View style={styles.heroTopLine}><View style={styles.heroLabel}><Text style={styles.heroLabelText}>RECIPE OF THE DAY</Text></View><Pressable accessibilityRole="button" accessibilityLabel={heroRecipe.saved ? "Remove recipe from saved" : "Save recipe"} onPress={(event) => { event.stopPropagation(); toggleSaved(heroRecipe.id); }} style={styles.heroHeart}><Text style={styles.heroHeartText}>{heroRecipe.saved ? '♥' : '♡'}</Text></Pressable></View>
          <View style={styles.heroPhotoContent}><Text style={styles.heroTitle}>{heroRecipe.title}</Text><Text style={styles.heroDescription}>{heroRecipe.description}</Text><View style={styles.heroStats}><Text style={styles.heroStat}>◷  {heroRecipe.minutes || 30} min</Text><Text style={styles.heroStat}>♧  {heroRecipe.servings || 2} servings</Text><Text style={styles.heroReward}>+75 PTS</Text></View></View>
        </ImageBackground>
        <View style={styles.heroFooter}><View style={{ flex: 1 }}><Text style={styles.heroMatchLabel}>PANTRY MATCH</Text><Text style={styles.heroMatchValue}>{recipeMatch(heroRecipe, pantry)} of {heroRecipe.ingredients.length} ingredients ready</Text></View><View style={styles.heroStart}><Text style={styles.heroStartText}>Start cooking  →</Text></View></View>
      </Pressable>
      <View style={styles.categoryHeader}><Text style={styles.sectionTitle}>Explore recipes</Text><Pressable onPress={() => { setTab('Recipes'); setRecipeView('saved'); }}><Text style={styles.link}>See all  ›</Text></Pressable></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRail}>{['For you', 'Quick', 'Vegetarian', 'Use soon'].map((category) => <Pressable key={category} onPress={() => setHomeCategory(category)} style={[styles.categoryChip, homeCategory === category && styles.categoryChipActive]}><Text style={[styles.categoryText, homeCategory === category && styles.categoryTextActive]}>{category}</Text></Pressable>)}</ScrollView>
      <View style={styles.recipeRail}>{categoryMatches.slice(0, 3).map(({ recipe }) => <RecipeCard key={recipe.id} recipe={recipe} compact />)}</View>
      <View style={styles.assistantCard}><View style={styles.assistantTop}><View style={styles.assistantOrb}><Text style={styles.assistantOrbText}>✦</Text></View><View style={{ flex: 1 }}><Text style={styles.assistantEyebrow}>YOUR SOUS-CHEF</Text><Text style={styles.assistantTitle}>A little kitchen inspiration</Text></View><Text style={styles.assistantSpark}>✧</Text></View><Text style={styles.assistantCopy}>{useSoon.length ? 'Let’s rescue ' + useSoon.slice(0, 2).map((item) => item.name.toLowerCase()).join(' and ') + ' with a dinner made from your pantry.' : 'Your pantry has ' + pantry.length + ' ingredients ready to turn into something delicious.'}</Text><Pressable onPress={createFromPantry} style={styles.assistantAction}><Text style={styles.assistantActionText}>Make me a pantry recipe  ↗</Text></Pressable></View>
      <View style={styles.levelCard}><View style={styles.levelTop}><View><Text style={styles.levelEyebrow}>CHEF JOURNEY</Text><Text style={styles.levelTitle}>Level {level} · Home cook</Text></View><View style={styles.pointsBadge}><Text style={styles.pointsBadgeText}>✦  {chefPoints} pts</Text></View></View><View style={styles.progressTrack}><View style={[styles.progressFill, { width: levelProgress + '%' }]} /></View><Text style={styles.levelNote}>{300 - (chefPoints % 300)} points to your next kitchen badge</Text></View>
      <View style={styles.homeQuickActions}><Pressable style={styles.quickAction} onPress={() => { setRecipeView('online'); setTab('Recipes'); }}><Text style={styles.quickActionIcon}>⌕</Text><Text style={styles.quickActionText}>Search online</Text></Pressable><Pressable style={styles.quickAction} onPress={() => setTab('Pantry')}><Text style={styles.quickActionIcon}>▤</Text><Text style={styles.quickActionText}>My pantry</Text></Pressable><Pressable style={styles.quickAction} onPress={() => setTab('Plan')}><Text style={styles.quickActionIcon}>▦</Text><Text style={styles.quickActionText}>Meal plan</Text></Pressable></View>
    </>;
  }

  function renderRecipes() {
    return <>
      <View style={styles.pageIntro}><Text style={styles.eyebrow}>{recipeView === 'online' ? 'FIND YOUR NEXT FAVORITE' : 'YOUR PERSONAL COOKBOOK'}</Text><Text style={styles.pageTitle}>{recipeView === 'online' ? 'Discover' : 'Recipes'}</Text><Text style={styles.pageCopy}>{recipeView === 'online' ? 'Find a dish, then see how it fits your kitchen.' : 'Recipes saved, created, and ready for your next cook.'}</Text></View>
      <View style={styles.viewSwitch}><Pressable onPress={() => setRecipeView('saved')} style={[styles.viewSwitchButton, recipeView === 'saved' && styles.viewSwitchActive]}><Text style={[styles.viewSwitchText, recipeView === 'saved' && styles.viewSwitchTextActive]}>My recipes</Text></Pressable><Pressable onPress={() => setRecipeView('online')} style={[styles.viewSwitchButton, recipeView === 'online' && styles.viewSwitchActive]}><Text style={[styles.viewSwitchText, recipeView === 'online' && styles.viewSwitchTextActive]}>Online ideas</Text></Pressable></View>
      {recipeView === 'online' ? <>
        <View style={styles.onlineSearchRow}><View style={[styles.searchBox, styles.onlineSearchBox]}><Text style={styles.searchIcon}>⌕</Text><TextInput value={onlineQuery} onChangeText={setOnlineQuery} onSubmitEditing={() => runOnlineSearch()} returnKeyType="search" placeholder="Dish, ingredient or cuisine" placeholderTextColor={COLORS.muted} style={styles.searchInput} /></View><Button label="Search" onPress={() => runOnlineSearch()} disabled={!onlineQuery.trim() || onlineLoading} compact /></View>
        <Text style={styles.sectionHint}>Search with one of your ingredients</Text><View style={styles.filterLine}>{pantry.slice(0, 7).map((item) => <Pressable key={item.id} disabled={onlineLoading} onPress={() => runOnlineSearch(item.name, true)}><Pill color={COLORS.pale}>{item.name}</Pill></Pressable>)}</View>
        {onlineLoading ? <View style={styles.searchLoading}><ActivityIndicator color={COLORS.orange} /><Text style={styles.sectionHint}>Looking for a good match…</Text></View> : null}
        {onlineError ? <View style={styles.reviewBox}><Text style={styles.reviewBoxText}>{onlineError}</Text></View> : null}
        {!onlineLoading && !onlineError && onlineResults.length === 0 ? <View style={styles.emptyCard}><Text style={styles.emptyGlyph}>✦</Text><Text style={styles.emptyTitle}>What sounds good?</Text><Text style={styles.emptyText}>Search by dish, cuisine, or an ingredient on your shelf.</Text></View> : null}
        {onlineResults.map((meal) => { const recipe = toSavedOnlineRecipe(meal); const alreadySaved = recipes.some((item) => item.id === recipe.id); const openResult = () => alreadySaved ? openRecipe(recipe) : openOnlineMeal(meal); return <Pressable key={meal.id} onPress={openResult} style={styles.onlineResultCard}>{meal.imageUrl ? <Image source={{ uri: meal.imageUrl }} style={styles.onlineResultImage} resizeMode="cover" /> : <View style={[styles.onlineResultImage, styles.onlineImageFallback]}><Text style={styles.emptyGlyph}>✦</Text></View>}<View style={styles.onlineResultInfo}><Text style={styles.recipeTitle}>{meal.title}</Text><Text style={styles.recipeSub}>{[meal.cuisine, meal.category].filter(Boolean).join(' · ') || 'Chef’s pick'}</Text><Text style={styles.recipeMatchText}>{recipeMatch(recipe, pantry)} ingredients in your kitchen</Text></View></Pressable>; })}
        {onlineResults.length > 0 ? <Text style={styles.attribution}>Recipe data and photos provided by TheMealDB.</Text> : null}
      </> : <>
        <View style={styles.searchBox}><Text style={styles.searchIcon}>⌕</Text><TextInput value={search} onChangeText={setSearch} placeholder="Search your collection" placeholderTextColor={COLORS.muted} style={styles.searchInput} /></View>
        <View style={styles.inlineActions}><Button label="＋ Create" onPress={() => setModal('create')} compact /><Button label="Import a recipe" onPress={() => setModal('import')} secondary compact /><Button label="Online" onPress={() => setRecipeView('online')} secondary compact /></View>
        <View style={styles.filterLine}>{(['all', 'saved', 'pantry'] as const).map((filter) => { const label = filter === 'all' ? 'All ' + recipes.length : filter === 'saved' ? 'Saved ' + recipes.filter((recipe) => recipe.saved).length : 'Pantry match'; const active = recipeFilter === filter; return <Pressable key={filter} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => setRecipeFilter(filter)} style={[styles.categoryChip, active && styles.categoryChipActive]}><Text style={[styles.categoryText, active && styles.categoryTextActive]}>{label}</Text></Pressable>; })}</View>
        {visibleRecipes.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} />)}{visibleRecipes.length === 0 && <Text style={styles.emptyText}>No recipes match. Try a different search.</Text>}
      </>}
    </>;
  }

  function renderPantry() {
    const useSoon = pantry.filter((item) => isUseSoon(item.expires));
    return <>
      <View style={styles.pageIntro}><Text style={styles.eyebrow}>YOUR HOME KITCHEN</Text><Text style={styles.pageTitle}>Pantry</Text><Text style={styles.pageCopy}>A little inventory. A lot more dinner inspiration.</Text></View>
      <View style={styles.pantryHero}><View><Text style={styles.pantryCount}>{pantry.length}</Text><Text style={styles.pantryHeroLabel}>ingredients in your kitchen</Text><Text style={styles.pantryHeroNote}>{useSoon.length} ready to use first</Text></View><View style={styles.pantryHeroIcon}><Text style={styles.pantryHeroGlyph}>✦</Text></View></View>
      <View style={styles.pantryActions}><Button label="＋ Add ingredient" onPress={() => setModal('pantry')} /><Button label="Get recipe ideas" onPress={createFromPantry} secondary /></View>
      {useSoon.length > 0 ? <><SectionTitle title="Use these soon" />{useSoon.map((item) => <View key={'soon-' + item.id} style={styles.pantryRow}><View style={[styles.pantryItemIcon, styles.useSoonIconBox]}><Text style={styles.pantryItemGlyph}>!</Text></View><View style={{ flex: 1 }}><Text style={styles.ingredientName}>{item.name}</Text><Text style={styles.ingredientMeta}>{item.quantity} · use soon</Text></View><Pressable onPress={() => toggleUseSoon(item.id)}><Text style={styles.link}>Done</Text></Pressable></View>)}</> : null}
      <SectionTitle title="Everything on your shelf" />
      {pantry.length ? pantry.map((item) => <View key={item.id} style={styles.pantryRow}><View style={styles.pantryItemIcon}><Text style={styles.pantryItemGlyph}>{item.name.slice(0, 1).toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text style={styles.ingredientName}>{item.name}</Text><Text style={styles.ingredientMeta}>{item.quantity}{item.expires && !isUseSoon(item.expires) ? ' · ' + item.expires : ''}</Text></View><Pressable onPress={() => toggleUseSoon(item.id)} hitSlop={8}><Text style={styles.link}>{isUseSoon(item.expires) ? 'Soon' : '＋ Soon'}</Text></Pressable><Pressable onPress={() => removePantry(item.id)} hitSlop={10} style={styles.removeButton}><Text style={styles.remove}>×</Text></Pressable></View>) : <View style={styles.emptyCard}><Text style={styles.emptyGlyph}>▤</Text><Text style={styles.emptyTitle}>Your pantry is waiting</Text><Text style={styles.emptyText}>Add a few ingredients and we’ll find dishes that fit.</Text></View>}
    </>;
  }

  function renderPlan() {
    const queuedRecipes = queue.map((recipeId) => recipes.find((recipe) => recipe.id === recipeId)).filter((recipe): recipe is Recipe => Boolean(recipe));
    const plannedCount = Object.values(plan).filter((rid) => recipes.some((recipe) => recipe.id === rid)).length;
    return <>
      <View style={styles.pageIntro}><Text style={styles.eyebrow}>MAKE A LITTLE ROOM FOR GOOD FOOD</Text><Text style={styles.pageTitle}>Your week</Text><Text style={styles.pageCopy}>{plannedCount} meals planned · your list updates from what’s missing.</Text></View>
      <View style={styles.planSummary}><Text style={styles.planSummaryKicker}>THE WEEK AHEAD</Text><Text style={styles.planSummaryTitle}>{plannedCount ? plannedCount + ' delicious plans' : 'Ready when you are'}</Text><Text style={styles.planSummaryCopy}>Tap a day to pick a recipe. PantryScout keeps track of the ingredients you need.</Text></View>
      {queuedRecipes.length ? <><SectionTitle title={'Cook soon · ' + queuedRecipes.length} action="Browse" onPress={() => setTab('Recipes')} />{queuedRecipes.map((recipe) => <View key={recipe.id} style={styles.queueRow}><Pressable style={{ flex: 1 }} onPress={() => openRecipe(recipe)}><Text style={styles.pickerTitle}>{recipe.title}</Text><Text style={styles.ingredientMeta}>{recipe.minutes} min · {recipeMatch(recipe, pantry)}/{recipe.ingredients.length} ready</Text></Pressable><Pressable onPress={() => toggleQueue(recipe.id)} style={styles.queueRemove}><Text style={styles.remove}>×</Text></Pressable></View>)}</> : <View style={styles.emptyQueue}><Text style={styles.emptyText}>Save a recipe here to keep it in your sights.</Text><Button label="Browse recipes" onPress={() => setTab('Recipes')} secondary compact /></View>}
      <SectionTitle title="This week" />
      <View style={styles.weekCard}>{DAYS.map((day, index) => { const recipe = plannedRecipe(day); return <Pressable key={day} style={[styles.dayRow, index === DAYS.length - 1 && styles.dayRowLast]} onPress={() => { setPickerDay(day); setModal('picker'); }}><View style={[styles.dayBadge, recipe && styles.dayBadgeActive]}><Text style={[styles.dayText, recipe && styles.dayTextActive]}>{day}</Text></View><View style={{ flex: 1 }}><Text style={styles.dayMeal}>{recipe?.title || 'Add a meal'}</Text><Text style={styles.dayMeta}>{recipe ? recipe.minutes + ' min · ' + recipe.servings + ' servings' : 'Choose from your recipes'}</Text></View><Text style={styles.chevron}>›</Text></Pressable>; })}</View>
      <Button label="Build my shopping list  →" onPress={() => { const planned = Object.values(plan).map((rid) => recipes.find((r) => r.id === rid)).filter((r): r is Recipe => Boolean(r)); const missing = planned.flatMap((r) => r.ingredients.filter((ingredient) => !hasPantryIngredient(ingredient, pantry))); setShopping((items) => { const current = new Set(items.map((x) => ingredientKey(x.name))); const additions: string[] = []; for (const name of missing) { const key = ingredientKey(name); if (key && !current.has(key)) { current.add(key); additions.push(name); } } return [...items, ...additions.map((name) => ({ id: id(), name, checked: false }))]; }); setTab('Shop'); }} />
    </>;
  }

  function renderShop() {
    const unchecked = shopping.filter((item) => !item.checked);
    const checked = shopping.filter((item) => item.checked);
    const renderGrouped = (items: ShopItem[]) => AISLES.map((aisle) => { const group = items.filter((item) => shoppingAisle(item.name) === aisle); return group.length ? <View key={aisle} style={styles.aisleGroup}><Text style={styles.aisleTitle}>{aisle}</Text>{group.map((item) => <Pressable key={item.id} accessibilityRole="checkbox" accessibilityState={{ checked: item.checked }} onPress={() => toggleShopping(item.id)} style={styles.shopRow}><View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>{item.checked ? <Text style={styles.checkmark}>✓</Text> : null}</View><Text style={[styles.shopName, item.checked && styles.shopDone]}>{item.name}</Text><Text style={styles.shopArrow}>›</Text></Pressable>)}</View> : null; });
    return <>
      <View style={styles.pageIntro}><Text style={styles.eyebrow}>GOOD THINGS TO PICK UP</Text><Text style={styles.pageTitle}>Shopping</Text><Text style={styles.pageCopy}>{unchecked.length} things left on your list.</Text></View>
      <View style={styles.shopSummary}><Text style={styles.shopSummaryIcon}>✦</Text><View style={{ flex: 1 }}><Text style={styles.shopSummaryTitle}>{unchecked.length ? 'Your next kitchen run' : 'Your list is clear'}</Text><Text style={styles.shopSummaryCopy}>Only missing ingredients from the meals you chose.</Text></View><Pressable accessibilityLabel="Add shopping item" onPress={() => setModal('shop-add')} style={styles.addCircle}><Text style={styles.addCircleText}>＋</Text></Pressable></View>
      {shopping.length === 0 ? <View style={styles.emptyCard}><Text style={styles.emptyGlyph}>⌑</Text><Text style={styles.emptyTitle}>Nothing on the list yet</Text><Text style={styles.emptyText}>Add ingredients from a recipe or build a list from your week.</Text><Button label="Plan a meal" onPress={() => setTab('Plan')} secondary compact /></View> : <>
        {unchecked.length > 0 && renderGrouped(unchecked)}
        {checked.length > 0 && <><SectionTitle title="Picked up" /><Text style={styles.sectionHint}>Tap an item to add it back to your list.</Text>{renderGrouped(checked)}</>}
      </>}
      <View style={styles.shopActions}><Button label="＋ Add item" onPress={() => setModal('shop-add')} compact /><Button label="Clear checked" onPress={() => setShopping((items) => items.filter((item) => !item.checked))} secondary compact disabled={!checked.length} /></View>
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
      <View style={styles.modalButtonStack}>{cookStep > 0 && <Button label="← Previous step" onPress={() => setCookStep((step) => Math.max(0, step - 1))} secondary />}{selectedRecipe.steps.length > 0 && <Button label={cookStep + 1 >= selectedRecipe.steps.length ? 'Finish cooking · +75 pts' : 'Next step →'} onPress={() => { if (cookStep + 1 >= selectedRecipe.steps.length) { setChefPoints((points) => points + 75); setModal('recipe'); } else setCookStep((step) => step + 1); }} />}{selectedRecipe.steps.length === 0 && <Button label="Back to recipe" onPress={() => setModal('recipe')} secondary />}</View>
    </>;
    if (modal === 'picker') return <>
      <Text style={styles.modalEyebrow}>WEEKLY MEAL PLAN</Text><Text style={styles.modalTitle}>Choose for {pickerDay}</Text><Text style={styles.modalCopy}>Pick a saved recipe. Add another one to your cookbook if it’s missing.</Text>
      {recipes.map((recipe) => <Pressable key={recipe.id} style={styles.pickerRow} onPress={() => assignPlan(recipe.id)}><View style={{ flex: 1 }}><Text style={styles.pickerTitle}>{recipe.title}</Text><Text style={styles.ingredientMeta}>{recipe.minutes} min · matches {recipeMatch(recipe, pantry)} pantry items</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}
      <Button label="＋ Create a recipe" onPress={() => setModal('create')} secondary />
    </>;
    return null;
  }

  const tabs: { name: Tab; icon: string }[] = [
    { name: 'Today', icon: '⌂' }, { name: 'Recipes', icon: '✧' }, { name: 'Pantry', icon: '▤' }, { name: 'Plan', icon: '▦' }, { name: 'Shop', icon: '⌑' },
  ];
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Chef profile and appearance" style={styles.profileButton} onPress={() => setModal('settings')}>
          <View style={styles.profileAvatar}><Text style={styles.profileInitial}>A</Text></View>
          <View style={styles.profileCopy}><Text style={styles.profileName}>Chef Andrei</Text><Text style={styles.profileLevel}>HOME COOK · LEVEL {Math.floor(chefPoints / 300) + 1}</Text></View>
        </Pressable>
        <View style={styles.headerActions}><View style={styles.headerPoints}><Text style={styles.headerPointsStar}>✦</Text><Text style={styles.headerPointsText}>{chefPoints}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Search online recipes" style={styles.headerSearch} onPress={() => { setRecipeView('online'); setTab('Recipes'); }}><Text style={styles.headerSearchGlyph}>⌕</Text></Pressable></View>
      </View>
      <ScrollView ref={mainScroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {tab === 'Today' ? renderToday() : tab === 'Recipes' ? renderRecipes() : tab === 'Pantry' ? renderPantry() : tab === 'Plan' ? renderPlan() : renderShop()}
        <View style={{ height: 22 }} />
      </ScrollView>
      <View style={[styles.tabBar, { paddingBottom: Math.max(7, insets.bottom) }]}>{tabs.map((item) => <Pressable key={item.name} accessibilityRole="tab" accessibilityLabel={item.name} accessibilityState={{ selected: tab === item.name }} hitSlop={4} style={[styles.tabItem, tab === item.name && styles.tabItemActive]} onPress={() => { setTab(item.name); setSearch(''); }}><Text style={[styles.tabIcon, tab === item.name && styles.tabIconActive]}>{item.icon}</Text><Text style={[styles.tabLabel, tab === item.name && styles.tabLabelActive]}>{item.name}</Text></Pressable>)}</View>
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
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingText: { color: COLORS.muted, fontSize: 13 },
    topBar: { minHeight: 68, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.cream, borderBottomWidth: 1, borderBottomColor: COLORS.line },
    profileButton: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    profileAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.orange, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.orangeSoft },
    profileInitial: { color: '#17171C', fontWeight: '900', fontSize: 16 },
    profileCopy: { marginLeft: 10, flex: 1 },
    profileName: { color: COLORS.ink, fontSize: 14, fontWeight: '800' },
    profileLevel: { color: COLORS.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1.05, marginTop: 3 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    headerPoints: { height: 36, minWidth: 63, borderRadius: 18, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.pale },
    headerPointsStar: { color: COLORS.yellow, fontSize: 14, marginRight: 5 },
    headerPointsText: { color: COLORS.ink, fontSize: 12, fontWeight: '900' },
    headerSearch: { height: 38, width: 38, borderRadius: 19, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center' },
    headerSearchGlyph: { color: COLORS.ink, fontSize: 24, lineHeight: 27, marginTop: -2 },
    content: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 20, maxWidth: 700, width: '100%', alignSelf: 'center' },
    homeHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 15 },
    eyebrow: { color: COLORS.orange, fontSize: 9, fontWeight: '900', letterSpacing: 1.45 },
    greetingTitle: { color: COLORS.ink, fontSize: 22, lineHeight: 27, fontWeight: '800', marginTop: 5, letterSpacing: -0.55 },
    addCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.orange, alignItems: 'center', justifyContent: 'center' },
    addCircleText: { color: '#17171C', fontSize: 26, fontWeight: '500', lineHeight: 30 },
    heroCard: { overflow: 'hidden', borderRadius: 23, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, marginBottom: 24 },
    heroPhoto: { height: 284, justifyContent: 'space-between', padding: 16, backgroundColor: '#26252A' },
    heroPhotoImage: { borderTopLeftRadius: 22, borderTopRightRadius: 22 },
    heroScrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(8,9,14,0.38)' },
    heroTopLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    heroLabel: { borderRadius: 12, backgroundColor: COLORS.orange, paddingHorizontal: 10, paddingVertical: 7 },
    heroLabelText: { color: '#18171B', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
    heroHeart: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(15,16,21,0.7)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
    heroHeartText: { color: '#FFFFFF', fontSize: 19, marginTop: 1 },
    heroPhotoContent: { marginTop: 'auto' },
    heroTitle: { color: '#FFFFFF', fontSize: 26, lineHeight: 30, fontWeight: '900', letterSpacing: -0.55, textShadowColor: '#0B0B0F', textShadowRadius: 12 },
    heroDescription: { color: '#E6E4E1', fontSize: 11, lineHeight: 16, marginTop: 6, maxWidth: 300, textShadowColor: '#0B0B0F', textShadowRadius: 8 },
    heroStats: { flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 13, flexWrap: 'wrap' },
    heroStat: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
    heroReward: { color: '#1B1B1E', fontSize: 8, fontWeight: '900', letterSpacing: 0.5, backgroundColor: COLORS.yellow, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 9, overflow: 'hidden' },
    heroFooter: { minHeight: 70, paddingHorizontal: 15, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    heroMatchLabel: { color: COLORS.orange, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
    heroMatchValue: { color: COLORS.ink, fontSize: 12, fontWeight: '700', marginTop: 4 },
    heroStart: { minHeight: 43, borderRadius: 15, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.orange },
    heroStartText: { color: '#19171A', fontSize: 11, fontWeight: '900' },
    categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    sectionTitle: { color: COLORS.ink, fontSize: 17, fontWeight: '900', letterSpacing: -0.3 },
    link: { color: COLORS.orange, fontSize: 11, fontWeight: '900' },
    categoryRail: { flexDirection: 'row', gap: 8, paddingBottom: 11, paddingRight: 10 },
    categoryChip: { borderRadius: 17, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 13, paddingVertical: 9, alignSelf: 'flex-start' },
    categoryChipActive: { backgroundColor: COLORS.orange, borderColor: COLORS.orange },
    categoryText: { color: COLORS.muted, fontSize: 10, fontWeight: '800' },
    categoryTextActive: { color: '#19171A' },
    recipeRail: { gap: 10, paddingBottom: 8 },
    recipeCard: { overflow: 'hidden', borderRadius: 20, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, marginBottom: 13 },
    recipeCardCompact: { flexDirection: 'row', alignItems: 'stretch', minHeight: 120 },
    recipeImage: { height: 176, backgroundColor: COLORS.pale, overflow: 'hidden' },
    recipeImageCompact: { width: 126, height: 'auto', minHeight: 120 },
    recipePhoto: { width: '100%', height: '100%', position: 'absolute' },
    recipeImageShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(10,11,15,0.08)' },
    recipeImageFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.pale },
    fallbackGlyph: { fontSize: 38, color: COLORS.orange },
    cardPhotoTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 10 },
    heart: { width: 29, height: 29, borderRadius: 15, backgroundColor: 'rgba(12,13,18,0.72)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
    heartGlyph: { color: '#FFFFFF', fontSize: 15 },
    recipeInfo: { flex: 1, padding: 13, justifyContent: 'center' },
    recipeTitle: { color: COLORS.ink, fontSize: 14, lineHeight: 18, fontWeight: '900' },
    recipeSub: { color: COLORS.muted, fontSize: 10, marginTop: 5 },
    recipeBottomLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 9 },
    recipeTag: { color: COLORS.yellow, fontSize: 8, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase' },
    recipeMatchText: { color: COLORS.orange, fontSize: 9, fontWeight: '800' },
    pill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5, alignSelf: 'flex-start' },
    pillText: { color: '#FFFFFF', fontSize: 7, fontWeight: '900', letterSpacing: 0.45 },
    reviewNote: { color: COLORS.yellow, marginTop: 5, fontSize: 9, fontWeight: '800' },
    assistantCard: { borderRadius: 20, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, padding: 15, marginTop: 16 },
    assistantTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    assistantOrb: { width: 38, height: 38, borderRadius: 14, backgroundColor: COLORS.orangeSoft, alignItems: 'center', justifyContent: 'center' },
    assistantOrbText: { color: COLORS.orange, fontSize: 20, fontWeight: '900' },
    assistantEyebrow: { color: COLORS.orange, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
    assistantTitle: { color: COLORS.ink, fontSize: 13, fontWeight: '900', marginTop: 3 },
    assistantSpark: { color: COLORS.yellow, fontSize: 24 },
    assistantCopy: { color: COLORS.muted, fontSize: 11, lineHeight: 17, marginTop: 13 },
    assistantAction: { marginTop: 12, borderTopWidth: 1, borderTopColor: COLORS.line, paddingTop: 12 },
    assistantActionText: { color: COLORS.orange, fontSize: 11, fontWeight: '900' },
    levelCard: { borderRadius: 20, backgroundColor: COLORS.pale, padding: 15, marginTop: 12 },
    levelTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    levelEyebrow: { color: COLORS.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
    levelTitle: { color: COLORS.ink, fontSize: 13, fontWeight: '900', marginTop: 4 },
    pointsBadge: { borderRadius: 14, backgroundColor: COLORS.yellow, paddingHorizontal: 10, paddingVertical: 7 },
    pointsBadgeText: { color: '#19171A', fontSize: 10, fontWeight: '900' },
    progressTrack: { height: 6, borderRadius: 3, backgroundColor: COLORS.line, overflow: 'hidden', marginTop: 14 },
    progressFill: { height: 6, borderRadius: 3, backgroundColor: COLORS.orange },
    levelNote: { color: COLORS.muted, fontSize: 9, marginTop: 7 },
    homeQuickActions: { flexDirection: 'row', gap: 9, marginTop: 15 },
    quickAction: { flex: 1, minHeight: 68, borderRadius: 16, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center', gap: 5 },
    quickActionIcon: { color: COLORS.orange, fontSize: 19 },
    quickActionText: { color: COLORS.ink, fontSize: 9, fontWeight: '800' },
    pageIntro: { marginTop: 10, marginBottom: 17 },
    pageTitle: { color: COLORS.ink, fontSize: 31, lineHeight: 36, fontWeight: '900', letterSpacing: -0.8, marginTop: 4 },
    pageCopy: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 6, maxWidth: 330 },
    viewSwitch: { minHeight: 44, flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 15, borderWidth: 1, borderColor: COLORS.line, padding: 4, marginBottom: 12 },
    viewSwitchButton: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
    viewSwitchActive: { backgroundColor: COLORS.pale },
    viewSwitchText: { color: COLORS.muted, fontSize: 11, fontWeight: '800' },
    viewSwitchTextActive: { color: COLORS.ink },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 9 },
    sectionHint: { color: COLORS.muted, fontSize: 10, lineHeight: 15, marginBottom: 8 },
    searchBox: { minHeight: 47, backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, marginBottom: 11 },
    searchIcon: { color: COLORS.orange, fontSize: 22, marginRight: 8 },
    searchInput: { flex: 1, paddingVertical: 0, color: COLORS.ink, fontSize: 12 },
    onlineSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    onlineSearchBox: { flex: 1, marginBottom: 0 },
    inlineActions: { flexDirection: 'row', gap: 7, flexWrap: 'wrap', marginBottom: 6 },
    filterLine: { flexDirection: 'row', gap: 7, marginVertical: 8, flexWrap: 'wrap' },
    button: { minHeight: 48, borderRadius: 15, backgroundColor: COLORS.orange, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginVertical: 4 },
    buttonSecondary: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line },
    buttonCompact: { minHeight: 39, borderRadius: 13, paddingHorizontal: 12 },
    buttonText: { color: '#19171A', fontSize: 13, fontWeight: '900' },
    buttonTextSecondary: { color: COLORS.ink },
    buttonTextCompact: { fontSize: 10 },
    searchLoading: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 16 },
    onlineResultCard: { minHeight: 110, flexDirection: 'row', overflow: 'hidden', backgroundColor: COLORS.card, borderRadius: 18, borderWidth: 1, borderColor: COLORS.line, marginBottom: 10 },
    onlineResultImage: { width: 108, minHeight: 110, backgroundColor: COLORS.pale },
    onlineImageFallback: { alignItems: 'center', justifyContent: 'center' },
    onlineResultInfo: { flex: 1, padding: 12, justifyContent: 'center' },
    attribution: { color: COLORS.muted, fontSize: 9, textAlign: 'center', marginVertical: 12 },
    emptyCard: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, borderRadius: 19, alignItems: 'center', padding: 22, marginTop: 12 },
    emptyGlyph: { color: COLORS.orange, fontSize: 32 },
    emptyTitle: { color: COLORS.ink, fontSize: 15, fontWeight: '900', marginTop: 8, textAlign: 'center' },
    emptyText: { color: COLORS.muted, fontSize: 11, lineHeight: 17, marginVertical: 7, textAlign: 'center' },
    pantryHero: { minHeight: 137, borderRadius: 21, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, padding: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    pantryCount: { color: COLORS.ink, fontSize: 38, fontWeight: '900', lineHeight: 42 },
    pantryHeroLabel: { color: COLORS.ink, fontSize: 13, fontWeight: '800', marginTop: 2 },
    pantryHeroNote: { color: COLORS.orange, fontSize: 10, fontWeight: '800', marginTop: 6 },
    pantryHeroIcon: { width: 67, height: 67, borderRadius: 24, backgroundColor: COLORS.orangeSoft, alignItems: 'center', justifyContent: 'center' },
    pantryHeroGlyph: { color: COLORS.orange, fontSize: 34 },
    pantryActions: { flexDirection: 'row', gap: 8, marginBottom: 3 },
    pantryRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 15, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 11, paddingVertical: 8, marginBottom: 8 },
    pantryItemIcon: { width: 39, height: 39, borderRadius: 13, backgroundColor: COLORS.pale, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    pantryItemGlyph: { color: COLORS.yellow, fontSize: 15, fontWeight: '900' },
    useSoonIconBox: { backgroundColor: COLORS.orangeSoft },
    ingredientName: { color: COLORS.ink, fontSize: 12, fontWeight: '900' },
    ingredientMeta: { color: COLORS.muted, fontSize: 9, marginTop: 4 },
    removeButton: { paddingHorizontal: 5, marginLeft: 4 },
    remove: { color: COLORS.muted, fontSize: 20, paddingHorizontal: 5 },
    planSummary: { borderRadius: 20, padding: 17, backgroundColor: COLORS.pale, marginBottom: 11 },
    planSummaryKicker: { color: COLORS.orange, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
    planSummaryTitle: { color: COLORS.ink, fontSize: 18, fontWeight: '900', marginTop: 5 },
    planSummaryCopy: { color: COLORS.muted, fontSize: 10, lineHeight: 16, marginTop: 5 },
    weekCard: { backgroundColor: COLORS.card, borderRadius: 19, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 12, marginBottom: 13 },
    dayRow: { minHeight: 65, flexDirection: 'row', alignItems: 'center', borderBottomColor: COLORS.line, borderBottomWidth: 1, gap: 10 },
    dayRowLast: { borderBottomWidth: 0 },
    dayBadge: { width: 39, height: 39, borderRadius: 13, backgroundColor: COLORS.pale, alignItems: 'center', justifyContent: 'center' },
    dayBadgeActive: { backgroundColor: COLORS.orange },
    dayText: { color: COLORS.muted, fontSize: 9, fontWeight: '900' },
    dayTextActive: { color: '#19171A' },
    dayMeal: { color: COLORS.ink, fontSize: 11, fontWeight: '900' },
    dayMeta: { color: COLORS.muted, fontSize: 9, marginTop: 4 },
    chevron: { color: COLORS.muted, fontSize: 22, paddingHorizontal: 5 },
    queueRow: { minHeight: 59, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 12, marginBottom: 8 },
    queueRemove: { padding: 7 },
    emptyQueue: { backgroundColor: COLORS.card, borderRadius: 15, borderWidth: 1, borderColor: COLORS.line, padding: 14, marginBottom: 12 },
    shopSummary: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 18, backgroundColor: COLORS.pale, paddingHorizontal: 13, marginBottom: 10 },
    shopSummaryIcon: { color: COLORS.orange, fontSize: 23 },
    shopSummaryTitle: { color: COLORS.ink, fontSize: 12, fontWeight: '900' },
    shopSummaryCopy: { color: COLORS.muted, fontSize: 9, lineHeight: 14, marginTop: 4 },
    shopActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
    aisleGroup: { marginBottom: 5 },
    aisleTitle: { color: COLORS.yellow, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginTop: 12, marginBottom: 7 },
    shopRow: { minHeight: 51, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 12, marginBottom: 7 },
    checkbox: { width: 20, height: 20, borderRadius: 7, borderWidth: 1.5, borderColor: COLORS.muted, marginRight: 10, alignItems: 'center', justifyContent: 'center' },
    checkboxChecked: { backgroundColor: COLORS.orange, borderColor: COLORS.orange },
    checkmark: { color: '#19171A', fontSize: 12, fontWeight: '900' },
    shopName: { color: COLORS.ink, fontSize: 11, flex: 1 },
    shopDone: { textDecorationLine: 'line-through', color: COLORS.muted },
    shopArrow: { color: COLORS.muted, fontSize: 20 },
    tabBar: { minHeight: 67, backgroundColor: COLORS.cream, borderTopWidth: 1, borderTopColor: COLORS.line, paddingHorizontal: 5, paddingTop: 7, flexDirection: 'row', justifyContent: 'space-around' },
    tabItem: { flex: 1, minHeight: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    tabItemActive: { backgroundColor: COLORS.orangeSoft },
    tabIcon: { color: COLORS.muted, fontSize: 18, lineHeight: 22 },
    tabIconActive: { color: COLORS.orange, fontWeight: '900' },
    tabLabel: { color: COLORS.muted, fontSize: 8, fontWeight: '700', marginTop: 2 },
    tabLabelActive: { color: COLORS.orange, fontWeight: '900' },
    modalBackdrop: { flex: 1, backgroundColor: '#000000C9', justifyContent: 'flex-end' },
    keyboardWrap: { justifyContent: 'flex-end', flex: 1 },
    modalSheet: { maxHeight: '92%', backgroundColor: COLORS.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 19, paddingTop: 12 },
    modalGrabber: { height: 4, width: 38, borderRadius: 3, backgroundColor: COLORS.line, alignSelf: 'center', marginBottom: 14 },
    modalClose: { position: 'absolute', top: 9, right: 16, width: 34, height: 34, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
    modalCloseText: { color: COLORS.muted, fontSize: 25, lineHeight: 29 },
    modalEyebrow: { color: COLORS.orange, fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginTop: 8 },
    modalTitle: { color: COLORS.ink, fontSize: 24, lineHeight: 29, fontWeight: '900', marginTop: 5, marginRight: 28 },
    modalCopy: { color: COLORS.muted, fontSize: 11, lineHeight: 17, marginTop: 6, marginBottom: 12 },
    input: { minHeight: 46, backgroundColor: COLORS.card, borderRadius: 13, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 13, paddingVertical: 11, color: COLORS.ink, fontSize: 12, marginBottom: 9 },
    textArea: { minHeight: 86, textAlignVertical: 'top' },
    importNote: { color: COLORS.muted, fontSize: 10, lineHeight: 15, marginBottom: 8 },
    themeOptions: { gap: 8, marginTop: 7 },
    themeOption: { minHeight: 66, backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    themeOptionSelected: { borderColor: COLORS.orange, backgroundColor: COLORS.orangeSoft },
    themeOptionCopy: { flex: 1 },
    themeOptionTitle: { color: COLORS.ink, fontSize: 13, fontWeight: '900' },
    themeOptionDescription: { color: COLORS.muted, fontSize: 10, marginTop: 4 },
    radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.muted, alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
    radioOuterSelected: { borderColor: COLORS.orange },
    radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.orange },
    previewImage: { width: '100%', height: 210, borderRadius: 18, backgroundColor: COLORS.pale, marginBottom: 12 },
    detailStats: { flexDirection: 'row', gap: 7, flexWrap: 'wrap', marginVertical: 7 },
    sourceLine: { color: COLORS.muted, fontSize: 10, marginBottom: 7 },
    reviewBox: { color: COLORS.warningText, backgroundColor: COLORS.warning, padding: 11, borderRadius: 12, fontSize: 11, lineHeight: 16, marginVertical: 7 },
    reviewBoxText: { color: COLORS.warningText, fontSize: 11, lineHeight: 16 },
    detailLine: { color: COLORS.ink, fontSize: 12, lineHeight: 20, marginBottom: 3 },
    detailStep: { color: COLORS.muted, fontSize: 12, lineHeight: 19, marginBottom: 9 },
    stepNumber: { color: COLORS.orange, fontWeight: '900' },
    modalButtonStack: { marginTop: 10 },
    cookStepCard: { minHeight: 140, justifyContent: 'center', borderRadius: 18, padding: 17, marginVertical: 12, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line },
    cookStepText: { color: COLORS.ink, fontSize: 18, lineHeight: 27, fontWeight: '800' },
    cookIngredient: { minHeight: 48, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 11, marginBottom: 7 },
    pickerRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.line },
    pickerTitle: { color: COLORS.ink, fontSize: 12, fontWeight: '800' },
  });
}
