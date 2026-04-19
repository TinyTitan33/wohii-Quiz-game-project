// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.question.createMany({
    data: [
      { question: "What is the capital of France?", answer: "Paris" },
      { question: "What is the largest planet in our solar system?", answer: "Jupiter" },
      { question: "How many continents are there?", answer: "7" }
    ],
  });
  console.log("Questions seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });