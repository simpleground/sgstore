const clean = (value: string) => value.trim().replace(/\s+/g, ' ');
const key = (value: string) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const categoryAliases: Record<string, string> = {
  'chef kitchen wear': 'Chef & Kitchen Wear',
  'chef and kitchen wear': 'Chef & Kitchen Wear',
  'daily basic': 'Daily Basic',
  'professional workwear': 'Professional Workwear',
  'proffesional workwear': 'Professional Workwear',
  'profesional workwear': 'Professional Workwear',
};

const subcategoryAliases: Record<string, string> = {
  kaos: 'Kaos',
  celana: 'Celana',
  kemeja: 'Kemeja',
  'baju chef': 'Baju Chef',
  'topi chef': 'Topi Chef',
  'celana koki': 'Celana Koki',
  'seragam kerja': 'Seragam Kerja',
  'pakaian tradisional': 'Pakaian Tradisional',
};

export const normalizeCategory = (value: string) => categoryAliases[key(value)] || clean(value);
export const normalizeSubcategory = (value: string) => subcategoryAliases[key(value)] || clean(value).replace(/\b\w/g, (letter) => letter.toUpperCase());

const colorWords = new Set([
  'hitam', 'putih', 'maroon', 'navy', 'biru', 'merah', 'hijau', 'kuning',
  'cokelat', 'coklat', 'kopi', 'abu', 'grey', 'gray', 'cream', 'krem',
]);
const typoWords: Record<string, string> = { kemaja: 'kemeja', tshirt: 'kaos' };
const normalizedWords = (value: string) => key(value)
  .split(' ')
  .map((word) => typoWords[word] || word)
  .filter((word) => word && !colorWords.has(word));

export function productIdentity(value: string) {
  const parts = value.split('|').map(clean).filter(Boolean);
  const first = parts[0] || value;
  const hasCode = /^[a-z0-9-]{2,12}$/i.test(first) && /[a-z]/i.test(first) && /\d/.test(first);
  const code = hasCode ? first.toUpperCase() : '';
  const title = (hasCode ? parts.slice(1) : parts).join(' ') || value;
  const words = normalizedWords(title);
  while (words.length && /^\d+$/.test(words[words.length - 1])) words.pop();
  const base = words.join(' ');
  return code ? `code:${code}|${base}` : `name:${base}`;
}
