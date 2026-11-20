export type OnlineMeal = {
  id: string;
  title: string;
  imageUrl: string;
  ingredients: string[];
  steps: string[];
  category?: string;
  cuisine?: string;
  sourceUrl: string;
  videoUrl?: string;
};

type MealDbItem = Record<string, unknown>;
const API_ROOT = 'https://www.themealdb.com/api/json/v1/1';

async function requestJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Recipe search returned ${response.status}. Try again in a moment.`);
    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('Recipe search took too long. Check your connection and retry.');
    if (error instanceof Error && error.message.startsWith('Recipe search')) throw error;
    throw new Error('Could not reach online recipes. Check your internet connection and try again.');
  } finally {
    clearTimeout(timeout);
  }
}

function asMeals(value: unknown): MealDbItem[] {
  if (!value || typeof value !== 'object' || !('meals' in value)) return [];
  const meals = (value as { meals?: unknown }).meals;
  return Array.isArray(meals) ? meals.filter((meal): meal is MealDbItem => Boolean(meal) && typeof meal === 'object') : [];
}

function toOnlineMeal(item: MealDbItem): OnlineMeal | null {
  const id = typeof item.idMeal === 'string' ? item.idMeal : '';
  const title = typeof item.strMeal === 'string' ? item.strMeal.trim() : '';
  if (!id || !title) return null;
  const ingredients: string[] = [];
  for (let index = 1; index <= 20; index += 1) {
    const ingredient = typeof item[`strIngredient${index}`] === 'string' ? String(item[`strIngredient${index}`]).trim() : '';
    const measure = typeof item[`strMeasure${index}`] === 'string' ? String(item[`strMeasure${index}`]).trim() : '';
    if (ingredient) ingredients.push([measure, ingredient].filter(Boolean).join(' '));
  }
  const instructions = typeof item.strInstructions === 'string' ? item.strInstructions : '';
  const steps = instructions.split(/\r?\n|(?<=[.!?])\s+(?=[A-Z])/).map((step) => step.replace(/<[^>]+>/g, '').trim()).filter(Boolean);
  const sourceUrl = typeof item.strSource === 'string' && item.strSource.startsWith('http')
    ? item.strSource
    : `https://www.themealdb.com/meal/${encodeURIComponent(id)}`;
  return {
    id,
    title,
    imageUrl: typeof item.strMealThumb === 'string' ? item.strMealThumb : '',
    ingredients,
    steps,
    category: typeof item.strCategory === 'string' ? item.strCategory : undefined,
    cuisine: typeof item.strArea === 'string' ? item.strArea : undefined,
    sourceUrl,
    videoUrl: typeof item.strYoutube === 'string' && item.strYoutube.startsWith('http') ? item.strYoutube : undefined,
  };
}

export async function searchOnlineMeals(query: string, byIngredient = false): Promise<OnlineMeal[]> {
  const term = query.trim();
  if (!term) return [];
  const endpoint = byIngredient ? 'filter.php?i=' : 'search.php?s=';
  const value = byIngredient ? term.replace(/\s+/g, '_') : term;
  const payload = await requestJson(`${API_ROOT}/${endpoint}${encodeURIComponent(value)}`);
  const meals = asMeals(payload);
  if (!byIngredient) return meals.map(toOnlineMeal).filter((meal): meal is OnlineMeal => Boolean(meal));

  const details = await Promise.all(meals.slice(0, 8).map(async (meal) => {
    const id = typeof meal.idMeal === 'string' ? meal.idMeal : '';
    if (!id) return null;
    try {
      const result = await requestJson(`${API_ROOT}/lookup.php?i=${encodeURIComponent(id)}`);
      return asMeals(result).map(toOnlineMeal).find((item): item is OnlineMeal => Boolean(item)) || null;
    } catch {
      return null;
    }
  }));
  return details.filter((meal): meal is OnlineMeal => Boolean(meal));
}
