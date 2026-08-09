import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { StatCard } from '../components/StatCard';
import WifiLoaderComponent from '../components/WifiLoaderComponent';
import IraqSubAgentsMap from '../components/IraqSubAgentsMap';
import { DashboardCharts, DashboardSubscriberAnalytics } from '../components/dashboard/DashboardCharts';
import {
  DashboardCreditBalanceCard,
  DashboardDebtInsights,
  DashboardHeader,
  DashboardOperationalOverview,
  DashboardRecentActivationsTable,
  DashboardRecentTasksTable,
  DashboardRegionResellerFilters,
  DashboardSummaryAmounts,
} from '../components/dashboard/DashboardWidgets';
import { apiService, ApiService } from '../services/api';
import { showSuccess, showError } from '../utils/notifications';
import { createXlsxBlob } from '../utils/excelExport';
import { getAgentBalance } from '../utils/balance';
import { useAuth } from '../contexts/AuthContext';
import { useOffline } from '../contexts/OfflineContext';
import { useDigits } from '../contexts/DigitsContext';
import { fetchDebtsWithCache, fetchDashboardWithCache } from '../services/offlineSync';
import {
  buildRegionResellerFilterParams,
  filterResellersByRegion,
  loadStoredOperationalRegionId,
  loadStoredOperationalResellerId,
  saveStoredOperationalRegionId,
  saveStoredOperationalResellerId,
} from '../utils/operationalFilters';
import {
  Agent,
  PaginatedResponse,
  SubscribersDashboardStats,
  MainAgentDashboardDto,
  Debt,
  DebtStatus,
  PaginationParams,
  UserRole,
  AgentReseller,
  AgentRegion,
  RenewalReceipt,
  EmployeeTask,
  ActivationPaymentMethod,
  Subscriber,
} from '../types';
import { 
  Users, 
  UserCheck, 
  CreditCard,
  Wallet,
  XCircle,
  X,
  FileSpreadsheet,
  ShoppingCart
} from 'lucide-react';

const DASHBOARD_AGENT_STORAGE_KEY = 'wakeel_dashboard_agentId';

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

function getPreviousDateRange(fromDate: string, toDate: string): { fromDate: string; toDate: string } {
  const from = new Date(`${fromDate}T00:00:00Z`);
  const to = new Date(`${toDate}T00:00:00Z`);
  const rangeDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1);
  const previousTo = new Date(from);
  previousTo.setUTCDate(previousTo.getUTCDate() - 1);
  const previousFrom = new Date(previousTo);
  previousFrom.setUTCDate(previousFrom.getUTCDate() - rangeDays + 1);
  return {
    fromDate: previousFrom.toISOString().slice(0, 10),
    toDate: previousTo.toISOString().slice(0, 10),
  };
}

function getChangePercent(current: number, previous: number): number | undefined {
  if (!previous) return undefined;
  return Math.round(((current - previous) / previous) * 100);
}

function canAccessAccountsSummary(role?: UserRole, canAccessAccounts?: boolean): boolean {
  if (role === UserRole.Employee) return canAccessAccounts !== false;
  return role === UserRole.Admin || role === UserRole.Agent || role === UserRole.SubAgent;
}

const DashboardPage: React.FC = () => {
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const navigate = useNavigate();
  const { user } = useAuth();
  const { online } = useOffline();
  const { formatDate, formatNumber } = useDigits();
  const isAdmin = user?.role === UserRole.Admin;
  const isMainAgent = user?.role === UserRole.MainAgent;
  const isAgentOrSubAgentOrEmployee =
    user?.role === UserRole.Agent || user?.role === UserRole.SubAgent || user?.role === UserRole.Employee;
  const canManageEmployeeTasks =
    user?.role === UserRole.Agent || user?.role === UserRole.SubAgent || user?.role === UserRole.Admin;
  const balanceQueryEnabled =
    user?.role !== UserRole.Employee || user?.canAccessAccounts !== false;
  const [balance, setBalance] = useState(0);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [selectedOperationalRegionId, setSelectedOperationalRegionId] = useState('');
  const [selectedOperationalResellerId, setSelectedOperationalResellerId] = useState('');
  const [showIncomingModal, setShowIncomingModal] = useState(false);
  const [incomingFromDate, setIncomingFromDate] = useState('');
  const [incomingToDate, setIncomingToDate] = useState('');
  const [appliedIncomingFromDate, setAppliedIncomingFromDate] = useState('');
  const [appliedIncomingToDate, setAppliedIncomingToDate] = useState('');
  const [showRenewalsExcelModal, setShowRenewalsExcelModal] = useState(false);
  const [renewalsFromDate, setRenewalsFromDate] = useState('');
  const [renewalsToDate, setRenewalsToDate] = useState('');
  const [renewalsExporting, setRenewalsExporting] = useState(false);
  const [showDebtsExcelModal, setShowDebtsExcelModal] = useState(false);
  const [debtsFromDate, setDebtsFromDate] = useState('');
  const [debtsToDate, setDebtsToDate] = useState('');
  /** 'received' = الواصلة (لها paymentCreatedAt)، 'unreceived' = الغير واصلة (بدون paymentCreatedAt) */
  const [debtExportFilter, setDebtExportFilter] = useState<'received' | 'unreceived'>('received');
  const [debtsExporting, setDebtsExporting] = useState(false);

  useEffect(() => {
    apiService.getBalance()
      .then((r) => setBalance(r.balanceIqd))
      .catch(() => setBalance(getAgentBalance(user?.id)));
  }, [user?.id]);
  useEffect(() => {
    const onFocus = () => {
      apiService.getBalance()
        .then((r) => setBalance(r.balanceIqd))
        .catch(() => setBalance(getAgentBalance(user?.id)));
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user?.id]);

  const { data: agentsResponse } = useQuery<PaginatedResponse<Agent>>({
    queryKey: ['dashboard-agents'],
    enabled: !!isAdmin,
    queryFn: () => {
      const params: PaginationParams = { page: 1, pageSize: 2000 };
      return apiService.getAllAgents(params);
    },
  });

  const agents = agentsResponse?.data ?? [];

  useEffect(() => {
    if (!isAdmin) return;
    if (!agents.length) return;
    const saved = localStorage.getItem(DASHBOARD_AGENT_STORAGE_KEY);
    if (saved && agents.some(a => a.id === saved)) {
      setSelectedAgentId(saved);
    } else {
      setSelectedAgentId(agents[0].id);
    }
  }, [isAdmin, agents.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isAdmin) return;
    if (!selectedAgentId) return;
    localStorage.setItem(DASHBOARD_AGENT_STORAGE_KEY, selectedAgentId);
  }, [isAdmin, selectedAgentId]);

  const { data: mainAgentDashboard, error: mainAgentDashboardError, refetch: refetchMainAgentDashboard, isLoading: mainAgentDashboardLoading } = useQuery<MainAgentDashboardDto>({
    queryKey: ['main-agent-dashboard'],
    queryFn: () => apiService.getMainAgentDashboard(),
    enabled: !!isMainAgent,
    refetchInterval: 30000,
  });

  const { data: mainAgentSubAgentsResponse } = useQuery({
    queryKey: ['main-agent-sub-agents-map'],
    queryFn: () => apiService.getMainAgentSubAgents({ page: 1, pageSize: 300 }),
    enabled: !!isMainAgent,
  });
  const mainAgentSubAgentsList = mainAgentSubAgentsResponse?.data ?? [];

  const { data: myResellers = [] } = useQuery<AgentReseller[]>({
    queryKey: ['dashboard-my-resellers'],
    queryFn: () => apiService.getMyResellers(),
    enabled: isAgentOrSubAgentOrEmployee && !isMainAgent,
  });

  const { data: myRegions = [] } = useQuery<AgentRegion[]>({
    queryKey: ['myRegions'],
    queryFn: () => apiService.getMyRegions(true),
    enabled: isAgentOrSubAgentOrEmployee && !isMainAgent,
  });

  const filteredOperationalResellers = useMemo(
    () => filterResellersByRegion(myResellers, selectedOperationalRegionId),
    [myResellers, selectedOperationalRegionId]
  );

  const regionResellerFilter = useMemo(
    () => buildRegionResellerFilterParams(selectedOperationalRegionId, selectedOperationalResellerId, myResellers),
    [selectedOperationalRegionId, selectedOperationalResellerId, myResellers]
  );

  const { data: balanceDetail, refetch: refetchBalanceDetail } = useQuery({
    queryKey: ['balance-detail'],
    queryFn: () => apiService.getBalance(),
    enabled: !isMainAgent && !isAdmin && balanceQueryEnabled,
  });

  const { data: stats, error, refetch: refetchStats, isLoading: statsLoading } = useQuery<SubscribersDashboardStats>({
    queryKey: [
      'subscribers-dashboard',
      isAdmin ? selectedAgentId : 'me',
      appliedIncomingFromDate || null,
      appliedIncomingToDate || null,
      regionResellerFilter.regionId || null,
      regionResellerFilter.resellerId || null,
      online,
    ],
    enabled: !isMainAgent && (!isAdmin || !!selectedAgentId),
    queryFn: () =>
      fetchDashboardWithCache(
        online,
        isAdmin
          ? {
              agentId: selectedAgentId,
              fromDate: appliedIncomingFromDate || undefined,
              toDate: appliedIncomingToDate || undefined,
              regionId: regionResellerFilter.regionId,
              resellerId: regionResellerFilter.resellerId,
            }
          : {
              fromDate: appliedIncomingFromDate || undefined,
              toDate: appliedIncomingToDate || undefined,
              regionId: regionResellerFilter.regionId,
              resellerId: regionResellerFilter.resellerId,
            }
      ),
    refetchInterval: 30000,
  });

  const { data: recentReceiptsData, isLoading: recentActivationsLoading } = useQuery<{ receipts: RenewalReceipt[] }>({
    queryKey: [
      'dashboard-recent-receipts',
      regionResellerFilter.regionId || null,
      regionResellerFilter.resellerId || null,
      appliedIncomingFromDate || null,
      appliedIncomingToDate || null,
      isAdmin ? selectedAgentId : 'me',
    ],
    queryFn: async () => {
      const res = await apiService.getRenewalReceipts(
        1,
        5,
        appliedIncomingFromDate || undefined,
        appliedIncomingToDate || undefined,
        regionResellerFilter.resellerId,
        regionResellerFilter.regionId
      );
      return { receipts: res.receipts ?? [] };
    },
    enabled: !isMainAgent && (!isAdmin || !!selectedAgentId),
    refetchInterval: 30000,
  });

  const recentReceipts = recentReceiptsData?.receipts ?? [];

  const dashboardAccountsFromDate = appliedIncomingFromDate || getBaghdadDateDaysAgo(30);
  const dashboardAccountsToDate = appliedIncomingToDate || getBaghdadToday();
  const previousDashboardPeriod = useMemo(
    () => getPreviousDateRange(dashboardAccountsFromDate, dashboardAccountsToDate),
    [dashboardAccountsFromDate, dashboardAccountsToDate]
  );

  const { data: accountsSummary } = useQuery({
    queryKey: [
      'dashboard-accounts-summary',
      dashboardAccountsFromDate,
      dashboardAccountsToDate,
      regionResellerFilter.regionId || null,
      regionResellerFilter.resellerId || null,
      isAdmin ? selectedAgentId : 'me',
    ],
    queryFn: () =>
      apiService.getAccounts({
        fromDate: dashboardAccountsFromDate,
        toDate: dashboardAccountsToDate,
        regionId: regionResellerFilter.regionId,
        resellerId: regionResellerFilter.resellerId,
        agentId: isAdmin ? selectedAgentId : undefined,
        page: 1,
        pageSize: 1,
      }),
    enabled:
      !isMainAgent &&
      canAccessAccountsSummary(user?.role, user?.canAccessAccounts) &&
      (!isAdmin || !!selectedAgentId),
  });

  const { data: previousPeriodSummary } = useQuery({
    queryKey: [
      'dashboard-previous-period-summary',
      previousDashboardPeriod.fromDate,
      previousDashboardPeriod.toDate,
      regionResellerFilter.regionId || null,
      regionResellerFilter.resellerId || null,
      isAdmin ? selectedAgentId : 'me',
    ],
    queryFn: async () => {
      const baseParams = {
        fromDate: previousDashboardPeriod.fromDate,
        toDate: previousDashboardPeriod.toDate,
        regionId: regionResellerFilter.regionId,
        resellerId: regionResellerFilter.resellerId,
        agentId: isAdmin ? selectedAgentId : undefined,
      };
      const [previousStats, previousAccounts] = await Promise.all([
        apiService.getSubscribersDashboard(baseParams),
        apiService.getAccounts({ ...baseParams, page: 1, pageSize: 1 }),
      ]);
      return { previousStats, previousAccounts };
    },
    enabled:
      !isMainAgent &&
      canAccessAccountsSummary(user?.role, user?.canAccessAccounts) &&
      (!isAdmin || !!selectedAgentId),
  });

  const { data: activationPaymentSummary } = useQuery({
    queryKey: [
      'dashboard-activation-payment-summary',
      dashboardAccountsFromDate,
      dashboardAccountsToDate,
      regionResellerFilter.regionId || null,
      regionResellerFilter.resellerId || null,
      isAdmin ? selectedAgentId : 'me',
    ],
    queryFn: async () => {
      const baseParams = {
        fromDate: dashboardAccountsFromDate,
        toDate: dashboardAccountsToDate,
        regionId: regionResellerFilter.regionId,
        resellerId: regionResellerFilter.resellerId,
        agentId: isAdmin ? selectedAgentId : undefined,
        page: 1,
        pageSize: 1,
      };
      const [cash, master] = await Promise.all([
        apiService.getAccounts({ ...baseParams, activationPaymentMethod: ActivationPaymentMethod.Cash }),
        apiService.getAccounts({ ...baseParams, activationPaymentMethod: ActivationPaymentMethod.Master }),
      ]);
      return {
        cash: Number(cash.totalPackageIncome ?? cash.amountPaid ?? 0),
        master: Number(master.totalPackageIncome ?? master.amountPaid ?? 0),
      };
    },
    enabled:
      !isMainAgent &&
      canAccessAccountsSummary(user?.role, user?.canAccessAccounts) &&
      (!isAdmin || !!selectedAgentId),
  });

  const { data: subscribersAnalyticsData } = useQuery({
    queryKey: [
      'dashboard-subscribers-analytics',
      regionResellerFilter.regionId || null,
      regionResellerFilter.resellerId || null,
      isAdmin ? selectedAgentId : 'me',
    ],
    queryFn: () => apiService.getSubscribers({ page: 1, pageSize: 10_000 }),
    enabled: !isMainAgent && !isAdmin,
    staleTime: 60_000,
  });

  const { data: recentTasksResponse } = useQuery<{ data: EmployeeTask[] }>({
    queryKey: ['dashboard-recent-tasks', isAdmin ? selectedAgentId : 'me'],
    queryFn: async () => {
      const res = await apiService.getAgentEmployeeTasks({
        page: 1,
        pageSize: 5,
        agentId: isAdmin ? selectedAgentId : undefined,
      });
      return { data: res.data ?? [] };
    },
    enabled: !isMainAgent && canManageEmployeeTasks && (!isAdmin || !!selectedAgentId),
  });

  const recentTasks = recentTasksResponse?.data ?? [];

  const { data: debtsData, isLoading: debtsLoading } = useQuery({
    queryKey: [
      'debts-stats',
      online,
      regionResellerFilter.regionId || null,
      regionResellerFilter.resellerId || null,
    ],
    queryFn: () =>
      fetchDebtsWithCache(
        online,
        {
          page: 1,
          pageSize: 10000,
          regionId: regionResellerFilter.regionId,
          resellerId: regionResellerFilter.resellerId,
        },
        false
      ),
    refetchInterval: 30000,
    enabled: !isMainAgent,
  });

  const { data: paidDebtsInPeriod } = useQuery({
    queryKey: [
      'dashboard-debt-payments',
      online,
      dashboardAccountsFromDate,
      dashboardAccountsToDate,
      regionResellerFilter.regionId || null,
      regionResellerFilter.resellerId || null,
    ],
    queryFn: () =>
      fetchDebtsWithCache(
        online,
        {
          page: 1,
          pageSize: 1,
          paymentCreatedAtFrom: `${dashboardAccountsFromDate}T00:00:00.000Z`,
          paymentCreatedAtTo: `${dashboardAccountsToDate}T23:59:59.999Z`,
          regionId: regionResellerFilter.regionId,
          resellerId: regionResellerFilter.resellerId,
        },
        false
      ),
    enabled: !isMainAgent,
  });

  const debtsStats = {
    totalDebtAmount: stats?.totalDebtAmount ?? (debtsData?.data?.reduce((total: number, debt: Debt) => total + debt.amount, 0) || 0),
    totalDebtors: debtsData?.data?.length || 0
  };

  const debtInsights = useMemo(() => {
    const currentDate = new Date();
    const unpaidDebts = (debtsData?.data ?? []).filter((debt: Debt) => debt.status !== DebtStatus.Paid);
    const remainingAmount = (debt: Debt) =>
      Math.max(0, Number(debt.amount ?? 0) - Number(debt.totalPaidAmount ?? 0));
    const aging = [
      { label: '0–30 يوم', amount: 0, colorClass: 'bg-amber-400' },
      { label: '31–60 يوم', amount: 0, colorClass: 'bg-orange-500' },
      { label: 'أكثر من 60 يوم', amount: 0, colorClass: 'bg-rose-500' },
    ];
    const debtors = new Map<string, number>();
    let overdueAmount = 0;

    unpaidDebts.forEach((debt: Debt) => {
      const amount = remainingAmount(debt);
      const debtDate = new Date(debt.debtDate || debt.createdAt);
      const ageInDays = Number.isNaN(debtDate.getTime())
        ? 0
        : Math.max(0, Math.floor((currentDate.getTime() - debtDate.getTime()) / 86_400_000));
      const dueDate = new Date(debt.dueDate);
      if (!Number.isNaN(dueDate.getTime()) && dueDate < currentDate) overdueAmount += amount;
      if (ageInDays <= 30) aging[0].amount += amount;
      else if (ageInDays <= 60) aging[1].amount += amount;
      else aging[2].amount += amount;
      debtors.set(debt.subscriberName || 'مشترك غير محدد', (debtors.get(debt.subscriberName || 'مشترك غير محدد') ?? 0) + amount);
    });

    return {
      aging,
      overdueAmount,
      topDebtors: Array.from(debtors.entries())
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5),
    };
  }, [debtsData]);

  const subscriberAnalytics = useMemo(() => {
    const filteredSubscribers = (subscribersAnalyticsData?.data ?? []).filter((subscriber: Subscriber) => {
      if (regionResellerFilter.regionId && subscriber.regionId !== regionResellerFilter.regionId) return false;
      if (regionResellerFilter.resellerId && subscriber.agentResellerId !== regionResellerFilter.resellerId) return false;
      return true;
    });
    const makeDistribution = (values: string[], fallback: string) => {
      const counts = new Map<string, number>();
      values.forEach((value) => counts.set(value || fallback, (counts.get(value || fallback) ?? 0) + 1));
      return Array.from(counts.entries())
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
    };
    const isDaily = Math.round(
      (new Date(`${dashboardAccountsToDate}T00:00:00Z`).getTime() - new Date(`${dashboardAccountsFromDate}T00:00:00Z`).getTime()) /
        86_400_000
    ) <= 31;
    const getBucket = (value?: string) => {
      if (!value) return null;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return null;
      return isDaily ? date.toISOString().slice(0, 10) : date.toISOString().slice(0, 7);
    };
    const inPeriod = (value?: string) => {
      const bucket = getBucket(value);
      const lowerBound = isDaily ? dashboardAccountsFromDate : dashboardAccountsFromDate.slice(0, 7);
      const upperBound = isDaily ? dashboardAccountsToDate : dashboardAccountsToDate.slice(0, 7);
      return !!bucket && bucket >= lowerBound && bucket <= upperBound;
    };
    const trend = new Map<string, { label: string; activations: number; expirations: number }>();
    filteredSubscribers.forEach((subscriber: Subscriber) => {
      if (inPeriod(subscriber.activationDate)) {
        const label = getBucket(subscriber.activationDate)!;
        const current = trend.get(label) ?? { label, activations: 0, expirations: 0 };
        current.activations += 1;
        trend.set(label, current);
      }
      if (inPeriod(subscriber.expirationDate)) {
        const label = getBucket(subscriber.expirationDate)!;
        const current = trend.get(label) ?? { label, activations: 0, expirations: 0 };
        current.expirations += 1;
        trend.set(label, current);
      }
    });

    return {
      trend: Array.from(trend.values()).sort((a, b) => a.label.localeCompare(b.label)),
      distributions: {
        regions: makeDistribution(filteredSubscribers.map((subscriber: Subscriber) => subscriber.regionName || subscriber.regionId || ''), 'غير محددة'),
        resellers: makeDistribution(filteredSubscribers.map((subscriber: Subscriber) => subscriber.agentResellerName || subscriber.agentResellerId || ''), 'غير محدد'),
        profiles: makeDistribution(filteredSubscribers.map((subscriber: Subscriber) => subscriber.profileName), 'غير محددة'),
        statuses: makeDistribution(
          filteredSubscribers.map((subscriber: Subscriber) =>
            subscriber.isSubscriptionActive ?? subscriber.isActive ? 'فعال' : 'غير فعال'
          ),
          'غير محدد'
        ),
      },
    };
  }, [
    subscribersAnalyticsData,
    regionResellerFilter.regionId,
    regionResellerFilter.resellerId,
    dashboardAccountsFromDate,
    dashboardAccountsToDate,
  ]);

  // Update last updated when data changes
  React.useEffect(() => {
    if (isMainAgent ? mainAgentDashboard : stats) {
      setLastUpdated(new Date());
    }
  }, [isMainAgent, mainAgentDashboard, stats]);

  useEffect(() => {
    if (!isAgentOrSubAgentOrEmployee || isMainAgent) return;
    setSelectedOperationalRegionId(loadStoredOperationalRegionId());
    setSelectedOperationalResellerId(loadStoredOperationalResellerId());
  }, [isAgentOrSubAgentOrEmployee, isMainAgent]);

  useEffect(() => {
    if (!isAgentOrSubAgentOrEmployee || isMainAgent) return;
    const regionExists = !selectedOperationalRegionId || myRegions.some((r) => r.id === selectedOperationalRegionId);
    if (!regionExists) {
      setSelectedOperationalRegionId('');
      saveStoredOperationalRegionId('');
    }
    const resellerExists =
      !selectedOperationalResellerId || myResellers.some((r) => r.id === selectedOperationalResellerId);
    if (!resellerExists) {
      setSelectedOperationalResellerId('');
      saveStoredOperationalResellerId('');
    }
  }, [
    isAgentOrSubAgentOrEmployee,
    isMainAgent,
    myRegions,
    myResellers,
    selectedOperationalRegionId,
    selectedOperationalResellerId,
  ]);

  const displayBalance = useMemo(() => {
    if (selectedOperationalResellerId) {
      if (stats?.regionalBalanceIqd != null) return Number(stats.regionalBalanceIqd);
      const match = balanceDetail?.resellerBalances?.find((r) => r.id === selectedOperationalResellerId);
      return match?.balanceIqd ?? 0;
    }
    if (selectedOperationalRegionId) {
      const regionResellerIds = new Set(
        filterResellersByRegion(myResellers, selectedOperationalRegionId).map((r) => r.id)
      );
      const sum = (balanceDetail?.resellerBalances ?? [])
        .filter((r) => regionResellerIds.has(r.id))
        .reduce((acc, r) => acc + (r.balanceIqd ?? 0), 0);
      if (sum > 0) return sum;
      if (stats?.regionalBalanceIqd != null) return Number(stats.regionalBalanceIqd);
      return 0;
    }
    return balanceDetail?.balanceIqd ?? balance;
  }, [
    selectedOperationalResellerId,
    selectedOperationalRegionId,
    stats?.regionalBalanceIqd,
    balanceDetail,
    myResellers,
    balance,
  ]);

  const balanceCardLabel = useMemo(() => {
    if (selectedOperationalResellerId) {
      return myResellers.find((r) => r.id === selectedOperationalResellerId)?.name ?? 'الرسيلر';
    }
    if (selectedOperationalRegionId) {
      return myRegions.find((r) => r.id === selectedOperationalRegionId)?.name ?? 'المنطقة';
    }
    return 'الرصيد الإجمالي';
  }, [selectedOperationalResellerId, selectedOperationalRegionId, myResellers, myRegions]);

  const summaryAmountItems = useMemo(
    () => [
      {
        title: 'الوارد الكلي',
        value: formatNumber(accountsSummary?.totalGeneralIncome ?? stats?.incomingAmount ?? 0, { suffix: ' د.ع' }),
        changePercent: getChangePercent(
          Number(accountsSummary?.totalGeneralIncome ?? stats?.incomingAmount ?? 0),
          Number(previousPeriodSummary?.previousAccounts.totalGeneralIncome ?? previousPeriodSummary?.previousStats.incomingAmount ?? 0)
        ),
      },
      {
        title: 'مبالغ الاشتراكات',
        value: formatNumber(accountsSummary?.totalPackageIncome ?? accountsSummary?.amountPaid ?? 0, { suffix: ' د.ع' }),
        changePercent: getChangePercent(
          Number(accountsSummary?.totalPackageIncome ?? accountsSummary?.amountPaid ?? 0),
          Number(previousPeriodSummary?.previousAccounts.totalPackageIncome ?? previousPeriodSummary?.previousAccounts.amountPaid ?? 0)
        ),
      },
      {
        title: 'مبالغ الأجور',
        value: formatNumber(accountsSummary?.totalServiceFeesIncome ?? 0, { suffix: ' د.ع' }),
        changePercent: getChangePercent(
          Number(accountsSummary?.totalServiceFeesIncome ?? 0),
          Number(previousPeriodSummary?.previousAccounts.totalServiceFeesIncome ?? 0)
        ),
      },
    ],
    [accountsSummary, stats?.incomingAmount, previousPeriodSummary, formatNumber]
  );

  const financialChartValues = useMemo(
    () => [
      { label: 'الوارد', value: Number(stats?.incomingAmount ?? 0), color: '#10b981' },
      { label: 'الديون', value: Number(debtsStats.totalDebtAmount ?? 0), color: '#8b5cf6' },
      {
        label: 'ربح التفعيل',
        value: Number(accountsSummary?.totalActivationProfit ?? 0),
        color: '#3b82f6',
      },
      {
        label: 'بيع المواد',
        value: Number(stats?.totalMaterialSales ?? 0),
        color: '#f59e0b',
      },
    ],
    [stats, debtsStats.totalDebtAmount, accountsSummary]
  );

  const subscriberChartValues = useMemo(() => {
    const total = Number(stats?.total ?? 0);
    const active = Number(stats?.active ?? 0);
    const expired = Number(stats?.expired ?? 0);
    const expiringSoon = Number(stats?.expiringWithin3Days ?? 0);
    const activeWithoutExpiring = Math.max(0, active - expiringSoon);
    const unclassified = Math.max(0, total - activeWithoutExpiring - expiringSoon - expired);

    return [
      { label: 'فعال', value: activeWithoutExpiring, color: '#10b981' },
      {
        label: 'قريب الانتهاء',
        value: expiringSoon,
        color: '#f59e0b',
      },
      { label: 'منتهي', value: expired, color: '#f43f5e' },
      { label: 'غير مصنف', value: unclassified, color: '#94a3b8' },
    ];
  }, [stats]);

  const dashboardUserName = user?.fullName || user?.username || 'مستخدم';

  // مؤقتاً: تعطيل كروت live-balance و live-online. عند إعادة التفعيل: أعد استعلام myAgent (getMyAgent) و isSasAgent و showSasCards
  // // بيانات SAS الحية (الرصيد + عدد المتصلين) — عبر ApiService لاستخدام نفس baseURL والـ JWT
  // const { data: sasBalanceData } = useQuery<{ status: string; balance?: string | null }>({
  //   queryKey: ['sas-live-balance'],
  //   enabled: isSasAgent,
  //   refetchInterval: 10000,
  //   queryFn: () => apiService.getSasLiveBalance(),
  // });

  // const { data: sasOnlineData } = useQuery<{ status: string; onlineUsers?: number; online_users?: number }>({
  //   queryKey: ['sas-live-online'],
  //   enabled: isSasAgent,
  //   refetchInterval: 10000,
  //   queryFn: () => apiService.getSasLiveOnline(),
  // });

  // const sasBalance = sasBalanceData?.balance ?? null;
  // const sasOnlineUsers = sasOnlineData?.onlineUsers ?? sasOnlineData?.online_users ?? null;

  // // كروت SAS — عند إعادة التفعيل: showSasCards = isSasAgent && (sasBalance != null || sasOnlineUsers != null)

  const handleRefresh = () => {
    if (isMainAgent) {
      refetchMainAgentDashboard();
    } else {
      refetchStats();
      if (balanceQueryEnabled) {
        refetchBalanceDetail();
      }
      apiService.getBalance()
        .then((r) => setBalance(r.balanceIqd))
        .catch(() => setBalance(getAgentBalance(user?.id)));
    }
    showSuccess('تم التحديث', 'تم تحديث البيانات بنجاح');
  };

  const handleTotalSubscribersClick = () => {
    if (isMainAgent) navigate('/admin/main-agent/sub-agents/subscribers');
    else navigate('/admin/subscribers');
  };

  const handleActiveSubscribersClick = () => {
    if (isMainAgent) navigate('/admin/main-agent/sub-agents/subscribers');
    else navigate('/admin/subscribers?status=active');
  };

  const handleExpiredClick = () => {
    if (isMainAgent) navigate('/admin/main-agent/sub-agents/subscribers');
    else navigate('/admin/subscribers?status=expired');
  };

  const handleRegionCardClick = (regionId: string) => {
    const next = selectedOperationalRegionId === regionId ? '' : regionId;
    setSelectedOperationalRegionId(next);
    saveStoredOperationalRegionId(next);
    setSelectedOperationalResellerId('');
    saveStoredOperationalResellerId('');
  };

  const handleResellerCardClick = (resellerId: string) => {
    const next = selectedOperationalResellerId === resellerId ? '' : resellerId;
    setSelectedOperationalResellerId(next);
    saveStoredOperationalResellerId(next);
    if (next) {
      const match = myResellers.find((r) => r.id === next);
      if (match?.regionId && match.regionId !== selectedOperationalRegionId) {
        setSelectedOperationalRegionId(match.regionId);
        saveStoredOperationalRegionId(match.regionId);
      }
    }
  };

  const handleBalanceClick = () => {
    navigate('/admin/balance');
  };

  const handleDebtsClick = () => {
    if (isMainAgent) navigate('/admin/main-agent/sub-agents/debts');
    else navigate('/admin/debts');
  };

  const handleMainAgentSubAgentsClick = () => {
    navigate('/admin/main-agent/sub-agents');
  };

  const handleIncomingClick = () => {
    if (isMainAgent) {
      navigate('/admin/main-agent/sub-agents/renewals');
      return;
    }
    setIncomingFromDate(appliedIncomingFromDate);
    setIncomingToDate(appliedIncomingToDate);
    setShowIncomingModal(true);
  };

  const handleRenewalsExcelClick = () => {
    setRenewalsFromDate('');
    setRenewalsToDate('');
    setShowRenewalsExcelModal(true);
  };

  const handleDebtsExcelClick = () => {
    setDebtsFromDate('');
    setDebtsToDate('');
    setShowDebtsExcelModal(true);
  };

  const handleDownloadRenewalsExcel = async () => {
    try {
      setRenewalsExporting(true);
      const blob = await apiService.exportReceiptsToExcel(
        renewalsFromDate || undefined,
        renewalsToDate || undefined
      );
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `تفعيلات_${renewalsFromDate || 'all'}_${renewalsToDate || 'all'}.xlsx`;
      document.body.appendChild(link);
      
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showSuccess('تم التحميل', 'تم تنزيل تقرير التفعيلات بنجاح.');
      setShowRenewalsExcelModal(false);
    } catch (err: any) {
      showError('خطأ في التحميل', ApiService.showError(err));
    } finally {
      setRenewalsExporting(false);
    }
  };

  const handleDownloadDebtsExcel = async () => {
    try {
      setDebtsExporting(true);
      const pageSize = 500;
      const params: any = { page: 1, pageSize };
      const df = debtsFromDate?.split('T')[0];
      const dt = debtsToDate?.split('T')[0];
      if (df && /^\d{4}-\d{2}-\d{2}$/.test(df)) params.paymentCreatedAtFrom = `${df}T00:00:00.000Z`;
      if (dt && /^\d{4}-\d{2}-\d{2}$/.test(dt)) params.paymentCreatedAtTo = `${dt}T23:59:59.999Z`;
      // تمرير حالة الدين للـ API حتى يرجع كل الديون المطلوبة فقط (غير مدفوع = 0، مدفوع = 1)
      params.status = debtExportFilter === 'received' ? DebtStatus.Paid : DebtStatus.Unpaid;
      const allDebts: Debt[] = [];
      let page = 1;
      let res: Awaited<ReturnType<typeof apiService.getAllDebts>>;
      do {
        res = await apiService.getAllDebts({ ...params, page });
        const chunk = res?.data ?? [];
        allDebts.push(...chunk);
        if (!res?.hasNextPage || chunk.length < pageSize) break;
        page += 1;
      } while (true);
      const debts = allDebts;
      const grouped = debts.reduce((acc: Record<string, any>, debt: Debt) => {
        const key = debt.subscriberId;
        if (!acc[key]) {
          acc[key] = {
            subscriberId: debt.subscriberId,
            subscriberName: debt.subscriberName,
            subscriberPhone: debt.subscriberPhone,
            activationDate: (debt as any).activationDate ?? (debt as any).subscriberActivationDate ?? null,
            agentName: debt.agentName || debt.agentCompanyName || 'غير محدد',
            totalDebt: 0,
            unpaidDebt: 0,
            debts: [],
          };
        }
        acc[key].debts.push(debt);
        acc[key].totalDebt += debt.amount;
        if (debt.status === 0) acc[key].unpaidDebt += debt.amount;
        if (!acc[key].activationDate && ((debt as any).activationDate || (debt as any).subscriberActivationDate)) {
          acc[key].activationDate = (debt as any).activationDate ?? (debt as any).subscriberActivationDate;
        }
        return acc;
      }, {});
      const rows = Object.values(grouped);
      const headers = ['المشترك', 'رقم هاتف المشترك', 'تاريخ التفعيل', 'إجمالي الدين', 'تاريخ التسديد', 'الدين غير المدفوع', 'عدد الديون', 'وصف الدين'];
      const dataRows = rows.map((sd: any) => {
        const debtsWithPayment = (sd.debts || []).filter((d: any) => d.paymentCreatedAt);
        const latestPayment = debtsWithPayment.length === 0 ? null : debtsWithPayment.reduce((latest: any, d: any) => {
          if (!latest) return d;
          return d.paymentCreatedAt && (!latest.paymentCreatedAt || d.paymentCreatedAt > latest.paymentCreatedAt) ? d : latest;
        }, null as any);
        const dueDateStr = latestPayment?.paymentCreatedAt
          ? formatDate(latestPayment.paymentCreatedAt)
          : (() => {
              const withDue = (sd.debts || []).filter((d: any) => d.dueDate);
              const earliest = withDue.reduce((min: string | null, d: any) => {
                const dDate = d.dueDate ? new Date(d.dueDate).toISOString().split('T')[0] : null;
                if (!dDate) return min;
                return !min || dDate < min ? dDate : min;
              }, null as string | null);
              return earliest ? formatDate(earliest + 'T00:00:00') : '';
            })();
        const activationDateStr = sd.activationDate
          ? formatDate(sd.activationDate)
          : '';
        const descStr = (sd.debts || []).map((d: any) => d.description || '').filter(Boolean).join('، ') || '';
        return [
          sd.subscriberName ?? '',
          sd.subscriberPhone ?? '',
          activationDateStr,
          sd.totalDebt ?? 0,
          dueDateStr,
          sd.unpaidDebt ?? 0,
          sd.debts?.length ?? 0,
          descStr,
        ];
      });
      const sumTotalDebt = dataRows.reduce((s, row) => s + (Number(row[3]) || 0), 0);
      const sumUnpaidDebt = dataRows.reduce((s, row) => s + (Number(row[5]) || 0), 0);
      const sumDebtCount = dataRows.reduce((s, row) => s + (Number(row[6]) || 0), 0);
      const totalRow = ['المجموع', '', '', sumTotalDebt, '', sumUnpaidDebt, sumDebtCount, ''];
      const blob = createXlsxBlob([headers, ...dataRows, totalRow], 'الديون', {
        alignCenter: true,
        colWidths: [22, 16, 16, 16, 16, 18, 12, 28],
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ديون_${debtExportFilter === 'received' ? 'واصلة' : 'غير_واصلة'}_${debtsFromDate || 'all'}_${debtsToDate || 'all'}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showSuccess('تم التحميل', 'تم تنزيل تقرير الديون بنجاح.');
      setShowDebtsExcelModal(false);
    } catch (err: any) {
      showError('خطأ في التحميل', ApiService.showError(err));
    } finally {
      setDebtsExporting(false);
    }
  };


  if ((isMainAgent ? mainAgentDashboardError : error) && online) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-md">
          خطأ في تحميل البيانات
        </div>
      </div>
    );
  }

  if (isMainAgent ? mainAgentDashboardLoading : (statsLoading || debtsLoading)) {
    return (
      <div className="p-6 flex items-center justify-center h-screen">
        <WifiLoaderComponent
          background="transparent"
          desktopSize="150px"
          mobileSize="150px"
          text="تحميل لوحة التحكم..."
          backColor="#E8F2FC"
          frontColor="#4645F6"
        />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      {isAdmin && !isMainAgent && (
        <div className="mb-4 sm:mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            اختر الوكيل لعرض إحصائياته
          </label>
          <select
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
            className="w-full sm:w-96 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.fullName} ({a.username})
              </option>
            ))}
          </select>
          {!selectedAgentId && (
            <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
              يجب اختيار وكيل لعرض الأرقام.
            </p>
          )}
        </div>
      )}

      {/* لوحة الوكيل الرئيسي */}
      {isMainAgent && (
        <section className="mb-6 sm:mb-8" aria-label="إحصائيات الوكيل الرئيسي">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 sm:mb-4">إحصائيات الوكيل الرئيسي</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          <div onClick={handleMainAgentSubAgentsClick} className="cursor-pointer">
            <StatCard
              title="المكاتب الفرعية"
              value={mainAgentDashboard?.subAgentsCount ?? 0}
              icon={UserCheck}
              color="blue"
            />
          </div>
          <div onClick={handleTotalSubscribersClick} className="cursor-pointer">
            <StatCard
              title="إجمالي المشتركين"
              value={mainAgentDashboard?.totalSubscribersCount ?? 0}
              icon={Users}
              color="indigo"
            />
          </div>
          <div onClick={handleActiveSubscribersClick} className="cursor-pointer">
            <StatCard
              title="الفعالين"
              value={mainAgentDashboard?.activeSubscribersCount ?? 0}
              icon={UserCheck}
              color="green"
            />
          </div>
          <div onClick={handleExpiredClick} className="cursor-pointer">
            <StatCard
              title="منتهي الصلاحية"
              value={mainAgentDashboard?.expiredSubscribersCount ?? 0}
              icon={XCircle}
              color="red"
            />
          </div>
          <div onClick={handleDebtsClick} className="cursor-pointer">
            <StatCard
              title="الديون"
              value={mainAgentDashboard?.totalDebtsAmount ?? 0}
              icon={CreditCard}
              color="purple"
              isAmount={true}
            />
          </div>
          <div onClick={handleIncomingClick} className="cursor-pointer">
            <StatCard
              title="الوارد"
              value={mainAgentDashboard?.totalIncomingAmount ?? 0}
              icon={Wallet}
              color="green"
              isAmount={true}
            />
          </div>
          </div>

          {/* خريطة العراق — اماكن التغطية في العراق (أيقونة موقع + اسم الوكيل والشركة، خلفية بيضاء) */}
          <div className="mt-6">
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-3">اماكن التغطية في العراق</h3>
            <IraqSubAgentsMap agents={mainAgentSubAgentsList} className="w-full" />
          </div>
        </section>
      )}

      {!isMainAgent && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
            <div className="space-y-4 min-w-0 order-1 xl:order-none">
              <DashboardHeader
                userName={dashboardUserName}
                lastUpdated={lastUpdated}
                onRefresh={handleRefresh}
              />
              {isAgentOrSubAgentOrEmployee && (
                <DashboardRegionResellerFilters
                  regions={myRegions}
                  resellers={filteredOperationalResellers}
                  selectedRegionId={selectedOperationalRegionId}
                  selectedResellerId={selectedOperationalResellerId}
                  onRegionClick={handleRegionCardClick}
                  onResellerClick={handleResellerCardClick}
                  showRegions={myRegions.length > 0}
                  showResellers={filteredOperationalResellers.length > 0}
                />
              )}
            </div>

            {!isAdmin && balanceQueryEnabled && (
              <div className="order-2 xl:order-none xl:sticky xl:top-6 self-start">
                <DashboardCreditBalanceCard
                  label={balanceCardLabel}
                  amount={displayBalance}
                  formatNumber={formatNumber}
                  onClick={handleBalanceClick}
                />
              </div>
            )}
          </div>

          {canAccessAccountsSummary(user?.role, user?.canAccessAccounts) && (
            <>
              <DashboardSummaryAmounts items={summaryAmountItems} />
              <DashboardOperationalOverview
                cashAmount={activationPaymentSummary?.cash ?? 0}
                masterAmount={activationPaymentSummary?.master ?? 0}
                balance={displayBalance}
                balanceDeduction={Number(accountsSummary?.totalBalanceDeduction ?? 0)}
                formatNumber={formatNumber}
              />
            </>
          )}

          <DashboardCharts
            subscriberValues={subscriberChartValues}
            financialValues={financialChartValues}
            formatNumber={formatNumber}
          />

          {!isAdmin && (
            <DashboardSubscriberAnalytics
              trend={subscriberAnalytics.trend}
              distributions={subscriberAnalytics.distributions}
              formatNumber={formatNumber}
            />
          )}

          <DashboardDebtInsights
            totalDebt={Number(debtsStats.totalDebtAmount ?? 0)}
            subscriptionDebt={Number(accountsSummary?.totalUnpaidSubscriptionDebt ?? 0)}
            serviceFeesDebt={Number(accountsSummary?.totalServiceFeesDebt ?? 0)}
            collectedAmount={Number(paidDebtsInPeriod?.totalDebtPaymentsIncome ?? 0)}
            overdueAmount={debtInsights.overdueAmount}
            aging={debtInsights.aging}
            topDebtors={debtInsights.topDebtors}
            formatNumber={formatNumber}
          />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {canManageEmployeeTasks && <DashboardRecentTasksTable tasks={recentTasks} />}
            <DashboardRecentActivationsTable
              receipts={recentReceipts}
              formatNumber={formatNumber}
              formatDate={formatDate}
              isLoading={recentActivationsLoading}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRenewalsExcelClick}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-blue-200/75 dark:border-blue-700/45 bg-blue-100/45 dark:bg-blue-900/25 text-sm text-blue-800 dark:text-blue-200 hover:shadow-md transition-all"
            >
              <FileSpreadsheet className="h-4 w-4" />
              تقرير Excel تفعيلات
            </button>
            <button
              type="button"
              onClick={handleDebtsExcelClick}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-purple-200/75 dark:border-purple-700/45 bg-purple-100/45 dark:bg-purple-900/25 text-sm text-purple-800 dark:text-purple-200 hover:shadow-md transition-all"
            >
              <FileSpreadsheet className="h-4 w-4" />
              تقرير Excel ديون
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/materials/disbursed')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-indigo-200/75 dark:border-indigo-700/45 bg-indigo-100/45 dark:bg-indigo-900/25 text-sm text-indigo-800 dark:text-indigo-200 hover:shadow-md transition-all"
            >
              <ShoppingCart className="h-4 w-4" />
              مبيعات المواد
            </button>
          </div>
        </div>
      )}


            {/* Renewals Excel modal */}
      {showRenewalsExcelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                تقرير اكسل تفعيلات
              </h2>
              <button
                type="button"
                onClick={() => setShowRenewalsExcelModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                aria-label="إغلاق"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  من تاريخ
                </label>
                <input
                  type="date"
                  value={renewalsFromDate}
                  onChange={(e) => setRenewalsFromDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  إلى تاريخ
                </label>
                <input
                  type="date"
                  value={renewalsToDate}
                  onChange={(e) => setRenewalsToDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowRenewalsExcelModal(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded-md text-sm font-medium"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleDownloadRenewalsExcel}
                  disabled={renewalsExporting}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md text-sm font-medium disabled:opacity-50"
                >
                  {renewalsExporting ? 'جاري التحميل...' : 'تحميل'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Debts Excel modal */}
      {showDebtsExcelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                تقرير اكسل ديون
              </h2>
              <button
                type="button"
                onClick={() => setShowDebtsExcelModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                aria-label="إغلاق"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  من تاريخ
                </label>
                <input
                  type="date"
                  value={debtsFromDate}
                  onChange={(e) => setDebtsFromDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  إلى تاريخ
                </label>
                <input
                  type="date"
                  value={debtsToDate}
                  onChange={(e) => setDebtsToDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  نوع الديون
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="debtExportFilter"
                      checked={debtExportFilter === 'received'}
                      onChange={() => setDebtExportFilter('received')}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">الديون الواصلة</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="debtExportFilter"
                      checked={debtExportFilter === 'unreceived'}
                      onChange={() => setDebtExportFilter('unreceived')}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">الديون الغير واصلة</span>
                  </label>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {debtExportFilter === 'received' ? '' : ''}
                </p>
              </div>
              <div className="flex gap-2 justify-end pt-2 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowDebtsExcelModal(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded-md text-sm font-medium"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleDownloadDebtsExcel}
                  disabled={debtsExporting}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md text-sm font-medium disabled:opacity-50"
                >
                  {debtsExporting ? 'جاري التحميل...' : 'تحميل'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Incoming filter modal */}
      {showIncomingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                فلترة الوارد
              </h2>
              <button
                type="button"
                onClick={() => setShowIncomingModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                aria-label="إغلاق"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  من تاريخ
                </label>
                <input
                  type="date"
                  value={incomingFromDate}
                  onChange={(e) => setIncomingFromDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  إلى تاريخ
                </label>
                <input
                  type="date"
                  value={incomingToDate}
                  onChange={(e) => setIncomingToDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setIncomingFromDate('');
                    setIncomingToDate('');
                    setAppliedIncomingFromDate('');
                    setAppliedIncomingToDate('');
                    setShowIncomingModal(false);
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded-md text-sm font-medium"
                >
                  مسح
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAppliedIncomingFromDate(incomingFromDate);
                    setAppliedIncomingToDate(incomingToDate);
                    setShowIncomingModal(false);
                  }}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md text-sm font-medium"
                >
                  تطبيق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
