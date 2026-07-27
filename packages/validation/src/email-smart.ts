const ALLOWED_TLDS = [
  'co.uk',
  'nl',
  'com',
  'eu',
  'net',
  'org',
  'be',
  'de',
  'io',
  'info',
  'biz',
] as const;

const LOCAL_PART_RE = /^[^\s@]+@[^\s@]+$/;

function extractDomain(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at <= 0 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase();
}

function hasAllowedTld(domain: string): boolean {
  return ALLOWED_TLDS.some((tld) => domain === tld || domain.endsWith(`.${tld}`));
}

/** Validates a business e-mail with a known TLD allowlist. */
export function isValidBusinessEmail(raw: string): boolean {
  const email = raw.trim();
  if (!LOCAL_PART_RE.test(email)) return false;
  const domain = extractDomain(email);
  if (!domain || domain.includes(' ')) return false;
  if (!domain.includes('.')) return false;
  return hasAllowedTld(domain);
}

/** Suggest likely fixes for incomplete or mistyped e-mail input. */
export function suggestEmailFixes(raw: string): string[] {
  const trimmed = raw.trim().replace(/\s+/g, '');
  if (!trimmed.includes('@')) return [];

  const at = trimmed.lastIndexOf('@');
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);

  if (!local || !domain) return [];

  if (!domain.includes('.')) {
    return ALLOWED_TLDS.filter((tld) => tld !== 'co.uk')
      .slice(0, 2)
      .map((tld) => `${local}@${domain}.${tld}`);
  }

  const suggestions: string[] = [];
  if (trimmed !== raw.trim()) {
    suggestions.push(trimmed);
  }

  const commonTypos: Record<string, string> = {
    'gmial.com': 'gmail.com',
    'gmal.com': 'gmail.com',
    'hotmial.com': 'hotmail.com',
    'outlok.com': 'outlook.com',
  };

  for (const [typo, fix] of Object.entries(commonTypos)) {
    if (domain === typo) {
      suggestions.push(`${local}@${fix}`);
    } else if (domain.endsWith(`.${typo}`)) {
      const prefix = domain.slice(0, domain.length - typo.length);
      suggestions.push(`${local}@${prefix}${fix}`);
    }
  }

  return [...new Set(suggestions)].filter((s) => s !== raw.trim());
}
