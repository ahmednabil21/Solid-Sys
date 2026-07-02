import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useDigits } from '../contexts/DigitsContext';
import WifiLoaderComponent from '../components/WifiLoaderComponent';
import SubscriberPhonesUpdateSection from '../components/SubscriberPhonesUpdateSection';
import SubscriberExcelImportSection from '../components/SubscriberExcelImportSection';
import ActivationExcelImportSection from '../components/ActivationExcelImportSection';
import {
  getActivationMessageSettings,
  setActivationMessageSettings,
  PLACEHOLDERS,
  ALERT_PLACEHOLDERS,
  DEFAULT_ALERT_TEMPLATE,
  DEFAULT_ACTIVATION_TEMPLATE,
  DETAILS_PLACEHOLDERS,
  DEFAULT_DETAILS_TEMPLATE,
  type ActivationMessageMode,
  type AlertMessageMode,
  type DetailsMessageMode,
} from '../utils/activationMessage';
import { showSuccess, showError } from '../utils/notifications';
import { apiService, ApiService } from '../services/api';
import {
  sasBrowserLogin,
  sasBrowserFetchAllUsers,
  buildSasExportPayload,
  normalizeSasBaseUrl,
  parseSasTokenFromPaste,
  isJtIqPanel,
} from '../services/sasBrowserClient';
import { readSasExportJsonFile } from '../utils/sasExportJson';
import {
  UserRole,
  ServiceType,
  UpdateMyCredentialsRequest,
  AppSettingsResponse,
  AppSettingsUpdateRequest,
  AgentAnnouncementDto,
  AgentAnnouncementCreateRequest,
  AgentReseller,
  AgentResellerCreateRequest,
  AgentResellerUpdateRequest,
  AgentRegion,
  AgentRegionCreateRequest,
  AgentRegionUpdateRequest,
  ServiceFees,
  ServiceFeesCreateRequest,
  ServiceFeesUpdateRequest,
  FtthSubscribersExportBody,
  FtthSubscribersImportResponse,
  WhatsAppDeviceStatusAdmin,
} from '../types';
import {
  Settings,
  User,
  Save,
  Eye,
  EyeOff,
  MessageSquare,
  ExternalLink,
  RefreshCw,
  Copy,
  MessageCircle,
  CloudDownload,
  X,
  Trash2,
  Key,
  Smartphone,
  Phone,
  Megaphone,
  Pencil,
  Store,
  Plus,
  Users,
  Download,
  Database as DatabaseIcon,
  CheckCircle2,
  Sparkles,
  Search,
  Activity,
  DollarSign,
  Upload,
  Receipt,
} from 'lucide-react';

/** نقاط تُعرض أثناء استيراد المشتركين — ألوان ومزايا النظام */
const SUBSCRIBER_IMPORT_FEATURE_LINES = [
  'قاعدة بيانات موحّدة للمشتركين: بحث وتصفية وتقارير من مكان واحد.',
  'ربط مع التجديد والديون والإشعارات دون تكرار إدخال البيانات.',
  'دعم واتساب والتذكيرات لتحسين التواصل مع المشتركين.',
  'مزامنة عبر الباكند بأمان — بياناتك لا تُنفَّذ من المتصفح مباشرة.',
  'يمكنك دائماً الاحتفاظ بنسخة JSON احتياطية قبل الاستيراد.',
] as const;

const SAS_SYNC_STEPS = [
  'جاري امزامنة من SAS...',
  'جاري مزامنة المشتركين...',
  'جاري تحديث المشتركين و IsOnline...',
  'جاري حساب OnlineCount...',
  'جاري إنهاء المزامنة...',
];

function formatSubscriberImportStats(res: FtthSubscribersImportResponse): string {
  const parts = [
    res.imported != null && res.imported > 0 ? `جديد: ${res.imported}` : null,
    res.updated != null && res.updated > 0 ? `تحديث: ${res.updated}` : null,
    res.phoneUpdated != null && res.phoneUpdated > 0 ? `هاتف: ${res.phoneUpdated}` : null,
    res.skippedDuplicate != null && res.skippedDuplicate > 0 ? `بدون تغيير: ${res.skippedDuplicate}` : null,
    res.errors != null && res.errors > 0 ? `أخطاء: ${res.errors}` : null,
  ].filter(Boolean);
  return parts.join(' — ') || 'اكتملت العملية';
}

function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const { formatNumber } = useDigits();
  const queryClient = useQueryClient();
  const [showCredentialsNewPassword, setShowCredentialsNewPassword] = useState(false);
  const [credentialsCurrentPassword, setCredentialsCurrentPassword] = useState('');
  const [credentialsNewUsername, setCredentialsNewUsername] = useState('');
  const [credentialsNewPassword, setCredentialsNewPassword] = useState('');
  const [credentialsConfirmPassword, setCredentialsConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const activationTemplateRef = useRef<HTMLTextAreaElement>(null);
  const alertTemplateRef = useRef<HTMLTextAreaElement>(null);
  const detailsTemplateRef = useRef<HTMLTextAreaElement>(null);
  const [activationMessageMode, setActivationMessageMode] = useState<ActivationMessageMode>('default');
  const [activationTemplate, setActivationTemplate] = useState('');
  const [activationCustomText, setActivationCustomText] = useState('');
  const [alertMessageMode, setAlertMessageMode] = useState<AlertMessageMode>('default');
  const [alertTemplate, setAlertTemplate] = useState('');
  const [detailsMessageMode, setDetailsMessageMode] = useState<DetailsMessageMode>('default');
  const [detailsTemplate, setDetailsTemplate] = useState(DEFAULT_DETAILS_TEMPLATE);
  const [sasSyncLoading] = useState(false);
  const [sasSyncStepIndex, setSasSyncStepIndex] = useState(0);
  const sasSyncStepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isAgent = user?.role === UserRole.Agent;
  const isSubAgent = user?.role === UserRole.SubAgent;
  const isEmployee = user?.role === UserRole.Employee;
  const isAgentOrSubAgent = isAgent || isSubAgent;
  /** الوكيل والمدير الثانوي والموظف: جلب الوكيل (للموظف/المدير الثانوي يرجع الوكيل التابع له — نفس جلسة واتساب) */
  const isAgentOrSubAgentOrEmployee = isAgentOrSubAgent || isEmployee;
  const isAdmin = user?.role === UserRole.Admin;
  const canUpdateSubscriberPhones = isAdmin || isAgentOrSubAgent;
  const canManageServiceFees = isAdmin || isAgentOrSubAgent;
  const canViewServiceFees = canManageServiceFees || isEmployee;

  // Admin SAS browser-sync state
  const [sasBrowserToken, setSasBrowserToken] = useState('');
  const [sasBrowserPage, setSasBrowserPage] = useState(1);
  const [sasBrowserPerPage, setSasBrowserPerPage] = useState(500);
  const [sasBrowserRawJson, setSasBrowserRawJson] = useState('');
  const [sasBrowserSummary, setSasBrowserSummary] = useState<{ total?: number; count?: number } | null>(null);
  const [sasBrowserBusy, setSasBrowserBusy] = useState(false);
  const [sasBrowserStage, setSasBrowserStage] = useState<'fetch' | 'send' | null>(null);
  const { data: myAgent, isLoading: myAgentLoading } = useQuery({
    queryKey: ['myAgent'],
    queryFn: () => apiService.getMyAgent(),
    enabled: !!isAgentOrSubAgentOrEmployee,
  });
  const [sasBaseUrl, setSasBaseUrl] = useState('');
  const [sasUsername, setSasUsername] = useState('');
  const [sasPassword, setSasPassword] = useState('');
  const [serviceType, setServiceType] = useState<ServiceType>(ServiceType.Sas);
  const [ftthBaseUrl, setFtthBaseUrl] = useState('https://admin.ftth.iq');
  const [ftthUsername, setFtthUsername] = useState('');
  const [ftthPassword, setFtthPassword] = useState('');
  const [agentCompanyName, setAgentCompanyName] = useState('');
  useEffect(() => {
    if (myAgent) {
      setSasBaseUrl(myAgent.sasBaseUrl ?? '');
      setSasUsername(myAgent.sasUsername ?? '');
      setSasPassword('');
      setServiceType(myAgent.serviceType ?? ServiceType.Sas);
      setFtthBaseUrl(myAgent.ftthBaseUrl ?? 'https://admin.ftth.iq');
      setFtthUsername(myAgent.ftthUsername ?? '');
      setFtthPassword('');
      setAgentCompanyName(myAgent.companyName ?? '');
    }
  }, [myAgent]);

  /** رقم اختياري لطلب pair-code (?phone=)؛ إن وُفر يُنظَّف إلى أرقام */
  const [pairPhoneOverride, setPairPhoneOverride] = useState('');
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [pairHint, setPairHint] = useState<string | null>(null);
  const [waError, setWaError] = useState<string | null>(null);
  const [waSuccessInfo, setWaSuccessInfo] = useState<string | null>(null);
  const [waPairLoading, setWaPairLoading] = useState(false);
  const [waStatus, setWaStatus] = useState<import('../types').WhatsAppStatusResponse | null>(null);
  const [waStatusLoading, setWaStatusLoading] = useState(false);
  const [waCheckStatusLoading, setWaCheckStatusLoading] = useState(false);
  const [waSessionsStateFilter, setWaSessionsStateFilter] = useState('');
  const [waSessionsLinkedOnly, setWaSessionsLinkedOnly] = useState(false);
  /** بحث في القائمة (الفرونت فقط — الـ API يعيد القائمة كاملة) */
  const [waDevicesSearch, setWaDevicesSearch] = useState('');
  const [waDeviceDetailId, setWaDeviceDetailId] = useState<string | null>(null);
  const [waStatusByDeviceId, setWaStatusByDeviceId] = useState<Record<string, WhatsAppDeviceStatusAdmin>>({});
  const [waStatusLoadingId, setWaStatusLoadingId] = useState<string | null>(null);
  const waStatusPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const WA_STATUS_POLL_MS = 3000;
  const WA_STATUS_POLL_MAX_TICKS = 40;

  const clearWaStatusPoll = () => {
    if (waStatusPollRef.current) {
      clearInterval(waStatusPollRef.current);
      waStatusPollRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearWaStatusPoll();
    };
  }, []);

  const normalizeWhatsAppDeviceId = (raw: string) =>
    raw.replace(/\D/g, '').replace(/^0+/, '') || raw.replace(/\D/g, '');

  const getWaSessionStateBadgeClass = (rawState?: string) => {
    const state = (rawState || '').toLowerCase();
    if (state === 'connected' || state === 'ready' || state === 'open' || state === 'logged_in') {
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
    }
    if (state === 'connecting' || state === 'syncing' || state === 'initializing') {
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    }
    if (state === 'disconnected' || state === 'closed' || state === 'logged_out') {
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    }
    return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  };

  const mapWhatsAppBackendError = (rawMessage: string) => {
    if (/device\s+.+\s+not found\s*\(HTTP\s*500\)/i.test(rawMessage)) {
      return 'تم تسجيل الخروج من تطبيق الواتساب احذف الجلسة من التطبيق واعد الربط من جديد';
    }
    return rawMessage;
  };

  const updateAgentSasMutation = useMutation({
    mutationFn: async (payload: {
      serviceType: ServiceType;
      sasBaseUrl: string;
      sasUsername: string;
      sasPassword?: string;
      ftthBaseUrl: string;
      ftthUsername: string;
      ftthPassword?: string;
    }) => {
      if (!myAgent) throw new Error('لا يوجد وكيل');
      const effectiveFtthBaseUrl =
        payload.serviceType === ServiceType.Earthlink ? 'https://admin.earthlink.iq' : payload.ftthBaseUrl;
      const updatePayload: import('../types').AgentUpdateRequest = {
        fullName: myAgent.fullName,
        companyName: myAgent.companyName,
        phone: myAgent.phone,
        address: myAgent.address,
        governorate: myAgent.governorate,
        isActive: myAgent.isActive,
        subscriptionType: myAgent.subscriptionType,
        subscriptionStartDate: myAgent.subscriptionStartDate,
        subscriptionEndDate: myAgent.subscriptionEndDate,
        serviceType: payload.serviceType,
        sasBaseUrl: payload.serviceType === ServiceType.Sas ? (payload.sasBaseUrl || undefined) : undefined,
        sasUsername: payload.serviceType === ServiceType.Sas ? (payload.sasUsername || undefined) : undefined,
        sasPassword: payload.serviceType === ServiceType.Sas ? (payload.sasPassword || undefined) : undefined,
        ftthBaseUrl:
          payload.serviceType === ServiceType.Ftth || payload.serviceType === ServiceType.Earthlink
            ? (effectiveFtthBaseUrl || undefined)
            : undefined,
        ftthUsername:
          payload.serviceType === ServiceType.Ftth || payload.serviceType === ServiceType.Earthlink
            ? (payload.ftthUsername || undefined)
            : undefined,
        ftthPassword:
          payload.serviceType === ServiceType.Ftth || payload.serviceType === ServiceType.Earthlink
            ? (payload.ftthPassword || undefined)
            : undefined,
      };
      return apiService.updateAgent(myAgent.id, updatePayload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myAgent'] });
      showSuccess('تم الحفظ', 'تم حفظ إعدادات التفعيل بنجاح.');
      setSasPassword('');
      setFtthPassword('');
    },
    onError: (err: any) => {
      showError('خطأ', ApiService.showError(err));
    },
  });

  const pollResellerWhatsAppStatus = (resellerId: string) => {
    clearWaStatusPoll();
    setWaStatusLoading(true);
    setWaError(null);
    let ticks = 0;
    waStatusPollRef.current = setInterval(async () => {
      ticks += 1;
      if (ticks > WA_STATUS_POLL_MAX_TICKS) {
        clearWaStatusPoll();
        setWaStatusLoading(false);
        setWaError('انتهت مهلة التحقق. جرّب «تحقق من الحالة».');
        return;
      }
      try {
        const s = await apiService.getResellerWhatsAppStatus(resellerId);
        setWaStatus(s);
        if (s.isLoggedIn) {
          clearWaStatusPoll();
          setWaStatusLoading(false);
          setWaSuccessInfo('واتساب مرتبط بنجاح.');
          queryClient.invalidateQueries({ queryKey: ['myResellers'] });
          queryClient.invalidateQueries({ queryKey: ['myRegions'] });
        }
      } catch {
        /* keep polling */
      }
    }, WA_STATUS_POLL_MS);
  };


  const updateAgentCompanyNameMutation = useMutation({
    mutationFn: async (newCompanyName: string) => {
      if (!myAgent) throw new Error('لا يوجد وكيل');
      const trimmed = newCompanyName.trim();
      if (!trimmed) throw new Error('اسم الشركة لا يمكن أن يكون فارغاً');
      const updatePayload: import('../types').AgentUpdateRequest = {
        fullName: myAgent.fullName,
        companyName: trimmed,
        phone: myAgent.phone,
        address: myAgent.address,
        governorate: myAgent.governorate,
        isActive: myAgent.isActive,
        subscriptionType: myAgent.subscriptionType,
        subscriptionStartDate: myAgent.subscriptionStartDate,
        subscriptionEndDate: myAgent.subscriptionEndDate,
        renewalPeriod: myAgent.renewalPeriod,
        renewalCalculationType: myAgent.renewalCalculationType,
        serviceType: myAgent.serviceType,
        sasBaseUrl: myAgent.sasBaseUrl,
        sasUsername: myAgent.sasUsername,
        ftthBaseUrl: myAgent.ftthBaseUrl,
        ftthUsername: myAgent.ftthUsername,
        whatsAppSessionId: myAgent.whatsAppSessionId ?? undefined,
      };
      return apiService.updateAgent(myAgent.id, updatePayload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myAgent'] });
      showSuccess('تم الحفظ', 'تم تحديث اسم الشركة بنجاح.');
    },
    onError: (err: any) => {
      showError('خطأ', ApiService.showError(err));
    },
  });

  const updateMyCredentialsMutation = useMutation({
    mutationFn: (data: UpdateMyCredentialsRequest) => apiService.updateMyCredentials(data),
    onSuccess: (data) => {
      showSuccess('تم التحديث', data?.message ?? 'تم تحديث بيانات الدخول بنجاح');
      setCredentialsCurrentPassword('');
      setCredentialsNewUsername('');
      setCredentialsNewPassword('');
      setCredentialsConfirmPassword('');
    },
    onError: (err: unknown) => {
      showError('خطأ', ApiService.showError(err));
    },
  });

  const { data: activationMessageData } = useQuery({
    queryKey: ['activationMessage'],
    queryFn: () => apiService.getActivationMessage(),
  });
  const { data: alertMessageData } = useQuery({
    queryKey: ['alertMessage'],
    queryFn: () => apiService.getAlertMessage(),
  });
  const { data: detailsMessageData } = useQuery({
    queryKey: ['detailsMessage'],
    queryFn: () => apiService.getDetailsMessage(),
  });

  useEffect(() => {
    if (activationMessageData?.template != null) {
      setActivationTemplate(activationMessageData.template);
      setActivationMessageMode('custom');
    } else if (activationMessageData === null) {
      const saved = getActivationMessageSettings(user?.id);
      setActivationMessageMode(saved.mode);
      setActivationTemplate(saved.template || '');
      setActivationCustomText(saved.customText);
    }
  }, [activationMessageData, user?.id]);

  useEffect(() => {
    if (alertMessageData?.template != null && alertMessageData.template.trim()) {
      setAlertTemplate(alertMessageData.template);
      setAlertMessageMode('custom');
    } else {
      setAlertMessageMode('default');
      setAlertTemplate(DEFAULT_ALERT_TEMPLATE);
    }
  }, [alertMessageData]);

  useEffect(() => {
    const tpl = (detailsMessageData?.template || '').trim();
    if (tpl) {
      if (tpl === DEFAULT_DETAILS_TEMPLATE.trim()) {
        setDetailsMessageMode('default');
        setDetailsTemplate(DEFAULT_DETAILS_TEMPLATE);
      } else {
        setDetailsMessageMode('custom');
        setDetailsTemplate(detailsMessageData!.template);
      }
    } else {
      setDetailsMessageMode('default');
      setDetailsTemplate(DEFAULT_DETAILS_TEMPLATE);
    }
  }, [detailsMessageData]);

  const insertPlaceholder = (token: string) => {
    const el = activationTemplateRef.current;
    if (el) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const before = activationTemplate.slice(0, start);
      const after = activationTemplate.slice(end);
      setActivationTemplate(before + token + after);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + token.length, start + token.length);
      }, 0);
    } else {
      setActivationTemplate((prev) => prev + token);
    }
  };

  const insertAlertPlaceholder = (token: string) => {
    const el = alertTemplateRef.current;
    if (el) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const before = alertTemplate.slice(0, start);
      const after = alertTemplate.slice(end);
      setAlertTemplate(before + token + after);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + token.length, start + token.length);
      }, 0);
    } else {
      setAlertTemplate((prev) => prev + token);
    }
  };

  const insertDetailsPlaceholder = (token: string) => {
    const el = detailsTemplateRef.current;
    if (el) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const before = detailsTemplate.slice(0, start);
      const after = detailsTemplate.slice(end);
      setDetailsTemplate(before + token + after);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + token.length, start + token.length);
      }, 0);
    } else {
      setDetailsTemplate((prev) => prev + token);
    }
  };

  type SettingsSection =
    | 'profile'
    | 'theme'
    | 'activation'
    | 'alert'
    | 'details'
    | 'customMessage'
    | 'resellers'
    | 'serviceFees'
    | 'sas'
    | 'whatsapp'
    | 'sasAdminBrowserSync'
    | 'adminWhatsAppSessions'
    | 'subscriberApp'
    | 'subscriberAnnouncement'
    | 'subscriberPhones'
    | 'subscriberExcelImport'
    | 'activationExcelImport';
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile');

  const {
    data: waDevicesData,
    isLoading: waDevicesLoading,
    isFetching: waDevicesFetching,
    refetch: refetchWaDevices,
  } = useQuery({
    queryKey: ['admin-whatsapp-sessions-devices'],
    queryFn: () => apiService.getWhatsAppSessionsDevices(),
    enabled: isAdmin && activeSection === 'adminWhatsAppSessions',
    staleTime: 15_000,
  });

  const waDevicesFiltered = useMemo(() => {
    const items = waDevicesData?.items ?? [];
    const q = waDevicesSearch.trim().toLowerCase();
    const stateFilter = waSessionsStateFilter.trim().toLowerCase();
    return items.filter((item) => {
      if (waSessionsLinkedOnly && !item.agent?.id) return false;
      if (stateFilter) {
        const s = (item.state || '').toLowerCase();
        if (!s.includes(stateFilter)) return false;
      }
      if (!q) return true;
      const hay = [
        item.deviceId,
        item.state,
        item.createdAt,
        item.displayName,
        item.jid,
        item.agent?.companyName,
        item.agent?.phone,
        item.agent?.id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [waDevicesData, waDevicesSearch, waSessionsLinkedOnly, waSessionsStateFilter]);

  const { data: waDeviceDetail, isLoading: waDeviceDetailLoading } = useQuery({
    queryKey: ['whatsapp-admin-device-detail', waDeviceDetailId],
    queryFn: () => apiService.getWhatsAppSessionsDeviceDetail(waDeviceDetailId!),
    enabled: Boolean(isAdmin && activeSection === 'adminWhatsAppSessions' && waDeviceDetailId),
  });

  const deleteWaDeviceMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteWhatsAppSessionsDevice(id),
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['admin-whatsapp-sessions-devices'] });
      setWaDeviceDetailId((prev) => (prev === deletedId ? null : prev));
      setWaStatusByDeviceId((prev) => {
        const next = { ...prev };
        delete next[deletedId];
        return next;
      });
      showSuccess('تم الحذف', 'تم حذف الجهاز من المدير.');
    },
    onError: (err: any) => showError('خطأ', ApiService.showError(err)),
  });

  const loadWaDeviceStatus = async (deviceId: string) => {
    setWaStatusLoadingId(deviceId);
    try {
      const s = await apiService.getWhatsAppSessionsDeviceStatus(deviceId);
      setWaStatusByDeviceId((prev) => ({ ...prev, [deviceId]: s }));
    } catch (e: any) {
      showError('حالة الجهاز', ApiService.showError(e));
    } finally {
      setWaStatusLoadingId(null);
    }
  };

  // إعدادات تطبيق المشترك — طرق الدفع المتعددة (زين كاش، ماستر كارد، نقد)
  const [zainCashEnabled, setZainCashEnabled] = useState(false);
  const [zainCashNumber, setZainCashNumber] = useState('');
  const [masterCardEnabled, setMasterCardEnabled] = useState(false);
  const [masterCardNumber, setMasterCardNumber] = useState('');
  const [cashEnabled, setCashEnabled] = useState(false);
  const [cashOfficeAddress, setCashOfficeAddress] = useState('');
  const { data: appSettings, isLoading: appSettingsLoading } = useQuery<AppSettingsResponse>({
    queryKey: ['appSettings'],
    queryFn: () => apiService.getAppSettings(),
    enabled: !!isAgentOrSubAgent,
  });
  useEffect(() => {
    if (appSettings) {
      setZainCashEnabled(!!appSettings.zainCashEnabled);
      setZainCashNumber(appSettings.zainCashNumber ?? '');
      setMasterCardEnabled(!!appSettings.masterCardEnabled);
      setMasterCardNumber(appSettings.masterCardNumber ?? '');
      setCashEnabled(!!appSettings.cashEnabled);
      setCashOfficeAddress(appSettings.cashOfficeAddress ?? '');
    }
  }, [appSettings]);
  const updateAppSettingsMutation = useMutation({
    mutationFn: (data: AppSettingsUpdateRequest) => apiService.updateAppSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appSettings'] });
      showSuccess('تم الحفظ', 'تم حفظ إعدادات تطبيق المشترك بنجاح.');
    },
    onError: (err: any) => {
      showError('خطأ', ApiService.showError(err));
    },
  });
  const handleSaveAppSettings = () => {
    updateAppSettingsMutation.mutate({
      zainCashEnabled,
      zainCashNumber: zainCashNumber.trim() || undefined,
      masterCardEnabled,
      masterCardNumber: masterCardNumber.trim() || undefined,
      cashEnabled,
      cashOfficeAddress: cashOfficeAddress.trim() || undefined,
    });
  };

  // إعلانات تطبيق المشترك (قائمة + نموذج إضافة/تعديل)
  const DEFAULT_GRADIENT_START = '#2962FF';
  const DEFAULT_GRADIENT_END = '#1E40AF';
  const [announcementEditingId, setAnnouncementEditingId] = useState<string | null>(null); // null = لا نموذج، '' = إضافة جديد، غير ذلك = تعديل
  const [announcementMainTitle, setAnnouncementMainTitle] = useState('');
  const [announcementSubTitle, setAnnouncementSubTitle] = useState('');
  const [announcementPhone, setAnnouncementPhone] = useState('');
  const [announcementGradientStart, setAnnouncementGradientStart] = useState(DEFAULT_GRADIENT_START);
  const [announcementGradientEnd, setAnnouncementGradientEnd] = useState(DEFAULT_GRADIENT_END);
  const { data: agentAnnouncements = [], isLoading: announcementLoading } = useQuery<AgentAnnouncementDto[]>({
    queryKey: ['agentAnnouncements'],
    queryFn: () => apiService.getAgentAnnouncements(),
    enabled: isAgentOrSubAgent,
  });
  const createAnnouncementMutation = useMutation({
    mutationFn: (payload: AgentAnnouncementCreateRequest) => apiService.createAgentAnnouncement(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agentAnnouncements'] });
      showSuccess('تم الحفظ', 'تم إضافة الإعلان بنجاح.');
      setAnnouncementEditingId(null);
      setAnnouncementMainTitle('');
      setAnnouncementSubTitle('');
      setAnnouncementPhone('');
      setAnnouncementGradientStart(DEFAULT_GRADIENT_START);
      setAnnouncementGradientEnd(DEFAULT_GRADIENT_END);
    },
    onError: (err: any) => showError('خطأ', ApiService.showError(err)),
  });
  const updateAnnouncementMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: AgentAnnouncementCreateRequest }) =>
      apiService.updateAgentAnnouncement(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agentAnnouncements'] });
      showSuccess('تم الحفظ', 'تم تحديث الإعلان بنجاح.');
      setAnnouncementEditingId(null);
      setAnnouncementMainTitle('');
      setAnnouncementSubTitle('');
      setAnnouncementPhone('');
      setAnnouncementGradientStart(DEFAULT_GRADIENT_START);
      setAnnouncementGradientEnd(DEFAULT_GRADIENT_END);
    },
    onError: (err: any) => showError('خطأ', ApiService.showError(err)),
  });
  const deleteAnnouncementMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteAgentAnnouncement(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['agentAnnouncements'] });
      showSuccess('تم الحذف', 'تم حذف الإعلان بنجاح.');
      if (announcementEditingId === id) {
        setAnnouncementEditingId(null);
        setAnnouncementMainTitle('');
        setAnnouncementSubTitle('');
        setAnnouncementPhone('');
        setAnnouncementGradientStart(DEFAULT_GRADIENT_START);
        setAnnouncementGradientEnd(DEFAULT_GRADIENT_END);
      }
    },
    onError: (err: any) => showError('خطأ', ApiService.showError(err)),
  });
  const handleOpenEditAnnouncement = (a: AgentAnnouncementDto) => {
    setAnnouncementEditingId(a.id);
    setAnnouncementMainTitle(a.mainTitle ?? '');
    setAnnouncementSubTitle(a.subTitle ?? '');
    setAnnouncementPhone(a.phone ?? '');
    setAnnouncementGradientStart(a.gradientStart?.trim() || DEFAULT_GRADIENT_START);
    setAnnouncementGradientEnd(a.gradientEnd?.trim() || DEFAULT_GRADIENT_END);
  };
  const handleCancelEditAnnouncement = () => {
    setAnnouncementEditingId(null);
    setAnnouncementMainTitle('');
    setAnnouncementSubTitle('');
    setAnnouncementPhone('');
    setAnnouncementGradientStart(DEFAULT_GRADIENT_START);
    setAnnouncementGradientEnd(DEFAULT_GRADIENT_END);
  };
  const handleSaveAnnouncement = () => {
    const payload: AgentAnnouncementCreateRequest = {
      mainTitle: announcementMainTitle.trim(),
      subTitle: announcementSubTitle.trim(),
      phone: announcementPhone.trim(),
      gradientStart: announcementGradientStart.trim() || undefined,
      gradientEnd: announcementGradientEnd.trim() || undefined,
    };
    if (announcementEditingId && announcementEditingId !== '') {
      updateAnnouncementMutation.mutate({ id: announcementEditingId, data: payload });
    } else {
      createAnnouncementMutation.mutate(payload);
    }
  };
  const handleDeleteAnnouncement = (id: string) => {
    deleteAnnouncementMutation.mutate(id);
  };
  const handleStartAddAnnouncement = () => {
    setAnnouncementEditingId('');
    setAnnouncementMainTitle('');
    setAnnouncementSubTitle('');
    setAnnouncementPhone('');
    setAnnouncementGradientStart(DEFAULT_GRADIENT_START);
    setAnnouncementGradientEnd(DEFAULT_GRADIENT_END);
  };

  // الرسيلرز (SAS/FTTH/Earthlink) — قائمة روابط التفعيل
  const { data: myResellers = [], isLoading: resellersLoading } = useQuery<AgentReseller[]>({
    queryKey: ['myResellers'],
    queryFn: () => apiService.getMyResellers(),
    enabled: isAgentOrSubAgent,
  });
  const { data: myRegions = [], isLoading: regionsLoading } = useQuery<AgentRegion[]>({
    queryKey: ['myRegions'],
    queryFn: () => apiService.getMyRegions(true),
    enabled: isAgentOrSubAgent,
  });
  const [regionFormId, setRegionFormId] = useState<string | null>(null);
  const [showRegionForm, setShowRegionForm] = useState(false);
  const [regionName, setRegionName] = useState('');
  const [regionDisplayOrder, setRegionDisplayOrder] = useState(0);
  const [resellerFormId, setResellerFormId] = useState<string | null>(null);
  const [showResellerForm, setShowResellerForm] = useState(false);
  const [resellerName, setResellerName] = useState('');
  const [resellerServiceType, setResellerServiceType] = useState<ServiceType>(ServiceType.Sas);
  const [resellerBaseUrl, setResellerBaseUrl] = useState('');
  const [resellerUsername, setResellerUsername] = useState('');
  const [resellerTelegramChatId, setResellerTelegramChatId] = useState('');
  const [resellerPassword, setResellerPassword] = useState('');
  const [resellerDisplayOrder, setResellerDisplayOrder] = useState(0);
  const [resellerFtthPartnerId, setResellerFtthPartnerId] = useState('');
  const [resellerRegionId, setResellerRegionId] = useState('');
  const [waSelectedResellerId, setWaSelectedResellerId] = useState('');
  useEffect(() => {
    if (!waSelectedResellerId && myResellers.length > 0) {
      setWaSelectedResellerId(myResellers[0].id);
    }
  }, [myResellers, waSelectedResellerId]);

  const waSelectedReseller = myResellers.find((r) => r.id === waSelectedResellerId) ?? null;
  // مودال إعلان مميز أثناء سحب المشتركين من SAS في الخلفية (يُعرض عند انتهاء مهلة الاتصال لمدة 5 دقائق كحد أقصى)
  const [showSasSyncPromoModal, setShowSasSyncPromoModal] = useState(false);
  useEffect(() => {
    if (!showSasSyncPromoModal) return;
    const timer = setTimeout(() => setShowSasSyncPromoModal(false), 5 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [showSasSyncPromoModal]);
  /** مودالات سحب المشتركين (FTTH أو SAS/Earthlink): تحميل → نتيجة → استيراد */
  const [pullPanelKind, setPullPanelKind] = useState<'ftth' | 'sas' | null>(null);
  const [pullLoadingModalOpen, setPullLoadingModalOpen] = useState(false);
  const [pullResultModalOpen, setPullResultModalOpen] = useState(false);
  const [pullImportModalOpen, setPullImportModalOpen] = useState(false);
  const [pullExportSnapshot, setPullExportSnapshot] = useState<{
    kind: 'ftth' | 'sas';
    resellerId: string;
    resellerName: string;
    data: unknown[];
    fullPayload: Record<string, unknown>;
    /** FTTH: نتيجة الاستيراد التلقائي أثناء التصدير */
    exportImportResult?: FtthSubscribersImportResponse;
  } | null>(null);
  const [pullImportProgress, setPullImportProgress] = useState(0);

  /** مودال تسجيل دخول SAS من المتصفح (عند سحب مشتركين) */
  const [sasLoginModalOpen, setSasLoginModalOpen] = useState(false);
  const [sasLoginReseller, setSasLoginReseller] = useState<AgentReseller | null>(null);
  const [sasLoginBaseUrl, setSasLoginBaseUrl] = useState('https://ftth.jt.iq');
  const [sasLoginUsername, setSasLoginUsername] = useState('');
  const [sasLoginPassword, setSasLoginPassword] = useState('');
  const [showSasLoginPassword, setShowSasLoginPassword] = useState(false);
  const [sasLoginTokenPaste, setSasLoginTokenPaste] = useState('');
  const [sasLoginMode, setSasLoginMode] = useState<'token' | 'credentials'>('token');
  const [sasBrowserFetchProgress, setSasBrowserFetchProgress] = useState('');
  const sasImportFileInputRef = useRef<HTMLInputElement>(null);
  const sasImportFileResellerRef = useRef<AgentReseller | null>(null);

  function openSasImportFromFile(reseller: AgentReseller) {
    sasImportFileResellerRef.current = reseller;
    if (sasImportFileInputRef.current) {
      sasImportFileInputRef.current.value = '';
      sasImportFileInputRef.current.click();
    }
  }

  async function handleSasImportFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const reseller = sasImportFileResellerRef.current;
    e.target.value = '';
    if (!file || !reseller) return;

    try {
      const parsed = await readSasExportJsonFile(file);
      setPullExportSnapshot({
        kind: 'sas',
        resellerId: reseller.id,
        resellerName: reseller.name,
        data: parsed.data,
        fullPayload: parsed.fullPayload,
      });
      setPullResultModalOpen(true);
      showSuccess('تم قراءة الملف', `وُجد ${parsed.count} مشتركاً — راجع ثم اضغط «استيراد الآن».`);
    } catch (err: unknown) {
      showError(
        'ملف SAS غير صالح',
        err instanceof Error ? err.message : 'تعذّر قراءة الملف'
      );
    } finally {
      sasImportFileResellerRef.current = null;
    }
  }

  function openSasLoginModal(reseller: AgentReseller) {
    const base = normalizeSasBaseUrl(reseller.baseUrl?.trim() || 'https://ftth.jt.iq');
    setSasLoginReseller(reseller);
    setSasLoginBaseUrl(base);
    setSasLoginUsername(reseller.username?.trim() || '');
    setSasLoginPassword(reseller.password?.trim() || '');
    setSasLoginTokenPaste('');
    setSasLoginMode(isJtIqPanel(base) ? 'token' : 'credentials');
    setSasBrowserFetchProgress('');
    setSasLoginModalOpen(true);
  }

  async function runSasBrowserPullWithToken(baseUrl: string, token: string) {
    if (!sasLoginReseller) return;

    setSasLoginModalOpen(false);
    setPullPanelKind('sas');
    setPullLoadingModalOpen(true);
    setSasBrowserFetchProgress('جاري جلب المشتركين من SAS...');

    try {
      const rows = await sasBrowserFetchAllUsers(baseUrl, token, 100, (page, lastPage, loaded) => {
        setSasBrowserFetchProgress(`جاري جلب الصفحة ${page} من ${lastPage} (${loaded} مشترك)...`);
      });

      setPullLoadingModalOpen(false);
      setPullPanelKind(null);
      setSasBrowserFetchProgress('');

      if (!rows.length) {
        showError('تصدير SAS', 'لم يُعثَر على مشتركين في استجابة SAS.');
        setSasLoginModalOpen(true);
        return;
      }

      setPullExportSnapshot({
        kind: 'sas',
        resellerId: sasLoginReseller.id,
        resellerName: sasLoginReseller.name,
        data: rows,
        fullPayload: buildSasExportPayload(rows),
      });
      setPullResultModalOpen(true);
      setSasLoginReseller(null);
    } catch (err: unknown) {
      setPullLoadingModalOpen(false);
      setPullPanelKind(null);
      setSasBrowserFetchProgress('');
      const msg = err instanceof Error ? err.message : 'فشل جلب المشتركين من SAS';
      const hint = /Failed to fetch|CORS|blocked|NetworkError/i.test(msg)
        ? ' — قد تكون اللوحة لا تسمح بطلبات من دومين Wakeel. جرّب من نفس شبكة اللوحة.'
        : '';
      showError('فشل جلب SAS', msg + hint);
      setSasLoginModalOpen(true);
    }
  }

  async function handleSasBrowserPull() {
    if (!sasLoginReseller) return;
    const baseUrl = normalizeSasBaseUrl(sasLoginBaseUrl);
    if (!baseUrl) {
      showError('تسجيل SAS', 'أدخل رابط اللوحة.');
      return;
    }

    if (sasLoginMode === 'token') {
      try {
        const token = parseSasTokenFromPaste(sasLoginTokenPaste);
        await runSasBrowserPullWithToken(baseUrl, token);
      } catch (err: unknown) {
        showError('توكن SAS', err instanceof Error ? err.message : 'توكن غير صالح');
      }
      return;
    }

    const username = sasLoginUsername.trim();
    const password = sasLoginPassword;
    if (!username || !password) {
      showError('تسجيل SAS', 'أدخل اسم المستخدم وكلمة المرور.');
      return;
    }

    setSasLoginModalOpen(false);
    setPullPanelKind('sas');
    setPullLoadingModalOpen(true);
    setSasBrowserFetchProgress('جاري تسجيل الدخول إلى SAS...');

    try {
      const { token } = await sasBrowserLogin(baseUrl, username, password);
      setSasBrowserFetchProgress('تم تسجيل الدخول — جاري جلب المشتركين...');
      const rows = await sasBrowserFetchAllUsers(baseUrl, token, 100, (page, lastPage, loaded) => {
        setSasBrowserFetchProgress(`جاري جلب الصفحة ${page} من ${lastPage} (${loaded} مشترك)...`);
      });

      setPullLoadingModalOpen(false);
      setPullPanelKind(null);
      setSasBrowserFetchProgress('');

      if (!rows.length) {
        showError('تصدير SAS', 'لم يُعثَر على مشتركين في استجابة SAS.');
        setSasLoginModalOpen(true);
        return;
      }

      setPullExportSnapshot({
        kind: 'sas',
        resellerId: sasLoginReseller.id,
        resellerName: sasLoginReseller.name,
        data: rows,
        fullPayload: buildSasExportPayload(rows),
      });
      setPullResultModalOpen(true);
      setSasLoginReseller(null);
    } catch (err: unknown) {
      setPullLoadingModalOpen(false);
      setPullPanelKind(null);
      setSasBrowserFetchProgress('');
      const msg = err instanceof Error ? err.message : 'فشل تسجيل الدخول';
      showError('فشل تسجيل SAS', msg);
      setSasLoginMode('token');
      setSasLoginModalOpen(true);
    }
  }

  function buildFtthExportBody(r: AgentReseller): FtthSubscribersExportBody | Record<string, never> {
    const o: Record<string, string> = {};
    if (r.baseUrl?.trim()) o.baseUrl = r.baseUrl.trim();
    if (r.username?.trim()) o.username = r.username.trim();
    if (r.password?.trim()) o.password = r.password.trim();
    return Object.keys(o).length ? o : {};
  }

  const exportFtthSubscribersMutation = useMutation({
    mutationFn: (reseller: AgentReseller) =>
      apiService.exportFtthSubscribers({ resellerId: reseller.id }, buildFtthExportBody(reseller)),
    onMutate: () => {
      setPullPanelKind('ftth');
      setPullLoadingModalOpen(true);
    },
    onSuccess: (data, reseller) => {
      setPullLoadingModalOpen(false);
      setPullPanelKind(null);
      const rows = data.data ?? [];
      if (data.error) {
        showError('تصدير FTTH', String(data.error));
        return;
      }
      const exportImportResult = data.import;
      setPullExportSnapshot({
        kind: 'ftth',
        resellerId: reseller.id,
        resellerName: reseller.name,
        data: rows,
        fullPayload: { ...data } as Record<string, unknown>,
        exportImportResult,
      });
      if (exportImportResult) {
        queryClient.invalidateQueries({ queryKey: ['subscribers'] });
        const stats = formatSubscriberImportStats(exportImportResult);
        if ((exportImportResult.errors ?? 0) > 0 && (exportImportResult.imported ?? 0) === 0) {
          showError('تصدير FTTH', stats);
        } else {
          showSuccess('تم جلب وحفظ المشتركين', stats);
        }
      }
      setPullResultModalOpen(true);
    },
    onError: (err: unknown) => {
      setPullLoadingModalOpen(false);
      setPullPanelKind(null);
      const e = err as {
        response?: { status?: number; data?: { error?: string; message?: string; Message?: string } };
      };
      const status = e?.response?.status;
      const bodyErr =
        e?.response?.data?.error ?? e?.response?.data?.message ?? e?.response?.data?.Message;
      let message =
        bodyErr != null && String(bodyErr).trim() !== ''
          ? String(bodyErr)
          : ApiService.showError(err);
      if (!bodyErr) {
        if (status === 401) message = 'انتهت الجلسة أو التوكن غير صالح. يرجى تسجيل الدخول مجدداً.';
        else if (status === 403) message = 'لا صلاحية لك لهذه العملية.';
        else if (status === 400) message = 'طلب غير صالح أو اعتماديات خاطئة.';
      }
      showError('فشل تصدير مشتركي FTTH', message);
    },
  });

  const downloadPullExportJson = () => {
    if (!pullExportSnapshot) return;
    try {
      const blob = new Blob([JSON.stringify(pullExportSnapshot.fullPayload, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const prefix = pullExportSnapshot.kind === 'ftth' ? 'ftth-subscribers' : 'sas-subscribers';
      a.download = `${prefix}-${pullExportSnapshot.resellerId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  };

  const importPullSubscribersMutation = useMutation({
    mutationFn: (payload: { data: unknown[]; kind: 'ftth' | 'sas'; resellerId?: string }) =>
      payload.kind === 'ftth'
        ? apiService.importFtthSubscribers(
            { data: payload.data },
            payload.resellerId ? { resellerId: payload.resellerId } : undefined
          )
        : apiService.importSasSubscribers(
            { data: payload.data },
            payload.resellerId ? { resellerId: payload.resellerId } : undefined
          ),
    onMutate: () => {
      setPullResultModalOpen(false);
      setPullImportModalOpen(true);
      setPullImportProgress(0);
    },
    onSuccess: (res) => {
      setPullImportProgress(100);
      const stats = formatSubscriberImportStats(res);
      const errDetail =
        res.errors && res.errors > 0 && res.errorMessages?.length
          ? res.errorMessages.slice(0, 3).join(' — ')
          : null;
      const noChanges =
        (res.imported ?? 0) === 0 &&
        (res.updated ?? 0) === 0 &&
        (res.phoneUpdated ?? 0) === 0 &&
        (res.skippedDuplicate ?? 0) > 0;
      window.setTimeout(() => {
        setPullImportModalOpen(false);
        setPullExportSnapshot(null);
        setPullResultModalOpen(false);
        if (res.errors && res.errors > 0 && (res.imported ?? 0) === 0 && (res.updated ?? 0) === 0) {
          showError('فشل الاستيراد', errDetail || stats || 'تحقق من الملف والرسيلر.');
        } else if (noChanges) {
          showSuccess(
            'لا تغييرات جديدة',
            'المشتركون موجودون مسبقاً ومطابقون للبيانات المجلوبة. لا حاجة لاستيراد مرة ثانية بعد التصدير.'
          );
        } else {
          showSuccess('تمت المزامنة', [stats, errDetail].filter(Boolean).join(' | ') || 'اكتملت العملية.');
        }
        queryClient.invalidateQueries({ queryKey: ['subscribers'] });
        setPullImportProgress(0);
      }, 900);
    },
    onError: (err: unknown) => {
      setPullImportModalOpen(false);
      setPullImportProgress(0);
      setPullResultModalOpen(true);
      const e = err as { response?: { data?: { error?: string; message?: string } } };
      const msg = e?.response?.data?.error ?? e?.response?.data?.message ?? ApiService.showError(err);
      const title =
        pullExportSnapshot?.kind === 'sas' ? 'فشل استيراد مشتركي SAS' : 'فشل استيراد مشتركي FTTH';
      showError(title, msg);
    },
  });

  useEffect(() => {
    if (!pullImportModalOpen || !importPullSubscribersMutation.isPending) return;
    const id = window.setInterval(() => {
      setPullImportProgress((p) => (p >= 92 ? 92 : p + 2));
    }, 110);
    return () => clearInterval(id);
  }, [pullImportModalOpen, importPullSubscribersMutation.isPending]);

  const createRegionMutation = useMutation({
    mutationFn: (data: AgentRegionCreateRequest) => apiService.createMyRegion(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myRegions'] });
      showSuccess('تم الحفظ', 'تم إضافة المنطقة بنجاح.');
      setRegionFormId(null);
      setShowRegionForm(false);
      setRegionName('');
      setRegionDisplayOrder((prev) => prev + 1);
    },
    onError: (err: any) => showError('خطأ', ApiService.showError(err)),
  });
  const updateRegionMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: AgentRegionUpdateRequest }) => apiService.updateMyRegion(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myRegions'] });
      showSuccess('تم الحفظ', 'تم تحديث المنطقة بنجاح.');
      setRegionFormId(null);
      setShowRegionForm(false);
      setRegionName('');
    },
    onError: (err: any) => showError('خطأ', ApiService.showError(err)),
  });
  const deleteRegionMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteMyRegion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myRegions'] });
      queryClient.invalidateQueries({ queryKey: ['myResellers'] });
      showSuccess('تم الحذف', 'تم حذف المنطقة بنجاح.');
      if (regionFormId) setRegionFormId(null);
    },
    onError: (err: any) => showError('خطأ', ApiService.showError(err)),
  });
  const updateResellerWhatsAppSessionMutation = useMutation({
    mutationFn: ({ resellerId, sessionId }: { resellerId: string; sessionId: string }) =>
      apiService.updateResellerWhatsAppSession(resellerId, { whatsAppSessionId: sessionId.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myResellers'] });
      queryClient.invalidateQueries({ queryKey: ['myRegions'] });
      showSuccess('تم الحفظ', 'تم حفظ معرف جلسة واتساب للرسيلر بنجاح.');
    },
    onError: (err: any) => showError('خطأ', ApiService.showError(err)),
  });

  const createResellerMutation = useMutation({
    mutationFn: (data: AgentResellerCreateRequest) => apiService.createMyReseller(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myResellers'] });
      queryClient.invalidateQueries({ queryKey: ['myRegions'] });
      showSuccess('تم الحفظ', 'تم إضافة الرسيلر بنجاح.');
      setResellerFormId(null);
      setShowResellerForm(false);
      setResellerName('');
      setResellerBaseUrl('');
      setResellerUsername('');
      setResellerTelegramChatId('');
      setResellerPassword('');
      setResellerRegionId('');
      setResellerDisplayOrder((prev) => prev + 1);
    },
    onError: (err: any) => showError('خطأ', ApiService.showError(err)),
  });
  const updateResellerMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: AgentResellerUpdateRequest }) => apiService.updateMyReseller(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myResellers'] });
      queryClient.invalidateQueries({ queryKey: ['myRegions'] });
      showSuccess('تم الحفظ', 'تم تحديث الرسيلر بنجاح.');
      setResellerFormId(null);
      setShowResellerForm(false);
      setResellerName('');
      setResellerBaseUrl('');
      setResellerUsername('');
      setResellerTelegramChatId('');
      setResellerPassword('');
    },
    onError: (err: any) => showError('خطأ', ApiService.showError(err)),
  });
  const deleteResellerMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteMyReseller(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myResellers'] });
      queryClient.invalidateQueries({ queryKey: ['myRegions'] });
      showSuccess('تم الحذف', 'تم حذف الرسيلر بنجاح.');
      if (resellerFormId) setResellerFormId(null);
    },
    onError: (err: any) => showError('خطأ', ApiService.showError(err)),
  });
  const handleOpenRegionEdit = (region: AgentRegion) => {
    setRegionFormId(region.id);
    setShowRegionForm(true);
    setRegionName(region.name);
    setRegionDisplayOrder(region.displayOrder ?? 0);
  };
  const handleSaveRegion = () => {
    if (!regionName.trim()) {
      showError('خطأ', 'اسم المنطقة مطلوب.');
      return;
    }
    if (regionFormId) {
      updateRegionMutation.mutate({
        id: regionFormId,
        data: { name: regionName.trim(), displayOrder: regionDisplayOrder },
      });
    } else {
      createRegionMutation.mutate({ name: regionName.trim(), displayOrder: regionDisplayOrder });
    }
  };
  const handleOpenResellerEdit = (r: AgentReseller) => {
    setResellerFormId(r.id);
    setShowResellerForm(true);
    setResellerName(r.name);
    setResellerServiceType(r.serviceType);
    setResellerBaseUrl(r.baseUrl ?? '');
    setResellerUsername(r.username ?? '');
    setResellerTelegramChatId(r.telegramChatId ?? '');
    setResellerPassword('');
    setResellerDisplayOrder(r.displayOrder ?? 0);
    setResellerRegionId(r.regionId ?? '');
    setResellerFtthPartnerId(r.serviceType === ServiceType.Ftth ? (r.ftthPartnerId ?? '') : '');
  };
  const handleSaveReseller = () => {
    if (!resellerName.trim()) {
      showError('خطأ', 'اسم الرسيلر مطلوب (يُعرض عند اختيار الرسيلر للتفعيل).');
      return;
    }
    if (!resellerBaseUrl.trim()) {
      showError('خطأ', 'رابط الرسيلر (BaseUrl) مطلوب.');
      return;
    }
    if (resellerServiceType === ServiceType.Ftth && !resellerFtthPartnerId.trim()) {
      showError('خطأ', 'معرف الشريك FTTH (partnerId) مطلوب لرسيلر FTTH.');
      return;
    }
    const ftthPartnerIdPayload =
      resellerServiceType === ServiceType.Ftth ? resellerFtthPartnerId.trim() : null;
    if (resellerFormId) {
      updateResellerMutation.mutate({
        id: resellerFormId,
        data: {
          name: resellerName.trim(),
          serviceType: resellerServiceType,
          baseUrl: resellerBaseUrl.trim(),
          username: resellerUsername.trim() || null,
          telegramChatId: resellerTelegramChatId.trim() || null,
          password: resellerPassword.trim() || undefined,
          displayOrder: resellerDisplayOrder,
          ftthPartnerId: ftthPartnerIdPayload,
        },
      });
    } else {
      if (!resellerRegionId.trim()) {
        showError('خطأ', 'اختر المنطقة التي ينتمي إليها الرسيلر.');
        return;
      }
      createResellerMutation.mutate({
        regionId: resellerRegionId.trim(),
        name: resellerName.trim(),
        serviceType: resellerServiceType,
        baseUrl: resellerBaseUrl.trim(),
        username: resellerUsername.trim() || undefined,
        telegramChatId: resellerTelegramChatId.trim() || undefined,
        password: resellerPassword.trim() || undefined,
        displayOrder: resellerDisplayOrder,
        ftthPartnerId: ftthPartnerIdPayload ?? undefined,
      });
    }
  };
  const serviceTypeLabel = (st: ServiceType) => (st === ServiceType.Ftth ? 'FTTH' : st === ServiceType.Sas ? 'SAS' : 'Earthlink');

  const [serviceFeesAgentId, setServiceFeesAgentId] = useState('');
  const [serviceFeeFormId, setServiceFeeFormId] = useState<string | null>(null);
  const [showServiceFeeForm, setShowServiceFeeForm] = useState(false);
  const [serviceFeeName, setServiceFeeName] = useState('');
  const [serviceFeePrice, setServiceFeePrice] = useState('');
  const [serviceFeeResellerIds, setServiceFeeResellerIds] = useState<string[]>([]);

  const { data: serviceFeesAgentsData } = useQuery({
    queryKey: ['agents-list-service-fees'],
    queryFn: () => apiService.getAllAgents({ page: 1, pageSize: 500 }),
    enabled: isAdmin && activeSection === 'serviceFees',
  });
  const serviceFeesAgents = serviceFeesAgentsData?.data ?? [];

  const { data: serviceFeesList = [], isLoading: serviceFeesLoading } = useQuery<ServiceFees[]>({
    queryKey: ['serviceFees', isAdmin ? serviceFeesAgentId : 'me'],
    queryFn: () => apiService.getServiceFees(isAdmin ? serviceFeesAgentId || undefined : undefined),
    enabled: canViewServiceFees && activeSection === 'serviceFees' && (!isAdmin || !!serviceFeesAgentId),
  });

  const { data: serviceFeesResellers = [] } = useQuery<AgentReseller[]>({
    queryKey: ['serviceFeesResellers', isAdmin ? serviceFeesAgentId : 'me'],
    queryFn: () =>
      isAdmin
        ? apiService.getAgentResellers(serviceFeesAgentId)
        : apiService.getMyResellers(),
    enabled:
      canViewServiceFees &&
      activeSection === 'serviceFees' &&
      (!isAdmin || !!serviceFeesAgentId),
  });

  const createServiceFeeMutation = useMutation({
    mutationFn: (data: ServiceFeesCreateRequest) => apiService.createServiceFee(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceFees'] });
      showSuccess('تم الحفظ', 'تمت إضافة أجور الخدمة بنجاح.');
      setServiceFeeFormId(null);
      setShowServiceFeeForm(false);
      setServiceFeeName('');
      setServiceFeePrice('');
      setServiceFeeResellerIds([]);
    },
    onError: (err: any) => showError('خطأ', ApiService.showError(err)),
  });

  const updateServiceFeeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ServiceFeesUpdateRequest }) =>
      apiService.updateServiceFee(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceFees'] });
      showSuccess('تم الحفظ', 'تم تحديث أجور الخدمة بنجاح.');
      setServiceFeeFormId(null);
      setShowServiceFeeForm(false);
      setServiceFeeName('');
      setServiceFeePrice('');
      setServiceFeeResellerIds([]);
    },
    onError: (err: any) => showError('خطأ', ApiService.showError(err)),
  });

  const deleteServiceFeeMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteServiceFee(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceFees'] });
      showSuccess('تم الحذف', 'تم حذف أجور الخدمة بنجاح.');
      if (serviceFeeFormId) setServiceFeeFormId(null);
    },
    onError: (err: any) => showError('خطأ', ApiService.showError(err)),
  });

  const handleOpenServiceFeeEdit = (fee: ServiceFees) => {
    setServiceFeeFormId(fee.id);
    setShowServiceFeeForm(true);
    setServiceFeeName(fee.name);
    setServiceFeePrice(String(fee.price));
    setServiceFeeResellerIds(fee.resellerIds ?? []);
  };

  const toggleServiceFeeReseller = (resellerId: string) => {
    setServiceFeeResellerIds((prev) =>
      prev.includes(resellerId) ? prev.filter((id) => id !== resellerId) : [...prev, resellerId],
    );
  };

  const serviceFeeResellerNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of serviceFeesResellers) {
      map.set(r.id, r.regionName ? `${r.name} (${r.regionName})` : r.name);
    }
    return map;
  }, [serviceFeesResellers]);

  const formatServiceFeeResellers = (fee: ServiceFees) => {
    const ids = fee.resellerIds ?? [];
    if (ids.length === 0) return '— لا يُطبَّق على أي رسيلر —';
    return ids
      .map((id) => serviceFeeResellerNameById.get(id) ?? id.slice(0, 8))
      .join('، ');
  };

  const handleSaveServiceFee = () => {
    if (!serviceFeeName.trim()) {
      showError('خطأ', 'اسم الخدمة مطلوب.');
      return;
    }
    const price = Number(serviceFeePrice);
    if (!Number.isFinite(price) || price < 0) {
      showError('خطأ', 'أدخل سعراً صحيحاً (0 أو أكثر).');
      return;
    }
    if (serviceFeeFormId) {
      updateServiceFeeMutation.mutate({
        id: serviceFeeFormId,
        data: { name: serviceFeeName.trim(), price, resellerIds: serviceFeeResellerIds },
      });
    } else {
      if (isAdmin && !serviceFeesAgentId.trim()) {
        showError('خطأ', 'اختر الوكيل أولاً.');
        return;
      }
      createServiceFeeMutation.mutate({
        name: serviceFeeName.trim(),
        price,
        agentId: isAdmin ? serviceFeesAgentId.trim() : undefined,
        resellerIds: serviceFeeResellerIds,
      });
    }
  };

  const [customMessageTemplate, setCustomMessageTemplate] = useState('');
  const { data: customMessageData } = useQuery({
    queryKey: ['customMessage'],
    queryFn: () => apiService.getCustomMessage(),
    enabled: isAgentOrSubAgent,
  });
  useEffect(() => {
    if (customMessageData?.template != null) setCustomMessageTemplate(customMessageData.template);
  }, [customMessageData]);

  useEffect(() => {
    if (!sasSyncLoading) {
      if (sasSyncStepIntervalRef.current) {
        clearInterval(sasSyncStepIntervalRef.current);
        sasSyncStepIntervalRef.current = null;
      }
      return;
    }
    setSasSyncStepIndex(0);
    sasSyncStepIntervalRef.current = setInterval(() => {
      setSasSyncStepIndex((i) => (i + 1) % SAS_SYNC_STEPS.length);
    }, 2200);
    return () => {
      if (sasSyncStepIntervalRef.current) {
        clearInterval(sasSyncStepIntervalRef.current);
        sasSyncStepIntervalRef.current = null;
      }
    };
  }, [sasSyncLoading]);

  const saveActivationMutation = useMutation({
    mutationFn: (template: string) => apiService.setActivationMessage(template),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activationMessage'] });
    },
    onError: (err: any) => showError('خطأ', ApiService.showError(err)),
  });
  const saveAlertMutation = useMutation({
    mutationFn: (template: string) => apiService.setAlertMessage(template),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alertMessage'] });
    },
    onError: (err: any) => showError('خطأ', ApiService.showError(err)),
  });
  const saveDetailsMutation = useMutation({
    mutationFn: (template: string) => apiService.setDetailsMessage(template),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['detailsMessage'] });
    },
    onError: (err: any) => showError('خطأ', ApiService.showError(err)),
  });
  const saveCustomMessageMutation = useMutation({
    mutationFn: (template: string) => apiService.setCustomMessage(template),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customMessage'] });
      showSuccess('تم الحفظ', 'تم حفظ قالب رسالة خاصة بنجاح.');
    },
    onError: (err: any) => showError('خطأ', ApiService.showError(err)),
  });

  const handleSaveSettings = async () => {
    setIsLoading(true);
    setActivationMessageSettings(user?.id ?? '', {
      mode: activationMessageMode,
      template: activationTemplate,
      customText: activationCustomText,
    });
    try {
      const normalizeActivationTemplateForBackend = (template: string, customText: string): string => {
        let out = String(template || '');
        // Replace legacy CustomText placeholder with actual text (backend doesn't know this value)
        out = out.replace(/\{\{\s*customText\s*\}\}/gi, customText || '');
        out = out.replace(/\{\{\s*CustomText\s*\}\}/g, customText || '');
        // Normalize placeholders to backend-style (PascalCase)
        out = out.replace(/\{\{\s*subscriberName\s*\}\}/gi, '{{SubscriberName}}');
        out = out.replace(/\{\{\s*subscriberPhone\s*\}\}/gi, '{{SubscriberPhone}}');
        out = out.replace(/\{\{\s*activationDate\s*\}\}/gi, '{{ActivationDate}}');
        out = out.replace(/\{\{\s*expirationDate\s*\}\}/gi, '{{ExpirationDate}}');
        out = out.replace(/\{\{\s*daysUntilExpiry\s*\}\}/gi, '{{DaysUntilExpiry}}');
        out = out.replace(/\{\{\s*profileName\s*\}\}/gi, '{{ProfileName}}');
        // Company name variants → AgentCompanyName (recommended)
        out = out.replace(/\{\{\s*companyName\s*\}\}/gi, '{{AgentCompanyName}}');
        out = out.replace(/\{\{\s*agentCompanyName\s*\}\}/gi, '{{AgentCompanyName}}');
        out = out.replace(/\{\{\s*CompanyName\s*\}\}/g, '{{AgentCompanyName}}');
        // Also normalize already-pascal tokens (no-op but consistent)
        out = out.replace(/\{\{\s*SubscriberName\s*\}\}/g, '{{SubscriberName}}');
        out = out.replace(/\{\{\s*SubscriberPhone\s*\}\}/g, '{{SubscriberPhone}}');
        out = out.replace(/\{\{\s*PhoneNumber\s*\}\}/g, '{{PhoneNumber}}');
        out = out.replace(/\{\{\s*ActivationDate\s*\}\}/g, '{{ActivationDate}}');
        out = out.replace(/\{\{\s*ExpirationDate\s*\}\}/g, '{{ExpirationDate}}');
        out = out.replace(/\{\{\s*DaysUntilExpiry\s*\}\}/g, '{{DaysUntilExpiry}}');
        out = out.replace(/\{\{\s*ProfileName\s*\}\}/g, '{{ProfileName}}');
        out = out.replace(/\{\{\s*AgentCompanyName\s*\}\}/g, '{{AgentCompanyName}}');
        out = out.replace(/\{\{\s*debtDueDate\s*\}\}/gi, '{{DebtDueDate}}');
        out = out.replace(/\{\{\s*debtAmount\s*\}\}/gi, '{{DebtAmount}}');
        return out;
      };

      if (activationMessageMode === 'custom' && activationTemplate.trim()) {
        const tpl = normalizeActivationTemplateForBackend(activationTemplate.trim(), activationCustomText.trim());
        await saveActivationMutation.mutateAsync(tpl);
      }
      if (alertMessageMode === 'custom' && alertTemplate.trim()) {
        await saveAlertMutation.mutateAsync(alertTemplate.trim());
      }
      if (activeSection === 'details') {
        const tpl = detailsMessageMode === 'custom' ? detailsTemplate.trim() : DEFAULT_DETAILS_TEMPLATE.trim();
        await saveDetailsMutation.mutateAsync(tpl);
      }
      showSuccess('تم الحفظ', 'تم حفظ الإعدادات بنجاح.');
    } catch (_) {
      // Errors already shown by mutation onError
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-screen">
        <WifiLoaderComponent
          background="transparent"
          desktopSize="150px"
          mobileSize="150px"
          text="حفظ الإعدادات..."
          backColor="#E8F2FC"
          frontColor="#4645F6"
        />
      </div>
    );
  }

  return (
    <>
    {showSasSyncPromoModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-[fadeIn_0.4s_ease-out]">
          <div className="absolute inset-0 pointer-events-none opacity-10 bg-[radial-gradient(circle_at_top,_#22c55e,_transparent_60%),radial-gradient(circle_at_bottom,_#3b82f6,_transparent_55%)]" />
          <div className="relative p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-sky-500 flex items-center justify-center text-white animate-[pulse_2s_infinite]">
                  <CloudDownload className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    جار مزامنة المشتركين
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    عملية السحب والمعالجة قد تستغرق عدة دقائق حسب عدد المشتركين وسرعة الاتصال.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSasSyncPromoModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-xl border border-gray-200/70 dark:border-gray-700/70 bg-gray-50/80 dark:bg-gray-800/70 p-4 space-y-2">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                مميزات نظام <span className="text-primary-600 dark:text-primary-400 font-semibold">Wakeel</span>
              </p>
              <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1 list-disc pr-4">
                <li>مزامنة مشتركين SAS مع قاعدة بيانات موحدة تسهّل البحث وإعداد التقارير.</li>
                <li>إنشاء فواتير التفعيل والتجديد تلقائياً مع سجل تفصيلي لكل مشترك.</li>
                <li>إدارة الديون والمدفوعات وتتبع رصيد الوكيل بدقة وشفافية.</li>
                <li>لوحات تحكم وتقارير تفاعلية لمتابعة أداء الشبكة والوكلاء.</li>
              </ul>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>جاري معالجة بيانات المشتركين في الخلفية...</span>
                <span>قد يستغرق حتى 5 دقائق</span>
              </div>
              <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 via-sky-500 to-emerald-400 animate-[progressSlide_2s_linear_infinite]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          الإعدادات
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          إدارة إعدادات النظام والحساب
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* المحتوى — يظهر على اليسار (القائمة على اليمين في RTL) */}
        <div className="lg:col-span-2 order-2 lg:order-2">
          {/* Profile Settings */}
          {activeSection === 'profile' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center space-x-3 mb-6">
              <User className="h-6 w-6 text-primary-600 dark:text-primary-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                الملف الشخصي
              </h2>
            </div>

            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <div className="w-20 h-20 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
                  <span className="text-primary-600 dark:text-primary-400 text-2xl font-semibold">
                    {user?.fullName?.charAt(0) ?? ''}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    {user?.fullName}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    @{user?.username}
                  </p>
                  {isAgentOrSubAgent && myAgent && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      اسم الشركة الحالي: <span className="font-semibold">{myAgent.companyName}</span>
                    </p>
                  )}
                </div>
              </div>

              {isAgentOrSubAgent && myAgent && (
                <div className="mt-6 border-t border-gray-200 dark:border-gray-600 pt-4">
                  <h3 className="text-base font-medium text-gray-900 dark:text-white mb-2">
                    تعديل اسم الشركة
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                    يمكن للوكيل أو المدير الثانوي تحديث اسم الشركة الظاهر في النظام وفي رسائل التنبيه.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        اسم الشركة
                      </label>
                      <input
                        type="text"
                        value={agentCompanyName}
                        onChange={(e) => setAgentCompanyName(e.target.value)}
                        placeholder={myAgent.companyName || 'اسم الشركة'}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const trimmed = agentCompanyName.trim();
                        if (!trimmed) {
                          showError('خطأ', 'يرجى إدخال اسم الشركة.');
                          return;
                        }
                        updateAgentCompanyNameMutation.mutate(trimmed);
                      }}
                      disabled={updateAgentCompanyNameMutation.isPending}
                      className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Save className="h-4 w-4" />
                      <span>{updateAgentCompanyNameMutation.isPending ? 'جاري الحفظ...' : 'حفظ اسم الشركة'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* تغيير بيانات الدخول — للوكيل والمدير الثانوي فقط */}
              {isAgentOrSubAgent && (
                <div className="border-t border-gray-200 dark:border-gray-600 pt-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <Key className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                    <h3 className="text-base font-medium text-gray-900 dark:text-white">
                      تغيير بيانات الدخول
                    </h3>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    كلمة المرور الحالية مطلوبة للتحقق. يمكنك تغيير اسم المستخدم و/أو كلمة المرور (4 أحرف على الأقل).
                  </p>
                  <form
                    className="space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const current = credentialsCurrentPassword.trim();
                      const newUser = credentialsNewUsername.trim();
                      const newPass = credentialsNewPassword;
                      const confirm = credentialsConfirmPassword;
                      if (!current) {
                        showError('خطأ', 'أدخل كلمة المرور الحالية');
                        return;
                      }
                      if (!newUser && !newPass) {
                        showError('خطأ', 'يجب إدخال اسم المستخدم الجديد أو كلمة المرور الجديدة');
                        return;
                      }
                      if (newPass && newPass.length < 4) {
                        showError('خطأ', 'كلمة المرور الجديدة 4 أحرف على الأقل');
                        return;
                      }
                      if (newPass && newPass !== confirm) {
                        showError('خطأ', 'كلمة المرور الجديدة وتأكيدها غير متطابقتين');
                        return;
                      }
                      const payload: UpdateMyCredentialsRequest = {
                        currentPassword: current,
                      };
                      if (newUser) payload.newUsername = newUser;
                      if (newPass) {
                        payload.newPassword = newPass;
                        payload.confirmNewPassword = confirm;
                      }
                      updateMyCredentialsMutation.mutate(payload);
                    }}
                  >
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        كلمة المرور الحالية *
                      </label>
                      <input
                        type="password"
                        value={credentialsCurrentPassword}
                        onChange={(e) => setCredentialsCurrentPassword(e.target.value)}
                        placeholder="كلمة المرور الحالية"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                        autoComplete="current-password"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        اسم المستخدم الجديد (اختياري)
                      </label>
                      <input
                        type="text"
                        value={credentialsNewUsername}
                        onChange={(e) => setCredentialsNewUsername(e.target.value)}
                        placeholder={user?.username ?? 'اسم المستخدم الجديد'}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                        autoComplete="username"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        كلمة المرور الجديدة (اختياري، 4 أحرف على الأقل)
                      </label>
                      <div className="relative">
                        <input
                          type={showCredentialsNewPassword ? 'text' : 'password'}
                          value={credentialsNewPassword}
                          onChange={(e) => setCredentialsNewPassword(e.target.value)}
                          placeholder="كلمة المرور الجديدة"
                          className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          onClick={() => setShowCredentialsNewPassword(!showCredentialsNewPassword)}
                        >
                          {showCredentialsNewPassword ? (
                            <EyeOff className="h-5 w-5 text-gray-400" />
                          ) : (
                            <Eye className="h-5 w-5 text-gray-400" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        تأكيد كلمة المرور الجديدة
                      </label>
                      <input
                        type="password"
                        value={credentialsConfirmPassword}
                        onChange={(e) => setCredentialsConfirmPassword(e.target.value)}
                        placeholder="تأكيد كلمة المرور الجديدة"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                        autoComplete="new-password"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={updateMyCredentialsMutation.isPending}
                      className="flex items-center space-x-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Save className="h-4 w-4" />
                      <span>{updateMyCredentialsMutation.isPending ? 'جاري الحفظ...' : 'تحديث بيانات الدخول'}</span>
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Theme Settings */}
          {activeSection === 'theme' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center space-x-3 mb-6">
              <Settings className="h-6 w-6 text-primary-600 dark:text-primary-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                المظهر
              </h2>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                الثيم
              </label>
              <div className="grid grid-cols-3 gap-4">
                <button
                  onClick={() => setTheme('light')}
                  className={`p-4 rounded-lg border-2 transition-colors ${
                    theme === 'light'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <div className="w-full h-8 bg-white rounded mb-2"></div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">نهاري</span>
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`p-4 rounded-lg border-2 transition-colors ${
                    theme === 'dark'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <div className="w-full h-8 bg-gray-800 rounded mb-2"></div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">ليلي</span>
                </button>
                <button
                  onClick={() => setTheme('system')}
                  className={`p-4 rounded-lg border-2 transition-colors ${
                    theme === 'system'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <div className="w-full h-8 bg-gradient-to-r from-white to-gray-800 rounded mb-2"></div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">نظام</span>
                </button>
              </div>
            </div>
          </div>
          )}

          {/* Activation Message Settings */}
          {activeSection === 'activation' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center space-x-3 mb-6">
              <MessageSquare className="h-6 w-6 text-primary-600 dark:text-primary-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                إعدادات رسالة التفعيل
              </h2>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              اختر إما الرسالة الافتراضية (المُستخدمة في النظام) أو صياغة رسالة مخصصة تُرسل للمشترك عند التفعيل (مثلاً عبر واتساب).
            </p>
            <div className="space-y-4">
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="activationMessageMode"
                    checked={activationMessageMode === 'default'}
                    onChange={() => setActivationMessageMode('default')}
                    className="text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-gray-700 dark:text-gray-300">الرسالة الافتراضية</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="activationMessageMode"
                    checked={activationMessageMode === 'custom'}
                    onChange={() => setActivationMessageMode('custom')}
                    className="text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-gray-700 dark:text-gray-300">رسالة مخصصة</span>
                </label>
              </div>

              {activationMessageMode === 'custom' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      إدراج عناصر في الرسالة
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {PLACEHOLDERS.map((p) => (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => insertPlaceholder(p.token)}
                          className="px-3 py-1.5 text-sm rounded-md bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200"
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      نص الرسالة المخصصة
                    </label>
                    <textarea
                      ref={activationTemplateRef}
                      value={activationTemplate}
                      onChange={(e) => setActivationTemplate(e.target.value)}
                      rows={6}
                      placeholder={DEFAULT_ACTIVATION_TEMPLATE}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      النص المخصص (يُدرج مكان &quot;نص مخصص&quot; في الرسالة)
                    </label>
                    <input
                      type="text"
                      value={activationCustomText}
                      onChange={(e) => setActivationCustomText(e.target.value)}
                      placeholder="مثال: شكراً لثقتكم"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
          )}

          {/* رسالة تنبيه الاشتراك (انتهاء الاشتراك) */}
          {activeSection === 'alert' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center space-x-3 mb-6">
              <MessageSquare className="h-6 w-6 text-primary-600 dark:text-primary-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                رسالة تنبيه الاشتراك
              </h2>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              قالب الرسالة المُرسلة عند اختيار «رسالة تنبيه الاشتراك» من إجراءات المشتركين. اختر الافتراضية أو صياغة مخصصة.
            </p>
            <div className="space-y-4">
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="alertMessageMode"
                    checked={alertMessageMode === 'default'}
                    onChange={() => setAlertMessageMode('default')}
                    className="text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-gray-700 dark:text-gray-300">الرسالة الافتراضية</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="alertMessageMode"
                    checked={alertMessageMode === 'custom'}
                    onChange={() => setAlertMessageMode('custom')}
                    className="text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-gray-700 dark:text-gray-300">رسالة مخصصة</span>
                </label>
              </div>

              {alertMessageMode === 'custom' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      إدراج عناصر في الرسالة
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {ALERT_PLACEHOLDERS.map((p) => (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => insertAlertPlaceholder(p.token)}
                          className="px-3 py-1.5 text-sm rounded-md bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200"
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      نص رسالة تنبيه الاشتراك المخصصة
                    </label>
                    <textarea
                      ref={alertTemplateRef}
                      value={alertTemplate}
                      onChange={(e) => setAlertTemplate(e.target.value)}
                      rows={6}
                      placeholder={DEFAULT_ALERT_TEMPLATE}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
          )}

          {/* رسالة الدين او التفاصيل */}
          {activeSection === 'details' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center space-x-3 mb-6">
                <MessageSquare className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  رسالة تفاصيل المشترك
                </h2>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                قالب الرسالة المُرسلة عند اختيار «إرسال دين او التفاصيل». يمكنك استخدام القالب الافتراضي أو كتابة قالب مخصص.
              </p>

              <div className="space-y-4">
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="detailsMessageMode"
                      checked={detailsMessageMode === 'default'}
                      onChange={() => setDetailsMessageMode('default')}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-gray-700 dark:text-gray-300">الرسالة الافتراضية</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="detailsMessageMode"
                      checked={detailsMessageMode === 'custom'}
                      onChange={() => setDetailsMessageMode('custom')}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-gray-700 dark:text-gray-300">رسالة مخصصة</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    إدراج عناصر في الرسالة
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {DETAILS_PLACEHOLDERS.map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => insertDetailsPlaceholder(p.token)}
                        className="px-3 py-1.5 text-sm rounded-md bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    نص رسالة الدين او التفاصيل
                  </label>
                  <textarea
                    ref={detailsTemplateRef}
                    value={detailsMessageMode === 'custom' ? detailsTemplate : DEFAULT_DETAILS_TEMPLATE}
                    onChange={(e) => setDetailsTemplate(e.target.value)}
                    rows={8}
                    placeholder={DEFAULT_DETAILS_TEMPLATE}
                    disabled={detailsMessageMode !== 'custom'}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white disabled:opacity-70"
                  />
                </div>
              </div>
            </div>
          )}

          {/* إعدادات تطبيق المشترك — طرق الدفع ورقم البطاقة/عنوان المكتب */}
          {isAgentOrSubAgent && activeSection === 'subscriberApp' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3 mb-6">
                <Smartphone className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  إعدادات تطبيق المشترك
                </h2>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                هذه الإعدادات تظهر للمشترك عند تسجيل الدخول في تطبيق معلومات الاشتراك (طريقة الدفع ورقم البطاقة أو عنوان المكتب).
              </p>
              {appSettingsLoading ? (
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  <span>جاري تحميل الإعدادات...</span>
                </div>
              ) : (
                <div className="space-y-6 max-w-md">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    فعّل أي مجموعة من طرق الدفع واملأ الحقل المناسب لكل واحدة. تظهر للمشترك فقط الطرق المفعلة التي تحتوي على تفاصيل.
                  </p>
                  <div className="flex flex-col gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={zainCashEnabled}
                        onChange={(e) => setZainCashEnabled(e.target.checked)}
                        className="rounded text-primary-600 focus:ring-primary-500"
                      />
                      <span className="font-medium text-gray-700 dark:text-gray-300">زين كاش</span>
                    </label>
                    {zainCashEnabled && (
                      <input
                        type="text"
                        value={zainCashNumber}
                        onChange={(e) => setZainCashNumber(e.target.value)}
                        placeholder="رقم زين كاش (مثال: 07801234567)"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                      />
                    )}
                  </div>
                  <div className="flex flex-col gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={masterCardEnabled}
                        onChange={(e) => setMasterCardEnabled(e.target.checked)}
                        className="rounded text-primary-600 focus:ring-primary-500"
                      />
                      <span className="font-medium text-gray-700 dark:text-gray-300">ماستر كارد</span>
                    </label>
                    {masterCardEnabled && (
                      <input
                        type="text"
                        value={masterCardNumber}
                        onChange={(e) => setMasterCardNumber(e.target.value)}
                        placeholder="رقم البطاقة"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                      />
                    )}
                  </div>
                  <div className="flex flex-col gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cashEnabled}
                        onChange={(e) => setCashEnabled(e.target.checked)}
                        className="rounded text-primary-600 focus:ring-primary-500"
                      />
                      <span className="font-medium text-gray-700 dark:text-gray-300">نقد</span>
                    </label>
                    {cashEnabled && (
                      <input
                        type="text"
                        value={cashOfficeAddress}
                        onChange={(e) => setCashOfficeAddress(e.target.value)}
                        placeholder="عنوان المكتب (استلام الدفع نقداً)"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveAppSettings}
                    disabled={updateAppSettingsMutation.isPending}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    {updateAppSettingsMutation.isPending ? 'جاري الحفظ...' : 'حفظ إعدادات تطبيق المشترك'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* إعلانات تطبيق المشترك — قائمة إعلانات تظهر في كروت المشترك */}
          {isAgentOrSubAgent && activeSection === 'subscriberAnnouncement' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3 mb-6">
                <Megaphone className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  إعلانات تطبيق المشترك
                </h2>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                الإعلانات تظهر للمشترك في الكروت المتحركة في صفحة معلومات الاشتراك (من الأحدث للأقدم). إن لم تضف أي إعلان ستظهر النصوص الافتراضية.
              </p>
              {announcementLoading ? (
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  <span>جاري تحميل الإعلانات...</span>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-wrap gap-2">
                    {agentAnnouncements.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-600 p-3 bg-gray-50 dark:bg-gray-700/50 min-w-0 max-w-full"
                      >
                        <div className="flex-1 min-w-0 text-right">
                          <div className="font-medium text-gray-900 dark:text-white truncate">{a.mainTitle || '—'}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                            {[a.subTitle, a.phone].filter(Boolean).join(' — ') || '—'}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenEditAnnouncement(a)}
                            className="p-2 rounded-md text-primary-600 hover:bg-primary-100 dark:hover:bg-primary-900/30"
                            title="تعديل"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAnnouncement(a.id)}
                            disabled={deleteAnnouncementMutation.isPending}
                            className="p-2 rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="حذف"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {announcementEditingId === null ? (
                    <button
                      type="button"
                      onClick={handleStartAddAnnouncement}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium"
                    >
                      <Megaphone className="h-4 w-4" />
                      إضافة إعلان
                    </button>
                  ) : null}

                  {announcementEditingId !== null && (
                    <div className="space-y-4 max-w-md pt-4 border-t border-gray-200 dark:border-gray-600">
                      <h3 className="text-base font-medium text-gray-900 dark:text-white">
                        {announcementEditingId === '' ? 'إعلان جديد' : 'تعديل الإعلان'}
                      </h3>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">العنوان الرئيسي</label>
                        <input
                          type="text"
                          value={announcementMainTitle}
                          onChange={(e) => setAnnouncementMainTitle(e.target.value)}
                          placeholder="مثال: عروض خاصة على تجديد الاشتراك"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">عنوان فرعي</label>
                        <input
                          type="text"
                          value={announcementSubTitle}
                          onChange={(e) => setAnnouncementSubTitle(e.target.value)}
                          placeholder="مثال: خصم 10% عند الدفع مقدماً"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">رقم الهاتف</label>
                        <input
                          type="text"
                          value={announcementPhone}
                          onChange={(e) => setAnnouncementPhone(e.target.value)}
                          placeholder="مثال: 0770xxxxxxx"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">لون بداية الكارت</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={announcementGradientStart}
                              onChange={(e) => setAnnouncementGradientStart(e.target.value)}
                              className="h-10 w-14 rounded border border-gray-300 dark:border-gray-600 cursor-pointer p-0"
                            />
                            <input
                              type="text"
                              value={announcementGradientStart}
                              onChange={(e) => setAnnouncementGradientStart(e.target.value)}
                              placeholder="#2962FF"
                              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 dark:bg-gray-700 dark:text-white text-sm"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">لون نهاية الكارت</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={announcementGradientEnd}
                              onChange={(e) => setAnnouncementGradientEnd(e.target.value)}
                              className="h-10 w-14 rounded border border-gray-300 dark:border-gray-600 cursor-pointer p-0"
                            />
                            <input
                              type="text"
                              value={announcementGradientEnd}
                              onChange={(e) => setAnnouncementGradientEnd(e.target.value)}
                              placeholder="#1E40AF"
                              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 dark:bg-gray-700 dark:text-white text-sm"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={handleSaveAnnouncement}
                          disabled={createAnnouncementMutation.isPending || updateAnnouncementMutation.isPending}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium disabled:opacity-60"
                        >
                          <Save className="h-4 w-4" />
                          {createAnnouncementMutation.isPending || updateAnnouncementMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEditAnnouncement}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {canUpdateSubscriberPhones && activeSection === 'subscriberPhones' && (
            <SubscriberPhonesUpdateSection isAdmin={isAdmin} />
          )}

          {isAgentOrSubAgent && activeSection === 'subscriberExcelImport' && (
            <SubscriberExcelImportSection />
          )}
          {isAgentOrSubAgent && activeSection === 'activationExcelImport' && (
            <ActivationExcelImportSection />
          )}

          {/* قالب رسالة خاصة — للوكيل/الموظف، يُرسل كما هو لأي مشترك بدون مكانات */}
          {isAgentOrSubAgent && activeSection === 'customMessage' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center space-x-3 mb-6">
                <MessageSquare className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  قالب رسالة خاصة
                </h2>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                نص واحد لكل وكيل (حتى 2000 حرف). يُرسل كما هو لأي مشترك عبر واتساب بدون تعبئة مكانات (مثل التفعيل أو التنبيه). احفظ القالب ثم اختر «إرسال رسالة حر» من إجراءات المشترك.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  نص القالب
                </label>
                <textarea
                  value={customMessageTemplate}
                  onChange={(e) => setCustomMessageTemplate(e.target.value)}
                  maxLength={2000}
                  rows={8}
                  placeholder="مثال: مرحباً، هذه رسالة مخصصة للمشترك."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {customMessageTemplate.length} / 2000 حرف
                </p>
              </div>
              <div className="flex justify-end mt-4">
                <button
                  type="button"
                  onClick={() => saveCustomMessageMutation.mutate(customMessageTemplate)}
                  disabled={saveCustomMessageMutation.isPending}
                  className="flex items-center space-x-2 px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  <span>{saveCustomMessageMutation.isPending ? 'جاري الحفظ...' : 'حفظ القالب'}</span>
                </button>
              </div>
            </div>
          )}

          {/* المناطق والرسيلرز — إدارة المناطق وروابط SAS/FTTH/Earthlink */}
          {isAgentOrSubAgent && activeSection === 'resellers' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-8">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex items-center space-x-3">
                    <Store className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">المناطق</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setRegionFormId(null);
                      setShowRegionForm(true);
                      setRegionName('');
                      setRegionDisplayOrder(myRegions.length);
                    }}
                    className="flex items-center gap-2 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm"
                  >
                    <Plus className="h-4 w-4" />
                    إضافة منطقة
                  </button>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  أنشئ المنطقة أولاً (مثل: الكرخ)، ثم أضف رسيلر SAS أو FTTH داخلها.
                </p>
                {regionsLoading ? (
                  <div className="py-4 text-gray-500 dark:text-gray-400">جاري تحميل المناطق...</div>
                ) : (
                  <div className="space-y-3">
                    <ul className="divide-y divide-gray-200 dark:divide-gray-600">
                      {[...myRegions].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)).map((region) => (
                        <li key={region.id} className="py-3 flex items-center justify-between gap-4">
                          <div>
                            <span className="font-medium text-gray-900 dark:text-white">{region.name}</span>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {(region.resellers?.length ?? myResellers.filter((r) => r.regionId === region.id).length) || 0} رسيلر
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenRegionEdit(region)}
                              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                              title="تعديل"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => window.confirm('حذف هذه المنطقة؟') && deleteRegionMutation.mutate(region.id)}
                              className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                              title="حذف"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                    {myRegions.length === 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">لم تُضف أي منطقة بعد. اضغط «إضافة منطقة».</p>
                    )}
                    {showRegionForm && (
                      <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{regionFormId ? 'تعديل المنطقة' : 'إضافة منطقة'}</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">اسم المنطقة *</label>
                            <input
                              type="text"
                              value={regionName}
                              onChange={(e) => setRegionName(e.target.value)}
                              placeholder="مثل: الكرخ"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">ترتيب العرض</label>
                            <input
                              type="number"
                              min={0}
                              value={regionDisplayOrder}
                              onChange={(e) => setRegionDisplayOrder(parseInt(e.target.value, 10) || 0)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button
                            type="button"
                            onClick={handleSaveRegion}
                            disabled={createRegionMutation.isPending || updateRegionMutation.isPending}
                            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm disabled:opacity-50"
                          >
                            {regionFormId ? 'حفظ التعديل' : 'إضافة'}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setRegionFormId(null); setShowRegionForm(false); }}
                            className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg text-sm"
                          >
                            إلغاء
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">الرسيلرز والروابط</h2>
                  <button
                    type="button"
                    onClick={() => {
                      setResellerFormId(null);
                      setShowResellerForm(true);
                      setResellerName('');
                      setResellerServiceType(ServiceType.Sas);
                      setResellerBaseUrl('');
                      setResellerUsername('');
                      setResellerTelegramChatId('');
                      setResellerPassword('');
                      setResellerRegionId(myRegions[0]?.id ?? '');
                      setResellerDisplayOrder(myResellers.length);
                      setResellerFtthPartnerId('');
                    }}
                    disabled={myRegions.length === 0}
                    className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    إضافة رسيلر
                  </button>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  لرسيلر SAS: شغّل محلياً <span className="font-mono text-xs">sas_fetch_users.py -o subscribers-export.json</span> ثم اضغط «من ملف» لرفع JSON والاستيراد.
                </p>
                {resellersLoading ? (
                  <div className="py-4 text-gray-500 dark:text-gray-400">جاري تحميل الرسيلرز...</div>
                ) : (
                  <div className="space-y-4">
                    {[...myRegions].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)).map((region) => {
                      const regionResellers = (region.resellers?.length
                        ? region.resellers
                        : myResellers.filter((r) => r.regionId === region.id)
                      ).slice().sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
                      if (regionResellers.length === 0) return null;
                      return (
                        <div key={region.id}>
                          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{region.name}</h3>
                          <ul className="divide-y divide-gray-200 dark:divide-gray-600 border border-gray-200 dark:border-gray-600 rounded-lg">
                            {regionResellers.map((r) => (
                              <li key={r.id} className="py-3 px-3 flex items-center justify-between gap-4">
                                <div>
                                  <span className="font-medium text-gray-900 dark:text-white">{r.name}</span>
                                  <span className="mr-2 text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                    {serviceTypeLabel(r.serviceType)}
                                  </span>
                                  {r.whatsAppSessionId?.trim() && (
                                    <span className="mr-2 text-xs px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                      واتساب
                                    </span>
                                  )}
                                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{r.baseUrl}</p>
                                  {r.serviceType === ServiceType.Ftth && r.ftthPartnerId?.trim() && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                      partnerId: {r.ftthPartnerId}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-wrap justify-end">
                                  {(r.serviceType === ServiceType.Sas || r.serviceType === ServiceType.Earthlink) && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => openSasLoginModal(r)}
                                        disabled={
                                          exportFtthSubscribersMutation.isPending ||
                                          pullLoadingModalOpen ||
                                          pullImportModalOpen ||
                                          sasLoginModalOpen
                                        }
                                        className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-md disabled:opacity-50 flex items-center gap-1"
                                        title="جلب من لوحة SAS عبر المتصفح"
                                      >
                                        <CloudDownload className="h-3 w-3" />
                                        <span>SAS</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => openSasImportFromFile(r)}
                                        disabled={
                                          exportFtthSubscribersMutation.isPending ||
                                          pullLoadingModalOpen ||
                                          pullImportModalOpen ||
                                          sasLoginModalOpen ||
                                          importPullSubscribersMutation.isPending
                                        }
                                        className="px-3 py-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-md disabled:opacity-50 flex items-center gap-1"
                                        title="رفع subscribers-export.json من sas_fetch_users.py المحلي"
                                      >
                                        <Upload className="h-3 w-3" />
                                        <span>من ملف</span>
                                      </button>
                                    </>
                                  )}
                                  {r.serviceType === ServiceType.Ftth && (
                                    <button
                                      type="button"
                                      onClick={() => exportFtthSubscribersMutation.mutate(r)}
                                      disabled={
                                        exportFtthSubscribersMutation.isPending ||
                                        pullLoadingModalOpen ||
                                        pullImportModalOpen ||
                                        sasLoginModalOpen
                                      }
                                      className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50 flex items-center gap-1"
                                    >
                                      <CloudDownload className="h-3 w-3" />
                                      <span>FTTH</span>
                                    </button>
                                  )}
                                  <button type="button" onClick={() => handleOpenResellerEdit(r)} className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="تعديل">
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => window.confirm('حذف هذا الرسيلر؟') && deleteResellerMutation.mutate(r.id)}
                                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                    title="حذف"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                    {myResellers.length === 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {myRegions.length === 0 ? 'أنشئ منطقة أولاً ثم أضف رسيلر.' : 'لم تُضف أي رسيلر بعد.'}
                      </p>
                    )}

                    {showResellerForm && (
                      <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 mt-4 bg-gray-50 dark:bg-gray-800/50">
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{resellerFormId ? 'تعديل الرسيلر' : 'إضافة رسيلر'}</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {!resellerFormId && (
                            <div className="sm:col-span-2">
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">المنطقة *</label>
                              <select
                                value={resellerRegionId}
                                onChange={(e) => setResellerRegionId(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm"
                              >
                                <option value="">— اختر المنطقة —</option>
                                {myRegions.map((region) => (
                                  <option key={region.id} value={region.id}>{region.name}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">اسم الرسيلر *</label>
                            <input
                              type="text"
                              value={resellerName}
                              onChange={(e) => setResellerName(e.target.value)}
                              placeholder="مثل: FTTH، SAS الرئيسي"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">نوع الخدمة</label>
                            <select
                              value={resellerServiceType}
                              onChange={(e) => {
                                const next = Number(e.target.value) as ServiceType;
                                setResellerServiceType(next);
                                if (next !== ServiceType.Ftth) setResellerFtthPartnerId('');
                              }}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm"
                            >
                              <option value={ServiceType.Sas}>SAS</option>
                              <option value={ServiceType.Ftth}>FTTH</option>
                              <option value={ServiceType.Earthlink}>Earthlink</option>
                            </select>
                          </div>
                          {resellerServiceType === ServiceType.Ftth && (
                            <div className="sm:col-span-2">
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                معرف الشريك FTTH (partnerId) *
                              </label>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={resellerFtthPartnerId}
                                onChange={(e) => setResellerFtthPartnerId(e.target.value)}
                                placeholder="مثل: 2864647"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm"
                              />
                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                يُستخدم تلقائياً عند مزامنة المشتركين عبر الرصيد (compare).
                              </p>
                            </div>
                          )}
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">رابط الرسيلر *</label>
                            <input
                              type="url"
                              value={resellerBaseUrl}
                              onChange={(e) => setResellerBaseUrl(e.target.value)}
                              placeholder="https://..."
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">اسم مستخدم الرسيلر</label>
                            <input type="text" value={resellerUsername} onChange={(e) => setResellerUsername(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">معرف البوت</label>
                            <input type="text" value={resellerTelegramChatId} onChange={(e) => setResellerTelegramChatId(e.target.value)} placeholder="@channel_or_chat_id" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">كلمة سر الرسيلر {resellerFormId ? '(اتركها فارغة للإبقاء)' : ''}</label>
                            <input type="password" value={resellerPassword} onChange={(e) => setResellerPassword(e.target.value)} placeholder={resellerFormId ? 'لا تغيير' : ''} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">ترتيب العرض</label>
                            <input type="number" min={0} value={resellerDisplayOrder} onChange={(e) => setResellerDisplayOrder(parseInt(e.target.value, 10) || 0)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm" />
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button type="button" onClick={handleSaveReseller} disabled={createResellerMutation.isPending || updateResellerMutation.isPending} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm disabled:opacity-50">
                            {resellerFormId ? 'حفظ التعديل' : 'إضافة'}
                          </button>
                          <button type="button" onClick={() => { setResellerFormId(null); setShowResellerForm(false); }} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg text-sm">
                            إلغاء
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* إعدادات التفعيل (SAS) - للوكيل فقط */}
          {isAgentOrSubAgent && activeSection === 'sas' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center space-x-3 mb-6">
                <ExternalLink className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  إعدادات التفعيل (SAS/FTTH)
                </h2>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                إعدادات الربط لتفعيل المشتركين عبر فتح تاب في المتصفح. تُستخدم عند الضغط على «تفعيل عبر اللوحة» في صفحة المشتركين.
              </p>
              {myAgentLoading ? (
                <div className="py-4 text-gray-500 dark:text-gray-400">جاري تحميل البيانات...</div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">نوع الخدمة</label>
                    <select
                      value={serviceType}
                      onChange={(e) => setServiceType(Number(e.target.value) as ServiceType)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value={ServiceType.Sas}>SAS</option>
                      <option value={ServiceType.Ftth}>FTTH</option>
                      <option value={ServiceType.Earthlink}>Earthlink</option>
                    </select>
                  </div>

                  {serviceType === ServiceType.Sas ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">رابط SAS (SasBaseUrl) *</label>
                        <input
                          type="url"
                          value={sasBaseUrl}
                          onChange={(e) => setSasBaseUrl(e.target.value)}
                          placeholder="https://example.com"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">اسم مستخدم SAS (SasUsername)</label>
                        <input
                          type="text"
                          value={sasUsername}
                          onChange={(e) => setSasUsername(e.target.value)}
                          placeholder="اسم المستخدم"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">كلمة مرور SAS (SasPassword)</label>
                        <input
                          type="password"
                          value={sasPassword}
                          onChange={(e) => setSasPassword(e.target.value)}
                          placeholder="اتركها فارغة للإبقاء على القيمة الحالية"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                    </>
                  ) : serviceType === ServiceType.Earthlink ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">رابط Earthlink (ثابت)</label>
                        <input
                          type="url"
                          value="https://admin.earthlink.iq"
                          readOnly
                          className="w-full px-3 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          سيتم استخدام هذا الرابط تلقائياً عند التفعيل عبر Earthlink.
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">اسم المستخدم (Earthlink)</label>
                        <input
                          type="text"
                          value={ftthUsername}
                          onChange={(e) => setFtthUsername(e.target.value)}
                          placeholder="اسم المستخدم في لوحة Earthlink"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">كلمة المرور (Earthlink)</label>
                        <input
                          type="password"
                          value={ftthPassword}
                          onChange={(e) => setFtthPassword(e.target.value)}
                          placeholder="اتركها فارغة للإبقاء على القيمة الحالية"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">رابط FTTH (FtthBaseUrl)</label>
                        <input
                          type="url"
                          value={ftthBaseUrl}
                          onChange={(e) => setFtthBaseUrl(e.target.value)}
                          placeholder="https://admin.ftth.iq"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          الافتراضي: https://admin.ftth.iq
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">اسم المستخدم (FTTH)</label>
                        <input
                          type="text"
                          value={ftthUsername}
                          onChange={(e) => setFtthUsername(e.target.value)}
                          placeholder="username"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">كلمة المرور (FTTH)</label>
                        <input
                          type="password"
                          value={ftthPassword}
                          onChange={(e) => setFtthPassword(e.target.value)}
                          placeholder="اتركها فارغة للإبقاء على القيمة الحالية"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      ((serviceType === ServiceType.Ftth || serviceType === ServiceType.Earthlink) && (!ftthUsername.trim() || !ftthPassword.trim()))
                        ? showError('خطأ', 'عند اختيار FTTH أو Earthlink يجب إدخال username و password.')
                        : updateAgentSasMutation.mutate({
                        serviceType,
                        sasBaseUrl,
                        sasUsername,
                        sasPassword,
                        ftthBaseUrl,
                        ftthUsername,
                        ftthPassword,
                        })
                    }
                    disabled={updateAgentSasMutation.isPending}
                    className="flex items-center space-x-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    <span>{updateAgentSasMutation.isPending ? 'جاري الحفظ...' : 'حفظ إعدادات التفعيل'}</span>
                  </button>

                  {/* جلب من SAS — POST /providers/sas/sync-from-credentials: الباكند يشغّل السكربت بالاعتماديات ثم يزامن */}
                  {serviceType === ServiceType.Sas && (
                    <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-600">
                      <h3 className="text-base font-medium text-gray-900 dark:text-white flex items-center gap-2 mb-2">
                        <CloudDownload className="h-4 w-4 text-primary-500" />
                        مزامنة من SAS (جلب من لوحة SAS)
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        احفظ الإعدادات أعلاه (رابط SAS، اسم المستخدم، كلمة المرور). لتنفيذ المزامنة من SAS (معاينة المشتركين الجدد ثم الموافقة) استخدم زر «مزامنة تلقائيا» في صفحة المشتركين.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          

          {/* مزامنة SAS من المتصفح — للأدمن فقط */}
          {isAdmin && activeSection === 'sasAdminBrowserSync' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center space-x-3 mb-6">
                <CloudDownload className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  مزامنة SAS (من المتصفح)
                </h2>
              </div>
              <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2 mb-6 list-decimal pr-5">
                <li>سجّل دخولك إلى <span className="font-mono">admin.uniquefi.net</span> واستخرج Bearer token.</li>
                <li>من هنا اضغط «جلب من SAS» لاستدعاء نفس request من المتصفح.</li>
                <li>ثم اضغط «إرسال إلى Wakeel» لإرسال الـ JSON الخام كما هو إلى الباكند.</li>
              </ol>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Bearer token (SAS)
                  </label>
                  <textarea
                    value={sasBrowserToken}
                    onChange={(e) => setSasBrowserToken(e.target.value)}
                    rows={3}
                    placeholder="الصق التوكن هنا بدون كلمة Bearer (أو معها)"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white font-mono text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">page</label>
                    <input
                      type="number"
                      value={sasBrowserPage}
                      min={1}
                      onChange={(e) => setSasBrowserPage(Math.max(1, Number(e.target.value || 1)))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">per_page</label>
                    <input
                      type="number"
                      value={sasBrowserPerPage}
                      min={1}
                      onChange={(e) => setSasBrowserPerPage(Math.max(1, Number(e.target.value || 500)))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    type="button"
                    disabled={sasBrowserBusy || !sasBrowserToken.trim()}
                    onClick={async () => {
                      const rawToken = sasBrowserToken.trim();
                      const token = rawToken.toLowerCase().startsWith('bearer ')
                        ? rawToken.slice(7).trim()
                        : rawToken;
                      if (!token) return;
                      setSasBrowserBusy(true);
                      setSasBrowserStage('fetch');
                      setSasBrowserRawJson('');
                      setSasBrowserSummary(null);
                      try {
                        const fd = new FormData();
                        fd.append('page', String(sasBrowserPage));
                        fd.append('per_page', String(sasBrowserPerPage));

                        const res = await fetch('https://admin.uniquefi.net/admin/api/index.php/api/index/user', {
                          method: 'POST',
                          headers: { Authorization: `Bearer ${token}` },
                          body: fd,
                        });
                        const text = await res.text();
                        if (!res.ok) throw new Error(text || `HTTP ${res.status}`);

                        setSasBrowserRawJson(text);
                        try {
                          const parsed = JSON.parse(text);
                          const count = Array.isArray(parsed?.data) ? parsed.data.length : undefined;
                          const total = typeof parsed?.total === 'number' ? parsed.total : undefined;
                          setSasBrowserSummary({ count, total });
                        } catch {
                          // keep raw only
                        }
                        showSuccess('تم الجلب', 'تم جلب بيانات المشتركين من SAS بنجاح.');
                      } catch (err: any) {
                        const msg = err?.message || 'فشل جلب البيانات من SAS.';
                        const hint = /Failed to fetch|CORS|blocked/i.test(msg)
                          ? ' قد تكون المشكلة CORS من admin.uniquefi.net. جرّب من نفس الدومين أو فعّل CORS.'
                          : '';
                        showError('فشل الجلب', msg + hint);
                      } finally {
                        setSasBrowserStage(null);
                        setSasBrowserBusy(false);
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CloudDownload className="h-4 w-4" />
                    <span>جلب من SAS</span>
                  </button>

                  <button
                    type="button"
                    disabled={sasBrowserBusy || !sasBrowserRawJson.trim()}
                    onClick={async () => {
                      const raw = sasBrowserRawJson.trim();
                      if (!raw) return;
                      setSasBrowserBusy(true);
                      setSasBrowserStage('send');
                      try {
                        const data = await apiService.syncFromSasJsonRaw(raw, true);
                        showSuccess('تمت المزامنة', `${data.message}. تم مزامنة ${data.synced} مشترك.`);
                        queryClient.invalidateQueries({ queryKey: ['subscribers-dashboard'] });
                        queryClient.invalidateQueries({ queryKey: ['subscribers'] });
                      } catch (err: any) {
                        showError('فشل الإرسال', ApiService.showError(err));
                      } finally {
                        setSasBrowserStage(null);
                        setSasBrowserBusy(false);
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="h-4 w-4" />
                    <span>إرسال إلى Wakeel</span>
                  </button>
                </div>

                {sasBrowserSummary && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    تم جلب: {sasBrowserSummary.count ?? '—'} عنصر
                    {sasBrowserSummary.total != null ? ` • الإجمالي: ${sasBrowserSummary.total}` : ''}
                  </p>
                )}

                {sasBrowserRawJson && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-gray-700 dark:text-gray-300">
                      عرض JSON الخام (للمراجعة)
                    </summary>
                    <pre className="mt-2 max-h-64 overflow-auto text-xs bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-md p-3 text-gray-800 dark:text-gray-200">
{sasBrowserRawJson}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          )}

          {/* جلسات واتساب (Admin) — GET/DELETE .../Agents/whatsapp/sessions/devices */}
          {isAdmin && activeSection === 'adminWhatsAppSessions' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 relative">
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <div className="flex items-center space-x-3">
                  <MessageCircle className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      جلسات واتساب (Admin)
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      القائمة: <code className="text-[11px]">GET /Agents/whatsapp/sessions/devices</code>
                      {' — '}
                      الفلترة والبحث في المتصفح فقط.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => refetchWaDevices()}
                  disabled={waDevicesFetching}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`h-4 w-4 ${waDevicesFetching ? 'animate-spin' : ''}`} />
                  <span>تحديث القائمة</span>
                </button>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  بحث (رقم الجهاز، الحالة، الوكيل…)
                </label>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <input
                    type="search"
                    value={waDevicesSearch}
                    onChange={(e) => setWaDevicesSearch(e.target.value)}
                    placeholder="مثال: 9647 أو connected أو اسم الشركة"
                    className="w-full pr-10 pl-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    فلتر الحالة (محلي)
                  </label>
                  <input
                    type="text"
                    value={waSessionsStateFilter}
                    onChange={(e) => setWaSessionsStateFilter(e.target.value)}
                    placeholder="connected / disconnected ..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setWaSessionsStateFilter('')}
                      className="px-2.5 py-1 text-xs rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      الكل
                    </button>
                    <button
                      type="button"
                      onClick={() => setWaSessionsStateFilter('connected')}
                      className="px-2.5 py-1 text-xs rounded-md border border-green-300 dark:border-green-800 text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20"
                    >
                      connected
                    </button>
                    <button
                      type="button"
                      onClick={() => setWaSessionsStateFilter('connecting')}
                      className="px-2.5 py-1 text-xs rounded-md border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                    >
                      connecting
                    </button>
                    <button
                      type="button"
                      onClick={() => setWaSessionsStateFilter('disconnected')}
                      className="px-2.5 py-1 text-xs rounded-md border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      disconnected
                    </button>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 mt-7">
                  <input
                    type="checkbox"
                    checked={waSessionsLinkedOnly}
                    onChange={(e) => setWaSessionsLinkedOnly(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                  />
                  فقط الأجهزة المرتبطة بوكيل
                </label>
              </div>

              {waDevicesLoading ? (
                <div className="py-6 text-gray-500 dark:text-gray-400">جاري تحميل الأجهزة...</div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    من الخادم: <span className="font-semibold">{waDevicesData?.count ?? 0}</span>
                    {' — '}
                    المعروض بعد الفلترة: <span className="font-semibold">{waDevicesFiltered.length}</span>
                  </p>
                  {!waDevicesData?.items?.length ? (
                    <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4 text-sm text-gray-500 dark:text-gray-400">
                      لا توجد أجهزة في الاستجابة.
                    </div>
                  ) : !waDevicesFiltered.length ? (
                    <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4 text-sm text-gray-500 dark:text-gray-400">
                      لا توجد نتائج مطابقة للبحث أو الفلاتر المحلية.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300">
                          <tr>
                            <th className="px-3 py-2 text-right font-medium">deviceId</th>
                            <th className="px-3 py-2 text-right font-medium">الاسم / JID</th>
                            <th className="px-3 py-2 text-right font-medium">state</th>
                            <th className="px-3 py-2 text-right font-medium">createdAt</th>
                            <th className="px-3 py-2 text-right font-medium">الوكيل المرتبط</th>
                            <th className="px-3 py-2 text-right font-medium whitespace-nowrap">حالة (API)</th>
                            <th className="px-3 py-2 text-right font-medium whitespace-nowrap">إجراءات</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...waDevicesFiltered]
                            .sort((a, b) => {
                              const at = Date.parse(a.createdAt || '');
                              const bt = Date.parse(b.createdAt || '');
                              return (Number.isNaN(bt) ? 0 : bt) - (Number.isNaN(at) ? 0 : at);
                            })
                            .map((item) => {
                              const st = waStatusByDeviceId[item.deviceId];
                              return (
                                <tr key={`${item.deviceId}-${item.createdAt}`} className="border-t border-gray-100 dark:border-gray-700">
                                  <td className="px-3 py-2 font-mono text-gray-900 dark:text-gray-100">{item.deviceId || '—'}</td>
                                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300 text-xs">
                                    {item.displayName ? (
                                      <p className="font-medium text-gray-900 dark:text-gray-100">{item.displayName}</p>
                                    ) : null}
                                    {item.jid ? (
                                      <p className="font-mono text-gray-500 dark:text-gray-400 break-all">{item.jid}</p>
                                    ) : (
                                      !item.displayName && <span className="text-gray-400">—</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                                    <span
                                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getWaSessionStateBadgeClass(item.state)}`}
                                    >
                                      {item.state || 'unknown'}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                                    {item.createdAt ? new Date(item.createdAt).toLocaleString('en-GB') : '—'}
                                  </td>
                                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                                    {item.agent ? (
                                      <div className="space-y-0.5">
                                        <p>{item.agent.companyName || '—'}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{item.agent.phone || '—'}</p>
                                      </div>
                                    ) : (
                                      'غير مرتبط'
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300 text-xs">
                                    {st ? (
                                      <div className="space-y-0.5">
                                        <p>
                                          متصل:{' '}
                                          <span className={st.isConnected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                                            {st.isConnected ? 'نعم' : 'لا'}
                                          </span>
                                        </p>
                                        <p>
                                          مسجّل دخول:{' '}
                                          <span className={st.isLoggedIn ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                                            {st.isLoggedIn ? 'نعم' : 'لا'}
                                          </span>
                                        </p>
                                      </div>
                                    ) : (
                                      <span className="text-gray-400">اضغط «حالة»</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="flex flex-wrap gap-1 justify-end">
                                      <button
                                        type="button"
                                        title="تفاصيل الجهاز (GET /devices/:id)"
                                        onClick={() => setWaDeviceDetailId(item.deviceId)}
                                        className="p-1.5 rounded-md border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                                      >
                                        <Eye className="h-4 w-4" />
                                      </button>
                                      <button
                                        type="button"
                                        title="حالة الجهاز (GET /devices/:id/status)"
                                        onClick={() => loadWaDeviceStatus(item.deviceId)}
                                        disabled={waStatusLoadingId === item.deviceId}
                                        className="p-1.5 rounded-md border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                                      >
                                        {waStatusLoadingId === item.deviceId ? (
                                          <RefreshCw className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Activity className="h-4 w-4" />
                                        )}
                                      </button>
                                      <button
                                        type="button"
                                        title="حذف الجهاز (DELETE /devices/:id)"
                                        onClick={() => {
                                          if (
                                            !window.confirm(
                                              `حذف الجهاز ${item.deviceId} من المدير؟ لا يمكن التراجع من الواجهة.`
                                            )
                                          ) {
                                            return;
                                          }
                                          deleteWaDeviceMutation.mutate(item.deviceId);
                                        }}
                                        disabled={deleteWaDeviceMutation.isPending}
                                        className="p-1.5 rounded-md border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {waDeviceDetailId && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                  <button
                    type="button"
                    className="absolute inset-0 bg-black/50"
                    aria-label="إغلاق"
                    onClick={() => setWaDeviceDetailId(null)}
                  />
                  <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 text-right">
                    <div className="flex justify-between items-start gap-2 mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">تفاصيل الجهاز</h3>
                      <button
                        type="button"
                        onClick={() => setWaDeviceDetailId(null)}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    {waDeviceDetailLoading ? (
                      <p className="text-gray-500 dark:text-gray-400">جاري التحميل...</p>
                    ) : waDeviceDetail ? (
                      <div className="space-y-3 text-sm text-gray-800 dark:text-gray-200">
                        <p>
                          <span className="text-gray-500">deviceId:</span>{' '}
                          <span className="font-mono break-all">{waDeviceDetail.deviceId}</span>
                        </p>
                        {!!waDeviceDetail.displayName && (
                          <p>
                            <span className="text-gray-500">display_name:</span> {waDeviceDetail.displayName}
                          </p>
                        )}
                        {!!waDeviceDetail.jid && (
                          <p>
                            <span className="text-gray-500">jid:</span>{' '}
                            <span className="font-mono break-all">{waDeviceDetail.jid}</span>
                          </p>
                        )}
                        {!!waDeviceDetail.state && (
                          <p>
                            <span className="text-gray-500">state:</span> {waDeviceDetail.state}
                          </p>
                        )}
                        {!!waDeviceDetail.createdAt && (
                          <p>
                            <span className="text-gray-500">createdAt:</span> {waDeviceDetail.createdAt}
                          </p>
                        )}
                        {waDeviceDetail.agent && (
                          <div>
                            <p className="text-gray-500 mb-1">الوكيل</p>
                            <p>{waDeviceDetail.agent.companyName || '—'}</p>
                            <p className="font-mono text-xs text-gray-600 dark:text-gray-400">{waDeviceDetail.agent.phone || '—'}</p>
                          </div>
                        )}
                        {waDeviceDetail.raw && Object.keys(waDeviceDetail.raw).length > 0 && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs text-gray-500">JSON خام</summary>
                            <pre className="mt-2 text-xs bg-gray-50 dark:bg-gray-900/50 p-3 rounded overflow-x-auto max-h-56 whitespace-pre-wrap break-all">
                              {JSON.stringify(waDeviceDetail.raw, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-500">لا توجد بيانات.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* أجور الخدمة */}
          {canViewServiceFees && activeSection === 'serviceFees' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center space-x-3">
                  <DollarSign className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">أجور الخدمة</h2>
                </div>
                {canManageServiceFees && (!isAdmin || !!serviceFeesAgentId) && (
                  <button
                    type="button"
                    onClick={() => {
                      setServiceFeeFormId(null);
                      setShowServiceFeeForm(true);
                      setServiceFeeName('');
                      setServiceFeePrice('');
                      setServiceFeeResellerIds([]);
                    }}
                    className="flex items-center gap-2 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm"
                  >
                    <Plus className="h-4 w-4" />
                    إضافة خدمة
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                إدارة أسماء الخدمات وأسعارها المرتبطة بالوكيل. حدّد الرسيلرز التي تنطبق عليها كل خدمة؛ إن لم تُحدَّد أي رسيلرز فلن تظهر في التفعيل ولن تُحسب في الحسابات.
              </p>

              {isAdmin && (
                <div className="mb-4 max-w-md">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الوكيل *</label>
                  <select
                    value={serviceFeesAgentId}
                    onChange={(e) => {
                      setServiceFeesAgentId(e.target.value);
                      setServiceFeeFormId(null);
                      setShowServiceFeeForm(false);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm"
                  >
                    <option value="">— اختر الوكيل —</option>
                    {serviceFeesAgents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.companyName || agent.fullName || agent.id}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {isAdmin && !serviceFeesAgentId ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">اختر وكيلاً لعرض وإدارة أجور الخدمة.</p>
              ) : serviceFeesLoading ? (
                <div className="py-4 text-gray-500 dark:text-gray-400">جاري تحميل أجور الخدمة...</div>
              ) : (
                <div className="space-y-3">
                  <div className="wakeel-table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>اسم الخدمة</th>
                          <th>السعر</th>
                          <th>الرسيلرز</th>
                          {canManageServiceFees && <th className="w-28">إجراءات</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {serviceFeesList.map((fee) => (
                          <tr key={fee.id}>
                            <td className="font-medium text-gray-900 dark:text-white">{fee.name}</td>
                            <td className="tabular-nums">{formatNumber(fee.price, { suffix: ' د.ع' })}</td>
                            <td className="text-sm text-gray-600 dark:text-gray-300 max-w-xs">
                              {formatServiceFeeResellers(fee)}
                            </td>
                            {canManageServiceFees && (
                              <td>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenServiceFeeEdit(fee)}
                                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                    title="تعديل"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => window.confirm('حذف هذه الخدمة؟') && deleteServiceFeeMutation.mutate(fee.id)}
                                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                    title="حذف"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {serviceFeesList.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {canManageServiceFees ? 'لم تُضف أي خدمة بعد. اضغط «إضافة خدمة».' : 'لا توجد أجور خدمة مسجّلة.'}
                    </p>
                  )}

                  {canManageServiceFees && showServiceFeeForm && (
                    <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        {serviceFeeFormId ? 'تعديل الخدمة' : 'إضافة خدمة'}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">اسم الخدمة *</label>
                          <input
                            type="text"
                            value={serviceFeeName}
                            onChange={(e) => setServiceFeeName(e.target.value)}
                            placeholder="مثل: صيانة، تركيب"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">السعر (د.ع) *</label>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={serviceFeePrice}
                            onChange={(e) => setServiceFeePrice(e.target.value)}
                            placeholder="0"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm"
                          />
                        </div>
                      </div>
                      <div className="mt-3">
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                          الرسيلرز المطبَّقة *
                        </label>
                        {serviceFeesResellers.length === 0 ? (
                          <p className="text-xs text-amber-700 dark:text-amber-300">
                            لا توجد رسيلرز. أضف رسيلرز من قسم المناطق والرسيلرز أولاً.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border border-gray-200 dark:border-gray-600 rounded-md">
                            {serviceFeesResellers.map((reseller) => {
                              const checked = serviceFeeResellerIds.includes(reseller.id);
                              return (
                                <label
                                  key={reseller.id}
                                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm cursor-pointer border ${
                                    checked
                                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-800 dark:text-primary-200'
                                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleServiceFeeReseller(reseller.id)}
                                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                  />
                                  <span>
                                    {reseller.name}
                                    {reseller.regionName ? ` (${reseller.regionName})` : ''}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          بدون تحديد رسيلر لن تظهر الأجور في التفعيل ولا في إحصائيات الحسابات.
                        </p>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button
                          type="button"
                          onClick={handleSaveServiceFee}
                          disabled={createServiceFeeMutation.isPending || updateServiceFeeMutation.isPending}
                          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm disabled:opacity-50"
                        >
                          {serviceFeeFormId ? 'حفظ التعديل' : 'إضافة'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setServiceFeeFormId(null);
                            setShowServiceFeeForm(false);
                          }}
                          className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg text-sm"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ربط جلسة واتساب — الوكيل/المدير الثانوي يعدّلون؛ الموظف يرى جلسة الوكيل (نفس الجلسة للموظف والمدير الثانوي) */}
          {isAgentOrSubAgentOrEmployee && activeSection === 'whatsapp' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center space-x-3 mb-6">
                <MessageCircle className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  ربط واتساب
                </h2>
              </div>
              {isEmployee ? (
                <>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    جلسة واتساب تابعة للرسيلر/الوكيل؛ إرسال الرسائل يستخدم جلسة الرسيلر المرتبط بالمشترك.
                  </p>
                  {myAgentLoading ? (
                    <div className="py-4 text-gray-500 dark:text-gray-400">جاري تحميل البيانات...</div>
                  ) : (
                    <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-4 bg-gray-50 dark:bg-gray-700/50 space-y-2">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الرسيلر</p>
                      <select
                        value={waSelectedResellerId}
                        onChange={(e) => setWaSelectedResellerId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm"
                      >
                        {myResellers.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                      <p className="text-sm text-gray-900 dark:text-white font-mono">
                        {waSelectedReseller?.whatsAppSessionId?.trim() || myAgent?.whatsAppSessionId?.trim() || '— لا توجد جلسة محفوظة'}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <>
          
              {myAgentLoading ? (
                <div className="py-4 text-gray-500 dark:text-gray-400">جاري تحميل البيانات...</div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الرسيلر *</label>
                    <select
                      value={waSelectedResellerId}
                      onChange={(e) => {
                        setWaSelectedResellerId(e.target.value);
                        setWaError(null);
                        setPairCode(null);
                        setWaStatus(null);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    >
                      {myResellers.length === 0 ? (
                        <option value="">— أضف رسيلر أولاً —</option>
                      ) : (
                        myResellers.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}{r.regionName ? ` (${r.regionName})` : ''}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      رقم الهاتف
                    </label>
                    <input
                      type="tel"
                      value={pairPhoneOverride}
                      onChange={(e) => {
                        setPairPhoneOverride(e.target.value);
                        setWaError(null);
                      }}
                      placeholder="مثال: 9647XXXXXXXX"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      disabled={
                        !waSelectedResellerId ||
                        !pairPhoneOverride.trim() ||
                        waPairLoading ||
                        waStatusLoading
                      }
                      onClick={async () => {
                        if (!waSelectedResellerId) {
                          showError('خطأ', 'اختر الرسيلر أولاً.');
                          return;
                        }
                        const phoneParam = normalizeWhatsAppDeviceId(pairPhoneOverride);
                        if (!phoneParam) {
                          showError('خطأ', 'أدخل رقم هاتف صحيح.');
                          return;
                        }
                        setWaError(null);
                        setWaSuccessInfo(null);
                        setPairCode(null);
                        setPairHint(null);
                        setWaStatus(null);
                        clearWaStatusPoll();
                        setWaPairLoading(true);
                        try {
                          const currentSessionId = (waSelectedReseller?.whatsAppSessionId || '').trim();
                          if (!currentSessionId || currentSessionId !== phoneParam) {
                            await updateResellerWhatsAppSessionMutation.mutateAsync({
                              resellerId: waSelectedResellerId,
                              sessionId: phoneParam,
                            });
                          }
                          await apiService.postResellerWhatsAppDevice(waSelectedResellerId);
                          const res = await apiService.postResellerWhatsAppPairCode(waSelectedResellerId, phoneParam);
                          setPairCode(res.pairCode || '');
                          setPairHint(
                            'اذهب إلى واتساب > الأجهزة المرتبطة > ربط عبر رقم الهاتف > أدخل الكود'
                          );
                        } catch (e: any) {
                          const msg = mapWhatsAppBackendError(ApiService.showError(e));
                          setWaError(msg);
                          showError('كود الربط', msg);
                        } finally {
                          setWaPairLoading(false);
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {waPairLoading ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>جاري جلب الكود...</span>
                        </>
                      ) : (
                        <>
                          <Key className="h-4 w-4" />
                          <span>احصل على كود الربط</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={
                        !waSelectedResellerId ||
                        !(waSelectedReseller?.whatsAppSessionId?.trim()) ||
                        waPairLoading ||
                        waStatusLoading ||
                        waCheckStatusLoading
                      }
                      onClick={async () => {
                        if (!waSelectedResellerId) return;
                        setWaError(null);
                        try {
                          setWaCheckStatusLoading(true);
                          const s = await apiService.getResellerWhatsAppStatus(waSelectedResellerId);
                          setWaStatus(s);
                          if (s.isLoggedIn) {
                            setWaSuccessInfo('واتساب مرتبط حالياً.');
                          } else {
                            setWaSuccessInfo('واتساب غير مربوط بعد.');
                          }
                        } catch (e: any) {
                          const msg = mapWhatsAppBackendError(ApiService.showError(e));
                          setWaError(msg);
                          showError('فحص الحالة', msg);
                        } finally {
                          setWaCheckStatusLoading(false);
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {waCheckStatusLoading ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>جاري الفحص...</span>
                        </>
                      ) : (
                        <span>تحقق من الحالة</span>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={
                        !waSelectedResellerId ||
                        !pairCode ||
                        waStatusLoading ||
                        waCheckStatusLoading
                      }
                      onClick={async () => {
                        if (!waSelectedResellerId) return;
                        setWaStatus(null);
                        setWaError(null);
                        setWaSuccessInfo(null);
                        pollResellerWhatsAppStatus(waSelectedResellerId);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {waStatusLoading ? 'جاري التحقق...' : 'حفظ / تم الربط'}
                    </button>
                  </div>
                  <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4 space-y-2">
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                      تعليمات مهمة لتجنّب حظر رقم واتساب
                    </p>
                    <ul className="list-disc pr-5 space-y-1 text-sm text-amber-900 dark:text-amber-200">
                      <li>استخدم واتساب رسمي ومحدّث على هاتفك دائمًا.</li>
                      <li>لا ترسل رسائل جماعية مكثفة خلال وقت قصير.</li>
                      <li>تجنّب إرسال نفس النص حرفيًا لعدد كبير من الأشخاص؛ غيّر الصياغة قدر الإمكان.</li>
                      <li>أرسل فقط للعملاء الذين لديهم تعامل فعلي معك، وتجنّب الإرسال العشوائي.</li>
                      <li>اترك فواصل زمنية بين الرسائل ولا تحاول التسريع اليدوي بشكل مبالغ.</li>
                      <li>كثرة الإرسال السريع أو المتكرر قد تؤدي إلى تقييد مؤقت أو حظر دائم للرقم.</li>
                      <li>مسؤولية الاستخدام تقع على صاحب الرقم؛ النظام يوفر الإرسال ولا تضمن قبول واتساب لكل رسالة.</li>
                    </ul>
                  </div>
                  <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-4 space-y-3">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      طريقة الربط
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      افتح واتساب ثم: الأجهزة المرتبطة &gt; ربط عبر رقم الهاتف &gt; أدخل Pair Code الظاهر لك هنا.
                    </p>
                    <a
                      href="https://image2url.com/r2/default/images/1774490728324-11c15aa4-499b-4d58-99ef-54d32796e1ac.jpeg"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary-600 dark:text-primary-400 inline-flex items-center gap-1"
                    >
                      <ExternalLink className="h-4 w-4" />
                      فتح صورة الطريقة بحجم كامل
                    </a>
                    <img
                      src="https://image2url.com/r2/default/images/1774490728324-11c15aa4-499b-4d58-99ef-54d32796e1ac.jpeg"
                      alt="طريقة ربط واتساب عبر رقم الهاتف"
                      className="w-full max-w-md rounded-md border border-gray-200 dark:border-gray-700 object-contain bg-white"
                      loading="lazy"
                    />
                  </div>
                  {pairCode != null && pairCode !== '' && (
                    <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-4 bg-gray-50 dark:bg-gray-700/50 space-y-2">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Pair Code</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="text-2xl font-mono tracking-wider text-gray-900 dark:text-white">
                          {pairCode}
                        </code>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(pairCode);
                              showSuccess('نسخ', 'تم نسخ الرمز.');
                            } catch {
                              showError('نسخ', 'تعذّر النسخ من المتصفح.');
                            }
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500"
                        >
                          <Copy className="h-4 w-4" />
                          نسخ
                        </button>
                      </div>
                      {pairHint && <p className="text-sm text-gray-600 dark:text-gray-400">{pairHint}</p>}
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      الحالة من الخادم: متصل بالخوادم:{' '}
                      <span className="font-mono">{waStatus ? String(waStatus.isConnected) : '—'}</span>
                      {' · '}
                      جلسة جاهزة للإرسال:{' '}
                      <span className="font-mono">{waStatus ? String(waStatus.isLoggedIn) : '—'}</span>
                      {waStatusLoading && <span className="mr-2 text-primary-600 dark:text-primary-400">(استطلاع تلقائي…)</span>}
                    </p>
                    {waSuccessInfo && (
                      <p className="text-sm text-green-600 dark:text-green-400">{waSuccessInfo}</p>
                    )}
                    {waError && <p className="text-sm text-amber-600 dark:text-amber-400">{waError}</p>}
                  </div>
                  {myAgent?.whatsAppSessionId && (
                    <p className="text-sm text-green-600 dark:text-green-400">
                      معرّف الجهاز المحفوظ حالياً: {myAgent.whatsAppSessionId}
                    </p>
                  )}
                </div>
              )}
                </>
              )}
            </div>
          )}

          {/* زر الحفظ — يظهر عند رسائل الوكيل */}
          {(activeSection === 'activation' || activeSection === 'alert' || activeSection === 'details') && (
            <div className="flex justify-end mt-4">
              <button
                onClick={handleSaveSettings}
                disabled={isLoading}
                className="flex items-center space-x-2 px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>{isLoading ? 'جاري الحفظ...' : 'حفظ الإعدادات'}</span>
              </button>
            </div>
          )}
        </div>

        {/* قائمة الإعدادات — على اليمين */}
        <div className="lg:col-span-1 order-1 lg:order-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <nav className="space-y-1" aria-label="الإعدادات">
              <button
                type="button"
                onClick={() => setActiveSection('profile')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-right rounded-lg transition-colors ${
                  activeSection === 'profile'
                    ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <User className="h-5 w-5 flex-shrink-0" />
                <span>الملف الشخصي</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('theme')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-right rounded-lg transition-colors ${
                  activeSection === 'theme'
                    ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Settings className="h-5 w-5 flex-shrink-0" />
                <span>المظهر</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('activation')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-right rounded-lg transition-colors ${
                  activeSection === 'activation'
                    ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <MessageSquare className="h-5 w-5 flex-shrink-0" />
                <span>رسالة التفعيل</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('alert')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-right rounded-lg transition-colors ${
                  activeSection === 'alert'
                    ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <MessageSquare className="h-5 w-5 flex-shrink-0" />
                <span>رسالة تنبيه الاشتراك</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('details')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-right rounded-lg transition-colors ${
                  activeSection === 'details'
                    ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <MessageSquare className="h-5 w-5 flex-shrink-0" />
                <span>رسالة الدين او التفاصيل</span>
              </button>
              {isAgentOrSubAgent && (
                <button
                  type="button"
                  onClick={() => setActiveSection('subscriberApp')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-right rounded-lg transition-colors ${
                    activeSection === 'subscriberApp'
                      ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Smartphone className="h-5 w-5 flex-shrink-0" />
                  <span>إعدادات تطبيق المشترك</span>
                </button>
              )}
              {isAgentOrSubAgent && (
                <button
                  type="button"
                  onClick={() => setActiveSection('subscriberAnnouncement')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-right rounded-lg transition-colors ${
                    activeSection === 'subscriberAnnouncement'
                      ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Megaphone className="h-5 w-5 flex-shrink-0" />
                  <span>إعلان تطبيق المشترك</span>
                </button>
              )}
              {canUpdateSubscriberPhones && (
                <button
                  type="button"
                  onClick={() => setActiveSection('subscriberPhones')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-right rounded-lg transition-colors ${
                    activeSection === 'subscriberPhones'
                      ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Phone className="h-5 w-5 flex-shrink-0" />
                  <span>تحديث أرقام المشتركين</span>
                </button>
              )}
              {isAgentOrSubAgent && (
                <button
                  type="button"
                  onClick={() => setActiveSection('subscriberExcelImport')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-right rounded-lg transition-colors ${
                    activeSection === 'subscriberExcelImport'
                      ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Upload className="h-5 w-5 flex-shrink-0" />
                  <span>استيراد مشتركين Excel</span>
                </button>
              )}
              {isAgentOrSubAgent && (
                <button
                  type="button"
                  onClick={() => setActiveSection('activationExcelImport')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-right rounded-lg transition-colors ${
                    activeSection === 'activationExcelImport'
                      ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Receipt className="h-5 w-5 flex-shrink-0" />
                  <span>رفع اكسل تفعيلات</span>
                </button>
              )}
              {isAgentOrSubAgent && (
                <button
                  type="button"
                  onClick={() => setActiveSection('customMessage')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-right rounded-lg transition-colors ${
                    activeSection === 'customMessage'
                      ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <MessageSquare className="h-5 w-5 flex-shrink-0" />
                  <span>قالب رسالة خاصة</span>
                </button>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setActiveSection('sasAdminBrowserSync')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-right rounded-lg transition-colors ${
                    activeSection === 'sasAdminBrowserSync'
                      ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <CloudDownload className="h-5 w-5 flex-shrink-0" />
                  <span>مزامنة SAS (المتصفح)</span>
                </button>
              )}
              {isAdmin && (
                <div className="mb-1 px-1 text-[11px] text-gray-500 dark:text-gray-400">
                  WhatsApp Admin
                </div>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setActiveSection('adminWhatsAppSessions')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-right rounded-lg transition-colors ${
                    activeSection === 'adminWhatsAppSessions'
                      ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <MessageCircle className="h-5 w-5 flex-shrink-0" />
                  <span>جلسات واتساب (Admin)</span>
                </button>
              )}
              {isAgentOrSubAgent && (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveSection('resellers')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-right rounded-lg transition-colors ${
                      activeSection === 'resellers'
                        ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Store className="h-5 w-5 flex-shrink-0" />
                    <span>الرسيلرز والروابط</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSection('serviceFees')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-right rounded-lg transition-colors ${
                      activeSection === 'serviceFees'
                        ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <DollarSign className="h-5 w-5 flex-shrink-0" />
                    <span>أجور الخدمة</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSection('whatsapp')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-right rounded-lg transition-colors ${
                      activeSection === 'whatsapp'
                        ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <MessageCircle className="h-5 w-5 flex-shrink-0" />
                    <span>ربط واتساب</span>
                  </button>
                </>
              )}
              {isEmployee && (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveSection('serviceFees')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-right rounded-lg transition-colors ${
                      activeSection === 'serviceFees'
                        ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <DollarSign className="h-5 w-5 flex-shrink-0" />
                    <span>أجور الخدمة</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSection('whatsapp')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-right rounded-lg transition-colors ${
                      activeSection === 'whatsapp'
                        ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <MessageCircle className="h-5 w-5 flex-shrink-0" />
                    <span>ربط واتساب</span>
                  </button>
                </>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setActiveSection('serviceFees')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-right rounded-lg transition-colors ${
                    activeSection === 'serviceFees'
                      ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <DollarSign className="h-5 w-5 flex-shrink-0" />
                  <span>أجور الخدمة</span>
                </button>
              )}
            </nav>
          </div>
        </div>
      </div>
    </div>

    {/* مودال تسجيل دخول SAS — قبل سحب المشتركين من المتصفح */}
    <input
      ref={sasImportFileInputRef}
      type="file"
      accept=".json,application/json"
      className="hidden"
      aria-hidden
      onChange={(e) => void handleSasImportFileSelected(e)}
    />

    {sasLoginModalOpen && sasLoginReseller && (
      <div className="fixed inset-0 z-[115] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl">
          <div className="bg-gradient-to-l from-emerald-600 to-emerald-800 px-6 py-4 text-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-emerald-100/90">سحب مشتركين SAS</p>
                <p className="text-lg font-bold">{sasLoginReseller.name}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSasLoginModalOpen(false);
                  setSasLoginReseller(null);
                }}
                className="rounded-lg p-2 hover:bg-white/15 transition-colors"
                aria-label="إغلاق"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 p-1 bg-gray-50 dark:bg-gray-900/40">
              <button
                type="button"
                onClick={() => setSasLoginMode('token')}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                  sasLoginMode === 'token'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                توكن من اللوحة
              </button>
              <button
                type="button"
                onClick={() => setSasLoginMode('credentials')}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                  sasLoginMode === 'credentials'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                تسجيل من هنا
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                رابط لوحة SAS
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={sasLoginBaseUrl}
                  onChange={(e) => setSasLoginBaseUrl(e.target.value)}
                  placeholder="https://ftth.jt.iq"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm font-mono"
                  dir="ltr"
                />
                <a
                  href={sasLoginBaseUrl || 'https://ftth.jt.iq'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-md border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-xs hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  فتح
                </a>
              </div>
            </div>

            {sasLoginMode === 'token' ? (
              <>
                <ol className="text-xs text-gray-600 dark:text-gray-400 space-y-1.5 list-decimal pr-4 leading-relaxed">
                  <li>اضغط «فتح» وادخل إلى لوحة SAS (مثلاً ftth.jt.iq).</li>
                  <li>سجّل دخولك من اللوحة نفسها (username / password).</li>
                  <li>من DevTools → Network → طلب <span className="font-mono">login</span> → انسخ حقل <span className="font-mono">token</span> أو JSON كامل.</li>
                  <li>الصقه أدناه ثم اضغط سحب المشتركين.</li>
                </ol>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    توكن SAS (JWT أو JSON)
                  </label>
                  <textarea
                    value={sasLoginTokenPaste}
                    onChange={(e) => setSasLoginTokenPaste(e.target.value)}
                    rows={4}
                    placeholder='eyJ0eXAiOiJKV1Qi... أو {"status":200,"token":"..."}'
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-xs font-mono"
                    dir="ltr"
                  />
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                  قد يفشل مع jt.iq (خطأ 500) لأن اللوحة تتطلب دخولاً من نفس الموقع. استخدم تبويب «توكن من اللوحة».
                </p>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    اسم المستخدم
                  </label>
                  <input
                    type="text"
                    value={sasLoginUsername}
                    onChange={(e) => setSasLoginUsername(e.target.value)}
                    placeholder="admin@mud"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm"
                    dir="ltr"
                    autoComplete="username"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    كلمة المرور
                  </label>
                  <div className="relative">
                    <input
                      type={showSasLoginPassword ? 'text' : 'password'}
                      value={sasLoginPassword}
                      onChange={(e) => setSasLoginPassword(e.target.value)}
                      className="w-full px-3 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm"
                      dir="ltr"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSasLoginPassword((v) => !v)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400"
                      tabIndex={-1}
                    >
                      {showSasLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSasLoginModalOpen(false);
                  setSasLoginReseller(null);
                }}
                className="flex-1 rounded-xl border border-gray-300 dark:border-gray-600 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/80"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => void handleSasBrowserPull()}
                disabled={
                  !sasLoginBaseUrl.trim() ||
                  (sasLoginMode === 'token' ? !sasLoginTokenPaste.trim() : !sasLoginUsername.trim() || !sasLoginPassword)
                }
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                <CloudDownload className="h-4 w-4" />
                سحب المشتركين
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* سحب مشتركين (FTTH أو SAS): جاري التحميل — ألوان النظام */}
    {pullLoadingModalOpen && (
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl">
          <div className="h-1.5 w-full bg-gradient-to-l from-primary-500 to-primary-700" />
          <div className="px-6 sm:px-10 py-10 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-50 dark:bg-primary-900/30 ring-2 ring-primary-200 dark:ring-primary-800">
              <div className="relative h-14 w-14">
                <div className="absolute inset-0 rounded-full border-4 border-primary-100 dark:border-primary-900 border-t-primary-600 dark:border-t-primary-400 animate-spin" />
                <Users className="absolute inset-0 m-auto h-7 w-7 text-primary-600 dark:text-primary-400" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 font-cairo">
              جاري تحميل المشتركين
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {pullPanelKind === 'sas'
                ? sasBrowserFetchProgress || 'يتم جلب بيانات المشتركين من لوحة SAS مباشرةً عبر المتصفح، يرجى الانتظار…'
                : 'لا تغلق النافذة لحين اكتمال التحميل الوقت حسب عدد مشتركيك'}
            </p>
            <div className="mt-8 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
              <div className="h-full w-2/5 animate-pulse rounded-full bg-primary-500 dark:bg-primary-400" />
            </div>
          </div>
        </div>
      </div>
    )}

    {/* نتيجة التحميل — العدد + تنزيل + استيراد */}
    {pullResultModalOpen && pullExportSnapshot && (
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl">
          <div className="bg-gradient-to-l from-primary-600 to-primary-800 px-6 py-4 text-white">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                  <Users className="h-7 w-7" />
                </div>
                <div className="text-right">
                  <p className="text-sm text-primary-100/95">اكتمل الجلب</p>
                  <p className="text-lg font-bold">{pullExportSnapshot.resellerName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPullResultModalOpen(false);
                  setPullExportSnapshot(null);
                }}
                className="rounded-lg p-2 hover:bg-white/15 transition-colors"
                aria-label="إغلاق"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="p-6 space-y-6">
            <div className="rounded-xl border border-primary-200/80 dark:border-primary-800 bg-primary-50/90 dark:bg-primary-950/40 px-4 py-5 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">عدد المشتركين المُجلَبين</p>
              <p className="text-4xl font-bold text-primary-700 dark:text-primary-300 tabular-nums">
                {pullExportSnapshot.data.length}
              </p>
            </div>
            {pullExportSnapshot.kind === 'ftth' && pullExportSnapshot.exportImportResult && (
              <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50/90 dark:bg-green-950/30 px-4 py-3 text-sm text-green-800 dark:text-green-200 text-right">
                <p className="font-medium mb-1">تم الحفظ تلقائياً عند الجلب</p>
                <p>{formatSubscriberImportStats(pullExportSnapshot.exportImportResult)}</p>
                <p className="text-xs mt-2 text-green-700/90 dark:text-green-300/90">
                  لا حاجة لزر «استيراد» بعد التصدير — المشتركون أُدخلوا مع طلب الجلب.
                </p>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={downloadPullExportJson}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border-2 border-gray-300 dark:border-gray-600 py-3 px-4 font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700/80 transition-colors"
              >
                <Download className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                تحميل نسخة احتياطية
              </button>
              {pullExportSnapshot.kind === 'sas' ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!pullExportSnapshot.data.length) return;
                    importPullSubscribersMutation.mutate({
                      data: pullExportSnapshot.data,
                      kind: pullExportSnapshot.kind,
                      resellerId: pullExportSnapshot.resellerId,
                    });
                  }}
                  disabled={!pullExportSnapshot.data.length || importPullSubscribersMutation.isPending}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-700 dark:bg-primary-600 dark:hover:bg-primary-500 py-3 px-4 font-medium text-white shadow-lg shadow-primary-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <DatabaseIcon className="h-5 w-5" />
                  استيراد الآن
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setPullResultModalOpen(false);
                    setPullExportSnapshot(null);
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-700 dark:bg-primary-600 dark:hover:bg-primary-500 py-3 px-4 font-medium text-white shadow-lg shadow-primary-900/20"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  تم — إغلاق
                </button>
              )}
            </div>
            {pullExportSnapshot.kind === 'ftth' && (
              <button
                type="button"
                onClick={() => {
                  if (!pullExportSnapshot.data.length) return;
                  importPullSubscribersMutation.mutate({
                    data: pullExportSnapshot.data,
                    kind: 'ftth',
                    resellerId: pullExportSnapshot.resellerId,
                  });
                }}
                disabled={!pullExportSnapshot.data.length || importPullSubscribersMutation.isPending}
                className="w-full text-sm text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50"
              >
                إعادة مزامنة يدوياً (اختياري — عادة غير مطلوب)
              </button>
            )}
          </div>
        </div>
      </div>
    )}

    {/* تقدم الاستيراد — مودال أوسع + مميزات النظام */}
    {pullImportModalOpen && (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4">
        <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl max-h-[min(90vh,720px)] flex flex-col">
          <div className="h-1.5 w-full shrink-0 bg-gradient-to-l from-primary-500 to-primary-700" />
          <div className="overflow-y-auto flex-1 px-5 sm:px-8 py-6 sm:py-8">
            <div className="flex flex-col sm:flex-row sm:items-start gap-6">
              <div className="flex-1 min-w-0 text-center sm:text-right">
                <div className="mx-auto sm:mx-0 mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 dark:bg-primary-900/35 ring-2 ring-primary-200/80 dark:ring-primary-800">
                  <div className="relative h-12 w-12">
                    <div className="absolute inset-0 rounded-full border-[3px] border-primary-100 dark:border-primary-900 border-t-primary-600 dark:border-t-primary-400 animate-spin" />
                    <DatabaseIcon className="absolute inset-0 m-auto h-6 w-6 text-primary-600 dark:text-primary-400" />
                  </div>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 dark:bg-primary-900/40 px-3 py-1 text-xs font-medium text-primary-700 dark:text-primary-300 mb-3">
                  <Sparkles className="h-3.5 w-3.5" />
                  Wakeel
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2 font-cairo">
                  جاري حفظ المشتركين
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                   لا تغلق الصفحة حتى يكتمل الاستيراد.
                </p>
                <div className="mb-2 flex justify-between text-xs font-medium text-gray-500 dark:text-gray-400">
                  <span>التقدم المُقدَّر</span>
                  <span className="tabular-nums text-primary-600 dark:text-primary-400">{Math.round(pullImportProgress)}%</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700 ring-1 ring-gray-200/80 dark:ring-gray-600">
                  <div
                    className="h-full rounded-full bg-gradient-to-l from-primary-400 to-primary-600 dark:from-primary-500 dark:to-primary-700 transition-[width] duration-200 ease-out"
                    style={{ width: `${pullImportProgress}%` }}
                  />
                </div>
                {importPullSubscribersMutation.isPending && (
                  <p className="mt-4 text-center text-sm text-primary-600 dark:text-primary-400 font-medium">
                    جار الاستيراد...
                  </p>
                )}
              </div>
              <div className="sm:w-[min(100%,280px)] shrink-0 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-900/50 p-4 sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400 mb-3 text-right">
                  لماذا Wakeel؟
                </p>
                <ul className="space-y-3 text-right">
                  {SUBSCRIBER_IMPORT_FEATURE_LINES.map((line) => (
                    <li key={line} className="flex gap-2.5 text-sm text-gray-700 dark:text-gray-300 leading-snug">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-primary-500 dark:text-primary-400 mt-0.5" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* شاشة تحميل المزامنة من SAS */}
    {sasSyncLoading && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-8 max-w-md w-full mx-4 flex flex-col items-center gap-6">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-primary-200 dark:border-primary-800 border-t-primary-600 dark:border-t-primary-400 animate-spin" />
            <CloudDownload className="absolute inset-0 m-auto h-7 w-7 text-primary-600 dark:text-primary-400" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">مزامنة من SAS</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 transition-opacity duration-300">
              {SAS_SYNC_STEPS[sasSyncStepIndex]}
            </p>
          </div>
          <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 dark:bg-primary-400 rounded-full transition-all duration-500 ease-out"
              style={{ width: '30%', marginLeft: `${Math.min(sasSyncStepIndex * 18, 70)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">قد يستغرق الأمر دقيقة حسب حجم البيانات</p>
        </div>
      </div>
    )}

    {/* شاشة تحميل مزامنة الأدمن (جلب/إرسال) */}
    {sasBrowserBusy && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-8 max-w-md w-full mx-4 flex flex-col items-center gap-5">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-primary-200 dark:border-primary-800 border-t-primary-600 dark:border-t-primary-400 animate-spin" />
            <CloudDownload className="absolute inset-0 m-auto h-7 w-7 text-primary-600 dark:text-primary-400" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {sasBrowserStage === 'send' ? 'إرسال إلى Wakeel' : 'جلب من SAS'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {sasBrowserStage === 'send'
                ? 'جاري إرسال JSON الخام إلى Wakeel والمزامنة...'
                : 'جاري سحب بيانات المشتركين من SAS داخل المتصفح...'}
            </p>
          </div>
          <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-primary-500 dark:bg-primary-400 rounded-full animate-pulse" style={{ width: '45%' }} />
          </div>
        </div>
      </div>
    )}
    </>
  );
}

export default SettingsPage;
