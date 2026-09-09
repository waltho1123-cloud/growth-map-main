import { describe, it, expect } from 'vitest';
import { fmtAmount, fmtYi, toYi, amountUnit, YI } from '../utils/amount';

describe('fmtAmount／amountUnit', () => {
  it('保留一位小數、整數不補零、千分位、非數字顯示 —', () => {
    expect(fmtAmount(4.5)).toBe('4.5');
    expect(fmtAmount(3)).toBe('3');
    expect(fmtAmount(1.5)).toBe('1.5');
    expect(fmtAmount(1.25)).toBe('1.3');
    expect(fmtAmount(1234.5)).toBe('1,234.5');
    expect(fmtAmount(0)).toBe('0');
    expect(fmtAmount(null)).toBe('0');
    expect(fmtAmount('abc')).toBe('—');
  });
  it('可指定小數位數', () => {
    expect(fmtAmount(2.98, 2)).toBe('2.98');
    expect(fmtAmount(0.15, 2)).toBe('0.15');
  });
  it('單位標示為「億 <幣別>」', () => {
    expect(amountUnit('TWD')).toBe('億 TWD');
    expect(amountUnit()).toBe('億 TWD');
  });
});

describe('toYi／fmtYi（元 → 億）', () => {
  it('1 億元 = 1；2,000 萬元 = 0.2；非數字 = 0', () => {
    expect(YI).toBe(100000000);
    expect(toYi(100000000)).toBe(1);
    expect(toYi(20000000)).toBeCloseTo(0.2);
    expect(toYi('abc')).toBe(0);
    expect(toYi(undefined)).toBe(0);
  });
  it('顯示最多兩位小數', () => {
    expect(fmtYi(298000000)).toBe('2.98');
    expect(fmtYi(15000000)).toBe('0.15');
    expect(fmtYi(0)).toBe('0');
  });
});
