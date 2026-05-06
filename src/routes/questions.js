const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const prisma = require("../lib/prisma");
const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");

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
    else cb(new Error("Only image files are allowed"));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
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
  try {
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
  } catch (error) {
    res.status(500).json({ message: "Something went wrong fetching questions." });
  }
});

router.get('/:qId', async (req, res) => {
  try {
    const id = parseInt(req.params.qId);
    const question = await prisma.question.findUnique({
      where: { id: id },
      include: { 
        user: true,
        attempts: { where: { userId: req.user.userId } }
      }
    });
    
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }
    res.json(formatQuestion(question));
  } catch (error) {
    res.status(500).json({ message: "Error fetching question." });
  }
});

router.post('/', upload.single("image"), async (req, res) => {
  try {
    const { question, answer } = req.body;
    
    if (!question || !answer) {
      return res.status(400).json({ message: "Question and answer are required!" });
    }

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const newQuestion = await prisma.question.create({
      data: {
        question: question,
        answer: answer,
        imageUrl: imageUrl,
        userId: req.user.userId 
      }
    });

    res.status(201).json(newQuestion);
  } catch (error) {
    res.status(500).json({ message: "Error creating question." });
  }
});

router.put('/:qId', isOwner, upload.single("image"), async (req, res) => {
  try {
    const id = parseInt(req.params.qId);
    const { question, answer } = req.body;
    
    const data = {};
    if (question) data.question = question;
    if (answer) data.answer = answer;
    if (req.file) data.imageUrl = `/uploads/${req.file.filename}`; 
    
    const updatedQuestion = await prisma.question.update({
      where: { id: id },
      data: data
    });

    res.json(updatedQuestion);
  } catch (error) {
    if (error.code === 'P2025') { 
      return res.status(404).json({ message: "Question not found" });
    }
    res.status(500).json({ message: "Error updating question." });
  }
});

router.delete('/:qId', isOwner, async (req, res) => {
  try {
    const id = parseInt(req.params.qId);
    
    const deletedQuestion = await prisma.question.delete({
      where: { id: id }
    });

    res.json({ message: "Question deleted", deleted: deletedQuestion });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: "Question not found" });
    }
    res.status(500).json({ message: "Error deleting question." });
  }
});

router.post('/:qId/play', async (req, res) => {
  try {
    const questionId = parseInt(req.params.qId);
    const { submittedAnswer } = req.body;

    if (!submittedAnswer) {
      return res.status(400).json({ message: "A submittedAnswer is required!" });
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId }
    });

    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    const isCorrect = submittedAnswer.trim().toLowerCase() === question.answer.trim().toLowerCase();

    const attempt = await prisma.attempt.create({
      data: {
        correct: isCorrect,
        submittedAnswer: submittedAnswer,
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
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error processing quiz attempt." });
  }
});

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err?.message === "Only image files are allowed") {
      return res.status(400).json({ message: err.message });
  }
  next(err);
});

module.exports = router;