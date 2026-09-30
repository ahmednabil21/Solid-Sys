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
import { AppChatConversation, UserRole } from '../types';
import { hasPageAction } from '../utils/employeePermissions';
import { showSuccess } from '../utils/notifications';
import notificationSound from '../sounds/universfield-new-notification-022-370046.mp3';

const APP_CHAT_NOTIFY_ROLES: UserRole[] = [
  UserRole.Admin,
  UserRole.Agent,
  UserRole.SubAgent,
  UserRole.Employee,
];

export const APP_CHAT_UNREAD_COUNT_QUERY_KEY = 'app-chat-unread-count';

async function fetchAppChatUnreadCount(isAdmin: boolean, agentIds: string[]): Promise<number> {
  if (isAdmin) {
    if (!agentIds.length) return 0;
    const counts = await Promise.all(
      agentIds.map((agentId) =>
        apiService
          .getAppChatConversations({ page: 1, pageSize: 1, unreadOnly: true, agentId })
          .then((res) => res.totalItems ?? 0)
          .catch(() => 0)
      )
    );
    return counts.reduce((sum, n) => sum + n, 0);
  }

  const res = await apiService.getAppChatConversations({ page: 1, pageSize: 1, unreadOnly: true });
  return res.totalItems ?? 0;
}

interface AppChatNotificationsContextType {
  unreadCount: number;
  hasUnread: boolean;
  markAsRead: () => void;
  refreshUnreadCount: () => void;
}

const AppChatNotificationsContext = createContext<AppChatNotificationsContextType | undefined>(
  undefined
);

export const useAppChatNotifications = () => {
  const ctx = useContext(AppChatNotificationsContext);
  if (!ctx) {
    throw new Error('useAppChatNotifications must be used within AppChatNotificationsProvider');
  }
  return ctx;
};

export const useAppChatNotificationsOptional = () => useContext(AppChatNotificationsContext);

interface AppChatNotificationsProviderProps {
  children: ReactNode;
}

export const AppChatNotificationsProvider: React.FC<AppChatNotificationsProviderProps> = ({
  children,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === UserRole.Admin;
  const isEmployee = user?.role === UserRole.Employee;
  const canNotify =
    !!user &&
    APP_CHAT_NOTIFY_ROLES.includes(user.role) &&
    (!isEmployee || hasPageAction(user, 'AppChats', 'view'));

  const [hasUnread, setHasUnread] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    audioRef.current = new Audio(notificationSound);
  }, []);

  const { data: agentsResponse } = useQuery({
    queryKey: ['agents-for-appchat-notify', 1, 100],
    queryFn: () => apiService.getAllAgents({ page: 1, pageSize: 100 }),
    enabled: canNotify && isAdmin,
  });

  const { data: myAgent } = useQuery({
    queryKey: ['my-agent-appchat-notify'],
    queryFn: () => apiService.getMyAgent(),
    enabled: canNotify && !isAdmin,
  });

  const hubAgentIds = useMemo(() => {
    if (!canNotify) return [];
    if (isAdmin) return (agentsResponse?.data ?? []).map((a) => a.id).filter(Boolean);
    return myAgent?.id ? [myAgent.id] : [];
  }, [canNotify, isAdmin, agentsResponse?.data, myAgent?.id]);

  const hubAgentIdsKey = hubAgentIds.join(',');

  const { data: unreadCount = 0, refetch: refreshUnreadCount } = useQuery({
    queryKey: [APP_CHAT_UNREAD_COUNT_QUERY_KEY, isAdmin, hubAgentIdsKey],
    queryFn: () => fetchAppChatUnreadCount(isAdmin, hubAgentIds),
    enabled: canNotify && (isAdmin ? hubAgentIds.length > 0 : !!myAgent?.id),
    refetchInterval: 5 * 60 * 1000,
  });

  const initialUnreadSet = useRef(false);
  useEffect(() => {
    if (!canNotify || initialUnreadSet.current) return;
    if (unreadCount > 0) {
      setHasUnread(true);
      initialUnreadSet.current = true;
    }
  }, [canNotify, unreadCount]);

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

  const handleAppChatUpdated = useCallback(
    (payload: AppChatConversation) => {
      if (!payload?.id) return;

      queryClient.invalidateQueries({ queryKey: ['app-chat-list'] });
      queryClient.invalidateQueries({ queryKey: ['app-chat-detail'] });
      refreshUnreadCount();

      if (payload.needsHuman || payload.hasUnreadByAdmin) {
        setHasUnread(true);
        playNotificationSound();
        showSuccess(
          'رسالة جديدة من المشترك',
          `من ${payload.subscriberName || payload.subscriberUsername || 'مشترك'}`
        );
      }
    },
    [queryClient, refreshUnreadCount, playNotificationSound]
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

    connection.on('appChatUpdated', (payload: unknown) => {
      handleAppChatUpdated(payload as AppChatConversation);
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
  }, [canNotify, hubAgentIdsKey, hubAgentIds, handleAppChatUpdated]);

  const value = useMemo(
    () => ({
      unreadCount,
      hasUnread,
      markAsRead,
      refreshUnreadCount,
    }),
    [unreadCount, hasUnread, markAsRead, refreshUnreadCount]
  );

  return (
    <AppChatNotificationsContext.Provider value={value}>
      {children}
    </AppChatNotificationsContext.Provider>
  );
};
