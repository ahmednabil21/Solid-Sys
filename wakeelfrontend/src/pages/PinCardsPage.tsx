import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Upload } from 'lucide-react';
import { apiService, ApiService } from '../services/api';
import { PinCardPricingUpdateRequest, UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useDigits } from '../contexts/DigitsContext';
import { showError, showSuccess } from '../utils/notifications';
import Pagination from '../components/Pagination';
import { STANDARD_PAGE_SIZE_OPTIONS } from '../constants/pagination';

const PinCardsPage: React.FC = () => {
  const { user } = useAuth();
  const { formatDate } = useDigits();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === UserRole.Admin;
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [profileId, setProfileId] = useState('');
  const [agentCost, setAgentCost] = useState(0);
  const [subscriberCost, setSubscriberCost] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(STANDARD_PAGE_SIZE_OPTIONS[0]);

  const { data: agentsResponse } = useQuery({
    queryKey: ['agents', 1, 100],
    queryFn: () => apiService.getAllAgents({ page: 1, pageSize: 100 }),
    enabled: isAdmin,
  });
  const agents = useMemo(() => agentsResponse?.data ?? [], [agentsResponse]);
  const agentId = isAdmin ? selectedAgentId || undefined : undefined;
  const canLoad = isAdmin ? !!selectedAgentId : true;

  useEffect(() => {
    if (!isAdmin || !agents.length || selectedAgentId) return;
    setSelectedAgentId(agents[0]?.id ?? '');
  }, [isAdmin, agents, selectedAgentId]);

  const { data: profiles = [] } = useQuery({
    queryKey: ['renewal-profiles', 'pin-cards', agentId ?? 'self'],
    queryFn: () => apiService.getRenewalProfiles(),
    enabled: canLoad,
  });
  const selectedAgent = agents.find((a) => a.id === selectedAgentId);
  const profileOptions = useMemo(() => {
    if (!isAdmin) return profiles;
    const company = (selectedAgent?.companyName || '').trim();
    if (!company) return profiles;
    const matched = profiles.filter((p) => (p.agentCompanyName || '').trim() === company);
    return matched.length > 0 ? matched : profiles;
  }, [isAdmin, profiles, selectedAgent?.companyName]);

  const { data: pricing } = useQuery({
    queryKey: ['pin-card-pricing', agentId ?? 'self'],
    queryFn: () => apiService.getPinCardPricing(agentId),
    enabled: canLoad,
  });

  useEffect(() => {
    if (!pricing) return;
    setProfileId(pricing.profileId);
    setAgentCost(pricing.agentCost);
    setSubscriberCost(pricing.subscriberCost);
  }, [pricing]);

  const { data: activations, isLoading: activationsLoading } = useQuery({
    queryKey: ['pin-card-activations', agentId ?? 'self', page, pageSize],
    queryFn: () =>
      apiService.getPinCardActivations({
        agentId,
        page,
        pageSize,
      }),
    enabled: canLoad,
  });

  const savePricing = useMutation({
    mutationFn: (data: PinCardPricingUpdateRequest) => apiService.savePinCardPricing(data, agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pin-card-pricing'] });
      showSuccess('تم الحفظ', 'تم حفظ تسعير كروت الشحن.');
    },
    onError: (err: unknown) => showError('تعذر الحفظ', ApiService.showError(err)),
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => apiService.importPinCardsFromExcel(file, agentId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['pin-card-activations'] });
      queryClient.invalidateQueries({ queryKey: ['unused-pin-cards'] });
      showSuccess(
        'تم الاستيراد',
        `ناجح: ${result.successCount} — أخطاء: ${result.errorCount} — متجاهل: ${result.skippedCount}`
      );
      if (result.errors?.length) {
        showError(
          'صفوف بها أخطاء',
          result.errors.slice(0, 5).map((e) => `صف ${e.row}: ${e.message}`).join('\n')
        );
      }
    },
    onError: (err: unknown) => showError('تعذر رفع الإكسل', ApiService.showError(err)),
  });

  const handleSavePricing = (event: React.FormEvent) => {
    event.preventDefault();
    if (!profileId) {
      showError('خطأ', 'اختر اسم الباقة.');
      return;
    }
    savePricing.mutate({ profileId, agentCost, subscriberCost });
  };

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <CreditCard className="h-6 w-6" />
          كروت الشحن PIN
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          احفظ التسعير مرة واحدة، ثم ارفع إكسل الكروت (Series, SN, PIN, Value, Expation).
        </p>
      </div>

      {isAdmin && (
        <div className="max-w-xs">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">الوكيل</label>
          <select
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm"
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

      <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">تسعير مسار PIN</h2>
        <form onSubmit={handleSavePricing} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">اسم الباقة *</label>
            <select
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
            >
              <option value="">اختر باقة</option>
              {profileOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">كلفة الوكيل *</label>
            <input
              type="number"
              min={0}
              value={agentCost || ''}
              onChange={(e) => setAgentCost(Number(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">كلفة المشترك *</label>
            <input
              type="number"
              min={0}
              value={subscriberCost || ''}
              onChange={(e) => setSubscriberCost(Number(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
            />
          </div>
          <button
            type="submit"
            disabled={!canLoad || savePricing.isPending}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md disabled:opacity-50"
          >
            {savePricing.isPending ? 'جاري الحفظ...' : 'حفظ التسعير'}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">رفع إكسل الكروت</h2>
        <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 cursor-pointer">
          <Upload className="h-4 w-4" />
          {importMutation.isPending ? 'جاري الرفع...' : 'اختيار ملف Excel'}
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            disabled={!canLoad || importMutation.isPending || !pricing}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              if (!pricing) {
                showError('خطأ', 'احفظ التسعير أولاً.');
                return;
              }
              importMutation.mutate(file);
            }}
          />
        </label>
        {!pricing && canLoad && (
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-2">احفظ التسعير قبل رفع الإكسل.</p>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">سجل تفعيل كروت الشحن</h2>
        </div>
        <div className="wakeel-table-scroll">
          <table className="min-w-full text-right">
            <thead>
              <tr>
                <th>PIN</th>
                <th>السلسلة</th>
                <th>SN</th>
                <th>المشترك</th>
                <th>الإيصال</th>
                <th>التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {activationsLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">جاري التحميل...</td>
                </tr>
              ) : (activations?.data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">لا توجد تفعيلات PIN.</td>
                </tr>
              ) : (
                (activations?.data ?? []).map((row) => (
                  <tr key={row.id}>
                    <td className="font-mono">{row.pin}</td>
                    <td>{row.series}</td>
                    <td>{row.serialNumber}</td>
                    <td>{row.subscriberName}</td>
                    <td>{row.receiptNumber}</td>
                    <td>{row.usedAt ? formatDate(row.usedAt) : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {(activations?.totalItems ?? 0) > 0 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <Pagination
              currentPage={activations?.currentPage ?? page}
              totalPages={Math.max(1, activations?.totalPages ?? 1)}
              totalItems={activations?.totalItems ?? 0}
              pageSize={activations?.pageSize ?? pageSize}
              hasNextPage={!!activations?.hasNextPage}
              hasPreviousPage={!!activations?.hasPreviousPage}
              onPageChange={setPage}
              pageSizeOptions={[...STANDARD_PAGE_SIZE_OPTIONS]}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </div>
        )}
      </section>
    </div>
  );
};

export default PinCardsPage;
