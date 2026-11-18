import { describe, expect, it } from "vitest";
import { assertUniqueRows, fetchAllPages } from "./paginate";

describe("fetchAllPages", () => {
  it("retrieves a complete multi-page result", async () => {
    const values = [1, 2, 3, 4, 5];
    const pageSizes: number[] = [];
    const result = await fetchAllPages(async (start, end) => {
      const data = values.slice(start, end + 1);
      pageSizes.push(data.length);
      return { data, error: null, count: values.length };
    }, 2);

    expect(result).toEqual(values);
    expect(pageSizes).toEqual([2, 2, 1]);
  });

  it("accepts a verified empty result", async () => {
    await expect(fetchAllPages(async () => ({
      data: [],
      error: null,
      count: 0,
    }))).resolves.toEqual([]);
  });

  it("fails when a query errors", async () => {
    await expect(fetchAllPages(async () => ({
      data: null,
      error: { message: "database unavailable" },
      count: 0,
    }))).rejects.toThrow("database unavailable");
  });

  it("fails when the exact count changes during pagination", async () => {
    let call = 0;
    await expect(fetchAllPages(async () => ({
      data: [call++],
      error: null,
      count: call === 1 ? 3 : 4,
    }), 1)).rejects.toThrow("row count changed");
  });

  it("fails rather than treating a short page as complete history", async () => {
    await expect(fetchAllPages(async () => ({
      data: [1],
      error: null,
      count: 3,
    }), 2)).rejects.toThrow("incomplete page");
  });

  it("rejects a response without an exact count", async () => {
    await expect(fetchAllPages(async () => ({
      data: [],
      error: null,
      count: null,
    }))).rejects.toThrow("exact row count");
  });

  it("rejects duplicate transaction identities across pages", () => {
    expect(() => assertUniqueRows(
      [{ id: "tx-1" }, { id: "tx-1" }],
      row => row.id,
    )).toThrow("duplicate records");
  });
});
