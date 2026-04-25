const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash("1234", 10);
  const user = await prisma.user.create({
    data: {
      email: "admin@example.com",
      password: hashedPassword,
      name: "Admin User",
    },
  });

  console.log("Created user:", user.email);

  await prisma.question.createMany({
    data: [
      { question: "What is the capital of France?", answer: "Paris", userId: user.id },
      { question: "What is the largest planet in our solar system?", answer: "Jupiter", userId: user.id },
      { question: "How many continents are there?", answer: "7", userId: user.id }
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