export type SecretPattern = {
  name: string;
  expression: string;
  ignoreCase?: boolean;
};

const BLOCKED_PATH_PATTERN =
  /(^|[\\/])(?:\.env(?:\..*)?|\.dev\.vars(?:\..*)?|.*\.tfstate(?:\..*)?|.*\.tfvars|.*\.(?:pem|key|p12|pfx|jks|keystore)|(?:credentials|service-account).*\.json|\.codex-.*|.*\.log)$/i;
const ALLOWED_EXAMPLE_PATTERN = /(^|[\\/])(?:\.env\.example|.*\.tfvars\.example)$/i;
export const PLACEHOLDER_VALUE_PATTERN =
  /["'](?:your|example|dummy|placeholder|change[-_ ]?me|replace[-_ ]?me)(?:[-_ A-Za-z0-9]*)["']/i;

export const SECRET_PATTERNS: readonly SecretPattern[] = [
  { name: 'privateKey', expression: 'BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY' },
  { name: 'googleApiKey', expression: 'AIza[0-9A-Za-z_-]{20,}' },
  { name: 'googleOAuthSecret', expression: 'GOCSPX-[0-9A-Za-z_-]{20,}' },
  { name: 'githubToken', expression: 'gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}' },
  { name: 'openAiKey', expression: 'sk-[A-Za-z0-9_-]{20,}' },
  { name: 'slackToken', expression: 'xox[baprs]-[A-Za-z0-9-]{10,}' },
  {
    name: 'jwt',
    expression: 'eyJ[A-Za-z0-9_-]{20,}\\.[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}'
  },
  {
    name: 'cloudflareToken',
    expression:
      '(cloudflare|cf)_(api_token|api_key|auth_key)[[:space:]]*[:=][[:space:]]*["\'][A-Za-z0-9_-]{20,}["\']',
    ignoreCase: true
  }
];

export function splitGitLines(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function findBlockedPaths(paths: readonly string[]): string[] {
  return paths.filter(
    (path) => BLOCKED_PATH_PATTERN.test(path) && !ALLOWED_EXAMPLE_PATTERN.test(path)
  );
}
