export function splitSentences(text) {
  if (!text || typeof text !== 'string') return [];
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const blocks = normalized.split(/\n{2,}/);
  const out = [];
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/(?<=[.!?])\s+(?=[A-Z0-9"'(\[])/);
    for (const part of parts) {
      const s = part.trim();
      if (s) out.push(s);
    }
  }
  return out;
}
