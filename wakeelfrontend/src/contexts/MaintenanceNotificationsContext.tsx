import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { useAuth } from './AuthContext';
import { apiService } from '../services/api';
import {
  AgentSubscriberMaintenanceRequestDto,
  SubscriberMaintenanceRequestStatusCode,
  UserRole,
} from '../types';
import { showSuccess } from '../utils/notifications';
import notificationSound from '../sounds/universfield-new-notification-022-370046.mp3';

const MAINTENANCE_NOTIFY_ROLES: UserRole[] = [
  UserRole.Admin,
  UserRole.Agent,
  UserRole.SubAgent,
  UserRole.Employee,
];

export const MAINTENANCE_PENDING_COUNT_QUERY_KEY = 'maintenance-pending-count';

async function fetchPendingMaintenanceCount(isAdmin: boolean, agentIds: string[]): Promise<number> {
  if (isAdmin) {
    if (!agentIds.length) return 0;
    const counts = await Promise.all(
      agentIds.map((agentId) =>
        apiService
          .getAgentSubscriberMaintenanceRequests({
            status: SubscriberMaintenanceRequestStatusCode.Pending,
            agentId,
          })
          .then((list) => list.length)
          .catch(() => 0)
      )
    );
    return counts.reduce((sum, n) => sum + n, 0);
  }

  const list = await apiService.getAgentSubscriberMaintenanceRequests({
    status: SubscriberMaintenanceRequestStatusCode.Pending,
  });
  return list.length;
}

interface MaintenanceNotificationsContextType {
  pendingCount: number;
  hasUnread: boolean;
  markAsRead: () => void;
  refreshPendingCount: () => void;
}

const MaintenanceNotificationsContext = createContext<MaintenanceNotificationsContextType | undefined>(
  undefined
);

export const useMaintenanceNotifications = () => {
  const ctx = useContext(MaintenanceNotificationsContext);
  if (!ctx) {
    throw new Error('useMaintenanceNotifications must be used within MaintenanceNotificationsProvider');
  }
  return ctx;
};

/** اختياري — للمكوّنات خارج الـ Provider (مثل Sidebar) */
export const useMaintenanceNotificationsOptional = () =>
  useContext(MaintenanceNotificationsContext);

interface MaintenanceNotificationsProviderProps {
  children: ReactNode;
}

export const MaintenanceNotificationsProvider: React.FC<MaintenanceNotificationsProviderProps> = ({
  children,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === UserRole.Admin;
  const canNotify = !!user && MAINTENANCE_NOTIFY_ROLES.includes(user.role);

  const [hasUnread, setHasUnread] = useState(false);
  const hasUnreadRef = useRef(hasUnread);
  useEffect(() => {
    hasUnreadRef.current = hasUnread;
  }, [hasUnread]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    audioRef.current = new Audio(notificationSound);
  }, []);

  const { data: agentsResponse } = useQuery({
    queryKey: ['agents-for-maintenance-notify', 1, 100],
    queryFn: () => apiService.getAllAgents({ page: 1, pageSize: 100 }),
    enabled: canNotify && isAdmin,
  });

  const { data: myAgent } = useQuery({
    queryKey: ['my-agent-maintenance-notify'],
    queryFn: () => apiService.getMyAgent(),
    enabled: canNotify && !isAdmin,
  });

  const hubAgentIds = useMemo(() => {
    if (!canNotify) return [];
    if (isAdmin) return (agentsResponse?.data ?? []).map((a) => a.id).filter(Boolean);
    return myAgent?.id ? [myAgent.id] : [];
  }, [canNotify, isAdmin, agentsResponse?.data, myAgent?.id]);

  const hubAgentIdsKey = hubAgentIds.join(',');

  const { data: pendingCount = 0, refetch: refreshPendingCount } = useQuery({
    queryKey: [MAINTENANCE_PENDING_COUNT_QUERY_KEY, isAdmin, hubAgentIdsKey],
    queryFn: () => fetchPendingMaintenanceCount(isAdmin, hubAgentIds),
    enabled: canNotify && (isAdmin ? hubAgentIds.length > 0 : !!myAgent?.id),
    refetchInterval: 5 * 60 * 1000,
  });

  const initialUnreadSet = useRef(false);
  useEffect(() => {
    if (!canNotify || initialUnreadSet.current) return;
    if (pendingCount > 0) {
      setHasUnread(true);
      initialUnreadSet.current = true;
    }
  }, [canNotify, pendingCount]);

  const markAsRead = useCallback(() => {
    setHasUnread(false);
  }, []);

  const playNotificationSound = useCallback(() => {
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
  }, []);

  const handleMaintenanceEvent = useCallback(
    (request: AgentSubscriberMaintenanceRequestDto, isCreated: boolean) => {
      if (!request?.id) return;

      queryClient.invalidateQueries({ queryKey: ['agent-subscriber-maintenance'] });
      refreshPendingCount();

      const isPending = Number(request.status) === SubscriberMaintenanceRequestStatusCode.Pending;

      if (isCreated && isPending) {
        setHasUnread(true);
        playNotificationSound();
        showSuccess(
          'طلب صيانة جديد',
          `طلب من ${request.subscriberFullName || request.subscriberUsername || 'مشترك'}`
        );
      } else if (!isPending && hasUnreadRef.current) {
        refreshPendingCount();
      }
    },
    [queryClient, refreshPendingCount, playNotificationSound]
  );

  useEffect(() => {
    if (!canNotify || hubAgentIds.length === 0) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    const baseUrl = apiService.getBaseURL();
    const hubUrl = `${baseUrl.replace(/\/api\/?$/, '')}/hubs/dashboard`;

    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl, { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    const joinGroups = async () => {
      for (const agentId of hubAgentIds) {
        try {
          await connection.invoke('JoinAgentGroup', agentId);
        } catch {
          // ignore
        }
      }
    };

    connection.on('subscriberMaintenanceRequestCreated', (payload: unknown) => {
      handleMaintenanceEvent(payload as AgentSubscriberMaintenanceRequestDto, true);
    });

    connection.on('subscriberMaintenanceRequestUpdated', (payload: unknown) => {
      handleMaintenanceEvent(payload as AgentSubscriberMaintenanceRequestDto, false);
    });

    connection.onreconnected(joinGroups);

    connection
      .start()
      .then(joinGroups)
      .catch(() => {
        // ignore
      });

    return () => {
      (async () => {
        try {
          await connection.stop();
        } catch {
          // ignore
        }
      })();
    };
  }, [canNotify, hubAgentIdsKey, hubAgentIds, handleMaintenanceEvent]);

  const value = useMemo(
    () => ({
      pendingCount,
      hasUnread,
      markAsRead,
      refreshPendingCount,
    }),
    [pendingCount, hasUnread, markAsRead, refreshPendingCount]
  );

  if (!canNotify) {
    return <>{children}</>;
  }

  return (
    <MaintenanceNotificationsContext.Provider value={value}>
      {children}
    </MaintenanceNotificationsContext.Provider>
  );
};
