import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, RefreshCw, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDigits } from '../contexts/DigitsContext';
import { apiService } from '../services/api';
import { Agent, ActivityType, UserRole } from '../types';
import Pagination from '../components/Pagination';
import { STANDARD_PAGE_SIZE_OPTIONS } from '../constants/pagination';

function getBaghdadToday(): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Baghdad',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch (_) {}
  return new Date().toISOString().split('T')[0];
}

function getBaghdadDateDaysAgo(days: number): string {
  const today = getBaghdadToday();
  const [y, m, d] = today.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

const ActivityLogPage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const { formatDate } = useDigits();

  const isAdmin = user?.role === UserRole.Admin;

  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(STANDARD_PAGE_SIZE_OPTIONS[0]);

  const [activityType, setActivityType] = useState<string>('');
  const [subscriberName, setSubscriberName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState(getBaghdadDateDaysAgo(7));
  const [toDate, setToDate] = useState(getBaghdadToday());

  const [appliedActivityType, setAppliedActivityType] = useState<string>('');
  const [appliedSubscriberName, setAppliedSubscriberName] = useState('');
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('');
  const [appliedFromDate, setAppliedFromDate] = useState(getBaghdadDateDaysAgo(7));
  const [appliedToDate, setAppliedToDate] = useState(getBaghdadToday());

  const { data: allAgentsResponse } = useQuery({
    queryKey: ['allAgents', 'activity-log-admin'],
    queryFn: () => apiService.getAllAgents({ page: 1, pageSize: 5000 }),
    enabled: isAuthenticated && isAdmin,
    retry: false,
  });
  const adminAgents = (allAgentsResponse?.data ?? []) as Agent[];

  const { data: activityTypes = [] } = useQuery({
    queryKey: ['activityTypes'],
    queryFn: () => apiService.getActivityTypes(),
    enabled: isAuthenticated,
    staleTime: 60_000 * 10,
  });

  const queryKey = useMemo(
    () =>
      [
        'activityLog',
        isAdmin ? selectedAgentId || null : null,
        appliedActivityType || null,
        appliedSubscriberName || null,
        appliedSearchTerm || null,
        appliedFromDate || null,
        appliedToDate || null,
        currentPage,
        pageSize,
      ] as const,
    [
      isAdmin,
      selectedAgentId,
      appliedActivityType,
      appliedSubscriberName,
      appliedSearchTerm,
      appliedFromDate,
      appliedToDate,
      currentPage,
      pageSize,
    ]
  );

  const { data: logResponse, isLoading, isFetching, refetch, error } = useQuery({
    queryKey,
    queryFn: () =>
      apiService.getActivityLog({
        agentId: isAdmin ? selectedAgentId || undefined : undefined,
        page: currentPage,
        pageSize,
        activityType: appliedActivityType ? (Number(appliedActivityType) as ActivityType) : undefined,
        subscriberName: appliedSubscriberName.trim() || undefined,
        searchTerm: appliedSearchTerm.trim() || undefined,
        fromDate: appliedFromDate || undefined,
        toDate: appliedToDate || undefined,
      }),
    enabled: isAuthenticated && (!isAdmin || !!selectedAgentId),
    refetchOnWindowFocus: false,
  });

  const rows = logResponse?.data ?? [];

  const applyFilters = () => {
    setAppliedActivityType(activityType);
    setAppliedSubscriberName(subscriberName);
    setAppliedSearchTerm(searchTerm);
    setAppliedFromDate(fromDate);
    setAppliedToDate(toDate);
    setCurrentPage(1);
  };

  const resetFilters = () => {
    const defaultFrom = getBaghdadDateDaysAgo(7);
    const defaultTo = getBaghdadToday();
    setActivityType('');
    setSubscriberName('');
    setSearchTerm('');
    setFromDate(defaultFrom);
    setToDate(defaultTo);
    setAppliedActivityType('');
    setAppliedSubscriberName('');
    setAppliedSearchTerm('');
    setAppliedFromDate(defaultFrom);
    setAppliedToDate(defaultTo);
    setCurrentPage(1);
  };

  const formatDateTime = (value: string) =>
    formatDate(value, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

  return (
    <div className="p-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <History className="h-7 w-7 text-primary-600" />
            سجل الحركات
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            تسجيل العمليات: تفعيل، تسديد، تعديل، حذف، تعبئة، مزامنة، وغيرها
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <select
              value={selectedAgentId}
              onChange={(e) => {
                setSelectedAgentId(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm"
              title="اختيار الوكيل"
            >
              <option value="">اختر الوكيل...</option>
              {adminAgents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.companyName || a.fullName || a.username}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isAdmin && !selectedAgentId}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md text-sm disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            تحديث
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600 dark:text-gray-400">نوع الحركة</span>
            <select
              value={activityType}
              onChange={(e) => setActivityType(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
              disabled={isAdmin && !selectedAgentId}
            >
              <option value="">الكل</option>
              {activityTypes.map((t) => (
                <option key={t.value} value={String(t.value)}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600 dark:text-gray-400">اسم المشترك</span>
            <input
              type="text"
              value={subscriberName}
              onChange={(e) => setSubscriberName(e.target.value)}
              placeholder="بحث باسم المشترك..."
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
              disabled={isAdmin && !selectedAgentId}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600 dark:text-gray-400">بحث عام</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="موظف، تفاصيل..."
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
              disabled={isAdmin && !selectedAgentId}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600 dark:text-gray-400">من تاريخ</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
              disabled={isAdmin && !selectedAgentId}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600 dark:text-gray-400">إلى تاريخ</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
              disabled={isAdmin && !selectedAgentId}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            type="button"
            onClick={applyFilters}
            disabled={isAdmin && !selectedAgentId}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md text-sm disabled:opacity-50"
          >
            <Search className="h-4 w-4" />
            تطبيق الفلتر
          </button>
          <button
            type="button"
            onClick={resetFilters}
            disabled={isAdmin && !selectedAgentId}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-200 disabled:opacity-50"
          >
            إعادة ضبط
          </button>
        </div>
      </div>

      {isAdmin && !selectedAgentId ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          يرجى اختيار الوكيل لعرض سجل الحركات.
        </div>
      ) : error ? (
        <div className="text-center py-12 text-red-600 dark:text-red-400">
          تعذّر تحميل سجل الحركات.
        </div>
      ) : (
        <>
          <div className="wakeel-table-wrap overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
            <table className="wakeel-table min-w-full">
              <thead>
                <tr>
                  <th>التاريخ والوقت</th>
                  <th>الموظف</th>
                  <th>نوع الحركة</th>
                  <th>المشترك</th>
                  <th>التفاصيل</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-gray-500">
                      جاري التحميل...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-gray-500 dark:text-gray-400">
                      لا توجد حركات في الفترة المحددة.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td className="whitespace-nowrap">{formatDateTime(row.createdAt)}</td>
                      <td>
                        <div className="font-medium text-gray-900 dark:text-white">{row.actorName || '—'}</div>
                        {row.actorUsername ? (
                          <div className="text-xs text-gray-500 dark:text-gray-400">{row.actorUsername}</div>
                        ) : null}
                      </td>
                      <td>
                        <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                          {row.activityTypeName}
                        </span>
                      </td>
                      <td>
                        {row.subscriberName || row.subscriberUsername ? (
                          <>
                            <div>{row.subscriberName || '—'}</div>
                            {row.subscriberUsername ? (
                              <div className="text-xs text-gray-500 dark:text-gray-400">{row.subscriberUsername}</div>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="max-w-xs truncate" title={row.details ?? undefined}>
                        {row.details || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {logResponse && logResponse.totalItems > 0 && (
            <Pagination
              currentPage={logResponse.currentPage}
              totalPages={logResponse.totalPages}
              totalItems={logResponse.totalItems}
              pageSize={logResponse.pageSize}
              hasNextPage={logResponse.hasNextPage}
              hasPreviousPage={logResponse.hasPreviousPage}
              onPageChange={setCurrentPage}
              pageSizeOptions={[...STANDARD_PAGE_SIZE_OPTIONS]}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
              className="mt-4"
            />
          )}
        </>
      )}
    </div>
  );
};

export default ActivityLogPage;
