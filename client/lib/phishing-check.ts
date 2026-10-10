export type PhishingCheckMode = "url" | "message";
export type PhishingRiskLevel = "likelySafe" | "suspicious" | "highRisk";

export type PhishingIndicator = {
  key: string;
  weight: number;
  explanationKey: string;
  recommendationKey: string;
};

export type PhishingCheckResult = {
  level: PhishingRiskLevel;
  ruleScore: number;
  indicators: PhishingIndicator[];
  summaryKey: string;
  defaultRecommendationKey: string;
};

const shortenerHosts = new Set([
  "bit.ly", "t.co", "tinyurl.com", "goo.gl", "is.gd", "ow.ly", "buff.ly", "cutt.ly", "shorturl.at", "rebrand.ly",
]);

const knownBrandDomains: Record<string, string[]> = {
  sbi: ["sbi.co.in", "onlinesbi.sbi"],
  hdfc: ["hdfcbank.com"],
  icici: ["icicibank.com"],
  axis: ["axisbank.com"],
  paytm: ["paytm.com"],
  phonepe: ["phonepe.com"],
};

function isIpAddress(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (host.includes(":")) return /^[0-9a-f:]+$/i.test(host);
  const parts = host.split(".");
  return parts.length === 4 && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

function addIndicator(indicators: PhishingIndicator[], key: string, weight: number) {
  if (!indicators.some(indicator => indicator.key === key)) {
    indicators.push({ key, weight, explanationKey: `${key}Why`, recommendationKey: `${key}Next` });
  }
}

function detectBrandLookalike(hostname: string) {
  for (const [brand, domains] of Object.entries(knownBrandDomains)) {
    if (hostname.includes(brand) && !domains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`))) return true;
  }
  return false;
}

function checkUrl(input: string): PhishingCheckResult {
  const indicators: PhishingIndicator[] = [];
  const text = input.trim();
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(text) ? text : `https://${text}`;
  let parsed: URL;

  try {
    parsed = new URL(candidate);
  } catch {
    addIndicator(indicators, "urlInvalid", 25);
    return makeResult(indicators);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    addIndicator(indicators, "urlInvalid", 35);
  }
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  const hostWithoutWww = hostname.replace(/^www\./, "");
  if (isIpAddress(hostname)) addIndicator(indicators, "urlIpAddress", 45);
  if (shortenerHosts.has(hostWithoutWww)) addIndicator(indicators, "urlShortener", 25);
  if (parsed.username || parsed.password || text.includes("@")) addIndicator(indicators, "urlHiddenAddress", 45);
  if (hostname.split(".").length > 4) addIndicator(indicators, "urlManySubdomains", 20);
  if (hostname.includes("xn--")) addIndicator(indicators, "urlEncodedDomain", 25);
  if (detectBrandLookalike(hostname)) addIndicator(indicators, "urlBrandLookalike", 35);
  if (parsed.protocol === "http:") addIndicator(indicators, "urlNoHttps", 10);

  return makeResult(indicators);
}

const messageRules: { pattern: RegExp; key: string; weight: number }[] = [
  { pattern: /(?:share|send|tell|provide|enter|submit|reply\s+with|forward|बताएं|भेजें|दर्ज\s+करें|सांझा).{0,70}(?:upi\s*pin|pin|otp|password|passcode|cvv|पासवर्ड|ओटीपी|पिन)/i, key: "messageSecretRequest", weight: 75 },
  { pattern: /(?:upi\s*pin|otp|password|passcode|cvv|पासवर्ड|ओटीपी|पिन).{0,70}(?:share|send|tell|provide|enter|submit|reply|बताएं|भेजें|दर्ज\s+करें)/i, key: "messageSecretRequest", weight: 75 },
  { pattern: /(?:account|खाता).{0,45}(?:block(?:ed)?|suspend(?:ed)?|close(?:d)?|lock(?:ed)?|बंद|रोक)/i, key: "messageUrgentThreat", weight: 25 },
  { pattern: /(?:urgent|immediately|today|within\s+\d+\s*(?:hours?|minutes?)|तुरंत|आज ही|जल्दी)/i, key: "messageUrgency", weight: 15 },
  { pattern: /(?:reward|refund|prize|winner|cashback|free\s+gift|kyc\s+update|इनाम|रिफंड|पुरस्कार|कैशबैक|केवाईसी)/i, key: "messageUnexpectedOffer", weight: 15 },
  { pattern: /(?:click|tap|open|visit|follow|install|download).{0,60}(?:link|url|app|apk|लिंक|ऐप)|(?:link|url|app|apk|लिंक|ऐप).{0,60}(?:click|tap|open|install|download|खोलें|दबाएं)/i, key: "messageLinkPressure", weight: 25 },
  { pattern: /(?:approve|accept|authorize|confirm).{0,60}(?:collect|payment|request|upi|पेमेंट|भुगतान|अनुरोध)|(?:collect\s+request|payment\s+request|पेमेंट अनुरोध)/i, key: "messagePaymentApproval", weight: 35 },
  { pattern: /(?:bank|customer\s*care|support|official\s+team|बैंक|सहायता|कस्टमर\s*केयर).{0,60}(?:send\s+money|transfer|upi\s*pin|otp|click|install|भेजें|ट्रांसफर)/i, key: "messageImpersonation", weight: 20 },
];

function checkMessage(input: string): PhishingCheckResult {
  const indicators: PhishingIndicator[] = [];
  for (const rule of messageRules) {
    if (rule.pattern.test(input)) addIndicator(indicators, rule.key, rule.weight);
  }
  return makeResult(indicators);
}

function makeResult(indicators: PhishingIndicator[]): PhishingCheckResult {
  const ruleScore = Math.min(100, indicators.reduce((total, indicator) => total + indicator.weight, 0));
  const containsSecretRequest = indicators.some(indicator => indicator.key === "messageSecretRequest");
  const level: PhishingRiskLevel = containsSecretRequest || ruleScore >= 65
    ? "highRisk"
    : ruleScore >= 25 || indicators.length >= 2
      ? "suspicious"
      : "likelySafe";
  const ordered = [...indicators].sort((a, b) => b.weight - a.weight);
  return {
    level,
    ruleScore,
    indicators: ordered,
    summaryKey: `phishingResult${level[0].toUpperCase()}${level.slice(1)}`,
    defaultRecommendationKey: ordered[0]?.recommendationKey ?? "phishingDefaultNext",
  };
}

export function checkForPhishing(mode: PhishingCheckMode, input: string): PhishingCheckResult {
  return mode === "url" ? checkUrl(input) : checkMessage(input.trim());
}