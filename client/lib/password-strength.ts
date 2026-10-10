export type PasswordStrengthLevel = "veryWeak" | "weak" | "moderate" | "strong" | "veryStrong";

export type PasswordStrengthResult = {
  score: number;
  level: PasswordStrengthLevel;
  length: number;
  characterTypes: number;
  explanationKeys: string[];
  recommendationKeys: string[];
};

const commonPatterns = ["password", "passw0rd", "letmein", "qwerty", "welcome", "admin", "iloveyou", "123456", "000000"];
const predictableRows = ["0123456789", "abcdefghijklmnopqrstuvwxyz", "qwertyuiop", "asdfghjkl", "zxcvbnm"];

function hasPredictableSequence(value: string) {
  return predictableRows.some(row => {
    const reverse = row.split("").reverse().join("");
    return [row, reverse].some(sequence => {
      for (let index = 0; index <= sequence.length - 4; index += 1) {
        if (value.includes(sequence.slice(index, index + 4))) return true;
      }
      return false;
    });
  });
}

export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const normalized = password.toLowerCase();
  const characterTypes = [
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9\s]/.test(password),
  ].filter(Boolean).length;
  const isCommon = commonPatterns.some(pattern => normalized.includes(pattern));
  const hasSequence = hasPredictableSequence(normalized);
  const hasRepeatedCharacters = /(.)\1{2,}/u.test(password);
  const longestCharacterRun = Math.max(0, ...Array.from(password.matchAll(/(.)\1*/gu), match => match[0].length));
  const mostlyRepeated = password.length >= 4 && longestCharacterRun / password.length >= 0.5;

  let score = password.length < 6 ? 0
    : password.length < 8 ? 8
      : password.length < 12 ? 18
        : password.length < 16 ? 30
          : password.length < 20 ? 42
            : 52;
  score += characterTypes * 5;
  if (isCommon) score -= 25;
  if (hasSequence) score -= 15;
  if (hasRepeatedCharacters) score -= 12;
  if (mostlyRepeated) score -= 10;
  score = Math.max(0, Math.min(100, score));

  const level: PasswordStrengthLevel = score < 18 ? "veryWeak"
    : score < 35 ? "weak"
      : score < 50 ? "moderate"
        : score < 68 ? "strong"
          : "veryStrong";
  const explanationKeys = [
    password.length < 12 ? "passwordReasonShort" : password.length < 16 ? "passwordReasonMedium" : "passwordReasonLong",
  ];
  if (characterTypes < 3) explanationKeys.push("passwordReasonMix");
  if (isCommon) explanationKeys.push("passwordReasonCommon");
  if (hasSequence) explanationKeys.push("passwordReasonSequence");
  if (hasRepeatedCharacters || mostlyRepeated) explanationKeys.push("passwordReasonRepeated");
  if (explanationKeys.length === 1 && score >= 50) explanationKeys.push("passwordReasonGood");

  const recommendationKeys: string[] = [];
  if (password.length < 16) recommendationKeys.push("passwordRecLonger");
  if (characterTypes < 3) recommendationKeys.push("passwordRecMix");
  if (isCommon) recommendationKeys.push("passwordRecCommon");
  if (hasSequence) recommendationKeys.push("passwordRecSequence");
  if (hasRepeatedCharacters || mostlyRepeated) recommendationKeys.push("passwordRecRepeated");
  recommendationKeys.push("passwordRecUnique");

  return { score, level, length: password.length, characterTypes, explanationKeys, recommendationKeys };
}