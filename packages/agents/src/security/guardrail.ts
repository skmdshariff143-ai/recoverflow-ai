/**
 * RecoverFlow Defensive Prompt Engineering & Security Guardrail
 * Principles: Simon Willison (Dual LLM pattern & prompt injection defense) & Chip Huyen (AI Application Security)
 */

export type AttackType = 
  | 'DIRECT_INSTRUCTION_OVERRIDE'
  | 'ROLEPLAY_JAILBREAK'
  | 'UNICODE_HOMOGLYPH_OBFUSCATION'
  | 'BASE64_SMUGGLING'
  | 'MARKDOWN_IMAGE_EXFILTRATION'
  | 'SYSTEM_PROMPT_LEAK';

export interface SecurityScanResult {
  isSafe: boolean;
  attackDetected: boolean;
  attackType?: AttackType;
  riskScore: number; // 0.0 (clean) to 1.0 (malicious)
  flaggedPatterns: string[];
  normalizedInput: string;
  deterministicFallbackReply?: string;
}

export interface SecurityIncidentLog {
  id: string;
  cartToken?: string;
  merchantId?: string;
  attackType: AttackType;
  flaggedPatterns: string[];
  rawInput: string;
  normalizedInput: string;
  timestamp: number;
}

// In-memory security incidents store for auditability
export const securityIncidentsAudit: SecurityIncidentLog[] = [];

// Direct instruction override signatures
const INJECTION_PATTERNS: Array<{ pattern: RegExp; attackType: AttackType; weight: number }> = [
  { pattern: /ignore\s+(all\s+)?(previous\s+|prior\s+)?(instructions|prompts|rules|commands)/i, attackType: 'DIRECT_INSTRUCTION_OVERRIDE', weight: 0.95 },
  { pattern: /disregard\s+(all\s+)?(previous\s+|prior\s+)?(instructions|rules|system)/i, attackType: 'DIRECT_INSTRUCTION_OVERRIDE', weight: 0.95 },
  { pattern: /system\s+(override|bypass|prompt|directive)/i, attackType: 'DIRECT_INSTRUCTION_OVERRIDE', weight: 0.9 },
  { pattern: /you\s+are\s+now\s+(an?\s+)?(unrestricted|evil|unfiltered|jailbroken|admin|developer|god)/i, attackType: 'ROLEPLAY_JAILBREAK', weight: 0.95 },
  { pattern: /\b(DAN(\s+mode)?|jailbreak|unfiltered\s+mode|sudo\s+mode|drop\s+all\s+restrictions|do\s+anything\s+now)\b/i, attackType: 'ROLEPLAY_JAILBREAK', weight: 0.95 },
  { pattern: /(reveal|print|display|output|leak|repeat)\s+(the\s+)?(system\s+prompt|core\s+instructions|system\s+message|secret\s+key)/i, attackType: 'SYSTEM_PROMPT_LEAK', weight: 0.9 },
  { pattern: /repeat\s+(everything|the\s+text)\s+(above|before\s+this)/i, attackType: 'SYSTEM_PROMPT_LEAK', weight: 0.85 },
  { pattern: /act\s+as\s+(a\s+)?(linux\s+terminal|root\s+user|system\s+administrator|bash\s+shell)/i, attackType: 'ROLEPLAY_JAILBREAK', weight: 0.8 },
  { pattern: /new\s+instructions?:?\s*you\s+must/i, attackType: 'DIRECT_INSTRUCTION_OVERRIDE', weight: 0.85 },
];

/**
 * Normalizes Unicode, removes invisible/zero-width evasion characters, and translates lookalikes.
 */
export function normalizeAdversarialUnicode(input: string): { normalized: string; evasionDetected: boolean } {
  // Check for zero-width characters (\u200B zero-width space, \u200C non-joiner, \u200D joiner, \uFEFF BOM)
  const zeroWidthRegex = /[\u200B\u200C\u200D\uFEFF\u00AD]/g;
  const hasZeroWidth = zeroWidthRegex.test(input);
  let cleaned = input.replace(zeroWidthRegex, '');

  // NFKC normalization decomposes homoglyphs and compatibility characters
  cleaned = cleaned.normalize('NFKC');

  // Common Cyrillic / Greek homoglyphs mapped to ASCII equivalents
  const homoglyphs: Record<string, string> = {
    'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x',
    'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O',
    'Р': 'P', 'С': 'C', 'Т': 'T', 'Х': 'X',
  };

  let homoglyphDetected = false;
  let translated = '';
  for (const char of cleaned) {
    if (homoglyphs[char]) {
      translated += homoglyphs[char];
      homoglyphDetected = true;
    } else {
      translated += char;
    }
  }

  return {
    normalized: translated,
    evasionDetected: hasZeroWidth || homoglyphDetected,
  };
}

/**
 * Detects hidden / smuggled base64 payloads within inputs.
 */
export function detectBase64Smuggling(input: string): { smuggled: boolean; decodedPayload?: string } {
  // Look for potential base64 strings (>= 16 chars of base64 chars with optional padding)
  const b64Regex = /(?:[A-Za-z0-9+/]{4}){4,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?/g;
  const matches = input.match(b64Regex) || [];

  for (const match of matches) {
    if (match.length < 16) continue;
    try {
      const decoded = Buffer.from(match, 'base64').toString('utf-8');
      // If the decoded content looks like English ASCII text containing injection keywords
      if (/^[ -~\t\r\n]+$/.test(decoded)) {
        const decodedLower = decoded.toLowerCase();
        for (const { pattern } of INJECTION_PATTERNS) {
          if (pattern.test(decodedLower)) {
            return { smuggled: true, decodedPayload: decoded };
          }
        }
      }
    } catch {
      // Not valid base64 or failed decoding
    }
  }

  return { smuggled: false };
}

/**
 * Detects markdown image or hyperlink data exfiltration patterns:
 * e.g., ![img](https://attacker.com/leak?q=...)
 */
export function detectMarkdownExfiltration(input: string): boolean {
  // Markdown image syntax: ![alt](url)
  const imageMarkdownRegex = /!\[.*?\]\((https?:\/\/[^\s)]+)\)/i;
  // Markdown links to external suspicious query parameter schemes
  const exfilLinkRegex = /\[.*?\]\(https?:\/\/[^\s)]+[?&](data|leak|token|secret|cart)=/i;
  
  return imageMarkdownRegex.test(input) || exfilLinkRegex.test(input);
}

/**
 * Comprehensive Pre-LLM Security Guardrail Scanner.
 * Evaluates inputs BEFORE they ever reach the Gemini API or LLM context window.
 */
export function scanPromptSecurity(
  input: string,
  context?: { cartToken?: string; merchantId?: string }
): SecurityScanResult {
  if (!input || typeof input !== 'string') {
    return {
      isSafe: true,
      attackDetected: false,
      riskScore: 0.0,
      flaggedPatterns: [],
      normalizedInput: '',
    };
  }

  const flaggedPatterns: string[] = [];
  let maxRiskScore = 0.0;
  let detectedAttackType: AttackType | undefined;

  // 1. Unicode Normalization and Obfuscation Detection
  const { normalized, evasionDetected } = normalizeAdversarialUnicode(input);
  if (evasionDetected) {
    flaggedPatterns.push('UNICODE_HOMOGLYPH_OR_ZERO_WIDTH_EVASION');
    maxRiskScore = Math.max(maxRiskScore, 0.7);
    detectedAttackType = 'UNICODE_HOMOGLYPH_OBFUSCATION';
  }

  // 2. Base64 Smuggling Detection
  const b64Result = detectBase64Smuggling(input);
  if (b64Result.smuggled) {
    flaggedPatterns.push(`BASE64_SMUGGLED_PAYLOAD: ${b64Result.decodedPayload?.slice(0, 50)}...`);
    maxRiskScore = 1.0;
    detectedAttackType = 'BASE64_SMUGGLING';
  }

  // 3. Markdown Exfiltration Detection
  if (detectMarkdownExfiltration(input)) {
    flaggedPatterns.push('MARKDOWN_IMAGE_DATA_EXFILTRATION');
    maxRiskScore = 1.0;
    detectedAttackType = 'MARKDOWN_IMAGE_EXFILTRATION';
  }

  // 4. Heuristic and Token Classification on Normalized Input
  const targetText = normalized.toLowerCase();
  for (const { pattern, attackType, weight } of INJECTION_PATTERNS) {
    if (pattern.test(targetText)) {
      flaggedPatterns.push(pattern.toString());
      if (weight > maxRiskScore) {
        maxRiskScore = weight;
        detectedAttackType = attackType;
      }
    }
  }

  const isAttack = maxRiskScore >= 0.75;

  // If attack is detected, log incident and provide deterministic neutral fallback
  if (isAttack && detectedAttackType) {
    const incident: SecurityIncidentLog = {
      id: `sec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      cartToken: context?.cartToken,
      merchantId: context?.merchantId,
      attackType: detectedAttackType,
      flaggedPatterns,
      rawInput: input,
      normalizedInput: normalized,
      timestamp: Date.now(),
    };
    securityIncidentsAudit.unshift(incident);
    if (securityIncidentsAudit.length > 500) securityIncidentsAudit.pop();

    return {
      isSafe: false,
      attackDetected: true,
      attackType: detectedAttackType,
      riskScore: maxRiskScore,
      flaggedPatterns,
      normalizedInput: normalized,
      deterministicFallbackReply: 
        "Thank you for contacting customer support. We are happy to assist you with order status, sizing inquiries, and checkout. Please let us know if you have questions about your cart.",
    };
  }

  return {
    isSafe: true,
    attackDetected: false,
    riskScore: maxRiskScore,
    flaggedPatterns,
    normalizedInput: normalized,
  };
}
