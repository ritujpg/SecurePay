export type QueryPage<T> = {
  data: T[] | null;
  error: { message: string } | null;
  count: number | null;
};

export function assertUniqueRows<T, K>(rows: T[], identity: (row: T) => K) {
  const identities = new Set<K>();
  for (const row of rows) {
    const key = identity(row);
    if (identities.has(key)) throw new Error("The database returned duplicate records");
    identities.add(key);
  }
}

export async function fetchAllPages<T>(
  fetchPage: (start: number, end: number) => Promise<QueryPage<T>>,
  pageSize = 500,
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error("Page size must be a positive integer");
  }

  const rows: T[] = [];
  let expectedCount: number | null = null;
  for (let start = 0; expectedCount === null || start < expectedCount; start += pageSize) {
    const result = await fetchPage(start, start + pageSize - 1);
    if (result.error) throw new Error(`Unable to load paginated records: ${result.error.message}`);
    if (!Number.isInteger(result.count) || result.count! < 0) {
      throw new Error("The database did not provide an exact row count");
    }
    if (expectedCount !== null && result.count !== expectedCount) {
      throw new Error("The database row count changed during pagination");
    }
    expectedCount = result.count;
    const pageRows = result.data ?? [];
    if (pageRows.length > pageSize || rows.length + pageRows.length > expectedCount) {
      throw new Error("The database returned an inconsistent page");
    }
    const expectedPageSize = Math.min(pageSize, expectedCount - rows.length);
    if (pageRows.length !== expectedPageSize) {
      throw new Error("The database returned an incomplete page");
    }
    rows.push(...pageRows);
    if (expectedCount === 0) break;
  }

  if (rows.length !== expectedCount) {
    throw new Error("The database returned an incomplete history");
  }
  return rows;
}
