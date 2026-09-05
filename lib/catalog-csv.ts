// Split records without breaking line breaks inside quoted cells.
export function csvRecords(text: string): string[] {
  const records: string[] = [];
  let record = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      record += c;
      if (quoted && text[i + 1] === '"') { record += text[++i]; continue; }
      quoted = !quoted;
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (record.trim()) records.push(record);
      record = '';
      if (c === '\r' && text[i + 1] === '\n') i++;
    } else record += c;
  }
  if (quoted) throw new Error('Tanda kutip CSV belum ditutup. Periksa file sebelum mengimpor.');
  if (record.trim()) records.push(record);
  return records;
}
