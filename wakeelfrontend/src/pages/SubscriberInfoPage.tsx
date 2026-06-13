import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/api';
import {
  SubscriberAppLoginResponse,
  SubscriberAppProblemType,
  SubscriberMaintenanceRequestDto,
  SubscriberAppRenewalDto,
  AgentAnnouncementDto,
} from '../types';
import { useDigits } from '../contexts/DigitsContext';
import waklogo from '../images/waklogo.png';
import {
  User,
  LogOut,
  Phone,
  Wrench,
  Clock,
  Receipt,
  Wifi,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Plus,
  MapPin,
  Gauge,
} from 'lucide-react';

type AppTab = 'maintenance' | 'profile' | 'renewals';

const AD_SLIDES = [
  { title: 'خدماتنا', text: 'نقدم أفضل خدمات الإنترنت والاتصالات' },
  { title: 'السرعة', text: 'سرعات عالية واتصال مستقر' },
  { title: 'فروعنا', text: 'فروعنا منتشرة في جميع أنحاء العراق' },
];

const DEFAULT_GRADIENT_START = '#2962FF';
const DEFAULT_GRADIENT_END = '#1E40AF';

const PROBLEM_TYPE_OPTIONS: { value: SubscriberAppProblemType; label: string }[] = [
  { value: SubscriberAppProblemType.SubscriptionRenewal, label: 'تجديد اشتراك' },
  { value: SubscriberAppProblemType.WeakInternet, label: 'ضعف بالانترنت' },
  { value: SubscriberAppProblemType.NetworkPasswordChange, label: 'تغيير رمز الشبكة' },
  { value: SubscriberAppProblemType.CableCut, label: 'قطع في الكيبل' },
  { value: SubscriberAppProblemType.Other, label: 'أخرى' },
];

const problemTypeLabel = (type?: SubscriberAppProblemType | number | null) => {
  const found = PROBLEM_TYPE_OPTIONS.find((o) => o.value === type);
  return found?.label ?? '—';
};

const maintenanceStatusClass = (status: SubscriberMaintenanceRequestDto['status']) => {
  if (status === 'pending') return 'bg-amber-100 text-amber-800';
  if (status === 'inProgress') return 'bg-blue-100 text-blue-800';
  if (status === 'completed') return 'bg-green-100 text-green-800';
  return 'bg-slate-100 text-slate-600';
};

const SUBSCRIBER_TOKEN_KEY = 'subscriberToken';
const SUBSCRIBER_SESSION_KEY = 'subscriberSession';

const readStoredSession = (): SubscriberAppLoginResponse | null => {
  try {
    const raw = localStorage.getItem(SUBSCRIBER_SESSION_KEY);
    return raw ? (JSON.parse(raw) as SubscriberAppLoginResponse) : null;
  } catch {
    return null;
  }
};

const InfoRow: React.FC<{ label: string; value: React.ReactNode; icon?: React.ReactNode }> = ({
  label,
  value,
  icon,
}) => (
  <div className="flex items-center gap-3 py-3.5 border-b border-slate-100 last:border-0">
    {icon ? (
      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-[#2962FF] flex-shrink-0">
        {icon}
      </div>
    ) : null}
    <div className="flex-1 min-w-0 text-right">
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-slate-800 truncate">{value}</p>
    </div>
  </div>
);

const AnnouncementCarousel: React.FC<{
  announcements: AgentAnnouncementDto[];
  adIndex: number;
  onSelectSlide: (index: number) => void;
}> = ({ announcements, adIndex, onSelectSlide }) => {
  const hasAnnouncements = announcements.length > 0;
  const slideCount = hasAnnouncements ? announcements.length : AD_SLIDES.length;

  const currentSlideGradientStart =
    hasAnnouncements && announcements[adIndex]
      ? announcements[adIndex].gradientStart?.trim() || DEFAULT_GRADIENT_START
      : DEFAULT_GRADIENT_START;
  const currentSlideGradientEnd =
    hasAnnouncements && announcements[adIndex]
      ? announcements[adIndex].gradientEnd?.trim() || DEFAULT_GRADIENT_END
      : DEFAULT_GRADIENT_END;

  return (
    <div
      className="relative mb-4 h-[172px] overflow-hidden rounded-2xl transition-colors duration-500 shadow-lg flex-shrink-0"
      style={{ background: `linear-gradient(135deg, ${currentSlideGradientStart}, ${currentSlideGradientEnd})` }}
    >
      {hasAnnouncements
        ? announcements.map((ann, i) => (
            <div
              key={ann.id}
              className="absolute inset-0 flex items-center justify-center transition-all duration-500 ease-in-out p-6"
              style={{
                opacity: adIndex === i ? 1 : 0,
                transform: adIndex === i ? 'translateX(0)' : 'translateX(100%)',
              }}
            >
              <div className="flex items-center gap-6 w-full max-w-md text-right">
                <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Wifi className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3
                    className="text-xl sm:text-2xl font-bold text-white mb-2 tracking-tight drop-shadow-sm"
                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.15)' }}
                  >
                    {ann.mainTitle || '—'}
                  </h3>
                  {ann.subTitle ? (
                    <p
                      className="text-sm sm:text-base text-white/95 mb-1.5 leading-relaxed"
                      style={{ textShadow: '0 1px 1px rgba(0,0,0,0.1)' }}
                    >
                      {ann.subTitle}
                    </p>
                  ) : null}
                  {ann.phone ? (
                    <div className="inline-flex items-center gap-2 mt-1.5 px-3 py-1.5 rounded-xl bg-white/25 backdrop-blur-sm">
                      <Phone className="w-4 h-4 text-white/90 flex-shrink-0" />
                      <span
                        className="text-sm font-semibold text-white tabular-nums"
                        style={{ textShadow: '0 1px 1px rgba(0,0,0,0.1)' }}
                        dir="ltr"
                      >
                        {ann.phone}
                      </span>
                    </div>
                  ) : null}
                  {!ann.subTitle && !ann.phone ? <p className="text-white/80 text-sm">—</p> : null}
                </div>
              </div>
            </div>
          ))
        : AD_SLIDES.map((slide, i) => (
            <div
              key={i}
              className="absolute inset-0 flex items-center justify-center transition-all duration-500 ease-in-out p-6"
              style={{
                opacity: adIndex === i ? 1 : 0,
                transform: adIndex === i ? 'translateX(0)' : 'translateX(100%)',
              }}
            >
              <div className="flex items-center gap-6 w-full max-w-md text-right">
                <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  {i === 0 && <Wifi className="w-7 h-7 text-white" />}
                  {i === 1 && <Gauge className="w-7 h-7 text-white" />}
                  {i === 2 && <MapPin className="w-7 h-7 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3
                    className="text-xl sm:text-2xl font-bold text-white mb-2 tracking-tight drop-shadow-sm"
                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.15)' }}
                  >
                    {slide.title}
                  </h3>
                  <p
                    className="text-sm sm:text-base text-white/95 leading-relaxed"
                    style={{ textShadow: '0 1px 1px rgba(0,0,0,0.1)' }}
                  >
                    {slide.text}
                  </p>
                </div>
              </div>
            </div>
          ))}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {Array.from({ length: slideCount }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelectSlide(i)}
            className={`h-2 rounded-full transition-all duration-300 ${
              adIndex === i ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/70'
            }`}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

const SubscriberInfoPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { formatDate, formatNumber } = useDigits();
  const storedSession = readStoredSession();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [session, setSession] = useState<SubscriberAppLoginResponse | null>(storedSession);
  const [isLoggedIn, setIsLoggedIn] = useState(Boolean(storedSession && localStorage.getItem(SUBSCRIBER_TOKEN_KEY)));
  const [activeTab, setActiveTab] = useState<AppTab>('profile');
  const [adIndex, setAdIndex] = useState(0);
  const [renewalsPage, setRenewalsPage] = useState(1);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [maintenanceForm, setMaintenanceForm] = useState({
    problemType: SubscriberAppProblemType.WeakInternet,
    description: '',
    alternativePhoneNumber: '',
  });
  const [maintenanceError, setMaintenanceError] = useState('');

  const loginMutation = useMutation({
    mutationFn: ({ name, user }: { name: string; user: string }) =>
      apiService.subscriberAppLogin(name, user),
    onSuccess: (data) => {
      localStorage.setItem(SUBSCRIBER_TOKEN_KEY, data.token);
      localStorage.setItem(SUBSCRIBER_SESSION_KEY, JSON.stringify(data));
      setSession(data);
      setIsLoggedIn(true);
      setActiveTab('profile');
      queryClient.invalidateQueries({ queryKey: ['subscriber-app'] });
    },
  });

  const { data: subscriber, isLoading: profileLoading, isError: profileError, error: profileErr } = useQuery({
    queryKey: ['subscriber-app', 'me'],
    queryFn: () => apiService.getSubscriberAppMe(),
    enabled: isLoggedIn && !!localStorage.getItem(SUBSCRIBER_TOKEN_KEY),
    retry: false,
  });

  const { data: maintenanceRequests = [], isLoading: maintenanceLoading } = useQuery<SubscriberMaintenanceRequestDto[]>({
    queryKey: ['subscriber-app', 'maintenance'],
    queryFn: () => apiService.getSubscriberMaintenanceRequests(),
    enabled: isLoggedIn && !!localStorage.getItem(SUBSCRIBER_TOKEN_KEY),
    retry: false,
  });

  const { data: renewalsResponse, isLoading: renewalsLoading } = useQuery({
    queryKey: ['subscriber-app', 'renewals', renewalsPage],
    queryFn: () => apiService.getSubscriberAppRenewals(renewalsPage, 10),
    enabled: isLoggedIn && !!localStorage.getItem(SUBSCRIBER_TOKEN_KEY) && activeTab === 'renewals',
    retry: false,
  });

  const renewals = renewalsResponse?.data ?? [];

  const announcements = subscriber?.announcements ?? [];
  const slideCount = announcements.length > 0 ? announcements.length : AD_SLIDES.length;

  useEffect(() => {
    if (!isLoggedIn) return;
    const t = setInterval(() => {
      setAdIndex((i) => (i + 1) % Math.max(1, slideCount));
    }, 3000);
    return () => clearInterval(t);
  }, [isLoggedIn, slideCount]);

  useEffect(() => {
    setAdIndex(0);
  }, [announcements.length]);

  const createMaintenanceMutation = useMutation({
    mutationFn: () =>
      apiService.createSubscriberMaintenanceRequest({
        problemType: maintenanceForm.problemType,
        description: maintenanceForm.description.trim() || undefined,
        alternativePhoneNumber: maintenanceForm.alternativePhoneNumber.trim() || undefined,
      }),
    onSuccess: () => {
      setMaintenanceError('');
      setMaintenanceForm({
        problemType: SubscriberAppProblemType.WeakInternet,
        description: '',
        alternativePhoneNumber: '',
      });
      setShowMaintenanceModal(false);
      queryClient.invalidateQueries({ queryKey: ['subscriber-app', 'maintenance'] });
    },
    onError: (err: Error) => {
      setMaintenanceError(err.message || 'فشل إرسال طلب الصيانة');
    },
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (fullName.trim() && username.trim()) {
      loginMutation.mutate({ name: fullName.trim(), user: username.trim() });
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setFullName('');
    setUsername('');
    setSession(null);
    setActiveTab('profile');
    setRenewalsPage(1);
    localStorage.removeItem(SUBSCRIBER_TOKEN_KEY);
    localStorage.removeItem(SUBSCRIBER_SESSION_KEY);
    queryClient.removeQueries({ queryKey: ['subscriber-app'] });
  };

  const handleSubmitMaintenance = (e: React.FormEvent) => {
    e.preventDefault();
    setMaintenanceError('');
    createMaintenanceMutation.mutate();
  };

  const displayName = subscriber?.fullName || session?.fullName || fullName;
  const headerRegion = subscriber?.regionName || session?.regionName;
  const headerReseller = subscriber?.agentResellerName || session?.agentResellerName;
  const renewalProfileName = (r: SubscriberAppRenewalDto) => r.newProfileName || '—';

  const navItems: { id: AppTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'maintenance', label: 'الصيانة', icon: Wrench },
    { id: 'profile', label: 'معلوماتي', icon: User },
    { id: 'renewals', label: 'التفعيلات', icon: Receipt },
  ];

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen font-cairo bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 flex items-center justify-center p-4" dir="rtl" style={{ fontFamily: 'Cairo, sans-serif' }}>
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 sm:p-10 w-full max-w-[400px] text-center shadow-xl border border-white/60">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#2962FF] to-[#1E40AF] shadow-lg shadow-blue-500/25 mb-5">
              <img src={waklogo} alt="شعار الوكيل" className="w-14 h-14 rounded-xl object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-1">Al Wakeel</h1>
            <p className="text-slate-500 text-sm">تطبيق المشترك</p>
          </div>

          {loginMutation.isPending ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-10 h-10 border-2 border-slate-200 border-t-[#2962FF] rounded-full animate-spin mb-3" />
              <p className="text-slate-500 text-sm">جاري تسجيل الدخول...</p>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4 mb-6">
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="الاسم الكامل"
                required
                className="w-full py-3.5 px-4 rounded-xl text-base text-right outline-none border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-[#2962FF] focus:ring-2 focus:ring-[#2962FF]/20 placeholder:text-slate-400"
              />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="اسم المستخدم"
                required
                className="w-full py-3.5 px-4 rounded-xl text-base text-right outline-none border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-[#2962FF] focus:ring-2 focus:ring-[#2962FF]/20 placeholder:text-slate-400"
              />
              <button
                type="submit"
                className="w-full py-3.5 rounded-xl text-base font-semibold text-white bg-gradient-to-r from-[#2962FF] to-[#1E40AF] shadow-lg shadow-blue-500/30 active:scale-[0.99] transition-all"
              >
                تسجيل الدخول
              </button>
            </form>
          )}

          {loginMutation.isError && (
            <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-right text-sm">
              {loginMutation.error instanceof Error
                ? loginMutation.error.message
                : 'خطأ في تسجيل الدخول. يرجى التحقق من البيانات والمحاولة مرة أخرى.'}
            </div>
          )}

          <p className="text-slate-500 text-sm leading-relaxed">
            أدخل اسمك الكامل واسم المستخدم للاطلاع على اشتراكك وطلبات الصيانة.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-cairo bg-slate-100 flex flex-col" dir="rtl" style={{ fontFamily: 'Cairo, sans-serif' }}>
      {/* App Header */}
      <header className="bg-gradient-to-r from-[#2962FF] to-[#1E40AF] text-white px-4 pt-safe pt-4 pb-5 shadow-md flex-shrink-0">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleLogout}
            className="p-2 rounded-xl bg-white/15 hover:bg-white/25 transition-colors"
            aria-label="تسجيل الخروج"
          >
            <LogOut className="w-5 h-5" />
          </button>
          <div className="flex-1 text-center min-w-0">
            <p className="text-xs text-white/80">مرحباً</p>
            <h1 className="text-base font-bold truncate">{displayName}</h1>
            {(headerRegion || headerReseller) && (
              <p className="text-[11px] text-white/70 truncate mt-0.5">
                {[headerRegion, headerReseller].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <img src={waklogo} alt="" className="w-7 h-7 rounded-lg object-contain" />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-lg mx-auto px-4 py-4">
          {/* إعلانات دوارة — ثابتة في أعلى كل الصفحات */}
          <div className="sticky top-0 z-20 -mx-4 px-4 pt-1 pb-2 bg-slate-100/95 backdrop-blur-sm">
            <AnnouncementCarousel
              announcements={announcements}
              adIndex={adIndex}
              onSelectSlide={setAdIndex}
            />
          </div>

          {/* ——— معلومات المشترك ——— */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              {profileLoading && (
                <div className="flex flex-col items-center py-16">
                  <div className="w-10 h-10 border-2 border-slate-200 border-t-[#2962FF] rounded-full animate-spin mb-3" />
                  <p className="text-slate-500 text-sm">جاري التحميل...</p>
                </div>
              )}
              {profileError && (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-100 text-red-700 text-sm">
                  {profileErr instanceof Error ? profileErr.message : 'تعذّر تحميل البيانات.'}
                </div>
              )}
              {!profileLoading && subscriber && (
                <>
                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#2962FF] to-[#1E40AF] flex items-center justify-center text-white shadow-md">
                        <User className="w-8 h-8" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-bold text-slate-800 truncate">{subscriber.fullName}</h2>
                        <p className="text-slate-500 text-sm truncate" dir="ltr">{subscriber.phoneNumber || '—'}</p>
                        <span
                          className={`inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            !subscriber.isExpired
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {!subscriber.isExpired ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                          {!subscriber.isExpired ? 'فعّال' : 'منتهي'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl px-5 shadow-sm border border-slate-100">
                    <InfoRow
                      label="الباقة"
                      value={
                        subscriber.salePrice != null
                          ? `${subscriber.profileName || '—'} (${formatNumber(subscriber.salePrice, { suffix: ' د.ع' })})`
                          : subscriber.profileName || '—'
                      }
                      icon={<Wifi className="w-5 h-5" />}
                    />
                    <InfoRow
                      label="اسم المستخدم"
                      value={<span dir="ltr">{subscriber.username || '—'}</span>}
                      icon={<User className="w-5 h-5" />}
                    />
                    <InfoRow
                      label="رقم الهاتف"
                      value={<span dir="ltr">{subscriber.phoneNumber || '—'}</span>}
                      icon={<Phone className="w-5 h-5" />}
                    />
                    {(subscriber.regionName || subscriber.agentResellerName) && (
                      <InfoRow
                        label="المنطقة / الرسيلر"
                        value={[subscriber.regionName, subscriber.agentResellerName].filter(Boolean).join(' · ')}
                        icon={<MapPin className="w-5 h-5" />}
                      />
                    )}
                    <InfoRow
                      label="الأيام المتبقية"
                      value={
                        subscriber.isExpired
                          ? 'منتهية'
                          : `باقي ${subscriber.daysRemaining} ${subscriber.daysRemaining === 1 ? 'يوم' : 'أيام'}`
                      }
                      icon={<Clock className="w-5 h-5" />}
                    />
                    {subscriber.expirationDate && (
                      <InfoRow
                        label="تاريخ الانتهاء"
                        value={formatDate(subscriber.expirationDate)}
                        icon={<Clock className="w-5 h-5" />}
                      />
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ——— طلبات الصيانة ——— */}
          {activeTab === 'maintenance' && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => {
                  setMaintenanceError('');
                  setShowMaintenanceModal(true);
                }}
                className="w-full py-3.5 rounded-2xl text-sm font-semibold bg-amber-500 text-white shadow-md shadow-amber-500/25 hover:bg-amber-600 active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                طلب صيانة جديد
              </button>

              {maintenanceLoading ? (
                <p className="text-slate-500 text-sm text-center py-12">جاري التحميل...</p>
              ) : maintenanceRequests.length === 0 ? (
                <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-slate-100">
                  <Wrench className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">لا توجد طلبات صيانة</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {maintenanceRequests.map((req) => (
                    <li key={req.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <p className="font-semibold text-slate-800 text-sm">
                          {req.problemTypeLabel || problemTypeLabel(req.problemType)}
                        </p>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${maintenanceStatusClass(req.status)}`}>
                          {req.statusLabel || req.status}
                        </span>
                      </div>
                      {req.description ? (
                        <p className="text-slate-600 text-sm mb-2">{req.description}</p>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        {req.createdAt ? (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {formatDate(req.createdAt)}
                          </span>
                        ) : null}
                        {req.alternativePhoneNumber ? (
                          <span className="inline-flex items-center gap-1" dir="ltr">
                            <Phone className="w-3.5 h-3.5" />
                            {req.alternativePhoneNumber}
                          </span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* ——— سجل التفعيلات ——— */}
          {activeTab === 'renewals' && (
            <div className="space-y-4">
              {renewalsLoading ? (
                <p className="text-slate-500 text-sm text-center py-12">جاري التحميل...</p>
              ) : renewals.length === 0 ? (
                <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-slate-100">
                  <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">لا توجد تفعيلات</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {renewals.map((r) => (
                      <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-semibold text-[#2962FF] bg-blue-50 px-2.5 py-1 rounded-full">
                            {renewalProfileName(r)}
                          </span>
                          <span className="text-xs text-slate-500">{formatDate(r.renewalDate)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-slate-500 mb-0.5">السعر</p>
                            <p className="font-semibold text-slate-800">
                              {formatNumber(r.finalPrice, { suffix: ' د.ع' })}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 mb-0.5">المدفوع</p>
                            <p className="font-semibold text-slate-800">
                              {formatNumber(r.amountPaid, { suffix: ' د.ع' })}
                            </p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-xs text-slate-500 mb-0.5">تاريخ الانتهاء</p>
                            <p className="font-semibold text-slate-800">{formatDate(r.newExpirationDate)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {(renewalsResponse?.totalPages ?? 1) > 1 && (
                    <div className="flex items-center justify-between bg-white rounded-2xl p-3 shadow-sm border border-slate-100">
                      <button
                        type="button"
                        disabled={!renewalsResponse?.hasPreviousPage}
                        onClick={() => setRenewalsPage((p) => Math.max(1, p - 1))}
                        className="p-2 rounded-xl disabled:opacity-40 text-[#2962FF] hover:bg-blue-50 transition-colors"
                        aria-label="الصفحة السابقة"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                      <span className="text-sm text-slate-600">
                        {renewalsResponse?.currentPage} / {renewalsResponse?.totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={!renewalsResponse?.hasNextPage}
                        onClick={() => setRenewalsPage((p) => p + 1)}
                        className="p-2 rounded-xl disabled:opacity-40 text-[#2962FF] hover:bg-blue-50 transition-colors"
                        aria-label="الصفحة التالية"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Bottom Navbar */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-safe z-40">
        <div className="max-w-lg mx-auto flex">
          {navItems.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 pt-3 min-h-[60px] transition-colors ${
                  active ? 'text-[#2962FF]' : 'text-slate-400'
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-colors ${active ? 'bg-blue-50' : ''}`}>
                  <Icon className={`w-5 h-5 ${active ? 'stroke-[2.5px]' : ''}`} />
                </div>
                <span className={`text-[11px] ${active ? 'font-bold' : 'font-medium'}`}>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Maintenance Modal */}
      {showMaintenanceModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowMaintenanceModal(false)}>
          <div
            className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto text-right"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-slate-800">طلب صيانة</h3>
              <button type="button" onClick={() => setShowMaintenanceModal(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500" aria-label="إغلاق">
                ×
              </button>
            </div>
            <form onSubmit={handleSubmitMaintenance} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">نوع المشكلة</label>
                <select
                  value={maintenanceForm.problemType}
                  onChange={(e) =>
                    setMaintenanceForm((f) => ({
                      ...f,
                      problemType: parseInt(e.target.value, 10) as SubscriberAppProblemType,
                    }))
                  }
                  className="w-full py-3 px-4 rounded-xl text-base text-right border border-slate-200 bg-slate-50 focus:border-[#2962FF] focus:ring-2 focus:ring-[#2962FF]/20 outline-none"
                  required
                >
                  {PROBLEM_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">وصف المشكلة (اختياري)</label>
                <textarea
                  value={maintenanceForm.description}
                  onChange={(e) => setMaintenanceForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="اشرح المشكلة..."
                  className="w-full py-3 px-4 rounded-xl text-base text-right border border-slate-200 bg-slate-50 focus:border-[#2962FF] outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">رقم هاتف بديل (اختياري)</label>
                <input
                  type="tel"
                  value={maintenanceForm.alternativePhoneNumber}
                  onChange={(e) => setMaintenanceForm((f) => ({ ...f, alternativePhoneNumber: e.target.value }))}
                  placeholder="07xxxxxxxx"
                  dir="ltr"
                  className="w-full py-3 px-4 rounded-xl text-base text-left border border-slate-200 bg-slate-50 focus:border-[#2962FF] outline-none"
                />
              </div>
              {maintenanceError ? <p className="text-red-600 text-sm">{maintenanceError}</p> : null}
              <button
                type="submit"
                disabled={createMaintenanceMutation.isPending}
                className="w-full py-3.5 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 disabled:opacity-60 transition-colors"
              >
                {createMaintenanceMutation.isPending ? 'جاري الإرسال...' : 'إرسال الطلب'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriberInfoPage;
