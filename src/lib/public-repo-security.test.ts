import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  findBlockedPaths,
  PLACEHOLDER_VALUE_PATTERN,
  SECRET_PATTERNS,
  splitGitLines
} from '../../scripts/public-repo-security-model';

describe('public repository security gate', () => {
  it('keeps blocked paths out while allowing documented examples', () => {
    expect(
      findBlockedPaths(['.env', '.env.example', 'terraform/prod.tfstate', 'config.tfvars.example'])
    ).toEqual(['.env', 'terraform/prod.tfstate']);
  });

  it('uses a Git ERE-compatible case-insensitive Cloudflare token pattern', () => {
    const pattern = SECRET_PATTERNS.find(({ name }) => name === 'cloudflareToken');
    expect(pattern).toMatchObject({ ignoreCase: true });
    expect(pattern?.expression).not.toContain('(?i)');
    expect(pattern?.expression).toContain('[[:space:]]');
    expect(PLACEHOLDER_VALUE_PATTERN.test('"your-cloudflare-api-token"')).toBe(true);
  });

  it('runs the real repository gate without hiding Git failures', () => {
    const scriptPath = fileURLToPath(
      new URL('../../scripts/check-public-repo.ts', import.meta.url)
    );
    const output = execFileSync('bun', [scriptPath], {
      cwd: process.cwd(),
      encoding: 'utf8'
    });
    expect(splitGitLines(output)).toContainEqual(
      expect.stringContaining('Security Leakage Gate PASSED')
    );
  });
});
