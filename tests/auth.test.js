const request = require("supertest");
const app = require("../src/app");
const prisma = require("../src/lib/prisma");

beforeEach(async () => {
  await prisma.attempt.deleteMany();
  await prisma.like.deleteMany();
  await prisma.question.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Auth Routes", () => {
  it("registers a new user", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "test@test.com",
      password: "password123",
      name: "Test User"
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("token");
  });

  it("fails to register with duplicate email", async () => {
    await request(app).post("/api/auth/register").send({
      email: "test@test.com",
      password: "password123",
      name: "Test User"
    });
    
    const res = await request(app).post("/api/auth/register").send({
      email: "test@test.com",
      password: "password123",
      name: "Test User 2"
    });
    expect(res.status).toBe(409);
  });

  it("logs in an existing user", async () => {
    await request(app).post("/api/auth/register").send({
      email: "test@test.com",
      password: "password123",
      name: "Test User"
    });
    
    const res = await request(app).post("/api/auth/login").send({
      email: "test@test.com",
      password: "password123"
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
  });

  it("fails to login with wrong password", async () => {
    await request(app).post("/api/auth/register").send({
      email: "test@test.com",
      password: "password123",
      name: "Test User"
    });
    
    const res = await request(app).post("/api/auth/login").send({
      email: "test@test.com",
      password: "wrongpassword"
    });
    expect(res.status).toBe(401);
  });
});
it("fails to register with missing fields", async () => {
    const res = await request(app).post("/api/auth/register").send({ 
      email: "test@test.com" 
    });
    expect(res.status).toBe(400);
  });

  it("fails to login with missing fields", async () => {
    const res = await request(app).post("/api/auth/login").send({ 
      email: "test@test.com" 
    });
    expect(res.status).toBe(400);
  });

  it("fails to login with non-existent user", async () => {
    const res = await request(app).post("/api/auth/login").send({ 
      email: "nobody@test.com", 
      password: "password123" 
    });
    expect(res.status).toBe(401);
  });