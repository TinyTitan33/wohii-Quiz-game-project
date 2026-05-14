const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const { z } = require('zod');
const prisma = require("../lib/prisma");
const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");
const { NotFoundError, ValidationError } = require("../lib/errors");

const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "..", "public", "uploads"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new ValidationError("Only image files are allowed"));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

const QuestionInput = z.object({
  question: z.string().min(1),
  answer: z.string().min(1)
});

const QuestionUpdateInput = z.object({
  question: z.string().min(1).optional(),
  answer: z.string().min(1).optional()
});

const PlayInput = z.object({
  submittedAnswer: z.string().min(1)
});

function formatQuestion(question) {
  return {
    ...question,
    userName: question.user?.name || null,
    solved: question.attempts ? question.attempts.some(a => a.correct) : false,
    user: undefined, 
    attempts: undefined,
  };
}

router.use(authenticate);

router.get('/', async (req, res) => {
  const search = req.query.search;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 5));
  const skip = (page - 1) * limit;

  const where = search ? { question: { contains: search } } : {};

  const [questions, total] = await Promise.all([
    prisma.question.findMany({
      where,
      include: { 
        user: true,
        attempts: { where: { userId: req.user.userId } }
      },
      orderBy: { id: "asc" },
      skip,
      take: limit,
    }),
    prisma.question.count({ where }),
  ]);

  res.json({
    data: questions.map(formatQuestion),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});

router.get('/:qId', async (req, res) => {
  const id = parseInt(req.params.qId);
  const question = await prisma.question.findUnique({
    where: { id: id },
    include: { 
      user: true,
      attempts: { where: { userId: req.user.userId } }
    }
  });
  
  if (!question) {
    throw new NotFoundError("Question not found");
  }
  res.json(formatQuestion(question));
});

router.post('/', upload.single("image"), async (req, res) => {
  const data = QuestionInput.parse(req.body);

  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  const newQuestion = await prisma.question.create({
    data: {
      question: data.question,
      answer: data.answer,
      imageUrl: imageUrl,
      userId: req.user.userId 
    }
  });

  res.status(201).json(newQuestion);
});

router.put('/:qId', isOwner, upload.single("image"), async (req, res) => {
  const id = parseInt(req.params.qId);
  const data = QuestionUpdateInput.parse(req.body);
  
  const updateData = {};
  if (data.question) updateData.question = data.question;
  if (data.answer) updateData.answer = data.answer;
  if (req.file) updateData.imageUrl = `/uploads/${req.file.filename}`; 
  
  try {
    const updatedQuestion = await prisma.question.update({
      where: { id: id },
      data: updateData
    });
    res.json(updatedQuestion);
  } catch (error) {
    if (error.code === 'P2025') { 
      throw new NotFoundError("Question not found");
    }
    throw error;
  }
});

router.delete('/:qId', isOwner, async (req, res) => {
  const id = parseInt(req.params.qId);
  
  try {
    const deletedQuestion = await prisma.question.delete({
      where: { id: id }
    });
    res.json({ message: "Question deleted", deleted: deletedQuestion });
  } catch (error) {
    if (error.code === 'P2025') {
      throw new NotFoundError("Question not found");
    }
    throw error;
  }
});

router.post('/:qId/play', async (req, res) => {
  const questionId = parseInt(req.params.qId);
  const data = PlayInput.parse(req.body);

  const question = await prisma.question.findUnique({
    where: { id: questionId }
  });

  if (!question) {
    throw new NotFoundError("Question not found");
  }

  const isCorrect = data.submittedAnswer.trim().toLowerCase() === question.answer.trim().toLowerCase();

  const attempt = await prisma.attempt.create({
    data: {
      correct: isCorrect,
      submittedAnswer: data.submittedAnswer,
      correctAnswer: question.answer,
      userId: req.user.userId,
      questionId: questionId
    }
  });

  res.status(201).json({
    id: attempt.id,
    correct: attempt.correct,
    submittedAnswer: attempt.submittedAnswer,
    correctAnswer: attempt.correctAnswer,
    createdAt: attempt.createdAt
  });
});

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err?.message === "Only image files are allowed") {
      return res.status(400).json({ message: err.message });
  }
  next(err);
});

module.exports = router;