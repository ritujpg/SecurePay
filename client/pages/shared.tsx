import { createContext, useContext } from "react";
import { BadgeCheck, Bell, ChevronRight, CreditCard, FileClock, Globe2, Home, Languages, LockKeyhole, MoreHorizontal, QrCode, Search, Send, Shield, ShieldAlert, ShieldCheck, Smartphone, UserRound, Users, Wallet, Zap, ArrowLeft, ArrowRight, ArrowUpRight, ArrowDownLeft, Activity, Plus, Check, ScanLine, Settings, Sun, Moon, Copy, Eye, EyeOff, CircleHelp, MapPin, Menu, LogOut, Sparkles, CheckCircle2, X, Fingerprint, Banknote } from "lucide-react";

export type Language = "en" | "hi" | "mr" | "gu";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type TxStatus = "successful" | "blocked" | "pending" | "failed";
export type TxType = "sent" | "received" | "request";

export interface User {
  id: string;
  name: string;
  phone: string;
  upiId: string;
  balance: number;
  bankAccount: string;
  trustedDevices: string[];
  usualLocations: string[];
}

export type Recipient = {
  id: string;
  name: string;
  upiId: string;
  phone: string;
  trusted: boolean;
  riskLevel: "trusted" | "unknown" | "suspicious";
  lastTransaction: string;
};

export type Factor = { label: string; points: number };

export type Transaction = {
  id: string;
  sender: string;
  receiver: string;
  receiverUpi: string;
  amount: number;
  type: TxType;
  status: TxStatus;
  riskScore: number;
  riskLevel: RiskLevel;
  riskFactors: Factor[];
  verificationRequired: string[];
  verificationCompleted: string[];
  timestamp: string;
  note: string;
  request?: boolean;
  reported?: boolean;
  reportReason?: string;
  reportedAt?: string;
};

export type SecurityEvent = {
  id: string;
  type: string;
  description: string;
  riskScore: number;
  timestamp: string;
  transactionId?: string;
};

export type Notice = {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  transactionId?: string;
};

export type Draft = {
  recipient: Recipient;
  amount: number;
  note: string;
  type: "sent" | "request";
  signals?: { newDevice?: boolean; unusualLocation?: boolean; timeOverride?: number; recentCount?: number };
};

export type AppData = {
  user: User;
  auth: { isAuthenticated: boolean; knownMobiles: string[]; lastMobile: string };
  loginMobile: string;
  balance: number;
  transactions: Transaction[];
  recipients: Recipient[];
  notifications: Notice[];
  events: SecurityEvent[];
  language: Language;
  darkMode: boolean;
  settings: { notifications: boolean; security: boolean; biometric: boolean; transactionAlerts: boolean };
  draft: Draft | null;
  risk: { score: number; level: RiskLevel; factors: Factor[]; verification: string[] } | null;
  pinFailures: number;
  lockedUntil: number;
  introDone: boolean;
};

export const STORE_KEY = "securepay-demo-v1";

export const initialRecipients: Recipient[] = [
  { id: "rahul", name: "Rahul Sharma", upiId: "rahul@securepay", phone: "+91 98765 43210", trusted: true, riskLevel: "trusted", lastTransaction: "Paid yesterday" },
  { id: "priya", name: "Priya Patil", upiId: "priya@securepay", phone: "+91 98220 15432", trusted: true, riskLevel: "trusted", lastTransaction: "Paid 2 days ago" },
  { id: "aarav", name: "Aarav Mehta", upiId: "aarav@securepay", phone: "+91 98900 77654", trusted: false, riskLevel: "unknown", lastTransaction: "New recipient" },
  { id: "neha", name: "Neha Joshi", upiId: "neha@securepay", phone: "+91 97654 21109", trusted: true, riskLevel: "trusted", lastTransaction: "Received last week" },
  { id: "merchant", name: "Unknown Merchant", upiId: "merchant@unknown", phone: "", trusted: false, riskLevel: "suspicious", lastTransaction: "Never paid" },
];

export const seededTransactions = (): Transaction[] => {
  const now = Date.now();
  return [
    { id: "SP202610081234", sender: "Ritu Ratnaparkhi", receiver: "Priya Patil", receiverUpi: "priya@securepay", amount: 850, type: "sent", status: "successful", riskScore: 8, riskLevel: "LOW", riskFactors: [], verificationRequired: ["UPI PIN"], verificationCompleted: ["UPI PIN"], timestamp: new Date(now - 86400000).toISOString(), note: "Coffee" },
    { id: "SP202610071122", sender: "Rahul Sharma", receiver: "Ritu Ratnaparkhi", receiverUpi: "ritu@securepay", amount: 2500, type: "received", status: "successful", riskScore: 4, riskLevel: "LOW", riskFactors: [], verificationRequired: [], verificationCompleted: [], timestamp: new Date(now - 172800000).toISOString(), note: "Dinner split" },
    { id: "SP202610061410", sender: "Ritu Ratnaparkhi", receiver: "Electricity", receiverUpi: "electricity@billpay", amount: 1240, type: "sent", status: "successful", riskScore: 12, riskLevel: "LOW", riskFactors: [], verificationRequired: ["UPI PIN"], verificationCompleted: ["UPI PIN"], timestamp: new Date(now - 259200000).toISOString(), note: "June bill" },
    { id: "SP202610051030", sender: "Ritu Ratnaparkhi", receiver: "Secure Cafe", receiverUpi: "securecafe@upi", amount: 450, type: "sent", status: "successful", riskScore: 5, riskLevel: "LOW", riskFactors: [], verificationRequired: ["UPI PIN"], verificationCompleted: ["UPI PIN"], timestamp: new Date(now - 345600000).toISOString(), note: "" },
  ];
};

export const defaults: AppData = {
  user: { id: "demo-ritu", name: "Ritu Ratnaparkhi", phone: "9876543210", upiId: "ritu@securepay", balance: 48750, bankAccount: "Secure Demo Bank ···· 4521", trustedDevices: ["SecurePay demo browser"], usualLocations: ["Pune, Maharashtra"] },
  auth: { isAuthenticated: false, knownMobiles: ["9876543210"], lastMobile: "" },
  loginMobile: "",
  balance: 48750,
  transactions: seededTransactions(),
  recipients: initialRecipients,
  notifications: [
    { id: "n1", type: "System Update", title: "Welcome to SecurePay", message: "Explore the risk-adaptive security demo. No real money is processed.", timestamp: new Date().toISOString(), read: false },
    { id: "n2", type: "Payment Received", title: "Money received", message: "₹2,500 received from Rahul Sharma.", timestamp: new Date(Date.now() - 3600000).toISOString(), read: false },
  ],
  events: [{ id: "e1", type: "Protection active", description: "Risk detection and adaptive verification are active.", riskScore: 0, timestamp: new Date().toISOString() }],
  language: "en",
  darkMode: false,
  settings: { notifications: true, security: true, biometric: true, transactionAlerts: true },
  draft: null,
  risk: null,
  pinFailures: 0,
  lockedUntil: 0,
  introDone: false,
};

export function readStore(): AppData {
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (!saved) return defaults;
    const parsed = JSON.parse(saved);
    return { ...defaults, ...parsed, user: { ...defaults.user, ...parsed.user }, auth: { ...defaults.auth, ...parsed.auth, knownMobiles: parsed.auth?.knownMobiles ?? defaults.auth.knownMobiles }, settings: { ...defaults.settings, ...parsed.settings } };
  } catch {
    return defaults;
  }
}

export const AppContext = createContext<any>(null);

export const translations: Record<Language, Record<string, string>> = {
  en: { home: "Home", scan: "Scan", history: "History", security: "Security", profile: "Profile", send: "Send Money", request: "Request Money", available: "Available balance", quickActions: "Quick actions", recent: "Recent activity", seeAll: "See all", addMoney: "Add money", scanQR: "Scan QR", payBills: "Pay bills", recharge: "Mobile recharge", bankTransfer: "Bank transfer", contacts: "Contacts", notifications: "Notifications", securityCenter: "Security Center", protected: "Your account is protected", settings: "Settings", language: "Language", help: "Help & FAQ", continue: "Continue", cancel: "Cancel", done: "Done", successful: "Payment Successful", risk: "Risk analysis", demo: "Demo mode", sendTo: "Send to", amount: "Amount", note: "Add a note", proceed: "Proceed securely", low: "LOW RISK", medium: "MEDIUM RISK", high: "HIGH RISK", critical: "CRITICAL RISK", verify: "Continue verification", enterPin: "Enter your demo UPI PIN", otp: "Verification code", details: "Transaction details", manage: "Manage recipients", logout: "Log out", faq: "Frequently asked questions", darkMode: "Dark mode", balance: "Balance & bank", profileTitle: "Your profile", markRead: "Mark all as read", clear: "Clear notifications", recentEvents: "Recent security events", requestSent: "Payment request sent", scanTitle: "Scan & pay", chooseRecipient: "Choose a recipient", enterUpi: "Enter UPI ID", recipient: "Recipient", review: "Review payment", back: "Back", all: "All", sent: "Sent", received: "Received", blocked: "Blocked", pending: "Pending", search: "Search", pay: "Pay", secureAccount: "SecurePay is a demonstration prototype. No real money or banking transactions are processed." },
  hi: { home: "होम", scan: "स्कैन", history: "इतिहास", security: "सुरक्षा", profile: "प्रोफ़ाइल", send: "पैसे भेजें", request: "पैसे का अनुरोध", available: "उपलब्ध बैलेंस", quickActions: "त्वरित सेवाएँ", recent: "हाल की गतिविधि", seeAll: "सभी देखें", addMoney: "पैसे जोड़ें", scanQR: "QR स्कैन करें", payBills: "बिल भुगतान", recharge: "मोबाइल रिचार्ज", bankTransfer: "बैंक ट्रांसफर", contacts: "संपर्क", notifications: "सूचनाएँ", securityCenter: "सुरक्षा केंद्र", protected: "आपका खाता सुरक्षित है", settings: "सेटिंग्स", language: "भाषा", help: "सहायता और FAQ", continue: "जारी रखें", cancel: "रद्द करें", done: "हो गया", successful: "भुगतान सफल", risk: "जोखिम विश्लेषण", demo: "डेमो मोड", sendTo: "इन्हें भेजें", amount: "राशि", note: "नोट जोड़ें", proceed: "सुरक्षित रूप से आगे बढ़ें", low: "कम जोखिम", medium: "मध्यम जोखिम", high: "उच्च जोखिम", critical: "गंभीर जोखिम", verify: "सत्यापन जारी रखें", enterPin: "डेमो UPI PIN दर्ज करें", otp: "सत्यापन कोड", details: "लेन-देन विवरण", manage: "प्राप्तकर्ता प्रबंधित करें", logout: "लॉग आउट", faq: "अक्सर पूछे जाने वाले प्रश्न", darkMode: "डार्क मोड", balance: "बैलेंस और बैंक", profileTitle: "आपकी प्रोफ़ाइल", markRead: "सभी को पढ़ा हुआ करें", clear: "सूचनाएँ साफ़ करें", recentEvents: "हाल की सुरक्षा गतिविधि", requestSent: "भुगतान अनुरोध भेजा गया", scanTitle: "स्कैन और भुगतान", chooseRecipient: "प्राप्तकर्ता चुनें", enterUpi: "UPI ID दर्ज करें", recipient: "प्राप्तकर्ता", review: "भुगतान की समीक्षा", back: "वापस", all: "सभी", sent: "भेजे गए", received: "प्राप्त", blocked: "रोके गए", pending: "लंबित", search: "खोजें", pay: "भुगतान करें", secureAccount: "SecurePay एक डेमो प्रोटोटाइप है। कोई वास्तविक पैसा या बैंकिंग लेन-देन नहीं होता।" },
  mr: { home: "मुख्यपृष्ठ", scan: "स्कॅन", history: "इतिहास", security: "सुरक्षा", profile: "प्रोफाइल", send: "पैसे पाठवा", request: "पैशांची विनंती", available: "उपलब्ध शिल्लक", quickActions: "जलद सेवा", recent: "अलीकडील व्यवहार", seeAll: "सर्व पहा", addMoney: "पैसे जोडा", scanQR: "QR स्कॅन करा", payBills: "बिल भरा", recharge: "मोबाइल रिचार्ज", bankTransfer: "बँक ट्रान्सफर", contacts: "संपर्क", notifications: "सूचना", securityCenter: "सुरक्षा केंद्र", protected: "तुमचे खाते सुरक्षित आहे", settings: "सेटिंग्ज", language: "भाषा", help: "मदत आणि FAQ", continue: "पुढे जा", cancel: "रद्द करा", done: "पूर्ण", successful: "पेमेंट यशस्वी", risk: "जोखीम विश्लेषण", demo: "डेमो मोड", sendTo: "यांना पाठवा", amount: "रक्कम", note: "टीप जोडा", proceed: "सुरक्षितपणे पुढे जा", low: "कमी धोका", medium: "मध्यम धोका", high: "उच्च धोका", critical: "गंभीर धोका", verify: "पडताळणी सुरू ठेवा", enterPin: "डेमो UPI PIN टाका", otp: "पडताळणी कोड", details: "व्यवहार तपशील", manage: "प्राप्तकर्ता व्यवस्थापित करा", logout: "लॉग आउट", faq: "वारंवार विचारले जाणारे प्रश्न", darkMode: "डार्क मोड", balance: "शिल्लक आणि बँक", profileTitle: "तुमचे प्रोफाइल", markRead: "सर्व वाचलेले करा", clear: "सूचना साफ करा", recentEvents: "अलीकडील सुरक्षा घटना", requestSent: "पेमेंट विनंती पाठवली", scanTitle: "स्कॅन आणि पे", chooseRecipient: "प्राप्तकर्ता निवडा", enterUpi: "UPI ID टाका", recipient: "प्राप्तकर्ता", review: "पेमेंट तपासा", back: "मागे", all: "सर्व", sent: "पाठवले", received: "मिळाले", blocked: "अडवले", pending: "प्रलंबित", search: "शोधा", pay: "पेमेंट करा", secureAccount: "SecurePay हे डेमो प्रोटोटाइप आहे. वास्तविक पैसे किंवा बँक व्यवहार होत नाहीत." },
  gu: { home: "હોમ", scan: "સ્કેન", history: "ઇતિહાસ", security: "સુરક્ષા", profile: "પ્રોફાઇલ", send: "પૈસા મોકલો", request: "પૈસાની વિનંતી", available: "ઉપલબ્ધ બેલેન્સ", quickActions: "ઝડપી સેવાઓ", recent: "તાજેતરની પ્રવૃત્તિ", seeAll: "બધું જુઓ", addMoney: "પૈસા ઉમેરો", scanQR: "QR સ્કેન કરો", payBills: "બિલ ચૂકવો", recharge: "મોબાઇલ રિચાર્જ", bankTransfer: "બેંક ટ્રાન્સફર", contacts: "સંપર્કો", notifications: "સૂચનાઓ", securityCenter: "સુરક્ષા કેન્દ્ર", protected: "તમારું એકાઉન્ટ સુરક્ષિત છે", settings: "સેટિંગ્સ", language: "ભાષા", help: "મદદ અને FAQ", continue: "ચાલુ રાખો", cancel: "રદ કરો", done: "થઈ ગયું", successful: "ચુકવણી સફળ", risk: "જોખમ વિશ્લેષણ", demo: "ડેમો મોડ", sendTo: "મોકલો", amount: "રકમ", note: "નોંધ ઉમેરો", proceed: "સુરક્ષિત રીતે આગળ વધો", low: "ઓછું જોખમ", medium: "મધ્યમ જોખમ", high: "ઊંચું જોખમ", critical: "ગંભીર જોખમ", verify: "ચકાસણી ચાલુ રાખો", enterPin: "ડેમો UPI PIN દાખલ કરો", otp: "ચકાસણી કોડ", details: "વ્યવહારની વિગતો", manage: "પ્રાપ્તકર્તાઓ સંચાલિત કરો", logout: "લૉગ આઉટ", faq: "વારંવાર પૂછાતા પ્રશ્નો", darkMode: "ડાર્ક મોડ", balance: "બેલેન્સ અને બેંક", profileTitle: "તમારી પ્રોફાઇલ", markRead: "બધાને વાંચેલા કરો", clear: "સૂચનાઓ સાફ કરો", recentEvents: "તાજેતરની સુરક્ષા ઘટનાઓ", requestSent: "ચુકવણી વિનંતી મોકલાઈ", scanTitle: "સ્કેન અને પે", chooseRecipient: "પ્રાપ્તકર્તા પસંદ કરો", enterUpi: "UPI ID દાખલ કરો", recipient: "પ્રાપ્તકર્તા", review: "ચુકવણીની સમીક્ષા", back: "પાછા", all: "બધા", sent: "મોકલેલા", received: "મેળવેલા", blocked: "અટકાવેલા", pending: "બાકી", search: "શોધો", pay: "ચૂકવો", secureAccount: "SecurePay એક ડેમો પ્રોટોટાઇપ છે. કોઈ વાસ્તવિક નાણાં કે બેંક વ્યવહાર થતા નથી." },
};

export const extraTranslations: Record<Language, Record<string, string>> = {
  en: { greetingMorning: "Good morning", greetingAfternoon: "Good afternoon", greetingEvening: "Good evening", homeTagline: "Your money, moving with confidence.", securityActivity: "Security activity", active: "Active", viewSecurity: "View Security Center", exploreScenarios: "Explore demo scenarios", testRisk: "Try the adaptive risk engine", choosePaymentRecipient: "Select someone to pay or use a UPI ID.", chooseRequestRecipient: "Choose who you would like to request money from.", searchRecipient: "Search name, UPI ID, or mobile", recentKnown: "Trusted", recentNew: "New", suspicious: "Suspicious", outsideBalance: "Amount is higher than your available demo balance.", enterAmountError: "Enter an amount greater than ₹0.", checkingPayment: "Securing your payment...", analysisDone: "Security analysis complete", whyRisk: "Why this risk level?", riskRequired: "Required verification", accountProtected: "Your account is protected", systemsActive: "ALL SYSTEMS ACTIVE", riskDetection: "Risk Detection", adaptiveVerification: "Adaptive Verification", deviceProtection: "Device Protection", fraudAlerts: "Fraud Alerts", dateAny: "Any date", amountAny: "Any amount", allRisk: "All risk levels", personalDetails: "Personal details", bankAccounts: "Bank accounts", securitySettings: "Security settings", demoBalance: "Available demo balance", verifyBiometric: "Verify with Biometrics", useDemoCode: "Use code", markAllRead: "Mark all as read" },
  hi: { greetingMorning: "सुप्रभात", greetingAfternoon: "नमस्कार", greetingEvening: "शुभ संध्या", homeTagline: "आपका पैसा, भरोसे के साथ।", securityActivity: "सुरक्षा गतिविधि", active: "सक्रिय", viewSecurity: "सुरक्षा केंद्र देखें", exploreScenarios: "डेमो परिदृश्य देखें", testRisk: "जोखिम इंजन आज़माएँ", choosePaymentRecipient: "भुगतान के लिए संपर्क चुनें या UPI ID दर्ज करें।", chooseRequestRecipient: "पैसे का अनुरोध करने के लिए संपर्क चुनें।", searchRecipient: "नाम, UPI ID या मोबाइल खोजें", recentKnown: "विश्वसनीय", recentNew: "नया", suspicious: "संदिग्ध", outsideBalance: "राशि आपके उपलब्ध डेमो बैलेंस से अधिक है।", enterAmountError: "₹0 से अधिक राशि दर्ज करें।", checkingPayment: "आपका भुगतान सुरक्षित किया जा रहा है...", analysisDone: "सुरक्षा विश्लेषण पूरा", whyRisk: "यह जोखिम स्तर क्यों?", riskRequired: "आवश्यक सत्यापन", accountProtected: "आपका खाता सुरक्षित है", systemsActive: "सभी सिस्टम सक्रिय", riskDetection: "जोखिम पहचान", adaptiveVerification: "अनुकूल सत्यापन", deviceProtection: "डिवाइस सुरक्षा", fraudAlerts: "धोखाधड़ी अलर्ट", dateAny: "कोई भी तारीख", amountAny: "कोई भी राशि", allRisk: "सभी जोखिम स्तर", personalDetails: "व्यक्तिगत जानकारी", bankAccounts: "बैंक खाते", securitySettings: "सुरक्षा सेटिंग्स", demoBalance: "उपलब्ध डेमो बैलेंस", verifyBiometric: "बायोमेट्रिक्स से सत्यापित करें", useDemoCode: "कोड इस्तेमाल करें", markAllRead: "सभी पढ़े हुए करें" },
  mr: { greetingMorning: "शुभ सकाळ", greetingAfternoon: "नमस्कार", greetingEvening: "शुभ संध्याकाळ", homeTagline: "तुमचे पैसे, विश्वासाने पुढे.", securityActivity: "सुरक्षा गतिविधी", active: "सक्रिय", viewSecurity: "सुरक्षा केंद्र पहा", exploreScenarios: "डेमो परिस्थिती पहा", testRisk: "जोखीम इंजिन वापरून पहा", choosePaymentRecipient: "पेमेंटसाठी संपर्क निवडा किंवा UPI ID वापरा.", chooseRequestRecipient: "पैशांची विनंती करण्यासाठी संपर्क निवडा.", searchRecipient: "नाव, UPI ID किंवा मोबाइल शोधा", recentKnown: "विश्वासार्ह", recentNew: "नवीन", suspicious: "संशयास्पद", outsideBalance: "रक्कम उपलब्ध डेमो शिल्लकीपेक्षा जास्त आहे.", enterAmountError: "₹0 पेक्षा जास्त रक्कम टाका.", checkingPayment: "तुमचे पेमेंट सुरक्षित करत आहोत...", analysisDone: "सुरक्षा विश्लेषण पूर्ण", whyRisk: "हा जोखीम स्तर का?", riskRequired: "आवश्यक पडताळणी", accountProtected: "तुमचे खाते सुरक्षित आहे", systemsActive: "सर्व प्रणाली सक्रिय", riskDetection: "जोखीम शोध", adaptiveVerification: "अनुकूली पडताळणी", deviceProtection: "डिव्हाइस सुरक्षा", fraudAlerts: "फसवणूक सूचना", dateAny: "कोणतीही तारीख", amountAny: "कोणतीही रक्कम", allRisk: "सर्व जोखीम स्तर", personalDetails: "वैयक्तिक तपशील", bankAccounts: "बँक खाती", securitySettings: "सुरक्षा सेटिंग्ज", demoBalance: "उपलब्ध डेमो शिल्लक", verifyBiometric: "बायोमेट्रिक्सने पडताळा", useDemoCode: "कोड वापरा", markAllRead: "सर्व वाचलेले करा" },
  gu: { greetingMorning: "સુપ્રഭાત", greetingAfternoon: "નમસ્તે", greetingEvening: "શુભ સાંજ", homeTagline: "તમારા પૈસા, વિશ્વાસ સાથે આગળ.", securityActivity: "સુરક્ષા પ્રવૃત્તિ", active: "સક્રિય", viewSecurity: "સુરક્ષા કેન્દ્ર જુઓ", exploreScenarios: "ડેમો પરિસ્થિતિઓ જુઓ", testRisk: "રિસ્ક એન્જિન અજમાવો", choosePaymentRecipient: "ચુકવણી માટે સંપર્ક પસંદ કરો અથવા UPI ID દાખલ કરો.", chooseRequestRecipient: "પૈસાની વિનંતી કરવા માટે સંપર્ક પસંદ કરો.", searchRecipient: "નામ, UPI ID અથવા મોબાઇલ શોધો", recentKnown: "વિશ્વસનીય", recentNew: "નવું", suspicious: "શંકાસ્પદ", outsideBalance: "રકમ તમારા ઉપલબ્ધ ડેમો બેલેન્સ કરતાં વધુ છે.", enterAmountError: "₹0 કરતાં વધુ રકમ દાખલ કરો.", checkingPayment: "તમારી ચુકવણી સુરક્ષિત થઈ રહી છે...", analysisDone: "સુરક્ષા વિશ્લેષણ પૂર્ણ", whyRisk: "આ જોખમ સ્તર શા માટે?", riskRequired: "જરૂરી ચકાસણી", accountProtected: "તમારું એકાઉન્ટ સુરક્ષિત છે", systemsActive: "બધી સિસ્ટમ સક્રિય", riskDetection: "જોખમ શોધ", adaptiveVerification: "અનુકૂલનશીલ ચકાસણી", deviceProtection: "ઉપકરણ સુરક્ષા", fraudAlerts: "છેતરપિંડી ચેતવણીઓ", dateAny: "કોઈપણ તારીખ", amountAny: "કોઈપણ રકમ", allRisk: "બધા જોખમ સ્તરો", personalDetails: "વ્યક્તિગત વિગતો", bankAccounts: "બેંક खातાઓ", securitySettings: "સુરક્ષા સેટિંગ્સ", demoBalance: "ઉપલબ્ધ ડેમો બેલેન્સ", verifyBiometric: "બાયોમેટ્રિકથી ચકાસો", useDemoCode: "કોડ વાપરો", markAllRead: "બધાને વાંચેલા કરો" },
};

export function useApp() { return useContext(AppContext); }

export const money = (n: number) => `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const relativeTime = (date: string) => {
  const m = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
  return m < 1 ? "Just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)} hr ago` : new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

export const riskFactorSummary = (factors: Factor[] = []) => factors.length ? factors.map(f => f.label).join(", ") : "No additional risk factors";
export const riskStatusBadge = (level: RiskLevel, score: number) => `${level} • ${score}`;

export function riskName(level: RiskLevel, t: (key: string) => string) { return t(level.toLowerCase()); }

export function calcRisk(draft: Draft, data: AppData) {
  let score = 0;
  const factors: Factor[] = [];
  const add = (label: string, points: number) => {
    if (points) {
      score += points;
      factors.push({ label, points });
    }
  };
  const amount = draft.amount;
  add("Amount above ₹25,000", amount > 25000 ? 30 : 0);
  add("Amount ₹10,001–₹25,000", amount > 10000 && amount <= 25000 ? 20 : 0);
  add("Amount ₹2,001–₹10,000", amount > 2000 && amount <= 10000 ? 10 : 0);
  const rec = draft.recipient;
  add("New recipient", rec.trusted || data.recipients.some(r => r.upiId.toLowerCase() === rec.upiId.toLowerCase() && r.trusted) ? 0 : 20);
  const hour = draft.signals?.timeOverride ?? new Date().getHours();
  add("Unusual transaction time", hour >= 23 || hour < 6 ? 15 : 0);
  add("New or unrecognized device", draft.signals?.newDevice ? 20 : 0);
  add("Unusual location", draft.signals?.unusualLocation ? 15 : 0);
  const recentCount = draft.signals?.recentCount ?? data.transactions.filter(t => t.type === "sent" && Date.now() - new Date(t.timestamp).getTime() < 3600000).length;
  add("Rapid repeated transactions", recentCount >= 5 ? 20 : recentCount >= 3 ? 10 : 0);
  add("Suspicious recipient", rec.riskLevel === "suspicious" ? 25 : rec.riskLevel === "unknown" ? 10 : 0);
  add("Outside your usual transaction range", amount > 10000 ? 10 : 0);
  const value = Math.min(100, score);
  const level: RiskLevel = value >= 80 ? "CRITICAL" : value >= 60 ? "HIGH" : value >= 30 ? "MEDIUM" : "LOW";
  return { score: value, level, factors, verification: level === "LOW" ? ["UPI PIN"] : level === "MEDIUM" ? ["UPI PIN", "OTP"] : ["UPI PIN", "OTP", "Biometric"] };
}

export function PageHeading({ eyebrow, title, subtitle, back }: { eyebrow?: string; title: string; subtitle?: string; back?: boolean }) {
  const { navigate, t } = useApp();
  return <div className="page-heading">{back && <button className="back-button" onClick={() => navigate(-1)}><ArrowLeft size={17} />{t("back")}</button>}{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>;
}

export function Avatar({ name, tone = "mint" }: { name: string; tone?: string }) {
  const initials = name.split(" ").map(w => w[0]).slice(0, 2).join("");
  return <div className={`avatar avatar-${tone}`}>{initials}</div>;
}

export function Button({ children, onClick, variant = "primary", disabled = false, className = "", type = "button" }: any) {
  return <button type={type} disabled={disabled} onClick={onClick} className={`btn btn-${variant} ${className}`}>{children}</button>;
}

export function SectionHeading({ title, action, onClick }: any) {
  return <div className="section-heading"><h2>{title}</h2>{action && <button onClick={onClick}>{action}<ChevronRight size={15} /></button>}</div>;
}

export function DemoDisclaimer() {
  const { t } = useApp();
  return <p className="disclaimer">{t("secureAccount")}</p>;
}

export function LandmarkIcon() { return <CreditCard size={17} />; }

export function QuickAction({ icon, label, color, onClick }: any) {
  return <button className="quick-action" onClick={onClick}><span className={`quick-icon ${color}`}>{icon}</span><small>{label}</small></button>;
}

export function TransactionRow({ tx, onClick }: { tx: Transaction; onClick: () => void }) {
  const incoming = tx.type === "received";
  const statusText = incoming ? "Received" : tx.status === "blocked" ? "Blocked" : tx.type === "request" ? "Request" : "Paid";
  const riskText = tx.status === "blocked" ? `${tx.riskLevel} • ${tx.riskScore}` : `${tx.riskLevel} risk`;
  return <button className="transaction-row" onClick={onClick}><span className={`transaction-icon ${incoming ? "received" : tx.status === "blocked" ? "blocked" : "sent"}`}>{incoming ? <ArrowDownLeft size={17} /> : tx.status === "blocked" ? <ShieldAlert size={17} /> : <ArrowUpRight size={17} />}</span><span className="transaction-name"><b>{incoming ? tx.sender : tx.receiver}</b><small>{relativeTime(tx.timestamp)} · {statusText}</small></span><span className={`transaction-value ${incoming ? "positive" : ""}`}>{incoming ? "+" : "−"}{money(tx.amount)}<small className={`risk-text ${tx.riskLevel.toLowerCase()}`}>{riskText}</small></span><ChevronRight size={16} className="row-chevron" /></button>;
}

export function DetailLine({ label, value, mono = false }: any) {
  return <div className="detail-line"><span>{label}</span><b className={mono ? "mono" : ""}>{value}</b></div>;
}

export function EmptyState({ icon, title, description, action, actionText }: any) {
  return <div className="empty-state"><span>{icon}</span><h3>{title}</h3><p>{description}</p>{action && <Button variant="outline" onClick={action}>{actionText}</Button>}</div>;
}

export function SettingToggle({ icon, title, description, enabled, onClick }: any) {
  return <button className="setting-row toggle-row" onClick={onClick}><span className="setting-icon">{icon}</span><span><b>{title}</b><small>{description}</small></span><span className={`switch ${enabled ? "checked" : ""}`}><i /></span></button>;
}

export function AtIcon() { return <span className="at-symbol">@</span>; }
