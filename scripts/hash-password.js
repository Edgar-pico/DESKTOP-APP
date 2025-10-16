// Uso: node scripts/hash-password.js "MiPassword123"
const argon2 = require('argon2');

(async () => {
  const pass = process.argv[2];
  if (!pass) {
    console.error('Uso: node scripts/hash-password.js "MiPassword123"');
    process.exit(1);
  }
  const hash = await argon2.hash(pass, {
    type: argon2.argon2id,
    timeCost: 3,
    memoryCost: 2 ** 16,
    parallelism: 1,
  });
  console.log(hash);
})();