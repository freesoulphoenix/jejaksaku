export const earliestHistoricalDate = '2000-01-01';

export function getLocalIsoDate(date = new Date()) {
  return [
    String(date.getFullYear()),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

export function getDueDateMax(date = new Date()) {
  return `${date.getFullYear() + 10}-12-31`;
}
