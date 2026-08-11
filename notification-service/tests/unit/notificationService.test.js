import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/models/Notification.js", () => ({
  default: {
    find: vi.fn(),
    findById: vi.fn(),
    findByIdAndDelete: vi.fn(),
  },
}));

vi.mock("mongoose", () => ({
  default: {
    Types: {
      ObjectId: class ObjectId {
        constructor(id) { this._id = id; }
        toString() { return this._id; }
      },
    },
  },
}));

import { NotificationService } from "@/service/notificationService.js";
import Notification from "@/models/Notification.js";

function mockFindChain(docs) {
  const chain = {
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(docs),
  };
  Notification.find.mockReturnValue(chain);
  return chain;
}

describe("NotificationService.getByEmail()", () => {
  const email = "user@pharma.com";
  beforeEach(() => vi.clearAllMocks());

  it("first page: no cursor, fewer docs than limit → hasNextPage=false", async () => {
    const docs = [
      { _id: { toString: () => "id-1" }, email, message: "A" },
      { _id: { toString: () => "id-2" }, email, message: "B" },
    ];
    mockFindChain(docs);
    const result = await NotificationService.getByEmail(email, { limit: 20 });
    expect(result.notifications).toHaveLength(2);
    expect(result.hasNextPage).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("hasNextPage=true when sentinel doc returned, nextCursor = last real doc id", async () => {
    // limit=2 → fetch 3; 3 docs returned means there is a next page
    const docs = [
      { _id: { toString: () => "id-1" }, email, message: "A" },
      { _id: { toString: () => "id-2" }, email, message: "B" },
      { _id: { toString: () => "id-3" }, email, message: "C" },
    ];
    mockFindChain(docs);
    const result = await NotificationService.getByEmail(email, { limit: 2 });
    expect(result.notifications).toHaveLength(2);
    expect(result.hasNextPage).toBe(true);
    expect(result.nextCursor).toBe("id-2");
  });

  it("passes cursor as $lt filter when provided", async () => {
    mockFindChain([]);
    await NotificationService.getByEmail(email, { cursor: "abc123", limit: 5 });
    expect(Notification.find).toHaveBeenCalledWith(
      expect.objectContaining({ email, _id: expect.anything() })
    );
  });

  it("caps limit to 100 when absurd value supplied (calls chain.limit with 101)", async () => {
    const chain = mockFindChain([]);
    await NotificationService.getByEmail(email, { limit: 9999 });
    expect(chain.limit).toHaveBeenCalledWith(101);
  });

  it("uses DEFAULT_LIMIT=20 when no limit supplied (calls chain.limit with 21)", async () => {
    const chain = mockFindChain([]);
    await NotificationService.getByEmail(email, {});
    expect(chain.limit).toHaveBeenCalledWith(21);
  });
});

describe("NotificationService.getById()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns notification when found", async () => {
    const notif = { _id: "id-1", email: "u@p.com" };
    Notification.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue(notif) });
    const result = await NotificationService.getById("id-1");
    expect(result).toEqual(notif);
  });

  it("returns null when not found", async () => {
    Notification.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
    const result = await NotificationService.getById("ghost");
    expect(result).toBeNull();
  });
});

describe("NotificationService.deleteById()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns deleted document", async () => {
    const notif = { _id: "id-1" };
    Notification.findByIdAndDelete.mockReturnValue({ lean: vi.fn().mockResolvedValue(notif) });
    const result = await NotificationService.deleteById("id-1");
    expect(result).toEqual(notif);
  });

  it("returns null when notification not found", async () => {
    Notification.findByIdAndDelete.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
    const result = await NotificationService.deleteById("ghost");
    expect(result).toBeNull();
  });
});
