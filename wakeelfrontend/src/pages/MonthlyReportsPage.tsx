import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiService, ApiService } from '../services/api';
import { StatCard } from '../components/StatCard';
import WifiLoaderComponent from '../components/WifiLoaderComponent';
import Pagination from '../components/Pagination';
import PageSearchDateFilterBar from '../components/filters/PageSearchDateFilterBar';
import OperationalFiltersSidebar from '../components/filters/OperationalFiltersSidebar';
import ListPageWithFilters from '../components/layout/ListPageWithFilters';
import { STANDARD_PAGE_SIZE_OPTIONS } from '../constants/pagination';
import { useOperationalFilters } from '../hooks/useOperationalFilters';
import { useAuth } from '../contexts/AuthContext';
import { useDigits } from '../contexts/DigitsContext';
import {
  Agent,
  ActivationPaymentMethod,
  MonthlyReportInvoiceType,
  MonthlyReportResponse,
  UserRole,
} from '../types';
import { buildRegionResellerFilterParams } from '../utils/operationalFilters';
import {
  CalendarRange,
  Coins,
  CreditCard,
  DollarSign,
  RefreshCw,
  Wallet,
} from 'lucide-react';

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
};

function getBaghdadToday(): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Baghdad',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch (_) {}
  return new Date().toISOString().split('T')[0];
}

function getBaghdadDateDaysAgo(days: number): string {
  const today = getBaghdadToday();
  const [y, m, d] = today.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function normalizeDateRange(from: string, to: string): { from: string; to: string } {
  const f = (from ?? '').trim();
  const t = (to ?? '').trim();
  if (f && t && f > t) return { from: t, to: f };
  return { from: f, to: t };
}

function formatDateRangeLabel(from: string, to: string): string {
  if (!from && !to) return 'كل الفترة (الأحدث أولاً)';
  if (from && to) return `${from} — ${to}`;
  if (from) return `من ${from}`;
  return `حتى ${to}`;
}

function paymentMethodLabel(pm?: number | null, labelAr?: string): string {
  if (labelAr) return labelAr;
  if (Number(pm) === ActivationPaymentMethod.Cash) return 'كاش';
  if (Number(pm) === ActivationPaymentMethod.Master) return 'ماستر';
  if (Number(pm) === ActivationPaymentMethod.Deferred) return 'آجل';
  if (Number(pm) === ActivationPaymentMethod.CustomerWallet) return 'محفظة زبون';
  return '—';
}

const MonthlyReportsPage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const { formatNumber, formatDate } = useDigits();

  const isAdmin = user?.role === UserRole.Admin;
  const canAccessAccounts =
    user?.role !== UserRole.Employee || user?.canAccessAccounts !== false;

  const isAgentOrSubAgentOrEmployee =
    user?.role === UserRole.Agent ||
    user?.role === UserRole.SubAgent ||
    user?.role === UserRole.Employee;

  const defaultToDate = getBaghdadToday();
  const defaultFromDate = getBaghdadDateDaysAgo(30);

  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(defaultToDate);
  const [appliedFromDate, setAppliedFromDate] = useState(defaultFromDate);
  const [appliedToDate, setAppliedToDate] = useState(defaultToDate);
  const [subscriberName, setSubscriberName] = useState('');
  const [appliedSubscriberName, setAppliedSubscriberName] = useState('');
  const [invoiceType, setInvoiceType] = useState<string>('');
  const [appliedInvoiceType, setAppliedInvoiceType] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [appliedPaymentMethod, setAppliedPaymentMethod] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(STANDARD_PAGE_SIZE_OPTIONS[0]);

  const {
    myRegions,
    myResellers,
    filteredOperationalResellers,
    selectedOperationalRegionId,
    selectedOperationalResellerId,
    handleRegionSelect,
    handleResellerSelect,
    showOperationalFilters,
  } = useOperationalFilters(isAuthenticated && !!isAgentOrSubAgentOrEmployee, () => setCurrentPage(1));

  const regionResellerFilter = useMemo(
    () => buildRegionResellerFilterParams(selectedOperationalRegionId, selectedOperationalResellerId, myResellers),
    [selectedOperationalRegionId, selectedOperationalResellerId, myResellers]
  );

  const { data: allAgentsResponse } = useQuery({
    queryKey: ['allAgents', 'monthly-report-admin'],
    queryFn: () => apiService.getAllAgents({ page: 1, pageSize: 5000 }),
    enabled: isAuthenticated && isAdmin,
    retry: false,
  });
  const adminAgents = (allAgentsResponse?.data ?? []) as Agent[];

  const queryKey = useMemo(
    () =>
      [
        'monthlyReport',
        isAdmin ? selectedAgentId || null : null,
        appliedFromDate,
        appliedToDate,
        regionResellerFilter.regionId ?? null,
        regionResellerFilter.resellerId ?? null,
        appliedSubscriberName || null,
        appliedInvoiceType || null,
        appliedPaymentMethod || null,
        currentPage,
        pageSize,
      ] as const,
    [
      isAdmin,
      selectedAgentId,
      appliedFromDate,
      appliedToDate,
      regionResellerFilter.regionId,
      regionResellerFilter.resellerId,
      appliedSubscriberName,
      appliedInvoiceType,
      appliedPaymentMethod,
      currentPage,
      pageSize,
    ]
  );

  const { data: report, error, refetch, isLoading, isFetching } = useQuery<MonthlyReportResponse>({
    queryKey,
    queryFn: () =>
      apiService.getMonthlyReport({
        agentId: isAdmin ? selectedAgentId || undefined : undefined,
        fromDate: appliedFromDate || undefined,
        toDate: appliedToDate || undefined,
        ...regionResellerFilter,
        subscriberName: appliedSubscriberName.trim() || undefined,
        invoiceType: (appliedInvoiceType as MonthlyReportInvoiceType) || undefined,
        paymentMethod: appliedPaymentMethod ? Number(appliedPaymentMethod) : undefined,
        page: currentPage,
        pageSize,
      }),
    enabled: isAuthenticated && canAccessAccounts && (!isAdmin || !!selectedAgentId),
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const rows = report?.items?.data ?? [];

  const handleApplyFilters = () => {
    const normalized = normalizeDateRange(fromDate, toDate);
    if (normalized.from !== fromDate.trim() || normalized.to !== toDate.trim()) {
      setFromDate(normalized.from);
      setToDate(normalized.to);
    }
    setAppliedFromDate(normalized.from);
    setAppliedToDate(normalized.to);
    setAppliedSubscriberName(subscriberName);
    setAppliedInvoiceType(invoiceType);
    setAppliedPaymentMethod(paymentMethod);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setFromDate('');
    setToDate('');
    setSubscriberName('');
    setInvoiceType('');
    setPaymentMethod('');
    setAppliedFromDate('');
    setAppliedToDate('');
    setAppliedSubscriberName('');
    setAppliedInvoiceType('');
    setAppliedPaymentMethod('');
    setCurrentPage(1);
  };

  const handleLast30Days = () => {
    setFromDate(defaultFromDate);
    setToDate(defaultToDate);
    setAppliedFromDate(defaultFromDate);
    setAppliedToDate(defaultToDate);
    setCurrentPage(1);
  };

  if (!canAccessAccounts) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-800 dark:text-red-200">
          ليس لديك صلاحية الوصول إلى التقارير الشهرية.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">التقارير الشهرية</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            فواتير باقة الاشتراك والأجور حسب تاريخ التفعيل — {formatDateRangeLabel(appliedFromDate, appliedToDate)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          تحديث
        </button>
      </div>

      {isAdmin && (
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">الوكيل</label>
          <select
            value={selectedAgentId}
            onChange={(e) => {
              setSelectedAgentId(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
          >
            <option value="">اختر وكيلاً...</option>
            {adminAgents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.companyName || a.fullName || a.username}
              </option>
            ))}
          </select>
        </div>
      )}

      <PageSearchDateFilterBar
        searchTerm={subscriberName}
        onSearchTermChange={setSubscriberName}
        searchPlaceholder="اسم المشترك أو اليوزر..."
        fromDate={fromDate}
        toDate={toDate}
        onFromDateChange={setFromDate}
        onToDateChange={setToDate}
        fromLabel="تاريخ التفعيل من"
        toLabel="تاريخ التفعيل إلى"
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
        extraActions={
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">نوع الفاتورة</label>
              <select
                value={invoiceType}
                onChange={(e) => setInvoiceType(e.target.value)}
                className="w-full min-w-[140px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
              >
                <option value="">الكل</option>
                <option value="subscriptionPackage">باقة اشتراك</option>
                <option value="serviceFees">أجور</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">نوع الدفع</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full min-w-[140px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
              >
                <option value="">الكل</option>
                <option value={ActivationPaymentMethod.Cash}>كاش</option>
                <option value={ActivationPaymentMethod.Master}>ماستر</option>
                <option value={ActivationPaymentMethod.Deferred}>آجل</option>
                <option value={ActivationPaymentMethod.CustomerWallet}>محفظة زبون</option>
              </select>
            </div>
            <button
              type="button"
              onClick={handleLast30Days}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <CalendarRange className="h-4 w-4" />
              آخر 30 يوم
            </button>
          </>
        }
      />

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-800 dark:text-red-200">
          {ApiService.showError(error)}
        </div>
      )}

      {isAdmin && !selectedAgentId ? (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-200 mb-6">
          يرجى اختيار وكيل لعرض التقارير الشهرية (للأدمن).
        </div>
      ) : (
        <ListPageWithFilters
          sidebar={
            showOperationalFilters ? (
              <OperationalFiltersSidebar
                regions={myRegions}
                resellers={filteredOperationalResellers}
                selectedRegionId={selectedOperationalRegionId}
                selectedResellerId={selectedOperationalResellerId}
                onRegionSelect={handleRegionSelect}
                onResellerSelect={handleResellerSelect}
              />
            ) : undefined
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 sm:gap-4 mb-6">
            <StatCard title="الوارد الكلي" value={report?.totalIncome ?? 0} icon={DollarSign} color="blue" isAmount glass />
            <StatCard title="وارد اشتراك" value={report?.subscriptionIncome ?? 0} icon={Wallet} color="green" isAmount glass />
            <StatCard title="وارد أجور" value={report?.serviceFeesIncome ?? 0} icon={Coins} color="teal" isAmount glass />
            <StatCard
              title="ديون اشتراك غير واصلة"
              value={report?.unpaidSubscriptionDebt ?? 0}
              icon={CreditCard}
              color="red"
              isAmount
              glass
            />
            <StatCard title="ديون الأجور" value={report?.serviceFeesDebt ?? 0} icon={CreditCard} color="orange" isAmount glass />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <WifiLoaderComponent
                background="transparent"
                desktopSize="150px"
                mobileSize="150px"
                text="تحميل التقرير الشهري..."
                backColor="#E8F2FC"
                frontColor="#4645F6"
              />
            </div>
          ) : (
            <div className="wakeel-table-card">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">سجل التقارير الشهرية</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {formatNumber(report?.items?.totalItems ?? 0)} سجل — {formatDateRangeLabel(appliedFromDate, appliedToDate)}
                </p>
              </div>
              <div className="wakeel-table-scroll">
                <table className="min-w-[1100px] w-full text-right">
                  <thead>
                    <tr>
                      <th>اسم المشترك</th>
                      <th>تاريخ أصل الاشتراك</th>
                      <th>حالة الدفع</th>
                      <th>نوع الدفع</th>
                      <th>المبلغ</th>
                      <th>تاريخ وارد الاشتراك</th>
                      <th>نوع الفاتورة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-10 text-gray-500 dark:text-gray-400">
                          لا توجد سجلات ضمن الفلتر المحدد.
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => (
                        <tr key={`${row.renewalId}-${row.invoiceType}`}>
                          <td className="font-medium text-gray-900 dark:text-white">{row.subscriberName || '—'}</td>
                          <td className="whitespace-nowrap">
                            {row.activationDate ? formatDate(row.activationDate, DATE_OPTIONS) : '—'}
                          </td>
                          <td>
                            <span
                              className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                                row.isPaid
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                              }`}
                            >
                              {row.paymentStatus || (row.isPaid ? 'واصل' : 'غير واصل')}
                            </span>
                          </td>
                          <td>{paymentMethodLabel(row.paymentMethod, row.paymentMethodLabelAr)}</td>
                          <td className="whitespace-nowrap font-medium">
                            {formatNumber(row.amount)} د.ع
                          </td>
                          <td className="whitespace-nowrap">
                            {row.amountReceivedDate
                              ? formatDate(row.amountReceivedDate, DATE_OPTIONS)
                              : '—'}
                          </td>
                          <td>
                            <span
                              className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                                row.invoiceType === 'serviceFees'
                                  ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300'
                                  : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300'
                              }`}
                            >
                              {row.invoiceTypeLabelAr ||
                                (row.invoiceType === 'serviceFees' ? 'أجور' : 'باقة اشتراك')}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {(report?.items?.totalItems ?? 0) > 0 && (
                <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                  <Pagination
                    currentPage={Math.max(1, report?.items?.currentPage ?? currentPage)}
                    totalPages={Math.max(1, report?.items?.totalPages ?? 1)}
                    totalItems={report?.items?.totalItems ?? 0}
                    pageSize={report?.items?.pageSize ?? pageSize}
                    hasNextPage={!!report?.items?.hasNextPage}
                    hasPreviousPage={!!report?.items?.hasPreviousPage}
                    onPageChange={setCurrentPage}
                    pageSizeOptions={[...STANDARD_PAGE_SIZE_OPTIONS]}
                    onPageSizeChange={(size) => {
                      setPageSize(size);
                      setCurrentPage(1);
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </ListPageWithFilters>
      )}
    </div>
  );
};

export default MonthlyReportsPage;
