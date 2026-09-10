import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Headphones,
  PhoneCall,
  Plus,
  Search,
  Wrench,
  HelpCircle,
  UserPlus,
  Wallet,
  Zap,
  X,
  Users,
} from 'lucide-react';
import Pagination from '../components/Pagination';
import { StatCard } from '../components/StatCard';
import { useAuth } from '../contexts/AuthContext';
import { useDigits } from '../contexts/DigitsContext';
import { apiService } from '../services/api';
import {
  CallContactType,
  CallTicketCreateRequest,
  CallCenterSubscriberOption,
  UserRole,
} from '../types';
import { hasPageAction } from '../utils/employeePermissions';
import { showError, showSuccess } from '../utils/notifications';
import { STANDARD_PAGE_SIZE_OPTIONS } from '../constants/pagination';

const DASHBOARD_CALL_CENTER_AGENT_KEY = 'wakeel_call_center_agentId';

const CALL_TYPE_OPTIONS: Array<{
  value: CallContactType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: CallContactType.SubscriptionActivation, label: 'تفعيل اشتراك', icon: Zap },
  { value: CallContactType.MaintenanceRequest, label: 'طلب صيانة', icon: Wrench },
  { value: CallContactType.Inquiry, label: 'استفسار', icon: HelpCircle },
  { value: CallContactType.NewSubscription, label: 'اشتراك جديد', icon: UserPlus },
  { value: CallContactType.Payment, label: 'تسديد مبلغ', icon: Wallet },
];

const callTypeLabel = (type: CallContactType, fallback?: string) =>
  CALL_TYPE_OPTIONS.find((o) => o.value === type)?.label || fallback || '—';

const callTypeBadgeClass = (type: CallContactType) => {
  if (type === CallContactType.SubscriptionActivation)
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  if (type === CallContactType.MaintenanceRequest)
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  if (type === CallContactType.Inquiry)
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
  if (type === CallContactType.NewSubscription)
    return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
  return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300';
};

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const emptyForm: CallTicketCreateRequest = {
  subscriberId: '',
  callType: CallContactType.Inquiry,
  description: '',
};

const CallCenterPage: React.FC = () => {
  const { user } = useAuth();
  const { formatNumber, formatDate } = useDigits();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === UserRole.Admin;
  const canOpenTicket = !user || user.role !== UserRole.Employee || hasPageAction(user, 'CallCenter', 'add');

  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(STANDARD_PAGE_SIZE_OPTIONS[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [callTypeFilter, setCallTypeFilter] = useState<CallContactType | ''>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [statsPage, setStatsPage] = useState(1);
  const [statsSearch, setStatsSearch] = useState('');
  const [appliedStatsSearch, setAppliedStatsSearch] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState<CallTicketCreateRequest>(emptyForm);
  const [selectedSubscriber, setSelectedSubscriber] = useState<CallCenterSubscriberOption | null>(null);
  const [subscriberSearch, setSubscriberSearch] = useState('');
  const [subscriberSearchDebounced, setSubscriberSearchDebounced] = useState('');
  const [subscriberPage, setSubscriberPage] = useState(1);
  const [subscriberOptions, setSubscriberOptions] = useState<CallCenterSubscriberOption[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setSubscriberSearchDebounced(subscriberSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [subscriberSearch]);

  const { data: agentsResponse } = useQuery({
    queryKey: ['agents', 1, 100],
    queryFn: () => apiService.getAllAgents({ page: 1, pageSize: 100 }),
    enabled: isAdmin,
  });
  const agents = useMemo(() => agentsResponse?.data ?? [], [agentsResponse]);

  useEffect(() => {
    if (!isAdmin || !agents.length) return;
    const saved = localStorage.getItem(DASHBOARD_CALL_CENTER_AGENT_KEY);
    if (saved && agents.some((a) => a.id === saved)) {
      setSelectedAgentId(saved);
    } else if (!selectedAgentId) {
      setSelectedAgentId(agents[0]?.id ?? '');
    }
  }, [isAdmin, agents, selectedAgentId]);

  useEffect(() => {
    if (!isAdmin || !selectedAgentId) return;
    localStorage.setItem(DASHBOARD_CALL_CENTER_AGENT_KEY, selectedAgentId);
  }, [isAdmin, selectedAgentId]);

  const agentId = isAdmin ? selectedAgentId || undefined : undefined;
  const canLoad = isAdmin ? !!selectedAgentId : true;

  const ticketsQuery = useQuery({
    queryKey: [
      'call-center-tickets',
      agentId ?? 'self',
      page,
      pageSize,
      appliedSearch,
      callTypeFilter,
      fromDate,
      toDate,
    ],
    queryFn: () =>
      apiService.getCallCenterTickets({
        page,
        pageSize,
        searchTerm: appliedSearch || undefined,
        callType: callTypeFilter === '' ? undefined : callTypeFilter,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        agentId,
      }),
    enabled: canLoad,
  });

  const statsQuery = useQuery({
    queryKey: ['call-center-subscriber-stats', agentId ?? 'self', statsPage, appliedStatsSearch],
    queryFn: () =>
      apiService.getCallCenterSubscriberStats({
        page: statsPage,
        pageSize: 10,
        searchTerm: appliedStatsSearch || undefined,
        agentId,
      }),
    enabled: canLoad,
  });

  const {
    data: subscribersResponse,
    isFetching: subscribersLoading,
  } = useQuery({
    queryKey: [
      'call-center-subscribers',
      agentId ?? 'self',
      subscriberPage,
      subscriberSearchDebounced,
    ],
    queryFn: () =>
      apiService.searchCallCenterSubscribers({
        page: subscriberPage,
        pageSize: 10,
        searchTerm: subscriberSearchDebounced || undefined,
        agentId,
      }),
    enabled: showCreateModal && canLoad,
  });

  useEffect(() => {
    if (!subscribersResponse) return;
    const incoming = subscribersResponse.data ?? [];
    if (subscriberPage === 1) {
      setSubscriberOptions(incoming);
      return;
    }
    setSubscriberOptions((prev) => {
      const seen = new Set(prev.map((s) => s.id));
      return [...prev, ...incoming.filter((s) => !seen.has(s.id))];
    });
  }, [subscribersResponse, subscriberPage]);

  const createMutation = useMutation({
    mutationFn: (payload: CallTicketCreateRequest) => apiService.createCallTicket(payload, agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-center-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['call-center-subscriber-stats'] });
      showSuccess('تم فتح التكت', 'تم تسجيل مكالمة الاتصال بنجاح.');
      closeCreateModal();
    },
    onError: (err: Error) => {
      showError('تعذر فتح التكت', err.message || 'فشل تسجيل الاتصال.');
    },
  });

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setForm(emptyForm);
    setSelectedSubscriber(null);
    setSubscriberSearch('');
    setSubscriberSearchDebounced('');
    setSubscriberPage(1);
    setSubscriberOptions([]);
  };

  const submitTicket = () => {
    if (!form.subscriberId) {
      showError('بيانات ناقصة', 'يجب اختيار المشترك الذي اتصل.');
      return;
    }
    const words = countWords(form.description);
    if (words < 2) {
      showError('وصف غير صالح', 'وصف الاتصال لا يمكن أن يكون فارغاً أو أقل من كلمتين.');
      return;
    }
    createMutation.mutate({
      subscriberId: form.subscriberId,
      callType: form.callType,
      description: form.description.trim(),
    });
  };

  const statistics = ticketsQuery.data?.statistics;
  const tickets = ticketsQuery.data?.data ?? [];
  const wordCount = countWords(form.description);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Headphones className="h-7 w-7 text-primary-600" />
            مركز الاتصال
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            فتح تكتات الاتصال وتسجيل المكالمات مع إحصائيات يومية وأنواع الاتصال
          </p>
        </div>
        {canOpenTicket && (
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            disabled={!canLoad}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            فتح تكت اتصال
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          {isAdmin && (
            <select
              value={selectedAgentId}
              onChange={(e) => {
                setSelectedAgentId(e.target.value);
                setPage(1);
                setStatsPage(1);
              }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
            >
              <option value="">اختر الوكيل</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.companyName || agent.fullName || agent.username}
                </option>
              ))}
            </select>
          )}
          <div className="relative md:col-span-2">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setAppliedSearch(searchTerm.trim());
                  setPage(1);
                }
              }}
              placeholder="بحث بالتكت أو المشترك أو الوصف..."
              className="w-full pr-9 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
            />
          </div>
          <select
            value={callTypeFilter}
            onChange={(e) => {
              setCallTypeFilter(e.target.value === '' ? '' : (Number(e.target.value) as CallContactType));
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
          >
            <option value="">كل أنواع الاتصال</option>
            {CALL_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
            />
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>
        <div className="mt-3">
          <button
            type="button"
            onClick={() => {
              setAppliedSearch(searchTerm.trim());
              setPage(1);
            }}
            className="px-3 py-1.5 text-sm rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
          >
            تطبيق البحث
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="مكالمات اليوم" value={statistics?.todayCallsCount ?? 0} icon={PhoneCall} color="blue" />
        <StatCard title="إجمالي المكالمات" value={statistics?.totalCallsCount ?? 0} icon={Headphones} color="indigo" />
        <StatCard
          title="تفعيل اشتراك"
          value={statistics?.allTimeTypes.subscriptionActivation ?? 0}
          icon={Zap}
          color="green"
        />
        <StatCard
          title="طلب صيانة"
          value={statistics?.allTimeTypes.maintenanceRequest ?? 0}
          icon={Wrench}
          color="yellow"
        />
        <StatCard title="استفسار" value={statistics?.allTimeTypes.inquiry ?? 0} icon={HelpCircle} color="purple" />
        <StatCard
          title="اشتراك جديد"
          value={statistics?.allTimeTypes.newSubscription ?? 0}
          icon={UserPlus}
          color="orange"
        />
        <StatCard title="تسديد مبلغ" value={statistics?.allTimeTypes.payment ?? 0} icon={Wallet} color="teal" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {CALL_TYPE_OPTIONS.map((opt) => {
          const todayValue =
            opt.value === CallContactType.SubscriptionActivation
              ? statistics?.todayTypes.subscriptionActivation ?? 0
              : opt.value === CallContactType.MaintenanceRequest
                ? statistics?.todayTypes.maintenanceRequest ?? 0
                : opt.value === CallContactType.Inquiry
                  ? statistics?.todayTypes.inquiry ?? 0
                  : opt.value === CallContactType.NewSubscription
                    ? statistics?.todayTypes.newSubscription ?? 0
                    : statistics?.todayTypes.payment ?? 0;
          return (
            <div
              key={opt.value}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3"
            >
              <p className="text-xs text-gray-500 dark:text-gray-400">اليوم · {opt.label}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">{formatNumber(todayValue)}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-primary-600" />
            مكالمات كل مشترك
          </h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={statsSearch}
              onChange={(e) => setStatsSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setAppliedStatsSearch(statsSearch.trim());
                  setStatsPage(1);
                }
              }}
              placeholder="بحث عن مشترك..."
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm"
            />
            <button
              type="button"
              onClick={() => {
                setAppliedStatsSearch(statsSearch.trim());
                setStatsPage(1);
              }}
              className="px-3 py-2 text-sm rounded-md bg-gray-100 dark:bg-gray-700"
            >
              بحث
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-right">
            <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3 font-medium">المشترك</th>
                <th className="px-4 py-3 font-medium">اسم المستخدم</th>
                <th className="px-4 py-3 font-medium">الهاتف</th>
                <th className="px-4 py-3 font-medium">عدد المكالمات</th>
                <th className="px-4 py-3 font-medium">آخر اتصال</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {(statsQuery.data?.data ?? []).map((row) => (
                <tr key={row.subscriberId} className="text-sm text-gray-800 dark:text-gray-200">
                  <td className="px-4 py-3">{row.displayName || '—'}</td>
                  <td className="px-4 py-3">{row.username || '—'}</td>
                  <td className="px-4 py-3">{row.phoneNumber || '—'}</td>
                  <td className="px-4 py-3 font-semibold">{formatNumber(row.callsCount)}</td>
                  <td className="px-4 py-3">{row.lastCallAt ? formatDate(row.lastCallAt) : '—'}</td>
                </tr>
              ))}
              {!statsQuery.isLoading && (statsQuery.data?.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                    لا توجد مكالمات مسجّلة بعد
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={statsQuery.data?.currentPage ?? statsPage}
          totalPages={Math.max(1, statsQuery.data?.totalPages ?? 1)}
          totalItems={statsQuery.data?.totalItems ?? 0}
          pageSize={statsQuery.data?.pageSize ?? 10}
          hasNextPage={statsQuery.data?.hasNextPage ?? false}
          hasPreviousPage={statsQuery.data?.hasPreviousPage ?? false}
          onPageChange={setStatsPage}
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">تكتات الاتصال</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-right">
            <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3 font-medium">رقم التكت</th>
                <th className="px-4 py-3 font-medium">المشترك</th>
                <th className="px-4 py-3 font-medium">مكالمات المشترك</th>
                <th className="px-4 py-3 font-medium">نوع الاتصال</th>
                <th className="px-4 py-3 font-medium">الوصف</th>
                <th className="px-4 py-3 font-medium">سجّله</th>
                <th className="px-4 py-3 font-medium">التاريخ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="text-sm text-gray-800 dark:text-gray-200 align-top">
                  <td className="px-4 py-3 font-mono text-xs">{ticket.ticketNumber}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{ticket.subscriberDisplayName || '—'}</div>
                    <div className="text-xs text-gray-500">
                      {ticket.subscriberUsername || ''}
                      {ticket.subscriberPhone ? ` · ${ticket.subscriberPhone}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3">{formatNumber(ticket.subscriberCallCount)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs ${callTypeBadgeClass(ticket.callType)}`}>
                      {ticket.callTypeLabel || callTypeLabel(ticket.callType)}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-xs whitespace-pre-wrap">{ticket.description}</td>
                  <td className="px-4 py-3">{ticket.createdByUserName || '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{ticket.createdAt ? formatDate(ticket.createdAt) : '—'}</td>
                </tr>
              ))}
              {!ticketsQuery.isLoading && tickets.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                    لا توجد تكتات اتصال
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={ticketsQuery.data?.currentPage ?? page}
          totalPages={Math.max(1, ticketsQuery.data?.totalPages ?? 1)}
          totalItems={ticketsQuery.data?.totalItems ?? 0}
          pageSize={pageSize}
          hasNextPage={ticketsQuery.data?.hasNextPage ?? false}
          hasPreviousPage={ticketsQuery.data?.hasPreviousPage ?? false}
          onPageChange={setPage}
          pageSizeOptions={[...STANDARD_PAGE_SIZE_OPTIONS]}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3">
          <div className="w-full max-w-xl bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">فتح تكت اتصال</h3>
              <button
                type="button"
                onClick={closeCreateModal}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="space-y-2 rounded-md border border-gray-200 dark:border-gray-700 p-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  المشترك الذي اتصل *
                </label>
                {selectedSubscriber ? (
                  <div className="flex items-center justify-between gap-2 rounded-md bg-primary-50 dark:bg-primary-900/20 px-3 py-2">
                    <div className="text-sm">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {selectedSubscriber.displayName}
                      </div>
                      <div className="text-xs text-gray-500">
                        {selectedSubscriber.username}
                        {selectedSubscriber.phoneNumber ? ` · ${selectedSubscriber.phoneNumber}` : ''}
                        {selectedSubscriber.callsCount
                          ? ` · ${formatNumber(selectedSubscriber.callsCount)} مكالمة سابقة`
                          : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSubscriber(null);
                        setForm((p) => ({ ...p, subscriberId: '' }));
                      }}
                      className="text-xs text-red-600"
                    >
                      تغيير
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      value={subscriberSearch}
                      onChange={(e) => {
                        setSubscriberSearch(e.target.value);
                        setSubscriberPage(1);
                        setSubscriberOptions([]);
                      }}
                      placeholder="ابحث بالاسم أو المستخدم أو الهاتف..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    />
                    <div className="max-h-48 overflow-auto rounded-md border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                      {subscriberOptions.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setSelectedSubscriber(s);
                            setForm((p) => ({ ...p, subscriberId: s.id }));
                          }}
                          className="w-full text-right px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/40"
                        >
                          <div className="text-sm text-gray-900 dark:text-white">{s.displayName}</div>
                          <div className="text-xs text-gray-500">
                            {s.username}
                            {s.phoneNumber ? ` · ${s.phoneNumber}` : ''}
                            {s.callsCount ? ` · ${formatNumber(s.callsCount)} مكالمة` : ''}
                          </div>
                        </button>
                      ))}
                      {subscribersLoading && (
                        <p className="px-3 py-2 text-xs text-gray-500">جاري تحميل المشتركين...</p>
                      )}
                      {!subscribersLoading && subscriberOptions.length === 0 && (
                        <p className="px-3 py-2 text-xs text-gray-500">لا توجد نتائج</p>
                      )}
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setSubscriberPage((p) => p + 1)}
                        disabled={subscribersLoading || !(subscribersResponse?.hasNextPage ?? false)}
                        className="px-2.5 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 disabled:opacity-50"
                      >
                        تحميل المزيد
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">نوع الاتصال *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {CALL_TYPE_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const active = form.callType === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, callType: opt.value }))}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm ${
                          active
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                            : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  وصف الاتصال *
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  rows={4}
                  placeholder="اكتب وصفاً من كلمتين على الأقل..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                />
                <p className={`text-xs ${wordCount < 2 ? 'text-red-500' : 'text-gray-500'}`}>
                  {wordCount < 2
                    ? `يجب إدخال كلمتين على الأقل (حالياً: ${formatNumber(wordCount)})`
                    : `${formatNumber(wordCount)} كلمة`}
                </p>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeCreateModal}
                className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={submitTicket}
                disabled={createMutation.isPending}
                className="px-4 py-2 rounded-md bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-60"
              >
                {createMutation.isPending ? 'جاري الحفظ...' : 'تسجيل التكت'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallCenterPage;
