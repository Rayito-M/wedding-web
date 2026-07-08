/** 5 June 2027, Palacio de los Córdova, Granada. */
export const WEDDING_DATE = new Date(2027, 5, 5);

export function daysUntilWedding(now = new Date()): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ms = WEDDING_DATE.getTime() - today.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}
