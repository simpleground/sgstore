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
  .filter((word) => word && !colorWords.has(word))
  .map((word) => /^\d+$/.test(word) ? String(Number(word)) : word);

export const normalizedProductName = (value: string) => normalizedWords(value).join(' ');

export function productIdentity(value: string) {
  const parts = value.split('|').map(clean).filter(Boolean);
  const first = parts[0] || value;
  const hasCode = /^[a-z0-9-]{2,12}$/i.test(first) && /[a-z]/i.test(first) && /\d/.test(first);
  const code = hasCode ? first.toUpperCase() : '';
  const title = (hasCode ? parts.slice(1) : parts).join(' ') || value;
  const words = normalizedWords(title);
  const base = words.join(' ');
  return code ? `code:${code}|${base}` : `name:${base}`;
}

const editDistance = (left: string, right: string) => {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row++) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= right.length; column++) {
      const above = previous[column];
      previous[column] = Math.min(
        previous[column] + 1,
        previous[column - 1] + 1,
        diagonal + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[right.length];
};

export function productNameSimilarity(left: string, right: string) {
  const a = normalizedProductName(left);
  const b = normalizedProductName(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const leftNumbers = a.match(/\b\d+\b/g) || [];
  const rightNumbers = b.match(/\b\d+\b/g) || [];
  if (leftNumbers.join('|') !== rightNumbers.join('|')) return 0;
  return 1 - editDistance(a, b) / Math.max(a.length, b.length);
}
