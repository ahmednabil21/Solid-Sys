import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import Pagination from '../components/Pagination';
import { useAuth } from '../contexts/AuthContext';
import { useDigits } from '../contexts/DigitsContext';
import { apiService, ApiService } from '../services/api';
import {
  EmployeeTaskStatus,
  EmployeeTaskType,
  SubscriberMaintenanceKind,
  UserRole,
} from '../types';
import type {
  EmployeeTask,
  EmployeeTaskCompleteInstallationRequest,
  EmployeeTaskCompleteMaintenanceRequest,
  EmployeeTaskCompleteAmountReceptionRequest,
  EmployeeTaskCreateRequest,
  EmployeeTaskCreateBatchResponse,
  EmployeeTaskUpdateRequest,
  EmployeeTaskSubscriberOption,
  PaginatedResponse,
  User,
} from '../types';
import { showError, showInfo, showSuccess } from '../utils/notifications';
import { CheckCircle2, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import notificationSound from '../sounds/universfield-new-notification-022-370046.mp3';
import { ensureWebPushSubscribed } from '../utils/pushNotifications';

const taskTypeLabel = (type: EmployeeTaskType) => {
  if (type === EmployeeTaskType.SubscriberInstallation) return 'تنصيب مشترك';
  if (type === EmployeeTaskType.SubscriberMaintenance) return 'صيانة مشترك';
  if (type === EmployeeTaskType.AmountReception) return 'استلام مبلغ';
  return 'اخرى';
};

const maintenanceKindLabel = (kind?: SubscriberMaintenanceKind | null) => {
  if (!kind) return '—';
  if (kind === SubscriberMaintenanceKind.CableCut) return 'قطع كيبل';
  if (kind === SubscriberMaintenanceKind.ServiceProblem) return 'مشكلة في الخدمة';
  if (kind === SubscriberMaintenanceKind.RouterPasswordChange) return 'تغيير رمز الراوتر';
  return 'اخرى';
};

const statusLabel = (status: EmployeeTaskStatus) => {
  if (status === EmployeeTaskStatus.Pending) return 'معلقة';
  if (status === EmployeeTaskStatus.Accepted) return 'مقبولة';
  return 'مكتملة';
};

function parseTaskIdFromReassignedAway(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    const s = raw.trim();
    return s || null;
  }
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const id = o.taskId ?? o.TaskId;
    if (typeof id === 'string' && id.trim()) return id.trim();
  }
  return null;
}

const statusBadgeClass = (status: EmployeeTaskStatus) => {
  if (status === EmployeeTaskStatus.Pending) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  if (status === EmployeeTaskStatus.Accepted) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
  return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
};

const formatTaskDate = (value?: string | null) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).split('T')[0] || '—';
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Baghdad' }); // yyyy-MM-dd
};

const EmployeeTasksPage: React.FC = () => {
  const { user } = useAuth();
  const { formatNumber } = useDigits();
  const queryClient = useQueryClient();
  const isEmployee = user?.role === UserRole.Employee;
  const canManage = user?.role === UserRole.Admin || user?.role === UserRole.Agent || user?.role === UserRole.SubAgent;
  const isAdmin = user?.role === UserRole.Admin;

  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [status, setStatus] = useState<EmployeeTaskStatus | ''>('');
  const [agentId, setAgentId] = useState('');
  const [pushReady, setPushReady] = useState<boolean>(false);
  const [pushBusy, setPushBusy] = useState<boolean>(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<EmployeeTask | null>(null);

  const [createForm, setCreateForm] = useState<EmployeeTaskCreateRequest>({
    employeeUserId: '',
    taskType: EmployeeTaskType.SubscriberInstallation,
    subscriberId: '',
    maintenanceType: SubscriberMaintenanceKind.CableCut,
    amountReceived: undefined,
    taskTitle: '',
    note: '',
  });
  const [completeForm, setCompleteForm] = useState<EmployeeTaskCompleteInstallationRequest>({
    subscriberName: '',
    subscriberPhone: '',
    signalNumber: '',
    note: '',
  });
  const [completeMaintenanceForm, setCompleteMaintenanceForm] = useState<EmployeeTaskCompleteMaintenanceRequest>({
    note: '',
  });
  const [completeAmountReceptionForm, setCompleteAmountReceptionForm] =
    useState<EmployeeTaskCompleteAmountReceptionRequest>({
      amountReceived: 0,
      note: '',
    });

  // EmployeeTaskSubscriber dropdown (for SubscriberMaintenance)
  const [subscriberSearch, setSubscriberSearch] = useState('');
  const [subscriberSearchDebounced, setSubscriberSearchDebounced] = useState('');
  const [subscriberPage, setSubscriberPage] = useState(1);
  const [subscriberOptions, setSubscriberOptions] = useState<EmployeeTaskSubscriberOption[]>([]);
  const [amountReceptionSubscriberIds, setAmountReceptionSubscriberIds] = useState<string[]>([]);
  /** قائمة المشتركين: ذوو الدين فقط (GET …?debtOnly=true) */
  const [subscriberDebtOnly, setSubscriberDebtOnly] = useState(false);
  /** وضع استلام الديون: الخادم يفضّل أصحاب الديون، ومع fallback قد يُرجع كل المشتركين */
  const [debtCollection, setDebtCollection] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSubscriberSearchDebounced(subscriberSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [subscriberSearch]);

  const {
    data: subscribersResponse,
    isFetching: subscribersLoading,
  } = useQuery({
    queryKey: [
      'employee-task-subscribers',
      isAdmin ? agentId.trim() : 'me',
      subscriberPage,
      subscriberSearchDebounced,
      subscriberDebtOnly,
    ],
    queryFn: async () => {
      if (isAdmin) {
        return apiService.getEmployeeTaskSubscribers({
          page: subscriberPage,
          pageSize: subscriberDebtOnly ? 50 : 10,
          searchTerm: subscriberSearchDebounced || undefined,
          agentId: agentId.trim() || undefined,
          debtOnly: subscriberDebtOnly ? true : undefined,
        });
      }

      const subscribers = await apiService.getSubscribers({
        page: subscriberPage,
        pageSize: 165,
        search: subscriberSearchDebounced || undefined,
      });

      return {
        ...subscribers,
        data: (subscribers.data ?? []).map((s) => ({
          id: s.id,
          username: s.username,
          displayName: s.fullName || [s.firstName, s.lastName].filter(Boolean).join(' ').trim() || s.username,
          phoneNumber: s.phoneNumber,
          totalDebt: s.totalDebt ?? 0,
        })),
      };
    },
    enabled:
      (showCreateModal || showEditModal) &&
      (createForm.taskType === EmployeeTaskType.SubscriberMaintenance ||
        createForm.taskType === EmployeeTaskType.AmountReception) &&
      (!isAdmin || !!agentId.trim()),
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
      const merged = [...prev];
      for (const item of incoming) {
        if (!seen.has(item.id)) merged.push(item);
      }
      return merged;
    });
  }, [subscribersResponse, subscriberPage]);

  const taskQueryParams = useMemo(
    () => ({
      page,
      pageSize,
      searchTerm: searchTerm.trim() || undefined,
      status: status === '' ? undefined : status,
      agentId: isAdmin ? agentId.trim() || undefined : undefined,
    }),
    [page, pageSize, searchTerm, status, isAdmin, agentId]
  );

  const taskQueryParamsRef = useRef(taskQueryParams);
  useEffect(() => {
    taskQueryParamsRef.current = taskQueryParams;
  }, [taskQueryParams]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    audioRef.current = new Audio(notificationSound);
  }, []);

  const signalRConnectionRef = useRef<HubConnection | null>(null);

  const { data: myEmployees = [] } = useQuery<User[]>({
    queryKey: ['my-employees-for-tasks'],
    queryFn: () => apiService.getMyEmployees(),
    enabled: canManage && !isAdmin,
  });

  const { data: adminEmployees = [] } = useQuery<User[]>({
    queryKey: ['agent-employees-for-tasks', agentId.trim()],
    queryFn: () => apiService.getAgentEmployees(agentId.trim()),
    enabled: canManage && isAdmin && !!agentId.trim(),
  });

  const employeesOptions = isAdmin ? adminEmployees : myEmployees;

  const { data: tasksResponse, isLoading, refetch } = useQuery({
    queryKey: ['employee-tasks', isEmployee ? 'my' : 'agent', taskQueryParams],
    queryFn: () => (isEmployee ? apiService.getMyEmployeeTasks(taskQueryParams) : apiService.getAgentEmployeeTasks(taskQueryParams)),
    enabled: !!user && (isEmployee || canManage) && (!isAdmin || !!taskQueryParams.agentId),
  });

  // SignalR: إشعارات المهام الجديدة للموظف فقط
  useEffect(() => {
    if (!isEmployee) return;
    if (!user?.canReceiveTaskRequests) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    const baseUrl = apiService.getBaseURL();
    const hubUrl = `${baseUrl.replace(/\/api\/?$/, '')}/hubs/dashboard`;

    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => token,
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    signalRConnectionRef.current = connection;

    connection.on('employeeTaskReassignedAway', (payload: unknown) => {
      const taskId = parseTaskIdFromReassignedAway(payload);
      if (!taskId) return;

      showInfo('إعادة تعيين', 'أُعيدت المهمة إلى موظف آخر وستُزال من قائمتك.');

      queryClient.setQueriesData<PaginatedResponse<EmployeeTask>>(
        { queryKey: ['employee-tasks', 'my'] },
        (old) => {
          if (!old?.data?.length) return old;
          const nextData = old.data.filter((t) => t.id !== taskId);
          if (nextData.length === old.data.length) return old;
          const removed = old.data.length - nextData.length;
          const newTotalItems = Math.max(0, old.totalItems - removed);
          const newTotalPages = Math.max(1, Math.ceil(newTotalItems / (old.pageSize || 1)));
          const currentPage = old.currentPage ?? old.pageNumber ?? 1;
          return {
            ...old,
            data: nextData,
            totalItems: newTotalItems,
            totalPages: newTotalPages,
            hasNextPage: currentPage < newTotalPages,
            hasPreviousPage: currentPage > 1,
          };
        }
      );
    });

    connection.on('employeeTaskAssignedBatch', (payload: unknown) => {
      const list: EmployeeTask[] = Array.isArray(payload)
        ? (payload as EmployeeTask[])
        : ((payload as { tasks?: EmployeeTask[] })?.tasks ?? []);
      if (!list.length) return;
      try {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          const p = audioRef.current.play();
          if (p && typeof (p as any).catch === 'function') (p as any).catch(() => {});
        }
      } catch {
        // ignore
      }
      const debtLike = list.some(
        (t) =>
          (t.taskTitle && String(t.taskTitle).includes('ديون')) ||
          (t.note && String(t.note).includes('ديون')) ||
          (t.taskDetails && String(t.taskDetails).includes('ديون'))
      );
      showSuccess(
        debtLike ? 'استلام ديون' : 'مهام جديدة',
        debtLike ? `وصلتك ${list.length} مهمة استلام ديون.` : `وصلتك ${list.length} مهمة جديدة.`
      );

      const qp = taskQueryParamsRef.current;
      if (qp.page !== 1) return;

      const term = qp.searchTerm?.toString().trim().toLowerCase();

      const queryKey: any = ['employee-tasks', 'my', qp];
      queryClient.setQueryData<PaginatedResponse<EmployeeTask>>(queryKey, (old) => {
        if (!old) return old;
        let nextData = [...(old.data ?? [])];
        let added = 0;
        for (const task of list) {
          if (qp.status != null && task.status !== qp.status) continue;
          if (term) {
            const hay = `${task.taskTitle ?? ''} ${task.note ?? ''} ${task.taskDetails ?? ''}`.toLowerCase();
            if (!hay.includes(term)) continue;
          }
          if (nextData.some((t) => t.id === task.id)) continue;
          nextData = [task, ...nextData];
          added += 1;
        }
        if (added === 0) return old;
        nextData = nextData.slice(0, old.pageSize);
        const newTotalItems = old.totalItems + added;
        const newTotalPages = Math.max(1, Math.ceil(newTotalItems / old.pageSize));
        const currentPage = old.currentPage ?? old.pageNumber ?? 1;
        return {
          ...old,
          data: nextData,
          totalItems: newTotalItems,
          totalPages: newTotalPages,
          hasNextPage: currentPage < newTotalPages,
          hasPreviousPage: currentPage > 1,
          currentPage,
        };
      });
    });

    connection.on('employeeTaskAssigned', (task: EmployeeTask) => {
      // تشغيل صوت (قد يفشل في المتصفحات عند عدم وجود تفاعل مستخدم)
      try {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          const p = audioRef.current.play();
          if (p && typeof (p as any).catch === 'function') (p as any).catch(() => {});
        }
      } catch {
        // ignore
      }

      showSuccess('مهمة جديدة', taskTypeLabel(task.taskType));

      const qp = taskQueryParamsRef.current;
      if (qp.page !== 1) return;
      if (qp.status != null && task.status !== qp.status) return;

      const term = qp.searchTerm?.toString().trim().toLowerCase();
      if (term) {
        const hay = `${task.taskTitle ?? ''} ${task.note ?? ''}`.toLowerCase();
        if (!hay.includes(term)) return;
      }

      const queryKey: any = ['employee-tasks', 'my', qp];
      queryClient.setQueryData<PaginatedResponse<EmployeeTask>>(queryKey, (old) => {
        if (!old) return old;
        if (old.data.some((t) => t.id === task.id)) return old;

        const newTotalItems = old.totalItems + 1;
        const newTotalPages = Math.max(1, Math.ceil(newTotalItems / old.pageSize));

        const nextData = [task, ...(old.data ?? [])].slice(0, old.pageSize);

        return {
          ...old,
          data: nextData,
          totalItems: newTotalItems,
          totalPages: newTotalPages,
          hasNextPage: qp.page < newTotalPages,
          hasPreviousPage: qp.page > 1,
          currentPage: qp.page,
        };
      });
    });

    connection.onreconnected(async () => {
      try {
        await connection.invoke('JoinEmployeeTasksGroup');
      } catch {
        // ignore
      }
    });

    connection
      .start()
      .then(async () => {
        await connection.invoke('JoinEmployeeTasksGroup');
      })
      .catch(() => {
        // ignore
      });

    return () => {
      // Leave group on exit
      (async () => {
        try {
          await connection.invoke('LeaveEmployeeTasksGroup');
        } catch {
          // ignore
        }
        try {
          await connection.stop();
        } catch {
          // ignore
        }
      })();
      signalRConnectionRef.current = null;
    };
  }, [isEmployee, user?.canReceiveTaskRequests, user?.id, queryClient]);

  useEffect(() => {
    if (!isEmployee) return;
    if (!user?.canReceiveTaskRequests) return;
    setPushReady(typeof Notification !== 'undefined' && Notification.permission === 'granted');
  }, [isEmployee, user?.canReceiveTaskRequests]);

  const createMutation = useMutation({
    mutationFn: (payload: EmployeeTaskCreateRequest) => apiService.createEmployeeTask(payload),
    onSuccess: (data) => {
      const batch = data as EmployeeTaskCreateBatchResponse;
      if (batch && Array.isArray(batch.tasks)) {
        showSuccess('تمت الإضافة', batch.message ?? `تم إنشاء ${batch.tasks.length} مهمة.`);
      } else {
        showSuccess('تمت الإضافة', 'تم إنشاء المهمة بنجاح.');
      }
      setShowCreateModal(false);
      setSubscriberSearch('');
      setSubscriberSearchDebounced('');
      setSubscriberPage(1);
      setSubscriberOptions([]);
      setSubscriberDebtOnly(false);
      setDebtCollection(false);
      setCreateForm({
        employeeUserId: '',
        taskType: EmployeeTaskType.SubscriberInstallation,
        subscriberId: '',
        maintenanceType: SubscriberMaintenanceKind.CableCut,
        amountReceived: undefined,
        taskTitle: '',
        note: '',
      });
      setAmountReceptionSubscriberIds([]);
      queryClient.invalidateQueries({ queryKey: ['employee-tasks'] });
    },
    onError: (err) => showError('خطأ', ApiService.showError(err)),
  });

  const buildUpdatePayload = (payload: EmployeeTaskCreateRequest): EmployeeTaskUpdateRequest => {
    const trimmed: EmployeeTaskUpdateRequest = {
      taskType: payload.taskType,
      note: payload.note?.trim() || undefined,
    };
    const empId = payload.employeeUserId?.trim();
    if (empId) trimmed.employeeUserId = empId;

    if (payload.taskType === EmployeeTaskType.SubscriberInstallation) {
      const subscriberId = payload.subscriberId?.trim();
      if (subscriberId) trimmed.subscriberId = subscriberId;
      return trimmed;
    }
    if (payload.taskType === EmployeeTaskType.SubscriberMaintenance) {
      const subscriberId = payload.subscriberId?.trim();
      if (subscriberId) trimmed.subscriberId = subscriberId;
      trimmed.maintenanceType = payload.maintenanceType;
      return trimmed;
    }
    if (payload.taskType === EmployeeTaskType.Other) {
      const taskTitle = payload.taskTitle?.trim();
      if (taskTitle) trimmed.taskTitle = taskTitle;
      return trimmed;
    }
    if (payload.taskType === EmployeeTaskType.AmountReception) {
      const subscriberId = payload.subscriberId?.trim();
      if (subscriberId) trimmed.subscriberId = subscriberId;
      if (payload.amountReceived != null && !Number.isNaN(payload.amountReceived)) {
        trimmed.amountReceived = payload.amountReceived;
      }
      return trimmed;
    }
    return trimmed;
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: EmployeeTaskUpdateRequest }) =>
      apiService.updateEmployeeTask(id, payload),
    onSuccess: () => {
      showSuccess('تم التعديل', 'تم تعديل المهمة بنجاح.');
      setShowEditModal(false);
      setSelectedTask(null);
      setSubscriberSearch('');
      setSubscriberSearchDebounced('');
      setSubscriberPage(1);
      setSubscriberOptions([]);
      queryClient.invalidateQueries({ queryKey: ['employee-tasks'] });
    },
    onError: (err) => showError('خطأ', ApiService.showError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteEmployeeTask(id),
    onSuccess: () => {
      showSuccess('تم الحذف', 'تم حذف المهمة بنجاح.');
      queryClient.invalidateQueries({ queryKey: ['employee-tasks'] });
    },
    onError: (err) => showError('خطأ', ApiService.showError(err)),
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => apiService.acceptEmployeeTask(id),
    onSuccess: () => {
      showSuccess('تم القبول', 'تم قبول المهمة.');
      queryClient.invalidateQueries({ queryKey: ['employee-tasks'] });
    },
    onError: (err) => showError('خطأ', ApiService.showError(err)),
  });

  const completeInstallationMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: EmployeeTaskCompleteInstallationRequest }) =>
      apiService.completeEmployeeInstallationTask(id, payload),
    onSuccess: () => {
      showSuccess('تم الإكمال', 'تم إكمال مهمة التنصيب بنجاح.');
      setShowCompleteModal(false);
      setSelectedTask(null);
      queryClient.invalidateQueries({ queryKey: ['employee-tasks'] });
    },
    onError: (err) => showError('خطأ', ApiService.showError(err)),
  });

  const completeMaintenanceMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: EmployeeTaskCompleteMaintenanceRequest }) =>
      apiService.completeEmployeeMaintenanceTask(id, payload),
    onSuccess: () => {
      showSuccess('تم الإكمال', 'تم إكمال مهمة الصيانة بنجاح.');
      setShowCompleteModal(false);
      setSelectedTask(null);
      queryClient.invalidateQueries({ queryKey: ['employee-tasks'] });
    },
    onError: (err) => showError('خطأ', ApiService.showError(err)),
  });

  const completeAmountReceptionMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: EmployeeTaskCompleteAmountReceptionRequest;
    }) => apiService.completeEmployeeAmountReceptionTask(id, payload),
    onSuccess: () => {
      showSuccess('تم الإكمال', 'تم إكمال مهمة استلام المبلغ بنجاح.');
      setShowCompleteModal(false);
      setSelectedTask(null);
      queryClient.invalidateQueries({ queryKey: ['employee-tasks'] });
    },
    onError: (err) => showError('خطأ', ApiService.showError(err)),
  });

  const rows = tasksResponse?.data ?? [];
  const currentPage = tasksResponse?.currentPage ?? tasksResponse?.pageNumber ?? 1;
  const totalItems = tasksResponse?.totalItems ?? tasksResponse?.totalCount ?? 0;
  const totalPages = tasksResponse?.totalPages ?? 1;
  const hasNextPage = tasksResponse?.hasNextPage ?? currentPage < totalPages;
  const hasPreviousPage = tasksResponse?.hasPreviousPage ?? currentPage > 1;

  const validateCreatePayload = (payload: EmployeeTaskCreateRequest): string | null => {
    if (!payload.employeeUserId?.trim()) return 'اختر الموظف.';
    /** استلام مبلغ عند الإنشاء: المشتركون من checkboxes → amountReceptionSubscriberIds وليس subscriberId */
    const skipGenericSubscriberCheck =
      payload.taskType === EmployeeTaskType.AmountReception && showCreateModal;
    if (!payload.subscriberId?.trim() && payload.taskType !== EmployeeTaskType.Other && !skipGenericSubscriberCheck) {
      return 'اختر المشترك.';
    }
    if (payload.taskType === EmployeeTaskType.SubscriberInstallation && !payload.subscriberId?.trim()) {
      return 'تنصيب مشترك يتطلب SubscriberId.';
    }
    if (payload.taskType === EmployeeTaskType.SubscriberMaintenance) {
      if (!payload.subscriberId?.trim()) return 'صيانة مشترك تتطلب SubscriberId.';
      if (!payload.maintenanceType) return 'صيانة مشترك تتطلب MaintenanceType.';
    }
    if (payload.taskType === EmployeeTaskType.AmountReception) {
      if (showCreateModal) {
        if (amountReceptionSubscriberIds.length === 0) return 'اختر مشتركاً واحداً على الأقل.';
      } else if (!payload.subscriberId?.trim()) {
        return 'استلام مبلغ يتطلب SubscriberId.';
      }
    }
    if (payload.taskType === EmployeeTaskType.Other && !payload.taskTitle?.trim()) return 'أخرى تتطلب TaskTitle.';
    return null;
  };

  const normalizeTaskPayload = (payload: EmployeeTaskCreateRequest): EmployeeTaskCreateRequest => {
    const trimmed: EmployeeTaskCreateRequest = {
      employeeUserId: payload.employeeUserId?.trim(),
      taskType: payload.taskType,
      note: payload.note?.trim() || undefined,
    };

    if (payload.taskType === EmployeeTaskType.SubscriberInstallation) {
      const subscriberId = payload.subscriberId?.trim();
      if (subscriberId) trimmed.subscriberId = subscriberId;
      return trimmed;
    }

    if (payload.taskType === EmployeeTaskType.SubscriberMaintenance) {
      const subscriberId = payload.subscriberId?.trim();
      if (subscriberId) trimmed.subscriberId = subscriberId;
      trimmed.maintenanceType = payload.maintenanceType;
      return trimmed;
    }

    if (payload.taskType === EmployeeTaskType.Other) {
      const taskTitle = payload.taskTitle?.trim();
      if (taskTitle) trimmed.taskTitle = taskTitle;
      return trimmed;
    }

    if (payload.taskType === EmployeeTaskType.AmountReception) {
      const subscriberId = payload.subscriberId?.trim();
      if (subscriberId) trimmed.subscriberId = subscriberId;
      if (payload.amountReceived != null && !Number.isNaN(payload.amountReceived)) {
        trimmed.amountReceived = payload.amountReceived;
      }
      return trimmed;
    }

    return trimmed;
  };

  if (!user) return null;

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">مهام الموظفين</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isEmployee ? 'مهامي الشخصية' : 'إدارة مهام الموظفين'}
          </p>
        </div>
        {isEmployee && user?.canReceiveTaskRequests && (
          <button
            type="button"
            onClick={async () => {
              setPushBusy(true);
              try {
                const res = await ensureWebPushSubscribed();
                if (res.ok) {
                  setPushReady(true);
                  showSuccess('تم', 'تم تفعيل إشعارات المهام على الجهاز.');
                } else {
                  showError('تعذر التفعيل', res.reason);
                }
              } finally {
                setPushBusy(false);
              }
            }}
            disabled={pushBusy || pushReady}
            className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 disabled:opacity-50"
          >
            {pushReady ? 'الإشعارات مفعّلة' : pushBusy ? 'جاري التفعيل...' : 'تفعيل إشعارات المهام'}
          </button>
        )}
        {canManage && (
          <button
            type="button"
            onClick={() => {
              setShowCreateModal(true);
              setShowEditModal(false);
              setSelectedTask(null);
              setSubscriberSearch('');
              setSubscriberSearchDebounced('');
              setSubscriberPage(1);
              setSubscriberOptions([]);
              setSubscriberDebtOnly(false);
              setDebtCollection(false);
              setCreateForm({
                employeeUserId: '',
                taskType: EmployeeTaskType.SubscriberInstallation,
                subscriberId: '',
                maintenanceType: SubscriberMaintenanceKind.CableCut,
                amountReceived: undefined,
                taskTitle: '',
                note: '',
              });
              setAmountReceptionSubscriberIds([]);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md"
          >
            <Plus className="h-4 w-4" />
            مهمة جديدة
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {isAdmin && (
            <input
              type="text"
              value={agentId}
              onChange={(e) => {
                setAgentId(e.target.value);
                setPage(1);
              }}
              placeholder="Agent ID (مطلوب للأدمن)"
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
            />
          )}
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder="بحث..."
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
          />
          <select
            value={status}
            onChange={(e) => {
              const v = e.target.value;
              setStatus(v === '' ? '' : (parseInt(v, 10) as EmployeeTaskStatus));
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
          >
            <option value="">كل الحالات</option>
            <option value={EmployeeTaskStatus.Pending}>معلقة</option>
            <option value={EmployeeTaskStatus.Accepted}>مقبولة</option>
            <option value={EmployeeTaskStatus.Completed}>مكتملة</option>
          </select>
          <button
            type="button"
            onClick={() => refetch()}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md text-gray-700 dark:text-gray-200"
          >
            تحديث
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {isEmployee ? (
          <div className="p-4 space-y-3">
            {isLoading ? (
              <div className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                جاري التحميل...
              </div>
            ) : rows.length === 0 ? (
              <div className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                لا توجد مهام.
              </div>
            ) : (
              rows.map((task) => (
                <div key={task.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                        {taskTypeLabel(task.taskType)}
                      </div>
                      <div className="mt-1">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs ${statusBadgeClass(task.status)}`}
                        >
                          {statusLabel(task.status)}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 text-right whitespace-nowrap">
                      وقت المهمة: {task.taskDuration || '—'}
                    </div>
                  </div>

                  <div className="mt-3 text-sm text-gray-700 dark:text-gray-300">
                    {task.taskType === EmployeeTaskType.SubscriberInstallation
                      ? task.subscriberDisplayName || task.subscriberName || '—'
                      : task.taskType === EmployeeTaskType.SubscriberMaintenance
                        ? maintenanceKindLabel(task.maintenanceType)
                        : task.taskType === EmployeeTaskType.AmountReception
                          ? task.amountReceived != null
                            ? String(task.amountReceived)
                            : '—'
                          : task.taskTitle || task.note || '—'}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md border border-gray-100 dark:border-gray-700 p-2">
                      <div className="text-gray-500 dark:text-gray-400">تاريخ المهمة</div>
                      <div className="text-gray-800 dark:text-gray-200 mt-1">{formatTaskDate(task.createdAt)}</div>
                    </div>
                    <div className="rounded-md border border-gray-100 dark:border-gray-700 p-2">
                      <div className="text-gray-500 dark:text-gray-400">تاريخ القبول</div>
                      <div className="text-gray-800 dark:text-gray-200 mt-1">{formatTaskDate(task.acceptedAt)}</div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    {task.status === EmployeeTaskStatus.Pending && (
                      <>
                        <button
                          type="button"
                          onClick={() => acceptMutation.mutate(task.id)}
                          className="px-2.5 py-1.5 text-xs rounded-md bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          قبول
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTask(task);
                            setShowDetailsModal(true);
                          }}
                          className="px-2.5 py-1.5 text-xs rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
                        >
                          التفاصيل
                        </button>
                      </>
                    )}

                    {task.status === EmployeeTaskStatus.Accepted &&
                      task.taskType === EmployeeTaskType.SubscriberInstallation && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTask(task);
                            setCompleteForm({
                              subscriberName: task.subscriberName || '',
                              subscriberPhone: task.subscriberPhone || '',
                              signalNumber: task.signalNumber || '',
                              note: task.note || '',
                            });
                            setShowCompleteModal(true);
                          }}
                          className="px-2.5 py-1.5 text-xs rounded-md bg-green-600 hover:bg-green-700 text-white"
                        >
                          إكمال التنصيب
                        </button>
                      )}

                    {task.status === EmployeeTaskStatus.Accepted &&
                      task.taskType === EmployeeTaskType.SubscriberMaintenance && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTask(task);
                            setCompleteMaintenanceForm({ note: task.note || '' });
                            setShowCompleteModal(true);
                          }}
                          className="px-2.5 py-1.5 text-xs rounded-md bg-green-700 hover:bg-green-800 text-white"
                        >
                          إكمال الصيانة
                        </button>
                      )}

                    {task.status === EmployeeTaskStatus.Accepted &&
                      task.taskType === EmployeeTaskType.AmountReception && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTask(task);
                            setCompleteAmountReceptionForm({
                              amountReceived: 0,
                              note: task.note || '',
                            });
                            setShowCompleteModal(true);
                          }}
                          className="px-2.5 py-1.5 text-xs rounded-md bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          إكمال استلام مبلغ
                        </button>
                      )}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/40">
                <tr>
                  <th className="px-3 py-2 text-right">النوع</th>
                  <th className="px-3 py-2 text-right">الموظف</th>
                  <th className="px-3 py-2 text-right">الحالة</th>
                  <th className="px-3 py-2 text-right">العنوان/الوصف</th>
                  <th className="px-3 py-2 text-right">تاريخ المهمة</th>
                  <th className="px-3 py-2 text-right">تاريخ القبول</th>
                  <th className="px-3 py-2 text-right">الوقت</th>
                  <th className="px-3 py-2 text-right">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                      جاري التحميل...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                      لا توجد مهام.
                    </td>
                  </tr>
                ) : (
                  rows.map((task) => (
                    <tr key={task.id} className="border-t border-gray-100 dark:border-gray-700">
                      <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{taskTypeLabel(task.taskType)}</td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                        {task.employeeName || task.employeeFullName || task.employeeUserName || '—'}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs ${statusBadgeClass(task.status)}`}
                        >
                          {statusLabel(task.status)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                        {task.taskType === EmployeeTaskType.SubscriberInstallation
                          ? task.subscriberDisplayName || task.subscriberName || '—'
                          : task.taskType === EmployeeTaskType.SubscriberMaintenance
                            ? maintenanceKindLabel(task.maintenanceType)
                            : task.taskType === EmployeeTaskType.AmountReception
                              ? task.amountReceived != null
                                ? String(task.amountReceived)
                                : '—'
                              : task.taskTitle || task.note || '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                        {formatTaskDate(task.createdAt)}
                      </td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                        {formatTaskDate(task.acceptedAt)}
                      </td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                        {task.taskDuration || '—'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {canManage && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedTask(task);
                                  setShowDetailsModal(true);
                                }}
                                className="px-2.5 py-1.5 text-xs rounded-md bg-indigo-600 hover:bg-indigo-700 text-white inline-flex items-center gap-1"
                              >
                                عرض التفاصيل
                              </button>
                              <button
                                type="button"
                                disabled={task.status !== EmployeeTaskStatus.Pending}
                                onClick={() => {
                                  setSelectedTask(task);
                                  setSubscriberSearch('');
                                  setSubscriberSearchDebounced('');
                                  setSubscriberPage(1);
                                  setSubscriberOptions([]);
                                  setCreateForm({
                                    employeeUserId: task.employeeUserId || '',
                                    taskType: task.taskType,
                                    subscriberId: task.subscriberId || '',
                                    maintenanceType:
                                      task.maintenanceType ?? SubscriberMaintenanceKind.CableCut,
                                    amountReceived: task.amountReceived ?? undefined,
                                    taskTitle: task.taskTitle || '',
                                    note: task.note || '',
                                  });
                                  setAmountReceptionSubscriberIds(task.subscriberId ? [task.subscriberId] : []);
                                  setShowEditModal(true);
                                }}
                                className="px-2.5 py-1.5 text-xs rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                title={
                                  task.status !== EmployeeTaskStatus.Pending
                                    ? 'يمكن التعديل فقط عندما تكون المهمة معلّقة.'
                                    : undefined
                                }
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                تعديل
                              </button>
                              <button
                                type="button"
                                disabled={task.status !== EmployeeTaskStatus.Pending}
                                onClick={() => {
                                  if (window.confirm('هل أنت متأكد من حذف هذه المهمة؟')) {
                                    deleteMutation.mutate(task.id);
                                  }
                                }}
                                className="px-2.5 py-1.5 text-xs rounded-md bg-red-600 hover:bg-red-700 text-white inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                title={
                                  task.status !== EmployeeTaskStatus.Pending
                                    ? 'يمكن الحذف فقط عندما تكون المهمة معلّقة.'
                                    : undefined
                                }
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                حذف
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={Math.max(1, totalPages)}
          totalItems={totalItems}
          pageSize={pageSize}
          hasNextPage={hasNextPage}
          hasPreviousPage={hasPreviousPage}
          onPageChange={setPage}
        />
      </div>

      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3">
          <div className="w-full max-w-xl bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {showEditModal ? 'تعديل مهمة' : 'إضافة مهمة'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  setSelectedTask(null);
                  setSubscriberSearch('');
                  setSubscriberSearchDebounced('');
                  setSubscriberPage(1);
                  setSubscriberOptions([]);
                  setAmountReceptionSubscriberIds([]);
                }}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            <div className="p-4 grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <select
                  value={createForm.employeeUserId}
                  onChange={(e) => setCreateForm((p) => ({ ...p, employeeUserId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                >
                  <option value="">اختر الموظف</option>
                  {employeesOptions.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} (@{emp.username})
                    </option>
                  ))}
                </select>
                {showEditModal && selectedTask?.status === EmployeeTaskStatus.Pending && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    يمكنك تغيير الموظف المكلّف؛ المهمة تبقى معلّقة ويُرسل إشعار للموظف الجديد.
                  </p>
                )}
              </div>

              <select
                value={createForm.taskType}
                onChange={(e) => {
                  setAmountReceptionSubscriberIds([]);
                  setSubscriberDebtOnly(false);
                  setDebtCollection(false);
                  setCreateForm((p) => ({
                    ...p,
                    taskType: parseInt(e.target.value, 10) as EmployeeTaskType,
                    subscriberId: '',
                    maintenanceType: SubscriberMaintenanceKind.CableCut,
                    amountReceived: undefined,
                    taskTitle: '',
                  }));
                }}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
              >
                <option value={EmployeeTaskType.SubscriberInstallation}>تنصيب جديد</option>
                <option value={EmployeeTaskType.SubscriberMaintenance}>صيانة مشترك</option>
                <option value={EmployeeTaskType.Other}>اخرى</option>
                <option value={EmployeeTaskType.AmountReception}>استلام مبلغ</option>
              </select>

              {createForm.taskType === EmployeeTaskType.SubscriberInstallation && (
                <input
                  type="text"
                  value={createForm.subscriberId ?? ''}
                  onChange={(e) => setCreateForm((p) => ({ ...p, subscriberId: e.target.value }))}
                  placeholder="اسم المشترك"
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                />
              )}
              {createForm.taskType === EmployeeTaskType.SubscriberMaintenance && (
                <div className="space-y-2">
                  <div className="space-y-2 rounded-md border border-gray-200 dark:border-gray-700 p-3">
                    <input
                      type="text"
                      value={subscriberSearch}
                      onChange={(e) => {
                        setSubscriberSearch(e.target.value);
                        setSubscriberPage(1);
                        setSubscriberOptions([]);
                      }}
                      placeholder="ابحث عن المشترك..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    />
                    <select
                      value={createForm.subscriberId ?? ''}
                      onChange={(e) => setCreateForm((p) => ({ ...p, subscriberId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">اختر المشترك *</option>
                      {createForm.subscriberId &&
                        !subscriberOptions.some((s) => s.id === createForm.subscriberId) &&
                        selectedTask?.subscriberDisplayName && (
                          <option value={createForm.subscriberId}>
                            {selectedTask.subscriberDisplayName}
                          </option>
                        )}
                      {subscriberOptions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.displayName} {s.phoneNumber ? `- ${s.phoneNumber}` : ''}
                          {s.totalDebt != null && s.totalDebt > 0
                            ? ` (${formatNumber(s.totalDebt, { suffix: ' د.ع' })})`
                            : ''}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {subscribersLoading ? 'جاري تحميل المشتركين...' : `عدد العناصر المحملة: ${subscriberOptions.length}`}
                      </p>
                      <button
                        type="button"
                        onClick={() => setSubscriberPage((p) => p + 1)}
                        disabled={subscribersLoading || !(subscribersResponse?.hasNextPage ?? false)}
                        className="px-2.5 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 disabled:opacity-50"
                      >
                        تحميل المزيد
                      </button>
                    </div>
                  </div>

                  <select
                    value={createForm.maintenanceType ?? SubscriberMaintenanceKind.CableCut}
                    onChange={(e) =>
                      setCreateForm((p) => ({
                        ...p,
                        maintenanceType: parseInt(e.target.value, 10) as SubscriberMaintenanceKind,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  >
                    <option value={SubscriberMaintenanceKind.CableCut}>قطع كيبل</option>
                    <option value={SubscriberMaintenanceKind.ServiceProblem}>مشكلة في الخدمة</option>
                    <option value={SubscriberMaintenanceKind.RouterPasswordChange}>تغيير رمز الراوتر</option>
                    <option value={SubscriberMaintenanceKind.Other}>اخرى</option>
                  </select>
                </div>
              )}
              {createForm.taskType === EmployeeTaskType.AmountReception && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <label className="inline-flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={subscriberDebtOnly}
                        disabled={debtCollection}
                        onChange={(e) => {
                          setSubscriberDebtOnly(e.target.checked);
                          setSubscriberPage(1);
                          setSubscriberOptions([]);
                          setAmountReceptionSubscriberIds([]);
                        }}
                      />
                      ذوو الدين فقط (ترتيب حسب الدين)
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={debtCollection}
                        onChange={(e) => {
                          setDebtCollection(e.target.checked);
                          if (e.target.checked) {
                            setSubscriberDebtOnly(true);
                            setSubscriberPage(1);
                            setSubscriberOptions([]);
                            setAmountReceptionSubscriberIds([]);
                          }
                        }}
                      />
                      استلام ديون (استلام ديون اخرى)
                    </label>
                  </div>
                  {debtCollection && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      في وضع استلام الديون يتم طلب أصحاب الديون أولاً، وإذا لم يوجد ديون يعرض النظام كل المشتركين تلقائياً.
                    </p>
                  )}
                  <div className="space-y-2 rounded-md border border-gray-200 dark:border-gray-700 p-3">
                    <input
                      type="text"
                      value={subscriberSearch}
                      onChange={(e) => {
                        setSubscriberSearch(e.target.value);
                        setSubscriberPage(1);
                        setSubscriberOptions([]);
                      }}
                      placeholder="ابحث عن المشترك..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    />

                    {showEditModal ? (
                      <select
                        value={createForm.subscriberId ?? ''}
                        onChange={(e) => setCreateForm((p) => ({ ...p, subscriberId: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                      >
                        <option value="">اختر المشترك *</option>
                        {createForm.subscriberId &&
                          !subscriberOptions.some((s) => s.id === createForm.subscriberId) &&
                          selectedTask?.subscriberDisplayName && (
                            <option value={createForm.subscriberId}>
                              {selectedTask.subscriberDisplayName}
                            </option>
                          )}
                        {subscriberOptions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.displayName} {s.phoneNumber ? `- ${s.phoneNumber}` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="max-h-52 overflow-auto rounded-md border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                        {subscriberOptions.map((s) => {
                          const checked = amountReceptionSubscriberIds.includes(s.id);
                          return (
                            <label
                              key={s.id}
                              className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  setAmountReceptionSubscriberIds((prev) => {
                                    if (e.target.checked) return prev.includes(s.id) ? prev : [...prev, s.id];
                                    return prev.filter((id) => id !== s.id);
                                  });
                                }}
                              />
                              <span className="text-sm text-gray-800 dark:text-gray-200">
                                {s.displayName} {s.phoneNumber ? `- ${s.phoneNumber}` : ''}
                                {s.totalDebt != null && s.totalDebt > 0
                                  ? ` — دين: ${formatNumber(s.totalDebt, { suffix: ' د.ع' })}`
                                  : s.totalDebt != null && s.totalDebt === 0
                                    ? ' — بدون دين'
                                    : ''}
                              </span>
                            </label>
                          );
                        })}
                        {subscriberOptions.length === 0 && (
                          <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                            {subscribersLoading ? 'جاري تحميل المشتركين...' : 'لا توجد نتائج.'}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {showEditModal
                          ? subscribersLoading
                            ? 'جاري تحميل المشتركين...'
                            : `عدد العناصر المحملة: ${subscriberOptions.length}`
                          : `المحددون: ${amountReceptionSubscriberIds.length}`}
                      </p>
                      <button
                        type="button"
                        onClick={() => setSubscriberPage((p) => p + 1)}
                        disabled={subscribersLoading || !(subscribersResponse?.hasNextPage ?? false)}
                        className="px-2.5 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 disabled:opacity-50"
                      >
                        تحميل المزيد
                      </button>
                    </div>
                  </div>
                  {amountReceptionSubscriberIds.length <= 1 && (
                    <input
                      type="number"
                      value={createForm.amountReceived ?? ''}
                      onChange={(e) =>
                        setCreateForm((p) => ({
                          ...p,
                          amountReceived: e.target.value === '' ? undefined : Number(e.target.value),
                        }))
                      }
                      placeholder="المبلغ (اختياري — لمشترك واحد فقط؛ عند عدة مشتركين يُسجَّل عند إكمال المهمة)"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    />
                  )}
                  {amountReceptionSubscriberIds.length > 1 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      عند اختيار أكثر من مشترك لا يُرسل المبلغ عند الإنشاء؛ يسجّله الموظف لكل مهمة عند الإكمال.
                    </p>
                  )}
                </div>
              )}
              {createForm.taskType === EmployeeTaskType.Other && (
                <input
                  type="text"
                  value={createForm.taskTitle ?? ''}
                  onChange={(e) => setCreateForm((p) => ({ ...p, taskTitle: e.target.value }))}
                  placeholder="عنوان المهمة *"
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                />
              )}
              <textarea
                value={createForm.note ?? ''}
                onChange={(e) => setCreateForm((p) => ({ ...p, note: e.target.value }))}
                rows={2}
                placeholder="ملاحظة"
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  setSelectedTask(null);
                  setSubscriberSearch('');
                  setSubscriberSearchDebounced('');
                  setSubscriberPage(1);
                  setSubscriberOptions([]);
                  setAmountReceptionSubscriberIds([]);
                  setSubscriberDebtOnly(false);
                  setDebtCollection(false);
                }}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md text-gray-700 dark:text-gray-200"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  const error = validateCreatePayload(createForm);
                  if (error) {
                    showError('خطأ', error);
                    return;
                  }
                  if (showEditModal && selectedTask) {
                    const updatePayload = buildUpdatePayload(createForm);
                    updateMutation.mutate({ id: selectedTask.id, payload: updatePayload });
                    return;
                  }
                  const normalized = normalizeTaskPayload(createForm);

                  if (normalized.taskType === EmployeeTaskType.AmountReception && showCreateModal) {
                    const selectedIds = amountReceptionSubscriberIds;
                    if (selectedIds.length === 0) {
                      showError('خطأ', 'اختر مشتركاً واحداً على الأقل.');
                      return;
                    }
                    const note = createForm.note?.trim();
                    const payload: EmployeeTaskCreateRequest = {
                      employeeUserId: createForm.employeeUserId.trim(),
                      taskType: EmployeeTaskType.AmountReception,
                      note: note || undefined,
                      taskDetails: note || undefined,
                      debtCollection: debtCollection ? true : undefined,
                    };
                    if (debtCollection) payload.taskTitle = 'استلام ديون';
                    if (selectedIds.length === 1) {
                      payload.subscriberId = selectedIds[0];
                      const amt = createForm.amountReceived;
                      if (amt != null && !Number.isNaN(amt) && amt > 0) payload.amountReceived = amt;
                    } else {
                      payload.subscriberIds = selectedIds;
                    }
                    createMutation.mutate(payload);
                    return;
                  }

                  createMutation.mutate(normalized);
                }}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md disabled:opacity-50 inline-flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {showEditModal ? 'حفظ التعديل' : createMutation.isPending ? 'جاري الإنشاء...' : 'إنشاء المهمة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCompleteModal && selectedTask && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3">
          <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {selectedTask.taskType === EmployeeTaskType.SubscriberInstallation
                  ? 'إكمال مهمة تنصيب'
                  : selectedTask.taskType === EmployeeTaskType.SubscriberMaintenance
                    ? 'إكمال مهمة صيانة'
                    : 'إكمال مهمة استلام مبلغ'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowCompleteModal(false);
                  setSelectedTask(null);
                }}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            <div className="p-4 grid grid-cols-1 gap-3">
              {selectedTask.taskType === EmployeeTaskType.SubscriberInstallation && (
                <>
                  <input
                    type="text"
                    value={completeForm.subscriberName}
                    onChange={(e) => setCompleteForm((p) => ({ ...p, subscriberName: e.target.value }))}
                    placeholder="اسم المشترك *"
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  />
                  <input
                    type="text"
                    value={completeForm.subscriberPhone ?? ''}
                    onChange={(e) => setCompleteForm((p) => ({ ...p, subscriberPhone: e.target.value }))}
                    placeholder="الهاتف (اختياري)"
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  />
                  <input
                    type="text"
                    value={completeForm.signalNumber ?? ''}
                    onChange={(e) => setCompleteForm((p) => ({ ...p, signalNumber: e.target.value }))}
                    placeholder="رقم الإشارة"
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  />
                  <textarea
                    value={completeForm.note ?? ''}
                    onChange={(e) => setCompleteForm((p) => ({ ...p, note: e.target.value }))}
                    rows={3}
                    placeholder="ملاحظة"
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  />
                </>
              )}

              {selectedTask.taskType === EmployeeTaskType.SubscriberMaintenance && (
                <textarea
                  value={completeMaintenanceForm.note ?? ''}
                  onChange={(e) => setCompleteMaintenanceForm((p) => ({ ...p, note: e.target.value }))}
                  rows={4}
                  placeholder="ملاحظة بعد التنفيذ"
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                />
              )}

              {selectedTask.taskType === EmployeeTaskType.AmountReception && (
                <>
                  <input
                    type="number"
                    value={completeAmountReceptionForm.amountReceived ?? 0}
                    onChange={(e) =>
                      setCompleteAmountReceptionForm((p) => ({
                        ...p,
                        amountReceived: Number(e.target.value || 0),
                      }))
                    }
                    placeholder="amountReceived"
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  />
                  <textarea
                    value={completeAmountReceptionForm.note ?? ''}
                    onChange={(e) => setCompleteAmountReceptionForm((p) => ({ ...p, note: e.target.value }))}
                    rows={3}
                    placeholder="ملاحظة (اختياري)"
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  />
                </>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCompleteModal(false);
                  setSelectedTask(null);
                }}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md text-gray-700 dark:text-gray-200"
              >
                إلغاء
              </button>
              {selectedTask.taskType === EmployeeTaskType.SubscriberInstallation && (
                <button
                  type="button"
                  onClick={() => {
                    if (!completeForm.subscriberName.trim()) {
                      showError('خطأ', 'اسم المشترك مطلوب.');
                      return;
                    }
                    completeInstallationMutation.mutate({ id: selectedTask.id, payload: completeForm });
                  }}
                  disabled={completeInstallationMutation.isPending}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md disabled:opacity-50 inline-flex items-center gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  حفظ الإكمال
                </button>
              )}

              {selectedTask.taskType === EmployeeTaskType.SubscriberMaintenance && (
                <button
                  type="button"
                  onClick={() => {
                    const note = (completeMaintenanceForm.note || '').trim();
                    if (!note) {
                      showError('خطأ', 'ملاحظة بعد التنفيذ مطلوبة.');
                      return;
                    }
                    const payload: EmployeeTaskCompleteMaintenanceRequest = { note };
                    completeMaintenanceMutation.mutate({ id: selectedTask.id, payload });
                  }}
                  disabled={completeMaintenanceMutation.isPending}
                  className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-md disabled:opacity-50 inline-flex items-center gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  حفظ الإكمال
                </button>
              )}

              {selectedTask.taskType === EmployeeTaskType.AmountReception && (
                <button
                  type="button"
                  onClick={() => {
                    if (!completeAmountReceptionForm.amountReceived || completeAmountReceptionForm.amountReceived <= 0) {
                      showError('خطأ', 'amountReceived مطلوب.');
                      return;
                    }
                    const payload: EmployeeTaskCompleteAmountReceptionRequest = {
                      amountReceived: completeAmountReceptionForm.amountReceived,
                      note: (completeAmountReceptionForm.note || '').trim() || undefined,
                    };
                    completeAmountReceptionMutation.mutate({ id: selectedTask.id, payload });
                  }}
                  disabled={completeAmountReceptionMutation.isPending}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md disabled:opacity-50 inline-flex items-center gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  حفظ الإكمال
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showDetailsModal && selectedTask && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3">
          <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">تفاصيل المهمة</h3>
              <button
                type="button"
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedTask(null);
                }}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            <div className="p-4 grid grid-cols-1 gap-3 text-sm">
              <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-gray-500 dark:text-gray-400">اسم المشترك</p>
                <p className="text-gray-900 dark:text-white mt-1">
                  {selectedTask.subscriberDisplayName || selectedTask.subscriberName || '—'}
                </p>
              </div>
              <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-gray-500 dark:text-gray-400">ملاحظة المهمة</p>
                <p className="text-gray-900 dark:text-white mt-1 whitespace-pre-wrap">
                  {selectedTask.note || '—'}
                </p>
              </div>

              {(selectedTask.completedSubscriberName ||
                selectedTask.completedPhoneNumber ||
                selectedTask.completedSignalNumber ||
                selectedTask.completedNote) && (
                <>
                  <div className="pt-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                    تفاصيل إنجاز المهمة
                  </div>
                  <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
                    <p className="text-gray-500 dark:text-gray-400">اسم المشترك (منجز)</p>
                    <p className="text-gray-900 dark:text-white mt-1">
                      {selectedTask.completedSubscriberName || '—'}
                    </p>
                  </div>
                  <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
                    <p className="text-gray-500 dark:text-gray-400">رقم الهاتف</p>
                    <p className="text-gray-900 dark:text-white mt-1">{selectedTask.completedPhoneNumber || '—'}</p>
                  </div>
                  <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
                    <p className="text-gray-500 dark:text-gray-400">رقم الإشارة</p>
                    <p className="text-gray-900 dark:text-white mt-1">{selectedTask.completedSignalNumber || '—'}</p>
                  </div>
                  <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
                    <p className="text-gray-500 dark:text-gray-400">ملاحظة الإكمال</p>
                    <p className="text-gray-900 dark:text-white mt-1 whitespace-pre-wrap">
                      {selectedTask.completedNote || '—'}
                    </p>
                  </div>
                </>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedTask(null);
                }}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md text-gray-700 dark:text-gray-200"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeTasksPage;

