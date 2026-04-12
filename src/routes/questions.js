const express = require('express');
const router = express.Router();
const questions = require('../data/questions');

// 1. GET questions 
router.get('/', (req, res) => {
  const search = req.query.search; 
  
  if (search) {
    const filtered = questions.filter(q => 
      q.question.toLowerCase().includes(search.toLowerCase())
    );
    return res.json(filtered);
  }
  res.json(questions);
});

// 2. GET a specific question 
router.get('/:qId', (req, res) => {
  const id = parseInt(req.params.qId);
  const question = questions.find(q => q.id === id);
  
  if (!question) {
    return res.status(404).json({ message: "Question not found" });
  }
  res.json(question);
});

// 3. POST a new question
router.post('/', (req, res) => {
  // get data from the body
  const question = req.body.question;
  const answer = req.body.answer;
  
  if (!question || !answer) {
    return res.status(400).json({ message: " question and answer are required!" });
  }

  //  make a new ID
  const newId = questions.length + 1;
  
  const newQuestion = {
    id: newId,
    question: question,
    answer: answer
  };

  questions.push(newQuestion);
  res.status(201).json(newQuestion);
});

// 4. PUT a question (edit)
router.put('/:qId', (req, res) => {
  const id = parseInt(req.params.qId);
  
  // get data from the body
  const question = req.body.question;
  const answer = req.body.answer;
  
  const questionIndex = questions.findIndex(q => q.id === id);
  
  if (questionIndex === -1) {
    return res.status(404).json({ message: "Question not found" });
  }

  // Update the fields
  if (question) questions[questionIndex].question = question;
  if (answer) questions[questionIndex].answer = answer;

  res.json(questions[questionIndex]);
});

// 5. DELETE a question
router.delete('/:qId', (req, res) => {
  const id = parseInt(req.params.qId);
  const questionIndex = questions.findIndex(q => q.id === id);
  
  if (questionIndex === -1) {
    return res.status(404).json({ message: "Question not found" });
  }

  const deletedQuestion = questions.splice(questionIndex, 1);
  res.json({ message: "Question deleted", deleted: deletedQuestion[0] });
});

module.exports = router;