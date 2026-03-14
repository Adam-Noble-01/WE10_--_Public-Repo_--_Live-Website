// =============================================================================
// NOBLE ARCHITECTURE - PAYMENT DETAILS ENCRYPTION UTILITY
// =============================================================================
//
// FILE       : InvoiceSystem__EncryptPaymentDetails__.js
// PURPOSE    : Encrypts PaymentDetails__BankTransfer__.json for Cloudflare R2
// USAGE      : node InvoiceSystem__EncryptPaymentDetails__.js [passphrase]
// CREATED    : 14-Mar-2026
//
// DESCRIPTION:
// - Reads the plaintext PaymentDetails__BankTransfer__.json from this folder
// - Encrypts using AES-256-GCM with a passphrase-derived key (PBKDF2)
// - Outputs PaymentDetails__BankTransfer__.json.enc in the same folder
// - The .enc file should be manually uploaded to Cloudflare R2 at:
//   NaProjectPortal/SharedData/PaymentDetails__BankTransfer__.json.enc
//
// =============================================================================

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

const INPUT_FILE  = path.join(__dirname, 'PaymentDetails__BankTransfer__.json');
const OUTPUT_FILE = path.join(__dirname, 'PaymentDetails__BankTransfer__.json.enc');

const ALGORITHM   = 'aes-256-gcm';
const KEY_LENGTH  = 32;
const IV_LENGTH   = 12;
const SALT_LENGTH = 16;
const ITERATIONS  = 100000;
const DIGEST      = 'sha256';

// FUNCTION | Derive Key from Passphrase
// ------------------------------------------------------------
function deriveKey(passphrase, salt) {
    return crypto.pbkdf2Sync(passphrase, salt, ITERATIONS, KEY_LENGTH, DIGEST);
}

// FUNCTION | Encrypt Data
// ------------------------------------------------------------
function encryptPaymentDetails(passphrase) {
    if (!fs.existsSync(INPUT_FILE)) {
        console.error(`[ERROR] Input file not found: ${INPUT_FILE}`);
        console.error('Create PaymentDetails__BankTransfer__.json first.');
        process.exit(1);
    }

    const plaintext = fs.readFileSync(INPUT_FILE, 'utf8');

    JSON.parse(plaintext);

    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv   = crypto.randomBytes(IV_LENGTH);
    const key  = deriveKey(passphrase, salt);

    const cipher     = crypto.createCipheriv(ALGORITHM, key, iv);
    let ciphertext   = cipher.update(plaintext, 'utf8', 'base64');
    ciphertext      += cipher.final('base64');
    const authTag    = cipher.getAuthTag();

    const payload = {
        algorithm      : ALGORITHM,
        salt           : salt.toString('base64'),
        iv             : iv.toString('base64'),
        authTag        : authTag.toString('base64'),
        ciphertext     : ciphertext,
        iterations     : ITERATIONS,
        encryptedAt    : new Date().toISOString()
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2), 'utf8');

    console.log('[OK] Payment details encrypted successfully.');
    console.log(`     Output: ${OUTPUT_FILE}`);
    console.log('');
    console.log('Next steps:');
    console.log('1. Upload the .enc file to Cloudflare R2 at:');
    console.log('   NaProjectPortal/SharedData/PaymentDetails__BankTransfer__.json.enc');
    console.log('2. Ensure the decryption passphrase matches in the client fetcher.');
}

// MAIN
// ------------------------------------------------------------
const passphrase = process.argv[2];

if (!passphrase) {
    console.error('Usage: node InvoiceSystem__EncryptPaymentDetails__.js <passphrase>');
    console.error('');
    console.error('The passphrase is used to derive the encryption key.');
    console.error('The same passphrase must be used for client-side decryption.');
    process.exit(1);
}

encryptPaymentDetails(passphrase);
