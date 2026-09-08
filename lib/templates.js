export function templateParagraphs(text) {
  const raw = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!raw) return [];
  const blocks = raw.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  if (blocks.length > 1) return blocks;
  return raw.split('\n').map((line) => line.trimEnd());
}
