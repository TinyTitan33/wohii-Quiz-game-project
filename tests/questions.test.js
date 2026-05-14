const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const prisma = require("../src/lib/prisma");

let token;
let testUserId;

beforeEach(async () => {
  await prisma.attempt.deleteMany();
  await prisma.like.deleteMany();
  await prisma.question.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: {
      email: "quizmaster@test.com",
      password: "hashedpassword",
      name: "Quiz Master"
    }
  });
  
  testUserId = user.id;
  token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "1h" });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Questions Routes", () => {
  it("prevents unauthenticated access", async () => {
    const res = await request(app).get("/api/questions");
    expect(res.status).toBe(401);
  });

  it("creates a new question", async () => {
    const res = await request(app)
      .post("/api/questions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        question: "What is 2+2?",
        answer: "4"
      });
      
    expect(res.status).toBe(201);
    expect(res.body.question).toBe("What is 2+2?");
  });

  it("fails to create a question with missing data", async () => {
    const res = await request(app)
      .post("/api/questions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        question: "What is missing?"
      });
      
    expect(res.status).toBe(400);
  });

  it("fetches a list of questions", async () => {
    await prisma.question.create({
      data: { question: "Q1", answer: "A1", userId: testUserId }
    });

    const res = await request(app)
      .get("/api/questions")
      .set("Authorization", `Bearer ${token}`);
      
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });

  it("allows the owner to delete their question", async () => {
    const question = await prisma.question.create({
      data: { question: "Delete me", answer: "OK", userId: testUserId }
    });

    const res = await request(app)
      .delete(`/api/questions/${question.id}`)
      .set("Authorization", `Bearer ${token}`);
      
    expect(res.status).toBe(200);
  });

  it("allows a user to submit an answer", async () => {
    const question = await prisma.question.create({
      data: { question: "Capital of France?", answer: "Paris", userId: testUserId }
    });

    const res = await request(app)
      .post(`/api/questions/${question.id}/play`)
      .set("Authorization", `Bearer ${token}`)
      .send({ submittedAnswer: "paris" });
      
    expect(res.status).toBe(201);
    expect(res.body.correct).toBe(true);
  });
});
it("fails to authenticate with an invalid token", async () => {
    const res = await request(app)
      .get("/api/questions")
      .set("Authorization", "Bearer totally.fake.token");
    expect(res.status).toBe(403);
  });

  it("fetches a single question by ID", async () => {
    const question = await prisma.question.create({
      data: { question: "Q2", answer: "A2", userId: testUserId }
    });
    const res = await request(app)
      .get(`/api/questions/${question.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.question).toBe("Q2");
  });

  it("returns 404 for a non-existent question", async () => {
    const res = await request(app)
      .get("/api/questions/99999")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("updates a question as the owner", async () => {
    const question = await prisma.question.create({
      data: { question: "Old Q", answer: "Old A", userId: testUserId }
    });
    const res = await request(app)
      .put(`/api/questions/${question.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ question: "New Q" });
    expect(res.status).toBe(200);
    expect(res.body.question).toBe("New Q");
  });

  it("fails to update someone else's question", async () => {
    const otherUser = await prisma.user.create({
      data: { email: "other@test.com", password: "pass", name: "Other" }
    });
    const question = await prisma.question.create({
      data: { question: "Other Q", answer: "Other A", userId: otherUser.id }
    });
    const res = await request(app)
      .put(`/api/questions/${question.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ question: "Sneaky Q" });
    expect(res.status).toBe(403);
  });

  it("fails to delete someone else's question", async () => {
    const otherUser = await prisma.user.create({
      data: { email: "other2@test.com", password: "pass", name: "Other" }
    });
    const question = await prisma.question.create({
      data: { question: "Other Q", answer: "Other A", userId: otherUser.id }
    });
    const res = await request(app)
      .delete(`/api/questions/${question.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("returns 404 when playing a non-existent question", async () => {
    const res = await request(app)
      .post(`/api/questions/99999/play`)
      .set("Authorization", `Bearer ${token}`)
      .send({ submittedAnswer: "paris" });
    expect(res.status).toBe(404);
  });