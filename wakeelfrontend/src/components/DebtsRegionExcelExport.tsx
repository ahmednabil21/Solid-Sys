import React, { useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  AlertTriangle,
  Loader2,
  X,
} from 'lucide-react';
import { ApiService } from '../services/api';
import { showError, showSuccess } from '../utils/notifications';
import { createXlsxBlob } from '../utils/excelExport';
import { fetchDebtsWithCache } from '../services/offlineSync';
import {
  buildRegionResellerFilterParams,
} from '../utils/operationalFilters';
import type { AgentReseller, Debt, DebtsListParams } from '../types';
import { DebtStatus } from '../types';

type Props = {
  open: boolean;
  onClose: () => void;
  regionId: string;
  resellerId: string;
  regionName?: string;
  resellerName?: string;
  online: boolean;
  showOverdueOnly: boolean;
  appliedSearchTerm: string;
  appliedFilters: {
    status?: number;
    sortDescending?: boolean;
    debtDescription?: string;
  };
  appliedPaymentReceivedFrom: string;
  appliedPaymentReceivedTo: string;
  myResellers: AgentReseller[];
  formatDate: (date: Date) => string;
  formatNumber: (value: number, options?: { suffix?: string }) => string;
};

type SubscriberDebtGroup = {
  subscriberId: string;
  subscriberName: string;
  profileName: string;
  totalDebt: number;
  unpaidDebt: number;
  paidDebt: number;
  debts: Debt[];
};

function getDatePart(isoOrDate?: string | null): string | null {
  if (!isoOrDate || typeof isoOrDate !== 'string') return null;
  const part = isoOrDate.split('T')[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(part) ? part : null;
}

function ymdToPaymentCreatedAtFromUtc(ymd: string): string | undefined {
  const t = ymd.trim();
  if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return undefined;
  return `${t}T00:00:00.000Z`;
}

function ymdToPaymentCreatedAtToUtc(ymd: string): string | undefined {
  const t = ymd.trim();
  if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return undefined;
  return `${t}T23:59:59.999Z`;
}

function resolvePaidDebtAmount(debt: Debt): number {
  if (debt.status !== DebtStatus.Paid) return 0;
  return debt.totalPaidAmount ?? debt.lastPaymentAmount ?? debt.amount ?? 0;
}

function resolveUnpaidDebtAmount(debt: Debt): number {
  if (debt.status !== DebtStatus.Unpaid) return 0;
  return debt.amount ?? 0;
}

function groupDebtsBySubscriber(debts: Debt[]): SubscriberDebtGroup[] {
  const grouped = debts.reduce((acc: Record<string, SubscriberDebtGroup>, debt: Debt) => {
    const key = debt.subscriberId;
    if (!acc[key]) {
      acc[key] = {
        subscriberId: debt.subscriberId,
        subscriberName: debt.subscriberName,
        profileName: debt.profileName?.trim() || '',
        totalDebt: 0,
        unpaidDebt: 0,
        paidDebt: 0,
        debts: [],
      };
    }
    if (!acc[key].profileName && debt.profileName?.trim()) {
      acc[key].profileName = debt.profileName.trim();
    }
    acc[key].debts.push(debt);
    const paidPart = resolvePaidDebtAmount(debt);
    const unpaidPart = resolveUnpaidDebtAmount(debt);
    acc[key].paidDebt += paidPart;
    acc[key].unpaidDebt += unpaidPart;
    acc[key].totalDebt += paidPart + unpaidPart;
    return acc;
  }, {});
  return Object.values(grouped);
}

type ExportMode = 'paid' | 'unpaid' | 'all';

function resolveExportMode(status?: number): ExportMode {
  if (status === DebtStatus.Paid) return 'paid';
  if (status === DebtStatus.Unpaid) return 'unpaid';
  return 'all';
}

const DebtsRegionExcelExport: React.FC<Props> = ({
  open,
  onClose,
  regionId,
  resellerId,
  regionName,
  resellerName,
  online,
  showOverdueOnly,
  appliedSearchTerm,
  appliedFilters,
  appliedPaymentReceivedFrom,
  appliedPaymentReceivedTo,
  myResellers,
  formatDate,
  formatNumber,
}) => {
  const [exporting, setExporting] = useState(false);

  const canExport = !!regionId && !!resellerId;
  const exportMode = resolveExportMode(appliedFilters.status);

  const handleExport = async () => {
    if (!canExport) {
      showError('بيانات ناقصة', 'يرجى اختيار المنطقة والرسيلر من البطاقات أعلى الصفحة.');
      return;
    }

    setExporting(true);
    try {
      const params: DebtsListParams = {
        page: 1,
        pageSize: 50000,
        searchTerm: appliedSearchTerm.trim() || undefined,
        sortDescending: appliedFilters.sortDescending ?? true,
        status: appliedFilters.status !== undefined && appliedFilters.status !== null
          ? appliedFilters.status
          : undefined,
        paymentCreatedAtFrom: ymdToPaymentCreatedAtFromUtc(appliedPaymentReceivedFrom) || undefined,
        paymentCreatedAtTo: ymdToPaymentCreatedAtToUtc(appliedPaymentReceivedTo) || undefined,
        debtDescription: appliedFilters.debtDescription?.trim() || undefined,
        ...buildRegionResellerFilterParams(regionId, resellerId, myResellers),
      };

      const response = await fetchDebtsWithCache(online, params, showOverdueOnly);
      const debts = response?.data ?? [];
      const subscriberDebts = groupDebtsBySubscriber(debts);

      if (subscriberDebts.length === 0) {
        showError('لا توجد بيانات', 'لا توجد ديون مطابقة للمنطقة والرسيلر المحددين.');
        return;
      }

      const headers = ['المشترك', 'الباقة', 'إجمالي الدين', 'تاريخ الدين'];
      if (exportMode === 'paid' || exportMode === 'all') headers.push('الدين المدفوع');
      if (exportMode === 'unpaid' || exportMode === 'all') headers.push('الدين غير المدفوع');
      headers.push('عدد الديون', 'ملاحظات الدين', 'إطفاء/تشغيل');

      const dataRows = subscriberDebts.map((sd) => {
        const earliestDebtDate = sd.debts.reduce((min: string | null, d: Debt) => {
          const dDate = getDatePart(d.debtDate);
          if (!dDate) return min;
          return !min || dDate < min ? dDate : min;
        }, null as string | null);
        const debtDateStr = earliestDebtDate ? formatDate(new Date(earliestDebtDate + 'T12:00:00')) : '';
        const descStr = sd.debts.map((d) => d.originalDescription || d.description || '').filter(Boolean).join('، ') || '';
        const offOn = sd.debts[0]?.offOn;
        const offOnStr = offOn === 0 ? 'إطفاء' : 'تشغيل';

        const row: (string | number)[] = [
          sd.subscriberName ?? '',
          sd.profileName ?? '',
          exportMode === 'paid' ? sd.paidDebt : exportMode === 'unpaid' ? sd.unpaidDebt : sd.totalDebt,
          debtDateStr,
        ];
        if (exportMode === 'paid' || exportMode === 'all') row.push(sd.paidDebt);
        if (exportMode === 'unpaid' || exportMode === 'all') row.push(sd.unpaidDebt);
        row.push(sd.debts.length, descStr, offOnStr);
        return row;
      });

      const sumTotalDebt = dataRows.reduce((s, row) => s + (Number(row[2]) || 0), 0);
      let colIndex = 4;
      const totalRow: (string | number)[] = ['المجموع', '', sumTotalDebt, ''];
      if (exportMode === 'paid' || exportMode === 'all') {
        const sumPaid = dataRows.reduce((s, row) => s + (Number(row[colIndex]) || 0), 0);
        totalRow.push(sumPaid);
        colIndex += 1;
      }
      if (exportMode === 'unpaid' || exportMode === 'all') {
        const sumUnpaid = dataRows.reduce((s, row) => s + (Number(row[colIndex]) || 0), 0);
        totalRow.push(sumUnpaid);
        colIndex += 1;
      }
      const sumDebtCount = dataRows.reduce((s, row) => s + (Number(row[colIndex]) || 0), 0);
      totalRow.push(sumDebtCount, '', '');

      const colWidths = [22, 16, 16, 16];
      if (exportMode === 'paid' || exportMode === 'all') colWidths.push(16);
      if (exportMode === 'unpaid' || exportMode === 'all') colWidths.push(18);
      colWidths.push(12, 28, 14);

      const regionLabel = regionName || 'منطقة';
      const resellerLabel = resellerName || 'رسيلر';
      const modeLabel = exportMode === 'paid' ? 'مدفوع' : exportMode === 'unpaid' ? 'غير_مدفوع' : 'الكل';
      const blob = createXlsxBlob([headers, ...dataRows, totalRow], 'الديون', {
        alignCenter: true,
        colWidths,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ديون_${modeLabel}_${regionLabel}_${resellerLabel}_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      showSuccess('تم التصدير', `تم تنزيل ${formatNumber(subscriberDebts.length)} مشترك بنجاح.`);
      onClose();
    } catch (error) {
      showError('فشل التصدير', ApiService.showError(error));
    } finally {
      setExporting(false);
    }
  };

  if (!open) return null;

  const exportModeHint =
    exportMode === 'paid'
      ? 'سيتم تضمين عمود «الدين المدفوع».'
      : exportMode === 'unpaid'
        ? 'سيتم تضمين عمود «الدين غير المدفوع».'
        : 'سيتم تضمين عمودي «الدين المدفوع» و«الدين غير المدفوع».';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !exporting && onClose()}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">تصدير الديون إلى Excel</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={exporting}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 p-3 text-sm space-y-1">
            <p className="text-gray-700 dark:text-gray-300">
              <span className="font-medium">المنطقة:</span>{' '}
              {regionName || (regionId ? regionId : '— غير محددة —')}
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              <span className="font-medium">الرسيلر:</span>{' '}
              {resellerName || (resellerId ? resellerId : '— غير محدد —')}
            </p>
          </div>

          {!canExport && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-sm">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <p>يرجى اختيار المنطقة والرسيلر من البطاقات أعلى الصفحة قبل التصدير.</p>
            </div>
          )}

          <p className="text-sm text-gray-600 dark:text-gray-400">
            سيتم تنزيل ملف Excel يحتوي على: المشترك، الباقة، إجمالي الدين، و{exportModeHint}
            {' '}مع صف «المجموع» في نهاية الجدول.
          </p>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={exporting}
              className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 min-h-[44px]"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={!canExport || exporting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
            >
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>جاري التصدير...</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>تنزيل Excel</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebtsRegionExcelExport;
