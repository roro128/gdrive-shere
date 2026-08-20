import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/app.css'), 'utf8');
const tokens = JSON.parse(
  readFileSync(resolve(process.cwd(), 'docs/design-tokens.json'), 'utf8')
) as { color: Record<string, string> };

describe('design tokens', () => {
  it('keeps the documented light palette in the CSS source', () => {
    expect(css.match(/:root\s*\{/g)).toHaveLength(1);

    for (const [name, value] of Object.entries(tokens.color)) {
      const cssName = name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      expect(css.toLowerCase()).toContain(`--${cssName}: ${value.toLowerCase()}`);
    }
  });
});
