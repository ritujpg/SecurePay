import { useEffect, useRef, useState } from "react";
import { ShieldAlert, ShieldCheck, X } from "lucide-react";
import { checkForPhishing, type PhishingCheckMode, type PhishingCheckResult } from "../lib/phishing-check";

type PhishingCheckProps = {
  t: (key: string) => string;
  onClose: () => void;
  onIgnore: (level: PhishingCheckResult["level"]) => void;
};

export default function PhishingCheck({ t, onClose, onIgnore }: PhishingCheckProps) {
  const [mode, setMode] = useState<PhishingCheckMode>("url");
  const [submittedText, setSubmittedText] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<PhishingCheckResult | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => () => {
    if (textAreaRef.current) textAreaRef.current.value = "";
  }, []);

  const clear = () => {
    setSubmittedText("");
    if (textAreaRef.current) textAreaRef.current.value = "";
    setError("");
    setResult(null);
  };

  const close = () => {
    clear();
    onClose();
  };

  const chooseMode = (nextMode: PhishingCheckMode) => {
    setMode(nextMode);
    clear();
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!submittedText.trim()) {
      setError(t("phishingCheckEmpty"));
      setResult(null);
      return;
    }
    setError("");
    setResult(checkForPhishing(mode, submittedText));
  };

  const resultTitle = result ? t(result.summaryKey) : "";

  return <section className="phishing-checker" aria-labelledby="phishing-checker-title">
    <div className="phishing-checker-heading">
      <span className="phishing-checker-icon"><ShieldAlert size={19} /></span>
      <div>
        <h2 id="phishing-checker-title">{t("phishingTitle")}</h2>
        <p>{t("phishingHelper")}</p>
      </div>
      <button type="button" className="phishing-checker-icon-button" onClick={close} aria-label={t("phishingClose")} title={t("phishingClose")}><X size={18} /></button>
    </div>

    <div className="phishing-mode-choice" role="group" aria-label={t("phishingChooseType")}>
      <button type="button" aria-pressed={mode === "url"} className={mode === "url" ? "selected" : ""} onClick={() => chooseMode("url")}>{t("phishingModeUrl")}</button>
      <button type="button" aria-pressed={mode === "message"} className={mode === "message" ? "selected" : ""} onClick={() => chooseMode("message")}>{t("phishingModeMessage")}</button>
    </div>

    <form onSubmit={submit}>
      <label className="phishing-checker-label" htmlFor="phishing-checker-text">{t("phishingInputLabel")}</label>
      <textarea
        ref={textAreaRef}
        id="phishing-checker-text"
        rows={4}
        value={submittedText}
        onChange={event => { setSubmittedText(event.target.value); setError(""); setResult(null); }}
        placeholder={t(mode === "url" ? "phishingUrlPlaceholder" : "phishingMessagePlaceholder")}
        aria-describedby="phishing-checker-privacy"
        autoComplete="off"
        spellCheck={false}
      />
      {error && <p className="phishing-checker-error" role="alert">{error}</p>}
      <p id="phishing-checker-privacy" className="phishing-checker-privacy">{t("phishingPrivacy")}</p>
      <div className="phishing-checker-actions">
        <button type="submit" className="btn btn-primary">{t("phishingCheckNow")}</button>
        <button type="button" className="btn btn-outline" onClick={clear}>{t("phishingClear")}</button>
      </div>
    </form>

    {result && <div className={`phishing-checker-result phishing-result-${result.level}`} aria-live="polite">
      <div className="phishing-result-title">
        {result.level === "likelySafe" ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
        <h3>{resultTitle}</h3>
      </div>
      <p className="phishing-rule-score">{t("phishingRuleScore")}: {result.ruleScore}/100</p>
      <h4>{t("phishingWhyTitle")}</h4>
      {result.indicators.length ? <ul>{result.indicators.map(indicator => <li key={indicator.key}>
        <strong>{t(indicator.key)}</strong>
        <span>{t(indicator.explanationKey)}</span>
      </li>)}</ul> : <p>{t("phishingNoIndicators")}</p>}
      <h4>{t("phishingNextTitle")}</h4>
      <p>{result.indicators.length ? result.indicators.map(indicator => t(indicator.recommendationKey)).filter((value, index, values) => values.indexOf(value) === index).join(" ") : t(result.defaultRecommendationKey)}</p>
      {result.level !== "likelySafe" && <button type="button" className="btn btn-outline phishing-ignore-action" onClick={() => onIgnore(result.level)}>{t("phishingIgnore")}</button>}
    </div>}
  </section>;
}