import { createHash } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import type {
  DemoAccountRecord,
  DemoActivityRecord,
  DemoAlertRecord,
  DemoDatabase,
  DemoPasswordCheckRecord,
  DemoPhishingCheckRecord,
  DemoSecurityCheckRecord,
  DemoSecurityScoreRecord,
  DemoTransactionRecord,
  DemoTransactionRiskRecord,
  DemoUserRecord,
} from "../../client/lib/supabase";
import { getSupabaseClient, getSupabaseServiceClient } from "../lib/supabase";

const tables = [
  "users",
  "accounts",
  "transactions",
  "transaction_risk",
  "security_alerts",
  "security_activity",
  "security_scores",
  "security_checks",
  "password_checks",
  "phishing_checks",
] as const;

const passwordCheckSchema = z.object({
  idempotencyKey: z.string().uuid(),
  strength: z.enum(["Weak", "Moderate", "Strong"]),
  score: z.number().int().min(0).max(100),
  length_check: z.boolean(),
  uppercase_check: z.boolean(),
  lowercase_check: z.boolean(),
  number_check: z.boolean(),
  special_character_check: z.boolean(),
}).strict();

const phishingCheckSchema = z.object({
  idempotencyKey: z.string().uuid(),
  input_type: z.enum(["URL", "SMS", "MESSAGE"]),
  input_hash: z.string().regex(/^[a-f0-9]{64}$/i),
  risk_level: z.enum(["Safe", "Suspicious", "High Risk"]),
  risk_score: z.number().int().min(0).max(100),
  explanation: z.string().trim().min(1).max(1000),
}).strict();

const transactionStatusEnum = z.enum(["Success", "Pending", "Failed", "Flagged", "Verification Required"]);
const transactionSchema = z.object({
  idempotencyKey: z.string().uuid(),
  recipientName: z.string().trim().min(1).max(100),
  recipientUpi: z.string().trim().min(1).max(100),
  amount: z.number().finite().positive().max(1_000_000),
  transactionType: z.enum(["UPI", "Bank Transfer", "Bill Payment", "Recharge"]),
  recipientType: z.enum(["New", "Existing"]),
  riskScore: z.number().int().min(0).max(100),
  riskLevel: z.enum(["Low", "Medium", "High"]),
  amountRisk: z.number().int().min(0).max(100),
  behaviourRisk: z.number().int().min(0).max(100),
  recipientRisk: z.number().int().min(0).max(100),
  frequencyRisk: z.number().int().min(0).max(100),
  explanation: z.string().trim().min(1).max(1000),
  finalStatus: transactionStatusEnum,
}).strict();

const transactionStatusSchema = z.object({
  referenceNumber: z.string().trim().min(1).max(64),
  status: transactionStatusEnum,
}).strict();
const atomicTransactionResponseSchema = z.object({
  created: z.boolean(),
  transaction: z.object({
    id: z.string().uuid(),
    account_id: z.string().uuid(),
    recipient_name: z.string(),
    recipient_upi: z.string().nullable(),
    amount: z.number(),
    transaction_type: z.enum(["UPI", "Bank Transfer", "Bill Payment", "Recharge"]),
    recipient_type: z.enum(["New", "Existing"]),
    transaction_time: z.string(),
    status: transactionStatusEnum,
    reference_number: z.string().nullable(),
    risk: z.object({
      id: z.string().uuid(),
      transaction_id: z.string().uuid(),
      risk_score: z.number().int(),
      risk_level: z.enum(["Low", "Medium", "High"]),
      amount_risk: z.number().int(),
      behaviour_risk: z.number().int(),
      recipient_risk: z.number().int(),
      frequency_risk: z.number().int(),
      decision: z.enum(["APPROVE", "VERIFY", "FLAG"]),
      explanation: z.string().nullable(),
      analysed_at: z.string(),
    }),
  }),
}).strict();
const atomicStatusResponseSchema = z.object({ updated: z.boolean() }).strict();
export type DemoTransactionStatus = z.infer<typeof transactionStatusEnum>;

const allowedTransactionStatusTransitions: Record<DemoTransactionStatus, readonly DemoTransactionStatus[]> = {
  "Verification Required": ["Pending", "Success", "Failed", "Flagged"],
  Pending: ["Success", "Failed", "Flagged"],
  Success: [],
  Failed: [],
  Flagged: [],
};

export function canTransitionTransactionStatus(current: DemoTransactionStatus, next: DemoTransactionStatus) {
  return current === next || allowedTransactionStatusTransitions[current].includes(next);
}

const alertStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["Read", "Resolved"]),
}).strict();

class RouteError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function isLoopback(value: string) {
  return value === "127.0.0.1" || value === "::1" || value === "::ffff:127.0.0.1" || value === "localhost";
}

function isLocalRequest(req: Request) {
  const remoteAddress = req.socket.remoteAddress?.replace(/^::ffff:/, "");
  const host = req.get("host");
  if (!remoteAddress || !host || !isLoopback(remoteAddress)) return false;

  let hostName: string;
  try {
    hostName = new URL(`http://${host}`).hostname.replace(/^\[|\]$/g, "");
  } catch {
    return false;
  }
  if (!isLoopback(hostName)) return false;

  const origin = req.get("origin");
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    return (originUrl.protocol === "http:" || originUrl.protocol === "https:") && isLoopback(originUrl.hostname.replace(/^\[|\]$/g, ""));
  } catch {
    return false;
  }
}

function parseBody<T>(schema: z.ZodType<T>, req: Request, res: Response): T | undefined {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Request body is invalid", issues: parsed.error.issues.map(issue => issue.path.join(".")) });
    return undefined;
  }
  return parsed.data;
}

function sendError(res: Response, error: unknown) {
  if (error instanceof RouteError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  const errorType = error instanceof Error ? error.name : typeof error;
  console.error("[demo-db] Request failed", { errorType });
  res.status(502).json({ error: "Demo database request failed" });
}

function throwOnDatabaseError(error: { message: string } | null, operation: string) {
  if (error) throw new Error(`${operation}: ${error.message}`);
}

function getAtomicDemoServiceClient() {
  try {
    return getSupabaseServiceClient();
  } catch (error) {
    if (error instanceof Error && error.message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      throw new RouteError(error.message, 503);
    }
    throw error;
  }
}

async function getDemoUser() {
  let client: ReturnType<typeof getSupabaseClient>;
  try {
    client = getSupabaseClient();
  } catch (error) {
    if (error instanceof Error && error.message.includes("are required for the local demo database API")) {
      throw new RouteError("The demo database is not configured", 503);
    }
    throw error;
  }
  const { data, error } = await client
    .from("users")
    .select("id,full_name,mobile_number,email,preferred_language")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  throwOnDatabaseError(error, "Unable to load demo user");
  if (!data) throw new RouteError("Demo data is not seeded yet: no users were found", 404);
  return data as DemoUserRecord;
}

async function getUserAccounts(userId: string) {
  const { data, error } = await getSupabaseClient()
    .from("accounts")
    .select("id,user_id,bank_name,account_number,upi_id,account_type,balance,status,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  throwOnDatabaseError(error, "Unable to load demo accounts");
  return (data ?? []).map(account => ({
    id: account.id,
    bank_name: account.bank_name,
    account_number_last4: String(account.account_number ?? "").slice(-4),
    upi_id: account.upi_id,
    account_type: account.account_type,
    balance: Number(account.balance),
    status: account.status,
    created_at: account.created_at,
  })) as DemoAccountRecord[];
}

async function upsertOnce(table: string, row: Record<string, unknown>, conflict: string) {
  const client = getSupabaseClient();
  const { data: inserted, error } = await client
    .from(table)
    .upsert(row, { onConflict: conflict, ignoreDuplicates: true })
    .select(conflict);
  throwOnDatabaseError(error, `Unable to save ${table}`);

  const { data: persisted, error: readError } = await client
    .from(table)
    .select("*")
    .eq(conflict, row[conflict])
    .maybeSingle();
  throwOnDatabaseError(readError, `Unable to verify saved ${table}`);
  if (!persisted) throw new Error(`Unable to verify saved ${table}`);

  for (const [key, expected] of Object.entries(row)) {
    if (key === "checked_at" || key === "created_at") continue;
    if (persisted[key] !== expected) {
      throw new RouteError("This check retry key was already used for different details", 409);
    }
  }
  return Array.isArray(inserted) && inserted.length > 0;
}

function stableUuid(value: string) {
  const namespace = Buffer.from("6ba7b8119dad11d180b400c04fd430c8", "hex");
  const digest = createHash("sha1").update(Buffer.concat([namespace, Buffer.from(value)])).digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function loadDatabase(): Promise<DemoDatabase> {
  const user = await getDemoUser();
  const accounts = await getUserAccounts(user.id);
  const accountIds = accounts.map(account => account.id);
  const client = getSupabaseClient();

  const [transactionsResult, alertsResult, activitiesResult, scoresResult, checksResult, passwordsResult, phishingResult] = await Promise.all([
    accountIds.length
      ? client.from("transactions")
        .select("id,account_id,recipient_name,recipient_upi,amount,transaction_type,recipient_type,transaction_time,status,reference_number")
        .in("account_id", accountIds)
        .order("transaction_time", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    client.from("security_alerts")
      .select("id,transaction_id,alert_type,severity,title,message,recommendation,status,created_at,resolved_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    client.from("security_activity")
      .select("id,activity_type,description,related_transaction_id,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    client.from("security_scores")
      .select("id,overall_score,transaction_score,account_security_score,password_score,phishing_score,suspicious_activity_score,calculated_at")
      .eq("user_id", user.id)
      .order("calculated_at", { ascending: false }),
    client.from("security_checks")
      .select("id,check_type,result,risk_score,explanation,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    client.from("password_checks")
      .select("id,strength,score,length_check,uppercase_check,lowercase_check,number_check,special_character_check,checked_at")
      .eq("user_id", user.id)
      .order("checked_at", { ascending: false }),
    client.from("phishing_checks")
      .select("id,input_type,input_hash,risk_level,risk_score,explanation,checked_at")
      .eq("user_id", user.id)
      .order("checked_at", { ascending: false }),
  ]);
  throwOnDatabaseError(transactionsResult.error, "Unable to load demo transactions");
  throwOnDatabaseError(alertsResult.error, "Unable to load security alerts");
  throwOnDatabaseError(activitiesResult.error, "Unable to load security activity");
  throwOnDatabaseError(scoresResult.error, "Unable to load security scores");
  throwOnDatabaseError(checksResult.error, "Unable to load security checks");
  throwOnDatabaseError(passwordsResult.error, "Unable to load password-check history");
  throwOnDatabaseError(phishingResult.error, "Unable to load phishing-check history");

  const transactions = transactionsResult.data ?? [];
  const transactionIds = transactions.map(transaction => transaction.id as string);
  const risksResult = transactionIds.length
    ? await client.from("transaction_risk")
      .select("id,transaction_id,risk_score,risk_level,amount_risk,behaviour_risk,recipient_risk,frequency_risk,decision,explanation,analysed_at")
      .in("transaction_id", transactionIds)
    : { data: [], error: null };
  throwOnDatabaseError(risksResult.error, "Unable to load transaction risk assessments");
  const risks = new Map((risksResult.data ?? []).map(risk => [risk.transaction_id as string, risk]));

  return {
    user,
    accounts,
    transactions: transactions.map(transaction => ({
      ...transaction,
      amount: Number(transaction.amount),
      risk: (risks.get(transaction.id) ?? null) as DemoTransactionRiskRecord | null,
    })) as DemoTransactionRecord[],
    alerts: (alertsResult.data ?? []) as DemoAlertRecord[],
    activity: (activitiesResult.data ?? []) as DemoActivityRecord[],
    securityScores: (scoresResult.data ?? []) as DemoSecurityScoreRecord[],
    securityChecks: (checksResult.data ?? []) as DemoSecurityCheckRecord[],
    passwordChecks: (passwordsResult.data ?? []) as DemoPasswordCheckRecord[],
    phishingChecks: (phishingResult.data ?? []) as DemoPhishingCheckRecord[],
  };
}

const router = Router();

router.use((req, res, next) => {
  if (!isLocalRequest(req)) {
    res.status(403).json({ error: "The demo database API is available only from localhost" });
    return;
  }
  next();
});

router.get("/status", async (_req, res) => {
  try {
    const client = getSupabaseClient();
    const results = await Promise.all(tables.map(async table => ({
      table,
      result: await client.from(table).select("id", { count: "exact", head: true }),
    })));
    const failed = results.find(item => item.result.error);
    if (failed?.result.error) {
      throw new Error(`Unable to verify ${failed.table}: ${failed.result.error.message}`);
    }
    res.json({ connected: true, tables });
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/data", async (_req, res) => {
  try {
    res.json(await loadDatabase());
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/password-checks", async (req, res) => {
  const input = parseBody(passwordCheckSchema, req, res);
  if (!input) return;
  try {
    const user = await getDemoUser();
    const checkedAt = new Date().toISOString();
    const created = await upsertOnce("password_checks", {
      id: input.idempotencyKey,
      user_id: user.id,
      strength: input.strength,
      score: input.score,
      length_check: input.length_check,
      uppercase_check: input.uppercase_check,
      lowercase_check: input.lowercase_check,
      number_check: input.number_check,
      special_character_check: input.special_character_check,
      checked_at: checkedAt,
    }, "id");
    await upsertOnce("security_checks", {
      id: stableUuid(`${input.idempotencyKey}:security-check`),
      user_id: user.id,
      check_type: "PASSWORD",
      result: input.strength,
      risk_score: 100 - input.score,
      explanation: "Password strength was assessed locally; the password value was not stored.",
      created_at: checkedAt,
    }, "id");
    await upsertOnce("security_activity", {
      id: stableUuid(`${input.idempotencyKey}:activity`),
      user_id: user.id,
      activity_type: "PASSWORD_CHECK",
      description: `Password strength check completed: ${input.strength} (${input.score}/100). Password value not stored.`,
      created_at: checkedAt,
    }, "id");
    res.status(created ? 201 : 200).json({ saved: true });
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/phishing-checks", async (req, res) => {
  const input = parseBody(phishingCheckSchema, req, res);
  if (!input) return;
  try {
    const user = await getDemoUser();
    const checkedAt = new Date().toISOString();
    const created = await upsertOnce("phishing_checks", {
      id: input.idempotencyKey,
      user_id: user.id,
      input_type: input.input_type,
      input_hash: input.input_hash.toLowerCase(),
      risk_level: input.risk_level,
      risk_score: input.risk_score,
      explanation: input.explanation,
      checked_at: checkedAt,
    }, "id");
    await upsertOnce("security_checks", {
      id: stableUuid(`${input.idempotencyKey}:security-check`),
      user_id: user.id,
      check_type: "PHISHING",
      result: input.risk_level,
      risk_score: input.risk_score,
      explanation: input.explanation,
      created_at: checkedAt,
    }, "id");
    await upsertOnce("security_activity", {
      id: stableUuid(`${input.idempotencyKey}:activity`),
      user_id: user.id,
      activity_type: "PHISHING_CHECK",
      description: `${input.input_type} phishing check completed: ${input.risk_level} (risk ${input.risk_score}/100). Input hash stored; raw input not stored.`,
      created_at: checkedAt,
    }, "id");
    res.status(created ? 201 : 200).json({ saved: true });
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/transactions", async (req, res) => {
  const input = parseBody(transactionSchema, req, res);
  if (!input) return;
  try {
    const user = await getDemoUser();
    const { data: accounts, error: accountsError } = await getSupabaseClient()
      .from("accounts")
      .select("id,status")
      .eq("user_id", user.id)
      .eq("status", "Active")
      .order("created_at", { ascending: true })
      .limit(1);
    throwOnDatabaseError(accountsError, "Unable to choose an active demo account");
    const account = accounts?.[0];

    const riskLevel = input.riskScore < 30 ? "Low" : input.riskScore < 60 ? "Medium" : "High";
    if (riskLevel !== input.riskLevel) {
      throw new RouteError("Risk level does not match the supplied risk score", 400);
    }

    const payloadHash = createHash("sha256").update(JSON.stringify({
      userId: user.id,
      accountId: account?.id ?? null,
      recipientName: input.recipientName,
      recipientUpi: input.recipientUpi,
      amount: input.amount,
      transactionType: input.transactionType,
      recipientType: input.recipientType,
      riskScore: input.riskScore,
      riskLevel: input.riskLevel,
      amountRisk: input.amountRisk,
      behaviourRisk: input.behaviourRisk,
      recipientRisk: input.recipientRisk,
      frequencyRisk: input.frequencyRisk,
      explanation: input.explanation,
      finalStatus: input.finalStatus,
    })).digest("hex");
    const { data, error } = await getAtomicDemoServiceClient().rpc("create_demo_transaction_atomic", {
      p_idempotency_key: input.idempotencyKey,
      p_payload_hash: payloadHash,
      p_user_id: user.id,
      p_account_id: account?.id ?? null,
      p_recipient_name: input.recipientName,
      p_recipient_upi: input.recipientUpi,
      p_amount: input.amount,
      p_transaction_type: input.transactionType,
      p_recipient_type: input.recipientType,
      p_risk_score: input.riskScore,
      p_risk_level: input.riskLevel,
      p_amount_risk: input.amountRisk,
      p_behaviour_risk: input.behaviourRisk,
      p_recipient_risk: input.recipientRisk,
      p_frequency_risk: input.frequencyRisk,
      p_explanation: input.explanation,
      p_final_status: input.finalStatus,
    });
    if (error) {
      if (error.code === "22023") throw new RouteError(error.message, 400);
      if (error.code === "P0001" && error.message === "IDEMPOTENCY_CONFLICT") {
        throw new RouteError("This transaction retry key was already used for different details", 409);
      }
      if (error.code === "P0001" && error.message === "ACTIVE_DEMO_ACCOUNT_NOT_FOUND") {
        throw new RouteError("No active demo account is available for this transaction", 409);
      }
      throw new Error(`Atomic transaction RPC failed: ${error.message}`);
    }

    const parsedResponse = atomicTransactionResponseSchema.safeParse(data);
    if (!parsedResponse.success) {
      throw new Error("Atomic transaction RPC returned an invalid response");
    }
    res.status(parsedResponse.data.created ? 201 : 200).json({
      transaction: parsedResponse.data.transaction as DemoTransactionRecord,
    });
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/transactions/status", async (req, res) => {
  const input = parseBody(transactionStatusSchema, req, res);
  if (!input) return;
  try {
    const user = await getDemoUser();
    const { data, error } = await getAtomicDemoServiceClient().rpc("update_demo_transaction_status_atomic", {
      p_user_id: user.id,
      p_reference_number: input.referenceNumber,
      p_status: input.status,
    });
    if (error) {
      if (error.code === "22023") throw new RouteError(error.message, 400);
      if (error.code === "P0001" && error.message === "TRANSACTION_NOT_FOUND") {
        throw new RouteError("Demo transaction was not found", 404);
      }
      if (error.code === "P0001" && error.message === "INVALID_STATUS_TRANSITION") {
        throw new RouteError("The requested transaction status transition is not allowed", 409);
      }
      throw new Error(`Atomic transaction status RPC failed: ${error.message}`);
    }
    const parsedResponse = atomicStatusResponseSchema.safeParse(data);
    if (!parsedResponse.success) {
      throw new Error("Atomic transaction status RPC returned an invalid response");
    }
    res.json({ updated: parsedResponse.data.updated });
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/alerts/status", async (req, res) => {
  const input = parseBody(alertStatusSchema, req, res);
  if (!input) return;
  try {
    const user = await getDemoUser();
    const client = getSupabaseClient();
    const update = input.status === "Resolved"
      ? { status: input.status, resolved_at: new Date().toISOString() }
      : { status: input.status };
    const { data, error } = await client.from("security_alerts")
      .update(update)
      .eq("id", input.id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    throwOnDatabaseError(error, "Unable to update security alert");
    if (!data) throw new RouteError("Security alert was not found", 404);
    res.json({ updated: true });
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/alerts/read-all", async (_req, res) => {
  try {
    const user = await getDemoUser();
    const { error } = await getSupabaseClient().from("security_alerts")
      .update({ status: "Read" })
      .eq("user_id", user.id)
      .eq("status", "Unread");
    throwOnDatabaseError(error, "Unable to mark security alerts as read");
    res.json({ updated: true });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
