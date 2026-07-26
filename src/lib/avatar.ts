const PALETTE = ['#e8aa70', '#7fc8c5', '#b995d6', '#e48c8c', '#a8c77d', '#e8d27a'];

/** Creates a small, local identicon from an already-hashed stable user seed. */
export function identiconFromHash(hash: string): string {
  const source = hash || 'default';
  const color = PALETTE[charValue(source, 0) % PALETTE.length];
  const background = PALETTE[charValue(source, 3) % PALETTE.length];
  const cells: string[] = [];
  let cursor = 6;

  for (let row = 0; row < 5; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      const active = charValue(source, cursor) % 2 === 0;
      cursor += 1;
      if (!active) continue;
      cells.push(`<rect x="${column * 20 + 10}" y="${row * 20 + 10}" width="20" height="20"/>`);
      if (column < 2)
        cells.push(
          `<rect x="${(4 - column) * 20 + 10}" y="${row * 20 + 10}" width="20" height="20"/>`
        );
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="24" fill="${background}"/><g fill="${color}">${cells.join('')}</g></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function charValue(value: string, index: number): number {
  return value.charCodeAt(index % value.length) || 0;
}
