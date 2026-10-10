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

export const supplementalTranslations: Record<Language, Record<string, string>> = {
  en: {
    tryAgainIn: "Try again in", invalidRecipient: "Add a name and valid UPI ID.", duplicateRecipient: "This UPI ID is already saved.", selectReportReason: "Please select a reason.", invalidUpiExample: "Enter a valid UPI ID, like name@securepay.", invalidUpi: "Enter a valid UPI ID.", mobileTooShort: "Enter a 10-digit Indian mobile number.", mobileInvalid: "Enter a valid 10-digit Indian mobile number.", mobileNotFound: "Mobile number not found.", invalidLoginMobile: "Enter a valid 10-digit mobile number.", invalidDemoPin: "Incorrect demo PIN. Please try again.", pinLocked: "Too many attempts. Verification is locked for 30 seconds.", invalidDemoOtp: "Incorrect demo OTP. Try 123456.", criticalOtpBlocked: "Verification failed. This critical-risk payment has been blocked.", riskCriticalTitle: "Transaction temporarily blocked", riskCriticalBody: "Multiple unusual signals need extra review before this payment can continue.", verifyReview: "Verify & Review", cancelTransaction: "Cancel transaction", securityExcellent: "Excellent", securityDemoDescription: "Your demo account is protected by adaptive risk detection.", viewSecurityActivity: "View security activity", paymentScored: "Every payment is scored before it proceeds.", verificationScaled: "Verification scales with transaction risk.", deviceSignals: "Unrecognized device signals are evaluated.", suspiciousRecorded: "Suspicious activity is recorded locally.", riskEngineTitle: "Try the adaptive risk engine", riskScenarioDescription: "Choose a test scenario in Settings → Developer Demo Controls.", openSettings: "Open settings", fullActivity: "Full activity",
  },
  hi: {
    tryAgainIn: "फिर से कोशिश करें", invalidRecipient: "नाम और मान्य UPI ID दर्ज करें।", duplicateRecipient: "यह UPI ID पहले से सहेजी गई है।", selectReportReason: "कृपया एक कारण चुनें।", invalidUpiExample: "एक मान्य UPI ID दर्ज करें, जैसे name@securepay।", invalidUpi: "एक मान्य UPI ID दर्ज करें।", mobileTooShort: "10 अंकों का भारतीय मोबाइल नंबर दर्ज करें।", mobileInvalid: "मान्य 10 अंकों का भारतीय मोबाइल नंबर दर्ज करें।", mobileNotFound: "मोबाइल नंबर नहीं मिला।", invalidLoginMobile: "मान्य 10 अंकों का मोबाइल नंबर दर्ज करें।", invalidDemoPin: "डेमो PIN गलत है। फिर से कोशिश करें।", pinLocked: "बहुत अधिक प्रयास हुए। सत्यापन 30 सेकंड के लिए लॉक है।", invalidDemoOtp: "डेमो OTP गलत है। 123456 आज़माएँ।", criticalOtpBlocked: "सत्यापन विफल हुआ। गंभीर जोखिम वाला यह भुगतान रोक दिया गया है।", riskCriticalTitle: "लेन-देन अस्थायी रूप से रोका गया", riskCriticalBody: "कई असामान्य संकेतों के कारण इस भुगतान को आगे बढ़ाने से पहले अतिरिक्त समीक्षा आवश्यक है।", verifyReview: "सत्यापित करें और समीक्षा करें", cancelTransaction: "लेन-देन रद्द करें", securityExcellent: "उत्कृष्ट", securityDemoDescription: "आपका डेमो खाता अनुकूल जोखिम पहचान से सुरक्षित है।", viewSecurityActivity: "सुरक्षा गतिविधि देखें", paymentScored: "आगे बढ़ने से पहले हर भुगतान का जोखिम स्कोर किया जाता है।", verificationScaled: "सत्यापन लेन-देन के जोखिम के अनुसार बदलता है।", deviceSignals: "अपरिचित डिवाइस संकेतों का मूल्यांकन किया जाता है।", suspiciousRecorded: "संदिग्ध गतिविधि स्थानीय रूप से दर्ज की जाती है।", riskEngineTitle: "अनुकूल जोखिम इंजन आज़माएँ", riskScenarioDescription: "Settings → Developer Demo Controls में एक परीक्षण परिदृश्य चुनें।", openSettings: "सेटिंग्स खोलें", fullActivity: "पूरी गतिविधि",
  },
  mr: {
    tryAgainIn: "पुन्हा प्रयत्न करा", invalidRecipient: "नाव आणि वैध UPI ID टाका.", duplicateRecipient: "हा UPI ID आधीच जतन केला आहे.", selectReportReason: "कृपया कारण निवडा.", invalidUpiExample: "name@securepay सारखा वैध UPI ID टाका.", invalidUpi: "वैध UPI ID टाका.", mobileTooShort: "10 अंकी भारतीय मोबाइल क्रमांक टाका.", mobileInvalid: "वैध 10 अंकी भारतीय मोबाइल क्रमांक टाका.", mobileNotFound: "मोबाइल क्रमांक सापडला नाही.", invalidLoginMobile: "वैध 10 अंकी मोबाइल क्रमांक टाका.", invalidDemoPin: "डेमो PIN चुकीचा आहे. पुन्हा प्रयत्न करा.", pinLocked: "अनेक प्रयत्न झाले. पडताळणी 30 सेकंदांसाठी लॉक केली आहे.", invalidDemoOtp: "डेमो OTP चुकीचा आहे. 123456 वापरून पहा.", criticalOtpBlocked: "पडताळणी अयशस्वी. गंभीर-जोखीम व्यवहार थांबवला आहे.", riskCriticalTitle: "व्यवहार तात्पुरता थांबवला", riskCriticalBody: "अनेक असामान्य संकेतांमुळे हा पेमेंट पुढे जाण्यापूर्वी अतिरिक्त तपासणी आवश्यक आहे.", verifyReview: "पडताळा आणि पुनरावलोकन करा", cancelTransaction: "व्यवहार रद्द करा", securityExcellent: "उत्कृष्ट", securityDemoDescription: "तुमचे डेमो खाते अनुकूली जोखीम शोधाद्वारे सुरक्षित आहे.", viewSecurityActivity: "सुरक्षा गतिविधी पहा", paymentScored: "प्रत्येक पेमेंट पुढे जाण्यापूर्वी जोखीम गुणांकन केले जाते.", verificationScaled: "पडताळणी व्यवहाराच्या जोखमीनुसार बदलते.", deviceSignals: "अनोळखी डिव्हाइस संकेतांचे मूल्यांकन केले जाते.", suspiciousRecorded: "संशयास्पद गतिविधी स्थानिकरित्या नोंदवली जाते.", riskEngineTitle: "अनुकूली जोखीम इंजिन वापरून पहा", riskScenarioDescription: "Settings → Developer Demo Controls मधून चाचणी परिस्थिती निवडा.", openSettings: "सेटिंग्ज उघडा", fullActivity: "संपूर्ण गतिविधी",
  },
  gu: {
    tryAgainIn: "ફરી પ્રયાસ કરો", invalidRecipient: "નામ અને માન્ય UPI ID દાખલ કરો.", duplicateRecipient: "આ UPI ID પહેલેથી સાચવેલું છે.", selectReportReason: "કૃપા કરીને કારણ પસંદ કરો.", invalidUpiExample: "name@securepay જેવું માન્ય UPI ID દાખલ કરો.", invalidUpi: "માન્ય UPI ID દાખલ કરો.", mobileTooShort: "10 અંકનો ભારતીય મોબાઇલ નંબર દાખલ કરો.", mobileInvalid: "માન્ય 10 અંકનો ભારતીય મોબાઇલ નંબર દાખલ કરો.", mobileNotFound: "મોબાઇલ નંબર મળ્યો નથી.", invalidLoginMobile: "માન્ય 10 અંકનો મોબાઇલ નંબર દાખલ કરો.", invalidDemoPin: "ડેમો PIN ખોટો છે. ફરી પ્રયાસ કરો.", pinLocked: "ઘણા પ્રયાસો થયા. ચકાસણી 30 સેકન્ડ માટે લૉક છે.", invalidDemoOtp: "ડેમો OTP ખોટો છે. 123456 અજમાવો.", criticalOtpBlocked: "ચકાસણી નિષ્ફળ. ગંભીર જોખમવાળી આ ચુકવણી અટકાવવામાં આવી છે.", riskCriticalTitle: "વ્યવહાર અસ્થાયી રૂપે અટકાવ્યો", riskCriticalBody: "અનેક અસામાન્ય સંકેતોને કારણે આ ચુકવણી આગળ વધે તે પહેલાં વધારાની સમીક્ષા જરૂરી છે.", verifyReview: "ચકાસો અને સમીક્ષા કરો", cancelTransaction: "વ્યવહાર રદ કરો", securityExcellent: "ઉત્કૃષ્ટ", securityDemoDescription: "તમારું ડેમો ખાતું અનુકૂલનશીલ જોખમ શોધથી સુરક્ષિત છે.", viewSecurityActivity: "સુરક્ષા પ્રવૃત્તિ જુઓ", paymentScored: "આગળ વધે તે પહેલાં દરેક ચુકવણીનું જોખમ મૂલ્યાંકન થાય છે.", verificationScaled: "ચકાસણી વ્યવહારના જોખમ પ્રમાણે બદલાય છે.", deviceSignals: "અજાણ્યા ઉપકરણના સંકેતોનું મૂલ્યાંકન થાય છે.", suspiciousRecorded: "શંકાસ્પદ પ્રવૃત્તિ સ્થાનિક રીતે નોંધાય છે.", riskEngineTitle: "અનુકૂલનશીલ જોખમ એન્જિન અજમાવો", riskScenarioDescription: "Settings → Developer Demo Controls માં પરીક્ષણ પરિસ્થિતિ પસંદ કરો.", openSettings: "સેટિંગ્સ ખોલો", fullActivity: "સંપૂર્ણ પ્રવૃત્તિ",
  },
};

export const passwordStrengthTranslations: Record<Language, Record<string, string>> = {
  en: {
    passwordCheckerOpen: "Check password strength",
    passwordCheckerTitle: "Password strength checker",
    passwordCheckerInstructions: "Check a password on this device. Use a sample password, not one you use for banking.",
    passwordCheckerLabel: "Enter a sample password",
    passwordCheckerPlaceholder: "Type a password to check",
    passwordCheckerCheck: "Check Strength",
    passwordCheckerClear: "Clear",
    passwordCheckerShow: "Show password",
    passwordCheckerHide: "Hide password",
    passwordCheckerClose: "Close checker",
    passwordCheckerPrivacy: "Checked only in this browser. Your password is not sent or saved, and is cleared after checking.",
    passwordCheckerEmpty: "Enter a sample password first.",
    passwordCheckerStrength: "Strength",
    passwordCheckerExplanation: "Why this rating",
    passwordCheckerRecommendations: "Ways to make it stronger",
    passwordStrengthVeryWeak: "Very Weak",
    passwordStrengthWeak: "Weak",
    passwordStrengthModerate: "Moderate",
    passwordStrengthStrong: "Strong",
    passwordStrengthVeryStrong: "Very Strong",
    passwordReasonShort: "It has {length} characters. Longer passwords are harder to guess.",
    passwordReasonMedium: "It has {length} characters. A little more length can help.",
    passwordReasonLong: "Its length ({length} characters) helps make it harder to guess.",
    passwordReasonMix: "It uses {types} of 4 character types. A mix can help.",
    passwordReasonCommon: "It contains a word or pattern that people often guess.",
    passwordReasonSequence: "It contains a predictable sequence, such as 1234 or abcd.",
    passwordReasonRepeated: "It repeats the same character several times.",
    passwordReasonGood: "It has good length and a useful mix of characters.",
    passwordRecLonger: "Use a longer password.",
    passwordRecMix: "Add a mix of capital letters, small letters, numbers, or symbols.",
    passwordRecCommon: "Avoid common words and familiar password patterns.",
    passwordRecSequence: "Avoid predictable sequences, such as 1234 or abcd.",
    passwordRecRepeated: "Avoid repeating the same character many times.",
    passwordRecUnique: "Use a unique passphrase that you do not reuse elsewhere.",
  },
  hi: {
    passwordCheckerOpen: "पासवर्ड की मजबूती जाँचें",
    passwordCheckerTitle: "पासवर्ड मजबूती जाँच",
    passwordCheckerInstructions: "इस डिवाइस पर पासवर्ड जाँचें। बैंकिंग में इस्तेमाल होने वाला पासवर्ड नहीं, कोई नमूना पासवर्ड लें।",
    passwordCheckerLabel: "नमूना पासवर्ड दर्ज करें",
    passwordCheckerPlaceholder: "जाँचने के लिए पासवर्ड लिखें",
    passwordCheckerCheck: "मजबूती जाँचें",
    passwordCheckerClear: "मिटाएँ",
    passwordCheckerShow: "पासवर्ड दिखाएँ",
    passwordCheckerHide: "पासवर्ड छिपाएँ",
    passwordCheckerClose: "जाँच बंद करें",
    passwordCheckerPrivacy: "जाँच केवल इसी ब्राउज़र में होती है। पासवर्ड न भेजा जाता है, न सहेजा जाता है, और जाँच के बाद मिट जाता है।",
    passwordCheckerEmpty: "पहले नमूना पासवर्ड दर्ज करें।",
    passwordCheckerStrength: "मजबूती",
    passwordCheckerExplanation: "यह रेटिंग क्यों",
    passwordCheckerRecommendations: "इसे और मजबूत बनाने के तरीके",
    passwordStrengthVeryWeak: "बहुत कमजोर",
    passwordStrengthWeak: "कमजोर",
    passwordStrengthModerate: "मध्यम",
    passwordStrengthStrong: "मजबूत",
    passwordStrengthVeryStrong: "बहुत मजबूत",
    passwordReasonShort: "इसमें {length} अक्षर हैं। लंबे पासवर्ड का अनुमान लगाना कठिन होता है।",
    passwordReasonMedium: "इसमें {length} अक्षर हैं। थोड़ी और लंबाई मदद कर सकती है।",
    passwordReasonLong: "इसकी लंबाई ({length} अक्षर) अनुमान लगाना कठिन बनाती है।",
    passwordReasonMix: "इसमें 4 में से {types} तरह के अक्षर हैं। मिलावट मदद कर सकती है।",
    passwordReasonCommon: "इसमें ऐसा शब्द या तरीका है जिसका लोग अक्सर अनुमान लगा लेते हैं।",
    passwordReasonSequence: "इसमें अनुमान लगाने योग्य क्रम है, जैसे 1234 या abcd।",
    passwordReasonRepeated: "इसमें एक ही अक्षर कई बार दोहराया गया है।",
    passwordReasonGood: "इसकी लंबाई अच्छी है और अक्षरों का उपयोगी मिश्रण है।",
    passwordRecLonger: "और लंबा पासवर्ड इस्तेमाल करें।",
    passwordRecMix: "बड़े अक्षर, छोटे अक्षर, अंक या चिह्न मिलाकर इस्तेमाल करें।",
    passwordRecCommon: "आम शब्दों और पहचाने जाने वाले पासवर्ड तरीकों से बचें।",
    passwordRecSequence: "1234 या abcd जैसे अनुमानित क्रम से बचें।",
    passwordRecRepeated: "एक ही अक्षर को कई बार दोहराने से बचें।",
    passwordRecUnique: "ऐसा अलग पासफ्रेज़ इस्तेमाल करें जिसे कहीं और दोबारा न इस्तेमाल करें।",
  },
  mr: {
    passwordCheckerOpen: "पासवर्डची मजबुती तपासा",
    passwordCheckerTitle: "पासवर्ड मजबुती तपासणी",
    passwordCheckerInstructions: "या डिव्हाइसवर पासवर्ड तपासा. बँकिंगसाठी वापरत असलेला पासवर्ड न वापरता नमुना पासवर्ड वापरा.",
    passwordCheckerLabel: "नमुना पासवर्ड टाका",
    passwordCheckerPlaceholder: "तपासण्यासाठी पासवर्ड लिहा",
    passwordCheckerCheck: "मजबुती तपासा",
    passwordCheckerClear: "पुसून टाका",
    passwordCheckerShow: "पासवर्ड दाखवा",
    passwordCheckerHide: "पासवर्ड लपवा",
    passwordCheckerClose: "तपासणी बंद करा",
    passwordCheckerPrivacy: "तपासणी फक्त याच ब्राउझरमध्ये होते. पासवर्ड पाठवला किंवा साठवला जात नाही आणि तपासणीनंतर पुसला जातो.",
    passwordCheckerEmpty: "आधी नमुना पासवर्ड टाका.",
    passwordCheckerStrength: "मजबुती",
    passwordCheckerExplanation: "हे मूल्यांकन का",
    passwordCheckerRecommendations: "अधिक मजबूत करण्याचे उपाय",
    passwordStrengthVeryWeak: "अतिशय कमकुवत",
    passwordStrengthWeak: "कमकुवत",
    passwordStrengthModerate: "मध्यम",
    passwordStrengthStrong: "मजबूत",
    passwordStrengthVeryStrong: "अतिशय मजबूत",
    passwordReasonShort: "यात {length} अक्षरे आहेत. लांब पासवर्डचा अंदाज लावणे कठीण असते.",
    passwordReasonMedium: "यात {length} अक्षरे आहेत. थोडी अधिक लांबी मदत करू शकते.",
    passwordReasonLong: "याची लांबी ({length} अक्षरे) अंदाज लावणे कठीण करते.",
    passwordReasonMix: "यात 4 पैकी {types} प्रकारची अक्षरे आहेत. विविधता मदत करू शकते.",
    passwordReasonCommon: "यात लोक सहज ओळखू शकतील असा शब्द किंवा पद्धत आहे.",
    passwordReasonSequence: "यात 1234 किंवा abcd सारखा अंदाज लावता येणारा क्रम आहे.",
    passwordReasonRepeated: "यात तेच अक्षर अनेकदा पुन्हा आले आहे.",
    passwordReasonGood: "याची लांबी चांगली आहे आणि अक्षरांचे उपयुक्त मिश्रण आहे.",
    passwordRecLonger: "अधिक लांब पासवर्ड वापरा.",
    passwordRecMix: "मोठी अक्षरे, लहान अक्षरे, अंक किंवा चिन्हे यांचे मिश्रण वापरा.",
    passwordRecCommon: "सामान्य शब्द आणि ओळखता येणाऱ्या पासवर्ड पद्धती टाळा.",
    passwordRecSequence: "1234 किंवा abcd सारखे अंदाज लावता येणारे क्रम टाळा.",
    passwordRecRepeated: "तेच अक्षर अनेकदा पुन्हा वापरणे टाळा.",
    passwordRecUnique: "इतरत्र न वापरलेला स्वतंत्र पासफ्रेज वापरा.",
  },
  gu: {
    passwordCheckerOpen: "પાસવર્ડની મજબૂતી તપાસો",
    passwordCheckerTitle: "પાસવર્ડ મજબૂતી તપાસ",
    passwordCheckerInstructions: "આ ઉપકરણ પર પાસવર્ડ તપાસો. બેંકિંગમાં વાપરતા પાસવર્ડને બદલે નમૂનાનો પાસવર્ડ વાપરો.",
    passwordCheckerLabel: "નમૂનાનો પાસવર્ડ દાખલ કરો",
    passwordCheckerPlaceholder: "તપાસવા માટે પાસવર્ડ લખો",
    passwordCheckerCheck: "મજબૂતી તપાસો",
    passwordCheckerClear: "સાફ કરો",
    passwordCheckerShow: "પાસવર્ડ બતાવો",
    passwordCheckerHide: "પાસવર્ડ છુપાવો",
    passwordCheckerClose: "તપાસ બંધ કરો",
    passwordCheckerPrivacy: "તપાસ ફક્ત આ બ્રાઉઝરમાં થાય છે. પાસવર્ડ મોકલાતો કે સાચવાતો નથી અને તપાસ્યા પછી ભૂંસી નાખવામાં આવે છે.",
    passwordCheckerEmpty: "પહેલાં નમૂનાનો પાસવર્ડ દાખલ કરો.",
    passwordCheckerStrength: "મજબૂતી",
    passwordCheckerExplanation: "આ રેટિંગ શા માટે",
    passwordCheckerRecommendations: "વધુ મજબૂત બનાવવાના ઉપાયો",
    passwordStrengthVeryWeak: "ખૂબ નબળો",
    passwordStrengthWeak: "નબળો",
    passwordStrengthModerate: "મધ્યમ",
    passwordStrengthStrong: "મજબૂત",
    passwordStrengthVeryStrong: "ખૂબ મજબૂત",
    passwordReasonShort: "તેમાં {length} અક્ષરો છે. લાંબા પાસવર્ડનો અંદાજ લગાવવો મુશ્કેલ હોય છે.",
    passwordReasonMedium: "તેમાં {length} અક્ષરો છે. થોડી વધુ લંબાઈ મદદરૂપ થઈ શકે.",
    passwordReasonLong: "તેની લંબાઈ ({length} અક્ષરો) અંદાજ લગાવવો મુશ્કેલ બનાવે છે.",
    passwordReasonMix: "તેમાં 4 માંથી {types} પ્રકારના અક્ષરો છે. મિશ્રણ મદદરૂપ થઈ શકે.",
    passwordReasonCommon: "તેમાં એવો શબ્દ કે રીત છે જેનો લોકો ઘણીવાર અંદાજ લગાવી શકે.",
    passwordReasonSequence: "તેમાં 1234 અથવા abcd જેવો અનુમાન કરી શકાય એવો ક્રમ છે.",
    passwordReasonRepeated: "તેમાં એક જ અક્ષર ઘણી વાર પુનરાવર્તિત થાય છે.",
    passwordReasonGood: "તેની લંબાઈ સારી છે અને અક્ષરોનું ઉપયોગી મિશ્રણ છે.",
    passwordRecLonger: "વધુ લાંબો પાસવર્ડ વાપરો.",
    passwordRecMix: "મોટા અક્ષરો, નાના અક્ષરો, અંકો અથવા ચિહ્નોનું મિશ્રણ ઉમેરો.",
    passwordRecCommon: "સામાન્ય શબ્દો અને ઓળખીતા પાસવર્ડના ઢાંચા ટાળો.",
    passwordRecSequence: "1234 અથવા abcd જેવા અનુમાન કરી શકાય એવા ક્રમ ટાળો.",
    passwordRecRepeated: "એક જ અક્ષર વારંવાર વાપરવાનું ટાળો.",
    passwordRecUnique: "બીજે ક્યાંય ન વાપરેલો અનન્ય પાસફ્રેઝ વાપરો.",
  },
};

export const riskFactorTranslations: Record<Language, Record<string, string>> = {
  en: {
    "Amount above ₹25,000": "Amount above ₹25,000", "Amount ₹10,001–₹25,000": "Amount ₹10,001–₹25,000", "Amount ₹2,001–₹10,000": "Amount ₹2,001–₹10,000", "New recipient": "New recipient", "Unusual transaction time": "Unusual transaction time", "New or unrecognized device": "New or unrecognized device", "Unusual location": "Unusual location", "Rapid repeated transactions": "Rapid repeated transactions", "Suspicious recipient": "Suspicious recipient", "Outside your usual transaction range": "Outside your usual transaction range",
  },
  hi: {
    "Amount above ₹25,000": "₹25,000 से अधिक राशि", "Amount ₹10,001–₹25,000": "₹10,001–₹25,000 की राशि", "Amount ₹2,001–₹10,000": "₹2,001–₹10,000 की राशि", "New recipient": "नया प्राप्तकर्ता", "Unusual transaction time": "लेन-देन का असामान्य समय", "New or unrecognized device": "नया या अपरिचित डिवाइस", "Unusual location": "असामान्य स्थान", "Rapid repeated transactions": "तेज़ी से बार-बार लेन-देन", "Suspicious recipient": "संदिग्ध प्राप्तकर्ता", "Outside your usual transaction range": "आपकी सामान्य लेन-देन सीमा से बाहर",
  },
  mr: {
    "Amount above ₹25,000": "₹25,000 पेक्षा जास्त रक्कम", "Amount ₹10,001–₹25,000": "₹10,001–₹25,000 रक्कम", "Amount ₹2,001–₹10,000": "₹2,001–₹10,000 रक्कम", "New recipient": "नवीन प्राप्तकर्ता", "Unusual transaction time": "व्यवहाराची असामान्य वेळ", "New or unrecognized device": "नवीन किंवा अपरिचित डिव्हाइस", "Unusual location": "अपरिचित ठिकाण", "Rapid repeated transactions": "जलदगतीने वारंवार होणारे व्यवहार", "Suspicious recipient": "संशयास्पद प्राप्तकर्ता", "Outside your usual transaction range": "तुमच्या नेहमीच्या व्यवहार मर्यादेबाहेर",
  },
  gu: {
    "Amount above ₹25,000": "₹25,000થી વધુ રકમ", "Amount ₹10,001–₹25,000": "₹10,001–₹25,000ની રકમ", "Amount ₹2,001–₹10,000": "₹2,001–₹10,000ની રકમ", "New recipient": "નવો પ્રાપ્તકર્તા", "Unusual transaction time": "વ્યવહારનો અસામાન્ય સમય", "New or unrecognized device": "નવું અથવા અજાણ્યું ઉપકરણ", "Unusual location": "અસામાન્ય સ્થાન", "Rapid repeated transactions": "ઝડપથી વારંવાર થતા વ્યવહારો", "Suspicious recipient": "શંકાસ્પદ પ્રાપ્તકર્તા", "Outside your usual transaction range": "તમારી સામાન્ય વ્યવહાર મર્યાદાની બહાર",
  },
};

export function translateRiskFactor(label: string, language: Language) {
  return riskFactorTranslations[language]?.[label] ?? riskFactorTranslations.en[label] ?? label;
}

export const helpContent: Record<Language, { title: string; subtitle: string; questions: { question: string; answer: string }[]; contactTitle: string; contactDescription: string }> = {
  en: {
    title: "Help & FAQ",
    subtitle: "Learn how this SecurePay demo works.",
    questions: [
      { question: "Is this a real payment app?", answer: "No. SecurePay is a college project prototype. It does not connect to a bank, UPI network, or payment gateway. All data is stored locally in your browser." },
      { question: "What are the demo verification codes?", answer: "Use 123456 for the simulated UPI PIN and 123456 for the simulated OTP. No real PIN or OTP is requested." },
      { question: "How is transaction risk calculated?", answer: "The deterministic demo engine scores amount, recipient familiarity, time, device, location, recent payment frequency, recipient reputation, and whether the amount is outside your usual range." },
      { question: "Does SecurePay store my information?", answer: "Demo profile data, preferences, and sample transactions are stored only in this browser's localStorage." },
      { question: "Can I reset the demo?", answer: "Open Settings, expand Developer Demo Controls, and choose Reset demo data to restore the initial sample account." },
    ],
    contactTitle: "Need project help?",
    contactDescription: "This prototype runs fully offline in your browser.",
  },
  hi: {
    title: "सहायता और अक्सर पूछे जाने वाले प्रश्न",
    subtitle: "जानें कि SecurePay का यह डेमो कैसे काम करता है।",
    questions: [
      { question: "क्या यह एक असली भुगतान ऐप है?", answer: "नहीं। SecurePay कॉलेज प्रोजेक्ट का एक प्रोटोटाइप है। यह किसी बैंक, UPI नेटवर्क या भुगतान गेटवे से नहीं जुड़ता। सभी डेटा आपके ब्राउज़र में स्थानीय रूप से संग्रहीत होता है।" },
      { question: "डेमो सत्यापन कोड क्या हैं?", answer: "सिम्युलेटेड UPI PIN और OTP, दोनों के लिए 123456 इस्तेमाल करें। कोई असली PIN या OTP नहीं माँगा जाता।" },
      { question: "लेन-देन का जोखिम कैसे तय होता है?", answer: "नियतात्मक डेमो इंजन राशि, प्राप्तकर्ता की परिचितता, समय, डिवाइस, स्थान, हाल के भुगतानों की आवृत्ति, प्राप्तकर्ता की प्रतिष्ठा और आपकी सामान्य सीमा से बाहर की राशि का आकलन करता है।" },
      { question: "क्या SecurePay मेरी जानकारी संग्रहीत करता है?", answer: "डेमो प्रोफ़ाइल डेटा, प्राथमिकताएँ और नमूना लेन-देन केवल इस ब्राउज़र के localStorage में संग्रहीत होते हैं।" },
      { question: "क्या मैं डेमो रीसेट कर सकता हूँ?", answer: "Settings खोलें, Developer Demo Controls विस्तृत करें और शुरुआती नमूना खाता बहाल करने के लिए Reset demo data चुनें।" },
    ],
    contactTitle: "प्रोजेक्ट में सहायता चाहिए?",
    contactDescription: "यह प्रोटोटाइप आपके ब्राउज़र में पूरी तरह ऑफ़लाइन चलता है।",
  },
  mr: {
    title: "मदत आणि वारंवार विचारले जाणारे प्रश्न",
    subtitle: "SecurePay ची ही डेमो आवृत्ती कशी कार्य करते ते जाणून घ्या.",
    questions: [
      { question: "हे खरे पेमेंट अॅप आहे का?", answer: "नाही. SecurePay हा महाविद्यालयीन प्रकल्पाचा प्रोटोटाइप आहे. तो कोणत्याही बँक, UPI नेटवर्क किंवा पेमेंट गेटवेशी जोडलेला नाही. सर्व डेटा तुमच्या ब्राउझरमध्ये स्थानिकरित्या साठवला जातो." },
      { question: "डेमो पडताळणी कोड कोणते आहेत?", answer: "सिम्युलेटेड UPI PIN आणि OTP या दोन्हींसाठी 123456 वापरा. खरा PIN किंवा OTP मागितला जात नाही." },
      { question: "व्यवहाराचा धोका कसा मोजला जातो?", answer: "नियतात्मक डेमो इंजिन रक्कम, प्राप्तकर्त्याची ओळख, वेळ, डिव्हाइस, ठिकाण, अलीकडील पेमेंटची वारंवारता, प्राप्तकर्त्याची प्रतिष्ठा आणि तुमच्या नेहमीच्या मर्यादेबाहेरील रक्कम तपासते." },
      { question: "SecurePay माझी माहिती साठवते का?", answer: "डेमो प्रोफाइलचा डेटा, प्राधान्ये आणि नमुना व्यवहार फक्त या ब्राउझरच्या localStorage मध्ये साठवले जातात." },
      { question: "मी डेमो रीसेट करू शकतो का?", answer: "Settings उघडा, Developer Demo Controls विस्तृत करा आणि सुरुवातीचे नमुना खाते पुन्हा मिळवण्यासाठी Reset demo data निवडा." },
    ],
    contactTitle: "प्रकल्पासाठी मदत हवी आहे?",
    contactDescription: "हा प्रोटोटाइप तुमच्या ब्राउझरमध्ये पूर्णपणे ऑफलाइन चालतो.",
  },
  gu: {
    title: "મદદ અને વારંવાર પૂછાતા પ્રશ્નો",
    subtitle: "જાણો કે SecurePay નો આ ડેમો કેવી રીતે કાર્ય કરે છે.",
    questions: [
      { question: "શું આ વાસ્તવિક ચુકવણી એપ છે?", answer: "ના. SecurePay કોલેજ પ્રોજેક્ટનો પ્રોટોટાઇપ છે. તે કોઈ બેંક, UPI નેટવર્ક અથવા પેમેન્ટ ગેટવે સાથે જોડાતો નથી. તમામ ડેટા તમારા બ્રાઉઝરમાં સ્થાનિક રીતે સંગ્રહિત થાય છે." },
      { question: "ડેમો ચકાસણી કોડ કયા છે?", answer: "સિમ્યુલેટેડ UPI PIN અને OTP બંને માટે 123456 વાપરો. વાસ્તવિક PIN અથવા OTP માંગવામાં આવતો નથી." },
      { question: "વ્યવહારનું જોખમ કેવી રીતે ગણાય છે?", answer: "નિર્ધારિત ડેમો એન્જિન રકમ, પ્રાપ્તકર્તાની ઓળખાણ, સમય, ઉપકરણ, સ્થાન, તાજેતરના ચુકવણાંની આવર્તન, પ્રાપ્તકર્તાની પ્રતિષ્ઠા અને તમારી સામાન્ય મર્યાદાથી વધુ રકમનું મૂલ્યાંકન કરે છે." },
      { question: "શું SecurePay મારી માહિતી સંગ્રહે છે?", answer: "ડેમો પ્રોફાઇલ ડેટા, પસંદગીઓ અને નમૂનાના વ્યવહારો ફક્ત આ બ્રાઉઝરના localStorage માં સંગ્રહિત થાય છે." },
      { question: "શું હું ડેમો રીસેટ કરી શકું?", answer: "Settings ખોલો, Developer Demo Controls વિસ્તારો અને શરૂઆતનું નમૂના ખાતું પુનઃસ્થાપિત કરવા Reset demo data પસંદ કરો." },
    ],
    contactTitle: "પ્રોજેક્ટ માટે મદદ જોઈએ છે?",
    contactDescription: "આ પ્રોટોટાઇપ તમારા બ્રાઉઝરમાં સંપૂર્ણપણે ઑફલાઇન ચાલે છે.",
  },
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
