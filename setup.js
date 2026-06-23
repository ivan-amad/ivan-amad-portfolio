/**
 * One-time setup script — run this ONCE to set your admin password.
 * Usage:  node setup.js
 * It will ask for a password and write the hash to your .env file.
 */

const bcrypt   = require('bcryptjs');
const fs       = require('fs');
const path     = require('path');
const readline = require('readline');

const ENV_FILE = path.join(__dirname, '.env');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(q) {
  return new Promise(resolve => {
    // Hide input (Unix) — best effort
    if (process.stdout.isTTY) {
      const write = process.stdout.write.bind(process.stdout);
      process.stdout.write = () => {};
      rl.question(q, ans => { process.stdout.write = write; process.stdout.write('\n'); resolve(ans); });
    } else {
      rl.question(q, resolve);
    }
  });
}

(async () => {
  console.log('\n◼ Ivan Amad Portfolio — Setup\n');

  const pw1 = await ask('Enter admin password: ');
  if (!pw1 || pw1.length < 4) {
    console.error('Password too short (min 4 chars)'); process.exit(1);
  }
  const pw2 = await ask('Confirm admin password: ');
  if (pw1 !== pw2) {
    console.error('Passwords do not match'); process.exit(1);
  }

  const hash = await bcrypt.hash(pw1, 12);

  // Read or create .env
  let env = '';
  if (fs.existsSync(ENV_FILE)) {
    env = fs.readFileSync(ENV_FILE, 'utf-8');
  } else {
    // Bootstrap from example
    const ex = path.join(__dirname, '.env.example');
    if (fs.existsSync(ex)) env = fs.readFileSync(ex, 'utf-8');
  }

  // Replace or insert ADMIN_PASSWORD_HASH
  if (env.includes('ADMIN_PASSWORD_HASH=')) {
    env = env.replace(/^ADMIN_PASSWORD_HASH=.*$/m, `ADMIN_PASSWORD_HASH=${hash}`);
  } else {
    env += `\nADMIN_PASSWORD_HASH=${hash}\n`;
  }

  // Ensure SESSION_SECRET is set to something
  if (env.includes('SESSION_SECRET=change-this') || env.match(/^SESSION_SECRET=\s*$/m)) {
    const rand = require('crypto').randomBytes(32).toString('hex');
    env = env.replace(/^SESSION_SECRET=.*$/m, `SESSION_SECRET=${rand}`);
  }

  fs.writeFileSync(ENV_FILE, env);
  rl.close();

  console.log('\n✓ .env file updated with hashed password.');
  console.log('✓ Start the server:  npm start\n');
})();
