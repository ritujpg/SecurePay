export type DemoUserRecord = {
  id: string;
  full_name: string;
  mobile_number: string | null;
  email: string | null;
  preferred_language: "English" | "Hindi" | "Marathi";
};

export type DemoAccountRecord = {
  id: string;
  bank_name: string;
  account_number_last4: string;
  upi_id: string | null;
  account_type: "Savings" | "Current";
  balance: number;
  status: "Active" | "Blocked" | "Suspended";
  created_at: string;
};

export type DemoTransactionRecord = {
  id: string;
  account_id: string;
  recipient_name: string;
  recipient_upi: string | null;
  amount: number;
  transaction_type: "UPI" | "Bank Transfer" | "Bill Payment" | "Recharge";
  recipient_type: "New" | "Existing";
  transaction_time: string;
  status: "Success" | "Pending" | "Failed" | "Flagged" | "Verification Required";
  reference_number: string | null;
  risk: DemoTransactionRiskRecord | null;
};

export type DemoTransactionRiskRecord = {
  id: string;
  transaction_id: string;
  risk_score: number;
  risk_level: "Low" | "Medium" | "High";
  amount_risk: number;
  behaviour_risk: number;
  recipient_risk: number;
  frequency_risk: number;
  decision: "APPROVE" | "VERIFY" | "FLAG";
  explanation: string | null;
  analysed_at: string;
};

export type DemoAlertRecord = {
  id: string;
  transaction_id: string | null;
  alert_type: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  title: string;
  message: string;
  recommendation: string | null;
  status: "Unread" | "Read" | "Resolved";
  created_at: string;
  resolved_at: string | null;
};

export type DemoSecurityScoreRecord = {
  id: string;
  overall_score: number;
  transaction_score: number;
  account_security_score: number;
  password_score: number;
  phishing_score: number;
  suspicious_activity_score: number;
  calculated_at: string;
};

export type DemoSecurityCheckRecord = {
  id: string;
  check_type: "PASSWORD" | "PHISHING" | "TRANSACTION" | "ACCOUNT";
  result: string;
  risk_score: number | null;
  explanation: string | null;
  created_at: string;
};

export type DemoPasswordCheckRecord = {
  id: string;
  strength: "Weak" | "Moderate" | "Strong";
  score: number;
  length_check: boolean;
  uppercase_check: boolean;
  lowercase_check: boolean;
  number_check: boolean;
  special_character_check: boolean;
  checked_at: string;
};

export type DemoPhishingCheckRecord = {
  id: string;
  input_type: "URL" | "SMS" | "MESSAGE";
  input_hash: string | null;
  risk_level: "Safe" | "Suspicious" | "High Risk";
  risk_score: number;
  explanation: string | null;
  checked_at: string;
};

export type DemoActivityRecord = {
  id: string;
  activity_type: "LOGIN" | "TRANSACTION_ANALYSED" | "RISK_ALERT" | "VERIFICATION_COMPLETED" | "PASSWORD_CHECK" | "PHISHING_CHECK" | "SECURITY_RECOMMENDATION" | "ACCOUNT_UPDATE";
  description: string;
  related_transaction_id: string | null;
  created_at: string;
};

export type DemoDatabase = {
  user: DemoUserRecord;
  accounts: DemoAccountRecord[];
  transactions: DemoTransactionRecord[];
  alerts: DemoAlertRecord[];
  securityScores: DemoSecurityScoreRecord[];
  securityChecks: DemoSecurityCheckRecord[];
  passwordChecks: DemoPasswordCheckRecord[];
  phishingChecks: DemoPhishingCheckRecord[];
  activity: DemoActivityRecord[];
};

export type DemoPasswordCheckInput = Omit<DemoPasswordCheckRecord, "id" | "checked_at"> & {
  idempotencyKey: string;
};
export type DemoPhishingCheckInput = Omit<DemoPhishingCheckRecord, "id" | "checked_at"> & {
  idempotencyKey: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/demo-db${path}`, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network request failed";
    throw new Error(`Unable to reach the local demo database API: ${message}`);
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
        ? body.error
        : `The local demo database API returned HTTP ${response.status}`;
    throw new Error(message);
  }

  return body as T;
}

export function fetchDemoDatabaseStatus() {
  return request<{ connected: true; tables: string[] }>("/status");
}

export function fetchDemoDatabase() {
  return request<DemoDatabase>("/data");
}

export function recordDemoPasswordCheck(input: DemoPasswordCheckInput) {
  return request<{ saved: true }>("/password-checks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function recordDemoPhishingCheck(input: DemoPhishingCheckInput) {
  return request<{ saved: true }>("/phishing-checks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type DemoTransactionInput = {
  idempotencyKey: string;
  recipientName: string;
  recipientUpi: string;
  amount: number;
  transactionType: DemoTransactionRecord["transaction_type"];
  recipientType: "New" | "Existing";
  riskScore: number;
  riskLevel: "Low" | "Medium" | "High";
  amountRisk: number;
  behaviourRisk: number;
  recipientRisk: number;
  frequencyRisk: number;
  explanation: string;
  finalStatus: DemoTransactionRecord["status"];
};

export function createDemoTransaction(input: DemoTransactionInput) {
  return request<{ transaction: DemoTransactionRecord }>("/transactions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateDemoTransactionStatus(referenceNumber: string, status: "Success" | "Flagged") {
  return request<{ updated: boolean }>("/transactions/status", {
    method: "POST",
    body: JSON.stringify({ referenceNumber, status }),
  });
}

export function updateDemoAlertStatus(id: string, status: "Read" | "Resolved") {
  return request<{ updated: true }>("/alerts/status", {
    method: "POST",
    body: JSON.stringify({ id, status }),
  });
}

export function markAllDemoAlertsRead() {
  return request<{ updated: true }>("/alerts/read-all", { method: "POST" });
}
