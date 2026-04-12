const express = require('express');
const questionsRouter = require('./routes/questions');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// the  router
app.use('/api/questions', questionsRouter);

// 
app.use((req, res) => {
  res.status(404).json({ message: "not found." });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});