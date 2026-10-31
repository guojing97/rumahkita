import {
  Injectable,
  Inject,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { eq, and, isNull, desc, sql, ilike } from 'drizzle-orm';
import { schema, DbClient } from '@rumahkita/db';
import { DB_CLIENT } from '../../common/constants/tokens.js';
import {
  CreateDebtReceivableInput,
  UpdateDebtReceivableInput,
  DebtReceivableQuery,
  RecordPaymentInput,
} from '@rumahkita/contracts';

export function computeDebtStatus(
  status: string,
  remainingBalance: number,
  dueDate: string | null | undefined
): string {
  if (status === 'settled' || remainingBalance <= 0) return 'settled';
  if (status === 'cancelled') return 'cancelled';
  if (dueDate) {
    const todayStr = new Date().toISOString().split('T')[0]!;
    if (dueDate < todayStr && remainingBalance > 0) {
      return 'overdue';
    }
  }
  return status;
}

@Injectable()
export class DebtsService {
  constructor(@Inject(DB_CLIENT) private readonly db: DbClient) {}

  async listDebts(householdId: string, query: DebtReceivableQuery) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const offset = (page - 1) * limit;

    const conditions = [
      eq(schema.debtsReceivables.householdId, householdId),
      isNull(schema.debtsReceivables.deletedAt),
    ];

    if (query.type) {
      conditions.push(eq(schema.debtsReceivables.type, query.type));
    }
    if (query.status) {
      conditions.push(eq(schema.debtsReceivables.status, query.status));
    }
    if (query.search) {
      conditions.push(ilike(schema.debtsReceivables.partyName, `%${query.search}%`));
    }

    const whereClause = and(...conditions);

    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.debtsReceivables)
      .where(whereClause);

    const total = Number(countRow?.count || 0);

    const rows = await this.db
      .select()
      .from(schema.debtsReceivables)
      .where(whereClause)
      .orderBy(desc(schema.debtsReceivables.createdAt))
      .limit(limit)
      .offset(offset);

    const data = rows.map((r) => {
      const remainingBalance = Number(r.remainingBalance);
      const computedStatus = computeDebtStatus(
        r.status,
        remainingBalance,
        r.dueDate
      );
      return {
        ...r,
        principalAmount: Number(r.principalAmount),
        remainingBalance,
        status: computedStatus,
      };
    });

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getDebtById(householdId: string, id: string) {
    const [debt] = await this.db
      .select()
      .from(schema.debtsReceivables)
      .where(
        and(
          eq(schema.debtsReceivables.id, id),
          eq(schema.debtsReceivables.householdId, householdId),
          isNull(schema.debtsReceivables.deletedAt)
        )
      );

    if (!debt) {
      throw new NotFoundException('Data hutang/piutang tidak ditemukan');
    }

    const payments = await this.db
      .select()
      .from(schema.debtReceivablePayments)
      .where(eq(schema.debtReceivablePayments.debtReceivableId, id))
      .orderBy(desc(schema.debtReceivablePayments.paymentDate));

    const remainingBalance = Number(debt.remainingBalance);
    const computedStatus = computeDebtStatus(
      debt.status,
      remainingBalance,
      debt.dueDate
    );

    return {
      ...debt,
      principalAmount: Number(debt.principalAmount),
      remainingBalance,
      status: computedStatus,
      payments: payments.map((p) => ({
        ...p,
        amount: Number(p.amount),
      })),
    };
  }

  async createDebt(householdId: string, userId: string, input: CreateDebtReceivableInput) {
    if (input.principalAmount <= 0) {
      throw new UnprocessableEntityException('Nominal harus lebih dari 0');
    }

    const [debt] = await this.db
      .insert(schema.debtsReceivables)
      .values({
        householdId,
        type: input.type,
        partyName: input.partyName.trim(),
        description: input.description?.trim() || null,
        principalAmount: String(input.principalAmount),
        remainingBalance: String(input.principalAmount),
        dueDate: input.dueDate || null,
        status: 'open',
        notes: input.notes?.trim() || null,
        createdBy: userId,
      })
      .returning();

    const remainingBalance = Number(debt.remainingBalance);
    const computedStatus = computeDebtStatus(
      debt.status,
      remainingBalance,
      debt.dueDate
    );

    return {
      ...debt,
      principalAmount: Number(debt.principalAmount),
      remainingBalance,
      status: computedStatus,
    };
  }

  async updateDebt(householdId: string, id: string, userId: string, input: UpdateDebtReceivableInput) {
    await this.getDebtById(householdId, id);

    const updateData: Record<string, any> = {
      updatedAt: new Date(),
      updatedBy: userId,
    };

    if (input.partyName !== undefined) updateData.partyName = input.partyName.trim();
    if (input.description !== undefined) updateData.description = input.description?.trim() || null;
    if (input.dueDate !== undefined) updateData.dueDate = input.dueDate;
    if (input.notes !== undefined) updateData.notes = input.notes?.trim() || null;

    const [updated] = await this.db
      .update(schema.debtsReceivables)
      .set(updateData)
      .where(
        and(
          eq(schema.debtsReceivables.id, id),
          eq(schema.debtsReceivables.householdId, householdId)
        )
      )
      .returning();

    const remainingBalance = Number(updated.remainingBalance);
    const computedStatus = computeDebtStatus(
      updated.status,
      remainingBalance,
      updated.dueDate
    );

    return {
      ...updated,
      principalAmount: Number(updated.principalAmount),
      remainingBalance,
      status: computedStatus,
    };
  }

  async deleteDebt(householdId: string, id: string, userId: string) {
    await this.getDebtById(householdId, id);

    await this.db
      .update(schema.debtsReceivables)
      .set({
        deletedAt: new Date(),
        updatedBy: userId,
      })
      .where(
        and(
          eq(schema.debtsReceivables.id, id),
          eq(schema.debtsReceivables.householdId, householdId)
        )
      );

    return null;
  }

  async recordPayment(
    householdId: string,
    debtId: string,
    userId: string,
    input: RecordPaymentInput
  ) {
    if (input.amount <= 0) {
      throw new UnprocessableEntityException('Nominal pembayaran harus lebih dari 0');
    }

    return await this.db.transaction(async (tx) => {
      // 1. Lock debt row FOR UPDATE
      const [debt] = await tx
        .select()
        .from(schema.debtsReceivables)
        .where(
          and(
            eq(schema.debtsReceivables.id, debtId),
            eq(schema.debtsReceivables.householdId, householdId),
            isNull(schema.debtsReceivables.deletedAt)
          )
        )
        .for('update');

      if (!debt) {
        throw new NotFoundException('Data hutang/piutang tidak ditemukan');
      }

      const currentBalance = Number(debt.remainingBalance);

      if (currentBalance <= 0 || debt.status === 'settled') {
        throw new UnprocessableEntityException('Hutang/piutang ini sudah lunas');
      }

      // 2. Validate amount against remaining balance
      if (input.amount > currentBalance) {
        throw new UnprocessableEntityException('Jumlah pembayaran melebihi sisa saldo');
      }

      const newBalance = currentBalance - input.amount;
      const newStatus = newBalance === 0 ? 'settled' : 'partially_paid';
      const now = new Date();

      // 3. Insert payment record
      const [payment] = await tx
        .insert(schema.debtReceivablePayments)
        .values({
          debtReceivableId: debt.id,
          amount: String(input.amount),
          paymentDate: input.paymentDate,
          paymentMethod: input.paymentMethod || 'transfer',
          notes: input.notes?.trim() || null,
          createdBy: userId,
        })
        .returning();

      // 4. Update debt
      await tx
        .update(schema.debtsReceivables)
        .set({
          remainingBalance: String(newBalance),
          status: newStatus,
          updatedAt: now,
          updatedBy: userId,
        })
        .where(eq(schema.debtsReceivables.id, debt.id));

      return {
        id: payment.id,
        debtReceivableId: debt.id,
        amount: input.amount,
        remainingBalance: newBalance,
        status: newStatus,
        paymentDate: input.paymentDate,
        paymentMethod: payment.paymentMethod,
        notes: payment.notes,
      };
    });
  }
}
