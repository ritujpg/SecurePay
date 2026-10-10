import { useState } from "react";
import { calculateCyberTrustScore, clampCyberTrustScore, cyberTrustRingDegrees, type CyberTrustSignals } from "../lib/cyber-trust-score";

type CyberTrustScoreProps = {
  signals: CyberTrustSignals;
  t: (key: string) => string;
  onViewActivity: () => void;
};

function titleCase(value: string) {
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}

export default function CyberTrustScore({ signals, t, onViewActivity }: CyberTrustScoreProps) {
  const result = calculateCyberTrustScore(signals);
  const score = clampCyberTrustScore(result.score);
  const ringDegrees = cyberTrustRingDegrees(score);
  const rating = t(`cyberTrustRating${titleCase(result.rating)}`);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsId = "cyber-trust-details";

  return <section className="security-score-card cyber-trust-card" aria-labelledby="cyber-trust-title">
    <div className="cyber-trust-summary">
      <div className="security-score-copy cyber-trust-copy">
        <span className="status-pill"><i />{t(result.illustrative ? "cyberTrustIllustrativeLabel" : "cyberTrustPersonalizedLabel")}</span>
        <h2 id="cyber-trust-title">{t("cyberTrustTitle")}</h2>
        <p>{t(result.illustrative ? result.explanationKey : "cyberTrustCompactExplanation")}</p>
        <button
          type="button"
          className="cyber-trust-details-toggle"
          aria-expanded={detailsOpen}
          aria-controls={detailsId}
          onClick={() => setDetailsOpen(value => !value)}
        >{t(detailsOpen ? "cyberTrustLessDetails" : "cyberTrustMoreDetails")}</button>
      </div>
      <div className="cyber-trust-score-display">
        <div className="security-score-ring" data-score={score} style={{ "--cyber-trust-angle": `${ringDegrees}deg` } as React.CSSProperties} role="meter" aria-label={t("cyberTrustTitle")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={score} aria-valuetext={`${score} / 100${result.illustrative ? "" : `, ${rating}`}`}>
          <span>{score}</span><small>/100</small>
        </div>
        {!result.illustrative && <strong>{rating}</strong>}
      </div>
    </div>
    <div id={detailsId} className="cyber-trust-details" hidden={!detailsOpen}>
      <h3>{t("cyberTrustFactorsTitle")}</h3>
      <ul className="cyber-trust-factors">
        {result.factors.length ? result.factors.map(factor => <li key={factor.key}>
          <span>{t(factor.key)}</span>
          <span className={factor.status === "good" ? "cyber-factor-good" : "cyber-factor-attention"}>
            {t(factor.status === "good" ? "cyberFactorOnTrack" : "cyberFactorNeedsAttention")}
          </span>
          <small>{t(factor.recommendationKey ?? "cyberTrustKeepOn")}</small>
        </li>) : <li>{t("cyberTrustNoSignals")}</li>}
      </ul>
      <p className="cyber-trust-limit">{t("cyberTrustNotGuarantee")}</p>
      <button type="button" className="cyber-trust-activity-link" onClick={onViewActivity}>{t("viewSecurityActivity")}<span aria-hidden="true">→</span></button>
    </div>
  </section>;
}