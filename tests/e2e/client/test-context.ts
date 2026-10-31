/**
 * Shared Test Utilities & Fixture Generators
 * Clean opaque-box helpers that create entities over the public REST API.
 */

import { ApiClient } from './api-client.ts';

export function randomString(len = 6): string {
  return Math.random().toString(36).substring(2, 2 + len);
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export async function createIncomeSourceFixture(
  client: ApiClient,
  customName?: string
): Promise<{ id: string; name: string }> {
  const name = customName || `Gaji Source ${randomString()}`;
  const res = await client.post('/income-sources', {
    name,
    description: 'Auto-generated for E2E testing',
  });
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`Failed to create income source: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { id: res.body.data.id, name };
}

export async function createExpenseCategoryFixture(
  client: ApiClient,
  customName?: string
): Promise<{ id: string; name: string }> {
  const name = customName || `Belanja Cat ${randomString()}`;
  const res = await client.post('/expense-categories', {
    name,
    icon: 'shopping-cart',
    color: '#10B981',
    budgetLimit: 5000000,
  });
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`Failed to create expense category: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { id: res.body.data.id, name };
}

export async function createIncomeCategoryFixture(
  client: ApiClient,
  customName?: string
): Promise<{ id: string; name: string }> {
  const name = customName || `Bonus Cat ${randomString()}`;
  const res = await client.post('/income-categories', {
    name,
    icon: 'briefcase',
    color: '#3B82F6',
  });
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`Failed to create income category: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { id: res.body.data.id, name };
}

export async function createItemFixture(
  client: ApiClient,
  overrides: Partial<{
    name: string;
    unit: string;
    quantityOnHand: number;
    lowStockThreshold: number;
    location: string;
  }> = {}
): Promise<{ id: string; name: string; quantityOnHand: number; lowStockThreshold: number }> {
  const payload = {
    name: overrides.name || `Barang ${randomString()}`,
    unit: overrides.unit || 'pcs',
    quantityOnHand: overrides.quantityOnHand ?? 10,
    lowStockThreshold: overrides.lowStockThreshold ?? 3,
    location: overrides.location || 'Dapur',
    notes: 'E2E item fixture',
  };
  const res = await client.post('/items', payload);
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`Failed to create item: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return {
    id: res.body.data.id,
    name: payload.name,
    quantityOnHand: payload.quantityOnHand,
    lowStockThreshold: payload.lowStockThreshold,
  };
}

export async function createDebtReceivableFixture(
  client: ApiClient,
  overrides: Partial<{
    type: 'payable' | 'receivable';
    partyName: string;
    description: string;
    principalAmount: number;
    dueDate: string;
  }> = {}
): Promise<{ id: string; type: string; principalAmount: number; remainingBalance: number }> {
  const payload = {
    type: overrides.type || 'payable',
    partyName: overrides.partyName || `Pihak ${randomString()}`,
    description: overrides.description || 'Pinjaman Renovasi Rumah',
    principalAmount: overrides.principalAmount || 1000000,
    dueDate: overrides.dueDate || '2026-12-31',
  };
  const res = await client.post('/debts-receivables', payload);
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`Failed to create debt: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return {
    id: res.body.data.id,
    type: payload.type,
    principalAmount: payload.principalAmount,
    remainingBalance: res.body.data.remainingBalance ?? payload.principalAmount,
  };
}
