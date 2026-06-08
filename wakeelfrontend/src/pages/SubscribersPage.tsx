import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { apiService, ApiService } from '../services/api';
import { fetchSubscribersWithCache, fetchProfilesWithCache, queueOperation, buildCreateRenewalPayload, cacheProfiles } from '../services/offlineSync';
import { showSuccess, showError, showInfo } from '../utils/notifications';
import {
  loadStoredOperationalRegionId,
  loadStoredOperationalResellerId,
  saveStoredOperationalRegionId,
  saveStoredOperationalResellerId,
  buildRegionResellerFilterParams,
  filterResellersByRegion,
  hasOperationalWhatsAppSession,
} from '../utils/operationalFilters';
import { DEFAULT_DETAILS_TEMPLATE, DEFAULT_ACTIVATION_TEMPLATE } from '../utils/activationMessage';
import { useConfirmation } from '../contexts/ConfirmationContext';
import { useAuth } from '../contexts/AuthContext';
import { useOffline } from '../contexts/OfflineContext';
import { useDigits } from '../contexts/DigitsContext';
import { Subscriber, SubscriptionStatus, SubscriptionType, SubscriberCreateRequest, SubscriberUpdateRequest, Profile, RenewalData, PaymentStatus, PaginatedResponse, PaginationParams, UserRole, ServiceType, SubscriberNoteType, EARTHLINK_USER_MANAGEMENT_URL, AgentReseller, AgentRegion, ProfilePackageType, type SyncSubscribersDataItem, type SyncSubscribersRequest, type UpdateSubscriptionRequest, type UpdateSubscriptionResponse, type SaveSubscriberFromSyncRequest, type TransactionItem, type CashbackSynchronizationFtthResponse, type CashbackSynchronizationFtthRow } from '../types';
import QRCode from 'qrcode';
import EditSubscriberModal from '../components/EditSubscriberModal';
import AddNoteModal from '../components/AddNoteModal';
import Pagination from '../components/Pagination';
import WifiLoaderComponent from '../components/WifiLoaderComponent';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Eye, 
  UserPlus,
  Phone,
  X,
  Save,
  CheckSquare,
  Square,
  RefreshCw,
  MoreHorizontal,
  MessageCircle,
  ExternalLink,
  Settings2,
  FileText,
  Filter,
  Check,
  Info
} from 'lucide-react';

const SUBSCRIBERS_TABLE_COLUMNS: { id: string; label: string }[] = [
  { id: 'secruptionId', label: 'معرف الاشتراك' },
  { id: 'subscriber', label: 'المشترك (الاسم)' },
  { id: 'username', label: 'اسم المستخدم' },
  { id: 'subscriberRegion', label: 'منطقة المشترك' },
  { id: 'phoneNumber', label: 'رقم الهاتف' },
  { id: 'agentCompanyName', label: 'شركة الوكيل' },
  { id: 'fat', label: 'الكابينة' },
  { id: 'zone', label: 'المنطقة' },
  { id: 'noteType', label: 'نوع الملاحظة' },
  { id: 'note', label: 'الملاحظات' },
  { id: 'profile', label: 'الباقة' },
  { id: 'paymentMethod', label: 'طريقة الدفع' },
  { id: 'activationDate', label: 'تاريخ التفعيل' },
  { id: 'expirationDate', label: 'تاريخ الانتهاء' },
  { id: 'status', label: 'الحالة' },
];

/** للتأكد من فتح صفحة إدارة المستخدمين فقط لـ Earthlink، وليس رابط التفعيل المباشر (#/user/activate/xxx) */
function normalizeEarthlinkActivationUrl(url: string | undefined): string | undefined {
  if (!url || typeof url !== 'string') return url;
  const u = url.trim();
  if (/admin\.earthlink\.iq/i.test(u) && (u.includes('#') || u.includes('/user/activate'))) return EARTHLINK_USER_MANAGEMENT_URL;
  return u;
}

// (SAS Python activation) تم تعليقها مؤقتاً — لا يتم تنفيذ أي منطق هنا حالياً.

const STORAGE_KEY_VISIBLE_COLUMNS = 'wakeel_subscribers_visible_columns';

const REGION_BADGE_COLORS = [
  'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 border-blue-200 dark:border-blue-700',
  'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200 border-purple-200 dark:border-purple-700',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200 border-emerald-200 dark:border-emerald-700',
  'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 border-amber-200 dark:border-amber-700',
  'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200 border-rose-200 dark:border-rose-700',
  'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-200 border-cyan-200 dark:border-cyan-700',
];

function pickRegionBadgeColor(regionKey: string): string {
  let hash = 0;
  for (let i = 0; i < regionKey.length; i += 1) {
    hash = (hash * 31 + regionKey.charCodeAt(i)) >>> 0;
  }
  return REGION_BADGE_COLORS[hash % REGION_BADGE_COLORS.length];
}

/** عنوان واجهة سكربت البايثون SAS (زر تفعيل المشترك عند SAS): تسجيل الدخول /sas/login، التفعيل /sas/activate. إنتاج https://api.execute-iq.com/apipy، تطوير localhost. يمكن تخطيه بـ REACT_APP_SAS_PYTHON_API_URL */
// const SAS_PYTHON_API_BASE =
//   process.env.REACT_APP_SAS_PYTHON_API_URL ||
//   (process.env.NODE_ENV === 'production' ? 'https://api.execute-iq.com/apipy' : 'http://localhost:8000');

const SUBSCRIBER_NOTE_TYPE_LABELS: Record<number, string> = {
  [SubscriberNoteType.NoResponse]: 'لم يتم الرد',
  [SubscriberNoteType.WillActivateSoon]: 'ستتم التفعيل قريباً',
  [SubscriberNoteType.DoesNotWantActivation]: 'لا يرغب في التفعيل',
  [SubscriberNoteType.BadService]: 'سوء خدمة',
  [SubscriberNoteType.NeedsMaintenance]: 'يحتاج صيانة',
  [SubscriberNoteType.Other]: 'أخرى',
};

function getSubscriberNoteTypeLabel(noteType?: SubscriberNoteType | null, note?: string | null): string {
  const hasFreeNote = (note ?? '').toString().trim().length > 0;
  if (!noteType) return hasFreeNote ? 'أخرى' : '—';
  return SUBSCRIBER_NOTE_TYPE_LABELS[noteType] ?? String(noteType);
}

function getSubscriberNoteTypeBadge(noteType?: SubscriberNoteType | null, note?: string | null) {
  const label = getSubscriberNoteTypeLabel(noteType, note);
  if (label === '—') return <span className="text-gray-400">—</span>;

  const normalizedType: SubscriberNoteType | null =
    noteType ?? (((note ?? '').toString().trim().length > 0) ? SubscriberNoteType.Other : null);

  const base = 'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full';
  const styles: Record<number, string> = {
    [SubscriberNoteType.NoResponse]:
      'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300',
    [SubscriberNoteType.WillActivateSoon]:
      'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
    [SubscriberNoteType.DoesNotWantActivation]:
      'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300',
    [SubscriberNoteType.BadService]:
      'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300',
    [SubscriberNoteType.NeedsMaintenance]:
      'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300',
    [SubscriberNoteType.Other]:
      'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300',
  };

  const cls = normalizedType ? (styles[normalizedType] ?? styles[SubscriberNoteType.Other]) : styles[SubscriberNoteType.Other];
  return <span className={`${base} ${cls}`}>{label}</span>;
}

function getDefaultVisibleColumns(): Record<string, boolean> {
  return SUBSCRIBERS_TABLE_COLUMNS.reduce<Record<string, boolean>>((acc, col) => {
    acc[col.id] = true;
    return acc;
  }, {});
}

function loadVisibleColumns(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_VISIBLE_COLUMNS);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      const defaults = getDefaultVisibleColumns();
      return { ...defaults, ...parsed };
    }
  } catch (_) {}
  return getDefaultVisibleColumns();
}

/** Card / Wallet وغيرها — للجدول الرئيسي ومزامنة المعاملات */
function formatPaymentMethodLabel(raw?: string | null): string {
  if (raw == null || String(raw).trim() === '') return '—';
  const v = String(raw).trim();
  const lower = v.toLowerCase();
  if (lower === 'card') return 'بطاقة دفع';
  if (lower === 'wallet') return 'محفظة الرصيد';
  return v;
}

/** عمود طريقة الدفع — يعتمد على payment_method من استجابة sync-subscribers (Wallet / Card) */
function formatSyncWalletOrPaymentDisplay(row: { payment_method?: string }): string {
  return formatPaymentMethodLabel(row.payment_method);
}

/** عمود المعاملات: wallet_owner_type إن وُجد، وإلا payment_method بنفس منطق المزامنة */
function formatTransactionPaymentDisplay(row: { wallet_owner_type?: string | null; payment_method?: string }): string {
  const wt = row.wallet_owner_type != null && String(row.wallet_owner_type).trim() !== ''
    ? String(row.wallet_owner_type).trim()
    : '';
  if (wt) {
    return wt.toLowerCase() === 'customer' ? 'بطاقة دفع' : 'محفظة الرصيد';
  }
  return formatSyncWalletOrPaymentDisplay(row);
}

/** مزامنة تلقائياً: الصفوف التي يعيدها الباكند مع deviceUsername فارغ لا تُعرض كمشترك */
function filterAutoSyncFtthRowsWithDeviceUsername(
  res: CashbackSynchronizationFtthResponse
): CashbackSynchronizationFtthResponse {
  const data = (res.data ?? []).filter((row) => {
    const v = row.deviceUsername;
    if (v === undefined) return true;
    return String(v).trim() !== '';
  });
  return { ...res, data, count: data.length };
}

const SubscribersPage: React.FC = () => {
  const { confirmDelete } = useConfirmation();
  const { user } = useAuth();
  const { online, refreshPendingCount } = useOffline();
  const { formatNumber, formatDate, locale } = useDigits();
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | 'all'>('all');
  const [sortDescending, setSortDescending] = useState<boolean>(true);
  const [maxDaysUntilExpiry, setMaxDaysUntilExpiry] = useState<string>('');
  const [appliedMaxDaysUntilExpiry, setAppliedMaxDaysUntilExpiry] = useState<string>('');
  const [fatFilter, setFatFilter] = useState<string>('');
  const [zoneFilter, setZoneFilter] = useState<string>('');
  const [appliedFatFilter, setAppliedFatFilter] = useState<string>('');
  const [appliedZoneFilter, setAppliedZoneFilter] = useState<string>('');
  const [noteTypeFilter, setNoteTypeFilter] = useState<string>('all');
  const [appliedNoteTypeFilter, setAppliedNoteTypeFilter] = useState<string>('all');
  const [extensionActivationFilter, setExtensionActivationFilter] = useState<boolean>(false);
  const [appliedExtensionActivationFilter, setAppliedExtensionActivationFilter] = useState<boolean>(false);
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [expirationFromDate, setExpirationFromDate] = useState('');
  const [expirationToDate, setExpirationToDate] = useState('');
  const [appliedExpirationFromDate, setAppliedExpirationFromDate] = useState('');
  const [appliedExpirationToDate, setAppliedExpirationToDate] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [selectedSubscriberForEdit, setSelectedSubscriberForEdit] = useState<Subscriber | null>(null);
  const [selectedSubscriberForNote, setSelectedSubscriberForNote] = useState<Subscriber | null>(null);
  const [selectedSubscriberForRenewal, setSelectedSubscriberForRenewal] = useState<Subscriber | null>(null);
  const [renewalViaSasTab, setRenewalViaSasTab] = useState(false);
  const [sasLinkLoading, setSasLinkLoading] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [sendReminderLoading, setSendReminderLoading] = useState(false);
  const [profileSearchInAdd, setProfileSearchInAdd] = useState('');
  const [showProfileDropdownAdd, setShowProfileDropdownAdd] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const profileDropdownAddRef = useRef<HTMLDivElement>(null);
  /** يمنع إعادة ضبط المبلغ الواصل عند إعادة جلب قائمة الباقات دون تغيير الاختيار */
  const renewalProfileIdForAmountSyncRef = useRef<string>('');
  /** واصل = المبلغ كامل؛ غير واصل = إدخال المبلغ الواصل يدوياً */
  const [renewalAmountFullyReceived, setRenewalAmountFullyReceived] = useState(true);
  const columnSettingsRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => loadVisibleColumns());
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [showSasCredentialsModal, setShowSasCredentialsModal] = useState(false);
  const [sasCredsBaseUrl, setSasCredsBaseUrl] = useState('');
  const [sasCredsUsername, setSasCredsUsername] = useState('');
  const [sasCredsPassword, setSasCredsPassword] = useState('');
  type SasSyncStep = 'form' | 'failed' | 'sync_subscribers_loading' | 'sync_subscribers_list' | 'transactions_loading' | 'transactions_list';
  const [sasSyncStep, setSasSyncStep] = useState<SasSyncStep>('form');
  const [sasPreviewError, setSasPreviewError] = useState('');
  const [syncSubscribersList, setSyncSubscribersList] = useState<SyncSubscribersDataItem[] | null>(null);
  const [syncTransactionsList, setSyncTransactionsList] = useState<TransactionItem[] | null>(null);
  const [activatedSubscriptionIds, setActivatedSubscriptionIds] = useState<Set<number>>(new Set());
  const [savedSubscriberRowIds, setSavedSubscriberRowIds] = useState<Set<number>>(new Set());
  const [updatingSubscriptionId, setUpdatingSubscriptionId] = useState<number | null>(null);
  const [savingSubscriberRowId, setSavingSubscriberRowId] = useState<number | null>(null);
  /** صف المعاينة لتفعيل غير مدفوع: يُعرض حقل مبلغ الدين وزر تأكيد */
  const [unpaidActivationRowId, setUnpaidActivationRowId] = useState<number | null>(null);
  const [unpaidDebtAmountInput, setUnpaidDebtAmountInput] = useState('');
  /** عند وجود أكثر من رسيلر: الرسيلر المختار للمزامنة (يُمرَّر كـ resellerId). */
  const [selectedSyncResellerId, setSelectedSyncResellerId] = useState<string | null>(null);
  const [selectedOperationalRegionId, setSelectedOperationalRegionId] = useState<string>('');
  const [selectedOperationalResellerId, setSelectedOperationalResellerId] = useState<string>('');
  /** بعد التفعيل أو التفعيل (دين): عرض مودال لاختيار إرسال واتساب أو إلغاء. */
  const [postActivationWhatsApp, setPostActivationWhatsApp] = useState<{ subscriberId: string; mode: 'activation' | 'details' } | null>(null);
  const [showAutoSyncModal, setShowAutoSyncModal] = useState(false);
  const [autoSyncFtthResult, setAutoSyncFtthResult] = useState<CashbackSynchronizationFtthResponse | null>(null);
  const [savingFtthRowIndex, setSavingFtthRowIndex] = useState<number | null>(null);
  const [savingAllSasRows, setSavingAllSasRows] = useState(false);
  const [openingRenewalFtthRowIndex, setOpeningRenewalFtthRowIndex] = useState<number | null>(null);
  const [savedFtthRowIndices, setSavedFtthRowIndices] = useState<Set<number>>(new Set());
  const [activatedFtthRowIndices, setActivatedFtthRowIndices] = useState<Set<number>>(new Set());
  const [pendingFtthRenewalRowIndex, setPendingFtthRenewalRowIndex] = useState<number | null>(null);

  const toggleColumnVisibility = (id: string) => {
    setVisibleColumns((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(STORAGE_KEY_VISIBLE_COLUMNS, JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  };

  const col = (id: string) => (visibleColumns[id] !== false ? '' : 'hidden');

  const getSubscriberRegion = (subscriber: Subscriber): { name: string; badgeClass: string } => {
    const byRegionName = (subscriber.regionName ?? '').trim();
    const byResellerName = (subscriber.agentResellerName ?? '').trim();
    const byLookup = myResellers.find((r) => r.id === subscriber.agentResellerId)?.regionName?.trim()
      || myRegions.find((r) => r.id === subscriber.regionId)?.name?.trim()
      || myResellers.find((r) => r.id === subscriber.agentResellerId)?.name?.trim()
      || '';
    const regionName = byRegionName || byResellerName || byLookup;
    if (!regionName) {
      return {
        name: 'بدون منطقة',
        badgeClass: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600',
      };
    }
    return { name: regionName, badgeClass: pickRegionBadgeColor(regionName.toLowerCase()) };
  };

  // Form state for adding new subscriber
  const [formData, setFormData] = useState<SubscriberCreateRequest>({
    secruptionId: '',
    username: '',
    password: '',
    firstName: '',
    lastName: '',
    phoneNumber: '',
    noteType: SubscriberNoteType.NoResponse,
    note: '',
    profileId: '',
    activationDate: new Date().toISOString().split('T')[0],
    expirationDate: new Date().toISOString().split('T')[0],
    subscriptionType: SubscriptionType.Paid,
    fat: '',
    zone: '',
    agentResellerId: ''
  });

  // Form state for renewal
  const [renewalData, setRenewalData] = useState<RenewalData>({
    subscriberId: '',
    newProfileId: '',
    paymentStatus: PaymentStatus.Paid,
    overrideSalePrice: 0,
    amountPaid: 0,
    notes: '',
    remainingAmount: 0,
    debtDescription: '',
    debtDueDate: ''
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);

  const { data: subscribersResponse, error, isLoading } = useQuery<PaginatedResponse<Subscriber>>({
    queryKey: ['subscribers', 'offline', online, currentPage, pageSize, debouncedSearchTerm, statusFilter, sortDescending, appliedMaxDaysUntilExpiry, appliedFatFilter, appliedZoneFilter, appliedNoteTypeFilter, appliedExtensionActivationFilter, appliedExpirationFromDate, appliedExpirationToDate, selectedOperationalRegionId, selectedOperationalResellerId],
    queryFn: async () => {
      const daysNum = appliedMaxDaysUntilExpiry.trim() === '' ? undefined : parseInt(appliedMaxDaysUntilExpiry, 10);
      const noteTypeNum =
        appliedNoteTypeFilter === 'all' ? undefined : (parseInt(appliedNoteTypeFilter, 10) as SubscriberNoteType);
      const rawSearch = debouncedSearchTerm && debouncedSearchTerm.trim() ? debouncedSearchTerm.trim() : '';
      const employeeRequiresTwoWords = user?.role === UserRole.Employee && !user?.canViewAllSubscribers;
      const searchWords = rawSearch ? rawSearch.split(/\s+/).filter(Boolean) : [];
      const effectiveSearch =
        !rawSearch
          ? undefined
          : employeeRequiresTwoWords && searchWords.length < 2
            ? undefined
            : rawSearch;
      const params: PaginationParams = {
        page: currentPage,
        pageSize: pageSize,
        search: effectiveSearch,
        status: statusFilter !== 'all' ? statusFilter.toString() : undefined,
        sortDescending: sortDescending,
        maxDaysUntilExpiry: daysNum !== undefined && !isNaN(daysNum) && daysNum >= 0 ? daysNum : undefined,
        fat: appliedFatFilter.trim() || undefined,
        zone: appliedZoneFilter.trim() || undefined,
        noteType: noteTypeNum !== undefined && !isNaN(noteTypeNum as any) ? noteTypeNum : undefined,
        hasExtensionActivation: appliedExtensionActivationFilter || undefined,
        expirationFromDate: appliedExpirationFromDate.trim() || undefined,
        expirationToDate: appliedExpirationToDate.trim() || undefined,
        ...buildRegionResellerFilterParams(
          selectedOperationalRegionId,
          selectedOperationalResellerId,
          myResellers
        ),
      };
      if (params.maxDaysUntilExpiry === undefined) delete params.maxDaysUntilExpiry;
      if (params.fat === undefined) delete params.fat;
      if (params.zone === undefined) delete params.zone;
      if (params.noteType === undefined) delete params.noteType;
      if (params.hasExtensionActivation === undefined) delete params.hasExtensionActivation;
      if (params.expirationFromDate === undefined) delete params.expirationFromDate;
      if (params.expirationToDate === undefined) delete params.expirationToDate;
      return fetchSubscribersWithCache(online, params);
    },
    enabled: true,
  });

  const subscribers = subscribersResponse?.data || [];
  const selectedSubscriber =
    selectedSubscriberForRenewal ?? subscribers?.find((s) => s.id === renewalData.subscriberId) ?? null;
  const renewalResellerIdForQuery = (selectedSubscriber?.agentResellerId ?? '').trim() || undefined;

  const { data: profilesResponse } = useQuery({
    queryKey: ['profiles', 'all', online, selectedOperationalResellerId],
    queryFn: () => fetchProfilesWithCache(online, { page: 1, pageSize: 100, resellerId: selectedOperationalResellerId || undefined }),
  });

  const profiles = React.useMemo(
    () => (profilesResponse?.data ?? []) as Profile[],
    [profilesResponse]
  );
  const activeProfiles = React.useMemo(
    () => profiles.filter((p) => p.isActive),
    [profiles]
  );
  const { data: renewalProfiles = [] } = useQuery<Profile[]>({
    queryKey: ['renewal-profiles', renewalResellerIdForQuery ?? '__no_reseller__'],
    queryFn: () => apiService.getRenewalProfiles(renewalResellerIdForQuery),
    enabled: showRenewalModal && !!selectedSubscriber,
  });

  useEffect(() => {
    if (Array.isArray(profiles) && profiles.length > 0) {
      cacheProfiles(profiles).catch(() => {});
    }
  }, [profiles]);

  const filteredProfilesForAdd = React.useMemo(() => {
    const list = Array.isArray(activeProfiles) ? activeProfiles : [];
    const q = (profileSearchInAdd || '').trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) =>
        (p.name || '').toLowerCase().includes(q) ||
        String(p.salePrice || '').includes(q) ||
        (p.id || '').toLowerCase().includes(q)
    );
  }, [activeProfiles, profileSearchInAdd]);

  const { data: overdueDebtsResponse } = useQuery({
    queryKey: ['overdue-unpaid-debts', 'subscriber-ids'],
    queryFn: () => apiService.getOverdueUnpaidDebts({ page: 1, pageSize: 10000 }),
    enabled: true,
  });

  const subscriberIdsWithOverdueDebt = React.useMemo(() => {
    const debts = overdueDebtsResponse?.data ?? [];
    return new Set(debts.map((d) => d.subscriberId));
  }, [overdueDebtsResponse]);

  /** الوكيل والمدير الثانوي والموظف: جلب وكيل المستخدم (للموظف/المدير الثانوي يرجع الوكيل التابع له — نفس جلسة واتساب) */
  const isAgentOrSubAgentOrEmployee = user?.role === UserRole.Agent || user?.role === UserRole.SubAgent || user?.role === UserRole.Employee;
  /** صلاحية مزامنة SAS من الاعتماديات المحفوظة (أدمن، وكيل، نائب وكيل) */
  const canSyncSas = user?.role === UserRole.Admin || user?.role === UserRole.Agent || user?.role === UserRole.SubAgent;
  /** للموظف: كل إجراء يظهر فقط عند منح صلاحيته بشكل مستقل */
  const isEmployee = user?.role === UserRole.Employee;
  const showEditSubscriberAction = !isEmployee || !!user?.canEditSubscriber;
  const showDeleteSubscriberAction = !isEmployee || !!user?.canDeleteSubscriber;
  const showViewDetailsAction = !isEmployee || !!user?.canEditSubscriber || !!user?.canDeleteSubscriber;
  const showActivateViaTabAction =
    !isEmployee || !!user?.canActivateSubscriber || !!user?.canEditSubscriber || !!user?.canDeleteSubscriber;
  /** للموظف بدون صلاحية عرض الكل: إلزام إدخال الاسم الأول والثاني (كلمتين على الأقل) للبحث */
  const requireTwoWordsForSearch = isEmployee && !user?.canViewAllSubscribers;
  const { data: myAgent, isLoading: myAgentLoading, error: myAgentError } = useQuery({
    queryKey: ['myAgent'],
    queryFn: () => apiService.getMyAgent(),
    enabled: !!isAgentOrSubAgentOrEmployee || !!canSyncSas,
    retry: false,
  });
  const { data: myResellers = [] } = useQuery<AgentReseller[]>({
    queryKey: ['myResellers'],
    queryFn: () => apiService.getMyResellers(),
    enabled: !!isAgentOrSubAgentOrEmployee || !!canSyncSas,
  });
  const { data: myRegions = [] } = useQuery<AgentRegion[]>({
    queryKey: ['myRegions'],
    queryFn: () => apiService.getMyRegions(true),
    enabled: !!isAgentOrSubAgentOrEmployee || !!canSyncSas,
  });

  const filteredOperationalResellers = React.useMemo(
    () => filterResellersByRegion(myResellers, selectedOperationalRegionId),
    [myResellers, selectedOperationalRegionId]
  );

  const handleSubscribersRegionCardClick = (regionId: string) => {
    const next = selectedOperationalRegionId === regionId ? '' : regionId;
    setSelectedOperationalRegionId(next);
    saveStoredOperationalRegionId(next);
    setSelectedOperationalResellerId('');
    saveStoredOperationalResellerId('');
    setCurrentPage(1);
  };

  const handleSubscribersResellerCardClick = (resellerId: string) => {
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
    setCurrentPage(1);
  };

  const [showResellerPickerModal, setShowResellerPickerModal] = useState(false);
  const [showAutoSyncResellerPickerModal, setShowAutoSyncResellerPickerModal] = useState(false);
  const defaultFtthReseller = React.useMemo(
    () => myResellers.find((r) => r.serviceType === ServiceType.Ftth) ?? null,
    [myResellers]
  );
  const autoSyncReseller = React.useMemo(() => {
    if (selectedSyncResellerId) {
      const chosen = myResellers.find((r) => r.id === selectedSyncResellerId);
      if (chosen) return chosen;
    }
    if (myAgent?.serviceType != null) {
      const byAgentType = myResellers.find((r) => r.serviceType === myAgent.serviceType);
      if (byAgentType) return byAgentType;
    }
    return defaultFtthReseller ?? myResellers[0] ?? null;
  }, [selectedSyncResellerId, myResellers, myAgent?.serviceType, defaultFtthReseller]);
  const hasMixedResellerTypes = React.useMemo(() => {
    const types = new Set((myResellers ?? []).map((r) => r.serviceType));
    return types.size > 1;
  }, [myResellers]);
  const [pendingActivateSubscriberId, setPendingActivateSubscriberId] = useState<string | null>(null);
  const hasWhatsAppSession = hasOperationalWhatsAppSession(myResellers, selectedOperationalResellerId, myAgent?.whatsAppSessionId);

  useEffect(() => {
    if (!isAgentOrSubAgentOrEmployee) return;
    setSelectedOperationalRegionId(loadStoredOperationalRegionId());
    setSelectedOperationalResellerId(loadStoredOperationalResellerId());
  }, [isAgentOrSubAgentOrEmployee]);

  useEffect(() => {
    if (!isAgentOrSubAgentOrEmployee) return;
    const regionExists = !selectedOperationalRegionId || myRegions.some((r) => r.id === selectedOperationalRegionId);
    if (!regionExists) {
      setSelectedOperationalRegionId('');
      saveStoredOperationalRegionId('');
    }
    const resellerExists = !selectedOperationalResellerId || myResellers.some((r) => r.id === selectedOperationalResellerId);
    if (!resellerExists) {
      setSelectedOperationalResellerId('');
      saveStoredOperationalResellerId('');
    }
  }, [isAgentOrSubAgentOrEmployee, myRegions, myResellers, selectedOperationalRegionId, selectedOperationalResellerId]);

  useEffect(() => {
    if (!showAddModal) {
      setShowProfileDropdownAdd(false);
      setProfileSearchInAdd('');
    }
  }, [showAddModal]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showProfileDropdownAdd && profileDropdownAddRef.current && !profileDropdownAddRef.current.contains(e.target as Node)) {
        setShowProfileDropdownAdd(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileDropdownAdd]);

  /** تعبئة نموذج المزامنة من بيانات الوكيل المحفوظة عند فتح المودال */
  useEffect(() => {
    if (!showSasCredentialsModal || !myAgent) return;
    const isFtth = myAgent.serviceType === ServiceType.Ftth;
    setSasCredsBaseUrl(
      (isFtth ? myAgent.ftthBaseUrl : myAgent.sasBaseUrl)?.trim() || (isFtth ? 'https://admin.ftth.iq' : '')
    );
    setSasCredsUsername((isFtth ? myAgent.ftthUsername : myAgent.sasUsername)?.trim() || '');
    setSasCredsPassword('');
  }, [showSasCredentialsModal, myAgent]);

  // Initialize filter from URL parameters
  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam) {
      switch (statusParam) {
        case 'active':
          setStatusFilter(SubscriptionStatus.Active);
          break;
        case 'expiring_soon':
          setStatusFilter(SubscriptionStatus.ExpiringSoon);
          break;
        case 'expired':
          setStatusFilter(SubscriptionStatus.Expired);
          break;
        case 'expired_today':
          setStatusFilter(SubscriptionStatus.ExpiredToday);
          break;
        default:
          setStatusFilter('all');
      }
    }
  }, [searchParams]);

  const profilesList = React.useMemo(() => {
    const raw = (renewalProfiles ?? []) as Profile[];
    const active = raw.filter((p) => p.isActive);
    const subReseller = (selectedSubscriber?.agentResellerId ?? '').trim();
    if (subReseller) return active.filter((p) => (p.agentResellerId ?? '').trim() === subReseller);
    return active.filter((p) => !(p.agentResellerId ?? '').trim());
  }, [renewalProfiles, selectedSubscriber?.agentResellerId]);
  const renewalInfo = React.useMemo(
    () =>
      selectedSubscriber
        ? {
    subscriberId: selectedSubscriber.id,
    subscriberName: selectedSubscriber.fullName || 'غير محدد',
    subscriberPhone: selectedSubscriber.phoneNumber || 'غير محدد',
    currentProfile: {
              id: selectedSubscriber.profileName || 'غير محدد',
      name: selectedSubscriber.profileName || 'غير محدد',
      price: selectedSubscriber.profilePrice || 0
    },
    expirationDate: selectedSubscriber.expirationDate,
    daysUntilExpiry: selectedSubscriber.daysUntilExpiry || 0,
            availableProfiles: profilesList
          }
        : null,
    [selectedSubscriber, profilesList]
  );

  useEffect(() => {
    if (renewalInfo && !renewalData.newProfileId) {
      const currentProfile = renewalInfo.availableProfiles?.find(p => p.name === renewalInfo.currentProfile.name);
      if (currentProfile) {
        const salePrice = currentProfile.salePrice || 0;
        const isExtension = currentProfile.packageType === ProfilePackageType.Extension;
        setRenewalData(prev => ({
          ...prev,
          newProfileId: currentProfile.id,
          overrideSalePrice: isExtension ? 0 : salePrice,
          amountPaid: isExtension ? 0 : salePrice,
          remainingAmount: 0,
          debtDescription: '',
          debtDueDate: ''
        }));
      }
    }
  }, [renewalInfo, renewalData.newProfileId]);

  useEffect(() => {
    if (!showRenewalModal) {
      renewalProfileIdForAmountSyncRef.current = '';
    } else {
      setRenewalAmountFullyReceived(true);
    }
  }, [showRenewalModal]);

  useEffect(() => {
    if (!renewalData.newProfileId || !renewalInfo?.availableProfiles) return;
    const selectedProfile = renewalInfo.availableProfiles.find((p) => p.id === renewalData.newProfileId);
    if (!selectedProfile) return;

    const pid = renewalData.newProfileId;
    const profileSelectionChanged = renewalProfileIdForAmountSyncRef.current !== pid;
    if (!profileSelectionChanged) return;
    renewalProfileIdForAmountSyncRef.current = pid;

    const salePrice = selectedProfile.salePrice || 0;
    const isExtension = selectedProfile.packageType === ProfilePackageType.Extension;
    const amountPaid = isExtension ? 0 : renewalAmountFullyReceived ? salePrice : 0;
    const finalPrice = isExtension ? 0 : salePrice;
    const calculatedRemaining = Math.max(0, finalPrice - amountPaid);

    setRenewalData((prev) => ({
      ...prev,
      overrideSalePrice: isExtension ? 0 : salePrice,
      amountPaid,
      remainingAmount: isExtension ? 0 : calculatedRemaining,
      debtDescription:
        isExtension || calculatedRemaining === 0
          ? ''
          : !(prev.debtDescription || '').trim()
            ? `الباقي من المبلغ: ${formatNumber(calculatedRemaining, { suffix: ' د.ع' })}`
            : (prev.debtDescription ?? ''),
      debtDueDate: isExtension || calculatedRemaining === 0 ? '' : prev.debtDueDate || new Date().toISOString().split('T')[0],
    }));
  }, [renewalData.newProfileId, renewalInfo?.availableProfiles, renewalAmountFullyReceived, formatNumber]);

  const deleteSubscriberMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteSubscriber(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscribers'] });
      showSuccess('تم الحذف', 'تم حذف المشترك بنجاح');
    },
    onError: (error: any) => {
      console.error('Error deleting subscriber:', error);
      const errorMessage = ApiService.showError(error);
      showError('خطأ في الحذف', errorMessage);
    }
  });

  const syncSubscribersMutation = useMutation({
    mutationFn: (payload: SyncSubscribersRequest) =>
      apiService.syncSubscribers(payload),
    onMutate: () => {
      setSasSyncStep('sync_subscribers_loading');
      setSasPreviewError('');
    },
    onSuccess: (data) => {
      setSyncSubscribersList(data.data ?? []);
      setActivatedSubscriptionIds(new Set());
      setSasSyncStep('sync_subscribers_list');
      setSasPreviewError('');
    },
    onError: (err: any) => {
      setSasSyncStep('form');
      setSasPreviewError(ApiService.showError(err));
      setSasSyncStep('failed');
    },
  });

  const synchronizationFtthMutation = useMutation({
    mutationFn: (selectedReseller?: AgentReseller | null) => {
      const targetReseller = selectedReseller ?? autoSyncReseller;
      return targetReseller?.serviceType === ServiceType.Sas
        ? apiService.synchronizationSASDiff({
            resellerId: targetReseller?.id || undefined,
            agentId: user?.role === UserRole.Admin ? myAgent?.id : undefined,
            onlyDiff: true,
          })
        : apiService.synchronizationFTTHDiff({
            resellerId: targetReseller?.id || undefined,
            agentId: user?.role === UserRole.Admin ? myAgent?.id : undefined,
          });
    },
    onSuccess: (res) => {
      const filtered = filterAutoSyncFtthRowsWithDeviceUsername(res);
      setAutoSyncFtthResult(filtered);
      setSavedFtthRowIndices(new Set());
      setActivatedFtthRowIndices(new Set());
      setPendingFtthRenewalRowIndex(null);
      setShowAutoSyncModal(true);
      showSuccess('مزامنة تلقائيا', `تم جلب ${filtered.count ?? filtered.data?.length ?? 0} سجل بنجاح.`);
    },
    onError: (err: unknown) => {
      showError('مزامنة تلقائيا', ApiService.showError(err));
    },
  });
  const handleAutoSyncClick = () => {
    if (synchronizationFtthMutation.isPending) return;
    if ((myResellers?.length ?? 0) > 1 && hasMixedResellerTypes) {
      setShowAutoSyncResellerPickerModal(true);
      return;
    }
    synchronizationFtthMutation.mutate(autoSyncReseller ?? undefined);
  };

  const saveFtthSyncItemMutation = useMutation({
    mutationFn: ({ row, rowIndex }: { row: CashbackSynchronizationFtthRow; rowIndex: number }) =>
      (autoSyncReseller?.serviceType === ServiceType.Sas
        ? apiService.synchronizationSASDiffSave(row, {
            resellerId: autoSyncReseller?.id || undefined,
            agentId: user?.role === UserRole.Admin ? myAgent?.id : undefined,
          })
        : apiService.synchronizationFTTHSave(row, {
            resellerId: autoSyncReseller?.id || undefined,
            agentId: user?.role === UserRole.Admin ? myAgent?.id : undefined,
          })),
    onMutate: (variables) => {
      setSavingFtthRowIndex(variables.rowIndex);
    },
    onSuccess: (res, variables) => {
      setSavedFtthRowIndices((prev) => new Set(prev).add(variables.rowIndex));
      queryClient.invalidateQueries({ queryKey: ['subscribers'] });
      showSuccess('حفظ بدون خصم', res?.message ?? 'تم حفظ المشترك بدون خصم بنجاح.');
    },
    onError: (err: unknown) => {
      showError('حفظ بدون خصم', ApiService.showError(err));
    },
    onSettled: () => {
      setSavingFtthRowIndex(null);
    },
  });
  const saveAllSasSyncItemsMutation = useMutation({
    mutationFn: async () => {
      const rows = autoSyncFtthResult?.data ?? [];
      const resellerId = autoSyncReseller?.id || undefined;
      const agentId = user?.role === UserRole.Admin ? myAgent?.id : undefined;
      const pendingRows = rows
        .map((row, idx) => ({ row, idx }))
        .filter(({ idx }) => !savedFtthRowIndices.has(idx) && !activatedFtthRowIndices.has(idx));
      const settled = await Promise.allSettled(
        pendingRows.map(({ row }) => apiService.synchronizationSASDiffSave(row, { resellerId, agentId }))
      );
      return { settled, pendingRows };
    },
    onMutate: () => {
      setSavingAllSasRows(true);
    },
    onSuccess: ({ settled, pendingRows }) => {
      const succeededIndexes = pendingRows
        .map((item, i) => ({ idx: item.idx, ok: settled[i]?.status === 'fulfilled' }))
        .filter((x) => x.ok)
        .map((x) => x.idx);
      if (succeededIndexes.length > 0) {
        setSavedFtthRowIndices((prev) => {
          const next = new Set(prev);
          succeededIndexes.forEach((i) => next.add(i));
          return next;
        });
        queryClient.invalidateQueries({ queryKey: ['subscribers'] });
      }
      const failedCount = pendingRows.length - succeededIndexes.length;
      if (failedCount === 0) {
        showSuccess('حفظ الكل', `تم حفظ ${succeededIndexes.length} مشترك بنجاح.`);
      } else {
        showError('حفظ الكل', `تم حفظ ${succeededIndexes.length} وفشل ${failedCount}. يمكن إعادة المحاولة للمتبقي.`);
      }
    },
    onError: (err: unknown) => {
      showError('حفظ الكل', ApiService.showError(err));
    },
    onSettled: () => {
      setSavingAllSasRows(false);
    },
  });

  const openRenewalModalForFtthSyncRow = async (row: CashbackSynchronizationFtthRow, rowIndex: number) => {
    const username = (row.deviceUsername ?? row.username ?? '').toString().trim();
    if (!username) {
      showError('تفعيل المشترك', 'لا يمكن التفعيل لأن deviceUsername فارغ. احفظ المشترك أولاً ثم أعد المحاولة.');
      return;
    }
    setOpeningRenewalFtthRowIndex(rowIndex);
    try {
      let subscriberToRenew =
        (subscribers ?? []).find((s) => (s.username ?? '').toString().trim().toLowerCase() === username.toLowerCase()) ?? null;

      if (!subscriberToRenew) {
        const searchRes = await apiService.getSubscribers({ page: 1, pageSize: 20, search: username });
        subscriberToRenew =
          (searchRes.data ?? []).find((s) => (s.username ?? '').toString().trim().toLowerCase() === username.toLowerCase()) ??
          searchRes.data?.[0] ??
          null;
      }

      if (!subscriberToRenew?.id) {
        showError('تفعيل المشترك', 'تعذر العثور على المشترك داخل النظام بهذا اسم المستخدم. نفّذ الحفظ أولاً ثم أعد التفعيل.');
        return;
      }

      setSelectedSubscriberForRenewal(subscriberToRenew);
      setRenewalData({
        subscriberId: subscriberToRenew.id,
        newProfileId: '',
        paymentStatus: PaymentStatus.Paid,
        overrideSalePrice: 0,
        amountPaid: 0,
        notes: '',
        remainingAmount: 0,
        debtDescription: '',
        debtDueDate: ''
      });
      setRenewalViaSasTab(false);
      setPendingFtthRenewalRowIndex(rowIndex);
      setShowAutoSyncModal(false);
      setShowRenewalModal(true);
    } catch (err: unknown) {
      showError('تفعيل المشترك', ApiService.showError(err));
    } finally {
      setOpeningRenewalFtthRowIndex(null);
    }
  };

  const saveSubscriberFromSyncMutation = useMutation({
    mutationFn: ({ body, agentId }: { rowId?: number; body: SaveSubscriberFromSyncRequest; agentId?: string }) =>
      apiService.saveSubscriberFromSync(body, agentId),
    onMutate: (variables) => {
      setSavingSubscriberRowId(variables.rowId ?? null);
    },
    onSuccess: (data, variables) => {
      if (variables.rowId != null) setSavedSubscriberRowIds((prev) => new Set(prev).add(variables.rowId!));
      showSuccess('حفظ المشترك', data?.message ?? 'تم حفظ المشترك بنجاح.');
      queryClient.invalidateQueries({ queryKey: ['subscribers'] });
    },
    onError: (err: any) => {
      showError('حفظ المشترك', ApiService.showError(err));
    },
    onSettled: () => {
      setSavingSubscriberRowId(null);
    },
  });

  const updateSubscriptionMutation = useMutation({
    mutationFn: (payload: UpdateSubscriptionRequest) =>
      apiService.updateSubscription(payload),
    onMutate: (variables) => {
      setUpdatingSubscriptionId(variables.id);
    },
    onSuccess: (data, variables) => {
      setActivatedSubscriptionIds((prev) => new Set(prev).add(variables.id));
      queryClient.invalidateQueries({ queryKey: ['subscribers'] });
      queryClient.invalidateQueries({ queryKey: ['subscribers-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['balance-detail'] });
      showSuccess('تم التفعيل', data.message ?? 'تم تفعيل المشترك بنجاح.');
    },
    onError: (err: any) => {
      showError('خطأ التفعيل', ApiService.showError(err));
    },
    onSettled: () => {
      setUpdatingSubscriptionId(null);
    },
  });

  const createSubscriberMutation = useMutation({
    mutationFn: (subscriberData: SubscriberCreateRequest) => apiService.createSubscriber(subscriberData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscribers'] });
      setShowAddModal(false);
      setFormData({
        secruptionId: '',
        username: '',
        password: '',
        firstName: '',
        lastName: '',
        phoneNumber: '',
        noteType: SubscriberNoteType.NoResponse,
        note: '',
        profileId: '',
        activationDate: new Date().toISOString().split('T')[0],
        expirationDate: new Date().toISOString().split('T')[0],
        subscriptionType: SubscriptionType.Paid,
        fat: '',
        zone: '',
        agentResellerId: selectedOperationalResellerId || ''
      });
      showSuccess('تم الإنشاء', 'تم إنشاء المشترك بنجاح');
    },
    onError: (error: any) => {
      console.error('Error creating subscriber:', error);
      const errorMessage = ApiService.showError(error);
      showError('خطأ في الإنشاء', errorMessage);
    }
  });

  const createRenewalMutation = useMutation({
    mutationFn: async (renewalData: RenewalData) => {
      if (!online) {
        await queueOperation('CreateRenewal', buildCreateRenewalPayload(renewalData));
        return { receiptNumber: '(معلق للمزامنة)', subscriberId: renewalData.subscriberId } as any;
      }
      return await apiService.createRenewal(renewalData);
    },
    onSuccess: async (receiptData, renewalData) => {
      const isOfflineQueued = receiptData?.receiptNumber === '(معلق للمزامنة)';
      if (isOfflineQueued) {
        showSuccess('تم الحفظ محلياً', 'سيتم رفع التجديد عند عودة الاتصال');
        await refreshPendingCount();
      }
      console.log('Receipt data received from backend:', receiptData);
      console.log('Receipt number in received data:', receiptData?.receiptNumber);

      queryClient.invalidateQueries({ queryKey: ['subscribers'] });
      queryClient.invalidateQueries({ queryKey: ['renewal-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['subscribers-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['balance-detail'] });
      setShowRenewalModal(false);
      setRenewalViaSasTab(false);
      setSelectedIds([]);

      const normalizedReceipt = {
        ...receiptData,
        subscriberId: receiptData.subscriberId ?? renewalData.subscriberId,
      };

      console.log('Final receipt data to display:', normalizedReceipt);
      console.log('Final receipt number:', normalizedReceipt?.receiptNumber);

      setLastReceipt(normalizedReceipt);
      setShowReceiptModal(true);
      
      setSelectedSubscriberForRenewal(null);
      setShowRenewalModal(false);
      if (pendingFtthRenewalRowIndex != null) {
        setActivatedFtthRowIndices((prev) => new Set(prev).add(pendingFtthRenewalRowIndex));
        setShowAutoSyncModal(true);
        setPendingFtthRenewalRowIndex(null);
      }
      setRenewalData({
        subscriberId: '',
        newProfileId: '',
        paymentStatus: PaymentStatus.Paid,
        overrideSalePrice: 0,
        amountPaid: 0,
        notes: '',
        remainingAmount: 0,
        debtDescription: '',
        debtDueDate: ''
      });
    },
    onError: (error: any) => {
      console.error('Error creating renewal:', error);
      const errorMessage = ApiService.showError(error);
      const rawMessage = error?.response?.data?.message ?? error?.originalError?.response?.data?.message ?? '';
      const isInsufficientBalance =
        /رصيد غير كاف|insufficient balance|رصيد الوكيل غير كاف/i.test(errorMessage) ||
        (rawMessage && /insufficient|رصيد غير كاف/i.test(String(rawMessage)));
      if (isInsufficientBalance) {
        showError(
          'لا يمكن تفعيل المشترك',
          'الرصيد غير كافي. يرجى تعبئة الرصيد من صفحة الرصيد (للمنطقة المعنية) ثم المحاولة مرة أخرى.'
        );
      } else {
      showError('خطأ في التجديد', errorMessage);
      }
      if (pendingFtthRenewalRowIndex != null) {
        setShowAutoSyncModal(true);
      }
    }
  });

  const handlePostUpdateSubscriptionSuccess = (
    data: UpdateSubscriptionResponse,
    variables: UpdateSubscriptionRequest,
    mode: 'activation' | 'details'
  ) => {
    setActivatedSubscriptionIds((prev) => new Set(prev).add(variables.id));
    queryClient.invalidateQueries({ queryKey: ['subscribers'] });
    queryClient.invalidateQueries({ queryKey: ['subscribers-dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['balance-detail'] });
    showSuccess('تم التفعيل', data.message ?? 'تم تفعيل المشترك بنجاح.');
    if (data.subscriberId) {
      setPostActivationWhatsApp({ subscriberId: data.subscriberId, mode });
    }
  };

  const renewMutation = useMutation({
    mutationFn: (ids: string[]) => apiService.renewSubscribers(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscribers'] });
      setSelectedIds([]);
    },
  });

  const updateSubscriberMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiService.updateSubscriber(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscribers'] });
      setShowEditModal(false);
      setSelectedSubscriberForEdit(null);
    },
  });
  
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
    setMaxDaysUntilExpiry('');
    setAppliedMaxDaysUntilExpiry('');
    setFatFilter('');
    setZoneFilter('');
    setAppliedFatFilter('');
    setAppliedZoneFilter('');
    setNoteTypeFilter('all');
    setAppliedNoteTypeFilter('all');
    setExtensionActivationFilter(false);
    setAppliedExtensionActivationFilter(false);
    setExpirationFromDate('');
    setExpirationToDate('');
    setAppliedExpirationFromDate('');
    setAppliedExpirationToDate('');
    setCurrentPage(1);
  };

  const handleApplyAdvancedFilter = () => {
    setDebouncedSearchTerm(searchTerm.trim());
    setAppliedMaxDaysUntilExpiry(maxDaysUntilExpiry.trim());
    setAppliedFatFilter(fatFilter.trim());
    setAppliedZoneFilter(zoneFilter.trim());
    setAppliedNoteTypeFilter(noteTypeFilter);
    setAppliedExtensionActivationFilter(extensionActivationFilter);
    setAppliedExpirationFromDate(expirationFromDate.trim());
    setAppliedExpirationToDate(expirationToDate.trim());
    setCurrentPage(1);
  };

  /** تطبيق البحث؛ للموظف بدون صلاحية عرض الكل يلزم إدخال الاسم الأول والثاني (كلمتين على الأقل) */
  const applySearch = () => {
    const term = searchTerm.trim();
    if (requireTwoWordsForSearch && term) {
      const words = term.split(/\s+/).filter(Boolean);
      if (words.length < 2) {
        showError('بحث المشتركين', 'يرجى إدخال الاسم الأول والثاني للبحث (كلمتين على الأقل).');
        return;
      }
    }
    setDebouncedSearchTerm(term);
    setCurrentPage(1);
  };

  const hasActiveAdvancedFilter =
    appliedExpirationFromDate !== '' || appliedExpirationToDate !== '' ||
    appliedMaxDaysUntilExpiry !== '' || appliedFatFilter !== '' || appliedZoneFilter !== '' ||
    appliedNoteTypeFilter !== 'all' || appliedExtensionActivationFilter || (debouncedSearchTerm?.trim() ?? '') !== '' || statusFilter !== 'all';

  useEffect(() => {
    if (showAdvancedFilter) {
      setSearchTerm(debouncedSearchTerm ?? '');
      setFatFilter(appliedFatFilter);
      setZoneFilter(appliedZoneFilter);
      setNoteTypeFilter(appliedNoteTypeFilter);
      setExtensionActivationFilter(appliedExtensionActivationFilter);
      setMaxDaysUntilExpiry(appliedMaxDaysUntilExpiry);
      setExpirationFromDate(appliedExpirationFromDate?.split('T')[0] ?? '');
      setExpirationToDate(appliedExpirationToDate?.split('T')[0] ?? '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAdvancedFilter]);

  const getStatusBadge = (subscriber: Subscriber) => {
    const statusConfig: Record<SubscriptionStatus, { text: string; class: string }> = {
      [SubscriptionStatus.Active]: { 
        text: 'فعال', 
        class: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
      },
      [SubscriptionStatus.ExpiringSoon]: { 
        text: 'سينتهي قريباً', 
        class: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' 
      },
      [SubscriptionStatus.Expired]: { 
        text: 'منتهي', 
        class: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' 
      },
      [SubscriptionStatus.ExpiredToday]: {
        text: 'سينتهي اليوم',
        class: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300'
      },
    };

    const backendStatus = subscriber.status as SubscriptionStatus | undefined;
    const config =
      backendStatus && statusConfig[backendStatus]
        ? statusConfig[backendStatus]
        : subscriber.isSubscriptionActive === true
          ? statusConfig[SubscriptionStatus.Active]
          : subscriber.isSubscriptionActive === false
            ? statusConfig[SubscriptionStatus.Expired]
            : statusConfig[SubscriptionStatus.Active];
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.class}`}>
        {config.text}
      </span>
    );
  };

  const _handleDelete = async (id: string) => {
    const confirmed = await confirmDelete('مشترك');
    if (confirmed) {
      deleteSubscriberMutation.mutate(id);
    }
  };
  void _handleDelete;

  const validateSubscriberData = (data: any): string | null => {
    if (!data.username || !data.password || !data.firstName || !data.lastName || !data.phoneNumber || !data.profileId) {
      return 'يرجى ملء جميع الحقول المطلوبة';
    }
    const secruptionId = (data.secruptionId ?? '').toString().trim();
    if (!secruptionId) {
      return 'معرف الاشتراك مطلوب';
    }
    if (secruptionId.length > 100) {
      return 'معرف الاشتراك يجب أن يكون أقل من 100 حرف';
    }
    if (data.username.length < 3) {
      return 'اسم المستخدم يجب أن يكون على الأقل 3 أحرف';
    }
    if (data.username.length > 100) {
      return 'اسم المستخدم يجب أن يكون أقل من 100 حرف';
    }
    if (data.password.length < 4) {
      return 'كلمة المرور يجب أن تكون على الأقل 4 أحرف';
    }
    if (data.firstName.length > 100) {
      return 'الاسم الأول يجب أن يكون أقل من 100 حرف';
    }
    if (data.lastName.length > 100) {
      return 'الاسم الأخير يجب أن يكون أقل من 100 حرف';
    }
    if (data.phoneNumber.length < 10) {
      return 'رقم الهاتف يجب أن يكون على الأقل 10 أرقام';
    }
    if (data.phoneNumber.length > 20) {
      return 'رقم الهاتف يجب أن يكون أقل من 20 رقم';
    }
    if (data.wifiCode && data.wifiCode.length > 100) {
      return 'كود الواي فاي يجب أن يكون أقل من 100 حرف';
    }
    if (data.note && data.note.length > 1000) {
      return 'الملاحظة يجب أن تكون أقل من 1000 حرف';
    }
    if (data.noteType === SubscriberNoteType.Other) {
      const noteText = (data.note ?? '').toString().trim();
      if (!noteText) {
        return 'يرجى كتابة نص الملاحظة عند اختيار "أخرى"';
      }
    }
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isAgentOrSubAgentOrEmployee && myResellers.length > 0 && !selectedOperationalResellerId) {
      showError('المنطقة مطلوبة', 'يرجى اختيار المنطقة أولاً من قائمة المناطق قبل إضافة مشترك.');
      return;
    }
    
    const validationError = validateSubscriberData(formData);
    if (validationError) {
      showError('خطأ في التحقق', validationError);
      return;
    }
    
    const noteType = formData.noteType ?? null;
    const noteText = (formData.note ?? '').toString().trim();
    const payload: SubscriberCreateRequest = {
      ...formData,
      secruptionId: (formData.secruptionId ?? '').trim(),
      noteType,
      note: noteType === SubscriberNoteType.Other ? (noteText || undefined) : undefined,
      agentResellerId: selectedOperationalResellerId || undefined,
    };
    console.log('Submitting subscriber data:', payload);
    createSubscriberMutation.mutate(payload);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      if (name === 'noteType') {
        const nextNoteType =
          value === '' ? null : (parseInt(value, 10) as SubscriberNoteType);
        return {
      ...prev,
          noteType: nextNoteType,
          note: nextNoteType === SubscriberNoteType.Other ? prev.note : '',
        };
      }
      return {
        ...prev,
        [name]: value,
      } as any;
    });
  };

  const applyRenewalAmountsForProfile = (
    salePrice: number,
    isExtension: boolean,
    fullyReceived: boolean
  ) => {
    if (isExtension) {
      return {
        overrideSalePrice: 0,
        amountPaid: 0,
        remainingAmount: 0,
        debtDescription: '',
        debtDueDate: '',
        paymentStatus: PaymentStatus.Paid,
      };
    }
    if (fullyReceived) {
      return {
        overrideSalePrice: salePrice,
        amountPaid: salePrice,
        remainingAmount: 0,
        debtDescription: '',
        debtDueDate: '',
        paymentStatus: PaymentStatus.Paid,
      };
    }
    const remaining = salePrice;
    return {
      overrideSalePrice: salePrice,
      amountPaid: 0,
      remainingAmount: remaining,
      debtDescription: remaining > 0 ? `الباقي من المبلغ: ${formatNumber(remaining, { suffix: ' د.ع' })}` : '',
      debtDueDate: remaining > 0 ? new Date().toISOString().split('T')[0] : '',
      paymentStatus: PaymentStatus.Unpaid,
    };
  };

  const handleRenewalFullyPaidToggle = (fullyReceived: boolean) => {
    setRenewalAmountFullyReceived(fullyReceived);
    const selectedProfile = renewalInfo?.availableProfiles?.find((p) => p.id === renewalData.newProfileId);
    if (!selectedProfile) return;
    const salePrice = selectedProfile.salePrice || 0;
    const isExtension = selectedProfile.packageType === ProfilePackageType.Extension;
    setRenewalData((prev) => ({
      ...prev,
      ...applyRenewalAmountsForProfile(salePrice, isExtension, fullyReceived),
    }));
  };

  const handleRenewalInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (name.startsWith('wiFiQRCode.')) {
      const field = name.split('.')[1];
      setRenewalData(prev => ({
        ...prev,
        wiFiQRCode: {
          ...prev.wiFiQRCode!,
          [field]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
        }
      }));
    } else {
      const newValue = type === 'number' ? Number(value) : value;
      
      setRenewalData(prev => {
        const updated = {
          ...prev,
          [name]: newValue
        };
        const selectedProfile = renewalInfo?.availableProfiles?.find(p => p.id === updated.newProfileId);
        const isExtension = selectedProfile?.packageType === ProfilePackageType.Extension;

        if (isExtension && (name === 'amountPaid' || name === 'overrideSalePrice' || name === 'debtDescription' || name === 'debtDueDate')) {
          updated.overrideSalePrice = 0;
          updated.amountPaid = 0;
          updated.remainingAmount = 0;
          updated.debtDescription = '';
          updated.debtDueDate = '';
          return updated;
        }

        if (name === 'newProfileId') {
          const rawId = String(newValue ?? '');
          renewalProfileIdForAmountSyncRef.current = rawId;
          if (!rawId) {
            updated.overrideSalePrice = 0;
            updated.amountPaid = 0;
            updated.remainingAmount = 0;
            updated.debtDescription = '';
            updated.debtDueDate = '';
            return updated;
          }
          const sp = renewalInfo?.availableProfiles?.find((p) => p.id === rawId);
          const ext = sp?.packageType === ProfilePackageType.Extension;
          const salePrice = sp?.salePrice || 0;
          Object.assign(updated, applyRenewalAmountsForProfile(salePrice, !!ext, renewalAmountFullyReceived));
          return updated;
        }

        if (name === 'amountPaid') {
          const salePrice = selectedProfile?.salePrice || 0;
          const finalPrice = updated.overrideSalePrice || salePrice || 0;
          const amountPaid = Number(newValue);
          const calculatedRemaining = Math.max(0, finalPrice - amountPaid);

          updated.remainingAmount = calculatedRemaining;
          updated.paymentStatus = calculatedRemaining > 0 ? PaymentStatus.Unpaid : PaymentStatus.Paid;
          if (calculatedRemaining > 0) {
            if (!(updated.debtDescription || '').trim()) {
              updated.debtDescription = `الباقي من المبلغ: ${formatNumber(calculatedRemaining, { suffix: ' د.ع' })}`;
            }
            if (!(updated.debtDueDate || '').toString().trim()) {
              updated.debtDueDate = new Date().toISOString().split('T')[0];
            }
          } else {
            updated.debtDescription = '';
            updated.debtDueDate = '';
          }
        }
        
        return updated;
      });
    }
  };

  const handleRenewalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedProfile = renewalInfo?.availableProfiles?.find(p => p.id === renewalData.newProfileId);
    const isExtension = selectedProfile?.packageType === ProfilePackageType.Extension;

    if (!isExtension && (renewalData.remainingAmount || 0) > 0) {
      const due = (renewalData.debtDueDate || '').toString().trim();
      if (!due) {
        showError('خطأ', 'يرجى اختيار تاريخ تسديد الدين عند وجود مبلغ متبقي.');
        return;
      }
    }

    const enhancedRenewalData = {
      ...renewalData,
      notes: '',
      paymentStatus: isExtension
        ? PaymentStatus.Paid
        : renewalAmountFullyReceived
          ? PaymentStatus.Paid
          : renewalData.paymentStatus,
      overrideSalePrice: isExtension ? 0 : renewalData.overrideSalePrice || selectedProfile?.salePrice || 0,
      amountPaid: isExtension ? 0 : renewalData.amountPaid,
      remainingAmount: isExtension ? 0 : renewalData.remainingAmount,
      debtDescription: isExtension ? '' : renewalData.debtDescription,
      debtDueDate: isExtension ? '' : renewalData.debtDueDate,
      currentExpirationDate: renewalInfo?.expirationDate,
      renewalPeriod: selectedProfile?.renewalPeriod || 30
    };

    // تم تعليق التفعيل عبر سكربت البايثون مؤقتاً.
    createRenewalMutation.mutate(enhancedRenewalData);
  };

  // دالة لإنشاء QR Code كـ base64
  const generateQRCodeBase64 = async (text: string): Promise<string> => {
    try {
      const qrCodeDataURL = await QRCode.toDataURL(text, {
        width: 80,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      return qrCodeDataURL;
    } catch (error: any) {
      console.error('Error generating QR Code:', error);
      const errorMessage = ApiService.showError(error);
      console.warn('QR Code generation failed:', errorMessage);
      return '';
    }
  };

  const handlePrintReceipt = async (receipt: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('يرجى السماح بالنوافذ المنبثقة (Pop-ups) لطباعة الفاتورة');
      return;
    }

    // إنشاء QR Code
    let qrCodeHtml = '';
    if (receipt.wiFiQRCode || receipt.wifiCode) {
      let wifiString = '';
      if (receipt.wiFiQRCode) {
        wifiString = `WIFI:T:${receipt.wiFiQRCode.encryption === 0 ? 'WPA' : receipt.wiFiQRCode.encryption === 1 ? 'WEP' : 'nopass'};S:${receipt.wiFiQRCode.ssid};P:${receipt.wiFiQRCode.password};H:${receipt.wiFiQRCode.isHidden ? 'true' : 'false'};;`;
      } else {
        wifiString = receipt.wifiCode;
      }
      
      const qrCodeDataURL = await generateQRCodeBase64(wifiString);
      
      qrCodeHtml = `
        <div class="qrcode-block">
          <div class="qrcode-title">QR للشبكة</div>
          <div class="qrcode-wrap">
            ${qrCodeDataURL ? `<img src="${qrCodeDataURL}" alt="QR Code" class="qrcode-img" />` : '<div class="qrcode-placeholder">خطأ</div>'}
            <div class="qrcode-info">
              ${receipt.wiFiQRCode ? `
                <div>${receipt.wiFiQRCode.ssid}</div>
                ${receipt.wiFiQRCode.password ? `<div>${receipt.wiFiQRCode.password}</div>` : ''}
              ` : `<div>${receipt.wifiCode}</div>`}
            </div>
          </div>
        </div>
      `;
    }

    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>فاتورة - ${receipt.receiptNumber}</title>
        <style>
          * { 
            box-sizing: border-box; 
            -webkit-print-color-adjust: exact; 
          }
          
          @page { 
            size: 80mm auto; 
            margin: 0; 
          }

          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 0;
            width: 80mm;
            max-width: 80mm;
            background: white;
            color: #000;
            direction: rtl;
            font-size: 10px;
            line-height: 1.3;
          }

          .receipt-container {
            width: 100%;
            max-width: 80mm;
            padding: 2mm;
            display: block;
            page-break-after: always;
            page-break-inside: avoid;
          }

          .header {
            text-align: center;
            border-bottom: 1px dashed #000;
            padding-bottom: 3mm;
            margin-bottom: 3mm;
          }

          .header h1 {
            margin: 0;
            font-size: 14px; 
            text-transform: uppercase;
          }

          .header p {
            margin: 1mm 0; 
            font-size: 9px; 
          }

          .section {
            margin-bottom: 3mm; 
          }

          .section h3 {
            margin: 0 0 1.5mm 0; 
            font-size: 10px; 
            border-bottom: 0.5px solid #ccc;
            padding-bottom: 0.5mm;
          }

          .info-row {
            display: flex;
            justify-content: space-between;
            margin: 1mm 0; 
          }

          .label { font-weight: bold; }
          .value { text-align: left; }

          .pricing { 
            background: #f0f0f0 !important;
            padding: 2mm; 
            border-radius: 2px; 
            margin: 3mm 0; 
          }

          .total-row {
            border-top: 1px solid #000;
            margin-top: 1mm;
            padding-top: 1mm;
            font-weight: bold;
            font-size: 11px;
          }

          .qrcode-block { 
            text-align: center; 
            margin: 4mm 0; 
          }
          
          .qrcode-img { 
            width: 35mm; 
            height: 35mm; 
            display: inline-block; 
          }

          .footer {
            text-align: center;
            font-size: 8px; 
            margin-top: 4mm;
            border-top: 1px dashed #ccc;
            padding-top: 2mm;
          }

          @media print {
            body { width: 80mm; max-width: 80mm; }
            .no-print { display: none; }
            header, footer { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <div class="header">
            <h1>فاتورة التفعيل</h1>
            <p><strong>رقم الفاتورة:</strong> ${receipt.receiptNumber}</p>
            <p>${formatDate(receipt.renewalDate)} | ${new Date(receipt.renewalDate).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</p>
          </div>

          <div class="section">
            <h3>معلومات المشترك</h3>
            <div class="info-row">
              <span class="label">الاسم:</span>
              <span class="value">${receipt.subscriberName}</span>
            </div>
            <div class="info-row">
              <span class="label">الهاتف:</span>
              <span class="value">${receipt.subscriberPhone}</span>
            </div>
            <div class="info-row">
            
              <span class="label">الباقة:</span>
              <span class="value">${receipt.newProfileName}</span>
            </div>
          </div>

          <div class="section">
            <h3>الصلاحية</h3>
            <div class="info-row">
              <span class="label">تاريخ الانتهاء:</span>
              <span class="value">${formatDate(receipt.newExpirationDate)}</span>
            </div>
            </div>

          <div class="qrcode-block">
            <div class="qrcode-wrap">
              ${qrCodeHtml}
            </div>
            <div style="font-size: 7px; margin-top: 1mm;">امسح الكود للتحقق</div>
          </div>

          <div class="pricing">
            ${Number(receipt?.discountAmount ?? 0) > 0 ? `
            <div class="info-row" style="color: #000;">
              <span class="label">الخصم:</span>
              <span class="value">-${Number(receipt?.discountAmount ?? 0).toLocaleString()} د.ع</span>
            </div>
            ` : ''}
            <div class="info-row">
              <span class="label">السعر النهائي:</span>
              <span class="value">${Number(receipt?.finalPrice ?? 0).toLocaleString()} د.ع</span>
            </div>
            <div class="info-row total-row">
              <span class="label">المبلغ الواصل:</span>
              <span class="value">${Number(receipt?.amountPaid ?? 0).toLocaleString()} د.ع</span>
            </div>
            <div class="info-row" style="margin-top: 1mm;">
              <span class="label">المتبقي (دين):</span>
              <span class="value">${(Number(receipt?.finalPrice ?? 0) - Number(receipt?.amountPaid ?? 0)).toLocaleString()} د.ع</span>
            </div>
          </div>

          ${receipt.notes ? `
          <div class="section">
            <p style="font-size: 8px; border: 0.5px solid #000; padding: 1mm;"><strong>ملاحظات:</strong> ${receipt.notes}</p>
          </div>
          ` : ''}

          <div class="footer">
            <p>شكراً لثقتكم بنا</p>
            <p>يرجى الاحتفاظ بالوصل لضمان حقك</p>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    
    let printInvoked = false;
    const doPrintOnce = () => {
      if (printInvoked) return;
      printInvoked = true;
      printWindow.focus();
      printWindow.print();
      const closeAfterPrint = () => {
      printWindow.close();
      };
      if (typeof printWindow.onafterprint !== 'undefined') {
        printWindow.onafterprint = closeAfterPrint;
    } else {
        setTimeout(closeAfterPrint, 1500);
      }
    };

    printWindow.onload = doPrintOnce;
  };

  const getWhatsAppReminderErrorMessage = (err: any): string => {
    const msg = ApiService.showError(err);
    if (/قالب|قالب لرسالة|رسالة واحدة على الأقل/.test(msg)) {
      return msg + '\n\nلإعداد قوالب الرسائل: الإعدادات ← رسالة التفعيل، رسالة تنبيه الاشتراك، رسالة الدين او التفاصيل.';
    }
    return msg;
  };

  /** فشل GET /Agents/me يمنع إرسال واتساب قبل أي طلب لإرسال الرسالة — لذلك قد لا يظهر طلب جديد في Network عند الضغط. */
  const showMyAgentFetchFailed = (title: string) => {
    const detail = myAgentError ? getWhatsAppReminderErrorMessage(myAgentError) : '';
    showError(
      title,
      `تعذّر جلب بيانات الوكيل من الخادم (طلب /Agents/me). ${detail ? `${detail} ` : ''}افتح Network وابحث عن «Agents/me» عند تحميل الصفحة، أو حدّث الصفحة ثم أعد المحاولة.`
    );
  };

  const sendWhatsAppToSelected = async (
    title: string,
    sender: (subscriberId: string) => Promise<void>
  ) => {
    if (!subscribers || selectedIds.length === 0 || !hasWhatsAppSession) return;
    const withPhone = selectedIds
      .map(id => subscribers.find(s => s.id === id))
      .filter((s): s is Subscriber => !!s && !!(s.phoneNumber?.trim()));
    if (withPhone.length === 0) {
      showError(title, 'لا يوجد لدى المشتركين المحددين رقم هاتف.');
      return;
    }

    setSendReminderLoading(true);
    showInfo(title, `جاري الإرسال إلى ${withPhone.length} مشترك...`);
    let successCount = 0;
    let lastError: string | null = null;

    for (const sub of withPhone) {
      const displayName =
        (sub.fullName || '').trim() ||
        `${sub.firstName || ''} ${sub.lastName || ''}`.trim() ||
        sub.username;
      try {
        showInfo(title, `جاري الإرسال إلى ${displayName}...`);
        await sender(sub.id);
        successCount++;
        showSuccess(title, `تم الإرسال إلى ${displayName}.`);
      } catch (err: any) {
        lastError = getWhatsAppReminderErrorMessage(err);
        showError(title, `فشل الإرسال إلى ${displayName}: ${lastError}`);
      }
    }

    setShowActionsDropdown(false);
    setSendReminderLoading(false);
    if (successCount > 0) {
      showSuccess(
        title,
        (successCount === withPhone.length
          ? 'تم الإرسال بنجاح.'
          : `تم الإرسال لـ ${successCount} من ${withPhone.length}. ${lastError ? `آخر خطأ: ${lastError}` : ''}`) +
          ' تحقق من وصولها في واتساب؛ إن لم تصل فراجع سجلات الباكند وجلسة واتساب المربوطة.'
      );
    }
    if (lastError && successCount === 0) {
      showError(title, lastError);
    }
  };

  const handleSendWhatsApp = async (receipt: any) => {
    if (myAgentLoading) {
      showInfo('إرسال واتساب', 'جاري التحقق من جلسة واتساب...');
      return;
    }
    if (myAgentError) {
      showMyAgentFetchFailed('إرسال واتساب');
      return;
    }
    if (!hasWhatsAppSession) {
      showError('إرسال واتساب', 'لم يتم حفظ معرف جلسة واتساب في Wakeel. افتح الإعدادات ← ربط واتساب ← ثم اضغط «حفظ معرف الجلسة في Wakeel».');
      return;
    }
    const subscriberId = receipt.subscriberId;
    if (!subscriberId) {
      showError('إرسال واتساب', 'معرف المشترك غير متوفر.');
      return;
    }
    try {
      try {
        const normalizeActivationTemplateForBackend = (template: string): string => {
          let out = String(template || '');
          out = out.replace(/\{\{\s*subscriberName\s*\}\}/gi, '{{SubscriberName}}');
          out = out.replace(/\{\{\s*subscriberPhone\s*\}\}/gi, '{{SubscriberPhone}}');
          out = out.replace(/\{\{\s*phoneNumber\s*\}\}/gi, '{{PhoneNumber}}');
          out = out.replace(/\{\{\s*activationDate\s*\}\}/gi, '{{ActivationDate}}');
          out = out.replace(/\{\{\s*expirationDate\s*\}\}/gi, '{{ExpirationDate}}');
          out = out.replace(/\{\{\s*daysUntilExpiry\s*\}\}/gi, '{{DaysUntilExpiry}}');
          out = out.replace(/\{\{\s*profileName\s*\}\}/gi, '{{ProfileName}}');
          out = out.replace(/\{\{\s*companyName\s*\}\}/gi, '{{AgentCompanyName}}');
          out = out.replace(/\{\{\s*agentCompanyName\s*\}\}/gi, '{{AgentCompanyName}}');
          out = out.replace(/\{\{\s*CompanyName\s*\}\}/g, '{{AgentCompanyName}}');
          out = out.replace(/\{\{\s*debtDueDate\s*\}\}/gi, '{{DebtDueDate}}');
          out = out.replace(/\{\{\s*debtAmount\s*\}\}/gi, '{{DebtAmount}}');
          return out;
        };

        const isBarePlaceholdersTemplate = (template: string): boolean => {
          const t = String(template || '');
          const withoutTokens = t.replace(/\{\{\s*[A-Za-z]+\s*\}\}/g, '');
          const withoutNoise = withoutTokens.replace(/[\s\r\n\t\-—–_,.،؛:|/\\]+/g, '');
          return withoutNoise.length === 0;
        };

        const current = await apiService.getActivationMessage();
        const currentTpl = (current?.template || '').trim();
        if (!currentTpl) {
          await apiService.setActivationMessage(DEFAULT_ACTIVATION_TEMPLATE);
        } else if (isBarePlaceholdersTemplate(currentTpl)) {
          await apiService.setActivationMessage(DEFAULT_ACTIVATION_TEMPLATE);
        } else if (/\{\{\s*subscriber(Name|Phone)\s*\}\}|\{\{\s*activationDate\s*\}\}|\{\{\s*expirationDate\s*\}\}|\{\{\s*companyName\s*\}\}/i.test(currentTpl)) {
          await apiService.setActivationMessage(normalizeActivationTemplateForBackend(currentTpl));
        }
      } catch {
        // ignore template fix errors
      }
      await apiService.sendWhatsAppActivation(subscriberId);
      showSuccess('إرسال واتساب', 'تم إرسال رسالة التفعيل/التجديد بنجاح. تحقق من وصولها في واتساب المشترك؛ إن لم تصل فراجع سجلات الباكند وجلسة واتساب المربوطة.');
    } catch (err: any) {
      showError('إرسال واتساب', getWhatsAppReminderErrorMessage(err));
    }
  };

  const handleSendSubscriberDetails = async (subscriber: Subscriber) => {
    if (myAgentLoading) {
      showInfo('إرسال دين او التفاصيل', 'جاري التحقق من جلسة واتساب...');
      return;
    }
    if (myAgentError) {
      showMyAgentFetchFailed('إرسال دين او التفاصيل');
      return;
    }
    if (!hasWhatsAppSession) {
      showError('إرسال دين او التفاصيل', 'لم يتم حفظ معرف جلسة واتساب في Wakeel. افتح الإعدادات ← ربط واتساب ← ثم اضغط «حفظ معرف الجلسة في Wakeel».');
      return;
    }
    if (!subscriber.phoneNumber?.trim()) {
      showError('إرسال دين او التفاصيل', 'رقم هاتف المشترك غير معرّف.');
      return;
    }
    try {
      await apiService.sendWhatsAppDetails(subscriber.id);
      showSuccess('إرسال تفاصيل المشترك', 'تم إرسال رسالة الدين او التفاصيل بنجاح. تحقق من وصولها في واتساب المشترك؛ إن لم تصل فراجع سجلات الباكند وجلسة واتساب المربوطة.');
    } catch (err: any) {
      const msg = ApiService.showError(err);
      if (/لا يوجد قالب لرسالة تفاصيل المشترك/.test(msg)) {
        try {
          showInfo('إرسال دين او التفاصيل', 'لا يوجد قالب تفاصيل. سيتم إنشاء القالب الافتراضي تلقائياً ثم إعادة الإرسال...');
          await apiService.setDetailsMessage(DEFAULT_DETAILS_TEMPLATE);
          await apiService.sendWhatsAppDetails(subscriber.id);
          showSuccess('إرسال تفاصيل المشترك', 'تم إنشاء القالب الافتراضي وإرسال رسالة الدين او التفاصيل بنجاح.');
          return;
        } catch (e: any) {
          showError('إرسال تفاصيل المشترك', getWhatsAppReminderErrorMessage(e));
          return;
        }
      }
      showError('إرسال تفاصيل المشترك', getWhatsAppReminderErrorMessage(err));
    }
  };

  const handleSendSubscriberDetailsById = async (subscriberId: string) => {
    if (myAgentLoading) {
      showInfo('إرسال دين او التفاصيل', 'جاري التحقق من جلسة واتساب...');
      return;
    }
    if (myAgentError) {
      showMyAgentFetchFailed('إرسال دين او التفاصيل');
      return;
    }
    if (!hasWhatsAppSession) {
      showError('إرسال دين او التفاصيل', 'لم يتم حفظ معرف جلسة واتساب في Wakeel. افتح الإعدادات ← ربط واتساب ← ثم اضغط «حفظ معرف الجلسة في Wakeel».');
      return;
    }
    try {
      await apiService.sendWhatsAppDetails(subscriberId);
      showSuccess('إرسال تفاصيل المشترك', 'تم إرسال رسالة الدين او التفاصيل بنجاح. تحقق من وصولها في واتساب المشترك؛ إن لم تصل فراجع سجلات الباكند وجلسة واتساب المربوطة.');
    } catch (err: any) {
      const msg = ApiService.showError(err);
      if (/لا يوجد قالب لرسالة تفاصيل المشترك/.test(msg)) {
        try {
          showInfo('إرسال دين او التفاصيل', 'لا يوجد قالب تفاصيل. سيتم إنشاء القالب الافتراضي تلقائياً ثم إعادة الإرسال...');
          await apiService.setDetailsMessage(DEFAULT_DETAILS_TEMPLATE);
          await apiService.sendWhatsAppDetails(subscriberId);
          showSuccess('إرسال تفاصيل المشترك', 'تم إنشاء القالب الافتراضي وإرسال رسالة الدين او التفاصيل بنجاح.');
          return;
        } catch (e: any) {
          showError('إرسال تفاصيل المشترك', getWhatsAppReminderErrorMessage(e));
          return;
        }
      }
      showError('إرسال تفاصيل المشترك', getWhatsAppReminderErrorMessage(err));
    }
  };

  const handleSendAlertMessage = async () => {
    if (!subscribers || selectedIds.length === 0) return;
    if (myAgentLoading) {
      showInfo('رسالة تنبيه الاشتراك', 'جاري التحقق من جلسة واتساب...');
      setShowActionsDropdown(false);
      return;
    }
    if (myAgentError) {
      showMyAgentFetchFailed('رسالة تنبيه الاشتراك');
      setShowActionsDropdown(false);
      return;
    }
    if (!hasWhatsAppSession) {
      showError('رسالة تنبيه الاشتراك', 'لم يتم حفظ معرف جلسة واتساب في Wakeel. افتح الإعدادات ← ربط واتساب ← ثم اضغط «حفظ معرف الجلسة في Wakeel».');
      setShowActionsDropdown(false);
      return;
    }
    await sendWhatsAppToSelected('رسالة تنبيه الاشتراك', (id) => apiService.sendWhatsAppAlert(id));
  };

  const handleSendCustomMessage = async (subscriber: Subscriber) => {
    if (myAgentLoading) {
      showInfo('إرسال رسالة حر', 'جاري التحقق من جلسة واتساب...');
      return;
    }
    if (myAgentError) {
      showMyAgentFetchFailed('إرسال رسالة حر');
      return;
    }
    if (!hasWhatsAppSession) {
      showError('إرسال رسالة حر', 'لم يتم حفظ معرف جلسة واتساب في Wakeel. افتح الإعدادات ← ربط واتساب ← ثم اضغط «حفظ معرف الجلسة في Wakeel».');
      return;
    }
    if (!subscriber.phoneNumber?.trim()) {
      showError('إرسال رسالة حر', 'رقم هاتف المشترك غير معرّف.');
      return;
    }
    try {
      await apiService.sendWhatsAppCustomMessage(subscriber.id);
      showSuccess('إرسال رسالة حر', 'تم إرسال قالب رسالة خاصة بنجاح. تحقق من وصولها في واتساب المشترك.');
    } catch (err: any) {
      showError('إرسال رسالة حر', ApiService.showError(err));
    }
  };

  const toggleSelectAll = () => {
    if (!subscribers) return;
    if (selectedIds.length === subscribers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(subscribers.map(s => s.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleBulkRenew = () => {
    if (selectedIds.length === 0) return;
    if (selectedIds.length === 1) {
      if (!subscribers || subscribers.length === 0) {
        showInfo('تحميل البيانات', 'جاري تحميل بيانات المشتركين، يرجى المحاولة مرة أخرى');
        return;
      }

      const subscriberToRenew = subscribers.find(s => s.id === selectedIds[0]);
      if (!subscriberToRenew) {
        showError('خطأ في البيانات', 'لم يتم العثور على بيانات المشترك المحدد');
        return;
      }

      setSelectedSubscriberForRenewal(subscriberToRenew);
      setRenewalData(prev => ({
        ...prev,
        subscriberId: selectedIds[0]
      }));
      setRenewalViaSasTab(false);
      setShowRenewalModal(true);
    } else {
      selectedIds.forEach(subscriberId => {
        const subscriber = subscribers?.find(s => s.id === subscriberId);
        const renewalData: RenewalData = {
          subscriberId: subscriberId,
          newProfileId: '',
          paymentStatus: PaymentStatus.Paid,
          overrideSalePrice: 0,
          amountPaid: 0,
          notes: '',
          remainingAmount: 0,
          debtDescription: '',
          currentExpirationDate: subscriber?.expirationDate,
          renewalPeriod: 30
        };
        createRenewalMutation.mutate(renewalData);
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = await confirmDelete('مشترك', selectedIds.length);
    if (confirmed) {
      selectedIds.forEach(id => deleteSubscriberMutation.mutate(id));
      setSelectedIds([]);
    }
  };

  /** فتح رابط التفعيل بعد اختيار الرسيلر (أو مباشرة عند رسيلر واحد). يستدعي getSasLink ويفتح الرابط ويعرض مودال التجديد. */
  const openActivationLinkWithReseller = async (subscriberId: string, resellerId?: string) => {
    const subscriberToRenew = subscribers?.find(s => s.id === subscriberId);
    if (!subscriberToRenew) {
      showError('خطأ في البيانات', 'لم يتم العثور على بيانات المشترك المحدد');
      return;
    }
    setSasLinkLoading(true);
    try {
      const data = await apiService.getSasLink(subscriberId, resellerId);
      const serviceType = data?.serviceType;
      const sasUrl = data?.url;
      const activationUrl = (data as any)?.activationUrl;

      if (serviceType === ServiceType.Sas && sasUrl) {
        window.open(normalizeEarthlinkActivationUrl(sasUrl) || sasUrl, '_blank');
        setSelectedSubscriberForRenewal(subscriberToRenew);
        setRenewalData(prev => ({ ...prev, subscriberId }));
        setRenewalViaSasTab(true);
        setShowRenewalModal(true);
        showInfo('تم فتح نافذة SAS', 'أتمم التفعيل في النافذة المفتوحة ثم اضغط «تم التفعيل» هنا.');
        return;
      }
      if (serviceType === ServiceType.Ftth) {
        const subscriberIdVal = String(
          subscriberToRenew.ftthSubscriptionId ?? subscriberToRenew.secruptionId ?? (data as any)?.secruptionId ?? ''
        ).trim();
        const urlToOpen =
          activationUrl ||
          (subscriberIdVal
            ? `${String((data as any)?.ftthBaseUrl || 'https://admin.ftth.iq').replace(/\/$/, '')}/customer-details/${encodeURIComponent(subscriberIdVal)}/details/view`
            : null);
        if (!urlToOpen) {
          showError('FTTH', 'معرف المشترك (FtthSubscriptionId أو SecruptionId) غير موجود.');
          return;
        }
        window.open(urlToOpen, '_blank');
        setSelectedSubscriberForRenewal(subscriberToRenew);
        setRenewalData(prev => ({ ...prev, subscriberId }));
        setRenewalViaSasTab(true);
        setShowRenewalModal(true);
        showInfo('FTTH', 'تم فتح صفحة تفاصيل الزبون في FTTH. أكمل الإجراء هناك ثم اضغط «تم التفعيل» هنا.');
        return;
      }
      if (serviceType === ServiceType.Earthlink) {
        const earthlinkName = encodeURIComponent(String(subscriberToRenew.fullName ?? '').trim());
        const earthlinkUrl = earthlinkName
          ? `${EARTHLINK_USER_MANAGEMENT_URL}?mn=${earthlinkName}&userst=0`
          : EARTHLINK_USER_MANAGEMENT_URL;
        window.open(earthlinkUrl, '_blank');
        setSelectedSubscriberForRenewal(subscriberToRenew);
        setRenewalData(prev => ({ ...prev, subscriberId }));
        setRenewalViaSasTab(true);
        setShowRenewalModal(true);
        showInfo('Earthlink', 'تم فتح صفحة إدارة المستخدمين في Earthlink. أكمل التفعيل هناك ثم اضغط «تم التفعيل» هنا.');
        return;
      }
      if (sasUrl) {
        window.open(normalizeEarthlinkActivationUrl(sasUrl) || sasUrl, '_blank');
        setSelectedSubscriberForRenewal(subscriberToRenew);
        setRenewalData(prev => ({ ...prev, subscriberId }));
        setRenewalViaSasTab(true);
        setShowRenewalModal(true);
        showInfo('تم فتح نافذة التفعيل', 'أتمم التفعيل في النافذة المفتوحة ثم اضغط «تم التفعيل» هنا.');
        return;
      }
      showError('خطأ', 'لم يُرجَع رابط تفعيل صالح من الخادم.');
    } catch (err: any) {
      showError('لا يمكن فتح رابط التفعيل', ApiService.showError(err));
    } finally {
      setSasLinkLoading(false);
    }
  };

  const handleActivateViaSasTab = async () => {
    if (selectedIds.length !== 1) {
      showError('اختر مشتركاً واحداً', 'لتفعيل عبر تاب SAS يرجى اختيار مشترك واحد فقط.');
      return;
    }
    const subscriberToRenew = subscribers?.find(s => s.id === selectedIds[0]);
    if (!subscriberToRenew) {
      showError('خطأ في البيانات', 'لم يتم العثور على بيانات المشترك المحدد');
      return;
    }


    if (myResellers.length > 1) {
      setPendingActivateSubscriberId(selectedIds[0]);
      setShowResellerPickerModal(true);
      setShowActionsDropdown(false);
      return;
    }

    // رسيلر واحد فقط: فتح التاب مباشرة دون عرض مودال الاختيار
    await openActivationLinkWithReseller(selectedIds[0], selectedOperationalResellerId || myResellers[0]?.id);
    setShowActionsDropdown(false);
  };

  const handleViewSubscriber = (id: string) => {
    navigate(`/admin/subscribers/${id}`);
  };

  const handleEditSubscriber = (id: string) => {
    const subscriber = subscribers?.find(s => s.id === id);
    if (subscriber) {
      setSelectedSubscriberForEdit(subscriber);
      setShowEditModal(true);
    }
  };

  const handleOpenNoteModal = (id: string) => {
    const subscriber = subscribers?.find(s => s.id === id);
    if (subscriber) {
      setSelectedSubscriberForNote(subscriber);
      setShowNoteModal(true);
    }
  };

  const handleSaveNote = async (id: string, noteType: SubscriberNoteType | null, note: string) => {
    const sub = selectedSubscriberForNote!;
    const noteVal = noteType === SubscriberNoteType.Other ? (note || '') : '';
    try {
      await apiService.updateSubscriberNote(id, noteType ?? 0, noteVal);
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.response?.status === 405) {
        const profileId = (Array.isArray(profiles) ? profiles : []).find((p: Profile) => p.name === sub.profileName)?.id || sub.profileId || '';
        const data: SubscriberUpdateRequest = {
          secruptionId: sub.secruptionId ?? '',
          firstName: sub.firstName,
          lastName: sub.lastName,
          phoneNumber: sub.phoneNumber,
          username: sub.username,
          isActive: sub.isActive,
          activationDate: sub.activationDate,
          expirationDate: sub.expirationDate || sub.activationDate,
          profileId,
          fat: sub.fat ?? '',
          zone: sub.zone ?? '',
          noteType,
          note: noteType === SubscriberNoteType.Other ? (noteVal || undefined) : undefined,
        };
        await updateSubscriberMutation.mutateAsync({ id, data });
      } else {
        throw err;
      }
    }
    queryClient.invalidateQueries({ queryKey: ['subscribers'] });
    setShowNoteModal(false);
    setSelectedSubscriberForNote(null);
    showSuccess('ادخال ملاحظة', 'تم حفظ الملاحظة بنجاح');
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowActionsDropdown(false);
      }
      if (columnSettingsRef.current && !columnSettingsRef.current.contains(event.target as Node)) {
        setShowColumnSettings(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);


  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-md">
          خطأ في تحميل بيانات المشتركين
            </div>
          </div>
    );
  }

  if (createSubscriberMutation.isPending) {
    return (
      <div className="p-6 flex items-center justify-center h-screen">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <span className="text-lg font-medium text-gray-600 dark:text-gray-400">إضافة مشترك جديد...</span>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-screen">
        <WifiLoaderComponent
          background="transparent"
          desktopSize="150px"
          mobileSize="150px"
          text="تحميل المشتركين..."
          backColor="#E8F2FC"
          frontColor="#4645F6"
        />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            إدارة المشتركين
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
            عرض وإدارة جميع المشتركين
          </p>
        </div>
        {isAgentOrSubAgentOrEmployee && (myRegions.length > 0 || myResellers.length > 0) && (
          <div className="mb-3 space-y-3">
            {myRegions.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">المناطق</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSubscribersRegionCardClick('')}
                    className={`rounded-xl border px-3 py-2 text-right transition-colors min-h-[44px] ${
                      !selectedOperationalRegionId
                        ? 'bg-primary-100 dark:bg-primary-900/40 border-primary-500 text-primary-800 dark:text-primary-200'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="text-sm font-semibold truncate">الكل</div>
                    <div className="text-xs opacity-75 truncate">كل المناطق</div>
                  </button>
                  {myRegions.map((region) => {
                    const active = selectedOperationalRegionId === region.id;
                    return (
                      <button
                        key={region.id}
                        type="button"
                        onClick={() => handleSubscribersRegionCardClick(region.id)}
                        className={`rounded-xl border px-3 py-2 text-right transition-colors min-h-[44px] ${
                          active
                            ? 'bg-primary-100 dark:bg-primary-900/40 border-primary-500 text-primary-800 dark:text-primary-200'
                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className="text-sm font-semibold truncate">{region.name}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {filteredOperationalResellers.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">الرسيلرز</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSubscribersResellerCardClick('')}
                    className={`rounded-xl border px-3 py-2 text-right transition-colors min-h-[44px] ${
                      !selectedOperationalResellerId
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-500 text-emerald-800 dark:text-emerald-200'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="text-sm font-semibold truncate">الكل</div>
                    <div className="text-xs opacity-75 truncate">كل الرسيلرز</div>
                  </button>
                  {filteredOperationalResellers.map((r) => {
                    const active = selectedOperationalResellerId === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => handleSubscribersResellerCardClick(r.id)}
                        className={`rounded-xl border px-3 py-2 text-right transition-colors min-h-[44px] ${
                          active
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-500 text-emerald-800 dark:text-emerald-200'
                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className="text-sm font-semibold truncate">{r.name}</div>
                        <div className="text-xs opacity-75 truncate">
                          {r.serviceType === ServiceType.Ftth ? 'FTTH' : r.serviceType === ServiceType.Sas ? 'SAS' : 'Earthlink'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setShowActionsDropdown(!showActionsDropdown)}
              disabled={selectedIds.length === 0}
              className="flex items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm sm:text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] touch-manipulation"
            >
              <MoreHorizontal className="h-4 w-4" />
              <span>الإجراءات ({selectedIds.length})</span>
            </button>
            
            {showActionsDropdown && selectedIds.length > 0 && (
              <div className="absolute top-full right-0 mt-2 min-w-[220px] w-max max-w-[320px] bg-white dark:bg-gray-800 rounded-lg shadow-xl ring-1 ring-black/10 dark:ring-white/10 border border-gray-200 dark:border-gray-600 z-50">
                <div className="py-1.5 flex flex-col gap-0.5">
                  <button
                    onClick={() => {
                      handleBulkRenew();
                      setShowActionsDropdown(false);
                    }}
                    disabled={renewMutation.isPending}
                    className="w-full text-right px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>تفعيل المشترك</span>
                  </button>
                  {selectedIds.length === 1 && showActivateViaTabAction && (
                    <button
                      onClick={() => {
                        handleActivateViaSasTab();
                      }}
                      disabled={sasLinkLoading}
                      className="w-full text-right px-4 py-2 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 flex items-center space-x-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>{sasLinkLoading ? 'جاري جلب الرابط...' : 'تفعيل عبر اللوحة'}</span>
                    </button>
                  )}
                  {showViewDetailsAction && (
                  <button
                    onClick={() => {
                      selectedIds.forEach(id => handleViewSubscriber(id));
                      setShowActionsDropdown(false);
                    }}
                    className="w-full text-right px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                  >
                    <Eye className="h-4 w-4" />
                    <span>عرض تفاصيل المشترك</span>
                  </button>
                  )}
                  {showEditSubscriberAction && (
                  <button
                    onClick={() => {
                      selectedIds.forEach(id => handleEditSubscriber(id));
                      setShowActionsDropdown(false);
                    }}
                    className="w-full text-right px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                  >
                    <Edit className="h-4 w-4" />
                    <span>تعديل المشترك</span>
                  </button>
                  )}
                  
                  {selectedIds.length === 1 && (
                  <button
                    onClick={() => {
                        handleOpenNoteModal(selectedIds[0]);
                        setShowActionsDropdown(false);
                      }}
                      className="w-full text-right px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                    >
                      <FileText className="h-4 w-4" />
                      <span>ادخال ملاحظة</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      if (selectedIds.length !== 1) {
                        showError('إرسال تفاصيل المشترك', 'يرجى تحديد مشترك واحد فقط لإرسال التفاصيل.');
                        setShowActionsDropdown(false);
                        return;
                      }
                      const subscriber = subscribers?.find(s => s.id === selectedIds[0]);
                      if (subscriber) handleSendSubscriberDetails(subscriber);
                      setShowActionsDropdown(false);
                    }}
                    className="w-full text-right px-4 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 flex items-center space-x-2"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>إرسال دين او التفاصيل</span>
                  </button>
                  <button
                    onClick={() => handleSendAlertMessage()}
                    disabled={sendReminderLoading}
                    className="w-full text-right px-4 py-2 text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>{sendReminderLoading ? 'جاري إرسال التنبيه...' : 'رسالة تنبيه الاشتراك'}</span>
                  </button>
                  {selectedIds.length === 1 && (
                    <button
                      onClick={() => {
                        const subscriber = subscribers?.find(s => s.id === selectedIds[0]);
                        if (subscriber) handleSendCustomMessage(subscriber);
                        setShowActionsDropdown(false);
                      }}
                      className="w-full text-right px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center space-x-2"
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span>إرسال رسالة حر</span>
                    </button>
                  )}
                  {showDeleteSubscriberAction && (
                  <button
                    onClick={() => {
                      handleBulkDelete();
                      setShowActionsDropdown(false);
                    }}
                    className="w-full text-right px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>حذف المشترك</span>
                  </button>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {canSyncSas && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAutoSyncClick}
                disabled={synchronizationFtthMutation.isPending}
                className="flex items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg text-sm sm:text-base transition-colors min-h-[44px] touch-manipulation border border-gray-300 dark:border-gray-600"
              >
                <RefreshCw className={`h-4 w-4 ${synchronizationFtthMutation.isPending ? 'animate-spin' : ''}`} />
                <span>{synchronizationFtthMutation.isPending ? 'جاري المزامنة...' : 'مزامنة تلقائيا'}</span>
              </button>
              {!synchronizationFtthMutation.isPending && !!autoSyncFtthResult && (
                <button
                  type="button"
                  onClick={() => setShowAutoSyncModal(true)}
                  className="flex items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-2 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-200 rounded-lg text-sm sm:text-base transition-colors min-h-[44px] touch-manipulation border border-blue-200 dark:border-blue-800"
                >
                  <Eye className="h-4 w-4" />
                  <span>عرض آخر قائمة ({autoSyncFtthResult.count ?? autoSyncFtthResult.data?.length ?? 0})</span>
                </button>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            disabled={createSubscriberMutation.isPending}
            className="flex items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm sm:text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] touch-manipulation"
          >
            <Plus className="h-4 w-4" />
            <span>إضافة مشترك</span>
          </button>
        </div>
      </div>

      {/* فلترة متقدمة */}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setShowAdvancedFilter((v) => !v)}
          className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
            showAdvancedFilter || hasActiveAdvancedFilter
              ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-500 text-primary-700 dark:text-primary-300'
              : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          <Filter className="h-4 w-4" />
          <span>فلترة متقدمة</span>
          {hasActiveAdvancedFilter && (
            <span className="mr-1 px-1.5 py-0.5 text-xs rounded-full bg-primary-200 dark:bg-primary-800">
              مفعّل
            </span>
          )}
        </button>

        {showAdvancedFilter && (
          <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              الحالة، الكابينة، المنطقة، نوع الملاحظة، ترتيب التاريخ، الأيام حتى الانتهاء، ونطاق تاريخ انتهاء الاشتراك.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">الحالة</label>
            <select
              value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as SubscriptionStatus | 'all')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white text-sm"
            >
              <option value="all">جميع الحالات</option>
              <option value={SubscriptionStatus.Active}>نشط</option>
              <option value={SubscriptionStatus.ExpiringSoon}>سينتهي قريباً</option>
              <option value={SubscriptionStatus.Expired}>منتهي</option>
                  <option value={SubscriptionStatus.ExpiredToday}>سينتهي اليوم</option>
            </select>
          </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">ترتيب التاريخ</label>
                <select
                  value={sortDescending ? 'true' : 'false'}
                  onChange={(e) => { setSortDescending(e.target.value === 'true'); setCurrentPage(1); }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white text-sm"
                >
                  <option value="false">تصاعدي</option>
                  <option value="true">تنازلي</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">الكابينة</label>
                <input
                  type="text"
                  placeholder="الكابينة"
                  maxLength={200}
                  value={fatFilter}
                  onChange={(e) => setFatFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">المنطقة</label>
                <input
                  type="text"
                  placeholder="المنطقة"
                  maxLength={200}
                  value={zoneFilter}
                  onChange={(e) => setZoneFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">نوع الملاحظة</label>
                <select
                  value={noteTypeFilter}
                  onChange={(e) => setNoteTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white text-sm"
                >
                  <option value="all">كل الملاحظات</option>
                  <option value={SubscriberNoteType.NoResponse}>لم يتم الرد</option>
                  <option value={SubscriberNoteType.WillActivateSoon}>ستتم التفعيل قريباً</option>
                  <option value={SubscriberNoteType.DoesNotWantActivation}>لا يرغب في التفعيل</option>
                  <option value={SubscriberNoteType.BadService}>سوء خدمة</option>
                  <option value={SubscriberNoteType.NeedsMaintenance}>يحتاج صيانة</option>
                  <option value={SubscriberNoteType.Other}>أخرى</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">ينتهي خلال (يوم)</label>
                <input
                  type="number"
                  min={0}
                  placeholder="—"
                  value={maxDaysUntilExpiry}
                  onChange={(e) => setMaxDaysUntilExpiry(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">انتهاء الاشتراك من تاريخ</label>
                <input
                  type="date"
                  value={expirationFromDate}
                  onChange={(e) => setExpirationFromDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">انتهاء الاشتراك إلى تاريخ</label>
                <input
                  type="date"
                  value={expirationToDate}
                  onChange={(e) => setExpirationToDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white text-sm"
                />
              </div>
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={extensionActivationFilter}
                    onChange={(e) => setExtensionActivationFilter(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  تم تفعيل باقة تمديد
                </label>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                type="button"
                onClick={handleApplyAdvancedFilter}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-md text-sm font-medium"
              >
                <Check className="h-4 w-4" />
                تطبيق الفلتر
              </button>
              <button
                type="button"
                onClick={handleClearSearch}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-200 rounded-md text-sm font-medium"
              >
                <X className="h-4 w-4" />
                مسح الفلتر
              </button>
            </div>
          </div>
        )}
      </div>

      {/* فلترة البحث */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder={requireTwoWordsForSearch ? 'البحث بالاسم الأول والثاني (كلمتين على الأقل)...' : 'البحث بالاسم أو رقم الهاتف...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applySearch())}
            className="w-full pr-10 pl-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white text-sm"
          />
        </div>
        <button
          type="button"
          onClick={applySearch}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md text-sm font-medium whitespace-nowrap"
        >
          بحث
        </button>
      </div>

      {/* Table */}
      <div className="wakeel-table-card">
        <div className="flex items-center justify-end px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          <div className="relative" ref={columnSettingsRef}>
            <button
              type="button"
              onClick={() => setShowColumnSettings((v) => !v)}
              className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              title="إعدادات عرض الجدول"
              aria-label="إعدادات عرض الجدول"
            >
              <Settings2 className="h-5 w-5" />
            </button>
            {showColumnSettings && (
              <div className="absolute left-0 top-full mt-1 z-20 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2">
                <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">الأعمدة الظاهرة</span>
                </div>
                <div className="max-h-64 overflow-y-auto px-2 py-1">
                  {SUBSCRIBERS_TABLE_COLUMNS.map(({ id, label }) => (
                    <label
                      key={id}
                      className="flex items-center gap-2 px-2 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumns[id] !== false}
                        onChange={() => toggleColumnVisibility(id)}
                        className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="wakeel-table-scroll">
          <table className="min-w-full text-right">
            <thead>
              <tr>
                <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3">
                  <button onClick={toggleSelectAll} className="p-1" aria-label="تحديد الكل">
                    {subscribers && selectedIds.length === subscribers.length && subscribers.length > 0 ? (
                      <CheckSquare className="h-3 w-3 sm:h-4 sm:w-4 text-primary-600" />
                    ) : (
                      <Square className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                    )}
                  </button>
                </th>
                <th className={`px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${col('secruptionId')}`}>
                  معرف الاشتراك
                </th>
                <th className={`px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${col('subscriber')}`}>
                  المشترك
                </th>
                <th className={`px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${col('username')}`}>
                  اسم المستخدم
                </th>
                <th className={`px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${col('subscriberRegion')}`}>
                  منطقة المشترك
                </th>
                <th className={`px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${col('phoneNumber')}`}>
                  رقم الهاتف
                </th>
                <th className={`px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${col('agentCompanyName')}`}>
                  شركة الوكيل
                </th>
                <th className={`px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${col('fat')}`}>
                  الكابينة
                </th>
                <th className={`px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${col('zone')}`}>
                  المنطقة
                </th>
                <th className={`px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${col('noteType')}`}>
                  نوع الملاحظة
                </th>
                <th className={`px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${col('note')}`}>
                  الملاحظات
                </th>
                <th className={`px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${col('profile')}`}>
                  الباقة
                </th>
                <th className={`px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${col('paymentMethod')}`}>
                  طريقة الدفع
                </th>
                <th className={`px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${col('activationDate')}`}>
                  تاريخ التفعيل
                </th>
                <th className={`px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${col('expirationDate')}`}>
                  تاريخ الانتهاء
                </th>
                <th className={`px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${col('status')}`}>
                  الحالة
                </th>
              </tr>
            </thead>
            <tbody>
              {subscribers?.map((subscriber) => (
                <tr
                  key={subscriber.id}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${
                    subscriberIdsWithOverdueDebt.has(subscriber.id) ? 'bg-red-50 dark:bg-red-900/20' : ''
                  }`}
                >
                  <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-4">
                    <button onClick={() => toggleSelectOne(subscriber.id)} className="p-1" aria-label="تحديد">
                      {selectedIds.includes(subscriber.id) ? (
                        <CheckSquare className="h-3 w-3 sm:h-4 sm:w-4 text-primary-600" />
                      ) : (
                        <Square className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                      )}
                    </button>
                  </td>
                  <td className={`px-2 sm:px-4 lg:px-6 py-2 sm:py-4 whitespace-nowrap ${col('secruptionId')}`}>
                    <div className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                      {subscriber.secruptionId || '—'}
                    </div>
                  </td>
                  <td className={`px-2 sm:px-4 lg:px-6 py-2 sm:py-4 whitespace-nowrap ${col('subscriber')}`}>
                    <div className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                      {subscriber.fullName || '—'}
                    </div>
                  </td>
                  <td className={`px-2 sm:px-4 lg:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-white ${col('username')}`}>
                    {subscriber.username}
                  </td>
                  <td className={`px-2 sm:px-4 lg:px-6 py-2 sm:py-4 whitespace-nowrap ${col('subscriberRegion')}`}>
                    {(() => {
                      const region = getSubscriberRegion(subscriber);
                      return (
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${region.badgeClass}`}>
                          {region.name}
                        </span>
                      );
                    })()}
                  </td>
                  <td className={`px-2 sm:px-4 lg:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-white ${col('phoneNumber')}`}>
                    <span className="flex items-center">
                      <Phone className="h-3 w-3 mr-1 text-gray-400 flex-shrink-0" />
                      {subscriber.phoneNumber}
                    </span>
                  </td>
                  <td className={`px-2 sm:px-4 lg:px-6 py-2 sm:py-4 whitespace-nowrap ${col('agentCompanyName')}`}>
                    <div className="text-xs sm:text-sm text-gray-900 dark:text-white">
                      {subscriber.agentCompanyName || 'غير محدد'}
                    </div>
                  </td>
                  <td className={`px-2 sm:px-4 lg:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-white ${col('fat')}`}>
                    {subscriber.fat ?? '—'}
                  </td>
                  <td className={`px-2 sm:px-4 lg:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-white ${col('zone')}`}>
                    {subscriber.zone ?? '—'}
                  </td>
                  <td className={`px-2 sm:px-4 lg:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-white ${col('noteType')}`}>
                    {getSubscriberNoteTypeBadge(subscriber.noteType, subscriber.note ?? null)}
                  </td>
                  <td className={`px-2 sm:px-4 lg:px-6 py-2 sm:py-4 text-xs sm:text-sm text-gray-900 dark:text-white ${col('note')}`}>
                    <div
                      className="max-w-[180px] sm:max-w-[240px] truncate"
                      title={(subscriber.note || '').toString()}
                    >
                      {(subscriber.note || '').toString().trim() || '—'}
                    </div>
                  </td>
                  <td className={`px-2 sm:px-4 lg:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-white ${col('profile')}`}>
                    {subscriber.profileName}
                  </td>
                  <td className={`px-2 sm:px-4 lg:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-white ${col('paymentMethod')}`}>
                    {formatPaymentMethodLabel(subscriber.paymentMethod)}
                  </td>
                  <td className={`px-2 sm:px-4 lg:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-white ${col('activationDate')}`}>
                    {formatDate(subscriber.activationDate, { year: 'numeric', month: 'numeric', day: 'numeric' })}
                  </td>
                  <td className={`px-2 sm:px-4 lg:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-white ${col('expirationDate')}`}>
                    {subscriber.expirationDate
                      ? formatDate(subscriber.expirationDate, { year: 'numeric', month: 'numeric', day: 'numeric' })
                      : 'غير محدد'}
                  </td>
                  <td className={`px-2 sm:px-4 lg:px-6 py-2 sm:py-4 whitespace-nowrap ${col('status')}`}>
                    {getStatusBadge(subscriber)}
                    {subscriber.daysUntilExpiry > 0 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {subscriber.daysUntilExpiry} يوم متبقي
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {subscribers?.length === 0 && (
          <div className="text-center py-12">
            <UserPlus className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              لا توجد مشتركين
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              ابدأ بإضافة مشترك جديد
            </p>
          </div>
        )}
        {subscribersResponse && (
          <Pagination
            currentPage={subscribersResponse.currentPage}
            totalPages={subscribersResponse.totalPages}
            totalItems={subscribersResponse.totalItems}
            pageSize={subscribersResponse.pageSize}
            hasNextPage={subscribersResponse.hasNextPage}
            hasPreviousPage={subscribersResponse.hasPreviousPage}
            onPageChange={handlePageChange}
          />
        )}
      </div>

      {/* Add Subscriber Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                إضافة مشترك جديد
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* معرف الاشتراك */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    معرف الاشتراك *
                  </label>
                  <input
                    type="text"
                    name="secruptionId"
                    value={formData.secruptionId ?? ''}
                    onChange={handleInputChange}
                    required
                    maxLength={100}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    placeholder="معرف الاشتراك"
                  />
                </div>

                {/* Username */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    اسم المستخدم *
                  </label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    placeholder="اسم المستخدم"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    كلمة المرور *
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    placeholder="كلمة المرور"
                  />
                </div>

                {/* First Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    الاسم الأول *
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    placeholder="الاسم الأول"
                  />
                </div>

                {/* Last Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    اسم العائلة 
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    placeholder="اسم العائلة"
                  />
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    رقم الهاتف *
                  </label>
                  <input
                    type="tel"
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    placeholder="رقم الهاتف"
                  />
                </div>

                {/* Profile — قائمة مع بحث */}
                <div ref={profileDropdownAddRef}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    الباقة *
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowProfileDropdownAdd((v) => !v)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white text-right flex items-center justify-between"
                    >
                      <span className="truncate">
                        {formData.profileId && Array.isArray(activeProfiles)
                          ? (activeProfiles.find((p) => p.id === formData.profileId)?.name ?? 'اختر الباقة')
                          : 'اختر الباقة'}
                        {formData.profileId && Array.isArray(activeProfiles) && (() => {
                          const p = activeProfiles.find((x) => x.id === formData.profileId);
                          return p ? ` - ${formatNumber(p.salePrice || 0, { suffix: ' د.ع' })}` : '';
                        })()}
                      </span>
                      <Search className="h-4 w-4 text-gray-400 flex-shrink-0 mr-2" />
                    </button>
                    {showProfileDropdownAdd && (
                      <div className="absolute z-20 mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-lg max-h-64 flex flex-col">
                        <div className="p-2 border-b border-gray-200 dark:border-gray-600 sticky top-0 bg-white dark:bg-gray-700">
                          <div className="relative">
                            <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                              type="text"
                              value={profileSearchInAdd}
                              onChange={(e) => setProfileSearchInAdd(e.target.value)}
                              placeholder="البحث عن الباقة..."
                              className="w-full pl-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm dark:bg-gray-600 dark:text-white"
                              autoFocus
                            />
                          </div>
                        </div>
                        <ul className="overflow-y-auto py-1 max-h-48">
                          {filteredProfilesForAdd.length === 0 ? (
                            <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">لا توجد نتائج</li>
                          ) : (
                            filteredProfilesForAdd.map((profile) => (
                              <li key={profile.id}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFormData((prev) => ({ ...prev, profileId: profile.id }));
                                    setShowProfileDropdownAdd(false);
                                    setProfileSearchInAdd('');
                                  }}
                                  className={`w-full text-right px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 ${
                                    formData.profileId === profile.id ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'
                                  }`}
                                >
                        {profile.name} - {formatNumber(profile.salePrice || 0, { suffix: ' د.ع' })}
                                </button>
                              </li>
                            ))
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                <input type="hidden" name="activationDate" value={formData.activationDate} />
                <input type="hidden" name="expirationDate" value={formData.expirationDate} />
                
                {/* Info message */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        <strong>ملاحظة:</strong> المشترك الجديد سيتم إنشاؤه بحالة منتهي تلقائياً. يمكنك تفعيله لاحقاً من خلال عملية التجديد.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Subscription Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    نوع الاشتراك *
                  </label>
                  <select
                    name="subscriptionType"
                    value={formData.subscriptionType}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value={SubscriptionType.Paid}>مدفوع</option>
                    <option value={SubscriptionType.Free}>مجاني</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    نوع الملاحظة
                  </label>
                  <select
                    name="noteType"
                    value={formData.noteType ?? ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value={SubscriberNoteType.NoResponse}>لم يتم الرد</option>
                    <option value={SubscriberNoteType.WillActivateSoon}>ستتم التفعيل قريباً</option>
                    <option value={SubscriberNoteType.DoesNotWantActivation}>لا يرغب في التفعيل</option>
                    <option value={SubscriberNoteType.BadService}>سوء خدمة</option>
                    <option value={SubscriberNoteType.NeedsMaintenance}>يحتاج صيانة</option>
                    <option value={SubscriberNoteType.Other}>أخرى</option>
                  </select>
                </div>

                {formData.noteType === SubscriberNoteType.Other && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      نص الملاحظة
                </label>
                <textarea
                  name="note"
                  value={formData.note}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                      placeholder="اكتب الملاحظة..."
                    />
                  </div>
                )}
              </div>

              {/* الكابينة والمنطقة */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    الكابينة
                  </label>
                  <input
                    type="text"
                    name="fat"
                    value={formData.fat ?? ''}
                    onChange={handleInputChange}
                    maxLength={200}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    placeholder="الكابينة (اختياري)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    المنطقة
                  </label>
                  <input
                    type="text"
                    name="zone"
                    value={formData.zone ?? ''}
                    onChange={handleInputChange}
                    maxLength={200}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    placeholder="المنطقة (اختياري)"
                  />
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={createSubscriberMutation.isPending}
                  className="flex items-center space-x-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createSubscriberMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>حفظ المشترك</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Renewal Modal */}
      {showRenewalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
                <span>تفعيل المشترك</span>
                {(renewalInfo?.subscriberName || selectedSubscriber?.fullName) && (
                  <span className="text-base font-medium text-primary-600 dark:text-primary-400">
                    {renewalInfo?.subscriberName || selectedSubscriber?.fullName}
                  </span>
                )}
              </h2>
              <button
                onClick={() => { setSelectedSubscriberForRenewal(null); setShowRenewalModal(false); setRenewalViaSasTab(false); }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {renewalViaSasTab && (
              <div className="mx-6 mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-amber-800 dark:text-amber-200 text-sm">
                  تم فتح نافذة SAS. بعد إتمام التفعيل واضغط الزر في SAS يُغلق التاب ويرجعك للنظام تلقائياً. ثم أدخل بيانات التجديد هنا واضغط «تم التفعيل» أو «طباعة» أدناه.
                </p>
              </div>
            )}

            {!renewalInfo ? (
              <div className="p-6 text-center">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-red-600 dark:text-red-400 font-medium">
                    خطأ في تحميل بيانات المشترك
                  </p>
                  <p className="text-red-500 dark:text-red-500 text-sm mt-2">
                    لم يتم العثور على بيانات المشترك المحدد. تأكد من أن المشترك موجود في القائمة.
                  </p>
                  <button
                    onClick={() => { setSelectedSubscriberForRenewal(null); setShowRenewalModal(false); setRenewalViaSasTab(false); }}
                    className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRenewalSubmit} className="p-6 space-y-6">
              {/* Renewal Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Profile Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    الباقة الجديدة *
                  </label>
                  <select
                    name="newProfileId"
                    value={renewalData.newProfileId}
                    onChange={handleRenewalInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">اختر الباقة</option>
                    {renewalInfo.availableProfiles?.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name} - {profile.packageType === ProfilePackageType.Extension ? 'تمديد مجاني' : profile.packageType === ProfilePackageType.SpecialOffer ? `${formatNumber(profile.salePrice || 0, { suffix: ' د.ع' })} — عرض خاص` : formatNumber(profile.salePrice || 0, { suffix: ' د.ع' })} ({profile.renewalPeriod || 30} يوم)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Renewal Period Info — أيقونة فقط؛ النص في تلميح عند التمرير أو التركيز */}
                {renewalData.newProfileId && (
                  <div className="flex items-start justify-end pt-1">
                    <div className="group relative inline-flex">
                      <button
                        type="button"
                        className="rounded-full p-1.5 text-blue-600 outline-none ring-offset-2 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-400 dark:hover:bg-blue-900/30 dark:ring-offset-gray-900"
                        aria-label="معلومات التجديد والتفعيل"
                      >
                        <Info className="h-5 w-5 shrink-0" aria-hidden />
                      </button>
                      <div
                        role="tooltip"
                        className="pointer-events-none invisible absolute bottom-full left-1/2 z-50 mb-2 w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 rounded-md border border-gray-200 bg-white p-3 text-start text-xs leading-relaxed text-gray-700 opacity-0 shadow-lg transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                      >
                        {(() => {
                          const p = renewalInfo.availableProfiles?.find((pr) => pr.id === renewalData.newProfileId);
                          const period = p?.renewalPeriod || 30;
                          const isExt = p?.packageType === ProfilePackageType.Extension;
                          return (
                            <div className="space-y-1.5">
                              <p>
                                <strong>فترة التجديد:</strong> {period} يوم
                              </p>
                              <p>
                                <strong>نوع التفعيل:</strong> {isExt ? 'تمديد' : 'اشتراك'}
                              </p>
                              <p>
                                <strong>تاريخ الانتهاء الجديد:</strong> سيتم إضافة فترة التجديد إلى تاريخ انتهاء المشترك الحالي
                              </p>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                {(() => {
                  const selectedProfile = renewalInfo.availableProfiles?.find(
                    (p) => p.id === renewalData.newProfileId
                  );
                  const isExtension = selectedProfile?.packageType === ProfilePackageType.Extension;
                  if (isExtension || !renewalData.newProfileId) return null;
                  return (
                    <>
                      <div className="md:col-span-2 flex items-center justify-between gap-4 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">واصل</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {renewalAmountFullyReceived
                              ? 'المبلغ كامل — لا حاجة لإدخال المبلغ الواصل'
                              : 'غير واصل — أدخل المبلغ الواصل أدناه'}
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={renewalAmountFullyReceived}
                          aria-label="واصل"
                          onClick={() => handleRenewalFullyPaidToggle(!renewalAmountFullyReceived)}
                          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                            renewalAmountFullyReceived ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                          }`}
                        >
                          <span
                            aria-hidden
                            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              renewalAmountFullyReceived ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {!renewalAmountFullyReceived && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            المبلغ الواصل (د.ع)
                          </label>
                          <input
                            type="number"
                            name="amountPaid"
                            value={renewalData.amountPaid}
                            onChange={handleRenewalInputChange}
                            min="0"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                          />
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Debt Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Debt Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    مبلغ الدين (د.ع) <span className="text-xs text-gray-500">(محسوب تلقائياً)</span>
                  </label>
                  <input
                    type="number"
                    name="remainingAmount"
                    value={renewalData.remainingAmount || 0}
                    onChange={handleRenewalInputChange}
                    min="0"
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-50 dark:bg-gray-800 cursor-not-allowed dark:text-gray-300"
                    placeholder="مبلغ الدين"
                  />
                </div>

                {/* Debt Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      ملاحظات الدين
                  </label>
                  <input
                    type="text"
                    name="debtDescription"
                    value={renewalData.debtDescription || ''}
                    onChange={handleRenewalInputChange}
                    disabled={renewalInfo?.availableProfiles?.find(p => p.id === renewalData.newProfileId)?.packageType === ProfilePackageType.Extension}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"
                      placeholder="ملاحظات الدين"
                  />
                </div>
              </div>

                {(renewalData.remainingAmount || 0) > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      تاريخ تسديد الدين *
                    </label>
                    <input
                      type="date"
                      name="debtDueDate"
                      value={renewalData.debtDueDate || ''}
                      onChange={handleRenewalInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                )}

              {/* Form Actions */}
              <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                    onClick={() => { setSelectedSubscriberForRenewal(null); setShowRenewalModal(false); setRenewalViaSasTab(false); }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={createRenewalMutation.isPending}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {(createRenewalMutation.isPending) ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>جاري التفعيل...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                        <span>{renewalViaSasTab ? 'تم التفعيل' : 'تفعيل المشترك'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceiptModal && lastReceipt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                فاتورة التفعيل
              </h2>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Receipt Header */}
              <div className="text-center border-b border-gray-200 dark:border-gray-700 pb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {(() => {
                    console.log('Modal displaying receiptNumber:', lastReceipt.receiptNumber);
                    console.log('Modal lastReceipt object:', lastReceipt);
                    return lastReceipt.receiptNumber;
                  })()}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(lastReceipt.renewalDate)} - {new Date(lastReceipt.renewalDate).toLocaleTimeString(locale)}
                </p>
              </div>

              {/* Subscriber Info */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">المشترك:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{lastReceipt.subscriberName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">رقم الهاتف:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{lastReceipt.subscriberPhone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">الباقة:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{lastReceipt.newProfileName}</span>
                </div>
              </div>

              {/* Pricing Details */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-2">
                {(lastReceipt.discountAmount ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">الخصم:</span>
                    <span className="text-red-600 dark:text-red-400">-{formatNumber(lastReceipt.discountAmount ?? 0, { suffix: ' د.ع' })} ({(lastReceipt.discountPercent ?? 0).toFixed(1)}%)</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg border-t border-gray-200 dark:border-gray-600 pt-2">
                  <span className="text-gray-900 dark:text-white">سعر الاشتراك:</span>
                  <span className="text-primary-600 dark:text-primary-400">{formatNumber(lastReceipt.finalPrice ?? 0, { suffix: ' د.ع' })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">المبلغ الواصل:</span>
                  <span className="text-green-600 dark:text-green-400">{formatNumber(lastReceipt.amountPaid ?? 0, { suffix: ' د.ع' })}</span>
                </div>
                  <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">مبلغ الدين:</span>
                  <span className="text-red-600 dark:text-red-400">{formatNumber((lastReceipt.finalPrice ?? 0) - (lastReceipt.amountPaid ?? 0), { suffix: ' د.ع' })}</span>
                  </div>
              </div>

              {/* Renewal Details */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">تاريخ الانتهاء الجديد:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{formatDate(lastReceipt.newExpirationDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">ملاحظات الدين:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {((lastReceipt.finalPrice ?? 0) - (lastReceipt.amountPaid ?? 0)) > 0
                      ? `الباقي من المبلغ: ${formatNumber((lastReceipt.finalPrice ?? 0) - (lastReceipt.amountPaid ?? 0), { suffix: ' د.ع' })}`
                      : 'لا يوجد دين'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">حالة الدفع:</span>
                  <span className={`font-medium ${
                    lastReceipt.paymentStatus === 1 ? 'text-green-600 dark:text-green-400' :
                    lastReceipt.paymentStatus === 2 ? 'text-red-600 dark:text-red-400' :
                    'text-yellow-600 dark:text-yellow-400'
                  }`}>
                    {lastReceipt.paymentStatus === 1 ? 'مدفوع' :
                     lastReceipt.paymentStatus === 2 ? 'غير مدفوع' : 'معلق'}
                  </span>
                </div>
              </div>

              {lastReceipt.notes && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <span className="font-medium">ملاحظات:</span> {lastReceipt.notes}
                  </p>
                </div>
              )}

              {/* Actions */}
              {!hasWhatsAppSession && (
                <p className="text-sm text-amber-600 dark:text-amber-400 pt-2">لإرسال رسائل واتساب أضف معرف جلسة واتساب في الإعدادات.</p>
              )}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowReceiptModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                >
                  إغلاق
                </button>
                <button
                  onClick={() => handleSendWhatsApp(lastReceipt)}
                  disabled={!hasWhatsAppSession || !lastReceipt.subscriberId}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>إرسال واتساب</span>
                </button>
                <button
                  onClick={() => handlePrintReceipt(lastReceipt)}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors"
                >
                  طباعة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* مودال جلب من SAS — معاينة ثم موافقة ثم مزامنة */}
      {showSasCredentialsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl ${
            (sasSyncStep === 'sync_subscribers_list' || sasSyncStep === 'transactions_list')
              ? 'max-w-6xl w-full max-h-[90vh] flex flex-col'
              : 'max-w-md w-full'
          }`}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {sasSyncStep === 'form' && 'جلب قائمة المزامنة'}
                {sasSyncStep === 'failed' && 'فشل الجلب'}
                {sasSyncStep === 'sync_subscribers_loading' && 'جاري جلب القائمة…'}
                {sasSyncStep === 'sync_subscribers_list' && 'قائمة المزامنة'}
                {sasSyncStep === 'transactions_loading' && 'جاري جلب المعاملات…'}
                {sasSyncStep === 'transactions_list' && 'قائمة المعاملات'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowSasCredentialsModal(false);
                  setSasSyncStep('form');
                  setSyncSubscribersList(null);
                  setSyncTransactionsList(null);
                  setActivatedSubscriptionIds(new Set());
                  setSavedSubscriberRowIds(new Set());
                  setSasPreviewError('');
                  setUnpaidActivationRowId(null);
                  setUnpaidDebtAmountInput('');
                  setSelectedSyncResellerId(null);
                }}
                disabled={syncSubscribersMutation.isPending}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
                aria-label="إغلاق"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {sasSyncStep === 'form' && (
              <div className="p-4 space-y-4">
                {myResellers.length === 0 ? (
                  <>
                    <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                      لا يوجد رسيلرز. أضف رسيلر من إعدادات الوكيل أو أدخل الاعتماديات أدناه.
                    </p>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">رابط اللوحة (SAS/FTTH) *</label>
                      <input
                        type="url"
                        value={sasCredsBaseUrl}
                        onChange={(e) => setSasCredsBaseUrl(e.target.value)}
                        placeholder="مثال: https://admin.ftth.iq"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">اسم المستخدم *</label>
                      <input
                        type="text"
                        value={sasCredsUsername}
                        onChange={(e) => setSasCredsUsername(e.target.value)}
                        placeholder="اسم المستخدم"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                        autoComplete="username"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">كلمة المرور *</label>
                      <input
                        type="password"
                        value={sasCredsPassword}
                        onChange={(e) => setSasCredsPassword(e.target.value)}
                        placeholder="كلمة المرور"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                        autoComplete="current-password"
                      />
                    </div>
                  </>
                ) : myResellers.length === 1 ? (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    سيتم استخدام الرسيلر: <strong>{myResellers[0].name}</strong>. لا حاجة لإدخال اعتماديات.
                  </p>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">اختر الرسيلر</label>
                    <select
                      value={selectedSyncResellerId ?? ''}
                      onChange={(e) => setSelectedSyncResellerId(e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">— اختر رسيلراً —</option>
                      {myResellers.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex items-center justify-end gap-2 pt-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => { setShowSasCredentialsModal(false); setSasSyncStep('form'); setSyncSubscribersList(null); setSyncTransactionsList(null); setActivatedSubscriptionIds(new Set()); setSavedSubscriberRowIds(new Set()); setSasPreviewError(''); setUnpaidActivationRowId(null); setUnpaidDebtAmountInput(''); setSelectedSyncResellerId(null); }}
                    disabled={syncSubscribersMutation.isPending}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    disabled={syncSubscribersMutation.isPending}
                    onClick={() => {
                      if (myResellers.length === 0) {
                        const baseUrl = sasCredsBaseUrl.trim();
                        const username = sasCredsUsername.trim();
                        const password = sasCredsPassword;
                        if (!baseUrl) { showError('خطأ', 'رابط اللوحة (SAS/FTTH) مطلوب.'); return; }
                        if (!username) { showError('خطأ', 'اسم المستخدم مطلوب.'); return; }
                        if (password === '') { showError('خطأ', 'كلمة المرور مطلوبة.'); return; }
                        syncSubscribersMutation.mutate({ baseUrl, username, password, agentId: myAgent?.id });
                      } else if (myResellers.length === 1) {
                        syncSubscribersMutation.mutate({ agentId: myAgent?.id });
                      } else {
                        if (!selectedSyncResellerId) { showError('خطأ', 'اختر رسيلراً للمزامنة.'); return; }
                        syncSubscribersMutation.mutate({ agentId: myAgent?.id, resellerId: selectedSyncResellerId });
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {syncSubscribersMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                    <span>{syncSubscribersMutation.isPending ? 'جاري جلب القائمة...' : 'بدأ المزامنة'}</span>
                  </button>
                </div>
              </div>
            )}

            {sasSyncStep === 'sync_subscribers_loading' && (
              <div className="p-6 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="h-10 w-10 animate-spin text-primary-500" />
                <p className="text-sm text-gray-600 dark:text-gray-400">جار المزامنة...</p>
              </div>
            )}

            {sasSyncStep === 'transactions_loading' && (
              <div className="p-6 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="h-10 w-10 animate-spin text-indigo-500" />
                <p className="text-sm text-gray-600 dark:text-gray-400">جاري جلب المعاملات...</p>
              </div>
            )}

            {sasSyncStep === 'transactions_list' && syncTransactionsList && (
              <div className="p-4 flex flex-col flex-1 min-h-0">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  معاينة المعاملات من FTTH حسب نوع العملية (شراء / تجديد / تجريبي).
                </p>
                <div className="wakeel-table-scroll flex-1 mb-4 min-h-0">
                  <table className="min-w-full text-right">
                    <thead className="sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300">رقم الزبون (Customer ID)</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300">اسم المستخدم</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300">اسم الزبون</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300">تاريخ الانتهاء</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300">الباقة</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300">المنطقة (Zone)</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300">طريقة الدفع</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300">نوع المعاملة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {syncTransactionsList.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-3 py-4 text-sm text-center text-gray-500 dark:text-gray-400">لا توجد معاملات</td>
                        </tr>
                      ) : (
                        syncTransactionsList.map((row, idx) => (
                          <tr key={`${row.customer_id ?? row.username ?? 'row'}-${idx}`}>
                            <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">{row.customer_id ?? '—'}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">{row.username}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">{row.customer_name ?? '—'}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">{row.expiration ?? '—'}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">{row.profile_name ?? '—'}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">{row.zone ?? '—'}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">{formatTransactionPaymentDisplay(row)}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">{row.type_ar ?? '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {sasSyncStep === 'sync_subscribers_list' && syncSubscribersList && (
              <div className="p-4 flex flex-col flex-1 min-h-0">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  
                </p>
                <div className="wakeel-table-scroll flex-1 mb-4 min-h-0">
                  <table className="min-w-full text-right">
                    <thead className="sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300">اسم المستخدم</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300">الاسم</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300">انتهاء الصلاحية</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300">الباقة</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300">المنطقة</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300">معرف المشترك</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300">طريقة الدفع</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300">إجراء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {syncSubscribersList.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-3 py-4 text-sm text-center text-gray-500 dark:text-gray-400">لا يوجد مشتركون في القائمة</td>
                        </tr>
                      ) : (
                        syncSubscribersList.map((row) => {
                          const isActivated = activatedSubscriptionIds.has(row.id);
                          const isSaved = savedSubscriberRowIds.has(row.id);
                          const isUpdating = updatingSubscriptionId === row.id;
                          const profileName = row.profile_details?.name ?? '—';
                          const isPlanPurchase = row.type_ar != null && String(row.type_ar).trim() === 'شراء اشتراك';
                          const isRowDone = isActivated || isSaved;
                          return (
                            <tr key={row.id} className={isRowDone ? 'bg-green-50 dark:bg-green-900/20' : isPlanPurchase ? 'bg-green-50 dark:bg-green-900/20' : undefined}>
                              <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">{row.username}</td>
                              <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">{[row.firstname, row.lastname].filter(Boolean).join(' ') || '—'}</td>
                              <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">{row.expiration || '—'}</td>
                              <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">{profileName}</td>
                              <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">{row.zone ?? '—'}</td>
                              <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">{row.customer_id ?? '—'}</td>
                              <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">
                                {formatSyncWalletOrPaymentDisplay(row)}
                              </td>
                              <td className="px-3 py-2 text-sm">
                                {isActivated ? (
                                  <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                                    <Check className="h-4 w-4" /> تم
                                  </span>
                                ) : isSaved ? (
                                  <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                                    <Check className="h-4 w-4" /> تم الحفظ
                                  </span>
                                ) : unpaidActivationRowId === row.id ? (
                                  <div className="inline-flex flex-wrap items-center gap-2">
                                    <input
                                      type="number"
                                      min={1}
                                      value={unpaidDebtAmountInput}
                                      onChange={(e) => setUnpaidDebtAmountInput(e.target.value)}
                                      placeholder="مبلغ الدين (اختياري)"
                                      className="w-28 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white text-xs"
                                    />
                                    <button
                                      type="button"
                                      disabled={isUpdating}
                                      onClick={() => {
                                        const debtAmount = unpaidDebtAmountInput.trim() ? Number(unpaidDebtAmountInput) : undefined;
                                        if (debtAmount !== undefined && (Number.isNaN(debtAmount) || debtAmount <= 0)) {
                                          showError('خطأ', 'مبلغ الدين يجب أن يكون رقماً أكبر من صفر.');
                                          return;
                                        }
                                        updateSubscriptionMutation.mutate(
                                          {
                                            id: row.id,
                                            username: row.username,
                                            firstname: row.firstname,
                                            lastname: row.lastname ?? '',
                                            expiration: row.expiration,
                                            phone: row.phone ?? null,
                                            profileName,
                                            isPaid: false,
                                            ...(debtAmount != null && debtAmount > 0 ? { debtAmount } : {}),
                                          },
                                          {
                                            onSuccess: (data, variables) => {
                                              setUnpaidActivationRowId(null);
                                              setUnpaidDebtAmountInput('');
                                              handlePostUpdateSubscriptionSuccess(data, variables as UpdateSubscriptionRequest, 'details');
                                            },
                                          }
                                        );
                                      }}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs disabled:opacity-50"
                                    >
                                      {isUpdating ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                      تأكيد
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { setUnpaidActivationRowId(null); setUnpaidDebtAmountInput(''); }}
                                      className="inline-flex px-2 py-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-xs"
                                    >
                                      إلغاء
                                    </button>
                                  </div>
                                ) : (
                                  <div className="inline-flex items-center gap-1 flex-wrap">
                                    <button
                                      type="button"
                                      disabled={isUpdating}
                                      onClick={() => {
                                        updateSubscriptionMutation.mutate(
                                          {
                                            id: row.id,
                                            username: row.username,
                                            firstname: row.firstname,
                                            lastname: row.lastname ?? '',
                                            expiration: row.expiration,
                                            phone: row.phone ?? null,
                                            profileName,
                                          },
                                          {
                                            onSuccess: (data, variables) => {
                                              handlePostUpdateSubscriptionSuccess(data, variables as UpdateSubscriptionRequest, 'activation');
                                            },
                                          }
                                        );
                                      }}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-primary-600 hover:bg-primary-700 text-white rounded text-xs disabled:opacity-50"
                                    >
                                      {isUpdating ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
                                      تفعيل
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isUpdating}
                                      onClick={() => { setUnpaidActivationRowId(row.id); setUnpaidDebtAmountInput(''); }}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs disabled:opacity-50"
                                    >
                                      تفعيل (دين)
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isUpdating || savingSubscriberRowId === row.id}
                                      onClick={() => {
                                        const body: SaveSubscriberFromSyncRequest = {
                                          customer_id: row.customer_id ?? undefined,
                                          username: row.username,
                                          customer_name: row.customer_name ?? undefined,
                                          expiration: row.expiration,
                                          profile_name: row.profile_details?.name ?? undefined,
                                          zone: row.zone ?? undefined,
                                          type_ar: row.type_ar ?? undefined,
                                        };
                                        saveSubscriberFromSyncMutation.mutate({ rowId: row.id, body, agentId: myAgent?.id });
                                      }}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-xs disabled:opacity-50"
                                    >
                                      {savingSubscriberRowId === row.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
                                      حفظ
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSasSyncStep('form');
                      setSyncSubscribersList(null);
                      setActivatedSubscriptionIds(new Set());
                      setSavedSubscriberRowIds(new Set());
                      setUnpaidActivationRowId(null);
                      setUnpaidDebtAmountInput('');
                      setSelectedSyncResellerId(null);
                    }}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md"
                  >
                    رجوع
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSasCredentialsModal(false);
                      setSasSyncStep('form');
                      setSyncSubscribersList(null);
                      setActivatedSubscriptionIds(new Set());
                      setSavedSubscriberRowIds(new Set());
                      setUnpaidActivationRowId(null);
                      setUnpaidDebtAmountInput('');
                      setSelectedSyncResellerId(null);
                    }}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            )}

            {sasSyncStep === 'failed' && (
              <div className="p-4">
                <p className="text-sm text-red-600 dark:text-red-400 mb-4">{sasPreviewError || 'فشل الجلب'}</p>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowSasCredentialsModal(false); setSasSyncStep('form'); setSasPreviewError(''); }}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md"
                  >
                    إغلاق
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSasSyncStep('form'); setSasPreviewError(''); }}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md"
                  >
                    إعادة المحاولة
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* نافذة اختيار الرسيلر عند التفعيل عبر تاب (عند وجود أكثر من رسيلر) */}
      {showResellerPickerModal && pendingActivateSubscriberId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">اختر الرسيلر للتفعيل</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              قد يكون المشترك موجوداً في أكثر من مصدر. اختر الرسيلر الذي تريد فتح رابط التفعيل منه.
            </p>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {[...myResellers].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    openActivationLinkWithReseller(pendingActivateSubscriberId, r.id);
                    setShowResellerPickerModal(false);
                    setPendingActivateSubscriberId(null);
                  }}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-right rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
                >
                  <span className="font-medium text-gray-900 dark:text-white">{r.name}</span>
                  <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    {r.serviceType === 1 ? 'FTTH' : r.serviceType === 2 ? 'SAS' : 'Earthlink'}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowResellerPickerModal(false);
                  setPendingActivateSubscriberId(null);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {showAutoSyncModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-6xl bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  نتائج المزامنة التلقائية {String(autoSyncFtthResult?.provider || '').toUpperCase() || 'FTTH'}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAutoSyncModal(false)}
                className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="إغلاق"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="px-5 py-3 text-sm text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3">
              <div>
                عدد السجلات: <strong>{autoSyncFtthResult?.count ?? autoSyncFtthResult?.data?.length ?? 0}</strong>
              </div>
              {String(autoSyncFtthResult?.provider || '').toLowerCase() === 'sas' && (autoSyncFtthResult?.data?.length ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={() => saveAllSasSyncItemsMutation.mutate()}
                  disabled={savingAllSasRows}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60"
                >
                  {savingAllSasRows ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
                  حفظ الكل
                </button>
              )}
            </div>

            <div className="overflow-auto bg-gray-50/40 dark:bg-gray-900/20">
              <table className="min-w-[980px] w-full text-sm text-right border-separate border-spacing-0">
                <thead className="bg-white/95 dark:bg-gray-800/95 sticky top-0 z-10 backdrop-blur-sm">
                  <tr>
                    <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-200">اسم المشترك</th>
                    <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-200">الباقة</th>
                    <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-200">انتهاء الاشتراك</th>
                    <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-200">
                      {autoSyncReseller?.serviceType === ServiceType.Sas ? 'الوكيل' : 'المنطقة'}
                    </th>
                    <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-200">اسم المستخدم</th>
                    <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-200">طريقة التفعيل</th>
                    <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-200">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {(autoSyncFtthResult?.data ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">
                        لا توجد بيانات ضمن آخر أسبوع.
                      </td>
                    </tr>
                  ) : (
                    (autoSyncFtthResult?.data ?? []).map((row: CashbackSynchronizationFtthRow, idx: number) => {
                      const isSavingThisRow = savingFtthRowIndex === idx;
                      const isOpeningRenewalThisRow = openingRenewalFtthRowIndex === idx;
                      const isSaved = savedFtthRowIndices.has(idx);
                      const isActivated = activatedFtthRowIndices.has(idx);
                      const customerName = row.customerName ?? row.firstname ?? null;
                      const packageName = row.subscriptionName ?? row.profile_details?.name ?? null;
                      const expirationAt = row.subscriptionEndsAt ?? row.new_expiration ?? null;
                      const zoneOrParent = row.zoneId ?? row.parent_username ?? null;
                      const deviceOrUsername = (row.deviceUsername ?? row.username ?? '').toString().trim();
                      const rawActivationMethod = (row.activationType ?? row.activation_method ?? '').toString().trim();
                      const activationMethod = (() => {
                        const normalized = rawActivationMethod.toLowerCase();
                        if (normalized === 'user_credit') return 'بطاقة ائتمان المشترك';
                        if (normalized === 'voucher') return 'محفظة الوكيل';
                        if (normalized === 'credit') return 'قسيمة';
                        return rawActivationMethod || null;
                      })();
                      return (
                        <tr
                          key={`${deviceOrUsername || customerName || 'r'}-${idx}`}
                          className="border-t border-gray-100 dark:border-gray-700 even:bg-white odd:bg-gray-50/70 dark:even:bg-gray-800/40 dark:odd:bg-gray-800/20 hover:bg-primary-50/70 dark:hover:bg-primary-900/20 transition-colors"
                        >
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{customerName || '—'}</td>
                        <td className="px-4 py-3">
                          {packageName ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
                              {packageName}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-gray-300">{expirationAt ? formatDate(expirationAt) : '—'}</td>
                        <td className="px-4 py-3">
                          {zoneOrParent ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
                              {zoneOrParent}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {deviceOrUsername ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                              {deviceOrUsername}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200">
                              (مشترك جديد)
                            </span>
                          )}
                        </td>
                          <td className="px-4 py-3">
                            {activationMethod ? (
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  activationMethod.includes('الوكيل') || activationMethod.includes('قسيمة')
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200'
                                    : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-200'
                                }`}
                              >
                                {activationMethod}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                disabled={savingAllSasRows || isSavingThisRow || isOpeningRenewalThisRow}
                                onClick={() => saveFtthSyncItemMutation.mutate({ row, rowIndex: idx })}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-gray-700 hover:bg-gray-800 text-white disabled:opacity-60"
                              >
                                {isSavingThisRow ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
                                حفظ
                              </button>
                              <button
                                type="button"
                                disabled={savingAllSasRows || isSavingThisRow || isOpeningRenewalThisRow}
                                onClick={() => openRenewalModalForFtthSyncRow(row, idx)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-60"
                              >
                                {isOpeningRenewalThisRow ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
                                تفعيل
                              </button>
                              {(isSaved || isActivated) && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                                  <Check className="h-3 w-3" />
                                  {isActivated ? 'تم التفعيل' : 'تم الحفظ'}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                type="button"
                onClick={() => setShowAutoSyncModal(false)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md text-gray-700 dark:text-gray-200"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {showAutoSyncResellerPickerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">اختر الرسيلر للمزامنة</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              لديك أكثر من رسيلر بأنواع مختلفة. اختر الرسيلر ليتم استدعاء API المزامنة الصحيح حسب النوع.
            </p>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {[...myResellers].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setShowAutoSyncResellerPickerModal(false);
                    synchronizationFtthMutation.mutate(r);
                  }}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-right rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
                >
                  <span className="font-medium text-gray-900 dark:text-white">{r.name}</span>
                  <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    {r.serviceType === 1 ? 'FTTH' : r.serviceType === 2 ? 'SAS' : 'Earthlink'}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowAutoSyncResellerPickerModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {postActivationWhatsApp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              {postActivationWhatsApp.mode === 'activation' ? 'إرسال رسالة التفعيل بالواتساب؟' : 'إرسال رسالة الدين/التفاصيل بالواتساب؟'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              تم تفعيل المشترك بنجاح. يمكنك الآن اختيار إرسال رسالة واتساب أو إغلاق هذه النافذة.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPostActivationWhatsApp(null)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md text-sm"
              >
                إلغاء
              </button>
              {postActivationWhatsApp.mode === 'activation' ? (
                <button
                  type="button"
                  onClick={async () => {
                    const id = postActivationWhatsApp.subscriberId;
                    setPostActivationWhatsApp(null);
                    await apiService.sendWhatsAppActivation(id);
                  }}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm"
                >
                  إرسال رسالة التفعيل
                </button>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    const id = postActivationWhatsApp.subscriberId;
                    setPostActivationWhatsApp(null);
                    await handleSendSubscriberDetailsById(id);
                  }}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm"
                >
                  إرسال رسالة الدين/التفاصيل
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Subscriber Modal */}
      {selectedSubscriberForEdit && (
        <EditSubscriberModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedSubscriberForEdit(null);
          }}
          subscriber={selectedSubscriberForEdit}
          profiles={Array.isArray(profiles) ? profiles : []}
          onUpdate={async (id, data) => {
            await updateSubscriberMutation.mutateAsync({ id, data });
          }}
        />
      )}

      {/* Add Note Modal */}
      {selectedSubscriberForNote && (
        <AddNoteModal
          isOpen={showNoteModal}
          onClose={() => {
            setShowNoteModal(false);
            setSelectedSubscriberForNote(null);
          }}
          subscriber={selectedSubscriberForNote}
          onSave={handleSaveNote}
        />
      )}
    </div>
  );
};

export default SubscribersPage;