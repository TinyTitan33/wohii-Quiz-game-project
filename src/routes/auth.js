const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");
const { ValidationError, ConflictError, UnauthorizedError } = require("../lib/errors");

const SECRET = process.env.JWT_SECRET;

router.post("/register", async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    throw new ValidationError("email, password and name are required");
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new ConflictError("Email already registered");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { email, password: hashedPassword, name },
  });

  const token = jwt.sign({ userId: user.id, role: user.role }, SECRET, { expiresIn: "1h" });

  res.status(201).json({
    message: "User registered successfully",
    token,
  });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ValidationError("email and password are required");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new UnauthorizedError("Invalid credentials");
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    throw new UnauthorizedError("Invalid credentials");
  }

  const token = jwt.sign({ userId: user.id, role: user.role }, SECRET, { expiresIn: "1h" });

  res.json({
    message: "Logged in successfully",
    token,
  });
});

router.get("/leaderboard", async (req, res) => {
  const users = await prisma.user.findMany({
    include: {
      attempts: {
        where: { correct: true }
      }
    }
  });

  const leaderboard = users.map(user => ({
    id: user.id,
    name: user.name,
    successfulAttempts: user.attempts.length
  }))
  .sort((a, b) => b.successfulAttempts - a.successfulAttempts)
  .slice(0, 5);

  res.json(leaderboard);
});

module.exports = router;