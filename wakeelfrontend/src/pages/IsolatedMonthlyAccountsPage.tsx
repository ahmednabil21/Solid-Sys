import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService, ApiService } from '../services/api';
import { StatCard } from '../components/StatCard';
import WifiLoaderComponent from '../components/WifiLoaderComponent';
import Pagination from '../components/Pagination';
import PageSearchDateFilterBar from '../components/filters/PageSearchDateFilterBar';
import OperationalFiltersSidebar from '../components/filters/OperationalFiltersSidebar';
import ListPageWithFilters from '../components/layout/ListPageWithFilters';
import PayDebtModal from '../components/PayDebtModal';
import { STANDARD_PAGE_SIZE_OPTIONS } from '../constants/pagination';
import { useOperationalFilters } from '../hooks/useOperationalFilters';
import { useAuth } from '../contexts/AuthContext';
import { useDigits } from '../contexts/DigitsContext';
import { hasPageAction } from '../utils/employeePermissions';
import { buildRegionResellerFilterParams } from '../utils/operationalFilters';
import {
  isUnpaidDebtRow,
  resolveDebtsForCombinedPay,
  allocateCombinedDebtPayments,
} from '../utils/debtPay';
import { queueOperation, buildPayDebtPayload } from '../services/offlineSync';
import { useOffline } from '../contexts/OfflineContext';
import { showError, showSuccess } from '../utils/notifications';
import {
  Agent,
  Debt,
  DebtPaymentRequest,
  IsolatedMonthlyAccountRow,
  IsolatedMonthlyAccountsResponse,
  UserRole,
} from '../types';
import {
  CalendarDays,
  Coins,
  CreditCard,
  DollarSign,
  FileSpreadsheet,
  Gift,
  Receipt,
  RefreshCw,
  Wallet,
} from 'lucide-react';

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
};

const ARABIC_MONTHS = [
  { value: 1, label: 'يناير' },
  { value: 2, label: 'فبراير' },
  { value: 3, label: 'مارس' },
  { value: 4, label: 'أبريل' },
  { value: 5, label: 'مايو' },
  { value: 6, label: 'يونيو' },
  { value: 7, label: 'يوليو' },
  { value: 8, label: 'أغسطس' },
  { value: 9, label: 'سبتمبر' },
  { value: 10, label: 'أكتوبر' },
  { value: 11, label: 'نوفمبر' },
  { value: 12, label: 'ديسمبر' },
];

function getBaghdadYearMonth(): { year: number; month: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Baghdad',
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(new Date());
    const y = Number(parts.find((p) => p.type === 'year')?.value);
    const m = Number(parts.find((p) => p.type === 'month')?.value);
    if (y && m) return { year: y, month: m };
  } catch (_) {}
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function yearOptions(currentYear: number): number[] {
  const years: number[] = [];
  for (let y = currentYear - 5; y <= currentYear + 1; y += 1) years.push(y);
  return years;
}

const IsolatedMonthlyAccountsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const { formatNumber, formatDate } = useDigits();
  const { online, refreshPendingCount } = useOffline();

  const isAdmin = user?.role === UserRole.Admin;
  const canAccessAccounts =
    user?.role !== UserRole.Employee || user?.canAccessAccounts !== false;
  const canPayDebtAction =
    user?.role === UserRole.Admin ||
    user?.role === UserRole.Agent ||
    user?.role === UserRole.SubAgent ||
    hasPageAction(user, 'Debts', 'pay');

  const isAgentOrSubAgentOrEmployee =
    user?.role === UserRole.Agent ||
    user?.role === UserRole.SubAgent ||
    user?.role === UserRole.Employee;

  const baghdadNow = getBaghdadYearMonth();
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [year, setYear] = useState(baghdadNow.year);
  const [month, setMonth] = useState(baghdadNow.month);
  const [appliedYear, setAppliedYear] = useState(baghdadNow.year);
  const [appliedMonth, setAppliedMonth] = useState(baghdadNow.month);
  const [subscriberName, setSubscriberName] = useState('');
  const [appliedSubscriberName, setAppliedSubscriberName] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(STANDARD_PAGE_SIZE_OPTIONS[0]);
  const [freePage, setFreePage] = useState(1);
  const [freePageSize, setFreePageSize] = useState<number>(STANDARD_PAGE_SIZE_OPTIONS[0]);
  const [payDebts, setPayDebts] = useState<Debt[] | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const {
    myRegions,
    myResellers,
    filteredOperationalResellers,
    selectedOperationalRegionId,
    selectedOperationalResellerId,
    handleRegionSelect,
    handleResellerSelect,
    showOperationalFilters,
  } = useOperationalFilters(isAuthenticated && !!isAgentOrSubAgentOrEmployee, () => {
    setCurrentPage(1);
    setFreePage(1);
  });

  const regionResellerFilter = useMemo(
    () =>
      buildRegionResellerFilterParams(
        selectedOperationalRegionId,
        selectedOperationalResellerId,
        myResellers
      ),
    [selectedOperationalRegionId, selectedOperationalResellerId, myResellers]
  );

  const { data: allAgentsResponse } = useQuery({
    queryKey: ['allAgents', 'isolated-monthly-accounts-admin'],
    queryFn: () => apiService.getAllAgents({ page: 1, pageSize: 5000 }),
    enabled: isAuthenticated && isAdmin,
    retry: false,
  });
  const adminAgents = (allAgentsResponse?.data ?? []) as Agent[];

  const queryKey = useMemo(
    () =>
      [
        'isolatedMonthlyAccounts',
        isAdmin ? selectedAgentId || null : null,
        appliedYear,
        appliedMonth,
        appliedSubscriberName || null,
        regionResellerFilter.regionId ?? null,
        regionResellerFilter.resellerId ?? null,
        currentPage,
        pageSize,
        freePage,
        freePageSize,
      ] as const,
    [
      isAdmin,
      selectedAgentId,
      appliedYear,
      appliedMonth,
      appliedSubscriberName,
      regionResellerFilter.regionId,
      regionResellerFilter.resellerId,
      currentPage,
      pageSize,
      freePage,
      freePageSize,
    ]
  );

  const { data: report, error, refetch, isLoading, isFetching } = useQuery<IsolatedMonthlyAccountsResponse>({
    queryKey,
    queryFn: () =>
      apiService.getIsolatedMonthlyAccounts({
        agentId: isAdmin ? selectedAgentId || undefined : undefined,
        year: appliedYear,
        month: appliedMonth,
        subscriberName: appliedSubscriberName.trim() || undefined,
        ...regionResellerFilter,
        page: currentPage,
        pageSize,
        freePage,
        freePageSize,
      }),
    enabled: isAuthenticated && canAccessAccounts && (!isAdmin || !!selectedAgentId),
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const payDebtMutation = useMutation({
    mutationFn: async ({
      debts,
      paymentData,
    }: {
      debts: Debt[];
      paymentData: DebtPaymentRequest;
    }) => {
      const allocations = allocateCombinedDebtPayments(debts, paymentData.paymentAmount);
      if (allocations.length === 0) {
        throw new Error('لا يوجد مبلغ صالح للتسديد.');
      }
      if (!online) {
        for (const { debt, amount } of allocations) {
          await queueOperation(
            'PayDebt',
            buildPayDebtPayload(debt.id, { ...paymentData, paymentAmount: amount })
          );
        }
        return { _offlineQueued: true as const };
      }
      for (const { debt, amount } of allocations) {
        await apiService.payDebt(debt.id, { ...paymentData, paymentAmount: amount });
      }
      return { _offlineQueued: false as const };
    },
    onSuccess: async (result) => {
      if (result._offlineQueued) {
        showSuccess('تم الحفظ محلياً', 'سيتم رفع تسديد الدين عند عودة الاتصال');
        await refreshPendingCount();
      } else {
        showSuccess('تم التسديد', 'تم تسديد الدين بنجاح.');
      }
      setPayDebts(null);
      queryClient.invalidateQueries({ queryKey: ['isolatedMonthlyAccounts'] });
      queryClient.invalidateQueries({ queryKey: ['debts'] });
    },
    onError: (err: unknown) => {
      showError('خطأ في التسديد', ApiService.showError(err));
    },
  });

  const openPayForRow = async (row: IsolatedMonthlyAccountRow) => {
    if (!row.hasUnpaidDebt && !(row.unpaidAmount > 0)) return;
    try {
      const res = await apiService.getSubscriberDebts(row.subscriberId, { page: 1, pageSize: 100 });
      const debts = (res.data ?? []) as Debt[];
      const unpaid = debts.filter(isUnpaidDebtRow);
      const preferred =
        unpaid.find((d) => d.id === row.unpaidDebtId) ??
        unpaid[0];
      if (!preferred) {
        showError('تسديد', 'لا يوجد دين غير مسدد لهذا التفعيل.');
        return;
      }
      setPayDebts(resolveDebtsForCombinedPay(preferred, unpaid));
    } catch (err) {
      showError('تسديد', ApiService.showError(err));
    }
  };

  const monthLabel =
    ARABIC_MONTHS.find((m) => m.value === appliedMonth)?.label ?? String(appliedMonth);

  const renderTable = (
    title: string,
    items: IsolatedMonthlyAccountsResponse['regularItems'] | undefined,
    page: number,
    setPage: (n: number) => void,
    size: number,
    setSize: (n: number) => void
  ) => {
    const rows = items?.data ?? [];
    return (
      <div className="wakeel-table-card">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {formatNumber(items?.totalItems ?? 0)} سجل — {monthLabel} {appliedYear}
          </p>
        </div>
        <div className="wakeel-table-scroll">
          <table className="min-w-[1100px] w-full text-right">
            <thead>
              <tr>
                <th>اسم المشترك</th>
                <th>اسم المستخدم</th>
                <th>الباقة</th>
                <th>تاريخ التفعيل</th>
                <th>مبلغ المسدد</th>
                <th>مبلغ الغير مسدد</th>
                <th>تاريخ التسديد</th>
                <th>المسدد لغير شهر التفعيل</th>
                {canPayDebtAction && <th>الإجراءات</th>}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={canPayDebtAction ? 9 : 8}
                    className="text-center py-10 text-gray-500 dark:text-gray-400"
                  >
                    لا توجد سجلات ضمن الفلتر المحدد.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const otherMonth = (row.paidOtherMonthAmount ?? 0) > 0;
                  return (
                    <tr key={row.id}>
                      <td className="font-medium text-gray-900 dark:text-white">
                        {row.subscriberName || '—'}
                      </td>
                      <td className="whitespace-nowrap">{row.username || '—'}</td>
                      <td className="whitespace-nowrap">{row.profileName || '—'}</td>
                      <td className="whitespace-nowrap">
                        {row.activationDate ? formatDate(row.activationDate, DATE_OPTIONS) : '—'}
                      </td>
                      <td className="whitespace-nowrap font-medium">
                        {formatNumber(row.paidAmount ?? 0)} د.ع
                      </td>
                      <td className="whitespace-nowrap font-medium text-red-600 dark:text-red-400">
                        {formatNumber(row.unpaidAmount ?? 0)} د.ع
                      </td>
                      <td className="whitespace-nowrap">
                        {row.paymentDate ? formatDate(row.paymentDate, DATE_OPTIONS) : '—'}
                      </td>
                      <td
                        className={
                          otherMonth
                            ? 'whitespace-nowrap font-semibold text-orange-600 dark:text-orange-400'
                            : 'whitespace-nowrap'
                        }
                      >
                        {formatNumber(row.paidOtherMonthAmount ?? 0)} د.ع
                      </td>
                      {canPayDebtAction && (
                        <td>
                          <button
                            type="button"
                            disabled={!row.hasUnpaidDebt && !(row.unpaidAmount > 0)}
                            onClick={() => openPayForRow(row)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-green-600 hover:bg-green-700 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            تسديد
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {(items?.totalItems ?? 0) > 0 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <Pagination
              currentPage={Math.max(1, items?.currentPage ?? page)}
              totalPages={Math.max(1, items?.totalPages ?? 1)}
              totalItems={items?.totalItems ?? 0}
              pageSize={items?.pageSize ?? size}
              hasNextPage={!!items?.hasNextPage}
              hasPreviousPage={!!items?.hasPreviousPage}
              onPageChange={setPage}
              pageSizeOptions={[...STANDARD_PAGE_SIZE_OPTIONS]}
              onPageSizeChange={(next) => {
                setSize(next);
                setPage(1);
              }}
            />
          </div>
        )}
      </div>
    );
  };

  const handleExportExcel = async () => {
    if (isAdmin && !selectedAgentId) return;
    try {
      setIsExporting(true);
      const blob = await apiService.exportIsolatedMonthlyAccountsToExcel({
        agentId: isAdmin ? selectedAgentId || undefined : undefined,
        year: appliedYear,
        month: appliedMonth,
        subscriberName: appliedSubscriberName.trim() || undefined,
        ...regionResellerFilter,
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `isolated-monthly-accounts_${appliedYear}_${String(appliedMonth).padStart(2, '0')}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showSuccess('تم التصدير', 'تم تنزيل ملف Excel بنفس جداول الصفحة.');
    } catch (err: unknown) {
      showError('خطأ في التصدير', ApiService.showError(err));
    } finally {
      setIsExporting(false);
    }
  };

  if (!canAccessAccounts) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-800 dark:text-red-200">
          ليس لديك صلاحية الوصول إلى الحسابات الشهرية المعزولة.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">حسابات شهرية معزولة</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            تفعيلات الاشتراك حسب الشهر. المبالغ = الباقة + أجور الخدمة، مع فصل المسدد لغير شهر التفعيل والمشتركين المجانيين
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExporting || (isAdmin && !selectedAgentId)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {isExporting ? 'جاري التصدير...' : 'تصدير اكسل'}
          </button>
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
      </div>

      {isAdmin && (
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">الوكيل</label>
          <select
            value={selectedAgentId}
            onChange={(e) => {
              setSelectedAgentId(e.target.value);
              setCurrentPage(1);
              setFreePage(1);
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
        onApply={() => {
          setAppliedSubscriberName(subscriberName);
          setCurrentPage(1);
          setFreePage(1);
        }}
        onClear={() => {
          setSubscriberName('');
          setAppliedSubscriberName('');
          setCurrentPage(1);
          setFreePage(1);
        }}
        disabled={isAdmin && !selectedAgentId}
      />

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">السنة</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm min-w-[120px]"
          >
            {yearOptions(baghdadNow.year).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">الشهر</label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm min-w-[140px]"
          >
            {ARABIC_MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => {
            setAppliedYear(year);
            setAppliedMonth(month);
            setAppliedSubscriberName(subscriberName);
            setCurrentPage(1);
            setFreePage(1);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm"
        >
          <CalendarDays className="h-4 w-4" />
          عرض الشهر
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-800 dark:text-red-200">
          {ApiService.showError(error)}
        </div>
      )}

      {isAdmin && !selectedAgentId ? (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-200 mb-6">
          يرجى اختيار وكيل لعرض الحسابات الشهرية المعزولة (للأدمن).
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
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <StatCard
              title="مجموع الوارد التفعيلات الكلي"
              value={
                report?.totalGrossActivationsIncome
                ?? (report?.totalActivationsIncome ?? 0) + (report?.totalServiceFeesIncome ?? 0)
              }
              icon={Wallet}
              color="blue"
              isAmount
              glass
            />
            <StatCard title="وارد التفعيلات" value={report?.totalActivationsIncome ?? report?.totalPaid ?? 0} icon={DollarSign} color="green" isAmount glass />
            <StatCard title="وارد الأجور" value={report?.totalServiceFeesIncome ?? 0} icon={Coins} color="teal" isAmount glass />
            <StatCard title="مجموع التفعيلات الغير مسددة" value={report?.totalUnpaid ?? 0} icon={CreditCard} color="red" isAmount glass />
            <StatCard
              title="مبلغ الأجور الغير مسددة"
              value={report?.totalUnpaidServiceFees ?? 0}
              icon={Receipt}
              color="blue"
              isAmount
              glass
            />
            <StatCard
              title="المسدد لغير الشهر الحالي"
              value={report?.totalPaidOtherMonth ?? 0}
              icon={Wallet}
              color="orange"
              isAmount
              glass
            />
            <StatCard
              title="اشتراكات مجانية غير مسددة"
              value={report?.totalUnpaidFreeSubscriptions ?? 0}
              icon={Gift}
              color="purple"
              isAmount
              glass
            />
            <StatCard title="وارد الكاشباك" value={report?.totalCashbackIncome ?? 0} icon={Coins} color="indigo" isAmount glass />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <WifiLoaderComponent
                background="transparent"
                desktopSize="150px"
                mobileSize="150px"
                text="تحميل الحسابات الشهرية المعزولة..."
                backColor="#E8F2FC"
                frontColor="#4645F6"
              />
            </div>
          ) : (
            <div className="space-y-6">
              {renderTable(
                'المشتركون الاعتياديون',
                report?.regularItems,
                currentPage,
                setCurrentPage,
                pageSize,
                setPageSize
              )}
              {renderTable(
                'المشتركون المجانيون',
                report?.freeItems,
                freePage,
                setFreePage,
                freePageSize,
                setFreePageSize
              )}
            </div>
          )}
        </ListPageWithFilters>
      )}

      {payDebts && payDebts.length > 0 && (
        <PayDebtModal
          debts={payDebts}
          isPending={payDebtMutation.isPending}
          onClose={() => setPayDebts(null)}
          onConfirm={(paymentData) => payDebtMutation.mutate({ debts: payDebts, paymentData })}
        />
      )}
    </div>
  );
};

export default IsolatedMonthlyAccountsPage;
