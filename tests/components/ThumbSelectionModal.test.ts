import { describe, expect, test } from "@jest/globals";
import { ThumbModalItem } from "../../app/components/ThumbSelectionModal";

describe("ThumbSelectionModal items & search filtering", () => {
  const sampleItems: ThumbModalItem[] = [
    {
      id: "uuid-1",
      title: "HPC26010",
      subtitle: "Code: LOT-001 | Company: ACME Corp | Date: 2026-10-06",
      badge: { text: "AIR", variant: "blue" },
      selected: true,
    },
    {
      id: "uuid-2",
      title: "SEA26099",
      subtitle: "Code: LOT-002 | Company: Ocean Freight Co | Date: 2026-10-05",
      badge: { text: "SEA", variant: "green" },
      selected: false,
    },
    {
      id: "uuid-3",
      title: "MON - มอนเทรดดิ้ง",
      subtitle: "📧 mon@test.com | 📞 0812345678 | 📦 15 orders",
      badge: { text: "15 PKGS", variant: "blue" },
      selected: false,
    },
  ];

  test("filters items correctly by title", () => {
    const query = "HPC";
    const filtered = sampleItems.filter((item) =>
      item.title.toLowerCase().includes(query.toLowerCase()),
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("uuid-1");
  });

  test("filters items correctly by subtitle (company, email, tel)", () => {
    const query = "Ocean";
    const filtered = sampleItems.filter((item) =>
      (item.subtitle || "").toLowerCase().includes(query.toLowerCase()),
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("uuid-2");
  });

  test("supports Thai characters search in customer name", () => {
    const query = "มอน";
    const filtered = sampleItems.filter((item) =>
      item.title.toLowerCase().includes(query.toLowerCase()),
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("uuid-3");
  });

  test("handles empty query by returning all items", () => {
    const query = "";
    const filtered = sampleItems.filter((item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      (item.subtitle || "").toLowerCase().includes(query.toLowerCase()),
    );
    expect(filtered).toHaveLength(3);
  });

  test("preserves item selection flag and badge information", () => {
    const selectedItem = sampleItems.find((item) => item.selected);
    expect(selectedItem).toBeDefined();
    expect(selectedItem?.id).toBe("uuid-1");
    expect(selectedItem?.badge?.variant).toBe("blue");
  });
});
