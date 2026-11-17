import { useEffect, useRef, useState } from "react";
import { ShieldAlert, ShieldCheck, X } from "lucide-react";
import { checkForPhishing, type PhishingCheckMode, type PhishingCheckResult } from "../lib/phishing-check";
import { predictBankingSms, predictPhishing, type PhishingPrediction, type SmsPrediction } from "../lib/ml-api";

type PhishingCheckProps = {
  t: (key: string) => string;
  onClose: () => void;
  onIgnore: (level: PhishingCheckResult["level"]) => void;
  onChecked?: (record: {
    input_type: "URL" | "MESSAGE";
    input_hash: string;
    risk_level: "Safe" | "Suspicious" | "High Risk";
    risk_score: number;
    explanation: string;
  }) => Promise<void>;
};

async function hashInput(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value.trim()));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export default function PhishingCheck({ t, onClose, onIgnore, onChecked }: PhishingCheckProps) {
  const [mode, setMode] = useState<PhishingCheckMode>("url");
  const [submittedText, setSubmittedText] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<PhishingCheckResult | null>(null);
  const [modelResult, setModelResult] = useState<PhishingPrediction | null>(null);
  const [smsResult, setSmsResult] = useState<SmsPrediction | null>(null);
  const [checking, setChecking] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const requestIdRef = useRef(0);

  useEffect(() => () => {
    requestIdRef.current += 1;
    if (textAreaRef.current) textAreaRef.current.value = "";
  }, []);

  const clear = () => {
    requestIdRef.current += 1;
    setSubmittedText("");
    if (textAreaRef.current) textAreaRef.current.value = "";
    setError("");
    setResult(null);
    setModelResult(null);
    setSmsResult(null);
    setChecking(false);
  };

  const close = () => {
    clear();
    onClose();
  };

  const chooseMode = (nextMode: PhishingCheckMode) => {
    setMode(nextMode);
    clear();
  };

  const saveHistory = async (
    input: string,
    checked: PhishingCheckResult,
    predictions: Array<PhishingPrediction | SmsPrediction> = [],
  ) => {
    if (!onChecked) return;
    const levels = [
      checked.level === "highRisk" ? "High Risk" : checked.level === "suspicious" ? "Suspicious" : "Safe",
      ...predictions.map(prediction => prediction.risk_level === "Phishing" ? "High Risk" : prediction.risk_level === "Suspicious" ? "Suspicious" : "Safe"),
    ] as Array<"Safe" | "Suspicious" | "High Risk">;
    const level = levels.includes("High Risk") ? "High Risk" : levels.includes("Suspicious") ? "Suspicious" : "Safe";
    const riskScore = Math.max(checked.ruleScore, ...predictions.map(prediction => prediction.phishing_risk_score));
    const modelExplanation = predictions.map(prediction => `${prediction.model}: ${prediction.risk_level} (${prediction.phishing_risk_score}/100)`);
    const ruleExplanation = checked.indicators.map(indicator => t(indicator.explanationKey));
    await onChecked({
      input_type: mode === "url" ? "URL" : "MESSAGE",
      input_hash: await hashInput(input),
      risk_level: level,
      risk_score: riskScore,
      explanation: [...ruleExplanation, ...modelExplanation].join("; ") || t(checked.defaultRecommendationKey),
    });
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!submittedText.trim()) {
      setError(t("phishingCheckEmpty"));
      setResult(null);
      setModelResult(null);
      setSmsResult(null);
      return;
    }
    setError("");
    const ruleResult = checkForPhishing(mode, submittedText);
    setResult(ruleResult);
    setModelResult(null);
    setSmsResult(null);
    if (mode === "url") {
      try {
        await saveHistory(submittedText, ruleResult);
      } catch (saveError) {
        setError(`The local check completed, but its history could not be saved: ${saveError instanceof Error ? saveError.message : "Unknown error"}`);
      }
      return;
    }

    const requestId = ++requestIdRef.current;
    setChecking(true);
    const [phishingOutcome, smsOutcome] = await Promise.allSettled([
      predictPhishing(submittedText),
      predictBankingSms(submittedText),
    ]);
    if (requestId === requestIdRef.current) {
      const requestErrors: string[] = [];
      if (phishingOutcome.status === "fulfilled") {
        setModelResult(phishingOutcome.value);
      } else {
        const detail = phishingOutcome.reason instanceof Error ? phishingOutcome.reason.message : t("phishingRequestFailed");
        requestErrors.push(`${t("phishingModelResult")}: ${detail}`);
      }
      if (smsOutcome.status === "fulfilled") {
        setSmsResult(smsOutcome.value);
      } else {
        const detail = smsOutcome.reason instanceof Error ? smsOutcome.reason.message : t("smsRequestFailed");
        requestErrors.push(`${t("smsModelResult")}: ${detail}`);
      }
      const predictions = [
        ...(phishingOutcome.status === "fulfilled" ? [phishingOutcome.value] : []),
        ...(smsOutcome.status === "fulfilled" ? [smsOutcome.value] : []),
      ];
      try {
        await saveHistory(submittedText, ruleResult, predictions);
      } catch (saveError) {
        requestErrors.push(`The local check completed, but its history could not be saved: ${saveError instanceof Error ? saveError.message : "Unknown error"}`);
      }
      setError(requestErrors.join(" "));
      setChecking(false);
    }
  };

  const resultTitle = result ? t(result.summaryKey) : "";
  const modelRiskLevels = [modelResult?.risk_level, smsResult?.risk_level];
  const modelWarningLevel = modelRiskLevels.includes("Phishing")
    ? "highRisk"
    : modelRiskLevels.includes("Suspicious")
      ? "suspicious"
      : "likelySafe";
  const warningLevel = result && result.level !== "likelySafe" ? result.level : modelResult ? modelWarningLevel : "likelySafe";

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

    <form onSubmit={submit} aria-busy={checking}>
      <label className="phishing-checker-label" htmlFor="phishing-checker-text">{t("phishingInputLabel")}</label>
      <textarea
        ref={textAreaRef}
        id="phishing-checker-text"
        rows={4}
        value={submittedText}
        onChange={event => { requestIdRef.current += 1; setSubmittedText(event.target.value); setError(""); setResult(null); setModelResult(null); setChecking(false); }}
        placeholder={t(mode === "url" ? "phishingUrlPlaceholder" : "phishingMessagePlaceholder")}
        aria-describedby="phishing-checker-privacy"
        autoComplete="off"
        spellCheck={false}
      />
      {error && <p className="phishing-checker-error" role="alert">{error}</p>}
      <p id="phishing-checker-privacy" className="phishing-checker-privacy">{t("phishingRemotePrivacy")}</p>
      {checking && <p className="phishing-checker-privacy" role="status">{t("phishingChecking")}</p>}
      <div className="phishing-checker-actions">
        <button type="submit" className="btn btn-primary" disabled={checking}>{t(checking ? "phishingChecking" : "phishingCheckNow")}</button>
        <button type="button" className="btn btn-outline" onClick={clear}>{t("phishingClear")}</button>
      </div>
    </form>

    {result && <div className={`phishing-checker-result phishing-result-${result.level}`} aria-live="polite">
      <div className="phishing-result-title">
        {result.level === "likelySafe" ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
        <h3>{resultTitle}</h3>
      </div>
      <p className="phishing-rule-score">{t("phishingRuleScore")}: {result.ruleScore}/100</p>
      {modelResult && <div className="phishing-model-result">
        <h4>{t("phishingModelResult")}</h4>
        <p><strong>{t("phishingModelPrediction")}:</strong> {modelResult.prediction}</p>
        <p><strong>{t("phishingModelRiskLevel")}:</strong> {modelResult.risk_level}</p>
        <p><strong>{t("phishingModelRiskScore")}:</strong> {modelResult.phishing_risk_score}%</p>
        <h4>{t("phishingModelProbabilities")}</h4>
        <ul>{Object.entries(modelResult.probabilities).map(([label, probability]) => <li key={label}>
          <strong>{label}</strong>
          <span>{probability}%</span>
        </li>)}</ul>
      </div>}
      {smsResult && <div className="phishing-model-result">
        <h4>{t("smsModelResult")}</h4>
        <p><strong>{t("phishingModelPrediction")}:</strong> {smsResult.prediction}</p>
        <p><strong>{t("phishingModelRiskLevel")}:</strong> {smsResult.risk_level}</p>
        <p><strong>{t("phishingModelRiskScore")}:</strong> {smsResult.phishing_risk_score}%</p>
        <h4>{t("phishingModelProbabilities")}</h4>
        <ul>{Object.entries(smsResult.probabilities).map(([label, probability]) => <li key={label}>
          <strong>{label}</strong>
          <span>{probability}%</span>
        </li>)}</ul>
      </div>}
      <h4>{t("phishingWhyTitle")}</h4>
      {result.indicators.length ? <ul>{result.indicators.map(indicator => <li key={indicator.key}>
        <strong>{t(indicator.key)}</strong>
        <span>{t(indicator.explanationKey)}</span>
      </li>)}</ul> : <p>{t("phishingNoIndicators")}</p>}
      <h4>{t("phishingNextTitle")}</h4>
      <p>{result.indicators.length ? result.indicators.map(indicator => t(indicator.recommendationKey)).filter((value, index, values) => values.indexOf(value) === index).join(" ") : t(result.defaultRecommendationKey)}</p>
      {warningLevel !== "likelySafe" && <button type="button" className="btn btn-outline phishing-ignore-action" onClick={() => onIgnore(warningLevel)}>{t("phishingIgnore")}</button>}
    </div>}
  </section>;
}