
const bcrypt = require("bcryptjs");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Enter your admin password: ", async (password) => {
  if (password.length < 12) {
    console.log("Password must be at least 12 characters.");
    rl.close();
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  console.log("\nYour encrypted password:\n");
  console.log(hashedPassword);

  rl.close();
});
