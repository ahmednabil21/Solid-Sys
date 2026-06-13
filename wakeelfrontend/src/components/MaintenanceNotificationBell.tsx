import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useMaintenanceNotificationsOptional } from '../contexts/MaintenanceNotificationsContext';

const MaintenanceNotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const ctx = useMaintenanceNotificationsOptional();

  if (!ctx) return null;

  const { pendingCount, hasUnread, markAsRead } = ctx;
  const showBadge = pendingCount > 0;

  return (
    <button
      type="button"
      onClick={() => {
        markAsRead();
        navigate('/admin/maintenance-requests');
      }}
      className={`relative p-2 rounded-lg transition-colors touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center ${
        hasUnread && showBadge
          ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
      aria-label={
        showBadge
          ? `طلبات صيانة: ${pendingCount} بانتظار${hasUnread ? ' (غير مقروء)' : ''}`
          : 'طلبات الصيانة'
      }
      title={showBadge ? `${pendingCount} طلب صيانة بانتظار` : 'طلبات الصيانة'}
    >
      <Bell className={`h-5 w-5 sm:h-6 sm:w-6 ${hasUnread && showBadge ? 'fill-red-100 dark:fill-red-900/30' : ''}`} />
      {showBadge && (
        <span
          className={`absolute top-1 left-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center leading-none ${
            hasUnread ? 'bg-red-500 ring-2 ring-white dark:ring-gray-800' : 'bg-gray-500'
          }`}
        >
          {pendingCount > 99 ? '99+' : pendingCount}
        </span>
      )}
    </button>
  );
};

export default MaintenanceNotificationBell;
