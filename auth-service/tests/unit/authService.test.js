import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock all external dependencies before importing the service ───────────
// vi.mock paths MUST match the exact specifiers the SERVICE uses at import time.
// Using the @/ alias here so it resolves identically to the service's own imports.

vi.mock("@/model/usersModel.js", () => ({
  default: {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findAll: vi.fn(),
  },
}));

vi.mock("@/service/bloomFilterService.js", () => ({
  default: {
    mightExistEmail: vi.fn(),
    addEmail: vi.fn(),
  },
}));

vi.mock("@/utils/genJWT.js", () => ({
  default: vi.fn(),
}));

vi.mock("@/utils/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("bcrypt", () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
}));

// ─── Import after mocks are registered ────────────────────────────────────
import { AuthService } from "@/service/authService.js";
import userModel from "@/model/usersModel.js";
import bloomFilter from "@/service/bloomFilterService.js";
import genJWT from "@/utils/genJWT.js";
import bcrypt from "bcrypt";

// ─────────────────────────────────────────────────────────────────────────────
describe("AuthService.login()", () => {
  const email = "test@pharma.com";
  const password = "secret123";
  const fakeUser = {
    id: 1,
    email,
    password: "hashedSecret",
    role: "USER",
    full_name: "Test User",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    bloomFilter.mightExistEmail.mockReturnValue(true);
    genJWT.mockResolvedValue("jwt-token");
  });

  it("returns 404 when bloom filter definitively says email is absent", async () => {
    bloomFilter.mightExistEmail.mockReturnValue(false);

    const result = await AuthService.login(email, password);

    expect(result.statusCode).toBe(404);
    expect(result.message).toMatch(/not found/i);
    // DB should never be touched
    expect(userModel.findByEmail).not.toHaveBeenCalled();
  });

  it("returns 404 when user is not found in DB", async () => {
    userModel.findByEmail.mockResolvedValue(null);

    const result = await AuthService.login(email, password);

    expect(result.statusCode).toBe(404);
    expect(result.message).toMatch(/not found/i);
  });

  it("returns 401 when password is invalid", async () => {
    userModel.findByEmail.mockResolvedValue(fakeUser);
    bcrypt.compare.mockResolvedValue(false);

    const result = await AuthService.login(email, password);

    expect(result.statusCode).toBe(401);
    expect(result.message).toMatch(/invalid credentials/i);
  });

  it("returns token and user (without password) on success", async () => {
    userModel.findByEmail.mockResolvedValue(fakeUser);
    bcrypt.compare.mockResolvedValue(true);

    const result = await AuthService.login(email, password);

    expect(result.token).toBe("jwt-token");
    expect(result.user).not.toHaveProperty("password");
    expect(result.user.email).toBe(email);
    expect(genJWT).toHaveBeenCalledWith({
      id: fakeUser.id,
      role: fakeUser.role,
      email: fakeUser.email,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("AuthService.register()", () => {
  const payload = {
    full_name: "Alice",
    email: "alice@pharma.com",
    password: "pass1",
    confirm_password: "pass1",
    phone: "01012345678",
    address: "Cairo",
    role: "USER",
  };
  const createdUser = { id: 2, ...payload, password: "hashed" };

  beforeEach(() => {
    vi.clearAllMocks();
    genJWT.mockResolvedValue("jwt-token");
    bcrypt.hash.mockResolvedValue("hashed");
    userModel.create.mockResolvedValue(createdUser);
  });

  it("returns 400 when email already exists", async () => {
    userModel.findByEmail.mockResolvedValue(createdUser);

    const result = await AuthService.register(...Object.values(payload));

    expect(result.statusCode).toBe(400);
    expect(result.message).toMatch(/already exists/i);
    expect(userModel.create).not.toHaveBeenCalled();
  });

  it("returns 400 when passwords do not match", async () => {
    userModel.findByEmail.mockResolvedValue(null);

    const result = await AuthService.register(
      payload.full_name,
      payload.email,
      "pass1",
      "pass-different",
      payload.phone,
      payload.address,
      payload.role
    );

    expect(result.statusCode).toBe(400);
    expect(result.message).toMatch(/do not match/i);
  });

  it("creates user, adds to bloom filter, returns token and user without password", async () => {
    userModel.findByEmail.mockResolvedValue(null);

    const result = await AuthService.register(...Object.values(payload));

    expect(bcrypt.hash).toHaveBeenCalledWith(payload.password, 12);
    expect(userModel.create).toHaveBeenCalled();
    expect(bloomFilter.addEmail).toHaveBeenCalledWith(payload.email);
    expect(result.token).toBe("jwt-token");
    expect(result.user).not.toHaveProperty("password");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("AuthService.updateAccount()", () => {
  const userId = 1;
  const fakeUser = { id: userId, email: "u@pharma.com", password: "old" };
  const updatedUser = { id: userId, email: "u@pharma.com", password: "newHash" };

  beforeEach(() => {
    vi.clearAllMocks();
    bcrypt.hash.mockResolvedValue("newHash");
    userModel.update.mockResolvedValue(updatedUser);
  });

  it("returns 404 when user not found", async () => {
    userModel.findById.mockResolvedValue(null);

    const result = await AuthService.updateAccount(
      userId, "Name", "e@p.com", "pw", "pw", "01000000000", "Cairo", "USER"
    );

    expect(result.statusCode).toBe(404);
  });

  it("returns 400 when passwords do not match", async () => {
    userModel.findById.mockResolvedValue(fakeUser);

    const result = await AuthService.updateAccount(
      userId, "Name", "e@p.com", "pw1", "pw2", "01000000000", "Cairo", "USER"
    );

    expect(result.statusCode).toBe(400);
    expect(result.message).toMatch(/do not match/i);
  });

  it("returns updated user without password on success", async () => {
    userModel.findById.mockResolvedValue(fakeUser);

    const result = await AuthService.updateAccount(
      userId, "Name", "e@p.com", "pw", "pw", "01000000000", "Cairo", "USER"
    );

    expect(result).not.toHaveProperty("password");
    expect(userModel.update).toHaveBeenCalledWith(userId, expect.objectContaining({
      password: "newHash",
    }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("AuthService.deleteAccount()", () => {
  const fakeUser = { id: 1, email: "u@pharma.com", password: "hash" };

  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when user not found", async () => {
    userModel.findById.mockResolvedValue(null);

    const result = await AuthService.deleteAccount(1);

    expect(result.statusCode).toBe(404);
    expect(userModel.delete).not.toHaveBeenCalled();
  });

  it("deletes and returns user without password on success", async () => {
    userModel.findById.mockResolvedValue(fakeUser);
    userModel.delete.mockResolvedValue(fakeUser);

    const result = await AuthService.deleteAccount(1);

    expect(userModel.delete).toHaveBeenCalledWith(1);
    expect(result).not.toHaveProperty("password");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("AuthService.getAllUsers()", () => {
  it("strips passwords from all returned users", async () => {
    userModel.findAll.mockResolvedValue([
      { id: 1, email: "a@p.com", password: "h1" },
      { id: 2, email: "b@p.com", password: "h2" },
    ]);

    const result = await AuthService.getAllUsers();

    expect(result).toHaveLength(2);
    result.forEach((u) => expect(u).not.toHaveProperty("password"));
  });
});
