const express = require('express');
const router = express.Router();
const prisma = require("../lib/prisma");

// 1. GET all questions 
router.get('/', async (req, res) => {
  try {
    const search = req.query.search;
    
    if (search) {
      const filtered = await prisma.question.findMany({
        where: {
          question: {
            contains: search
          }
        }
      });
      return res.json(filtered);
    }
    
    const allQuestions = await prisma.question.findMany();
    res.json(allQuestions);
  } catch (error) {
    res.status(500).json({ message: "Something went wrong fetching questions." });
  }
});

// 2. GET a specific question
router.get('/:qId', async (req, res) => {
  try {
    const id = parseInt(req.params.qId);
    const question = await prisma.question.findUnique({
      where: { id: id }
    });
    
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }
    res.json(question);
  } catch (error) {
    res.status(500).json({ message: "Error fetching question." });
  }
});

// 3. POST a new question
router.post('/', async (req, res) => {
  try {
    const { question, answer } = req.body;
    
    if (!question || !answer) {
      return res.status(400).json({ message: "Question and answer are required!" });
    }

    const newQuestion = await prisma.question.create({
      data: {
        question: question,
        answer: answer
      }
    });

    res.status(201).json(newQuestion);
  } catch (error) {
    res.status(500).json({ message: "Error creating question." });
  }
});

// 4. PUT a question (edit)
router.put('/:qId', async (req, res) => {
  try {
    const id = parseInt(req.params.qId);
    const { question, answer } = req.body;
    
    // Prisma will throw an error if we try to update a record that doesn't exist, 
    // so we catch it and return a 404
    const updatedQuestion = await prisma.question.update({
      where: { id: id },
      data: {
        ...(question && { question }), // only update if provided
        ...(answer && { answer })
      }
    });

    res.json(updatedQuestion);
  } catch (error) {
    if (error.code === 'P2025') { // Prisma error code for 'Record not found'
      return res.status(404).json({ message: "Question not found" });
    }
    res.status(500).json({ message: "Error updating question." });
  }
});

// 5. DELETE a question
router.delete('/:qId', async (req, res) => {
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

module.exports = router;