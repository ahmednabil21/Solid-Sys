import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService, ApiService } from '../services/api';
import {
  OfficeExpense,
  OfficeExpenseCreateRequest,
  OfficeExpenseUpdateRequest,
  ExpenseWithdrawalCreateRequest,
  ExpenseWithdrawalRequest,
  ExpenseWithdrawalStatus,
  ReceiptHandoverRegion,
  ReceiptHandoverReseller,
  UserRole,
} from '../types';
import { showSuccess, showError } from '../utils/notifications';
import { useAuth } from '../contexts/AuthContext';
import { useDigits } from '../contexts/DigitsContext';
import WifiLoaderComponent from '../components/WifiLoaderComponent';
import { StatCard } from '../components/StatCard';
import {
  Plus,
  X,
  Edit2,
  Trash2,
  Wallet,
  CheckCircle,
  DollarSign,
  Building2,
  Store,
  HandCoins,
  Clock3,
  XCircle,
} from 'lucide-react';
import Pagination from '../components/Pagination';
import { STANDARD_PAGE_SIZE_OPTIONS } from '../constants/pagination';

const DASHBOARD_OFFICE_EXPENSES_AGENT_KEY = 'wakeel_office_expenses_agentId';

const OfficeExpensesPage: React.FC = () => {
  const { user } = useAuth();
  const { formatNumber, formatDate } = useDigits();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === UserRole.Admin;

  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<OfficeExpense | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [appliedFromDate, setAppliedFromDate] = useState('');
  const [appliedToDate, setAppliedToDate] = useState('');
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [selectedReseller, setSelectedReseller] = useState<ReceiptHandoverReseller | null>(null);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [withdrawalsPage, setWithdrawalsPage] = useState(1);
  const [withdrawalsPageSize, setWithdrawalsPageSize] = useState<number>(
    STANDARD_PAGE_SIZE_OPTIONS[0]
  );
  const [withdrawalForm, setWithdrawalForm] = useState<ExpenseWithdrawalCreateRequest>({
    agentResellerId: '',
    amount: 0,
    reason: '',
    expenseDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [formData, setFormData] = useState<OfficeExpenseCreateRequest>({
    name: '',
    amount: 0,
    expenseDate: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [editFormData, setEditFormData] = useState<OfficeExpenseUpdateRequest>({
    name: '',
    amount: 0,
    expenseDate: '',
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

  const { data: expenses = [], error, isLoading } = useQuery<OfficeExpense[]>({
    queryKey: ['office-expenses', effectiveAgentId ?? null, appliedFromDate || null, appliedToDate || null],
    queryFn: () =>
      apiService.getOfficeExpenses(
        isAdmin ? effectiveAgentId || undefined : undefined,
        appliedFromDate || undefined,
        appliedToDate || undefined
      ),
    enabled: canLoadData,
  });

  const { data: salarySheetResponse } = useQuery({
    queryKey: ['salary-sheet', effectiveAgentId ?? null],
    queryFn: () => apiService.getSalarySheet(isAdmin ? effectiveAgentId || undefined : undefined),
    enabled: canLoadData,
  });
  const totalNetSalary = (salarySheetResponse?.data ?? []).reduce((s: number, e: { netSalary?: number }) => s + (e.netSalary ?? 0), 0);

  const { data: withdrawalContext, isLoading: withdrawalContextLoading } = useQuery({
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

  const { data: withdrawalRequestsResponse, isLoading: withdrawalsLoading } = useQuery({
    queryKey: [
      'expense-withdrawal-requests',
      effectiveAgentId ?? 'self',
      selectedRegionId || null,
      selectedReseller?.id ?? null,
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
        page: withdrawalsPage,
        pageSize: withdrawalsPageSize,
      }),
    enabled: canLoadData,
    refetchInterval: 15000,
  });

  const withdrawalRequests = withdrawalRequestsResponse?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (data: OfficeExpenseCreateRequest) =>
      apiService.createOfficeExpense(data, isAdmin ? effectiveAgentId : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['office-expenses'] });
      setShowAddModal(false);
      setFormData({
        name: '',
        amount: 0,
        expenseDate: new Date().toISOString().split('T')[0],
        notes: '',
      });
      showSuccess('تمت الإضافة', 'تم إضافة المصروف بنجاح');
    },
    onError: (err: unknown) => {
      showError('خطأ في الإضافة', ApiService.showError(err));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: OfficeExpenseUpdateRequest }) =>
      apiService.updateOfficeExpense(id, data, isAdmin ? effectiveAgentId : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['office-expenses'] });
      setShowEditModal(false);
      setSelectedExpense(null);
      showSuccess('تم التعديل', 'تم تعديل المصروف بنجاح');
    },
    onError: (err: unknown) => {
      showError('خطأ في التعديل', ApiService.showError(err));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiService.deleteOfficeExpense(id, isAdmin ? effectiveAgentId : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['office-expenses'] });
      showSuccess('تم الحذف', 'تم حذف المصروف بنجاح');
    },
    onError: (err: unknown) => {
      showError('خطأ في الحذف', ApiService.showError(err));
    },
  });

  const payMutation = useMutation({
    mutationFn: (id: string) =>
      apiService.payOfficeExpense(id, isAdmin ? effectiveAgentId : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['office-expenses'] });
      showSuccess('تم التسديد', 'تم تسديد المصروف بنجاح');
    },
    onError: (err: unknown) => {
      showError('خطأ في التسديد', ApiService.showError(err));
    },
  });

  const withdrawalMutation = useMutation({
    mutationFn: (data: ExpenseWithdrawalCreateRequest) =>
      apiService.createExpenseWithdrawalRequest(
        data,
        isAdmin ? effectiveAgentId || undefined : undefined
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['expense-withdrawal-context'] });
      queryClient.invalidateQueries({ queryKey: ['expense-withdrawal-requests'] });
      queryClient.invalidateQueries({ queryKey: ['receiptHandoverContext'] });
      setShowWithdrawalModal(false);
      setWithdrawalForm({
        agentResellerId: selectedReseller?.id ?? '',
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      showError('خطأ', 'اسم المصروف مطلوب');
      return;
    }
    if (formData.amount <= 0) {
      showError('خطأ', 'المبلغ يجب أن يكون أكبر من صفر');
      return;
    }
    if (isAdmin && !effectiveAgentId) {
      showError('خطأ', 'يرجى اختيار الوكيل');
      return;
    }
    createMutation.mutate({
      ...formData,
      name: formData.name.trim(),
      notes: formData.notes?.trim() || undefined,
    });
  };

  const handleEditClick = (exp: OfficeExpense) => {
    setSelectedExpense(exp);
    setEditFormData({
      name: exp.name ?? '',
      amount: exp.amount ?? 0,
      expenseDate: exp.expenseDate ? exp.expenseDate.split('T')[0] : '',
      notes: exp.notes ?? '',
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExpense?.id) return;
    if (!editFormData.name?.trim()) {
      showError('خطأ', 'اسم المصروف مطلوب');
      return;
    }
    if ((editFormData.amount ?? 0) <= 0) {
      showError('خطأ', 'المبلغ يجب أن يكون أكبر من صفر');
      return;
    }
    updateMutation.mutate({
      id: selectedExpense.id,
      data: {
        ...editFormData,
        name: editFormData.name!.trim(),
        notes: editFormData.notes?.trim() || undefined,
      },
    });
  };

  const handleDeleteClick = (exp: OfficeExpense) => {
    if (!window.confirm(`هل أنت متأكد من حذف المصروف «${exp.name}»؟`)) return;
    deleteMutation.mutate(exp.id);
  };

  const handlePayClick = (exp: OfficeExpense) => {
    if (!window.confirm(`تسديد المصروف «${exp.name}»؟`)) return;
    payMutation.mutate(exp.id);
  };

  const handleRegionSelect = (region: ReceiptHandoverRegion) => {
    setSelectedRegionId(region.id);
    setSelectedReseller(null);
    setWithdrawalsPage(1);
  };

  const handleResellerSelect = (reseller: ReceiptHandoverReseller) => {
    setSelectedReseller(reseller);
    setWithdrawalsPage(1);
  };

  const openWithdrawalModal = () => {
    if (!currentSelectedReseller || currentSelectedReseller.pendingIncomingIqd <= 0) return;
    setWithdrawalForm({
      agentResellerId: currentSelectedReseller.id,
      amount: 0,
      reason: '',
      expenseDate: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setShowWithdrawalModal(true);
  };

  const handleWithdrawalSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentSelectedReseller) return;
    if (withdrawalForm.amount <= 0) {
      showError('خطأ', 'قيمة مبلغ الصرف يجب أن تكون أكبر من صفر');
      return;
    }
    if (withdrawalForm.amount > currentSelectedReseller.pendingIncomingIqd) {
      showError('خطأ', 'قيمة مبلغ الصرف أكبر من الوارد الكلي المتاح لهذا الرسيلر');
      return;
    }
    if (!withdrawalForm.reason.trim()) {
      showError('خطأ', 'سبب الصرف مطلوب');
      return;
    }
    withdrawalMutation.mutate({
      ...withdrawalForm,
      agentResellerId: currentSelectedReseller.id,
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

  const normalizeExpense = (e: OfficeExpense): OfficeExpense => ({
    ...e,
    isPaid: e.isPaid ?? (e as any).isPaid === true,
    paidAt: e.paidAt ?? (e as any).paidAt ?? null,
  });

  const list = expenses.map(normalizeExpense);
  const totalAmount = list.reduce((s, e) => s + (e.amount ?? 0), 0);

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-md">
          خطأ في تحميل مصاريف المكتب
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <WifiLoaderComponent
          background="transparent"
          desktopSize="120px"
          mobileSize="100px"
          text="تحميل مصاريف المكتب..."
          backColor="#E8F2FC"
          frontColor="#4645F6"
        />
      </div>
    );
  }
  

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            مصاريف المكتب
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
            عرض وإدارة مصاريف المكتب
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
            onClick={() => setShowAddModal(true)}
            disabled={isAdmin && !effectiveAgentId}
            className="flex items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm sm:text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] touch-manipulation"
          >
            <Plus className="h-4 w-4" />
            <span>إضافة مصروف</span>
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 sm:gap-4 mt-2">
          <button
            type="button"
            onClick={() => {
              setFromDate(appliedFromDate);
              setToDate(appliedToDate);
              setShowFilterModal(true);
            }}
            className="text-right w-full rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
          >
            <StatCard
              title="إجمالي المصاريف"
              value={totalAmount}
              icon={DollarSign}
              color="blue"
              isAmount
            />
          </button>
          <StatCard
            title="إجمالي صافي الرواتب"
            value={totalNetSalary}
            icon={DollarSign}
            color="green"
            isAmount
          />
        </div>
        {(appliedFromDate || appliedToDate) && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            الفلترة: من {appliedFromDate || '—'} إلى {appliedToDate || '—'}
          </p>
        )}
      </div>

      <section className="mb-6 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <HandCoins className="h-5 w-5 text-primary-600" />
            سحب صرفيات من وارد الرسيلر
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            الوارد المعروض هو المتبقي بعد مبالغ الاستلام والتسليم والصرفيات الموافق عليها، ولا يؤثر على جدول الحسابات.
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
                  اختر الرسيلر — {selectedRegion.name}
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

            {currentSelectedReseller && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-4">
                <div>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
                    الوارد الكلي المتاح — {currentSelectedReseller.name}
                  </p>
                  <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200 mt-1">
                    {formatNumber(currentSelectedReseller.pendingIncomingIqd, { suffix: ' د.ع' })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openWithdrawalModal}
                  disabled={currentSelectedReseller.pendingIncomingIqd <= 0}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <HandCoins className="h-5 w-5" />
                  سحب صرفيات
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="wakeel-table-scroll">
          <table className="min-w-full text-right">
            <thead>
              <tr>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  اسم المصروف
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  المبلغ (د.ع)
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  تاريخ الصرف
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  تاريخ التسديد
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  ملاحظات
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  إجراءات
                </th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-gray-500 dark:text-gray-400"
                  >
                    <Wallet className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                    <p>لا توجد مصاريف</p>
                    <p className="text-sm mt-1">أضف مصروفاً جديداً باستخدام الزر أعلاه</p>
                  </td>
                </tr>
              ) : (
                list.map((exp) => (
                  <tr key={exp.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                      {exp.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {formatNumber(exp.amount ?? 0, { suffix: ' د.ع' })}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {exp.expenseDate
                        ? formatDate(exp.expenseDate.includes('T') ? exp.expenseDate : exp.expenseDate + 'T00:00:00')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {exp.paidAt
                        ? formatDate(exp.paidAt)
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white max-w-[180px] truncate" title={exp.notes ?? ''}>
                      {exp.notes ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        {!exp.isPaid && (
                          <button
                            type="button"
                            onClick={() => handlePayClick(exp)}
                            disabled={payMutation.isPending}
                            className="inline-flex items-center gap-1 px-2 py-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md transition-colors disabled:opacity-50"
                            title="تسديد المصروف"
                          >
                            <CheckCircle className="h-4 w-4" />
                            <span className="hidden sm:inline">تسديد</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleEditClick(exp)}
                          className="inline-flex items-center gap-1 px-2 py-1.5 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-md transition-colors"
                          title="تعديل"
                        >
                          <Edit2 className="h-4 w-4" />
                          <span className="hidden sm:inline">تعديل</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(exp)}
                          className="inline-flex items-center gap-1 px-2 py-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                          title="حذف"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="hidden sm:inline">حذف</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <section className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            سجل طلبات سحب الصرفيات
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            تُخصم القيمة من وارد الرسيلر عند الموافقة فقط.
          </p>
        </div>
        <div className="wakeel-table-scroll">
          <table className="min-w-[1050px] w-full text-right">
            <thead>
              <tr>
                <th>المنطقة</th>
                <th>الرسيلر</th>
                <th>قيمة مبلغ الصرف</th>
                <th>سبب الصرف</th>
                <th>تاريخ الصرف</th>
                <th>ملاحظات</th>
                <th>بواسطة</th>
                <th>حالة الطلب</th>
              </tr>
            </thead>
            <tbody>
              {withdrawalsLoading ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-gray-500">
                    جاري تحميل طلبات الصرف...
                  </td>
                </tr>
              ) : withdrawalRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-gray-500 dark:text-gray-400">
                    لا توجد طلبات صرف.
                  </td>
                </tr>
              ) : (
                withdrawalRequests.map((request) => (
                  <tr key={request.id}>
                    <td>{request.regionName}</td>
                    <td>{request.resellerName}</td>
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

      {showWithdrawalModal && currentSelectedReseller && selectedRegion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  طلب سحب صرفيات
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedRegion.name} — {currentSelectedReseller.name}
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
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-3">
                <span className="text-sm text-emerald-700 dark:text-emerald-300">
                  الوارد المتاح:
                </span>{' '}
                <strong className="text-emerald-800 dark:text-emerald-200">
                  {formatNumber(currentSelectedReseller.pendingIncomingIqd, { suffix: ' د.ع' })}
                </strong>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  قيمة مبلغ الصرف *
                </label>
                <input
                  type="number"
                  min={1}
                  max={currentSelectedReseller.pendingIncomingIqd}
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

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                إضافة مصروف
              </h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  اسم المصروف *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  required
                  maxLength={500}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  placeholder="مثال: إيجار، كهرباء، إنترنت..."
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    المبلغ (د.ع) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.amount || ''}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, amount: Number(e.target.value) || 0 }))
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    تاريخ الصرف *
                  </label>
                  <input
                    type="date"
                    value={formData.expenseDate}
                    onChange={(e) => setFormData((p) => ({ ...p, expenseDate: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  ملاحظات
                </label>
                <textarea
                  value={formData.notes ?? ''}
                  onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  placeholder="اختياري"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md disabled:opacity-50"
                >
                  {createMutation.isPending ? 'جاري الحفظ...' : 'إضافة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedExpense && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                تعديل مصروف
              </h2>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  اسم المصروف *
                </label>
                <input
                  type="text"
                  value={editFormData.name ?? ''}
                  onChange={(e) =>
                    setEditFormData((p) => ({ ...p, name: e.target.value }))
                  }
                  required
                  maxLength={500}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    المبلغ (د.ع) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={editFormData.amount ?? ''}
                    onChange={(e) =>
                      setEditFormData((p) => ({
                        ...p,
                        amount: Number(e.target.value) || 0,
                      }))
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    تاريخ الصرف *
                  </label>
                  <input
                    type="date"
                    value={editFormData.expenseDate ?? ''}
                    onChange={(e) =>
                      setEditFormData((p) => ({ ...p, expenseDate: e.target.value }))
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  ملاحظات
                </label>
                <textarea
                  value={editFormData.notes ?? ''}
                  onChange={(e) =>
                    setEditFormData((p) => ({ ...p, notes: e.target.value }))
                  }
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md disabled:opacity-50"
                >
                  {updateMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
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
                فلترة المصاريف بالتاريخ
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
                الفلترة حسب تاريخ المصروف (ExpenseDate). اترك الحقل فارغاً لعدم تحديد حد.
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
