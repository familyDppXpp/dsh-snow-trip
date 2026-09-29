export const yuan = (n: number | null | undefined) =>
  n == null
    ? '待确认'
    : new Intl.NumberFormat('zh-CN', {
        style: 'currency',
        currency: 'CNY',
        maximumFractionDigits: 2,
      }).format(n);
