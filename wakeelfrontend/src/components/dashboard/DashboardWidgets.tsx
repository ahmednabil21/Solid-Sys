import React from 'react';
import { MapPin, RefreshCw, Users } from 'lucide-react';
import { WakeelBadge } from '../table/WakeelBadge';
import {
  AgentRegion,
  AgentReseller,
  EmployeeTask,
  EmployeeTaskStatus,
  EmployeeTaskType,
  RenewalReceipt,
} from '../../types';

export const filterChipBase =
  'flex items-center gap-2.5 px-4 py-3 rounded-xl border text-right transition-all min-w-[132px] shrink-0';
export const filterChipInactive =
  'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:border-primary-300 hover:shadow-sm';
export const filterChipRegionActive =
  'bg-primary-600 border-primary-600 text-white shadow-md shadow-primary-500/25';
export const filterChipResellerActive =
  'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-500/25';

export const dashPanel =
  'bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700';

function taskTypeLabel(type: EmployeeTaskType): string {
  if (type === EmployeeTaskType.SubscriberInstallation) return 'تنصيب مشترك';
  if (type === EmployeeTaskType.SubscriberMaintenance) return 'صيانة مشترك';
  if (type === EmployeeTaskType.AmountReception) return 'استلام مبلغ';
  return 'اخرى';
}

function taskStatusBadge(status: EmployeeTaskStatus): { label: string; color: 'success' | 'warning' | 'primary' } {
  if (status === EmployeeTaskStatus.Pending) return { label: 'معلقة', color: 'warning' };
  if (status === EmployeeTaskStatus.Accepted) return { label: 'مقبولة', color: 'primary' };
  return { label: 'مكتملة', color: 'success' };
}

interface DashboardCreditBalanceCardProps {
  label: string;
  amount: number;
  formatNumber: (n: number, opts?: { suffix?: string }) => string;
  onClick?: () => void;
}

export const DashboardCreditBalanceCard: React.FC<DashboardCreditBalanceCardProps> = ({
  label,
  amount,
  formatNumber,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="relative w-full overflow-hidden rounded-2xl p-5 sm:p-6 text-white text-right shadow-xl shadow-indigo-950/20 transition-transform hover:-translate-y-0.5"
    style={{
      background: 'linear-gradient(135deg, #0b1220 0%, #1e1b4b 45%, #3730a3 100%)',
    }}
  >
    <div className="pointer-events-none absolute -top-12 -left-12 h-44 w-44 rounded-full bg-white/5" />
    <div className="pointer-events-none absolute -bottom-16 -right-10 h-52 w-52 rounded-full bg-indigo-400/10" />
    <div className="relative flex items-start justify-between gap-3">
      <div
        className="h-9 w-12 rounded-md opacity-95"
        style={{ background: 'linear-gradient(135deg, #fcd34d 0%, #d97706 100%)' }}
        aria-hidden
      />
      <div className="text-left">
        <div className="text-[10px] font-bold tracking-[0.25em] opacity-70">WAKEEL</div>
        <div className="mt-1 flex items-center gap-1 text-[10px] opacity-60">
          <Users className="h-3 w-3" />
          <span>Balance</span>
        </div>
      </div>
    </div>
    <p className="relative mt-6 text-xs opacity-75">{label}</p>
    <p className="relative mt-1 text-3xl sm:text-4xl font-bold tracking-tight">
      {formatNumber(amount, { suffix: ' د.ع' })}
    </p>
    <p className="relative mt-8 text-[11px] tracking-[0.2em] opacity-45" dir="ltr">
      IQD •••• •••• ••••
    </p>
  </button>
);

interface DashboardRegionResellerFiltersProps {
  regions: AgentRegion[];
  resellers: AgentReseller[];
  selectedRegionId: string;
  selectedResellerId: string;
  onRegionClick: (regionId: string) => void;
  onResellerClick: (resellerId: string) => void;
  showRegions: boolean;
  showResellers: boolean;
}

export const DashboardRegionResellerFilters: React.FC<DashboardRegionResellerFiltersProps> = ({
  regions,
  resellers,
  selectedRegionId,
  selectedResellerId,
  onRegionClick,
  onResellerClick,
  showRegions,
  showResellers,
}) => (
  <div className="space-y-3">
    {showRegions && (
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          <MapPin className="h-4 w-4 text-primary-600 dark:text-primary-400" />
          <span>فلترة المناطق</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => onRegionClick('')}
            className={`${filterChipBase} ${
              !selectedRegionId ? filterChipRegionActive : filterChipInactive
            }`}
          >
            <MapPin className={`h-4 w-4 shrink-0 ${!selectedRegionId ? 'text-white' : 'text-primary-500'}`} />
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">الكل</div>
              <div className={`text-xs truncate ${!selectedRegionId ? 'text-white/80' : 'opacity-70'}`}>
                كل المناطق
              </div>
            </div>
          </button>
          {regions.map((region) => {
            const active = selectedRegionId === region.id;
            return (
              <button
                key={region.id}
                type="button"
                onClick={() => onRegionClick(region.id)}
                className={`${filterChipBase} ${active ? filterChipRegionActive : filterChipInactive}`}
              >
                <MapPin className={`h-4 w-4 shrink-0 ${active ? 'text-white' : 'text-primary-500'}`} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{region.name}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    )}

    {showResellers && (
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span>فلترة الرسيلرز</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => onResellerClick('')}
            className={`${filterChipBase} ${
              !selectedResellerId ? filterChipResellerActive : filterChipInactive
            }`}
          >
            <MapPin className={`h-4 w-4 shrink-0 ${!selectedResellerId ? 'text-white' : 'text-emerald-500'}`} />
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">الكل</div>
              <div className={`text-xs truncate ${!selectedResellerId ? 'text-white/80' : 'opacity-70'}`}>
                كل الرسيلرز
              </div>
            </div>
          </button>
          {resellers.map((reseller) => {
            const active = selectedResellerId === reseller.id;
            return (
              <button
                key={reseller.id}
                type="button"
                onClick={() => onResellerClick(reseller.id)}
                className={`${filterChipBase} ${active ? filterChipResellerActive : filterChipInactive}`}
              >
                <MapPin className={`h-4 w-4 shrink-0 ${active ? 'text-white' : 'text-emerald-500'}`} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{reseller.name}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    )}
  </div>
);

interface SummaryCardProps {
  title: string;
  value: string;
}

export const DashboardSummaryAmounts: React.FC<{ items: SummaryCardProps[] }> = ({ items }) => (
  <section>
    <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-white">ملخص المبالغ</h2>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.title} className={`${dashPanel} p-5`}>
          <p className="text-sm text-gray-500 dark:text-gray-400">{item.title}</p>
          <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">{item.value}</p>
        </div>
      ))}
    </div>
  </section>
);

interface FinancialBarItem {
  label: string;
  value: number;
  barClass: string;
}

interface DashboardFinancialSummaryProps {
  items: FinancialBarItem[];
  formatNumber: (n: number, opts?: { suffix?: string }) => string;
}

export const DashboardFinancialSummary: React.FC<DashboardFinancialSummaryProps> = ({ items, formatNumber }) => {
  const maxValue = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className={`${dashPanel} p-5 h-full`}>
      <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">الملخص المالي</h3>
      <div className="space-y-4">
        {items.map((item) => {
          const width = Math.max(4, Math.round((item.value / maxValue) * 100));
          return (
            <div key={item.label}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-gray-900 dark:text-white" dir="ltr">
                  {formatNumber(item.value, { suffix: ' د.ع' })}
                </span>
                <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700/80">
                <div className={`h-full rounded-full ${item.barClass}`} style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface SubscriberBarItem {
  label: string;
  value: number;
  barClass: string;
}

interface DashboardSubscriberChartProps {
  items: SubscriberBarItem[];
  formatNumber: (n: number) => string;
}

export const DashboardSubscriberChart: React.FC<DashboardSubscriberChartProps> = ({ items, formatNumber }) => {
  const maxValue = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className={`${dashPanel} p-5 h-full`}>
      <h3 className="mb-2 text-base font-semibold text-gray-900 dark:text-white">حالة المشتركين</h3>
      <div className="flex items-end justify-around gap-2 sm:gap-4 pt-2 pb-1 min-h-[220px]">
        {items.map((item) => {
          const heightPct = item.value > 0 ? Math.max(12, Math.round((item.value / maxValue) * 100)) : 4;
          return (
            <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="flex h-36 w-full max-w-[64px] items-end justify-center">
                <div
                  className={`w-full rounded-t-xl ${item.barClass}`}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span className="text-lg font-bold text-gray-900 dark:text-white">{formatNumber(item.value)}</span>
              <span className="text-center text-[11px] leading-tight text-gray-500 dark:text-gray-400">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface DashboardRecentTasksTableProps {
  tasks: EmployeeTask[];
}

export const DashboardRecentTasksTable: React.FC<DashboardRecentTasksTableProps> = ({ tasks }) => (
  <div className={`${dashPanel} overflow-hidden`}>
    <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-700">
      <h3 className="text-base font-semibold text-gray-900 dark:text-white">احدث المهام للموظفين</h3>
    </div>
    <div className="overflow-x-auto">
      <table className="min-w-full text-right text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/80 dark:border-gray-700 dark:bg-gray-900/30">
            <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">اسم الموظف</th>
            <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">نوع المهمة</th>
            <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">حالة المهمة</th>
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                لا توجد مهام حديثة
              </td>
            </tr>
          ) : (
            tasks.map((task) => {
              const badge = taskStatusBadge(task.status);
              return (
                <tr
                  key={task.id}
                  className="border-b border-gray-50 last:border-0 dark:border-gray-700/60"
                >
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                    {task.employeeFullName || task.employeeName || task.employeeUserName || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{taskTypeLabel(task.taskType)}</td>
                  <td className="px-4 py-3">
                    <WakeelBadge color={badge.color}>{badge.label}</WakeelBadge>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  </div>
);

interface DashboardRecentActivationsTableProps {
  receipts: RenewalReceipt[];
  formatNumber: (n: number, opts?: { suffix?: string }) => string;
}

export const DashboardRecentActivationsTable: React.FC<DashboardRecentActivationsTableProps> = ({
  receipts,
  formatNumber,
}) => (
  <div className={`${dashPanel} overflow-hidden`}>
    <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-700">
      <h3 className="text-base font-semibold text-gray-900 dark:text-white">احدث التفعيلات</h3>
    </div>
    <div className="overflow-x-auto">
      <table className="min-w-full text-right text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/80 dark:border-gray-700 dark:bg-gray-900/30">
            <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">اسم المشترك</th>
            <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">المبلغ</th>
            <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">الباقة</th>
          </tr>
        </thead>
        <tbody>
          {receipts.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                لا توجد تفعيلات حديثة
              </td>
            </tr>
          ) : (
            receipts.map((receipt) => (
              <tr
                key={receipt.id}
                className="border-b border-gray-50 last:border-0 dark:border-gray-700/60"
              >
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                  {receipt.subscriberName || '—'}
                </td>
                <td className="px-4 py-3 text-gray-800 dark:text-gray-200">
                  {formatNumber(receipt.amountPaid ?? receipt.finalPrice ?? 0, { suffix: ' د.ع' })}
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{receipt.newProfileName || '—'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
);

interface DashboardHeaderProps {
  userName: string;
  lastUpdated: Date;
  onRefresh: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({ userName, lastUpdated, onRefresh }) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">مرحباً، {userName}</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        آخر تحديث: {lastUpdated.toLocaleTimeString('ar-EG')}
      </p>
    </div>
    <button
      type="button"
      onClick={onRefresh}
      className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-700"
    >
      <RefreshCw className="h-4 w-4" />
      <span>تحديث</span>
    </button>
  </div>
);
