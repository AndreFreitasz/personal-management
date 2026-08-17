import { BadRequestException } from '@nestjs/common';

export interface Cursor {
  occurredAt: Date;
  id: string;
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(`${cursor.occurredAt.toISOString()}|${cursor.id}`, 'utf8').toString(
    'base64url',
  );
}

export function decodeCursor(raw: string): Cursor {
  const decoded = Buffer.from(raw, 'base64url').toString('utf8');
  const separator = decoded.indexOf('|');
  const occurredAt = new Date(decoded.slice(0, separator));
  const id = decoded.slice(separator + 1);

  if (separator < 0 || Number.isNaN(occurredAt.getTime()) || id.length === 0) {
    throw new BadRequestException('Cursor invalido.');
  }

  return { occurredAt, id };
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export function toPage<T extends Cursor>(rows: T[], limit: number): Page<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);

  return {
    items,
    nextCursor: hasMore && last ? encodeCursor(last) : null,
  };
}
