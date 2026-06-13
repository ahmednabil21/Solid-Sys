import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { useAuth } from '../contexts/AuthContext';
import { useDigits } from '../contexts/DigitsContext';
import { apiService } from '../services/api';
import {
  AgentSubscriberMaintenanceRequestDto,
  SubscriberAppProblemType,
  SubscriberMaintenanceRequestStatusCode,
  UserRole,
} from '../types';
import { showError, showSuccess } from '../utils/notifications';
import { CheckCircle2, Phone, RefreshCw, User, Wrench } from 'lucide-react';
import notificationSound from '../sounds/universfield-new-notification-022-370046.mp3';

const DASHBOARD_MAINTENANCE_AGENT_KEY = 'wakeel_maintenance_requests_agentId';

const PROBLEM_TYPE_LABELS: Record<number, string> = {
  [SubscriberAppProblemType.SubscriptionRenewal]: 'تجديد اشتراك',
  [SubscriberAppProblemType.WeakInternet]: 'ضعف بالانترنت',
  [SubscriberAppProblemType.NetworkPasswordChange]: 'تغيير رمز الشبكة',
  [SubscriberAppProblemType.CableCut]: 'قطع في الكيبل',
  [SubscriberAppProblemType.Other]: 'أخرى',
};

const STATUS_LABELS: Record<number, string> = {
  [SubscriberMaintenanceRequestStatusCode.Pending]: 'قيد الانتظار',
  [SubscriberMaintenanceRequestStatusCode.InProgress]: 'قيد المعالجة',
  [SubscriberMaintenanceRequestStatusCode.Completed]: 'مكتمل',
  [SubscriberMaintenanceRequestStatusCode.Cancelled]: 'ملغي',
};

const problemTypeLabel = (req: AgentSubscriberMaintenanceRequestDto) =>
  req.problemTypeLabel || PROBLEM_TYPE_LABELS[Number(req.problemType)] || '—';

const statusLabel = (req: AgentSubscriberMaintenanceRequestDto) =>
  req.statusLabel || STATUS_LABELS[Number(req.status)] || '—';

const statusBadgeClass = (status: number) => {
  if (status === SubscriberMaintenanceRequestStatusCode.Pending) {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  }
  if (status === SubscriberMaintenanceRequestStatusCode.InProgress) {
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
  }
  if (status === SubscriberMaintenanceRequestStatusCode.Completed) {
    return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
  }
  return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
};

const maintenanceQueryKey = (status: '' | number, agentId?: string) =>
  ['agent-subscriber-maintenance', status === '' ? null : status, agentId ?? null] as const;

const matchesStatusFilter = (req: AgentSubscriberMaintenanceRequestDto, status: '' | number) =>
  status === '' || Number(req.status) === status;

const SubscriberMaintenanceRequestsPage: React.FC = () => {
  const { user } = useAuth();
  const { formatDate } = useDigits();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === UserRole.Admin;

  const [statusFilter, setStatusFilter] = useState<'' | SubscriberMaintenanceRequestStatusCode>('');
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const signalRConnectionRef = useRef<HubConnection | null>(null);
  const statusFilterRef = useRef(statusFilter);
  useEffect(() => {
    statusFilterRef.current = statusFilter;
  }, [statusFilter]);

  useEffect(() => {
    audioRef.current = new Audio(notificationSound);
  }, []);

  const { data: agentsResponse } = useQuery({
    queryKey: ['agents-for-maintenance', 1, 100],
    queryFn: () => apiService.getAllAgents({ page: 1, pageSize: 100 }),
    enabled: isAdmin,
  });
  const agents = useMemo(() => agentsResponse?.data ?? [], [agentsResponse]);

  const { data: myAgent } = useQuery({
    queryKey: ['my-agent-maintenance'],
    queryFn: () => apiService.getMyAgent(),
    enabled: !isAdmin,
  });

  useEffect(() => {
    if (!isAdmin || !agents.length) return;
    const saved = localStorage.getItem(DASHBOARD_MAINTENANCE_AGENT_KEY);
    if (saved && agents.some((a) => a.id === saved)) {
      setSelectedAgentId(saved);
    } else {
      setSelectedAgentId(agents[0]?.id ?? '');
    }
  }, [isAdmin, agents]);

  useEffect(() => {
    if (!isAdmin || !selectedAgentId) return;
    localStorage.setItem(DASHBOARD_MAINTENANCE_AGENT_KEY, selectedAgentId);
  }, [isAdmin, selectedAgentId]);

  const effectiveAgentId = isAdmin ? selectedAgentId : myAgent?.id;
  const canLoadData = isAdmin ? !!effectiveAgentId : true;

  const queryParams = useMemo(
    () => ({
      status: statusFilter === '' ? undefined : statusFilter,
      agentId: isAdmin ? effectiveAgentId || undefined : undefined,
    }),
    [statusFilter, isAdmin, effectiveAgentId]
  );

  const { data: requests = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: maintenanceQueryKey(statusFilter, queryParams.agentId),
    queryFn: () => apiService.getAgentSubscriberMaintenanceRequests(queryParams),
    enabled: canLoadData,
  });

  const upsertRequestInCache = useCallback((request: AgentSubscriberMaintenanceRequestDto) => {
    queryClient.setQueriesData<AgentSubscriberMaintenanceRequestDto[]>(
      { queryKey: ['agent-subscriber-maintenance'] },
      (old) => {
        if (!old) return old;
        const filter = statusFilterRef.current;
        const idx = old.findIndex((r) => r.id === request.id);
        if (idx >= 0) {
          if (!matchesStatusFilter(request, filter)) {
            return old.filter((r) => r.id !== request.id);
          }
          const next = [...old];
          next[idx] = request;
          return next;
        }
        if (!matchesStatusFilter(request, filter)) return old;
        return [request, ...old];
      }
    );
  }, [queryClient]);

  useEffect(() => {
    if (!effectiveAgentId) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    const baseUrl = apiService.getBaseURL();
    const hubUrl = `${baseUrl.replace(/\/api\/?$/, '')}/hubs/dashboard`;

    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl, { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    signalRConnectionRef.current = connection;

    const playNotificationSound = () => {
      try {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          const p = audioRef.current.play();
          if (p && typeof (p as Promise<void>).catch === 'function') {
            (p as Promise<void>).catch(() => {});
          }
        }
      } catch {
        // ignore
      }
    };

    connection.on('subscriberMaintenanceRequestCreated', (payload: unknown) => {
      const request = payload as AgentSubscriberMaintenanceRequestDto;
      if (!request?.id) return;
      playNotificationSound();
      showSuccess(
        'طلب صيانة جديد',
        `طلب من ${request.subscriberFullName || request.subscriberUsername || 'مشترك'}`
      );
      upsertRequestInCache(request);
    });

    connection.on('subscriberMaintenanceRequestUpdated', (payload: unknown) => {
      const request = payload as AgentSubscriberMaintenanceRequestDto;
      if (!request?.id) return;
      upsertRequestInCache(request);
    });

    const joinGroup = async () => {
      try {
        await connection.invoke('JoinAgentGroup', effectiveAgentId);
      } catch {
        // ignore
      }
    };

    connection.onreconnected(joinGroup);

    connection
      .start()
      .then(joinGroup)
      .catch(() => {
        // ignore
      });

    return () => {
      signalRConnectionRef.current = null;
      (async () => {
        try {
          await connection.stop();
        } catch {
          // ignore
        }
      })();
    };
  }, [effectiveAgentId, upsertRequestInCache]);

  const acceptMutation = useMutation({
    mutationFn: (id: string) => apiService.acceptSubscriberMaintenanceRequest(id),
    onMutate: (id) => setAcceptingId(id),
    onSuccess: (updated) => {
      upsertRequestInCache(updated);
      showSuccess('تم القبول', 'تم قبول طلب الصيانة وتحويله إلى قيد المعالجة');
    },
    onError: (err: Error) => {
      showError('فشل القبول', err.message || 'تعذّر قبول الطلب');
    },
    onSettled: () => setAcceptingId(null),
  });

  const pendingCount = requests.filter(
    (r) => Number(r.status) === SubscriberMaintenanceRequestStatusCode.Pending
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Wrench className="h-7 w-7 text-primary-600" />
            طلبات صيانة المشتركين
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            متابعة طلبات الصيانة الواردة من تطبيق المشترك
            {pendingCount > 0 ? ` · ${pendingCount} بانتظار القبول` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md text-gray-700 dark:text-gray-200 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          تحديث
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {isAdmin && (
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
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
          <select
            value={statusFilter}
            onChange={(e) => {
              const v = e.target.value;
              setStatusFilter(v === '' ? '' : (parseInt(v, 10) as SubscriberMaintenanceRequestStatusCode));
            }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
          >
            <option value="">كل الحالات</option>
            <option value={SubscriberMaintenanceRequestStatusCode.Pending}>قيد الانتظار</option>
            <option value={SubscriberMaintenanceRequestStatusCode.InProgress}>قيد المعالجة</option>
            <option value={SubscriberMaintenanceRequestStatusCode.Completed}>مكتمل</option>
            <option value={SubscriberMaintenanceRequestStatusCode.Cancelled}>ملغي</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {isAdmin && !effectiveAgentId ? (
          <div className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">
            يرجى اختيار الوكيل لعرض الطلبات.
          </div>
        ) : isLoading ? (
          <div className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">جاري التحميل...</div>
        ) : requests.length === 0 ? (
          <div className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">
            لا توجد طلبات صيانة.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300">المشترك</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300">المنطقة / الرسيلر</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300">نوع المشكلة</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300">الوصف</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300">الهاتف</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300">الحالة</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300">التاريخ</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {requests.map((req) => {
                  const statusNum = Number(req.status);
                  const isPending = statusNum === SubscriberMaintenanceRequestStatusCode.Pending;
                  const phone = req.alternativePhoneNumber || req.subscriberPhoneNumber;

                  return (
                    <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white truncate">
                              {req.subscriberFullName || '—'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate" dir="ltr">
                              {req.subscriberUsername || '—'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                        <p className="truncate">{req.regionName || '—'}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                          {req.agentResellerName || '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">
                        {problemTypeLabel(req)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 max-w-[200px]">
                        <p className="truncate" title={req.description || undefined}>
                          {req.description || '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                        {phone ? (
                          <span className="inline-flex items-center gap-1" dir="ltr">
                            <Phone className="h-3.5 w-3.5 text-gray-400" />
                            {phone}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadgeClass(statusNum)}`}>
                          {statusLabel(req)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                        {req.createdAt ? formatDate(req.createdAt) : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isPending ? (
                          <button
                            type="button"
                            onClick={() => acceptMutation.mutate(req.id)}
                            disabled={acceptingId === req.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-60"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            {acceptingId === req.id ? 'جاري...' : 'قبول'}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriberMaintenanceRequestsPage;
