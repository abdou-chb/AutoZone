require("dotenv").config({ quiet: true });

const readline = require("readline");
const bcrypt = require("bcryptjs");
const db = require("./database");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
let hidden = false;

rl._writeToOutput = (text) => {
  rl.output.write(hidden && !text.includes("\n") ? "*" : text);
};

function ask(question, secret = false) {
  return new Promise((resolve) => {
    hidden = false;
    rl.output.write(question);
    hidden = secret;
    rl.question("", (answer) => {
      hidden = false;

      if (secret) {
        rl.output.write("\n");
      }

      resolve(answer.trim());
    });
  });
}

(async () => {
  const admins = db.prepare("SELECT id, email, role FROM admins ORDER BY id").all();

  console.log("Admin accounts:");
  admins.forEach((admin) => console.log(`  ${admin.email} (${admin.role})`));

  const email = (await ask(`Email [${admins[0]?.email || "admin@autozone.dz"}]: `)) || admins[0]?.email;
  const admin = db.prepare("SELECT id FROM admins WHERE email = ?").get(email);

  if (!admin) {
    console.log("No account with this email.");
    rl.close();
    return;
  }

  const password = await ask("New password (at least 10 characters): ", true);
  const again = await ask("Type it again: ", true);

  if (password.length < 10 || password !== again) {
    console.log(password !== again ? "The two passwords are different." : "The password is too short.");
    rl.close();
    return;
  }

  db.prepare(
    "UPDATE admins SET password_hash = ?, active = 1, must_change_password = 0, token_version = token_version + 1 WHERE id = ?"
  ).run(await bcrypt.hash(password, 12), admin.id);
  console.log(`Password updated for ${email}. You can log in at /admin/login.`);
  rl.close();
})();
