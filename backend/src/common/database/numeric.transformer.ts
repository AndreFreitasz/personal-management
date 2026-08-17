import { ValueTransformer } from 'typeorm';

export class NumericTransformer implements ValueTransformer {
  constructor(private readonly scale = 2) {}

  to(value: number | null | undefined): string | null {
    return value === null || value === undefined ? null : value.toFixed(this.scale);
  }

  from(value: string | null | undefined): number | null {
    return value === null || value === undefined ? null : Number(value);
  }
}

export const money = new NumericTransformer(2);
