/**
 * E2E Test Suite Configuration
 * Strictly opaque-box: references external endpoints and test credentials only.
 */

export const CONFIG = {
  // Base URL of the backend REST API
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3001/api/v1',

  // Request timeout in milliseconds
  REQUEST_TIMEOUT_MS: Number(process.env.TEST_TIMEOUT_MS || 10000),

  // Seeded test accounts
  SEEDED_USERS: {
    OWNER: {
      email: process.env.TEST_USER_OWNER_EMAIL || 'budi@rumahkita.local',
      password: process.env.TEST_USER_OWNER_PASSWORD || 'Password123!',
      fullName: 'Budi Santoso',
    },
    MEMBER: {
      email: process.env.TEST_USER_MEMBER_EMAIL || 'ani@rumahkita.local',
      password: process.env.TEST_USER_MEMBER_PASSWORD || 'Password123!',
      fullName: 'Ani Santoso',
    },
    OTHER_HOUSEHOLD: {
      email: process.env.TEST_USER_OTHER_EMAIL || 'joko@rumahkita.local',
      password: process.env.TEST_USER_OTHER_PASSWORD || 'Password123!',
      fullName: 'Joko Anwar',
    },
  },
};
