import { useState } from "react";
import { Activity, ArrowLeft, ArrowRight, Check, Fingerprint, LockKeyhole, Shield, ShieldCheck, Smartphone, X } from "lucide-react";
import { Avatar, Button, DemoDisclaimer, PageHeading, useApp } from "./shared";

export function Splash() {
  const { navigate } = useApp();
  return <div className="intro-screen"><div className="intro-brand"><span className="brand-mark"><Shield size={22} /><span>₹</span></span><b>SecurePay</b></div><div className="intro-art"><div className="intro-orbit orbit-one" /><div className="intro-orbit orbit-two" /><div className="intro-shield"><Shield size={56} /><span>₹</span></div><span className="intro-bubble bubble-a"><Check size={16} /></span><span className="intro-bubble bubble-b"><LockKeyhole size={16} /></span></div><h1>Pay with confidence.<br /><span>Protected by design.</span></h1><p>A smarter demo payment experience with adaptive security built into every step.</p><Button onClick={() => navigate("/onboarding")}>Get started<ArrowRight size={17} /></Button><DemoDisclaimer /></div>;
}

export function Onboarding() {
  const { navigate } = useApp();
  return <div className="intro-screen onboarding-screen"><button className="intro-back" onClick={() => navigate("/splash")}><ArrowLeft size={17} />Back</button><div className="intro-art compact-art"><div className="intro-shield"><ShieldCheck size={52} /></div><span className="intro-bubble bubble-a"><Activity size={16} /></span></div><span className="eyebrow">SMARTER SECURITY</span><h1>Every payment<br /><span>gets its own check.</span></h1><p>SecurePay adapts verification to the risk of each demo transaction. More protection when a payment needs it.</p><div className="onboarding-points"><div><span><Activity size={16} /></span><b>Risk-aware</b><small>Each payment is assessed</small></div><div><span><LockKeyhole size={16} /></span><b>Adaptive</b><small>Verification matches risk</small></div></div><Button onClick={() => navigate("/login")}>Continue<ArrowRight size={17} /></Button><DemoDisclaimer /></div>;
}

export function Login() {
  const { data, update, navigate } = useApp();
  const [mobile, setMobile] = useState(data.loginMobile || "");
  const [error, setError] = useState("");
  const submit = () => {
    const number = mobile.replace(/\D/g, "").slice(-10);
    if (!/^\d{10}$/.test(number)) { setError("Enter a valid 10-digit mobile number."); return; }
    const existing = number === "9876543210" || data.auth.knownMobiles.includes(number);
    update({ loginMobile: number, auth: { ...data.auth, lastMobile: number } });
    navigate(existing ? "/auth/unlock" : "/auth/otp");
  };
  return <div className="intro-screen login-screen"><div className="intro-brand"><span className="brand-mark"><Shield size={22} /><span>₹</span></span><b>SecurePay</b></div><span className="eyebrow">DEMO ACCOUNT ACCESS</span><h1>Welcome to<br /><span>SecurePay.</span></h1><p>Enter your mobile number to continue to your demo account.</p><label className="field-label login-mobile-field">Mobile number<div className="mobile-number-entry"><span>+91</span><input inputMode="numeric" autoComplete="tel-national" value={mobile} onChange={e => { setMobile(e.target.value.replace(/\D/g, "").slice(0, 10)); setError(""); }} placeholder="98765 43210" /></div></label>{error && <p className="field-error">{error}</p>}<Button className="full-button" onClick={submit}>Continue<ArrowRight size={17} /></Button><p className="inline-demo-note"><Shield size={14} />Demo account only · No real OTP is sent</p><DemoDisclaimer /></div>;
}

export function AccessOtp() {
  const { data, update, navigate } = useApp();
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const finish = (value: string) => {
    const code = value.replace(/\D/g, "").slice(0, 6);
    setOtp(code);
    setError("");
    if (code.length === 6) {
      if (code === "123456") {
        update({ auth: { ...data.auth, isAuthenticated: true, knownMobiles: [...new Set([...data.auth.knownMobiles, data.loginMobile])], lastMobile: data.loginMobile } });
        navigate("/");
      } else setError("Incorrect demo OTP. Try 123456.");
    }
  };
  return <div className="intro-screen login-screen"><button className="intro-back" onClick={() => navigate("/login")}><ArrowLeft size={17} />Back</button><div className="intro-brand"><span className="brand-mark"><Shield size={22} /><span>₹</span></span><b>SecurePay</b></div><span className="eyebrow">DEMO VERIFICATION</span><h1>Verify your<br /><span>mobile number.</span></h1><p>Demo verification code for +91 {data.loginMobile}.</p><div className="otp-boxes">{Array.from({ length: 6 }, (_, i) => <input key={i} id={`access-otp-${i}`} aria-label={`OTP digit ${i + 1}`} inputMode="numeric" maxLength={1} value={otp[i] ?? ""} onChange={e => { const chars = otp.split(""); chars[i] = e.target.value.replace(/\D/g, "").slice(-1); finish(chars.join("")); if (e.target.value && i < 5) (document.getElementById(`access-otp-${i + 1}`) as HTMLInputElement)?.focus(); }} />)}</div>{error && <p className="field-error">{error}</p>}<div className="demo-code-card"><span>DEMO OTP</span><b>123456</b><button onClick={() => finish("123456")}>Use code</button></div><Button className="full-button" onClick={() => finish(otp)}>Verify OTP<ArrowRight size={17} /></Button><DemoDisclaimer /></div>;
}

export function UnlockPage() {
  const { data, navigate } = useApp();
  return <div className="intro-screen login-screen"><div className="intro-brand"><span className="brand-mark"><Shield size={22} /><span>₹</span></span><b>SecurePay</b></div><span className="eyebrow">EXISTING DEMO ACCOUNT</span><h1>Welcome back,<br /><span>Ritu.</span></h1><p>Choose how to unlock your account.</p><div className="login-profile"><Avatar name="Ritu Ratnaparkhi" tone="deep" /><div><b>Ritu Ratnaparkhi</b><small>+91 {data.auth.lastMobile || "9876543210"}</small></div><Check size={18} className="verified-icon" /></div><Button className="full-button" onClick={() => navigate("/auth/fingerprint")}><Fingerprint size={18} />Use Fingerprint</Button><Button variant="outline" className="full-button" onClick={() => navigate("/auth/pin")}><LockKeyhole size={17} />Use PIN</Button><button className="text-button" onClick={() => navigate("/login")}>Use another mobile number</button></div>;
}

export function AccessPin() {
  const { unlockApp, navigate } = useApp();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const enter = (key: string) => {
    if (key === "back") { setPin(pin.slice(0, -1)); return; }
    if (key === "clear") { setPin(""); return; }
    if (pin.length >= 6) return;
    const next = pin + key;
    setPin(next);
    if (next.length === 6) setTimeout(() => { if (next === "123456") unlockApp(); else { setError("Incorrect demo PIN. Please try again."); setPin(""); } }, 120);
  };
  return <div className="intro-screen login-screen"><button className="intro-back" onClick={() => navigate("/auth/unlock")}><ArrowLeft size={17} />Back</button><div className="intro-brand"><span className="brand-mark"><Shield size={22} /><span>₹</span></span><b>SecurePay</b></div><span className="eyebrow">ACCOUNT UNLOCK</span><h1>Welcome back,<br /><span>Ritu.</span></h1><p>Enter your 6-digit demo PIN.</p><div className="pin-dots">{Array.from({ length: 6 }, (_, i) => <i key={i} className={i < pin.length ? "filled" : ""} />)}</div>{error && <p className="field-error centered">{error}</p>}<div className="pin-keypad">{["1","2","3","4","5","6","7","8","9","back","0","clear"].map(key => <button key={key} onClick={() => enter(key)} aria-label={key === "back" ? "Backspace" : key === "clear" ? "Clear" : key}>{key === "back" ? <ArrowLeft size={20} /> : key === "clear" ? <X size={19} /> : key}</button>)}</div><p className="demo-credential"><span>Demo PIN</span><b>123456</b><button onClick={() => { setPin("123456"); setTimeout(unlockApp, 120); }}>Use demo PIN</button></p></div>;
}

export function AccessFingerprint() {
  const { unlockApp, navigate } = useApp();
  const [scanning, setScanning] = useState(false);
  const [verified, setVerified] = useState(false);
  const start = () => { setScanning(true); setTimeout(() => setVerified(true), 1300); };
  return <div className="intro-screen login-screen"><button className="intro-back" onClick={() => navigate("/auth/unlock")}><ArrowLeft size={17} />Back</button><div className="intro-brand"><span className="brand-mark"><Shield size={22} /><span>₹</span></span><b>SecurePay</b></div><span className="eyebrow">SIMULATED DEVICE CHECK</span><div className={`fingerprint-ring ${scanning ? "scan-active" : ""} ${verified ? "is-verified" : ""}`}>{verified ? <Check size={42} /> : <Fingerprint size={48} />}{scanning && !verified && <span />}</div><h1>{verified ? "Fingerprint verified" : scanning ? "Scanning..." : "Unlock SecurePay"}</h1><p>{verified ? "Identity confirmed. Opening your demo account." : "This simulated check does not access biometric hardware."}</p>{verified ? <Button className="full-button" onClick={unlockApp}>Continue<ArrowRight size={17} /></Button> : <Button className="full-button" onClick={start} disabled={scanning}><Fingerprint size={18} />Use Fingerprint</Button>}<button className="text-button" onClick={() => navigate("/auth/pin")}>Use PIN instead</button></div>;
}
