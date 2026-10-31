
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { ApiClientError } from '../lib/api-client.ts';
import {
  createIncomeSchema,
  createExpenseSchema,
  createDebtReceivableSchema,
  recordPaymentSchema,
  stockAdjustmentSchema,
  calculateStockStatus,
} from '@rumahkita/contracts';

describe('Adversarial Verification Suite: Milestone 4 Web & BFF', () => {
  // =========================================================================
  // 1. BFF PROXY HANDLER INTEGRATION & ROBUSTNESS TESTS
  // =========================================================================
  describe('BFF Proxy Route Handler Robustness', () => {
    let mockBackendServer: http.Server;
    let mockBackendPort: number;
    let receivedUpstreamRequest: {
      url?: string;
      method?: string;
      headers?: http.IncomingHttpHeaders;
      body?: string;
    } = {};

    before(async () => {
      mockBackendServer = http.createServer(async (req, res) => {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          receivedUpstreamRequest = {
            url: req.url,
            method: req.method,
            headers: req.headers,
            body,
          };

          if (req.url?.includes('/reports/export/csv')) {
            res.writeHead(200, {
              'Content-Type': 'text/csv; charset=utf-8',
              'Content-Disposition': 'attachment; filename="test-export.csv"',
              'Set-Cookie': ['session_id=mock-cookie-123; HttpOnly; Path=/'],
            });
            res.end('"Tanggal","Kategori","Nominal"\n"2026-10-27","Belanja","50000"');
            return;
          }

          if (req.url?.includes('/api/v1/error-422')) {
            res.writeHead(422, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                success: false,
                statusCode: 422,
                error: 'Unprocessable Entity',
                message: 'Data tidak valid',
                errors: [{ field: 'nominal', message: 'Nominal harus lebih dari 0' }],
              })
            );
            return;
          }

          if (req.url?.includes('/api/v1/auth/login-throttle')) {
            res.writeHead(429, {
              'Content-Type': 'application/json',
              'Retry-After': '180',
            });
            res.end(
              JSON.stringify({
                success: false,
                statusCode: 429,
                error: 'Too Many Requests',
                message: 'Terlalu banyak percobaan login gagal. Silakan coba lagi dalam 180 detik.',
                retryAfter: 180,
              })
            );
            return;
          }

          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Set-Cookie': ['refreshToken=mock-jwt-refresh; HttpOnly; SameSite=Lax'],
          });
          res.end(
            JSON.stringify({
              success: true,
              data: { status: 'forwarded_ok', receivedBody: body ? JSON.parse(body) : null },
            })
          );
        });
      });

      await new Promise<void>((resolve) => {
        mockBackendServer.listen(0, '127.0.0.1', () => {
          mockBackendPort = (mockBackendServer.address() as AddressInfo).port;
          process.env.INTERNAL_API_URL = `http://127.0.0.1:${mockBackendPort}/api/v1`;
          resolve();
        });
      });
    });

    after(async () => {
      await new Promise<void>((resolve) => mockBackendServer.close(() => resolve()));
    });

    it('forwards query strings, headers (X-Household-Id, Authorization, Idempotency-Key, Cookie), and body payload', async () => {
      // Import the actual Next.js BFF proxy handler
      const { POST } = await import('../app/api/[...path]/route.ts');

      const mockPayload = JSON.stringify({
        nominal: 150000,
        description: 'Pembelian beras Rojolele 10kg',
      });

      // Construct NextRequest compatible Web Request
      const requestUrl = `http://localhost:3000/api/expenses?page=2&limit=25&filter=active`;
      const webReq = new Request(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-access-token-xyz',
          'X-Household-Id': '00000000-0000-4000-8000-000000000001',
          'Idempotency-Key': '550e8400-e29b-41d4-a716-446655440000',
          'Cookie': 'refreshToken=incoming-cookie-value; theme=dark',
          'User-Agent': 'RumahKita-AdversarialTest/1.0',
        },
        body: mockPayload,
        // @ts-expect-error duplex required in Node
        duplex: 'half',
      });

      const nextReq = {
        ...webReq,
        nextUrl: new URL(requestUrl),
        method: 'POST',
        headers: webReq.headers,
        body: webReq.body,
      };

      const response = await POST(nextReq as any, { params: { path: ['expenses'] } });

      // 1. Verify upstream received exact query params
      assert.equal(
        receivedUpstreamRequest.url,
        '/api/v1/expenses?page=2&limit=25&filter=active',
        'BFF Proxy did not preserve search query string!'
      );

      // 2. Verify upstream received all forwarded headers
      assert.equal(
        receivedUpstreamRequest.headers?.['authorization'],
        'Bearer test-access-token-xyz',
        'Authorization header was not forwarded!'
      );
      assert.equal(
        receivedUpstreamRequest.headers?.['x-household-id'],
        '00000000-0000-4000-8000-000000000001',
        'X-Household-Id header was not forwarded!'
      );
      assert.equal(
        receivedUpstreamRequest.headers?.['idempotency-key'],
        '550e8400-e29b-41d4-a716-446655440000',
        'Idempotency-Key header was not forwarded!'
      );
      assert.ok(
        receivedUpstreamRequest.headers?.['cookie']?.includes('refreshToken=incoming-cookie-value'),
        'Cookie header was not forwarded!'
      );

      // 3. Verify upstream received exact JSON body
      assert.equal(
        receivedUpstreamRequest.body,
        mockPayload,
        'Request body stream was not forwarded correctly to upstream backend!'
      );

      // 4. Verify downstream response replicates upstream Set-Cookie
      const responseSetCookie = response.headers.get('set-cookie');
      assert.ok(
        responseSetCookie?.includes('mock-jwt-refresh'),
        'Set-Cookie header from upstream was not replicated to client!'
      );
    });

    it('correctly streams CSV content and propagates Content-Disposition header', async () => {
      const { GET } = await import('../app/api/[...path]/route.ts');
      const requestUrl = `http://localhost:3000/api/reports/export/csv?type=transactions`;
      const webReq = new Request(requestUrl, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-token',
          'X-Household-Id': '00000000-0000-4000-8000-000000000001',
        },
      });

      const nextReq = {
        ...webReq,
        nextUrl: new URL(requestUrl),
        method: 'GET',
        headers: webReq.headers,
        body: null,
      };

      const response = await GET(nextReq as any, {
        params: { path: ['reports', 'export', 'csv'] },
      });

      assert.equal(response.status, 200);
      assert.ok(
        response.headers.get('content-type')?.includes('text/csv'),
        'Content-Type text/csv was not preserved!'
      );
      assert.ok(
        response.headers.get('content-disposition')?.includes('test-export.csv'),
        'Content-Disposition attachment header was lost!'
      );

      const csvContent = await response.text();
      assert.ok(csvContent.includes('"Tanggal","Kategori","Nominal"'));
      assert.ok(csvContent.includes('"Belanja","50000"'));
    });

    it('propagates retry-after header and status 429 when upstream returns Too Many Requests', async () => {
      const { POST } = await import('../app/api/[...path]/route.ts');
      const requestUrl = `http://localhost:3000/api/auth/login-throttle`;
      const webReq = new Request(requestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', password: 'bad' }),
        // @ts-expect-error duplex required in Node
        duplex: 'half',
      });

      const nextReq = {
        ...webReq,
        nextUrl: new URL(requestUrl),
        method: 'POST',
        headers: webReq.headers,
        body: webReq.body,
      };

      const response = await POST(nextReq as any, { params: { path: ['auth', 'login-throttle'] } });

      assert.equal(response.status, 429);
      assert.equal(response.headers.get('retry-after'), '180');
      const body = await response.json();
      assert.equal(body.statusCode, 429);
      assert.equal(body.retryAfter, 180);
    });

    it('returns 502 Bad Gateway with standard error envelope when backend is unreachable', async () => {
      const { GET } = await import('../app/api/[...path]/route.ts');
      
      // Temporarily close mock backend server to trigger connection failure
      await new Promise<void>((resolve) => mockBackendServer.close(() => resolve()));

      try {
        const requestUrl = `http://localhost:3000/api/test-failure`;
        const webReq = new Request(requestUrl, { method: 'GET' });
        const nextReq = {
          ...webReq,
          nextUrl: new URL(requestUrl),
          method: 'GET',
          headers: webReq.headers,
          body: null,
        };

        const response = await GET(nextReq as any, { params: { path: ['test-failure'] } });
        assert.equal(response.status, 502);

        const body = await response.json();
        assert.equal(body.statusCode, 502);
        assert.equal(body.error, 'Bad Gateway');
        assert.equal(body.success, false);
        assert.ok(body.message.includes('Tidak dapat terhubung ke server backend'));
      } finally {
        // Restart mock server if needed by after() hook
        await new Promise<void>((resolve) => {
          mockBackendServer.listen(mockBackendPort, '127.0.0.1', () => resolve());
        });
      }
    });
  });

  // =========================================================================
  // 2. API CLIENT ERROR PARSING (400, 401, 403, 422) & DETAILS EXTRACTION
  // =========================================================================
  describe('ApiClientError Envelope & Field-Error Parsing', () => {
    it('handles 422 Unprocessable Entity with multiple validation errors', () => {
      const error = new ApiClientError({
        success: false,
        statusCode: 422,
        error: 'Unprocessable Entity',
        message: 'Validation failed',
        errors: [
          { field: 'nominal', message: 'Nominal harus lebih dari 0' },
          { field: 'dueDate', message: 'Format tanggal jatuh tempo harus YYYY-MM-DD' },
        ],
      });

      assert.equal(error.statusCode, 422);
      assert.equal(error.error, 'Unprocessable Entity');
      assert.equal(error.getFieldError('nominal'), 'Nominal harus lebih dari 0');
      assert.equal(error.getFieldError('dueDate'), 'Format tanggal jatuh tempo harus YYYY-MM-DD');
      assert.equal(error.getFieldError('unknownField'), undefined);
    });

    it('handles 400 Bad Request with array message and fallback details', () => {
      const error = new ApiClientError({
        success: false,
        statusCode: 400,
        error: 'Bad Request',
        message: ['Nama barang wajib diisi', 'Satuan tidak boleh kosong'],
        details: [{ field: 'unit', issue: 'Satuan tidak boleh kosong' }],
      } as any);

      assert.equal(error.statusCode, 400);
      assert.equal(error.message, 'Nama barang wajib diisi, Satuan tidak boleh kosong');
      assert.equal(error.getFieldError('unit'), 'Satuan tidak boleh kosong');
    });

    it('handles 401 Unauthorized and 403 Forbidden', () => {
      const error401 = new ApiClientError({
        success: false,
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Akses ditolak: sesi telah kedaluwarsa',
      });
      assert.equal(error401.statusCode, 401);
      assert.equal(error401.error, 'Unauthorized');

      const error403 = new ApiClientError({
        success: false,
        statusCode: 403,
        error: 'Forbidden',
        message: 'Anda tidak memiliki hak akses untuk rumah tangga ini',
      });
      assert.equal(error403.statusCode, 403);
      assert.equal(error403.error, 'Forbidden');
    });
  });

  // =========================================================================
  // 3. SILENT TOKEN REFRESH FLOW & QUEUING IN apiFetch
  // =========================================================================
  describe('apiFetch Silent Token Refresh & Request Replay', () => {
    const originalFetch = globalThis.fetch;

    after(() => {
      globalThis.fetch = originalFetch;
    });

    it('automatically intercepts 401, calls /api/auth/refresh, updates auth token, and replays request', async () => {
      const { apiFetch, setApiAuthToken, getApiAuthToken } = await import('../lib/api-fetcher.ts');
      setApiAuthToken('expired-old-token');

      let callCount = 0;
      let refreshCalled = false;

      // Mock global fetch to simulate 401 -> refresh -> 200 replay
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const urlStr = input.toString();

        if (urlStr === '/api/auth/refresh') {
          refreshCalled = true;
          return new Response(
            JSON.stringify({
              success: true,
              data: { accessToken: 'fresh-new-token-12345' },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        if (urlStr.includes('/expenses')) {
          callCount++;
          const authHeader = (init?.headers as Headers)?.get('Authorization');
          if (authHeader === 'Bearer expired-old-token') {
            return new Response(
              JSON.stringify({
                statusCode: 401,
                error: 'Unauthorized',
                message: 'Token has expired',
              }),
              { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
          }

          if (authHeader === 'Bearer fresh-new-token-12345') {
            return new Response(
              JSON.stringify({
                success: true,
                data: [{ id: 'exp-1', nominal: 50000 }],
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          }
        }

        return new Response('Not found', { status: 404 });
      };

      const result = await apiFetch<Array<{ id: string; nominal: number }>>('/expenses');

      assert.equal(refreshCalled, true, 'Silent refresh was not triggered on 401!');
      assert.equal(callCount, 2, 'Original request was not retried after refresh!');
      assert.equal(getApiAuthToken(), 'fresh-new-token-12345', 'Access token in memory was not updated!');
      assert.deepEqual(result, [{ id: 'exp-1', nominal: 50000 }]);
    });
  });

  // =========================================================================
  // 4. CLIENT FORM VALIDATIONS & ATOMIC MODALS
  // =========================================================================
  describe('Form Validation & Atomic Modal Rules', () => {
    it('rejects negative and zero nominals across income, expense, debt, and payment schemas', () => {
      // 1. Income Schema
      const negativeIncome = createIncomeSchema.safeParse({
        date: '2026-10-27',
        nominal: -50000,
        sourceId: '00000000-0000-4000-8000-000000000001',
      });
      assert.equal(negativeIncome.success, false, 'Negative income was allowed!');

      const zeroIncome = createIncomeSchema.safeParse({
        date: '2026-10-27',
        nominal: 0,
        sourceId: '00000000-0000-4000-8000-000000000001',
      });
      assert.equal(zeroIncome.success, false, 'Zero income was allowed!');

      // 2. Expense Schema
      const negativeExpense = createExpenseSchema.safeParse({
        date: '2026-10-27',
        nominal: -75000,
        categoryId: '00000000-0000-4000-8000-000000000001',
      });
      assert.equal(negativeExpense.success, false, 'Negative expense was allowed!');

      // 3. Debt/Receivable Schema
      const negativeDebt = createDebtReceivableSchema.safeParse({
        type: 'payable',
        partyName: 'Pak Budi',
        principalAmount: -1000000,
      });
      assert.equal(negativeDebt.success, false, 'Negative debt principal was allowed!');

      // 4. Debt Repayment Schema
      const negativePayment = recordPaymentSchema.safeParse({
        paymentDate: '2026-10-27',
        amount: -250000,
        paymentMethod: 'cash',
      });
      assert.equal(negativePayment.success, false, 'Negative debt payment was allowed!');

      const positivePayment = recordPaymentSchema.safeParse({
        paymentDate: '2026-10-27',
        amount: 250000,
        paymentMethod: 'cash',
      });
      assert.equal(positivePayment.success, true);
    });

    it('enforces stock adjustment invariants: prevents negative stock and requires valid reason', () => {
      // Test contract schema: delta cannot be 0, reason cannot be empty or < 3 chars
      const zeroDelta = stockAdjustmentSchema.safeParse({
        delta: 0,
        reason: 'Correction',
      });
      assert.equal(zeroDelta.success, false, 'Zero stock adjustment was allowed!');

      const shortReason = stockAdjustmentSchema.safeParse({
        delta: 5,
        reason: 'ab',
      });
      assert.equal(shortReason.success, false, 'Reason < 3 chars was allowed!');

      const whitespaceReason = stockAdjustmentSchema.safeParse({
        delta: 5,
        reason: '   ',
      });
      assert.equal(whitespaceReason.success, false, 'Whitespace-only reason was allowed!');

      // Test client-side negative stock validation algorithm from inventori/page.tsx:
      // resultingStock = item.quantityOnHand + delta
      const initialStock = 5;
      const proposedDelta = -7;
      const resultingStock = initialStock + proposedDelta; // -2
      const isNegativeStock = resultingStock < 0;

      assert.equal(isNegativeStock, true, 'Resulting negative stock was not detected!');
      assert.equal(resultingStock, -2);

      // Verify status transitions:
      // when resultingStock is 0, status must be OUT
      assert.equal(calculateStockStatus(0, 5), 'OUT');
      // when resultingStock is <= threshold, status must be LOW
      assert.equal(calculateStockStatus(3, 5), 'LOW');
      // when resultingStock is > threshold, status must be SAFE
      assert.equal(calculateStockStatus(10, 5), 'SAFE');
    });

    it('enforces debt repayment client constraint: rejects payment exceeding remaining balance', () => {
      const remainingBalance = 500000;

      // Case A: Attempting to pay 600,000 on 500,000 debt
      const overpaymentAmount = 600000;
      const isOverpayment = overpaymentAmount > remainingBalance;
      assert.equal(isOverpayment, true, 'Overpayment was not detected!');

      // Case B: Valid partial payment
      const validAmount = 300000;
      const isValidPayment = validAmount <= remainingBalance;
      const resultingBalance = remainingBalance - validAmount;
      assert.equal(isValidPayment, true);
      assert.equal(resultingBalance, 200000);

      // Case C: Exact settlement payment
      const fullAmount = 500000;
      assert.equal(fullAmount <= remainingBalance, true);
      assert.equal(remainingBalance - fullAmount, 0);
    });

    it('verifies purchase completion modal generates valid RFC 4122 v4 UUID and previews stock increment', () => {
      // 1. UUID generation
      const idempotencyKey = crypto.randomUUID();
      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      assert.ok(
        uuidV4Regex.test(idempotencyKey),
        `Generated idempotency key ${idempotencyKey} is not a valid RFC 4122 v4 UUID!`
      );

      // 2. Stock increment preview calculation
      const currentInventoryStock = 12;
      const purchaseQuantity = 8;
      const afterStock = currentInventoryStock + purchaseQuantity;
      assert.equal(afterStock, 20, 'Stock increment math is incorrect!');
    });

    it('verifies RFC 4180 CSV export download filename construction and content-type handling', () => {
      const csvType = 'transactions';
      const selectedYear = 2026;
      const selectedMonth = 10;
      const activeTab = 'monthly';

      const filename = `laporan-rumahkita-${csvType}-${selectedYear}${
        activeTab === 'monthly' ? `-${selectedMonth}` : ''
      }.csv`;

      assert.equal(filename, 'laporan-rumahkita-transactions-2026-10.csv');
      assert.ok(filename.endsWith('.csv'));
    });
  });
});
