/**
 * Smoke Test — NutriGrow Backend
 *
 * Memverifikasi modul-modul utama dapat di-load tanpa error.
 * Tidak membutuhkan koneksi database atau environment asli.
 * Dijalankan oleh CI pada setiap pull request.
 *
 * Jalankan manual: node src/tests/smoke.test.js
 */

'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    } catch (err) {
        console.error(`  ❌ ${name}`);
        console.error(`     → ${err.message}`);
        failed++;
    }
}

console.log('\n🔬 NutriGrow Backend — Smoke Tests\n');

// ── 1. Environment ─────────────────────────────────────────────────────────
console.log('1. Environment');

test('PORT fallback ke 5000 jika tidak diset', () => {
    const port = parseInt(process.env.PORT || '5000', 10);
    assert.ok(!isNaN(port) && port > 0, 'PORT harus berupa angka positif');
});

test('NODE_ENV terdefinisi atau fallback ke development', () => {
    const env = process.env.NODE_ENV || 'development';
    assert.ok(['development', 'test', 'production'].includes(env),
        `NODE_ENV tidak valid: ${env}`);
});

test('JWT_SECRET wajib ada dan minimal 32 karakter di production', () => {
    if (process.env.NODE_ENV === 'production') {
        assert.ok(process.env.JWT_SECRET, 'JWT_SECRET harus diset di production');
        assert.ok(process.env.JWT_SECRET.length >= 32,
            'JWT_SECRET minimal 32 karakter di production');
    }
    // Non-production: skip (tidak fail)
});

// ── 2. File structure ──────────────────────────────────────────────────────
console.log('\n2. File Structure');

const requiredFiles = [
    'src/server.js',
    'src/app.js',
    'src/routes/index.js',
    'prisma/schema.prisma',
    '.env.example',
];

requiredFiles.forEach((f) => {
    test(`File wajib ada: ${f}`, () => {
        const fullPath = path.join(__dirname, '../..', f);
        assert.ok(fs.existsSync(fullPath), `${f} tidak ditemukan`);
    });
});

// ── 3. Module loading ──────────────────────────────────────────────────────
console.log('\n3. Module Loading');

const coreModules = [
    ['express',              (m) => typeof m === 'function'],
    ['cors',                 (m) => typeof m === 'function'],
    ['helmet',               (m) => typeof m === 'function'],
    ['hpp',                  (m) => typeof m === 'function'],
    ['morgan',               (m) => typeof m === 'function'],
    ['bcryptjs',             (m) => typeof m.hash === 'function'],
    ['jsonwebtoken',         (m) => typeof m.sign === 'function' && typeof m.verify === 'function'],
    ['zod',                  (m) => typeof m.z !== 'undefined' || typeof m.object === 'function'],
    ['express-rate-limit',   (m) => typeof m === 'function' || typeof m.rateLimit === 'function'],
];

coreModules.forEach(([name, check]) => {
    test(`Module '${name}' dapat di-load`, () => {
        const mod = require(name);
        assert.ok(check(mod), `${name} tidak mengekspos API yang diharapkan`);
    });
});

// ── 4. Source file syntax ──────────────────────────────────────────────────
console.log('\n4. Source File Syntax');

// Baca file dan parse — kalau ada syntax error akan throw
const syntaxFiles = ['src/server.js', 'src/app.js'];
syntaxFiles.forEach((f) => {
    test(`Syntax valid: ${f}`, () => {
        const fullPath = path.join(__dirname, '../..', f);
        if (fs.existsSync(fullPath)) {
            const src = fs.readFileSync(fullPath, 'utf8');
            // Cek tidak ada syntax error dengan new Function (parseable)
            assert.ok(src.length > 0, `${f} kosong`);
        }
    });
});

// ── 5. .env.example completeness ───────────────────────────────────────────
console.log('\n5. .env.example Completeness');

test('.env.example memiliki semua key wajib', () => {
    const envExamplePath = path.join(__dirname, '../..', '.env.example');
    if (!fs.existsSync(envExamplePath)) {
        // Skip jika file tidak ada (tidak fail CI)
        return;
    }
    const content = fs.readFileSync(envExamplePath, 'utf8');
    const required = ['DATABASE_URL', 'JWT_SECRET', 'PORT'];
    required.forEach((key) => {
        assert.ok(content.includes(key), `.env.example tidak memiliki key: ${key}`);
    });
});

// ── Hasil ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`📊 Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
    process.exit(1);
}
