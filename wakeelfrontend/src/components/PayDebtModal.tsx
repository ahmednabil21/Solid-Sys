import React, { useEffect, useState } from 'react';
import { CheckCircle, X } from 'lucide-react';
import { ActivationPaymentMethod, Debt, DebtPaymentRequest } from '../types';
import { useDigits } from '../contexts/DigitsContext';
import { debtTypeLabelAr, defaultDebtPaymentData, isMaterialDebtRow } from '../utils/debtPay';

export type PayDebtModalProps = {
  debts: Debt[];
  onClose: () => void;
  onConfirm: (paymentData: DebtPaymentRequest) => void;
  isPending?: boolean;
};

const PayDebtModal: React.FC<PayDebtModalProps> = ({
  debts,
  onClose,
  onConfirm,
  isPending = false,
}) => {
  const { formatNumber, formatDate } = useDigits();
  const selectedDebt = debts[0];
  const totalDue = debts.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const [paymentData, setPaymentData] = useState<DebtPaymentRequest>(() =>
    defaultDebtPaymentData(totalDue)
  );

  useEffect(() => {
    setPaymentData(defaultDebtPaymentData(totalDue));
  }, [totalDue, selectedDebt?.id, debts.length]);

  if (!selectedDebt || debts.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {debts.length > 1 ? 'تسديد ديون المشترك' : 'دفع الدين'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onConfirm(paymentData);
          }}
          className="p-6 space-y-4"
        >
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              تفاصيل الدين
            </h3>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <div>المشترك: {selectedDebt.subscriberName}</div>
              {selectedDebt.agentName ? <div>الوكيل: {selectedDebt.agentName}</div> : null}
              {debts.map((d) => (
                <div
                  key={d.id}
                  className="rounded-md border border-gray-200 dark:border-gray-600 bg-white/60 dark:bg-gray-800/60 p-2 space-y-0.5"
                >
                  <div className="font-medium text-gray-800 dark:text-gray-200">{debtTypeLabelAr(d)}</div>
                  <div>المبلغ: {formatNumber(d.amount, { suffix: ' د.ع' })}</div>
                  <div>ملاحظات: {d.description || '—'}</div>
                </div>
              ))}
              {debts.length > 1 && (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-600 font-semibold text-gray-900 dark:text-white">
                  الإجمالي:{' '}
                  {formatNumber(totalDue, { suffix: ' د.ع' })}
                </div>
              )}
              {isMaterialDebtRow(selectedDebt) && selectedDebt.materialName && (
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 space-y-0.5">
                  <div className="font-medium text-gray-700 dark:text-gray-300">دين مواد</div>
                  <div>المادة: {selectedDebt.materialName}</div>
                  {typeof selectedDebt.materialQuantity === 'number' && (
                    <div>الكمية: {formatNumber(selectedDebt.materialQuantity)}</div>
                  )}
                  {typeof selectedDebt.materialPricePaid === 'number' && (
                    <div>المدفوع: {formatNumber(selectedDebt.materialPricePaid, { suffix: ' د.ع' })}</div>
                  )}
                  {typeof selectedDebt.materialDebtAmount === 'number' && (
                    <div>مبلغ الدين: {formatNumber(selectedDebt.materialDebtAmount, { suffix: ' د.ع' })}</div>
                  )}
                  {selectedDebt.materialDisbursementDate && (
                    <div>تاريخ الصرف: {formatDate(selectedDebt.materialDisbursementDate + 'T12:00:00')}</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              نوع الدفع *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() =>
                  setPaymentData((prev) => ({
                    ...prev,
                    paymentMethod: ActivationPaymentMethod.Cash,
                  }))
                }
                className={`rounded-xl border-2 px-3 py-4 text-sm font-semibold transition-all duration-200 ${
                  paymentData.paymentMethod === ActivationPaymentMethod.Cash
                    ? 'border-purple-600 bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                    : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:border-purple-300 dark:hover:border-purple-500'
                }`}
              >
                كاش
              </button>
              <button
                type="button"
                onClick={() =>
                  setPaymentData((prev) => ({
                    ...prev,
                    paymentMethod: ActivationPaymentMethod.Master,
                  }))
                }
                className={`rounded-xl border-2 px-3 py-4 text-sm font-semibold transition-all duration-200 ${
                  paymentData.paymentMethod === ActivationPaymentMethod.Master
                    ? 'border-purple-600 bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                    : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:border-purple-300 dark:hover:border-purple-500'
                }`}
              >
                ماستر
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              مبلغ الدفع *
            </label>
            <input
              type="number"
              value={paymentData.paymentAmount}
              onChange={(e) =>
                setPaymentData((prev) => ({ ...prev, paymentAmount: Number(e.target.value) }))
              }
              required
              min="0"
              max={totalDue}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
              placeholder="مبلغ الدفع الإجمالي"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ملاحظات
            </label>
            <textarea
              value={paymentData.notes}
              onChange={(e) => setPaymentData((prev) => ({ ...prev, notes: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
              placeholder="ملاحظات إضافية..."
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  <span>جاري الدفع...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  <span>تأكيد الدفع</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PayDebtModal;
