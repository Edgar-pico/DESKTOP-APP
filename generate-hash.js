const argon2 = require('argon2');

async function generateHash() {
    const newPassword = 'Calidad123'; // Cambia esto
    const hash = await argon2.hash(newPassword);
    console.log('Nuevo hash:', hash);
}

generateHash();