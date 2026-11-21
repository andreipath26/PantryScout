import ImageLabeling from '@react-native-ml-kit/image-labeling';
import TextRecognition from '@react-native-ml-kit/text-recognition';

export type IntakeSource = 'barcode' | 'fridge_photo' | 'receipt' | 'manual';
export type IntakeCandidate = {
  id: string;
  name: string;
  quantity: string;
  source: IntakeSource;
  confidence?: number;
  barcode?: string;
  selected: boolean;
};

const FOOD_LABELS: Record<string, string> = {
  apple: 'Apple', apples: 'Apple', banana: 'Banana', bananas: 'Banana', orange: 'Orange', oranges: 'Orange',
  lemon: 'Lemon', lemons: 'Lemon', tomato: 'Tomato', tomatoes: 'Tomato', potato: 'Potato', potatoes: 'Potato',
  onion: 'Onion', onions: 'Onion', carrot: 'Carrot', carrots: 'Carrot', cucumber: 'Cucumber', cucumbers: 'Cucumber',
  broccoli: 'Broccoli', lettuce: 'Lettuce', spinach: 'Spinach', avocado: 'Avocado', avocadoes: 'Avocado',
  strawberry: 'Strawberry', strawberries: 'Strawberry', grapes: 'Grapes', pear: 'Pear', pears: 'Pear',
  egg: 'Eggs', eggs: 'Eggs', milk: 'Milk', cheese: 'Cheese', bread: 'Bread', mushroom: 'Mushrooms', mushrooms: 'Mushrooms',
  chicken: 'Chicken', fish: 'Fish', pepper: 'Bell pepper', bell_pepper: 'Bell pepper', zucchini: 'Courgette',
  corn: 'Corn', pineapple: 'Pineapple', watermelon: 'Watermelon', rice: 'Rice', pasta: 'Pasta', garlic: 'Garlic',
};

function candidateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function recognizeFridgePhoto(uri: string): Promise<IntakeCandidate[]> {
  const labels = await ImageLabeling.label(uri);
  const results: IntakeCandidate[] = [];
  const seen = new Set<string>();
  for (const label of labels) {
    const key = label.text.toLowerCase().replace(/[^a-z_ ]/g, '').trim().replace(/ /g, '_');
    const name = FOOD_LABELS[key] || FOOD_LABELS[key.replace(/_/g, ' ')];
    if (!name || label.confidence < 0.35 || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    results.push({ id: candidateId(), name, quantity: '1', source: 'fridge_photo', confidence: label.confidence, selected: true });
  }
  return results.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
}

export async function lookupBarcode(barcode: string): Promise<{ name: string; quantity: string } | null> {
  const response = await fetch(`https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(barcode)}.json?fields=product_name,product_name_en,brands,quantity`, {
    headers: { 'User-Agent': 'PantryScout/0.1 (pantry inventory app)' },
  });
  if (!response.ok) throw new Error('Product lookup is unavailable right now. You can enter the item manually.');
  const body = await response.json();
  const product = body?.status === 1 ? body.product : null;
  const productName = [product?.product_name, product?.product_name_en].find((value) => typeof value === 'string' && value.trim());
  if (!productName) return null;
  const brand = typeof product.brands === 'string' ? product.brands.split(',')[0].trim() : '';
  const quantity = typeof product.quantity === 'string' && product.quantity.trim() ? product.quantity.trim() : '1';
  return { name: brand && !productName.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${productName}` : productName.trim(), quantity };
}

const NON_FOOD_LINES = /^(total|sous[- ]total|subtotal|tva|vat|cb|carte|cash|esp[eè]ces|rendu|monnaie|merci|ticket|caisse|date|heure|fid[eè]lit[eé]|remise|discount|promo|montant|net [àa] payer|à payer|a payer)\b/i;
const PRICE = /(?:[-+]\s*)?\d{1,4}[,.]\d{2}\s*(?:€|eur)?\s*$/i;

export function parseReceiptText(text: string): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();
  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine.replace(/[|\u00a0]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!line || line.length < 3 || NON_FOOD_LINES.test(line)) continue;
    const hasPrice = PRICE.test(line) || /\d{1,4}[,.]\d{2}\s+\d{1,4}[,.]\d{2}/.test(line);
    if (!hasPrice) continue;
    line = line.replace(PRICE, '').trim();
    line = line.replace(/\s+\d{1,4}[,.]\d{2}\s*$/, '').trim();
    line = line.replace(/^\d{5,}\s+/, '').replace(/^\d+[,.]?\d*\s*[x×]\s*/i, '').replace(/\s+/g, ' ').trim();
    if (line.length < 3 || NON_FOOD_LINES.test(line)) continue;
    const key = line.toLowerCase().replace(/[^a-z0-9à-ÿ]/gi, '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    candidates.push(line[0].toUpperCase() + line.slice(1));
  }
  return candidates;
}

export async function recognizeReceipt(uri: string): Promise<{ items: string[]; text: string }> {
  const result = await TextRecognition.recognize(uri);
  const text = result.text || '';
  return { items: parseReceiptText(text), text };
}

export function makeCandidate(name: string, source: IntakeSource, options: Partial<IntakeCandidate> = {}): IntakeCandidate {
  return { id: candidateId(), name, quantity: options.quantity || '1', source, selected: true, ...options };
}
