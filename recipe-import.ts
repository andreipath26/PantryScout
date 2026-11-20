export type ImportedRecipeData = {
  title: string;
  description: string;
  ingredients: string[];
  steps: string[];
  minutes: number;
  servings: number;
  image?: string;
};

function text(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function values(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry === 'string') return [text(entry)].filter(Boolean);
    if (!entry || typeof entry !== 'object') return [];
    const object = entry as Record<string, unknown>;
    if (Array.isArray(object.itemListElement)) return values(object.itemListElement);
    return [text(object.text ?? object.name)].filter(Boolean);
  });
}

function findRecipes(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(findRecipes);
  if (!value || typeof value !== 'object') return [];
  const object = value as Record<string, unknown>;
  const type = object['@type'];
  const isRecipe = type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'));
  return [...(isRecipe ? [object] : []), ...Object.values(object).flatMap(findRecipes)];
}

function durationMinutes(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const match = value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  if (!match) return undefined;
  const total = Number(match[1] || 0) * 1440 + Number(match[2] || 0) * 60 + Number(match[3] || 0) + Math.round(Number(match[4] || 0) / 60);
  return total || undefined;
}

function imageUrl(value: unknown): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate === 'string') return candidate;
  if (candidate && typeof candidate === 'object') {
    const object = candidate as Record<string, unknown>;
    if (typeof object.url === 'string') return object.url;
    if (typeof object.contentUrl === 'string') return object.contentUrl;
  }
  return undefined;
}

export function parseRecipePage(html: string): ImportedRecipeData | null {
  const scripts = html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script\s*>/gi) || [];
  const recipes = scripts.flatMap((script) => {
    const body = script.replace(/^<[\s\S]*?>/, '').replace(/<\/script\s*>$/i, '').trim();
    try { return findRecipes(JSON.parse(body)); } catch { return []; }
  });
  const recipe = recipes.find((item) => typeof item.name === 'string' && Array.isArray(item.recipeIngredient));
  if (!recipe) return null;
  const rawInstructions = Array.isArray(recipe.recipeInstructions) ? recipe.recipeInstructions : [recipe.recipeInstructions];
  const steps = rawInstructions.flatMap((entry) => {
    if (typeof entry === 'string') return [text(entry)].filter(Boolean);
    if (!entry || typeof entry !== 'object') return [];
    const object = entry as Record<string, unknown>;
    if (Array.isArray(object.itemListElement)) return values(object.itemListElement);
    return [text(object.text ?? object.name)].filter(Boolean);
  });
  const yieldText = Array.isArray(recipe.recipeYield) ? recipe.recipeYield[0] : recipe.recipeYield;
  const servingMatch = typeof yieldText === 'string' ? yieldText.match(/\d+/) : null;
  const minutes = (durationMinutes(recipe.prepTime) || 0) + (durationMinutes(recipe.cookTime) || 0);
  return {
    title: text(recipe.name) || 'Imported recipe',
    description: text(recipe.description) || 'Imported from a recipe page. Check ingredients and method before cooking.',
    ingredients: values(recipe.recipeIngredient),
    steps,
    minutes: minutes || 30,
    servings: servingMatch ? Math.max(1, Number(servingMatch[0])) : 2,
    image: imageUrl(recipe.image),
  };
}

export async function fetchRecipePage(url: string): Promise<ImportedRecipeData | null> {
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error('Enter a complete recipe URL, including https://.'); }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('Recipe links must use http or https.');
  const response = await fetch(parsed.toString(), { headers: { Accept: 'text/html,application/xhtml+xml' } });
  if (!response.ok) throw new Error(`That page could not be opened (HTTP ${response.status}). You can still save its link and paste the recipe text.`);
  const html = await response.text();
  return parseRecipePage(html);
}
