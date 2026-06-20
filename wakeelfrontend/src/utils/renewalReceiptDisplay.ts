import { PaymentStatus, RenewalReceipt } from '../types';

export function isSubscriptionFullyPaid(receipt: RenewalReceipt): boolean {
  const finalPrice = receipt.finalPrice ?? 0;
  if (finalPrice <= 0) return true;
  if ((receipt.remainingAmount ?? 0) <= 0) return true;
  return receipt.paymentStatus === PaymentStatus.Paid;
}

export function isServiceFeesFullyPaid(receipt: RenewalReceipt): boolean {
  const feesPrice = receipt.serviceFeesPrice ?? 0;
  if (feesPrice <= 0 && !receipt.serviceFeesId) return true;
  return (receipt.serviceFeesRemainingAmount ?? 0) <= 0;
}

export function getSubscriptionReceivedAmount(receipt: RenewalReceipt): number {
  return isSubscriptionFullyPaid(receipt) ? Math.max(0, receipt.amountPaid ?? 0) : 0;
}

export function getServiceFeesReceivedAmount(receipt: RenewalReceipt): number {
  return isServiceFeesFullyPaid(receipt) ? Math.max(0, receipt.serviceFeesAmountPaid ?? 0) : 0;
}

export function getCombinedPaymentPaid(receipt: RenewalReceipt): boolean {
  return isSubscriptionFullyPaid(receipt) && isServiceFeesFullyPaid(receipt);
}
