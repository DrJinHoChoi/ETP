import { describe, it, expect } from 'vitest';
import { relativeTime } from './format';

describe('relativeTime', () => {
  it('returns "방금 전" for recent times', () => {
    const now = new Date();
    expect(relativeTime(now)).toBe('방금 전');
  });

  it('returns "방금 전" for 30 seconds ago', () => {
    const date = new Date(Date.now() - 30 * 1000);
    expect(relativeTime(date)).toBe('방금 전');
  });

  it('returns "N분 전" for minutes', () => {
    const date = new Date(Date.now() - 5 * 60 * 1000);
    expect(relativeTime(date)).toBe('5분 전');
  });

  it('returns "N시간 전" for hours', () => {
    const date = new Date(Date.now() - 3 * 60 * 60 * 1000);
    expect(relativeTime(date)).toBe('3시간 전');
  });

  it('returns "N일 전" for days', () => {
    const date = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    expect(relativeTime(date)).toBe('2일 전');
  });

  it('returns "N주 전" for weeks', () => {
    const date = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    expect(relativeTime(date)).toBe('2주 전');
  });

  it('returns "N개월 전" for months', () => {
    const date = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    expect(relativeTime(date)).toBe('2개월 전');
  });

  it('returns "N년 전" for years', () => {
    const date = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
    expect(relativeTime(date)).toBe('1년 전');
  });

  it('handles string dates', () => {
    const dateStr = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    expect(relativeTime(dateStr)).toBe('10분 전');
  });

  it('returns "방금 전" for future dates', () => {
    const future = new Date(Date.now() + 60000);
    expect(relativeTime(future)).toBe('방금 전');
  });
});
