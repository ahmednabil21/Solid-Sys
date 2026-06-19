const RECEIPT_PRINT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  timeZone: 'Asia/Baghdad',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
};

export function formatReceiptPrintDate(
  locale: string,
  value: string | Date | null | undefined
): string {
  if (value == null) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(locale, RECEIPT_PRINT_DATE_OPTIONS);
}

export interface ReceiptPrintAmounts {
  subscriptionPrice: number;
  amountPaid: number;
  debt: number;
}

/** مجموع الباقة + الأجور للطباعة (بدون تفاصيل الأجور منفصلة). */
export function resolveReceiptPrintAmounts(receipt: {
  finalPrice?: number | null;
  amount?: number | null;
  amountPaid?: number | null;
  remainingAmount?: number | null;
  serviceFeesPrice?: number | null;
  serviceFeesAmountPaid?: number | null;
  serviceFeesRemainingAmount?: number | null;
}): ReceiptPrintAmounts {
  const packagePrice = Number(receipt.finalPrice ?? receipt.amount ?? 0);
  const packagePaid = Number(receipt.amountPaid ?? receipt.amount ?? 0);
  const packageDebt = Number(
    receipt.remainingAmount ?? Math.max(0, packagePrice - packagePaid)
  );

  const feesPrice = Number(receipt.serviceFeesPrice ?? 0);
  const feesPaid = Number(receipt.serviceFeesAmountPaid ?? 0);
  const feesDebt = Number(
    receipt.serviceFeesRemainingAmount ?? Math.max(0, feesPrice - feesPaid)
  );

  return {
    subscriptionPrice: packagePrice + feesPrice,
    amountPaid: packagePaid + feesPaid,
    debt: packageDebt + feesDebt,
  };
}
