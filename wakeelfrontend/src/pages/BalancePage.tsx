import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useConfirmation } from '../contexts/ConfirmationContext';
import { useDigits } from '../contexts/DigitsContext';
import { apiService, ApiService } from '../services/api';
import { BalanceTopUpRequest, BalanceTopUpUpdateRequest, BalanceTopUpsPageResponse, PACKING_SOURCE_OPTIONS, PackingSource, UserRole } from '../types';
import { getAgentBalance } from '../utils/balance';
import { showSuccess, showError } from '../utils/notifications';
import { Wallet, Plus, History, X, User, CircleDollarSign, Pencil, Trash2 } from 'lucide-react';

const BalancePage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { formatNumber, formatDate } = useDigits();
  const { confirmAction } = useConfirmation();
  const queryClient = useQueryClient();

  const balanceQueryEnabled =
    isAuthenticated &&
    (user?.role !== UserRole.Employee || user?.canAccessAccounts !== false);

  const { data: balanceDetail } = useQuery({
    queryKey: ['balance-detail'],
    queryFn: () => apiService.getBalance(),
    enabled: balanceQueryEnabled,
  });

  const balanceTotal =
    balanceDetail?.balanceIqd ??
    (balanceQueryEnabled ? 0 : getAgentBalance(user?.id));

  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [showEditTopUpModal, setShowEditTopUpModal] = useState(false);
  const [editingTopUpId, setEditingTopUpId] = useState<string | null>(null);
  const [showEditBalanceModal, setShowEditBalanceModal] = useState(false);
  const [editBalanceValue, setEditBalanceValue] = useState<number>(0);
  const [editBalanceResellerId, setEditBalanceResellerId] = useState('');
  const [topUpForm, setTopUpForm] = useState<BalanceTopUpRequest & { topUpDate: string }>({
    amountIqd: 0,
    recipientName: '',
    companyName: '',
    topUpDate: new Date().toISOString().split('T')[0],
    agentResellerId: '',
    packingSource: PackingSource.NormalBalance,
  });
  const [editTopUpForm, setEditTopUpForm] = useState<BalanceTopUpUpdateRequest & { topUpDate: string }>({
    amountIqd: 0,
    recipientName: '',
    companyName: '',
    topUpDate: new Date().toISOString().split('T')[0],
    packingSource: PackingSource.NormalBalance,
  });

  const resellerRows = useMemo(
    () => balanceDetail?.resellerBalances ?? [],
    [balanceDetail?.resellerBalances]
  );
  const hasResellerRegions = resellerRows.length > 0;

  useEffect(() => {
    if (!showEditBalanceModal) return;
    if (editBalanceResellerId) {
      const row = resellerRows.find((r) => r.id === editBalanceResellerId);
      setEditBalanceValue(row?.balanceIqd ?? 0);
    } else {
      setEditBalanceValue(balanceDetail?.agentPoolBalanceIqd ?? balanceTotal);
    }
  }, [showEditBalanceModal, editBalanceResellerId, resellerRows, balanceDetail?.agentPoolBalanceIqd, balanceTotal]);

  useEffect(() => {
    setEditBalanceValue(balanceDetail?.agentPoolBalanceIqd ?? balanceTotal);
  }, [balanceDetail?.agentPoolBalanceIqd, balanceTotal]);

  const { data: topUpsResponse } = useQuery<BalanceTopUpsPageResponse>({
    queryKey: ['balance-topups'],
    queryFn: () => apiService.getBalanceTopUps(1, 50),
    enabled: isAuthenticated && balanceQueryEnabled,
  });
  const topUpsList = topUpsResponse?.data ?? [];

  const topUpMutation = useMutation({
    mutationFn: (body: BalanceTopUpRequest) => apiService.postBalanceTopUp(body),
    onSuccess: (data) => {
      setShowTopUpModal(false);
      setTopUpForm({
        amountIqd: 0,
        recipientName: '',
        companyName: '',
        topUpDate: new Date().toISOString().split('T')[0],
        agentResellerId: '',
        packingSource: PackingSource.NormalBalance,
      });
      queryClient.invalidateQueries({ queryKey: ['balance-topups'] });
      queryClient.invalidateQueries({ queryKey: ['balance-detail'] });
      queryClient.invalidateQueries({ queryKey: ['myResellers'] });
      queryClient.invalidateQueries({ queryKey: ['subscribers-dashboard'] });
      showSuccess('تمت التعبئة', `الرصيد الإجمالي: ${formatNumber(data.balanceIqd, { suffix: ' د.ع' })}`);
    },
    onError: (err: unknown) => {
      showError('خطأ في التعبئة', ApiService.showError(err));
    },
  });

  const deleteTopUpMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteBalanceTopUp(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['balance-topups'] });
      showSuccess('تم الحذف', 'تم حذف سجل التعبئة من السجل');
    },
    onError: (err: unknown) => {
      showError('خطأ في الحذف', ApiService.showError(err));
    },
  });

  const editTopUpMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: BalanceTopUpUpdateRequest }) =>
      apiService.putBalanceTopUp(id, body),
    onSuccess: () => {
      setShowEditTopUpModal(false);
      setEditingTopUpId(null);
      queryClient.invalidateQueries({ queryKey: ['balance-topups'] });
      queryClient.invalidateQueries({ queryKey: ['balance-detail'] });
      showSuccess('تم التعديل', 'تم تحديث سجل التعبئة بنجاح');
    },
    onError: (err: unknown) => {
      showError('خطأ في التعديل', ApiService.showError(err));
    },
  });

  const editBalanceMutation = useMutation({
    mutationFn: async ({ balanceIqd, resellerId }: { balanceIqd: number; resellerId?: string }) => {
      if (resellerId) return apiService.putResellerBalance(resellerId, balanceIqd);
      return apiService.putBalance(balanceIqd);
    },
    onSuccess: (data) => {
      setShowEditBalanceModal(false);
      setEditBalanceResellerId('');
      queryClient.invalidateQueries({ queryKey: ['balance-detail'] });
      showSuccess('تم التعديل', `الرصيد الإجمالي: ${formatNumber(data.balanceIqd, { suffix: ' د.ع' })}`);
    },
    onError: (err: unknown) => {
      showError('خطأ في تعديل الرصيد', ApiService.showError(err));
    },
  });

  const handleTopUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(topUpForm.amountIqd);
    if (!Number.isFinite(amount) || amount <= 0) {
      showError('خطأ', 'يرجى إدخال مبلغ صحيح');
      return;
    }
    if (!topUpForm.recipientName?.trim()) {
      showError('خطأ', 'يرجى إدخال اسم المستلم');
      return;
    }
    if (!topUpForm.companyName?.trim()) {
      showError('خطأ', 'يرجى إدخال الشركة / جهة الرصيد');
      return;
    }
    if (hasResellerRegions && !(topUpForm.agentResellerId ?? '').trim()) {
      showError('خطأ', 'يرجى اختيار المنطقة التي يُضاف إليها الرصيد');
      return;
    }
    if (!topUpForm.packingSource) {
      showError('خطأ', 'يرجى اختيار مصدر التعبئة');
      return;
    }
    topUpMutation.mutate({
      amountIqd: amount,
      recipientName: topUpForm.recipientName.trim(),
      companyName: topUpForm.companyName.trim(),
      topUpDate: topUpForm.topUpDate || undefined,
      agentResellerId: hasResellerRegions ? (topUpForm.agentResellerId ?? '').trim() : undefined,
      packingSource: topUpForm.packingSource,
    });
  };

  const openEditTopUp = (row: (typeof topUpsList)[number]) => {
    setEditingTopUpId(row.id);
    setEditTopUpForm({
      amountIqd: row.amountIqd,
      recipientName: row.recipientName,
      companyName: row.companyName,
      topUpDate: row.topUpDate ? row.topUpDate.split('T')[0] : new Date().toISOString().split('T')[0],
      packingSource: row.packingSource ?? PackingSource.NormalBalance,
    });
    setShowEditTopUpModal(true);
  };

  const handleEditTopUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTopUpId) return;
    const amount = Number(editTopUpForm.amountIqd);
    if (!Number.isFinite(amount) || amount <= 0) {
      showError('خطأ', 'يرجى إدخال مبلغ صحيح');
      return;
    }
    if (!editTopUpForm.recipientName?.trim()) {
      showError('خطأ', 'يرجى إدخال اسم المستلم');
      return;
    }
    if (!editTopUpForm.companyName?.trim()) {
      showError('خطأ', 'يرجى إدخال الشركة / جهة الرصيد');
      return;
    }
    editTopUpMutation.mutate({
      id: editingTopUpId,
      body: {
        amountIqd: amount,
        recipientName: editTopUpForm.recipientName.trim(),
        companyName: editTopUpForm.companyName.trim(),
        topUpDate: editTopUpForm.topUpDate || undefined,
        packingSource: editTopUpForm.packingSource,
      },
    });
  };

  const handleDeleteTopUp = async (row: (typeof topUpsList)[number]) => {
    const ok = await confirmAction(
      'حذف التعبئة',
      `هل تريد حذف تعبئة ${formatNumber(row.amountIqd, { suffix: ' د.ع' })} للمستلم «${row.recipientName}» من السجل؟ لن يتأثر الرصيد الحالي.`
    );
    if (!ok) return;
    deleteTopUpMutation.mutate(row.id);
  };

  const canManageBalance =
    user?.role === UserRole.Admin || user?.role === UserRole.Agent || user?.role === UserRole.SubAgent;

  if (!isAuthenticated) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <User className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">يرجى تسجيل الدخول</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">يجب تسجيل الدخول لعرض الرصيد</p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="mt-4 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors"
          >
            تسجيل الدخول
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
          <CircleDollarSign className="h-8 w-8 shrink-0 text-primary-600 dark:text-primary-400" aria-hidden />
          الرصيد
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          عرض الرصيد الإجمالي (عام + مناطق)، التعبئة باختيار المنطقة عند وجودها، وتعديل الرصيد العام (حسب الصلاحية)
        </p>
      </div>

      {!balanceQueryEnabled && (
        <div className="mb-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          لا تتوفر صلاحية الحسابات لعرض الرصيد من الخادم.
        </div>
      )}

      {hasResellerRegions && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">المناطق والرصيد العام</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-right">
              <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">الرصيد العام</div>
              <div className="text-xs opacity-75 truncate">بدون منطقة / قديم</div>
              <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-1" dir="ltr">
                {formatNumber(balanceDetail?.agentPoolBalanceIqd ?? 0, { suffix: ' د.ع' })}
              </div>
            </div>
            {resellerRows.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-right"
              >
                <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{r.name}</div>
                <div className="text-xs opacity-75 truncate">رصيد المنطقة</div>
                <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-1" dir="ltr">
                  {formatNumber(r.balanceIqd, { suffix: ' د.ع' })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-indigo-100 dark:bg-indigo-900/40">
              <Wallet className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">الرصيد الإجمالي</h2>
              <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                {formatNumber(balanceTotal, { suffix: ' د.ع' })}
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap gap-2">
            {(user?.role === UserRole.Admin || user?.role === UserRole.Agent || user?.role === UserRole.SubAgent) && (
              <button
                type="button"
                onClick={() => {
                  setEditBalanceResellerId('');
                  setShowEditBalanceModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-sm font-medium"
              >
                <Wallet className="h-4 w-4" />
                تعديل الرصيد
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowTopUpModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              تعبئة الرصيد
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
          <History className="h-4 w-4" />
          سجل التعبئات (الأحدث أولاً)
        </h3>
        <div className="wakeel-table-scroll">
          <table className="min-w-full text-right text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">مصدر التعبئة</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">المبلغ</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">المنطقة</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">المستلم</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">الشركة</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">التاريخ</th>
                {canManageBalance && (
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">إجراء</th>
                )}
              </tr>
            </thead>
            <tbody>
              {topUpsList.length === 0 ? (
                <tr>
                  <td colSpan={canManageBalance ? 7 : 6} className="px-3 py-4 text-gray-500 dark:text-gray-400 text-center">
                    لا توجد تعبئات مسجّلة
                  </td>
                </tr>
              ) : (
                topUpsList.map((row) => (
                  <tr key={row.id} className="bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
                    <td className="px-3 py-2">{row.packingSourceLabelAr || '—'}</td>
                    <td className="px-3 py-2">{formatNumber(row.amountIqd, { suffix: ' د.ع' })}</td>
                    <td className="px-3 py-2">{row.agentResellerName?.trim() || 'الرصيد العام'}</td>
                    <td className="px-3 py-2">{row.recipientName}</td>
                    <td className="px-3 py-2">{row.companyName}</td>
                    <td className="px-3 py-2">{row.topUpDate ? formatDate(row.topUpDate) : '—'}</td>
                    {canManageBalance && (
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditTopUp(row)}
                            className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline text-xs"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            تعديل
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteTopUp(row)}
                            disabled={deleteTopUpMutation.isPending}
                            className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 hover:underline text-xs disabled:opacity-50"
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
      </div>

      {showEditBalanceModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-balance-title"
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 id="edit-balance-title" className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                تعديل الرصيد
              </h2>
              <button
                type="button"
                onClick={() => setShowEditBalanceModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                aria-label="إغلاق"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const v = Number(editBalanceValue);
                if (!Number.isFinite(v) || v < 0) {
                  showError('خطأ', 'يرجى إدخال رصيد صحيح (>= 0).');
                  return;
                }
                if (hasResellerRegions && editBalanceResellerId) {
                  editBalanceMutation.mutate({ balanceIqd: v, resellerId: editBalanceResellerId });
                } else {
                  editBalanceMutation.mutate({ balanceIqd: v });
                }
              }}
              className="p-4 space-y-4"
            >
              {hasResellerRegions && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الرسيلر / الرصيد</label>
                  <select
                    value={editBalanceResellerId}
                    onChange={(e) => setEditBalanceResellerId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">الرصيد العام (بدون منطقة)</option>
                    {resellerRows.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {hasResellerRegions
                  ? 'اختر الرسيلر لتعديل رصيده، أو «الرصيد العام» لتعديل الرصيد القديم غير المربوط بمنطقة.'
                  : 'يُعدّل الرصيد العام للوكيل.'}
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  الرصيد (د.ع)
                </label>
                <input
                  type="number"
                  min={0}
                  value={Number.isFinite(editBalanceValue) ? editBalanceValue : 0}
                  onChange={(e) => setEditBalanceValue(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowEditBalanceModal(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded-md text-sm font-medium"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={editBalanceMutation.isPending}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-md text-sm font-medium"
                >
                  {editBalanceMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTopUpModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="topup-modal-title"
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 id="topup-modal-title" className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                تعبئة الرصيد
              </h2>
              <button
                type="button"
                onClick={() => setShowTopUpModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                aria-label="إغلاق"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              <form onSubmit={handleTopUpSubmit} className="space-y-4">
                {hasResellerRegions && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">المنطقة *</label>
                    <select
                      value={topUpForm.agentResellerId ?? ''}
                      onChange={(e) =>
                        setTopUpForm((prev) => ({ ...prev, agentResellerId: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                      required
                    >
                      <option value="">— اختر المنطقة —</option>
                      {resellerRows.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">مصدر التعبئة *</label>
                  <select
                    value={topUpForm.packingSource}
                    onChange={(e) =>
                      setTopUpForm((prev) => ({
                        ...prev,
                        packingSource: Number(e.target.value) as PackingSource,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    required
                  >
                    {PACKING_SOURCE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.labelAr}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">المبلغ (د.ع) *</label>
                  <input
                    type="number"
                    min={1}
                    value={topUpForm.amountIqd || ''}
                    onChange={(e) => setTopUpForm((prev) => ({ ...prev, amountIqd: Number(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">اسم المستلم *</label>
                  <input
                    type="text"
                    value={topUpForm.recipientName}
                    onChange={(e) => setTopUpForm((prev) => ({ ...prev, recipientName: e.target.value }))}
                    placeholder="أحمد محمد"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الشركة / جهة الرصيد *</label>
                  <input
                    type="text"
                    value={topUpForm.companyName}
                    onChange={(e) => setTopUpForm((prev) => ({ ...prev, companyName: e.target.value }))}
                    placeholder="شركة الاتصالات"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">تاريخ التعبئة (اختياري)</label>
                  <input
                    type="date"
                    value={topUpForm.topUpDate}
                    onChange={(e) => setTopUpForm((prev) => ({ ...prev, topUpDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={topUpMutation.isPending}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-md text-sm font-medium"
                  >
                    {topUpMutation.isPending ? 'جاري الحفظ...' : 'تسجيل التعبئة'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTopUpModal(false)}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded-md text-sm font-medium"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showEditTopUpModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-topup-modal-title"
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 id="edit-topup-modal-title" className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Pencil className="h-5 w-5" />
                تعديل سجل التعبئة
              </h2>
              <button
                type="button"
                onClick={() => setShowEditTopUpModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                aria-label="إغلاق"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              <form onSubmit={handleEditTopUpSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">مصدر التعبئة *</label>
                  <select
                    value={editTopUpForm.packingSource}
                    onChange={(e) =>
                      setEditTopUpForm((prev) => ({
                        ...prev,
                        packingSource: Number(e.target.value) as PackingSource,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    required
                  >
                    {PACKING_SOURCE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.labelAr}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">المبلغ (د.ع) *</label>
                  <input
                    type="number"
                    min={1}
                    value={editTopUpForm.amountIqd || ''}
                    onChange={(e) =>
                      setEditTopUpForm((prev) => ({ ...prev, amountIqd: Number(e.target.value) || 0 }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">اسم المستلم *</label>
                  <input
                    type="text"
                    value={editTopUpForm.recipientName}
                    onChange={(e) => setEditTopUpForm((prev) => ({ ...prev, recipientName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الشركة / جهة الرصيد *</label>
                  <input
                    type="text"
                    value={editTopUpForm.companyName}
                    onChange={(e) => setEditTopUpForm((prev) => ({ ...prev, companyName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">تاريخ التعبئة</label>
                  <input
                    type="date"
                    value={editTopUpForm.topUpDate}
                    onChange={(e) => setEditTopUpForm((prev) => ({ ...prev, topUpDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={editTopUpMutation.isPending}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-md text-sm font-medium"
                  >
                    {editTopUpMutation.isPending ? 'جاري الحفظ...' : 'حفظ التعديل'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEditTopUpModal(false)}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded-md text-sm font-medium"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BalancePage;
