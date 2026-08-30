import policyJson from "@/content/text-policy.json";

interface PolicyGroup {
  id: string;
  scopes: Array<"content" | "html">;
  prefixes: string[];
  phrases: string[];
}

export interface TextPolicyCase {
  text: string;
  content_blocked: boolean;
  html_blocked: boolean;
}

interface TextPolicyData {
  style_patterns: string[];
  blocked: PolicyGroup[];
  cases: TextPolicyCase[];
}

export interface TextPolicyMatch {
  category: string;
  rule: string;
  matched: string;
}

const policy = policyJson as TextPolicyData;
const WORD = "а-яёa-z0-9";
const LETTERS = "а-яёa-z";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

if (!Array.isArray(policy.blocked) || !Array.isArray(policy.cases)) {
  throw new Error("text-policy.json: некорректная структура");
}

const rules = policy.blocked.filter((group) => group.scopes?.includes("content")).flatMap((group) => {
  if (!group.id || !Array.isArray(group.prefixes) || !Array.isArray(group.phrases)
    || group.prefixes.length + group.phrases.length === 0) {
    throw new Error(`text-policy.json: неполная группа ${group.id || "без id"}`);
  }
  return [
    ...group.prefixes.map((prefix) => ({
      category: group.id,
      rule: prefix,
      pattern: new RegExp(`(^|[^${WORD}])${escapeRegExp(prefix)}[${LETTERS}]*`, "iu"),
    })),
    ...group.phrases.map((phrase) => ({
      category: group.id,
      rule: phrase,
      pattern: new RegExp(escapeRegExp(phrase), "iu"),
    })),
  ];
});

export const TEXT_POLICY_CASES: TextPolicyCase[] = policy.cases;

export function blockedTextMatch(text: string): TextPolicyMatch | null {
  for (const rule of rules) {
    const found = rule.pattern.exec(text);
    if (found) {
      return { category: rule.category, rule: rule.rule, matched: found[0].trim() };
    }
  }
  return null;
}

export function isBlockedText(text: string): boolean {
  return blockedTextMatch(text) !== null;
}
