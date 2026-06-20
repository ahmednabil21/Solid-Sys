import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { useConfirmation } from '../contexts/ConfirmationContext';
import {
  Agent,
  AccountsLedgerEntry,
  AccountsResponse,
  ActivationPaymentMethod,
  ProfilePackageType,
  User,
  UserRole,
  AgentReseller,
  AgentRegion,
} from '../types';
import { showError, showSuccess } from '../utils/notifications';
import {
  buildRegionResellerFilterParams,
} from '../utils/operationalFilters';
import {
  ArrowDownLeft,
  Coins,
  CreditCard,
  DollarSign,
  FileSpreadsheet,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';

const LEDGER_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
};

const PACKAGE_TYPE_OPTIONS = [
  { value: ProfilePackageType.Subscription, label: 'اشتراك' },
  { value: ProfilePackageType.Extension, label: 'تمديد' },
  { value: ProfilePackageType.SpecialOffer, label: 'عرض خاص' },
] as const;

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

function ledgerKindLabel(kind: string): string {
  if (kind === 'Renewal') return 'تفعيل';
  if (kind === 'DebtPayment') return 'تسديد دين';
  return kind;
}

function activationPaymentMethodLabel(pm?: number | null): string {
  if (Number(pm) === ActivationPaymentMethod.Cash) return 'كاش';
  if (Number(pm) === ActivationPaymentMethod.Master) return 'ماستر';
  if (Number(pm) === ActivationPaymentMethod.Deferred) return 'آجل';
  if (Number(pm) === ActivationPaymentMethod.CustomerWallet) return 'محفظة زبون';
  return '—';
}

const LEDGER_TABLE_COLS = 17;

function formatAccountsDateRangeLabel(from: string, to: string): string {
  if (!from && !to) return 'كل الفترة (الأحدث أولاً)';
  if (from && to) return `${from} — ${to}`;
  if (from) return `من ${from}`;
  return `حتى ${to}`;
}

function normalizeAccountsDateRange(from: string, to: string): { from: string; to: string } {
  const f = (from ?? '').trim();
  const t = (to ?? '').trim();
  if (f && t && f > t) return { from: t, to: f };
  return { from: f, to: t };
}

function isRenewalEntry(row: AccountsLedgerEntry): row is AccountsLedgerEntry & {
  kind: 'Renewal';
  profileName?: string;
  receiptNumber?: string;
  activationProfit?: number;
  paymentMethod?: number;
  serviceFeesAmount?: number;
  serviceFeesDebtAmount?: number;
  totalProfit?: number;
  nationalSubscriptionCost?: number;
  balanceDeductionAmount?: number;
  agentResellerId?: string;
} {
  return row.kind === 'Renewal';
}

/** تمييز سجل تفعيل فيه دين: وارد عام = 0 أو مبلغ الأجور = 0 */
function isUnpaidLedgerRenewalRow(row: AccountsLedgerEntry): boolean {
  if (!isRenewalEntry(row)) return false;
  const serviceFeesAmount = row.serviceFeesAmount ?? 0;
  const generalIncome = row.generalIncome ?? 0;
  return serviceFeesAmount === 0 || generalIncome === 0;
}

const ReportsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const { formatNumber, formatDate } = useDigits();
  const { confirmAction } = useConfirmation();

  const isAdmin = user?.role === UserRole.Admin;
  const canDeleteLedger =
    user?.role === UserRole.Admin ||
    user?.role === UserRole.Agent ||
    user?.role === UserRole.MainAgent;
  const canAccessAccounts =
    user?.role !== UserRole.Employee || user?.canAccessAccounts !== false;

  const isAgentOrSubAgentOrEmployee =
    user?.role === UserRole.Agent ||
    user?.role === UserRole.SubAgent ||
    user?.role === UserRole.Employee;

  const defaultToDate = getBaghdadToday();
  const defaultFromDate = getBaghdadDateDaysAgo(30);

  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [appliedFromDate, setAppliedFromDate] = useState('');
  const [appliedToDate, setAppliedToDate] = useState('');
  const [subscriberName, setSubscriberName] = useState('');
  const [appliedSubscriberName, setAppliedSubscriberName] = useState('');
  const [packageType, setPackageType] = useState<string>('');
  const [appliedPackageType, setAppliedPackageType] = useState<string>('');
  const [executedByUserId, setExecutedByUserId] = useState('');
  const [appliedExecutedByUserId, setAppliedExecutedByUserId] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(STANDARD_PAGE_SIZE_OPTIONS[0]);
  const [isExportingAccounts, setIsExportingAccounts] = useState(false);
  const [showAdvancedFiltersModal, setShowAdvancedFiltersModal] = useState(false);

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

  const { data: myEmployees = [] } = useQuery<User[]>({
    queryKey: ['myEmployees', 'accounts'],
    queryFn: () => apiService.getMyEmployees(),
    enabled: isAuthenticated && isAgentOrSubAgentOrEmployee && !isAdmin,
    retry: false,
  });

  const accountsRegionResellerFilter = useMemo(
    () => buildRegionResellerFilterParams(selectedOperationalRegionId, selectedOperationalResellerId, myResellers),
    [selectedOperationalRegionId, selectedOperationalResellerId, myResellers]
  );

  const { data: allAgentsResponse } = useQuery({
    queryKey: ['allAgents', 'accounts-admin'],
    queryFn: () => apiService.getAllAgents({ page: 1, pageSize: 5000 }),
    enabled: isAuthenticated && isAdmin,
    retry: false,
  });
  const adminAgents = (allAgentsResponse?.data ?? []) as Agent[];

  const accountsQueryKey = useMemo(
    () =>
      [
        'accounts',
        isAdmin ? (selectedAgentId || null) : null,
        appliedFromDate,
        appliedToDate,
        accountsRegionResellerFilter.regionId ?? null,
        accountsRegionResellerFilter.resellerId ?? null,
        appliedSubscriberName || null,
        appliedPackageType || null,
        appliedExecutedByUserId || null,
        currentPage,
        pageSize,
      ] as const,
    [
      isAdmin,
      selectedAgentId,
      appliedFromDate,
      appliedToDate,
      accountsRegionResellerFilter.regionId,
      accountsRegionResellerFilter.resellerId,
      appliedSubscriberName,
      appliedPackageType,
      appliedExecutedByUserId,
      currentPage,
      pageSize,
    ]
  );

  const buildAccountsParams = () => ({
    agentId: isAdmin ? (selectedAgentId || undefined) : undefined,
    fromDate: appliedFromDate || undefined,
    toDate: appliedToDate || undefined,
    ...accountsRegionResellerFilter,
    subscriberName: appliedSubscriberName.trim() || undefined,
    packageType: appliedPackageType ? Number(appliedPackageType) : undefined,
    executedByUserId: appliedExecutedByUserId.trim() || undefined,
    page: currentPage,
    pageSize,
  });

  const { data: accounts, error, refetch, isLoading, isFetching } = useQuery<AccountsResponse>({
    queryKey: accountsQueryKey,
    queryFn: () => apiService.getAccounts(buildAccountsParams()),
    enabled: isAuthenticated && canAccessAccounts && (!isAdmin || !!selectedAgentId),
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const deleteLedgerMutation = useMutation({
    mutationFn: (entry: AccountsLedgerEntry) =>
      apiService.deleteAccountsLedgerEntry(
        entry.id,
        entry.kind,
        isAdmin ? (selectedAgentId || undefined) : undefined
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      showSuccess('تم الحذف', 'تم حذف السجل من تقرير الحسابات.');
    },
    onError: (err: unknown) => showError('خطأ', ApiService.showError(err)),
  });

  const resellerNameById = useMemo(() => {
    const map = new Map<string, string>();
    myResellers.forEach((r) => map.set(r.id, r.name));
    return map;
  }, [myResellers]);

  const ledgerColSpan = LEDGER_TABLE_COLS + (canDeleteLedger ? 1 : 0);

  const handleApplyMainFilters = () => {
    const normalized = normalizeAccountsDateRange(fromDate, toDate);
    if (normalized.from !== fromDate.trim() || normalized.to !== toDate.trim()) {
      setFromDate(normalized.from);
      setToDate(normalized.to);
    }
    setAppliedFromDate(normalized.from);
    setAppliedToDate(normalized.to);
    setAppliedSubscriberName(subscriberName);
    setCurrentPage(1);
  };

  const handleApplyFilters = () => {
    setAppliedPackageType(packageType);
    setAppliedExecutedByUserId(executedByUserId);
    setCurrentPage(1);
    setShowAdvancedFiltersModal(false);
  };

  const handleResetFilters = () => {
    setFromDate('');
    setToDate('');
    setSubscriberName('');
    setPackageType('');
    setExecutedByUserId('');
    setAppliedFromDate('');
    setAppliedToDate('');
    setAppliedSubscriberName('');
    setAppliedPackageType('');
    setAppliedExecutedByUserId('');
    setCurrentPage(1);
  };

  const handleLast30DaysFilter = () => {
    setFromDate(defaultFromDate);
    setToDate(defaultToDate);
    setAppliedFromDate(defaultFromDate);
    setAppliedToDate(defaultToDate);
    setCurrentPage(1);
  };

  const renderAdvancedFiltersForm = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">نوع الباقة</label>
        <select
          value={packageType}
          onChange={(e) => setPackageType(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm"
        >
          <option value="">الكل</option>
          {PACKAGE_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      {!isAdmin && myEmployees.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">نفّذ بواسطة</label>
          <select
            value={executedByUserId}
            onChange={(e) => setExecutedByUserId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm"
          >
            <option value="">الكل</option>
            {myEmployees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.fullName || emp.username}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );

  const handleExportAccountsExcel = async () => {
    try {
      setIsExportingAccounts(true);
      const blob = await apiService.exportAccountsToExcel({
        agentId: isAdmin ? (selectedAgentId || undefined) : undefined,
        fromDate: appliedFromDate || undefined,
        toDate: appliedToDate || undefined,
        ...accountsRegionResellerFilter,
        packageType: appliedPackageType ? Number(appliedPackageType) : undefined,
        executedByUserId: appliedExecutedByUserId.trim() || undefined,
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `accounts_${appliedFromDate || 'all'}_${appliedToDate || 'all'}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showSuccess('تم التصدير', 'تم تنزيل ملف Excel للتفعيلات.');
    } catch (err: unknown) {
      showError('خطأ في التصدير', ApiService.showError(err));
    } finally {
      setIsExportingAccounts(false);
    }
  };

  const handleRefresh = () => {
    refetch();
    setLastUpdated(new Date());
  };

  const handleDeleteEntry = async (entry: AccountsLedgerEntry) => {
    const ok = await confirmAction(
      'حذف السجل',
      `هل تريد حذف سجل ${ledgerKindLabel(entry.kind)} للمشترك «${entry.subscriberName || '—'}»؟`
    );
    if (ok) deleteLedgerMutation.mutate(entry);
  };

  if (!canAccessAccounts) {
    return (
      <div className="p-6">
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-200">
          ليس لديك صلاحية الوصول إلى الحسابات.
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-red-800 dark:text-red-200">خطأ في تحميل البيانات</h3>
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">{ApiService.showError(error)}</p>
        </div>
      </div>
    );
  }

  const ledger = accounts?.ledger;
  const ledgerRows = ledger?.data ?? [];

  return (
    <div className="p-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">الحسابات</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            تقرير موحّد: تفعيلات، تسديد ديون، ومجاميع الفترة
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            آخر تحديث: {lastUpdated.toLocaleTimeString('ar-EG')}
          </div>
          {isAdmin && (
            <select
              value={selectedAgentId}
              onChange={(e) => {
                setSelectedAgentId(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm"
              title="اختيار الوكيل"
            >
              <option value="">اختر الوكيل...</option>
              {adminAgents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.companyName || a.fullName || a.username}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={handleExportAccountsExcel}
            disabled={isExportingAccounts || (isAdmin && !selectedAgentId)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>{isExportingAccounts ? 'جاري التصدير...' : 'تصدير Excel'}</span>
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isFetching}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md text-sm disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </button>
        </div>
      </div>

      <PageSearchDateFilterBar
        searchTerm={subscriberName}
        onSearchTermChange={setSubscriberName}
        searchPlaceholder="الاسم أو اسم المستخدم..."
        fromDate={fromDate}
        toDate={toDate}
        onFromDateChange={setFromDate}
        onToDateChange={setToDate}
        onApply={handleApplyMainFilters}
        onClear={handleResetFilters}
        disabled={isAdmin && !selectedAgentId}
        showAdvancedButton
        onAdvancedClick={() => setShowAdvancedFiltersModal(true)}
        advancedActive={!!(appliedPackageType || appliedExecutedByUserId)}
        advancedLabel="فلترة متقدمة"
        extraActions={
          <>
            <button
              type="button"
              onClick={handleResetFilters}
              disabled={isAdmin && !selectedAgentId}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded-lg text-sm disabled:opacity-50"
            >
              كل الفترة
            </button>
            <button
              type="button"
              onClick={handleLast30DaysFilter}
              disabled={isAdmin && !selectedAgentId}
              className="px-4 py-2 text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg text-sm disabled:opacity-50"
            >
              آخر 30 يوم
            </button>
          </>
        }
      />
      <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
        الفترة المعروضة: {formatAccountsDateRangeLabel(appliedFromDate, appliedToDate)}
        {appliedSubscriberName.trim() ? ` — المشترك: «${appliedSubscriberName.trim()}»` : ''}
      </p>

      {isAdmin && !selectedAgentId ? (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-200 mb-6">
          يرجى اختيار وكيل لعرض الحسابات (للأدمن).
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
          <div className="space-y-5 mb-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">الوارد والإيرادات</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
                <StatCard
                  title="الوارد الكلي"
                  value={accounts?.totalGeneralIncome ?? 0}
                  icon={DollarSign}
                  color="blue"
                  isAmount
                  glass
                />
                <StatCard
                  title="واصل اشتراك"
                  value={accounts?.totalPackageIncome ?? 0}
                  icon={Wallet}
                  color="green"
                  isAmount
                  glass
                />
                <StatCard
                  title="وارد الأجور"
                  value={accounts?.totalServiceFeesIncome ?? 0}
                  icon={Coins}
                  color="teal"
                  isAmount
                  glass
                />
                <StatCard
                  title="وارد الكاشباك"
                  value={accounts?.totalCashbackIncome ?? 0}
                  icon={Coins}
                  color="indigo"
                  isAmount
                  glass
                />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">التكاليف والديون</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 sm:gap-4">
                <StatCard
                  title="استقطاع رصيد المنطقة"
                  value={accounts?.totalBalanceDeduction ?? 0}
                  icon={ArrowDownLeft}
                  color="red"
                  isAmount
                  glass
                />
                <StatCard
                  title="اقتطاع كلفة الوكيل"
                  value={accounts?.totalAgentPackageIncome ?? 0}
                  icon={CreditCard}
                  color="orange"
                  isAmount
                  glass
                />
                <StatCard
                  title="ديون اشتراك واصلة"
                  value={accounts?.totalPaidSubscriptionDebt ?? 0}
                  icon={CreditCard}
                  color="purple"
                  isAmount
                  glass
                />
                <StatCard
                  title="ديون اشتراك غير واصلة"
                  value={accounts?.totalUnpaidSubscriptionDebt ?? 0}
                  icon={CreditCard}
                  color="red"
                  isAmount
                  glass
                />
                <StatCard
                  title="ديون الأجور"
                  value={accounts?.totalServiceFeesDebt ?? 0}
                  icon={CreditCard}
                  color="orange"
                  isAmount
                  glass
                />
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <WifiLoaderComponent
                background="transparent"
                desktopSize="150px"
                mobileSize="150px"
                text="تحميل الحسابات..."
                backColor="#E8F2FC"
                frontColor="#4645F6"
              />
            </div>
          ) : (
            <div className="wakeel-table-card">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">سجل الحسابات</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    تفعيلات وتسديد ديون — {formatAccountsDateRangeLabel(appliedFromDate, appliedToDate)}
                  </p>
                </div>
                <div className="wakeel-table-scroll">
                  <table className="min-w-[1400px] w-full text-right">
                    <thead>
                      <tr>
                        <th>الرسيلر</th>
                        <th>النوع</th>
                        <th>اسم المشترك</th>
                        <th>يوزر المشترك</th>
                        <th>الباقة</th>
                        <th>طريقة الدفع</th>
                        <th>كلفة اشتراك الوكيل</th>
                        <th>واصل اشتراك</th>
                        <th>استقطاع الرصيد</th>
                        <th>وارد عام</th>
                        <th>مبلغ الأجور</th>
                        <th>مبلغ الكاشباك</th>
                        <th>الربح الكلي</th>
                        <th>تاريخ العملية</th>
                        <th>تاريخ الإنشاء</th>
                        <th>رقم الفاتورة</th>
                        <th>نفّذ بواسطة</th>
                        {canDeleteLedger && <th className="w-[1%]" />}
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerRows.length === 0 ? (
                        <tr>
                          <td colSpan={ledgerColSpan} className="py-8 text-sm text-gray-500 dark:text-gray-400 text-center">
                            لا توجد سجلات في هذه الفترة.
                          </td>
                        </tr>
                      ) : (
                        ledgerRows.map((row) => {
                          const renewal = isRenewalEntry(row) ? row : null;
                          const resellerName =
                            renewal?.agentResellerId != null
                              ? resellerNameById.get(renewal.agentResellerId) ?? renewal.agentResellerId
                              : '—';

                          return (
                            <tr
                              key={`${row.kind}-${row.id}`}
                              className={isUnpaidLedgerRenewalRow(row) ? 'wakeel-table-row-unpaid' : undefined}
                            >
                              <td>{resellerName}</td>
                              <td className="whitespace-nowrap">
                                <span
                                  className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                                    row.kind === 'Renewal'
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                                      : 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200'
                                  }`}
                                >
                                  {ledgerKindLabel(row.kind)}
                                </span>
                              </td>
                              <td>{row.subscriberName || '—'}</td>
                              <td className="whitespace-nowrap font-mono text-xs">{row.username || '—'}</td>
                              <td>{renewal?.profileName || '—'}</td>
                              <td className="whitespace-nowrap">
                                {renewal ? activationPaymentMethodLabel(renewal.paymentMethod) : '—'}
                              </td>
                              <td className="whitespace-nowrap font-medium">
                                {renewal
                                  ? formatNumber(row.amount ?? 0, { suffix: ' د.ع' })
                                  : '—'}
                              </td>
                              <td className="whitespace-nowrap font-medium">
                                {renewal?.nationalSubscriptionCost != null
                                  ? formatNumber(renewal.nationalSubscriptionCost, { suffix: ' د.ع' })
                                  : '—'}
                              </td>
                              <td className="whitespace-nowrap font-medium text-red-700 dark:text-red-300">
                                {renewal?.balanceDeductionAmount != null
                                  ? formatNumber(renewal.balanceDeductionAmount, { suffix: ' د.ع' })
                                  : renewal
                                    ? formatNumber(0, { suffix: ' د.ع' })
                                    : '—'}
                              </td>
                              <td className="whitespace-nowrap font-semibold text-primary-700 dark:text-primary-300">
                                {row.generalIncome != null
                                  ? formatNumber(row.generalIncome, { suffix: ' د.ع' })
                                  : renewal
                                    ? formatNumber(0, { suffix: ' د.ع' })
                                    : '—'}
                              </td>
                              <td className="whitespace-nowrap">
                                {renewal?.serviceFeesAmount != null
                                  ? formatNumber(renewal.serviceFeesAmount, { suffix: ' د.ع' })
                                  : '—'}
                              </td>
                              <td className="whitespace-nowrap">
                                {renewal?.activationProfit != null
                                  ? formatNumber(renewal.activationProfit, { suffix: ' د.ع' })
                                  : '—'}
                              </td>
                              <td className="whitespace-nowrap">
                                {renewal?.totalProfit != null
                                  ? formatNumber(renewal.totalProfit, { suffix: ' د.ع' })
                                  : '—'}
                              </td>
                              <td className="whitespace-nowrap font-bold">
                                {formatDate(row.renewalDate, LEDGER_DATE_OPTIONS)}
                              </td>
                              <td className="whitespace-nowrap font-bold">
                                {formatDate(row.createdAt, LEDGER_DATE_OPTIONS)}
                              </td>
                              <td className="whitespace-nowrap text-xs">{renewal?.receiptNumber || '—'}</td>
                              <td className="whitespace-nowrap">{row.executedByFullName || '—'}</td>
                              {canDeleteLedger && (
                                <td className="text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteEntry(row)}
                                    disabled={deleteLedgerMutation.isPending}
                                    title="حذف السجل"
                                    className="inline-flex items-center justify-center p-2 rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-40"
                                  >
                                    <Trash2 className="h-4 w-4" />
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
                {ledger && (
                  <Pagination
                    currentPage={Math.max(1, ledger.currentPage)}
                    totalPages={Math.max(1, ledger.totalPages)}
                    totalItems={ledger.totalItems}
                    pageSize={ledger.pageSize}
                    hasNextPage={ledger.hasNextPage}
                    hasPreviousPage={ledger.hasPreviousPage}
                    onPageChange={setCurrentPage}
                    pageSizeOptions={[...STANDARD_PAGE_SIZE_OPTIONS]}
                    onPageSizeChange={(size) => {
                      setPageSize(size);
                      setCurrentPage(1);
                    }}
                  />
                )}
              </div>
          )}
        </ListPageWithFilters>
      )}

      {showAdvancedFiltersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowAdvancedFiltersModal(false)}
            aria-hidden
          />
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/20 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-gray-200/80 dark:border-gray-700/80 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">الفلترة المتقدمة</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {formatAccountsDateRangeLabel(appliedFromDate, appliedToDate)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAdvancedFiltersModal(false)}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="إغلاق"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5">
              {renderAdvancedFiltersForm()}
              <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={handleApplyFilters}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md text-sm"
                >
                  <Search className="h-4 w-4" />
                  تطبيق الفلاتر
                </button>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded-md text-sm"
                >
                  كل الفترة
                </button>
                <button
                  type="button"
                  onClick={handleLast30DaysFilter}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md text-sm"
                >
                  آخر 30 يوم
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdvancedFiltersModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md text-sm mr-auto"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
