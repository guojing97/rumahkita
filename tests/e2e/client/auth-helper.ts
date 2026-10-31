/**
 * Auth Helper for E2E Tests
 * Provides authentication workflows, session creation, and multi-tenant test clients.
 */

import { ApiClient } from './api-client.ts';
import { CONFIG } from '../config.ts';

export interface LoginResult {
  accessToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
  };
  household: {
    id: string;
    name: string;
    role: string;
  };
}

export async function loginAs(
  client: ApiClient,
  email: string,
  password: string
): Promise<LoginResult> {
  const res = await client.post('/auth/login', { email, password });
  if (res.status !== 200 || !res.body?.data?.accessToken) {
    throw new Error(
      `Login failed for ${email} with status ${res.status}: ${JSON.stringify(res.body)}`
    );
  }

  const { accessToken, user, household } = res.body.data;
  client.setBearerToken(accessToken);
  return { accessToken, user, household };
}

export async function getOwnerClient(): Promise<{ client: ApiClient; auth: LoginResult }> {
  const client = new ApiClient();
  const auth = await loginAs(
    client,
    CONFIG.SEEDED_USERS.OWNER.email,
    CONFIG.SEEDED_USERS.OWNER.password
  );
  return { client, auth };
}

export async function getMemberClient(): Promise<{ client: ApiClient; auth: LoginResult }> {
  const client = new ApiClient();
  const auth = await loginAs(
    client,
    CONFIG.SEEDED_USERS.MEMBER.email,
    CONFIG.SEEDED_USERS.MEMBER.password
  );
  return { client, auth };
}

export async function getOtherHouseholdClient(): Promise<{ client: ApiClient; auth: LoginResult }> {
  const client = new ApiClient();
  const auth = await loginAs(
    client,
    CONFIG.SEEDED_USERS.OTHER_HOUSEHOLD.email,
    CONFIG.SEEDED_USERS.OTHER_HOUSEHOLD.password
  );
  return { client, auth };
}
