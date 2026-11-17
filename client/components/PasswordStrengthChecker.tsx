import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, ShieldCheck, X } from "lucide-react";
import { evaluatePasswordStrength, type PasswordStrengthResult } from "../lib/password-strength";

type PasswordStrengthCheckerProps = {
  t: (key: string) => string;
  onClose: () => void;
  onChecked?: (record: {
    strength: "Weak" | "Moderate" | "Strong";
    score: number;
    length_check: boolean;
    uppercase_check: boolean;
    lowercase_check: boolean;
    number_check: boolean;
    special_character_check: boolean;
  }) => Promise<void>;
};

function formatMessage(template: string, values: Record<string, number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

export default function PasswordStrengthChecker({ t, onClose, onChecked }: PasswordStrengthCheckerProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PasswordStrengthResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const clear = () => {
    setPassword("");
    if (inputRef.current) inputRef.current.value = "";
    setShowPassword(false);
    setError("");
    setResult(null);
  };

  const close = () => {
    clear();
    onClose();
  };

  const checkStrength = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password) {
      setError(t("passwordCheckerEmpty"));
      setResult(null);
      return;
    }

    const evaluation = evaluatePasswordStrength(password);
    setResult(evaluation);
    const record = {
      strength: evaluation.score < 35 ? "Weak" as const : evaluation.score < 60 ? "Moderate" as const : "Strong" as const,
      score: evaluation.score,
      length_check: password.length >= 12,
      uppercase_check: /[A-Z]/.test(password),
      lowercase_check: /[a-z]/.test(password),
      number_check: /[0-9]/.test(password),
      special_character_check: /[^A-Za-z0-9\s]/.test(password),
    };
    clearPasswordOnly();
    if (onChecked) {
      try {
        await onChecked(record);
      } catch (saveError) {
        setError(`The local check completed, but its history could not be saved: ${saveError instanceof Error ? saveError.message : "Unknown error"}`);
      }
    }
  };

  const clearPasswordOnly = () => {
    setPassword("");
    if (inputRef.current) inputRef.current.value = "";
    setShowPassword(false);
    setError("");
  };

  const levelLabel = result ? t(`passwordStrength${result.level[0].toUpperCase()}${result.level.slice(1)}`) : "";

  return <section className="password-checker" aria-labelledby="password-checker-title">
    <div className="password-checker-heading">
      <span className="password-checker-icon"><ShieldCheck size={19} /></span>
      <div>
        <h2 id="password-checker-title">{t("passwordCheckerTitle")}</h2>
        <p>{t("passwordCheckerInstructions")}</p>
      </div>
      <button type="button" className="password-checker-icon-button" onClick={close} aria-label={t("passwordCheckerClose")} title={t("passwordCheckerClose")}>
        <X size={18} />
      </button>
    </div>

    <form onSubmit={checkStrength}>
      <label className="password-checker-label" htmlFor="password-strength-input">{t("passwordCheckerLabel")}</label>
      <div className="password-checker-input-row">
        <input
          ref={inputRef}
          id="password-strength-input"
          type={showPassword ? "text" : "password"}
          autoComplete="off"
          spellCheck={false}
          value={password}
          onChange={event => { setPassword(event.target.value); setError(""); setResult(null); }}
          placeholder={t("passwordCheckerPlaceholder")}
          aria-describedby="password-checker-privacy"
        />
        <button
          type="button"
          className="password-checker-icon-button"
          onClick={() => setShowPassword(value => !value)}
          aria-label={t(showPassword ? "passwordCheckerHide" : "passwordCheckerShow")}
          title={t(showPassword ? "passwordCheckerHide" : "passwordCheckerShow")}
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error && <p className="password-checker-error" role="alert">{error}</p>}
      <p id="password-checker-privacy" className="password-checker-privacy">{t("passwordCheckerPrivacy")}</p>
      <div className="password-checker-actions">
        <button type="submit" className="btn btn-primary">{t("passwordCheckerCheck")}</button>
        <button type="button" className="btn btn-outline" onClick={clear}>{t("passwordCheckerClear")}</button>
      </div>
    </form>

    {result && <div className="password-checker-result" aria-live="polite">
      <div className="password-checker-result-heading">
        <div>
          <span>{t("passwordCheckerStrength")}</span>
          <strong>{levelLabel}</strong>
        </div>
        <span className="password-checker-score">{result.score}/100</span>
      </div>
      <div
        className="password-strength-meter"
        role="meter"
        aria-label={t("passwordCheckerStrength")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={result.score}
        aria-valuetext={`${levelLabel}, ${result.score} out of 100`}
      >
        {Array.from({ length: 5 }, (_, index) => <span key={index} className={result.score >= (index + 1) * 20 ? `filled strength-${result.level}` : ""} />)}
      </div>
      <h3>{t("passwordCheckerExplanation")}</h3>
      <ul>{result.explanationKeys.map(key => <li key={key}>{formatMessage(t(key), { length: result.length, types: result.characterTypes })}</li>)}</ul>
      <h3>{t("passwordCheckerRecommendations")}</h3>
      <ul>{result.recommendationKeys.map(key => <li key={key}>{t(key)}</li>)}</ul>
    </div>}
  </section>;
}