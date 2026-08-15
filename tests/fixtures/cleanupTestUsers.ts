import { pool } from '../../app/config/db';

const TEST_OWNER_EMAIL = 'test-owner@playwright.local';
const TEST_PHARMACY_NAME = 'Playwright Test Pharmacy';

async function cleanupTestUsers() {
  const connection = await pool.getConnection();
  try {
    const [pharmacyRows] = await connection.query(
      `SELECT p.id
       FROM pharmacies p
       INNER JOIN users u ON u.id = p.owner_user_id
       WHERE p.name = ? AND u.email = ?
       LIMIT 1`,
      [TEST_PHARMACY_NAME, TEST_OWNER_EMAIL],
    );
    const pharmacyId = (pharmacyRows as Array<{ id: number }>)[0]?.id;

    if (pharmacyId) {
      await connection.query(
        'DELETE FROM pharmacy_inventory WHERE pharmacy_id = ?',
        [pharmacyId],
      );
      await connection.query('DELETE FROM pharmacies WHERE id = ?', [pharmacyId]);
    }

    const [result] = await connection.query(
      `DELETE FROM users WHERE email IN (?, ?, ?)`,
      [
        'test-user@playwright.local',
        'test-owner@playwright.local',
        'test-admin@playwright.local',
      ]
    );
    console.log(`Cleaned up test users. Deleted: ${(result as any).affectedRows}`);
  } finally {
    connection.release();
  }
}

export default async () => {
  await cleanupTestUsers();
};
