import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Building2, Coins, CreditCard, DollarSign, HandCoins, Store, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDigits } from '../contexts/DigitsContext';
import { apiService } from '../services/api';
import {
  Agent,
  ExpenseProfitSummary,
  ReceiptHandoverRegion,
  ReceiptHandoverReseller,
  UserRole,
} from '../types';
import Pagination from '../components/Pagination';
import { STANDARD_PAGE_SIZE_OPTIONS } from '../constants/pagination';
import { showError, showSuccess } from '../utils/notifications';
import { StatCard } from '../components/StatCard';

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

const ReceiptHandoverPage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const { formatNumber, formatDate } = useDigits();
  const queryClient = useQueryClient();

  const isAdmin = user?.role === UserRole.Admin;

  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [selectedReseller, setSelectedReseller] = useState<ReceiptHandoverReseller | null>(null);
  const [selectedRegionName, setSelectedRegionName] = useState('');
  const baghdadNow = getBaghdadYearMonth();
  const [filterYear, setFilterYear] = useState(baghdadNow.year);
  const [filterMonth, setFilterMonth] = useState(baghdadNow.month);

  const [showModal, setShowModal] = useState(false);
  const [receivedAmount, setReceivedAmount] = useState<number>(0);
  const [handedByEmployeeUserId, setHandedByEmployeeUserId] = useState('');
  const [notes, setNotes] = useState('');
  const [handoverDate, setHandoverDate] = useState(getBaghdadToday());

  const [recordsPage, setRecordsPage] = useState(1);
  const [recordsPageSize, setRecordsPageSize] = useState<number>(STANDARD_PAGE_SIZE_OPTIONS[0]);

  const effectiveAgentId = isAdmin ? selectedAgentId || undefined : undefined;

  const { data: allAgentsResponse } = useQuery({
    queryKey: ['allAgents', 'receipt-handover'],
    queryFn: () => apiService.getAllAgents({ page: 1, pageSize: 5000 }),
    enabled: isAuthenticated && isAdmin,
  });
  const adminAgents = (allAgentsResponse?.data ?? []) as Agent[];

  const { data: context, isLoading: contextLoading } = useQuery({
    queryKey: ['receiptHandoverContext', effectiveAgentId ?? 'self'],
    queryFn: () => apiService.getReceiptHandoverContext(effectiveAgentId),
    enabled: isAuthenticated && (!isAdmin || !!selectedAgentId),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', 'receipt-handover', effectiveAgentId ?? 'me'],
    queryFn: () =>
      isAdmin && effectiveAgentId
        ? apiService.getAgentEmployees(effectiveAgentId)
        : apiService.getMyEmployees(),
    enabled: isAuthenticated && (!isAdmin || !!selectedAgentId),
  });

  const { data: recordsResponse, isLoading: recordsLoading } = useQuery({
    queryKey: [
      'receiptHandoverRecords',
      effectiveAgentId ?? 'self',
      selectedRegionId,
      selectedReseller?.id,
      filterYear,
      filterMonth,
      recordsPage,
      recordsPageSize,
    ],
    queryFn: () =>
      apiService.getReceiptHandoverRecords({
        agentId: effectiveAgentId,
        page: recordsPage,
        pageSize: recordsPageSize,
        regionId: selectedRegionId ?? undefined,
        agentResellerId: selectedReseller?.id,
        year: filterYear,
        month: filterMonth,
      }),
    enabled: isAuthenticated && (!isAdmin || !!selectedAgentId),
  });

  const regions = useMemo(() => context?.regions ?? [], [context?.regions]);

  const selectedRegion: ReceiptHandoverRegion | undefined = useMemo(
    () => regions.find((r) => r.id === selectedRegionId),
    [regions, selectedRegionId]
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
      'receipt-handover',
      effectiveAgentId ?? 'self',
      selectedRegionId,
      currentSelectedReseller?.id ?? null,
      filterYear,
      filterMonth,
    ],
    queryFn: () =>
      apiService.getExpenseProfitSummary({
        regionId: selectedRegionId!,
        year: filterYear,
        month: filterMonth,
        resellerId: currentSelectedReseller?.id,
        agentId: effectiveAgentId,
      }),
    enabled: isAuthenticated && !!selectedRegionId && (!isAdmin || !!selectedAgentId),
    refetchInterval: 15000,
  });

  const totalProfit = profitSummary?.totalProfit ?? 0;
  const remainingAfterExpenses = profitSummary?.remainingAfterExpenses ?? 0;
  const remainingAfterReceive = Math.max(0, remainingAfterExpenses - (receivedAmount || 0));

  const createMutation = useMutation({
    mutationFn: () =>
      apiService.createReceiptHandover(
        {
          regionId: selectedRegionId!,
          agentResellerId: currentSelectedReseller?.id,
          year: filterYear,
          month: filterMonth,
          receivedAmount,
          handedByEmployeeUserId,
          notes: notes.trim() || undefined,
          handoverDate,
        },
        effectiveAgentId
      ),
    onSuccess: () => {
      showSuccess('تم الحفظ', 'تم تسجيل استلام الحساب بنجاح.');
      setShowModal(false);
      setReceivedAmount(0);
      setHandedByEmployeeUserId('');
      setNotes('');
      setHandoverDate(getBaghdadToday());
      queryClient.invalidateQueries({ queryKey: ['receiptHandoverContext'] });
      queryClient.invalidateQueries({ queryKey: ['receiptHandoverRecords'] });
      queryClient.invalidateQueries({ queryKey: ['expense-profit-summary'] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'تعذّر حفظ الاستلام.';
      showError('خطأ', msg);
    },
  });

  const handleRegionClick = (region: ReceiptHandoverRegion) => {
    setSelectedRegionId(region.id);
    setSelectedRegionName(region.name);
    setSelectedReseller(null);
    setRecordsPage(1);
  };

  const handleResellerClick = (reseller: ReceiptHandoverReseller) => {
    setSelectedReseller((previous) => (previous?.id === reseller.id ? null : reseller));
    setRecordsPage(1);
  };

  const openHandoverModal = () => {
    if (!selectedRegionId || remainingAfterExpenses <= 0) return;
    setReceivedAmount(remainingAfterExpenses);
    setShowModal(true);
  };

  const formatDateTime = (value: string) =>
    formatDate(value, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

  return (
    <div className="p-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ArrowLeftRight className="h-7 w-7 text-primary-600" />
            الاستلام والتسليم
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            استلام مجموع الربح الكلي حسب المنطقة والسنة والشهر — نفس أرقام المصاريف العامة، ويتأثر بالصرفيات الموافق عليها
          </p>
        </div>
        {isAdmin && (
          <select
            value={selectedAgentId}
            onChange={(e) => {
              setSelectedAgentId(e.target.value);
              setSelectedRegionId(null);
              setSelectedReseller(null);
            }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm min-w-[200px]"
          >
            <option value="">اختر الوكيل...</option>
            {adminAgents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.companyName || a.fullName || a.username}
              </option>
            ))}
          </select>
        )}
      </div>

      {isAdmin && !selectedAgentId ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          يرجى اختيار الوكيل لعرض المناطق والرسيلرات.
        </div>
      ) : contextLoading ? (
        <div className="text-center py-16 text-gray-500">جاري التحميل...</div>
      ) : regions.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          لا توجد مناطق أو رسيلرات متاحة.
        </div>
      ) : (
        <>
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              المناطق
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {regions.map((region) => (
                <button
                  key={region.id}
                  type="button"
                  onClick={() => handleRegionClick(region)}
                  className={`rounded-xl border-2 p-4 text-right transition-all hover:shadow-md ${
                    selectedRegionId === region.id
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-md'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-300'
                  }`}
                >
                  <div className="font-bold text-gray-900 dark:text-white">{region.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {region.resellers.length} رسيلر
                  </div>
                </button>
              ))}
            </div>
          </section>

          {selectedRegion && (
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
                      setRecordsPage(1);
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
                      setRecordsPage(1);
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

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                <StatCard
                  title="الربح الكلي"
                  value={totalProfit}
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
                  title="الربح المتبقي بعد الصرف"
                  value={remainingAfterExpenses}
                  icon={HandCoins}
                  color="orange"
                  isAmount
                />
              </div>
              {profitSummaryLoading && (
                <p className="text-xs text-gray-500 mb-3">جاري تحديث أرقام الشهر...</p>
              )}

              <section className="mb-8">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                  <Store className="h-5 w-5" />
                  رسيلرات — {selectedRegion.name}
                  <span className="text-sm font-normal text-gray-500">
                    (اختياري — الأرقام تظهر للمنطقة دون اختيار رسيلر)
                  </span>
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {selectedRegion.resellers.map((reseller) => (
                    <button
                      key={reseller.id}
                      type="button"
                      onClick={() => handleResellerClick(reseller)}
                      className={`rounded-xl border-2 p-4 text-right transition-all hover:shadow-md ${
                        selectedReseller?.id === reseller.id
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 shadow-md'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-emerald-300'
                      }`}
                    >
                      <div className="font-semibold text-gray-900 dark:text-white">{reseller.name}</div>
                    </button>
                  ))}
                </div>
              </section>

              <section className="mb-8 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
                  {selectedRegion.name}
                  {currentSelectedReseller ? ` — ${currentSelectedReseller.name}` : ' — كل المنطقة'}
                  {` — ${filterMonth.toString().padStart(2, '0')}/${filterYear}`}
                </h2>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">مجموع الربح الكلي</p>
                    <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                      {formatNumber(totalProfit, { suffix: ' د.ع' })}
                    </p>
                    <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-2">
                      المتبقي بعد الصرف: {formatNumber(remainingAfterExpenses, { suffix: ' د.ع' })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openHandoverModal}
                    disabled={remainingAfterExpenses <= 0}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <HandCoins className="h-5 w-5" />
                    استلام حساب
                  </button>
                </div>
              </section>
            </>
          )}

          <section>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
              سجلات الاستلام والتسليم
            </h2>
            <div className="wakeel-table-wrap overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
              <table className="wakeel-table min-w-full">
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>المنطقة</th>
                    <th>الرسيلر</th>
                    <th>مجموع الربح الكلي</th>
                    <th>المستلم</th>
                    <th>المتبقي</th>
                    <th>من الموظف</th>
                    <th>سجّله</th>
                    <th>ملاحظة</th>
                  </tr>
                </thead>
                <tbody>
                  {recordsLoading ? (
                    <tr>
                      <td colSpan={9} className="text-center py-10 text-gray-500">
                        جاري التحميل...
                      </td>
                    </tr>
                  ) : (recordsResponse?.data ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-10 text-gray-500">
                        لا توجد سجلات بعد.
                      </td>
                    </tr>
                  ) : (
                    (recordsResponse?.data ?? []).map((row) => (
                      <tr key={row.id}>
                        <td className="whitespace-nowrap">{formatDateTime(row.handoverDate)}</td>
                        <td>{row.regionName}</td>
                        <td>{row.resellerName}</td>
                        <td>{formatNumber(row.totalProfitAmount, { suffix: ' د.ع' })}</td>
                        <td className="font-medium text-emerald-700 dark:text-emerald-400">
                          {formatNumber(row.receivedAmount, { suffix: ' د.ع' })}
                        </td>
                        <td>{formatNumber(row.remainingAmount, { suffix: ' د.ع' })}</td>
                        <td>{row.handedByEmployeeName}</td>
                        <td>{row.recordedByUserName}</td>
                        <td className="max-w-[160px] truncate" title={row.notes ?? undefined}>
                          {row.notes || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {recordsResponse && recordsResponse.totalItems > 0 && (
              <Pagination
                currentPage={recordsResponse.currentPage}
                totalPages={recordsResponse.totalPages}
                totalItems={recordsResponse.totalItems}
                pageSize={recordsResponse.pageSize}
                hasNextPage={recordsResponse.hasNextPage}
                hasPreviousPage={recordsResponse.hasPreviousPage}
                onPageChange={setRecordsPage}
                pageSizeOptions={[...STANDARD_PAGE_SIZE_OPTIONS]}
                onPageSizeChange={(size) => {
                  setRecordsPageSize(size);
                  setRecordsPage(1);
                }}
                className="mt-4"
              />
            )}
          </section>
        </>
      )}

      {showModal && selectedRegion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                استلام حساب ({selectedRegionName}
                {currentSelectedReseller ? ` — ${currentSelectedReseller.name}` : ' — كل المنطقة'})
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                  مجموع الربح الكلي
                </label>
                <div className="px-3 py-2 rounded-md bg-gray-100 dark:bg-gray-700 font-semibold text-primary-700 dark:text-primary-300">
                  {formatNumber(totalProfit, { suffix: ' د.ع' })}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                  المبلغ المستلم
                </label>
                <input
                  type="number"
                  min={0}
                  max={remainingAfterExpenses}
                  value={receivedAmount || ''}
                  onChange={(e) => setReceivedAmount(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                  المبلغ المتبقي
                </label>
                <div className="px-3 py-2 rounded-md bg-gray-100 dark:bg-gray-700 font-medium">
                  {formatNumber(remainingAfterReceive, { suffix: ' د.ع' })}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                  استلام المبلغ من الموظف
                </label>
                <select
                  value={handedByEmployeeUserId}
                  onChange={(e) => setHandedByEmployeeUserId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                >
                  <option value="">اختر الموظف...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName || emp.username}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">ملاحظة</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white resize-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                  تاريخ الاستلام
                </label>
                <input
                  type="date"
                  value={handoverDate}
                  onChange={(e) => setHandoverDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
            <div className="flex gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-200"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={
                  createMutation.isPending ||
                  !handedByEmployeeUserId ||
                  receivedAmount <= 0 ||
                  receivedAmount > remainingAfterExpenses
                }
                onClick={() => createMutation.mutate()}
                className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md disabled:opacity-50"
              >
                {createMutation.isPending ? 'جاري الحفظ...' : 'حفظ الاستلام'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceiptHandoverPage;
