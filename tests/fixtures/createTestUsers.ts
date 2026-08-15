import * as bcrypt from 'bcryptjs';
import { pool } from '../../app/config/db';

const TEST_OWNER_EMAIL = 'test-owner@playwright.local';
const TEST_PHARMACY_NAME = 'Playwright Test Pharmacy';
const TEST_MEDICINE_STOCK = 25;
const TEST_MEDICINE_PRICE = 9.99;

async function createTestUsers() {
  const passwords = {
    user: process.env.PLAYWRIGHT_TEST_PASSWORD_USER,
    owner: process.env.PLAYWRIGHT_TEST_PASSWORD_OWNER,
    admin: process.env.PLAYWRIGHT_TEST_PASSWORD_ADMIN,
  };

  const missing = Object.entries(passwords)
    .filter(([, v]) => !v)
    .map(([k]) => `PLAYWRIGHT_TEST_PASSWORD_${k.toUpperCase()}`);

  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  const rounds = 10;
  const users = [
    { email: 'test-user@playwright.local', role: 'user', password: passwords.user! },
    { email: TEST_OWNER_EMAIL, role: 'pharmacy_owner', password: passwords.owner! },
    { email: 'test-admin@playwright.local', role: 'admin', password: passwords.admin! },
  ];

  const connection = await pool.getConnection();
  try {
    for (const u of users) {
      const hash = await bcrypt.hash(u.password, rounds);
      await connection.query(
        `INSERT INTO users (name, email, password_hash, role, status, phone, address)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           password_hash = VALUES(password_hash),
           role = VALUES(role),
           status = 'active'`,
        [u.email.split('@')[0], u.email, hash, u.role, 'active', null, null]
      );
      console.log(`Created/updated test user: ${u.email}`);
    }

    const [ownerRows] = await connection.query(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [TEST_OWNER_EMAIL],
    );
    const ownerId = (ownerRows as Array<{ id: number }>)[0]?.id;
    if (!ownerId) {
      throw new Error(`Could not find test owner: ${TEST_OWNER_EMAIL}`);
    }

    const [pharmacyRows] = await connection.query(
      'SELECT id FROM pharmacies WHERE name = ? AND owner_user_id = ? LIMIT 1',
      [TEST_PHARMACY_NAME, ownerId],
    );
    let pharmacyId = (pharmacyRows as Array<{ id: number }>)[0]?.id;

    if (!pharmacyId) {
      const [result] = await connection.query(
        `INSERT INTO pharmacies
           (name, address, city, state, phone, status, owner_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          TEST_PHARMACY_NAME,
          '1 Playwright Test Way',
          'Test City',
          'Test State',
          '+1-555-0199',
          'active',
          ownerId,
        ],
      );
      pharmacyId = (result as { insertId: number }).insertId;
    }

    const [medicineRows] = await connection.query(
      "SELECT id FROM medicines WHERE status = 'active' ORDER BY id ASC LIMIT 1",
    );
    const medicineId = (medicineRows as Array<{ id: number }>)[0]?.id;
    if (!medicineId) {
      throw new Error('Could not find an active medicine for test inventory');
    }

    await connection.query(
      `INSERT INTO pharmacy_inventory
         (pharmacy_id, medicine_id, stock_quantity, availability, selling_price)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         stock_quantity = VALUES(stock_quantity),
         availability = VALUES(availability),
         selling_price = VALUES(selling_price)`,
      [
        pharmacyId,
        medicineId,
        TEST_MEDICINE_STOCK,
        1,
        TEST_MEDICINE_PRICE,
      ],
    );

    console.log(`Created/updated test pharmacy: ${TEST_PHARMACY_NAME}`);
  } finally {
    connection.release();
  }
}

export default async () => {
  await createTestUsers();
};
