import { BadRequestException } from '@nestjs/common';

import { CategoryKind } from '../categories/entities/category.entity';
import { TransactionType } from './entities/transaction.entity';
import { assertCategoryMatchesType, assertTransferShape, KIND_BY_TYPE } from './transaction-rules';

describe('regras do lancamento', () => {
  describe('assertTransferShape', () => {
    it('exige conta de destino na transferencia', () => {
      expect(() => assertTransferShape(TransactionType.Transfer, 'conta-a', null)).toThrow(
        BadRequestException,
      );
    });

    it('aceita transferencia com destino diferente da origem', () => {
      expect(() =>
        assertTransferShape(TransactionType.Transfer, 'conta-a', 'conta-b'),
      ).not.toThrow();
    });

    it('recusa transferencia para a propria conta de origem', () => {
      expect(() => assertTransferShape(TransactionType.Transfer, 'conta-a', 'conta-a')).toThrow(
        BadRequestException,
      );
    });

    it('recusa destino em credito e em debito', () => {
      expect(() => assertTransferShape(TransactionType.Credit, 'conta-a', 'conta-b')).toThrow(
        BadRequestException,
      );
      expect(() => assertTransferShape(TransactionType.Debit, 'conta-a', 'conta-b')).toThrow(
        BadRequestException,
      );
    });

    it('aceita credito e debito sem destino', () => {
      expect(() => assertTransferShape(TransactionType.Credit, 'conta-a', null)).not.toThrow();
      expect(() => assertTransferShape(TransactionType.Debit, 'conta-a', null)).not.toThrow();
    });
  });

  describe('assertCategoryMatchesType', () => {
    it('casa cada tipo com o kind correspondente', () => {
      expect(KIND_BY_TYPE[TransactionType.Credit]).toBe(CategoryKind.Income);
      expect(KIND_BY_TYPE[TransactionType.Debit]).toBe(CategoryKind.Expense);
      expect(KIND_BY_TYPE[TransactionType.Transfer]).toBe(CategoryKind.Transfer);
    });

    it('impede "Investidos" de ser atribuida a um debito', () => {
      expect(() => assertCategoryMatchesType(TransactionType.Debit, CategoryKind.Transfer)).toThrow(
        BadRequestException,
      );
    });

    it('impede categoria de despesa em credito', () => {
      expect(() => assertCategoryMatchesType(TransactionType.Credit, CategoryKind.Expense)).toThrow(
        BadRequestException,
      );
    });

    it('aceita as combinacoes coerentes', () => {
      expect(() =>
        assertCategoryMatchesType(TransactionType.Debit, CategoryKind.Expense),
      ).not.toThrow();
      expect(() =>
        assertCategoryMatchesType(TransactionType.Credit, CategoryKind.Income),
      ).not.toThrow();
      expect(() =>
        assertCategoryMatchesType(TransactionType.Transfer, CategoryKind.Transfer),
      ).not.toThrow();
    });

    it('aceita lancamento sem categoria (fila de revisao)', () => {
      expect(() => assertCategoryMatchesType(TransactionType.Debit, null)).not.toThrow();
    });
  });
});
