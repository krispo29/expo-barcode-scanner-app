import { describe, expect, test } from "@jest/globals";
import { updateRecentIds } from "./recentSelections";

describe("recentSelections utility", () => {
  test("adds a new id to the front of list", () => {
    const list = ["id-1", "id-2"];
    const updated = updateRecentIds(list, "id-3", 4);
    expect(updated).toEqual(["id-3", "id-1", "id-2"]);
  });

  test("moves existing id to the front without duplicates", () => {
    const list = ["id-1", "id-2", "id-3"];
    const updated = updateRecentIds(list, "id-2", 4);
    expect(updated).toEqual(["id-2", "id-1", "id-3"]);
  });

  test("caps list length at maxCount", () => {
    const list = ["id-1", "id-2", "id-3", "id-4"];
    const updated = updateRecentIds(list, "id-5", 4);
    expect(updated).toHaveLength(4);
    expect(updated).toEqual(["id-5", "id-1", "id-2", "id-3"]);
  });

  test("handles empty or invalid id safely", () => {
    const list = ["id-1", "id-2"];
    expect(updateRecentIds(list, "", 4)).toEqual(list);
    // @ts-expect-error testing invalid input
    expect(updateRecentIds(list, null, 4)).toEqual(list);
  });
});
