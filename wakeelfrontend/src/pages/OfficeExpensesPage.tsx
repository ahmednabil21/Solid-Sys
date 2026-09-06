import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService, ApiService } from '../services/api';
import {
  ExpenseWithdrawalCreateRequest,
  ExpenseWithdrawalRequest,
  ExpenseWithdrawalStatus,
  ExpenseProfitSummary,
  ReceiptHandoverRegion,
  ReceiptHandoverReseller,
  UserRole,
  ActivationPaymentMethod,
} from '../types';
import { showSuccess, showError } from '../utils/notifications';
import { useAuth } from '../contexts/AuthContext';
import { useDigits } from '../contexts/DigitsContext';
import { StatCard } from '../components/StatCard';
import {
  X,
  Wallet,
  CheckCircle,
  DollarSign,
  Building2,
  Store,
  HandCoins,
  Clock3,
  XCircle,
  Coins,
  CreditCard,
  Filter,
  Trash2,
} from 'lucide-react';
import Pagination from '../components/Pagination';
import { STANDARD_PAGE_SIZE_OPTIONS } from '../constants/pagination';

const DASHBOARD_OFFICE_EXPENSES_AGENT_KEY = 'wakeel_office_expenses_agentId';

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

const OfficeExpensesPage: React.FC = () => {
  const { user, hasAnyRole } = useAuth();
  const { formatNumber, formatDate } = useDigits();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === UserRole.Admin;
  const canDecideExpenseWithdrawal = hasAnyRole([
    UserRole.Admin,
    UserRole.Agent,
    UserRole.SubAgent,
    UserRole.MainAgent,
  ]);

  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [appliedFromDate, setAppliedFromDate] = useState('');
  const [appliedToDate, setAppliedToDate] = useState('');
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [selectedReseller, setSelectedReseller] = useState<ReceiptHandoverReseller | null>(null);
  const baghdadNow = getBaghdadYearMonth();
  const [filterYear, setFilterYear] = useState(baghdadNow.year);
  const [filterMonth, setFilterMonth] = useState(baghdadNow.month);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseWithdrawalRequest | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [withdrawalsPage, setWithdrawalsPage] = useState(1);
  const [withdrawalsPageSize, setWithdrawalsPageSize] = useState<number>(
    STANDARD_PAGE_SIZE_OPTIONS[0]
  );
  const [withdrawalForm, setWithdrawalForm] = useState<ExpenseWithdrawalCreateRequest>({
    regionId: '',
    year: baghdadNow.year,
    month: baghdadNow.month,
    paymentMethod: ActivationPaymentMethod.Cash,
    amount: 0,
    reason: '',
    expenseDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const { data: agentsResponse } = useQuery({
    queryKey: ['agents', 1, 100],
    queryFn: () => apiService.getAllAgents({ page: 1, pageSize: 100 }),
    enabled: isAdmin,
  });
  const agents = useMemo(() => agentsResponse?.data ?? [], [agentsResponse]);

  const { data: myAgent } = useQuery({
    queryKey: ['my-agent'],
    queryFn: () => apiService.getMyAgent(),
    enabled: !isAdmin,
  });

  const effectiveAgentId = isAdmin ? selectedAgentId : myAgent?.id;
  const canLoadData = isAdmin ? !!effectiveAgentId : true;

  useEffect(() => {
    if (!isAdmin) return;
    if (!agents.length) return;
    const saved = localStorage.getItem(DASHBOARD_OFFICE_EXPENSES_AGENT_KEY);
    if (saved && agents.some((a) => a.id === saved)) {
      setSelectedAgentId(saved);
    } else {
      setSelectedAgentId(agents[0]?.id ?? '');
    }
  }, [isAdmin, agents]);

  useEffect(() => {
    if (!isAdmin || !selectedAgentId) return;
    localStorage.setItem(DASHBOARD_OFFICE_EXPENSES_AGENT_KEY, selectedAgentId);
  }, [isAdmin, selectedAgentId]);

  const { data: withdrawalContext, isLoading: withdrawalContextLoading, error } = useQuery({
    queryKey: ['expense-withdrawal-context', effectiveAgentId ?? 'self'],
    queryFn: () =>
      apiService.getExpenseWithdrawalContext(isAdmin ? effectiveAgentId || undefined : undefined),
    enabled: canLoadData,
    refetchInterval: 15000,
  });

  const withdrawalRegions = useMemo(
    () => withdrawalContext?.regions ?? [],
    [withdrawalContext?.regions]
  );
  const selectedRegion: ReceiptHandoverRegion | undefined = useMemo(
    () => withdrawalRegions.find((region) => region.id === selectedRegionId),
    [withdrawalRegions, selectedRegionId]
  );
  const currentSelectedReseller = useMemo(
    () =>
      selectedRegion?.resellers.find((reseller) => reseller.id === selectedReseller?.id) ??
      selectedReseller,
    [selectedRegion, selectedReseller]
  );

  const { data: profitSummary, isLoading: profitSummaryLoading } = useQuery<ExpenseProfitSummary>({
    queryKey: [
      'expense-profit-summary',
      effectiveAgentId ?? 'self',
      selectedRegionId || null,
      currentSelectedReseller?.id ?? null,
      filterYear,
      filterMonth,
    ],
    queryFn: () =>
      apiService.getExpenseProfitSummary({
        regionId: selectedRegionId,
        year: filterYear,
        month: filterMonth,
        resellerId: currentSelectedReseller?.id,
        agentId: isAdmin ? effectiveAgentId || undefined : undefined,
      }),
    enabled: canLoadData && !!selectedRegionId,
    refetchInterval: 15000,
  });

  const { data: withdrawalRequestsResponse, isLoading: withdrawalsLoading } = useQuery({
    queryKey: [
      'expense-withdrawal-requests',
      effectiveAgentId ?? 'self',
      selectedRegionId || null,
      selectedReseller?.id ?? null,
      filterYear,
      filterMonth,
      appliedFromDate || null,
      appliedToDate || null,
      withdrawalsPage,
      withdrawalsPageSize,
    ],
    queryFn: () =>
      apiService.getExpenseWithdrawalRequests({
        agentId: isAdmin ? effectiveAgentId || undefined : undefined,
        regionId: selectedRegionId || undefined,
        resellerId: selectedReseller?.id || undefined,
        fromDate: appliedFromDate || undefined,
        toDate: appliedToDate || undefined,
        year: selectedRegionId ? filterYear : undefined,
        month: selectedRegionId ? filterMonth : undefined,
        page: withdrawalsPage,
        pageSize: withdrawalsPageSize,
      }),
    enabled: canLoadData,
    refetchInterval: 15000,
  });

  const withdrawalRequests = withdrawalRequestsResponse?.data ?? [];
  const totalWithdrawalAmount = Number(withdrawalRequestsResponse?.totalAmount ?? 0);

  const withdrawalMutation = useMutation({
    mutationFn: (data: ExpenseWithdrawalCreateRequest) =>
      apiService.createExpenseWithdrawalRequest(
        data,
        isAdmin ? effectiveAgentId || undefined : undefined
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['expense-withdrawal-context'] });
      queryClient.invalidateQueries({ queryKey: ['expense-withdrawal-requests'] });
      queryClient.invalidateQueries({ queryKey: ['expense-profit-summary'] });
      queryClient.invalidateQueries({ queryKey: ['receiptHandoverContext'] });
      setShowWithdrawalModal(false);
      setWithdrawalForm({
        regionId: selectedRegionId,
        agentResellerId: selectedReseller?.id,
        year: filterYear,
        month: filterMonth,
        paymentMethod: ActivationPaymentMethod.Cash,
        amount: 0,
        reason: '',
        expenseDate: new Date().toISOString().split('T')[0],
        notes: '',
      });
      if (result.request.whatsAppSent) {
        showSuccess('تم إرسال الطلب', result.message);
      } else {
        showError('تم إنشاء الطلب دون إرسال واتساب', result.message);
      }
    },
    onError: (err: unknown) => {
      showError('تعذر إنشاء طلب الصرف', ApiService.showError(err));
    },
  });

  const decideWithdrawalMutation = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      apiService.decideExpenseWithdrawalRequest(
        id,
        approve,
        isAdmin ? effectiveAgentId || undefined : undefined
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['expense-withdrawal-requests'] });
      queryClient.invalidateQueries({ queryKey: ['expense-profit-summary'] });
      queryClient.invalidateQueries({ queryKey: ['expense-withdrawal-context'] });
      queryClient.invalidateQueries({ queryKey: ['receiptHandoverContext'] });
      showSuccess(result.alreadyDecided ? 'تم سابقاً' : 'تم تنفيذ القرار', result.message);
    },
    onError: (err: unknown) => {
      showError('تعذر تنفيذ القرار', ApiService.showError(err));
    },
  });

  const deleteWithdrawalMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiService.deleteExpenseWithdrawalRequest(
        id,
        reason,
        isAdmin ? effectiveAgentId || undefined : undefined
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['expense-withdrawal-requests'] });
      queryClient.invalidateQueries({ queryKey: ['expense-profit-summary'] });
      queryClient.invalidateQueries({ queryKey: ['expense-withdrawal-context'] });
      queryClient.invalidateQueries({ queryKey: ['receiptHandoverContext'] });
      setDeleteTarget(null);
      setDeleteReason('');
      showSuccess('تم الحذف', result.message);
    },
    onError: (err: unknown) => {
      showError('تعذر حذف طلب الصرف', ApiService.showError(err));
    },
  });

  const handleRegionSelect = (region: ReceiptHandoverRegion) => {
    setSelectedRegionId(region.id);
    setSelectedReseller(null);
    setWithdrawalsPage(1);
  };

  const handleResellerSelect = (reseller: ReceiptHandoverReseller) => {
    setSelectedReseller((previous) => (previous?.id === reseller.id ? null : reseller));
    setWithdrawalsPage(1);
  };

  const remainingAfterExpenses = profitSummary?.remainingAfterExpenses ?? 0;
  const remainingCashAfterExpenses = profitSummary?.remainingCashAfterExpenses ?? 0;
  const remainingMasterAfterExpenses = profitSummary?.remainingMasterAfterExpenses ?? 0;
  const canWithdraw =
    remainingCashAfterExpenses > 0 || remainingMasterAfterExpenses > 0;

  const remainingForSelectedSource =
    Number(withdrawalForm.paymentMethod) === ActivationPaymentMethod.Master
      ? remainingMasterAfterExpenses
      : remainingCashAfterExpenses;

  const openWithdrawalModal = () => {
    if (!selectedRegionId || !canWithdraw) return;
    const defaultMethod =
      remainingCashAfterExpenses > 0
        ? ActivationPaymentMethod.Cash
        : ActivationPaymentMethod.Master;
    setWithdrawalForm({
      regionId: selectedRegionId,
      agentResellerId: currentSelectedReseller?.id,
      year: filterYear,
      month: filterMonth,
      paymentMethod: defaultMethod,
      amount: 0,
      reason: '',
      expenseDate: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setShowWithdrawalModal(true);
  };

  const handleWithdrawalSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedRegionId) return;
    if (withdrawalForm.amount <= 0) {
      showError('خطأ', 'قيمة مبلغ الصرف يجب أن تكون أكبر من صفر');
      return;
    }
    if (withdrawalForm.amount > remainingForSelectedSource) {
      showError('خطأ', 'قيمة مبلغ الصرف أكبر من الربح المتبقي لهذا المصدر');
      return;
    }
    if (!withdrawalForm.reason.trim()) {
      showError('خطأ', 'سبب الصرف مطلوب');
      return;
    }
    withdrawalMutation.mutate({
      ...withdrawalForm,
      regionId: selectedRegionId,
      agentResellerId: currentSelectedReseller?.id,
      year: filterYear,
      month: filterMonth,
      paymentMethod: withdrawalForm.paymentMethod,
      reason: withdrawalForm.reason.trim(),
      notes: withdrawalForm.notes?.trim() || undefined,
    });
  };

  const statusBadge = (request: ExpenseWithdrawalRequest) => {
    if (Number(request.status) === ExpenseWithdrawalStatus.Approved) {
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    }
    if (Number(request.status) === ExpenseWithdrawalStatus.Rejected) {
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    }
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
  };

  };

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-md">
          خطأ في تحميل مصاريف المكتب
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            مصاريف المكتب
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
            سحب الصرفيات من ربح المنطقة الشهري ومتابعة سجل الطلبات
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {isAdmin && (
            <div className="min-w-[180px]">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                الوكيل
              </label>
              <select
                value={selectedAgentId}
                onChange={(e) => {
                  setSelectedAgentId(e.target.value);
                  setSelectedRegionId('');
                  setSelectedReseller(null);
                  setWithdrawalsPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white text-sm"
              >
                <option value="">-- اختر الوكيل --</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.companyName || a.fullName || a.username}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setFromDate(appliedFromDate);
              setToDate(appliedToDate);
              setShowFilterModal(true);
            }}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 min-h-[40px]"
          >
            <Filter className="h-4 w-4" />
            فلترة التاريخ
          </button>
        </div>
        {(appliedFromDate || appliedToDate) && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            الفلترة: من {appliedFromDate || '—'} إلى {appliedToDate || '—'}
          </p>
        )}
        {!selectedRegionId && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <StatCard
              title="إجمالي المصاريف"
              value={totalWithdrawalAmount}
              icon={Wallet}
              color="blue"
              isAmount
            />
          </div>
        )}
      </div>

      <section className="mb-6 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <HandCoins className="h-5 w-5 text-primary-600" />
            سحب صرفيات من ربح المنطقة الشهري
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            اختر المنطقة (يُلغى اختيار الرسيلر) ثم السنة والشهر. الربح الكلي من totalPaid للحسابات الشهرية المعزولة، ووارد كاش/ماستر من تقرير الحسابات. لا يغيّر سجل الحسابات.
          </p>
        </div>

        {withdrawalContextLoading ? (
          <div className="py-8 text-center text-gray-500">جاري تحميل المناطق...</div>
        ) : withdrawalRegions.length === 0 ? (
          <div className="py-8 text-center text-gray-500">لا توجد مناطق أو رسيلرات متاحة.</div>
        ) : (
          <>
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                اختر المنطقة
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {withdrawalRegions.map((region) => (
                  <button
                    key={region.id}
                    type="button"
                    onClick={() => handleRegionSelect(region)}
                    className={`rounded-xl border-2 px-3 py-3 text-right transition-colors ${
                      selectedRegionId === region.id
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-primary-300'
                    }`}
                  >
                    <span className="block font-semibold text-gray-900 dark:text-white">
                      {region.name}
                    </span>
                    <span className="text-xs text-gray-500">{region.resellers.length} رسيلر</span>
                  </button>
                ))}
              </div>
            </div>

            {selectedRegion && (
              <div className="mb-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  الرسيلر اختياري — {selectedRegion.name}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {selectedRegion.resellers.map((reseller) => (
                    <button
                      key={reseller.id}
                      type="button"
                      onClick={() => handleResellerSelect(reseller)}
                      className={`rounded-xl border-2 px-3 py-3 text-right transition-colors ${
                        selectedReseller?.id === reseller.id
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-primary-300'
                      }`}
                    >
                      <span className="block font-semibold text-gray-900 dark:text-white">
                        {reseller.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedRegionId && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      السنة
                    </label>
                    <select
                      value={filterYear}
                      onChange={(e) => {
                        setFilterYear(Number(e.target.value));
                        setWithdrawalsPage(1);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm"
                    >
                      {yearOptions(baghdadNow.year).map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      الشهر
                    </label>
                    <select
                      value={filterMonth}
                      onChange={(e) => {
                        setFilterMonth(Number(e.target.value));
                        setWithdrawalsPage(1);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm"
                    >
                      {ARABIC_MONTHS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
                  <StatCard
                    title="الربح الكلي"
                    value={profitSummary?.totalProfit ?? 0}
                    icon={DollarSign}
                    color="blue"
                    isAmount
                  />
                  <StatCard
                    title="وارد كاش"
                    value={profitSummary?.cashProfit ?? 0}
                    icon={Coins}
                    color="green"
                    isAmount
                  />
                  <StatCard
                    title="وارد ماستر"
                    value={profitSummary?.masterProfit ?? 0}
                    icon={CreditCard}
                    color="purple"
                    isAmount
                  />
                  <StatCard
                    title="إجمالي المصاريف"
                    value={totalWithdrawalAmount}
                    icon={Wallet}
                    color="red"
                    isAmount
                  />
                  <StatCard
                    title="الربح المتبقي بعد الصرف"
                    value={remainingAfterExpenses}
                    icon={HandCoins}
                    color="orange"
                    isAmount
                  />
                  <StatCard
                    title="المتبقي من صرف الكاش"
                    value={remainingCashAfterExpenses}
                    icon={Wallet}
                    color="teal"
                    isAmount
                  />
                  <StatCard
                    title="المتبقي من صرف الماستر"
                    value={remainingMasterAfterExpenses}
                    icon={CreditCard}
                    color="indigo"
                    isAmount
                  />
                </div>
                {profitSummaryLoading && (
                  <p className="text-xs text-gray-500 mb-3">جاري تحديث أرقام الشهر...</p>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-4">
                  <div>
                    <p className="text-sm text-emerald-700 dark:text-emerald-300">
                      المتبقي للسحب — {selectedRegion?.name}
                      {currentSelectedReseller ? ` — ${currentSelectedReseller.name}` : ' (كل المنطقة)'}
                      {` — ${filterMonth.toString().padStart(2, '0')}/${filterYear}`}
                    </p>
                    <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200 mt-1">
                      {formatNumber(remainingAfterExpenses, { suffix: ' د.ع' })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openWithdrawalModal}
                    disabled={!canWithdraw}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <HandCoins className="h-5 w-5" />
                    سحب صرفيات
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            سجل طلبات سحب الصرفيات
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            تُخصم القيمة من ربح الشهر المحدد عند الموافقة فقط، دون تغيير سجل الحسابات.
          </p>
        </div>
        <div className="wakeel-table-scroll">
          <table className="min-w-[1050px] w-full text-right">
            <thead>
              <tr>
                <th>المنطقة</th>
                <th>الرسيلر</th>
                <th>الشهر</th>
                <th>المصدر</th>
                <th>قيمة مبلغ الصرف</th>
                <th>سبب الصرف</th>
                <th>تاريخ الصرف</th>
                <th>ملاحظات</th>
                <th>بواسطة</th>
                <th>حالة الطلب</th>
                {canDecideExpenseWithdrawal && <th>الإجراء</th>}
              </tr>
            </thead>
            <tbody>
              {withdrawalsLoading ? (
                <tr>
                  <td colSpan={canDecideExpenseWithdrawal ? 11 : 10} className="py-10 text-center text-gray-500">
                    جاري تحميل طلبات الصرف...
                  </td>
                </tr>
              ) : withdrawalRequests.length === 0 ? (
                <tr>
                  <td colSpan={canDecideExpenseWithdrawal ? 11 : 10} className="py-10 text-center text-gray-500 dark:text-gray-400">
                    لا توجد طلبات صرف.
                  </td>
                </tr>
              ) : (
                withdrawalRequests.map((request) => (
                  <tr key={request.id}>
                    <td>{request.regionName}</td>
                    <td>{request.resellerName || 'كل المنطقة'}</td>
                    <td className="whitespace-nowrap">
                      {request.month && request.year
                        ? `${String(request.month).padStart(2, '0')}/${request.year}`
                        : '—'}
                    </td>
                    <td>{request.paymentMethodLabelAr || '—'}</td>
                    <td className="font-semibold whitespace-nowrap">
                      {formatNumber(request.amount, { suffix: ' د.ع' })}
                    </td>
                    <td>{request.reason}</td>
                    <td className="whitespace-nowrap">
                      {formatDate(
                        request.expenseDate.includes('T')
                          ? request.expenseDate
                          : `${request.expenseDate}T00:00:00`
                      )}
                    </td>
                    <td className="max-w-[220px] truncate" title={request.notes ?? ''}>
                      {request.notes || '—'}
                    </td>
                    <td>{request.requestedByUserName}</td>
                    <td>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusBadge(
                          request
                        )}`}
                      >
                        {Number(request.status) === ExpenseWithdrawalStatus.Approved ? (
                          <CheckCircle className="h-3.5 w-3.5" />
                        ) : Number(request.status) === ExpenseWithdrawalStatus.Rejected ? (
                          <XCircle className="h-3.5 w-3.5" />
                        ) : (
                          <Clock3 className="h-3.5 w-3.5" />
                        )}
                        {request.statusLabelAr}
                      </span>
                      {!request.whatsAppSent &&
                        Number(request.status) === ExpenseWithdrawalStatus.Pending && (
                          <p
                            className="text-xs text-red-600 dark:text-red-400 mt-1 max-w-[220px]"
                            title={request.whatsAppError ?? ''}
                          >
                            لم تُرسل رسالة واتساب
                          </p>
                        )}
                    </td>
                    {canDecideExpenseWithdrawal && (
                      <td>
                        <div className="flex flex-wrap items-center gap-2">
                          {Number(request.status) === ExpenseWithdrawalStatus.Pending && (
                            <>
                              <button
                                type="button"
                                disabled={
                                  decideWithdrawalMutation.isPending ||
                                  deleteWithdrawalMutation.isPending
                                }
                                onClick={() =>
                                  decideWithdrawalMutation.mutate({ id: request.id, approve: true })
                                }
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                                قبول
                              </button>
                              <button
                                type="button"
                                disabled={
                                  decideWithdrawalMutation.isPending ||
                                  deleteWithdrawalMutation.isPending
                                }
                                onClick={() =>
                                  decideWithdrawalMutation.mutate({ id: request.id, approve: false })
                                }
                                className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                رفض
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            disabled={deleteWithdrawalMutation.isPending}
                            onClick={() => {
                              setDeleteTarget(request);
                              setDeleteReason('');
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-600 dark:hover:bg-gray-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            حذف
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {(withdrawalRequestsResponse?.totalItems ?? 0) > 0 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <Pagination
              currentPage={Math.max(1, withdrawalRequestsResponse?.currentPage ?? withdrawalsPage)}
              totalPages={Math.max(1, withdrawalRequestsResponse?.totalPages ?? 1)}
              totalItems={withdrawalRequestsResponse?.totalItems ?? 0}
              pageSize={withdrawalRequestsResponse?.pageSize ?? withdrawalsPageSize}
              hasNextPage={!!withdrawalRequestsResponse?.hasNextPage}
              hasPreviousPage={!!withdrawalRequestsResponse?.hasPreviousPage}
              onPageChange={setWithdrawalsPage}
              pageSizeOptions={[...STANDARD_PAGE_SIZE_OPTIONS]}
              onPageSizeChange={(size) => {
                setWithdrawalsPageSize(size);
                setWithdrawalsPage(1);
              }}
            />
          </div>
        )}
      </section>

      {showWithdrawalModal && selectedRegion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  طلب سحب صرفيات
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedRegion.name}
                  {currentSelectedReseller ? ` — ${currentSelectedReseller.name}` : ' — كل المنطقة'}
                  {` — ${filterMonth.toString().padStart(2, '0')}/${filterYear}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowWithdrawalModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleWithdrawalSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  مصدر الصرف *
                </label>
                <select
                  value={withdrawalForm.paymentMethod}
                  onChange={(e) =>
                    setWithdrawalForm((previous) => ({
                      ...previous,
                      paymentMethod: Number(e.target.value),
                    }))
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                >
                  <option value={ActivationPaymentMethod.Cash}>كاش</option>
                  <option value={ActivationPaymentMethod.Master}>ماستر كارد</option>
                </select>
              </div>
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-3">
                <span className="text-sm text-emerald-700 dark:text-emerald-300">
                  الربح المتبقي بعد الصرف لهذا المصدر:
                </span>{' '}
                <strong className="text-emerald-800 dark:text-emerald-200">
                  {formatNumber(remainingForSelectedSource, { suffix: ' د.ع' })}
                </strong>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  قيمة مبلغ الصرف *
                </label>
                <input
                  type="number"
                  min={1}
                  max={remainingForSelectedSource}
                  value={withdrawalForm.amount || ''}
                  onChange={(e) =>
                    setWithdrawalForm((previous) => ({
                      ...previous,
                      amount: Number(e.target.value) || 0,
                    }))
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  سبب الصرف *
                </label>
                <input
                  type="text"
                  maxLength={500}
                  value={withdrawalForm.reason}
                  onChange={(e) =>
                    setWithdrawalForm((previous) => ({
                      ...previous,
                      reason: e.target.value,
                    }))
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  placeholder="سبب الصرف"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  تاريخ الصرف *
                </label>
                <input
                  type="date"
                  value={withdrawalForm.expenseDate}
                  onChange={(e) =>
                    setWithdrawalForm((previous) => ({
                      ...previous,
                      expenseDate: e.target.value,
                    }))
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  ملاحظات
                </label>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={withdrawalForm.notes ?? ''}
                  onChange={(e) =>
                    setWithdrawalForm((previous) => ({
                      ...previous,
                      notes: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                سيُرسل الطلب إلى الرقم +9647701060030، ولن يُخصم المبلغ إلا بعد الموافقة.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWithdrawalModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={withdrawalMutation.isPending}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md disabled:opacity-50"
                >
                  {withdrawalMutation.isPending ? 'جاري الإرسال...' : 'إرسال طلب الصرف'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">حذف طلب الصرف</h2>
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteReason('');
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <form
              className="p-5 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                const trimmed = deleteReason.trim();
                if (trimmed.length < 3) {
                  showError('خطأ', 'سبب الحذف مطلوب');
                  return;
                }
                deleteWithdrawalMutation.mutate({ id: deleteTarget.id, reason: trimmed });
              }}
            >
              <p className="text-sm text-gray-600 dark:text-gray-400">
                سيتم حذف الطلب بمبلغ{' '}
                <strong>{formatNumber(deleteTarget.amount, { suffix: ' د.ع' })}</strong>
                {Number(deleteTarget.status) === ExpenseWithdrawalStatus.Approved
                  ? ' وإرجاع القيمة إلى الربح المتبقي.'
                  : '.'}
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  سبب الحذف *
                </label>
                <textarea
                  rows={3}
                  required
                  minLength={3}
                  maxLength={500}
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  placeholder="اكتب سبب الحذف"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteTarget(null);
                    setDeleteReason('');
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={deleteWithdrawalMutation.isPending}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50"
                >
                  {deleteWithdrawalMutation.isPending ? 'جاري الحذف...' : 'تأكيد الحذف'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filter by date modal */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                فلترة سجل الصرفيات بالتاريخ
              </h2>
              <button
                type="button"
                onClick={() => setShowFilterModal(false)}
                className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                الفلترة حسب تاريخ الصرف في سجل الطلبات. اترك الحقل فارغاً لعدم تحديد حد.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  من تاريخ
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  إلى تاريخ
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAppliedFromDate('');
                    setAppliedToDate('');
                    setFromDate('');
                    setToDate('');
                    setWithdrawalsPage(1);
                    setShowFilterModal(false);
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  إزالة الفلترة
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAppliedFromDate(fromDate);
                    setAppliedToDate(toDate);
                    setWithdrawalsPage(1);
                    setShowFilterModal(false);
                  }}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md"
                >
                  تطبيق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfficeExpensesPage;
