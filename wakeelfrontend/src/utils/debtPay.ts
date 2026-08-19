import { Debt, DebtStatus, DebtPaymentRequest, ActivationPaymentMethod } from '../types';

export function isMaterialDebtRow(debt: Debt): boolean {
  return !!(debt.materialName || debt.materialDebtAmount != null || debt.materialDisbursementDate);
}

export function isServiceFeeDebtRow(debt: Debt): boolean {
  if (isMaterialDebtRow(debt)) return false;
  const desc = `${debt.originalDescription || ''} ${debt.description || ''}`;
  return desc.includes('دين أجور خدمة');
}

export function debtTypeLabelAr(debt: Debt): string {
  if (isMaterialDebtRow(debt)) return 'دين مواد';
  if (isServiceFeeDebtRow(debt)) return 'دين أجور خدمة';
  return 'دين اشتراك';
}

export function isUnpaidDebtRow(debt: Debt): boolean {
  return (
    Number(debt.amount) > 0 &&
    (debt.status === DebtStatus.Unpaid || debt.status === DebtStatus.Partial || debt.isPaid === false)
  );
}

/** يجمع دين الاشتراك ودين الأجور غير المسددين لنفس المشترك في مودال تسديد واحد. */
export function resolveDebtsForCombinedPay(clicked: Debt, subscriberDebts: Debt[]): Debt[] {
  if (isMaterialDebtRow(clicked)) return [clicked];

  const unpaid = subscriberDebts.filter(isUnpaidDebtRow);

  const feeDebts = unpaid.filter(isServiceFeeDebtRow);
  const subscriptionDebts = unpaid.filter((d) => !isMaterialDebtRow(d) && !isServiceFeeDebtRow(d));
  const combined = [...subscriptionDebts, ...feeDebts];
  if (combined.length === 0) return [clicked];

  const byId = new Map(combined.map((d) => [d.id, d]));
  if (!byId.has(clicked.id)) byId.set(clicked.id, clicked);
  return Array.from(byId.values());
}

export function allocateCombinedDebtPayments(
  debts: Debt[],
  totalPayment: number
): Array<{ debt: Debt; amount: number }> {
  let remaining = Math.max(0, Number(totalPayment) || 0);
  const ordered = [...debts].sort((a, b) => {
    const aRank = isServiceFeeDebtRow(a) ? 0 : 1;
    const bRank = isServiceFeeDebtRow(b) ? 0 : 1;
    return aRank - bRank;
  });
  const allocations: Array<{ debt: Debt; amount: number }> = [];
  for (const debt of ordered) {
    if (remaining <= 0) break;
    const due = Math.max(0, Number(debt.amount) || 0);
    const pay = Math.min(due, remaining);
    if (pay > 0) {
      allocations.push({ debt, amount: pay });
      remaining -= pay;
    }
  }
  return allocations;
}

export function defaultDebtPaymentData(totalAmount = 0): DebtPaymentRequest {
  return {
    paymentAmount: totalAmount,
    notes: '',
    paymentMethod: ActivationPaymentMethod.Cash,
  };
}
