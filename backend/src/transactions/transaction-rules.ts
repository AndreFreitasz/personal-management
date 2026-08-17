import { BadRequestException } from '@nestjs/common';

import { CategoryKind } from '../categories/entities/category.entity';
import { TransactionType } from './entities/transaction.entity';

export const KIND_BY_TYPE: Record<TransactionType, CategoryKind> = {
  [TransactionType.Credit]: CategoryKind.Income,
  [TransactionType.Debit]: CategoryKind.Expense,
  [TransactionType.Transfer]: CategoryKind.Transfer,
};

export function assertTransferShape(
  type: TransactionType,
  accountId: string,
  destinationAccountId: string | null,
): void {
  if (type === TransactionType.Transfer) {
    if (!destinationAccountId) {
      throw new BadRequestException('Transferencia exige conta de destino.');
    }
    if (destinationAccountId === accountId) {
      throw new BadRequestException('A conta de destino precisa ser diferente da origem.');
    }
    return;
  }

  if (destinationAccountId) {
    throw new BadRequestException('Conta de destino so faz sentido em transferencia.');
  }
}

export function assertCategoryMatchesType(
  type: TransactionType,
  categoryKind: CategoryKind | null,
): void {
  if (categoryKind === null) {
    return;
  }

  const expected = KIND_BY_TYPE[type];
  if (categoryKind !== expected) {
    throw new BadRequestException(
      `Lancamento do tipo "${type}" aceita apenas categoria do tipo "${expected}".`,
    );
  }
}
