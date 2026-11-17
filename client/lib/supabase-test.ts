import { fetchDemoDatabaseStatus } from "./supabase";

export async function testSupabaseConnection() {
  const status = await fetchDemoDatabaseStatus();
  return {
    connected: status.connected,
    readableTables: status.tables,
  };
}
