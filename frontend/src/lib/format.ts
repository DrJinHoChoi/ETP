/** 상대 시간 표시 (한국어) */
export function relativeTime(date: string | Date): string {
  const now = Date.now();
  const target = new Date(date).getTime();
  const diff = now - target;

  if (diff < 0) return '방금 전';

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return '방금 전';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}분 전`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;

  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}주 전`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}개월 전`;

  const years = Math.floor(days / 365);
  return `${years}년 전`;
}
