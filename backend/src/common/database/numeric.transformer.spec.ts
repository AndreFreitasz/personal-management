import { money, NumericTransformer } from './numeric.transformer';

describe('NumericTransformer', () => {
  it('escreve no banco como string com escala fixa', () => {
    expect(money.to(70)).toBe('70.00');
    expect(money.to(0.1)).toBe('0.10');
    expect(money.to(1234.5)).toBe('1234.50');
  });

  it('preserva null nos dois sentidos', () => {
    expect(money.to(null)).toBeNull();
    expect(money.to(undefined)).toBeNull();
    expect(money.from(null)).toBeNull();
    expect(money.from(undefined)).toBeNull();
  });

  it('le a string do driver como numero', () => {
    expect(money.from('70.00')).toBe(70);
    expect(money.from('0.01')).toBe(0.01);
  });

  it('sobrevive ao round-trip de um valor com centavos', () => {
    expect(money.from(money.to(19.99) as string)).toBe(19.99);
  });

  it('aceita outra escala', () => {
    expect(new NumericTransformer(4).to(1.23456)).toBe('1.2346');
  });

  it('demonstra por que a agregacao NAO pode acontecer aqui', () => {
    let acc = 0;
    for (let i = 0; i < 1000; i += 1) acc += 0.01;
    expect(acc).not.toBe(10);
    expect(Number(acc.toFixed(2))).toBe(10);
  });
});
