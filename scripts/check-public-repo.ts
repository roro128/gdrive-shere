import { execFileSync } from 'node:child_process';
import {
  findBlockedPaths,
  PLACEHOLDER_VALUE_PATTERN,
  SECRET_PATTERNS,
  splitGitLines,
  type SecretPattern
} from './public-repo-security-model';

type GitFailure = {
  status?: number | null;
};

type SecurityScan = {
  trackedPaths: string[];
  blockedPaths: string[];
  contentFindings: string[];
};

function gitFailureStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('status' in error)) return null;
  return (error as GitFailure).status ?? null;
}

function runGit(args: readonly string[]): string {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch (error) {
    if (gitFailureStatus(error) === 1) return '';
    throw new Error('Git 보안 검사를 완료하지 못했습니다.', { cause: error });
  }
}

function grepPaths(pattern: SecretPattern, cached: boolean): string[] {
  const args = [
    'grep',
    ...(cached ? ['--cached'] : []),
    ...(pattern.ignoreCase ? ['-i'] : []),
    '-I',
    '-n',
    '-E',
    '-e',
    pattern.expression,
    '--'
  ];
  return splitGitLines(runGit(args))
    .filter((line) => !PLACEHOLDER_VALUE_PATTERN.test(line))
    .map((line) => {
      const separator = line.indexOf(':');
      return separator === -1 ? line : line.slice(0, separator);
    });
}

function scanRepository(): SecurityScan {
  const trackedPaths = splitGitLines(runGit(['ls-files']));
  const blockedPaths = findBlockedPaths(trackedPaths);
  const contentFindings = SECRET_PATTERNS.flatMap((pattern) => {
    const matchedPaths = new Set([...grepPaths(pattern, true), ...grepPaths(pattern, false)]);
    return [...matchedPaths].map((path) => `${pattern.name}: ${path}`);
  });
  return { trackedPaths, blockedPaths, contentFindings };
}

export function main(): number {
  let scan: SecurityScan;
  try {
    scan = scanRepository();
  } catch {
    console.error('\n❌ Security Leakage Gate FAILED: Git 검사에 실패했습니다.');
    return 2;
  }

  if (scan.blockedPaths.length > 0 || scan.contentFindings.length > 0) {
    console.error('\n❌ Security Leakage Gate FAILED:');
    if (scan.blockedPaths.length > 0) {
      console.error('\n[Blocked Tracked Files]:');
      for (const path of scan.blockedPaths) console.error(` - ${path}`);
    }
    if (scan.contentFindings.length > 0) {
      console.error('\n[Detected Secrets / Keys in Files]:');
      for (const finding of scan.contentFindings) console.error(` - ${finding}`);
    }
    return 1;
  }

  console.log(
    `\n✅ Security Leakage Gate PASSED: ${scan.trackedPaths.length} tracked files inspected cleanly.`
  );
  return 0;
}

process.exitCode = main();
