export enum UserRole {
  Admin = 1,
  Agent = 2,
  Subscriber = 3,
  Employee = 4,
  /** مدير ثانوي: نفس صلاحيات الوكيل، تابع للوكيل الذي أنشأه */
  SubAgent = 5,
  /** وكيل رئيسي: يدير وكلاء فرعيين (sub-agents) واشتراكه مخزن في User */
  MainAgent = 6,
}

export enum SubscriptionType {
  Free = 1,
  Paid = 2
}

export enum SubscriptionStatus {
  Active = 1,
  ExpiringSoon = 2,
  Expired = 3,
  ExpiredToday = 4
}

export enum PaymentStatus {
  Paid = 1,
  Unpaid = 2,
  Pending = 3,
  Unknown = 0  // للقيم غير المعرفة من الباكند
}

/** طريقة الدفع عند التفعيل — POST /Renewals */
export enum ActivationPaymentMethod {
  Cash = 1,
  Master = 2,
  Deferred = 3,
  CustomerWallet = 4,
}

/** قناة التفعيل — POST /Renewals */
export enum RenewalActivationChannel {
  Normal = 1,
  CustomerWallet = 2,
}

export enum SubscriberNoteType {
  NoResponse = 1,
  WillActivateSoon = 2,
  DoesNotWantActivation = 3,
  BadService = 4,
  NeedsMaintenance = 5,
  Other = 6,
}

export enum DebtStatus {
  Unpaid = 0,
  Paid = 1,
  Partial = 2
}

export interface SubscriberInfo {
  id: string;
  username: string;
  fullName: string;
  isActive: boolean;
  expirationDate: string;
  daysRemaining: number;
  isExpired: boolean;
  status: string;
  agentName: string;
  agentCompanyName: string;
  /** سعر الباقة (SalePrice) الذي حدده الوكيل للعرض في صفحة معلومات المشترك */
  salePrice?: number;
  /** طرق الدفع المفعلة من الوكيل (زين كاش، ماستر كارد، نقد) مع التفاصيل */
  paymentOptions?: PaymentOption[];
  /** إعلانات الوكيل (من الأحدث للأقدم) لعرضها في كروت الإعلانات */
  announcements?: AgentAnnouncementDto[];
  noteType?: SubscriberNoteType | null;
  note?: string | null;
  createdAt: string;
  lastRenewalDate?: string;
  totalRenewals: number;
}

/** طلب تسجيل دخول تطبيق المشترك — POST /SubscriberApp/login */
export interface SubscriberAppLoginRequest {
  fullName: string;
  username: string;
}

/** استجابة تسجيل دخول تطبيق المشترك — POST /SubscriberApp/login */
export interface SubscriberAppLoginResponse {
  token: string;
  expiresInSeconds: number;
  fullName: string;
  username: string;
  subscriberId: string;
  regionName?: string;
  agentResellerName?: string;
}

/** بيانات المشترك — GET /SubscriberApp/me */
export interface SubscriberAppMeResponse {
  id: string;
  username: string;
  fullName: string;
  phoneNumber: string;
  expirationDate: string;
  daysRemaining: number;
  isExpired: boolean;
  profileName: string;
  salePrice?: number;
  regionName?: string;
  agentResellerName?: string;
  paymentOptions?: PaymentOption[];
  announcements?: AgentAnnouncementDto[];
}

/** سجل تفعيل — GET /SubscriberApp/renewals */
export interface SubscriberAppRenewalDto {
  id: string;
  receiptNumber?: string;
  finalPrice: number;
  amountPaid: number;
  remainingAmount: number;
  renewalDate: string;
  newExpirationDate: string;
  newProfileName?: string;
  paymentStatus?: number;
  wifiCode?: string | null;
}

/** أنواع مشاكل طلب الصيانة في تطبيق المشترك */
export enum SubscriberAppProblemType {
  SubscriptionRenewal = 1,
  WeakInternet = 2,
  NetworkPasswordChange = 3,
  CableCut = 4,
  Other = 5,
}

export type SubscriberMaintenanceRequestStatus = 'pending' | 'inProgress' | 'completed' | 'cancelled';

export interface SubscriberMaintenanceRequestCreate {
  problemType: SubscriberAppProblemType;
  description?: string;
  alternativePhoneNumber?: string;
}

export interface SubscriberMaintenanceRequestDto {
  id: string;
  problemType: SubscriberAppProblemType | number;
  problemTypeLabel?: string;
  description?: string;
  alternativePhoneNumber?: string;
  status: SubscriberMaintenanceRequestStatus;
  statusLabel?: string;
  createdAt?: string;
}

/** حالة طلب الصيانة (API الوكيل) — 1 قيد الانتظار، 2 قيد المعالجة، 3 مكتمل، 4 ملغي */
export enum SubscriberMaintenanceRequestStatusCode {
  Pending = 1,
  InProgress = 2,
  Completed = 3,
  Cancelled = 4,
}

/** طلب صيانة مشترك — GET /SubscriberMaintenanceRequests/agent */
export interface AgentSubscriberMaintenanceRequestDto {
  id: string;
  subscriberId?: string;
  problemType: SubscriberAppProblemType | number;
  problemTypeLabel?: string;
  description?: string;
  alternativePhoneNumber?: string;
  status: SubscriberMaintenanceRequestStatusCode | number;
  statusLabel?: string;
  createdAt?: string;
  updatedAt?: string;
  acceptedAt?: string;
  subscriberFullName?: string;
  subscriberUsername?: string;
  subscriberPhoneNumber?: string;
  regionName?: string;
  agentResellerName?: string;
}

export enum IraqGovernorates {
  Baghdad = 1,
  Basra = 2,
  Mosul = 3,
  Erbil = 4,
  Sulaymaniyah = 5,
  Dohuk = 6,
  Kirkuk = 7,
  Anbar = 8,
  Karbala = 9,
  Najaf = 10,
  Babylon = 11,
  Wasit = 12,
  Diyala = 13,
  Salahuddin = 14,
  Maysan = 15,
  Muthanna = 16,
  DhiQar = 17,
  Qadisiyyah = 18
}

export enum SubscriptionSystemType {
  Yearly = 1,
  Daily = 2
}

export enum RenewalCalculationType {
  Fixed = 0,
  MonthlyEnd = 1
}

// Auth Types
export interface LoginRequest {
  username: string;
  password: string;
  /** توكن Cloudflare Turnstile (يُرسل للباكند للتحقق) */
  turnstileToken?: string;
}

export interface LoginResponse {
  token: string;
  expiresInSeconds: number;
  role: string;
  roleId?: number;
  tenantPlanType?: TenantPlanType | null;
  standardPlanTierId?: StandardPlanTier | null;
  standardPlanTier?: 'economy' | 'plus' | 'gold' | null;
  /** null = غير محدود (Vip أو بيانات قديمة) */
  maxResellers?: number | null;
  /** عند true: الباكند لا يتوقع استدعاء GET /users/me أو مزامنة وكيل — نبني المستخدم من الاستجابة والـ JWT */
  skipAgentsMeAndSync?: boolean;
  pendingEmployeeTasksCount?: number;
  errorMessage?: string | null;
}

/** GET /me/features */
export interface MeFeaturesResponse {
  tenantId?: string;
  features: string[];
  globalAccess: boolean;
}

// System Message (for agents)
export interface SystemMessageResponse {
  message: string;
  expiresAt: string; // ISO date
}

export interface SystemMessageCreateRequest {
  message: string;
  durationMinutes: number;
}

/** استجابة رسالة التفعيل أو التنبيه (قالب من الباكند) */
export interface MessageTemplateResponse {
  template: string;
}

// SAS provider sync
export interface SasSyncRequest {
  baseUrl: string;
  username: string;
  password: string;
  /** اختياري — إن وُجد يُستخدم مباشرة دون محاولة تسجيل الدخول من السيرفر */
  token?: string;
}

export interface SasSyncResponse {
  message: string;
  synced: number;
}

/** استجابة POST /providers/sas/sync-using-saved-credentials — المزامنة باستخدام الاعتماديات المحفوظة فقط */
export interface SasSyncUsingSavedCredentialsResponse {
  message: string;
  agentId?: string;
  synced: number;
  onlineCount: number;
}

/** طلب POST /api/providers/sas/sync-subscribers — جلب قائمة المزامنة. الجسم اختياري إن وُجدت اعتماديات من رسيلر محفوظ. */
export interface SyncSubscribersRequest {
  /** مطلوب عند عدم استخدام رسيلر (resellerId). */
  baseUrl?: string;
  username?: string;
  password?: string;
  /** اختياري — يُمرَّر في الـ query. للوكيل اختياري، للأدمن مطلوب عند اختيار وكيل. */
  agentId?: string;
  /** اختياري — يُمرَّر في الـ query. عند الإرسال تُستخدم اعتماديات هذا الرسيلر المحفوظة (بدون إرسال الجسم). */
  resellerId?: string;
}

/** عنصر في قائمة المشتركين المُرجعة من POST sync-subscribers (مع type/type_ar من المعاملات عند توحيد المزامنة) */
export interface SyncSubscribersDataItem {
  id: number;
  username: string;
  firstname: string;
  lastname: string | null;
  expiration: string;
  phone: string | null;
  profile_details: { name: string };
  customer_id?: string;
  customer_name?: string;
  zone?: string;
  /** طريقة الدفع في FTTH (مثال: Wallet / Card) */
  payment_method?: string;
  /** من المعاملات عند دمج المزامنة — اختياري */
  type?: string;
  /** من المعاملات: شراء اشتراك / تجديد الاشتراك / اشتراك تجريبي */
  type_ar?: string;
}

/** استجابة POST /api/providers/sas/sync-subscribers */
export interface SyncSubscribersResponse {
  data: SyncSubscribersDataItem[];
  provider?: string;
  serviceFees?: ServiceFees[];
}

/** معاملات (قائمة ثانية للمعاينة) — POST /api/providers/sas/sync-transactions (mode=transactions). النوع: PLAN_PURCHASE → شراء اشتراك، PLAN_RENEW → تجديد، TRIAL_PERIOD → اشتراك تجريبي */
export interface TransactionItem {
  username: string;
  expiration: string;
  customer_id?: string;
  customer_name?: string;
  zone?: string;
  profile_name?: string;
  type_ar: string;
  /** اختياري — إن وُجد من الباكند */
  wallet_owner_type?: string | null;
  /** اختياري — نفس حقل المزامنة عند توحيد الاستجابة */
  payment_method?: string;
}

/** طلب POST /api/providers/sas/sync-transactions — نفس آلية sync-subscribers (agentId, resellerId + اعتماديات اختيارية) */
export interface SyncTransactionsRequest {
  baseUrl?: string;
  username?: string;
  password?: string;
  agentId?: string;
  resellerId?: string;
}

/** استجابة POST /api/providers/sas/sync-transactions */
export interface SyncTransactionsResponse {
  data: TransactionItem[];
  provider?: string;
  mode?: string; // متوقع "transactions"
}

/** عنصر معاملة خام يُرسل إلى POST /api/providers/sas/cashback-transactions */
export interface CashbackTransactionInputItem {
  id: number;
  occuredAt: string;
  planPrice?: number;
  discountType?: string;
  discountAmount?: number;
  subscriptionName?: string;
  subscriptionStartsAt?: string;
  subscriptionEndsAt?: string;
  deviceUsername?: string;
  zoneId?: string;
  partnerId?: string;
  partnerName?: string;
  customerName?: string;
  createdBy?: string;
  walletOwnerType?: string;
  paymentMode?: string;
  paymentMethod?: string;
}

/** ربح الباقة لكل تفعيل (يُمرَّر للباكند لحساب/عرض نسب الربح في التقرير والـ Excel) */
export interface CashbackPlanProfitInput {
  subscriptionName: string;
  profitPerActivation: number;
}

/** باقات الوكيل المتاحة لحساب الكاش باك — GET /api/providers/sas/cashback-transactions/packages */
export interface CashbackPackageDto {
  profileId: string;
  subscriptionName: string;
  originalPrice?: number;
  salePrice?: number;
  profitPerActivation: number;
}

/** طلب POST /api/providers/sas/cashback-transactions */
export interface CashbackTransactionsRequest {
  /** ثانوي عند وجود المفاتيح — يُفضَّل اتساقاً معها (مثل نفس التاريخ + T00:00:00.000Z) للعرض */
  fromDate: string;
  /** مثل fromDate لنهاية النطاق */
  toDate: string;
  /**
   * يوم تقويمي yyyy-MM-dd يعكس اليوم الظاهر في منتقي التاريخ (مكوّن من سنة/شهر/يوم التقويم المحلي).
   * عند الإرسال مع toDateKey يكون المصدر الموثوق للفلترة؛ الباكند يطبّق منطق بغداد على الزوج.
   */
  fromDateKey?: string;
  /** آخر يوم شامل بنفس أسلوب fromDateKey */
  toDateKey?: string;
  zoneIds?: string[];
  data: CashbackTransactionInputItem[];
  planProfits?: CashbackPlanProfitInput[];
  saveRecord?: boolean;
  /** اختياري عند الحفظ — إن لم يُرسل يُحفظ 0 حتى التحديث لاحقاً */
  totalCashbackAmount?: number;
  cashbackReceivedAt?: string;
}

/** صف نهائي جاهز للتصدير من استجابة cashback-transactions */
export interface CashbackTransactionRow {
  [key: string]: unknown;
}

/** استجابة POST /api/providers/sas/cashback-transactions أو POST .../cashback-transactions/fetch (JSON) */
export interface CashbackTransactionsResponse {
  rows: CashbackTransactionRow[];
  totalActivations?: number;
  subscriberOrMasterActivations?: number;
  agentWalletActivations?: number;
  saved?: boolean;
  /** معرف سجل الكاش باك المحفوظ */
  savedRecordId?: string;
  subscriptionStartMonth?: number;
  subscriptionStartYear?: number;
  subscriptionEndMonth?: number;
  subscriptionEndYear?: number;
  filterFromDate?: string;
  filterToDate?: string;
  zoneIds?: string[];
  cashbackReceivedAt?: string;
  /** شهر الراجع (1–12) من «من تاريخ» الفلترة — للعرض والتخزين */
  cashbackMonth?: number;
  /** سنة الراجع من «من تاريخ» الفلترة */
  cashbackYear?: number;
}

/** عنصر من GET /api/providers/sas/cashback-transactions/records */
export interface CashbackTransactionRecordDto {
  id: string;
  /** إن عادها الباكند يُفضَّل استخدامها عند تنزيل Excel بدل اختيار الرسيلر يدوياً */
  resellerId?: string;
  /** للأدمن عند جلب سجلات أكثر من وكيل — لتمرير agentId عند إعادة طلب التقرير */
  agentId?: string;
  cashbackMonth?: number;
  cashbackYear?: number;
  filterFromDate?: string;
  filterToDate?: string;
  /** إن عادها الباكند مع السجل يُستخدم لتنزيل Excel بنفس نية التقويم */
  fromDateKey?: string;
  toDateKey?: string;
  zoneIds?: string[];
  /** إن عاد السيرفر نصاً مفصولاً بفواصل */
  zoneIdsCsv?: string;
  /** المبلغ المتوقع المحفوظ في السجل (من الوكيل عند الحفظ أو عبر PUT .../total) */
  totalCashbackAmount?: number;
  /** المبلغ الحقيقي بعد مراجعة الإكسل — يُحدَّث من الواجهة عبر PUT .../records/{id}/real-total */
  realTotalCashbackAmount?: number | null;
  cashbackReceivedAt?: string;
  totalActivations?: number;
  agentWalletActivations?: number;
  subscriberOrMasterActivations?: number;
  subscriptionStartMonth?: number;
  subscriptionStartYear?: number;
  subscriptionEndMonth?: number;
  subscriptionEndYear?: number;
  planProfits?: CashbackPlanProfitInput[];
  createdAt?: string;
}

/** جسم PUT /api/providers/sas/cashback-transactions/records/{id}/real-total */
export interface CashbackRecordRealTotalUpdateRequest {
  realTotalCashbackAmount: number;
}

/** جسم PUT /api/providers/sas/cashback-transactions/records/{id}/total — يجب أن يكون المبلغ > 0 */
export interface CashbackExpectedTotalUpdateRequest {
  totalCashbackAmount: number;
}

/** رد PUT .../records/{id}/total */
export interface CashbackExpectedTotalUpdateResponse {
  id: string;
  totalCashbackAmount: number;
}

/** استجابة GET /api/providers/sas/cashback-transactions/zones */
export interface CashbackSubscriberZonesResponse {
  zones: string[];
}

/** صف فرق المزامنة — GET .../synchronizationFTTH/diff أو .../synchronizationSAS/diff */
export interface CashbackSynchronizationFtthRow {
  subscriberId?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  subscriptionName?: string | null;
  subscriptionEndsAt?: string | null;
  localSubscriptionEndsAt?: string | null;
  zoneId?: string | null;
  deviceUsername?: string | null;
  activationType?: string | null;
  /** حقول SAS/Zain Fi diff الجديدة */
  subscriberName?: string | null;
  expirationDate?: string | null;
  offerName?: string | null;
  diffFields?: string[];
  externalMsisdn?: string | null;
  localUsername?: string | null;
  localActivationDate?: string | null;
  externalEndDate?: string | null;
  localExpirationDate?: string | null;
  externalOfferName?: string | null;
  localProfileName?: string | null;
  externalSubscriptionActive?: boolean | null;
  localSubscriptionActive?: boolean | null;
  /** حقول SAS القديمة */
  firstname?: string | null;
  profile_details?: { name?: string | null } | null;
  new_expiration?: string | null;
  parent_username?: string | null;
  username?: string | null;
  activation_method?: string | null;
}

/** جسم POST .../synchronizationFTTH/save أو .../synchronizationSAS/save */
export interface SynchronizationDiffSaveRequest {
  customerId?: string;
  customerName?: string;
  deviceUsername?: string;
  subscriptionName?: string;
  subscriptionEndsAt?: string;
  zoneId?: string;
  serviceFeesId?: string;
  serviceFeesAmountPaid?: number;
}

/** فترة تفعيل واحدة ضمن مزامنة FTTH (شهر/فاتورة) */
export interface FtthSyncPeriodDraft {
  label: string;
  renewalDate?: string;
  newExpirationDate?: string;
  /** واصل اشتراك هذا الشهر */
  subscriptionFullyPaid?: boolean;
  amountPaid?: number;
  remainingAmount?: number;
  debtDescription?: string;
  /** تفعيل كل أجر خدمة لهذا الشهر */
  serviceFeesEnabled?: Record<string, boolean>;
  /** واصل/غير واصل لكل أجر خدمة لهذا الشهر */
  serviceFeesFullyPaid?: Record<string, boolean>;
}

/** سياق صف مزامنة FTTH عند فتح مودال التفعيل */
export interface FtthCompareSyncContext {
  row: FtthSubscriptionsCompareItem;
  rowIndex: number;
  isNewSubscriber: boolean;
  resellerId: string;
  zone?: string | null;
  periodCount: number;
  /** تفعيل من محفظة الزبون/التطبيق */
  walletSync?: boolean;
}

/** كائن العميل من سكربت FTTH */
export interface FtthSubscriptionsCompareCustomer {
  id?: string | null;
  displayValue?: string | null;
}

/** مبلغ الاستقطاع من الرصيد — transactionAmount من سكربت FTTH */
export interface FtthTransactionAmount {
  currency?: string | null;
  value?: number | null;
}

/** صف مقارنة FTTH — POST /providers/sas/ftth-subscriptions/compare */
export interface FtthSubscriptionsCompareItem {
  basePlanRenewalCount?: number | null;
  createdBy?: string | null;
  customerName?: string | null;
  /** معرف العميل في FTTH */
  customerId?: string | null;
  customer?: FtthSubscriptionsCompareCustomer | null;
  ftthActivation?: string | null;
  ftthExpiration?: string | null;
  isNewSubscriber?: boolean;
  localActivation?: string | null;
  localExpiration?: string | null;
  packageName?: string | null;
  paymentType?: string | null;
  planPrice?: number | null;
  transactionAmount?: FtthTransactionAmount | number | null;
  operationType?: string | null;
  transactionType?: string | null;
  sameDayBasePlanRenewalCount?: number | null;
  username?: string | null;
}

/** استجابة POST /providers/sas/ftth-subscriptions/compare */
export interface FtthSubscriptionsCompareResponse {
  success: boolean;
  count: number;
  items: FtthSubscriptionsCompareItem[];
  error?: string | null;
  zone?: string | null;
  partnerId?: string | null;
}

/** عنصر من POST /providers/sas/ftth-transactions/app (مقارنة محفظة الزبون) */
export interface FtthAppTransactionsItem {
  activationCount: number;
  customerId: string;
  customerName: string;
  endsAt?: string | null;
  isNewSubscriber: boolean;
  localActivation?: string | null;
  localExpiration?: string | null;
  occuredAt?: string | null;
  packageName?: string | null;
  paymentType?: string | null;
  planPrice: number;
  transactionAmount?: FtthTransactionAmount | number | null;
  operationType?: string | null;
  transactionType?: string | null;
  startsAt?: string | null;
  username: string;
}

/** استجابة POST /providers/sas/ftth-transactions/app */
export interface FtthAppTransactionsResponse {
  success: boolean;
  count?: number;
  agentId?: string | null;
  baseUrl?: string | null;
  name?: string | null;
  resellerId?: string | null;
  totalCount: number;
  items: FtthAppTransactionsItem[];
  error?: string | null;
}

/** استجابة GET .../synchronizationFTTH/diff أو .../synchronizationSAS/diff */
export interface CashbackSynchronizationFtthResponse {
  externalRowCount?: number;
  localSubscriberCount?: number;
  matchedPairCount?: number;
  /** الصفوف ذات اختلاف تاريخ الانتهاء (من الباكند: differences) */
  data: CashbackSynchronizationFtthRow[];
  serviceFees?: ServiceFees[];
  /** حقول قديمة */
  provider?: string;
  mode?: string;
  dateRange?: {
    fromDate?: string;
    toDate?: string;
  };
  count?: number;
}

/** جسم POST /api/providers/sas/cashback-transactions/fetch — مثل الكاش باك بدون data (السيرفر يجلب FTTH من اعتماديات الرسيلر) */
export type CashbackFetchBody = Omit<CashbackTransactionsRequest, 'data'>;

/** نوع العميل — GET/POST /api/CustomerInvoices */
export enum CustomerInvoiceCustomerType {
  NewCustomer = 0,
  Agent = 1,
}

/** طريقة الدفع — GET/POST /api/CustomerInvoices */
export enum CustomerInvoicePaymentMethod {
  Cash = 0,
  MasterCard = 1,
  ZainCash = 2,
  Other = 3,
}

/** عميل — GET /api/CustomerInvoices (قائمة)؛ قد تتضمن مجاميع للعرض */
export interface CustomerInvoiceCustomerDto {
  id: string;
  agentId: string;
  createdByUserId?: string;
  customerName: string;
  /** قد يُحتفَظ به للترحيل من البيانات القديمة */
  customerUsername?: string | null;
  address?: string | null;
  phoneNumber?: string | null;
  customerType: CustomerInvoiceCustomerType | number;
  createdAt?: string;
  updatedAt?: string | null;
  /** مجاميع اختيارية لصف القائمة */
  balanceAmount?: number;
  transferAmount?: number;
  debtAmount?: number;
  debtPaid?: number;
  debtRemaining?: number;
  invoicesCount?: number;
}

/** سجل فاتورة مرتبط بعميل */
export interface CustomerInvoiceRecordDto {
  id: string;
  customerId: string;
  balanceAmount: number;
  transferAmount: number;
  /** غالباً balanceAmount − transferAmount في الـ API */
  debtAmount?: number;
  debtPaid?: number;
  debtRemaining?: number;
  paymentMethod: CustomerInvoicePaymentMethod | number;
  createdAt: string;
  updatedAt?: string | null;
}

/** GET /api/CustomerInvoices/{customerId} — العميل + كل فواتيره */
export interface CustomerInvoiceDetailDto extends CustomerInvoiceCustomerDto {
  invoices: CustomerInvoiceRecordDto[];
}

/** إحصائيات GET /CustomerInvoices — على النتائج المفلترة فقط */
export interface CustomerInvoiceStatisticsDto {
  totalDebtAmount: number;
  totalDebtPaid: number;
  totalDebtRemaining: number;
  totalBalanceAmount: number;
  totalTransferAmount: number;
  customerCount: number;
}

/** استجابة GET /CustomerInvoices */
export interface CustomerInvoicesListResponse {
  items: CustomerInvoiceCustomerDto[];
  statistics: CustomerInvoiceStatisticsDto;
}

/** جسم POST /api/CustomerInvoices — إنشاء عميل فقط */
export interface CustomerInvoiceCustomerCreateDto {
  customerName: string;
  phoneNumber?: string | null;
  address?: string | null;
  customerType: CustomerInvoiceCustomerType | number;
}

/** جسم PUT /api/CustomerInvoices/{customerId} — تعديل بيانات العميل */
export type CustomerInvoiceCustomerUpdateDto = CustomerInvoiceCustomerCreateDto;

/** جسم POST /api/CustomerInvoices/{customerId}/invoices — فاتورة (يُحسب debtAmount = balance − transfer) */
export interface CustomerInvoiceRecordCreateDto {
  balanceAmount: number;
  transferAmount: number;
  paymentMethod: CustomerInvoicePaymentMethod | number;
}

/** استجابة POST /api/CustomerInvoices/{id}/send-whatsapp */
export interface CustomerInvoiceSendWhatsAppResponse {
  message?: string;
  messageId?: string;
}

/** جسم POST /api/CustomerInvoices/{id}/pay-debt */
export interface CustomerInvoicePayDebtRequest {
  amount: number;
}

/** طلب POST /api/providers/sas/update-subscription — تفعيل مشترك واحد من القائمة */
export interface UpdateSubscriptionRequest {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  expiration: string;
  phone: string | null;
  profileName: string;
  /** إذا كان false: تفعيل بدون خصم من الرصيد مع إضافة دين للمشترك. إن لم يُرسَل أو true يُعتبر مدفوعاً. */
  isPaid?: boolean;
  /** عند isPaid: false — مبلغ الدين المُضاف. إن لم يُرسَل يُستخدم سعر الباقة (SalePrice). */
  debtAmount?: number;
}

/** استجابة POST /api/providers/sas/update-subscription */
export interface UpdateSubscriptionResponse {
  message: string;
  subscriberId?: string;
  renewalId?: string;
}

/** طلب POST /api/providers/sas/save-subscriber — يحدّث التاريخ فقط (انتهاء + اشتراك). الاستعلام: agentId اختياري، isFtth=true لـ FTTH. */
export interface SaveSubscriberFromSyncRequest {
  username: string;
  customerName?: string;
  expiration: string;
  profileName?: string;
  serviceFeesId?: string;
  serviceFeesAmountPaid?: number;
  /** حقول إضافية اختيارية */
  customer_id?: string;
  customer_name?: string;
  profile_name?: string;
  zone?: string;
  type_ar?: string | null;
  activationDate?: string;
}

/** عنصر واحد من SAS (overview) للمرسل إلى sync-from-data */
export interface SasOverviewDataItem {
  id: number;
  username: string;
  firstname: string;
  profile_Name: string;
  password: string;
  phone: string;
  expiration: string; // "2025-03-01 00:00:00"
}

export interface SasSyncFromDataRequest {
  users: SasOverviewDataItem[];
}

/** بيانات اعتماد SAS للوكيل (من GET /providers/sas/credentials) */
export interface SasCredentialsItem {
  agentId: string;
  agentName: string;
  serviceType: ServiceType; // 1 FTTH, 2 SAS
  /** رابط SAS (فارغ إذا الوكيل FTTH فقط) */
  baseUrl: string;
  /** رابط FTTH (فارغ إذا الوكيل SAS فقط) */
  ftthBaseUrl: string;
  username: string;
  password: string;
}

/** اعتماديات رسيلر (من GET /providers/sas/resellers-credentials) — للأدمن، كلمة السر صريحة، ترتيب من الأحدث أولاً */
export interface AgentResellerCredentialsDto {
  agentId: string;
  agentName: string;
  resellerId: string;
  name: string;
  serviceType: ServiceType;
  baseUrl: string;
  username: string | null;
  /** كلمة السر بشكل صريح (بعد فك التشفير) */
  password: string;
  createdAt: string;
}

// User Types
/** صلاحيات الموظف (Employee) — تُطبّق في الباكند عند دور Employee فقط */
export interface EmployeePermissions {
  canActivateSubscriber: boolean;
  canEditSubscriber: boolean;
  canDeleteSubscriber: boolean;
  canPayDebt: boolean;
  canAccessAccounts: boolean;
  canAccessInvoices: boolean;
  canAccessExpensesAndSalarySheet: boolean;
  /** مشاهدة لوحة تحكم المشتركين (GET /api/Subscribers/dashboard). افتراضي false. */
  canAccessSubscriberDashboard: boolean;
  /** عرض قائمة كل المشتركين بدون فلتر اسم. إن false يُرجع API قائمة فارغة إلا مع SearchTerm. افتراضي false. */
  canViewAllSubscribers: boolean;
  /** السماح باستلام وتنفيذ طلبات المهام (EmployeeTasks). افتراضي false. */
  canReceiveTaskRequests: boolean;
}

export const DEFAULT_EMPLOYEE_PERMISSIONS: EmployeePermissions = {
  canActivateSubscriber: true,
  canEditSubscriber: true,
  canDeleteSubscriber: true,
  canPayDebt: true,
  canAccessAccounts: true,
  canAccessInvoices: true,
  canAccessExpensesAndSalarySheet: true,
  canAccessSubscriberDashboard: false,
  canViewAllSubscribers: false,
  canReceiveTaskRequests: false,
};

/** تسميات الصلاحيات للعرض في الواجهة */
export const EMPLOYEE_PERMISSION_LABELS: Record<keyof EmployeePermissions, string> = {
  canActivateSubscriber: 'تفعيل مشترك',
  canEditSubscriber: 'تعديل مشترك',
  canDeleteSubscriber: 'حذف مشترك',
  canPayDebt: 'تسديد دين',
  canAccessAccounts: 'الوصول إلى الحسابات (رصيد، حساب يومي، تسليم)',
  canAccessInvoices: 'الوصول إلى الفواتير (إيصالات)',
  canAccessExpensesAndSalarySheet: 'الوصول إلى المصاريف وكشوفات الموظفين',
  canAccessSubscriberDashboard: 'مشاهدة لوحة تحكم المشتركين',
  canViewAllSubscribers: 'عرض كل المشتركين (بدون اشتراط البحث بالاسم)',
  canReceiveTaskRequests: 'استلام طلبات المهام',
};

export interface User {
  id: string;
  username: string;
  fullName: string;
  isActive: boolean;
  role: UserRole;
  tenantPlanType?: TenantPlanType;
  standardPlanTierId?: StandardPlanTier | null;
  standardPlanTier?: 'economy' | 'plus' | 'gold' | null;
  /** null = غير محدود */
  maxResellers?: number | null;
  createdByAgentName?: string;
  /** معرف الوكيل للمستخدم من نوع Agent أو الموظف التابع لوكيل */
  agentId?: string;
  /** صلاحيات الموظف (موجودة عندما role = Employee) */
  canActivateSubscriber?: boolean;
  canEditSubscriber?: boolean;
  canDeleteSubscriber?: boolean;
  canPayDebt?: boolean;
  canAccessAccounts?: boolean;
  canAccessInvoices?: boolean;
  canAccessExpensesAndSalarySheet?: boolean;
  canAccessSubscriberDashboard?: boolean;
  canViewAllSubscribers?: boolean;
  canReceiveTaskRequests?: boolean;
  allowedResellerIds?: string[];
  /** اشتراك الوكيل الرئيسي (عندما role = MainAgent) */
  subscriptionType?: SubscriptionSystemType;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
}

export interface UserCreateRequest {
  username: string;
  fullName: string;
  password: string;
  role: UserRole;
  /** للوكيل الرئيسي (MainAgent) */
  subscriptionType?: SubscriptionSystemType;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  /** صلاحيات الموظف (عند role = Employee) أو حسب ما يقبله الباكند */
  canActivateSubscriber?: boolean;
  canEditSubscriber?: boolean;
  canDeleteSubscriber?: boolean;
  canPayDebt?: boolean;
  canAccessAccounts?: boolean;
  canAccessInvoices?: boolean;
  canAddMaterial?: boolean;
  canDisburseMaterial?: boolean;
  canAccessExpensesAndSalarySheet?: boolean;
  canAccessSubscriberDashboard?: boolean;
  canViewAllSubscribers?: boolean;
  canReceiveTaskRequests?: boolean;
}

export interface UserUpdateRequest {
  fullName: string;
  isActive: boolean;
  role: UserRole;
  /** للوكيل الرئيسي (MainAgent) */
  subscriptionType?: SubscriptionSystemType;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
}

/** طلب تسجيل وكيل — POST /AgentRegistration/register (بدون تسجيل دخول) */
export type AgentRegistrationServiceType = 'ftth' | 'sas' | 'earthlink';

export interface AgentRegistrationRequest {
  fullName: string;
  /** 11 رقماً حسب الباكند */
  phone: string;
  serviceType: AgentRegistrationServiceType;
  resellerBaseUrl: string;
  resellerUsername: string;
  resellerPassword: string;
  loginUsername: string;
  /** يُثبته الباكند تلقائياً حالياً (12345) */
  loginPassword?: string;
}

/** استجابة POST /AgentRegistration/register */
export interface AgentRegistrationRegisterResponse {
  message?: string;
  loginUsername?: string;
  defaultPassword?: string;
  whatsAppUrl?: string;
  whatsAppMessage?: string;
}

/** موافقة الأدمن — POST /AgentRegistration/approve */
export interface AgentRegistrationApproveRequest {
  /** نفس loginUsername في الطلب */
  username: string;
  subscriptionStartDate: string;
  subscriptionEndDate: string;
}

export interface AgentRegistrationApproveResponse {
  message?: string;
  agentId?: string;
  userId?: string;
}

// ربط SAS/FTTH/Earthlink للتفعيل عبر تاب المتصفح
export enum ServiceType {
  Ftth = 1,
  Sas = 2,
  Earthlink = 3,
}

export enum TenantPlanType {
  Standard = 0,
  Vip = 1,
}

/** طبقات الخطة القياسية (Standard) */
export enum StandardPlanTier {
  Economy = 0,
  Plus = 1,
  Gold = 2,
}

export enum EmployeeTaskType {
  SubscriberInstallation = 1,
  SubscriberMaintenance = 2,
  Other = 3,
  AmountReception = 4,
}

export enum SubscriberMaintenanceKind {
  CableCut = 1,
  ServiceProblem = 2,
  RouterPasswordChange = 3,
  Other = 4,
}

export enum EmployeeTaskStatus {
  Pending = 1,
  Accepted = 2,
  Completed = 3,
}

/** رابط إدارة المستخدمين عند نوع الخدمة Earthlink */
export const EARTHLINK_USER_MANAGEMENT_URL = 'https://admin.earthlink.iq/UserManagement.aspx';

export interface SasActivationLinkResponse {
  serviceType: ServiceType;
  /** عند ServiceType.Sas */
  url?: string;
  /** عند ServiceType.Ftth */
  loginUrl?: string;
  /** عند ServiceType.Ftth: رابط تفاصيل المشترك https://admin.ftth.iq/customer-details/{FtthSubscriptionId}/details/view */
  activationUrl?: string;
  /** معرف المشترك (SecruptionId) — يُرجَع من الباكند لاستخدامه في رابط FTTH */
  secruptionId?: string;
}

/** منطقة وكيل — GET/POST/PUT/DELETE /Agents/me/regions */
export interface AgentRegion {
  id: string;
  agentId?: string;
  name: string;
  displayOrder?: number;
  resellers?: AgentReseller[];
}

export interface AgentRegionCreateRequest {
  name: string;
  displayOrder?: number;
}

export interface AgentRegionUpdateRequest {
  name: string;
  displayOrder?: number;
}

/** أجور الخدمة — GET/POST/PUT/DELETE /ServiceFees */
export interface ServiceFees {
  id: string;
  agentId: string;
  name: string;
  price: number;
}

export interface ServiceFeesCreateRequest {
  name: string;
  price: number;
  agentId?: string;
}

export interface ServiceFeesUpdateRequest {
  name: string;
  price: number;
}

/** رسيلر وكيل (SAS / FTTH / Earthlink) — من GET/POST/PUT /Agents/me/resellers */
export interface AgentReseller {
  id: string;
  agentId?: string;
  regionId?: string;
  regionName?: string | null;
  name: string;
  serviceType: ServiceType;
  baseUrl: string;
  username: string | null;
  telegramChatId?: string | null;
  /** كلمة مرور الرسيلر — تُرجَع من GET /Agents/me/resellers لاستخدامها في تفعيل SAS عبر سكربت البايثون */
  password?: string | null;
  /** معرف الشريك في FTTH (partnerId) لسحب المعاملات والمقارنة */
  ftthPartnerId?: string | null;
  displayOrder: number;
  /** رصيد التفعيل لهذه المنطقة (من الباكند) */
  balanceIqd?: number;
  whatsAppSessionId?: string | null;
}

/** طلب إضافة رسيلر — POST /Agents/me/resellers */
export interface AgentResellerCreateRequest {
  regionId: string;
  name: string;
  serviceType: ServiceType;
  baseUrl: string;
  username?: string | null;
  telegramChatId?: string | null;
  password?: string | null;
  displayOrder?: number;
  whatsAppSessionId?: string | null;
}

export interface ResellerWhatsAppSessionRequest {
  whatsAppSessionId: string;
}

/** طلب تعديل رسيلر — PUT /Agents/me/resellers/{id}. إن حذفت password أو أرسلت فارغاً لا تُغيّر كلمة المرور. */
export interface AgentResellerUpdateRequest {
  name: string;
  serviceType: ServiceType;
  baseUrl: string;
  username?: string | null;
  telegramChatId?: string | null;
  password?: string | null;
  displayOrder?: number;
}

/** جسم POST /providers/sas/ftth-subscribers-export — اعتماديات FTTH (أو {} إن وُجدت على الرسيلر في الباكند) */
export interface FtthSubscribersExportBody {
  baseUrl?: string;
  username?: string;
  password?: string;
}

/** رد POST /providers/sas/ftth-subscribers-export */
export interface FtthSubscribersExportResponse {
  data?: unknown[];
  provider?: string;
  mode?: string;
  includeAllStatuses?: boolean;
  error?: string;
  serviceFees?: ServiceFees[];
  /** FTTH: الاستيراد يتم تلقائياً أثناء التصدير */
  import?: FtthSubscribersImportResponse;
}

/** رد POST /providers/sas/ftth-subscribers-import */
export interface FtthSubscribersImportResponse {
  imported?: number;
  skippedDuplicate?: number;
  phoneUpdated?: number;
  updated?: number;
  errors?: number;
  errorMessages?: string[];
}

/** جسم POST /providers/sas/sas-subscribers-export — يدعم login الكلاسيكي أو token المباشر */
export interface SasSubscribersExportBody extends FtthSubscribersExportBody {
  /** توكن جاهز (اختياري) — عند تمريره يتجاوزه الباكند على login التقليدي */
  token?: string;
  /** مسار user API في لوحة SAS (اختياري). الافتراضي في الباكند: admin/api/index.php/api/index/user */
  userPath?: string;
}

/** رد POST /providers/sas/sas-subscribers-export */
export type SasSubscribersExportResponse = FtthSubscribersExportResponse;

/** رد POST /providers/sas/sas-subscribers-import */
export type SasSubscribersImportResponse = FtthSubscribersImportResponse;

/** استجابة تحديث حالة إطفاء/تشغيل ديون المشترك */
export interface SubscriberOffOnUpdateResponse {
  updatedCount: number;
  offOn: number;
}

// Agent Types
export interface Agent {
  id: string;
  userId: string;
  username: string;
  plainPassword?: string; // كلمة المرور للعرض
  fullName: string;
  companyName: string;
  phone: string;
  address: string;
  governorate: IraqGovernorates;
  isActive: boolean;
  subscriptionType: SubscriptionSystemType;
  subscriptionStartDate: string;
  subscriptionEndDate: string;
  renewalPeriod?: number;
  renewalCalculationType?: RenewalCalculationType;
  isSubscriptionExpired: boolean;
  daysUntilExpiry: number;
  createdAt: string;
  updatedAt?: string;
  createdByUserName: string;
  /** نوع الخدمة (1 FTTH، 2 SAS). الافتراضي للموجودين = 2 */
  serviceType?: ServiceType;
  /** رابط قاعدة SAS للوكيل (إعدادات التفعيل) */
  sasBaseUrl?: string;
  /** اسم مستخدم SAS للوكيل */
  sasUsername?: string;
  /** رابط FTTH للوكيل (اختياري، الافتراضي: https://admin.ftth.iq) */
  ftthBaseUrl?: string;
  /** اسم مستخدم FTTH (اختياري) */
  ftthUsername?: string;
  /** هل توجد كلمة سر مزامنة مخزنة (SAS/FTTH) لاستخدام «بيانات محفوظة» */
  hasStoredSyncPassword?: boolean;
  /** معرف جلسة واتساب (لإرسال التذكير عبر wwebjs-api) */
  whatsAppSessionId?: string | null;
  tenantPlanType?: TenantPlanType | null;
  standardPlanTierId?: StandardPlanTier | null;
  standardPlanTier?: 'economy' | 'plus' | 'gold' | null;
  maxResellers?: number | null;
}

export interface AgentCreateRequest {
  username: string;
  fullName: string;
  password: string;
  companyName: string;
  phone: string;
  address: string;
  governorate: IraqGovernorates;
  /** اختياري في الباكند — عند عدم الإرسال (وكيل فرعي) يُؤخذ الاشتراك من الوكيل الرئيسي */
  subscriptionType?: SubscriptionSystemType;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  renewalPeriod?: number;
  renewalCalculationType?: RenewalCalculationType;
  serviceType?: ServiceType;
  sasBaseUrl?: string;
  sasUsername?: string;
  sasPassword?: string;
  ftthBaseUrl?: string;
  ftthUsername?: string;
  ftthPassword?: string;
  whatsAppSessionId?: string;
  /** للأدمن: نوع خطة المستأجر للوكيل الجديد */
  tenantPlanType?: TenantPlanType;
  /** @deprecated لم يعد الباكند يقبل الحقل عند POST /Agents — تُحدد الطبقة من الخادم */
  standardPlanTier?: StandardPlanTier;
  /** عند إنشاء وكيل فرعي من الوكيل الرئيسي: يُرسل تلقائياً role = UserRole.MainAgent (6) لربط السجل بالمستخدم الحالي */
  role?: number;
}

/** كتالوج طبقات الخطة القياسية (لم يعد المسار متاحاً بعد النشر — للعرض الثابت فقط إن لزم) */
export interface StandardPlanTierCatalogItem {
  tier: 'economy' | 'plus' | 'gold';
  tierId: StandardPlanTier;
  displayNameAr: string;
  maxResellers: number | null;
  featureLabelsAr: string[];
  featureCodes: string[];
}

export interface EmployeeTask {
  id: string;
  tenantId?: string;
  agentId: string;
  employeeUserId: string;
  employeeName?: string;
  employeeUserName?: string;
  employeeFullName?: string;
  createdByUserId?: string;
  createdByUserName?: string;
  taskType: EmployeeTaskType;
  status: EmployeeTaskStatus;
  taskDetails?: string | null;
  subscriberId?: string | null;
  subscriberName?: string | null;
  subscriberPhone?: string | null;
  subscriberDisplayName?: string | null;
  maintenanceType?: SubscriberMaintenanceKind | null;
  amountReceived?: number | null;
  materialId?: string | null;
  materialName?: string | null;
  materialPrice?: number | null;
  taskTitle?: string | null;
  note?: string | null;
  signalNumber?: string | null;
  acceptedAt?: string | null;
  completedAt?: string | null;
  durationSeconds?: number | null;
  taskDuration?: string | null;
  completedSubscriberName?: string | null;
  completedPhoneNumber?: string | null;
  completedSignalNumber?: string | null;
  completedNote?: string | null;
  createdAt: string;
}

export interface EmployeeTaskCreateRequest {
  employeeUserId: string;
  taskType: EmployeeTaskType;
  subscriberId?: string;
  /** عدة مشتركين — الخادم ينشئ مهمة لكل معرّف ويرسل employeeTaskAssignedBatch */
  subscriberIds?: string[];
  /** true: يُشترط TotalDebt > 0 لكل المشتركين المختارين */
  debtCollection?: boolean;
  maintenanceType?: SubscriberMaintenanceKind;
  amountReceived?: number;
  taskTitle?: string;
  /** تفاصيل إضافية (غالباً ما يقرأها الباكند مع دفعة المهام) */
  taskDetails?: string;
  note?: string;
}

/** استجابة POST /EmployeeTasks عند إرسال subscriberIds */
export interface EmployeeTaskCreateBatchResponse {
  message?: string;
  tasks: EmployeeTask[];
}

export interface EmployeeTaskUpdateRequest {
  /** إن لم تُرسل أو كانت نفس الموظف الحالي لا يتغيّر المكلّف في الباكند */
  employeeUserId?: string;
  taskType: EmployeeTaskType;
  subscriberId?: string;
  maintenanceType?: SubscriberMaintenanceKind;
  amountReceived?: number;
  taskTitle?: string;
  note?: string;
}

export interface EmployeeTaskCompleteInstallationRequest {
  subscriberName: string;
  subscriberPhone?: string;
  signalNumber?: string;
  note?: string;
}

export interface EmployeeTaskCompleteMaintenanceRequest {
  note?: string;
}

export interface EmployeeTaskCompleteAmountReceptionRequest {
  amountReceived: number;
  note?: string;
}

export interface EmployeeTasksQuery {
  page?: number;
  pageSize?: number;
  searchTerm?: string;
  status?: EmployeeTaskStatus;
  agentId?: string;
}

export interface EmployeeTaskMaterialOption {
  id: string;
  name: string;
  quantity: number;
  agentPrice: number;
  subscriberPrice: number;
}

// GET /EmployeeTasks/subscribers — خيارات مشتركي الوكيل (للـ SubscriberMaintenance / استلام مبلغ)
export interface EmployeeTaskSubscriberOption {
  id: string;
  username?: string | null;
  displayName: string;
  phoneNumber?: string | null;
  /** يُعاد من الباكند (بما فيها عند debtOnly=false) */
  totalDebt?: number | null;
}

export interface AgentUpdateRequest {
  fullName: string;
  companyName: string;
  phone: string;
  address: string;
  governorate: IraqGovernorates;
  isActive: boolean;
  subscriptionType: SubscriptionSystemType;
  subscriptionStartDate: string;
  subscriptionEndDate: string;
  renewalPeriod?: number;
  renewalCalculationType?: RenewalCalculationType;
  serviceType?: ServiceType;
  /** إعدادات التفعيل عبر SAS (اختياري) */
  sasBaseUrl?: string;
  sasUsername?: string;
  sasPassword?: string;
  ftthBaseUrl?: string;
  ftthUsername?: string;
  ftthPassword?: string;
  /** معرف جلسة واتساب */
  whatsAppSessionId?: string;
  /** كلمة مرور تسجيل الدخول — اختياري؛ إن لم تُرسل أو تُرك فارغاً لا يُغيّر الخادم كلمة المرور (مثلاً PUT /main-agent/sub-agents/{id}) */
  password?: string;
}

/** POST /Agents/{id}/whatsapp/device — تسجيل الجهاز في Go عبر Wakeel */
export interface WhatsAppDeviceResponse {
  message?: string;
  deviceId?: string;
}

/** POST /Agents/{id}/whatsapp/pair-code */
export interface WhatsAppPairCodeResponse {
  pairCode: string;
  deviceId: string;
  hint?: string;
}

/** GET /Agents/{id}/whatsapp/status */
export interface WhatsAppStatusResponse {
  deviceId: string;
  isConnected: boolean;
  isLoggedIn: boolean;
}

/** بيانات الوكيل المرتبطة بجلسة واتساب (Admin sessions list) */
export interface WhatsAppSessionAgentSummary {
  id: string;
  companyName: string;
  phone: string;
}

/** عنصر من GET /Agents/whatsapp/sessions/devices (قائمة كاملة؛ الفلترة في الفرونت) */
export interface WhatsAppDeviceSession {
  /** يُعرَض من الحقول deviceId أو id في JSON */
  deviceId: string;
  state: string;
  createdAt: string;
  displayName?: string;
  jid?: string;
  agent?: WhatsAppSessionAgentSummary | null;
}

/** استجابة GET /Agents/whatsapp/sessions/devices */
export interface WhatsAppSessionsListResponse {
  count: number;
  items: WhatsAppDeviceSession[];
}

/** GET /Agents/whatsapp/sessions/devices/:device_id */
export interface WhatsAppDeviceDetailResponse extends WhatsAppDeviceSession {
  /** حقول إضافية خام من الـ API للعرض/التشخيص */
  raw?: Record<string, unknown> | null;
}

/** GET /Agents/whatsapp/sessions/devices/:device_id/status */
export interface WhatsAppDeviceStatusAdmin {
  deviceId: string;
  isConnected: boolean;
  isLoggedIn: boolean;
}

/** عنصر واحد من طرق الدفع في معلومات المشترك */
export interface PaymentOption {
  methodName: string;
  details: string;
}

/** إعلان الوكيل لتطبيق المشترك (عنصر في القائمة أو في استجابة معلومات المشترك) */
export interface AgentAnnouncementDto {
  id: string;
  createdAt?: string;
  mainTitle: string;
  subTitle: string;
  phone: string;
  /** لون بداية تدرج كارت الإعلان (مثلاً #2962FF) */
  gradientStart?: string;
  /** لون نهاية تدرج كارت الإعلان (مثلاً #1E40AF) */
  gradientEnd?: string;
}

/** طلب إنشاء/تعديل إعلان — POST/PUT بدون id */
export interface AgentAnnouncementCreateRequest {
  mainTitle: string;
  subTitle: string;
  phone: string;
  gradientStart?: string;
  gradientEnd?: string;
}

/** استجابة GET /api/AppSettings — إعدادات تطبيق المشترك (طرق الدفع المتعددة) */
export interface AppSettingsResponse {
  zainCashEnabled: boolean;
  zainCashNumber: string;
  masterCardEnabled: boolean;
  masterCardNumber: string;
  cashEnabled: boolean;
  cashOfficeAddress: string;
}

/** طلب PUT /api/AppSettings */
export interface AppSettingsUpdateRequest {
  zainCashEnabled: boolean;
  zainCashNumber?: string;
  masterCardEnabled: boolean;
  masterCardNumber?: string;
  cashEnabled: boolean;
  cashOfficeAddress?: string;
}

/** طلب تغيير بيانات الدخول (الوكيل/المدير الثانوي) — PUT /api/Agents/me/credentials */
export interface UpdateMyCredentialsRequest {
  /** كلمة المرور الحالية (مطلوبة للتحقق) */
  currentPassword: string;
  /** اسم المستخدم الجديد (اختياري) */
  newUsername?: string;
  /** كلمة المرور الجديدة (اختياري، 4 أحرف على الأقل) */
  newPassword?: string;
  /** تأكيد كلمة المرور الجديدة (مطلوب عند إرسال newPassword) */
  confirmNewPassword?: string;
}

// Profile/Package Types
export interface Profile {
  id: string;
  name: string;
  originalPrice: number;
  salePrice: number;
  /** مبلغ استقطاع الرصيد عند التفعيل */
  balanceDeductionAmount?: number;
  /** مبلغ الكاشباك (returnPrice) */
  returnPrice?: number;
  /** إذا true يُحسب الكاشباك */
  cashbackEnabled?: boolean;
  renewalPeriod: number; // فترة التجديد بالأيام
  packageType?: ProfilePackageType;
  /** مواد مرتبطة بباقة «عرض خاص» (عند packageType = SpecialOffer) */
  includedMaterialIds?: string[] | null;
  isActive: boolean;
  createdAt: string;
  agentCompanyName: string;
  regionId?: string | null;
  regionName?: string | null;
  agentResellerId?: string | null;
  agentResellerName?: string | null;
}

export interface ProfileCreateRequest {
  name: string;
  originalPrice: number;
  salePrice: number;
  balanceDeductionAmount?: number;
  returnPrice?: number;
  cashbackEnabled?: boolean;
  renewalPeriod: number; // فترة التجديد بالأيام
  packageType?: ProfilePackageType;
  includedMaterialIds?: string[];
  isActive?: boolean;
  agentResellerId?: string;
  regionId?: string;
}

export interface ProfileUpdateRequest {
  name: string;
  originalPrice: number;
  salePrice: number;
  balanceDeductionAmount?: number;
  returnPrice?: number;
  cashbackEnabled?: boolean;
  renewalPeriod: number; // فترة التجديد بالأيام
  packageType?: ProfilePackageType;
  includedMaterialIds?: string[];
  isActive: boolean;
  agentResellerId?: string;
  regionId?: string;
}

export enum ProfilePackageType {
  Subscription = 1,
  Extension = 2,
  /** عرض خاص — أسعار + مواد اختيارية تُصرف عند التفعيل */
  SpecialOffer = 3,
}

export enum ActivationType {
  Subscription = 1,
  Extension = 2,
}

/** مادة (مواد الوكيل) — GET /api/Materials */
export interface Material {
  id: string;
  name: string;
  imagePngUrl?: string | null;
  quantity: number;
  agentPrice: number;
  subscriberPrice: number;
  totalAgentAmount?: number;
  notes?: string | null;
  agentId?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** طلب إنشاء مادة — POST /api/Materials (أدمن/وكيل/مدير ثانوي) */
export interface MaterialCreateRequest {
  name: string;
  imagePngUrl?: string;
  quantity: number;
  agentPrice: number;
  subscriberPrice: number;
  notes?: string;
}

/** طلب تعديل مادة — PUT /api/Materials/{id} */
export interface MaterialUpdateRequest {
  name: string;
  imagePngUrl?: string;
  quantity: number;
  agentPrice: number;
  subscriberPrice: number;
  notes?: string;
}

/** نوع صرف المادة — يطابق DisbursementType في الباكند */
export enum DisbursementType {
  /** سحب */
  Replacement = 0,
  /** بيع */
  Sale = 1,
  /** باقة عرض خاص */
  SpecialOfferPackage = 2,
}

/** طلب صرف/بيع مادة — POST /api/Materials/disburse. SubscriberId اختياري (null عند البيع/التبديل بدون مشترك). */
export interface MaterialDisburseRequest {
  materialId: string;
  /** اختياري — يمكن عدم إرساله أو null عند البيع/التبديل بدون مشترك */
  subscriberId?: string | null;
  disbursementType: number;
  quantity: number;
  /** قيمة افتراضية 0 — يمكن عدم إرساله أو 0 عند عدم وجود مبلغ مدفوع */
  pricePaidBySubscriber?: number;
  notes?: string;
}

/** سجل صرف مادة — GET /api/Materials/disbursements */
export interface MaterialDisbursement {
  id: string;
  materialId: string;
  materialName: string;
  materialAgentPrice: number;
  materialSubscriberPrice: number;
  subscriberId: string;
  subscriberName: string;
  subscriberPhone: string;
  disbursedByUserId: string;
  disbursedByUserName: string;
  disbursementType: number;
  quantity: number;
  unitSubscriberPrice: number;
  pricePaidBySubscriber: number;
  materialDebt: number;
  notes: string;
  createdAt: string;
  /** رقم الفاتورة (يُملأ عند البيع فقط، شكل: 6 أرقام + حرفان مثل 482917AB) */
  invoiceNumber?: string;
  /** عدد الوحدات المسترجعة من هذا الصرف */
  returnedQuantity?: number;
}

/** طلب استرجاع مادة — POST /api/Materials/disbursements/return (الباكند يبحث بالسجل باستخدام رقم الفاتورة + الوكيل) */
export interface MaterialReturnRequest {
  invoiceNumber: string;
  quantity: number;
  notes?: string;
}

/** إحصائيات المواد المصروفة (ضمن استجابة GET /api/Materials/disbursements) */
export interface MaterialDisbursementsStatistics {
  soldQuantity: number;
  replacedQuantity: number;
  totalMaterialDebt: number;
  totalSaleAmount: number;
  /** وحدات صرفت ضمن باقة عرض خاص (نفس نطاق الإحصائيات) */
  specialOfferPackageQuantity?: number;
}

/** استجابة GET /api/Materials/disbursements مع الترقيم والإحصائيات */
export interface MaterialDisbursementsResponse {
  data: MaterialDisbursement[];
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  statistics?: MaterialDisbursementsStatistics;
}

/** معاملات جلب الباقات (مطابقة GET /api/Subscribers/profiles) */
export interface ProfileListParams {
  page?: number;
  pageSize?: number;
  searchTerm?: string;
  sortBy?: string;
  sortDescending?: boolean;
  status?: number; // 1 نشط، 0 غير نشط، عدم الإرسال = الكل
  regionId?: string;
  resellerId?: string;
}

// Subscriber Types

/** أنواع رسائل واتساب المسجّلة — GET /api/Subscribers/{id} → whatsAppMessaging */
export type SubscriberWhatsAppSendKind = 'activation' | 'alert' | 'debtAlert' | 'details' | 'custom';

export interface SubscriberWhatsAppMessageTypeSummary {
  anyAttempt?: boolean;
  anySuccess?: boolean;
  attemptCount?: number;
  lastAttemptAt?: string | null;
  lastSuccess?: boolean | null;
  lastError?: string | null;
  lastExternalMessageId?: string | null;
}

export interface SubscriberWhatsAppSendLogItem {
  kind: SubscriberWhatsAppSendKind | string;
  success: boolean;
  sentAt: string;
  externalMessageId?: string | null;
  errorMessage?: string | null;
  /** true عند الإرسال التلقائي بعد إنشاء المشترك (مثل activation) */
  automatic?: boolean;
}

/** ملخص إرسالات واتساب + آخر محاولات — من GET /api/Subscribers/{id} (قد يكون null في القوائم) */
export interface SubscriberWhatsAppMessaging {
  activation?: SubscriberWhatsAppMessageTypeSummary | null;
  alert?: SubscriberWhatsAppMessageTypeSummary | null;
  debtAlert?: SubscriberWhatsAppMessageTypeSummary | null;
  details?: SubscriberWhatsAppMessageTypeSummary | null;
  custom?: SubscriberWhatsAppMessageTypeSummary | null;
  recentSends?: SubscriberWhatsAppSendLogItem[] | null;
}

/** سجل صيانة من مهام الموظفين (SubscriberMaintenance مكتملة) — GET /api/Subscribers/{id} */
export interface SubscriberMaintenanceRecordDto {
  taskId: string;
  employeeUserId: string;
  employeeName: string;
  maintenanceType: SubscriberMaintenanceKind | number;
  completedNote?: string | null;
  createdAt?: string | null;
  acceptedAt?: string | null;
  completedAt?: string | null;
  /** مدة التنفيذ بالثواني */
  durationSeconds?: number | null;
  /** قد يكون نصاً أو تنسيقاً من الباكند */
  taskDuration?: string | null;
}

export interface Subscriber {
  id: string;
  /** معرف الاشتراك (اختياري) */
  secruptionId?: string | null;
  /** FTTH: subscriptionId (مثال 8433625) */
  ftthSubscriptionId?: string | null;
  /** FTTH: customerId (مثال 2319750) */
  ftthCustomerId?: string | null;
  username: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phoneNumber: string;
  noteType?: SubscriberNoteType | null;
  note?: string;
  isActive: boolean;
  /** اشتراك المشترك فعّال (لم ينتهِ). يُستخدم لعرض "فعال" وعدّ المشتركين الفعالين بدلاً من التحقق من status. */
  isSubscriptionActive?: boolean;
  activationDate: string;
  expirationDate?: string;  // اختياري لأنه قد لا يكون موجوداً في بعض الحالات
  subscriptionType: SubscriptionType;
  status: SubscriptionStatus;
  paymentStatus: PaymentStatus;
  /** طريقة الدفع من الباكند: مثل Card أو Wallet */
  paymentMethod?: string | null;
  daysUntilExpiry: number;
  /** نص من الخادم يصف المدة المتبقية حتى الانتهاء (إن وُجد) */
  daysUntilExpiryText?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  profileId?: string;  // إضافة profileId من الباكند
  profileName: string;
  profilePrice: number;
  agentCompanyName: string;
  /** معرف الوكيل */
  agentId?: string | null;
  /** معرف رسيلر الوكيل المرتبط بالمشترك (إن وُجد) — يُستخدم عند فتح رابط التفعيل */
  agentResellerId?: string | null;
  /** اسم المنطقة/الرسيلر المرتبط بالمشترك (إن وُجد) */
  agentResellerName?: string | null;
  regionId?: string | null;
  regionName?: string | null;
  totalDebt?: number;
  /** رقم البناية (اختياري، حد أقصى 200 حرف) — الحقل API: fat */
  fat?: string | null;
  /** رقم الشقة (اختياري) */
  apartmentNumber?: string | null;
  /** المنطقة (اختياري، حد أقصى 200 حرف) */
  zone?: string | null;
  /** صيانات مكتملة مرتبطة بالمشترك (من مهام الموظفين)، من الأحدث للأقدم */
  maintenanceRecords?: SubscriberMaintenanceRecordDto[];
  /** ملخص إرسالات واتساب وسجل محاولات (يُملأ من تفاصيل المشترك بالمعرّف) */
  whatsAppMessaging?: SubscriberWhatsAppMessaging | null;
}

export interface SubscriberCreateRequest {
  /** معرف الاشتراك (اختياري، حد أقصى 100 حرف) */
  secruptionId?: string;
  ftthSubscriptionId?: string;
  ftthCustomerId?: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  noteType?: SubscriberNoteType | null;
  note?: string;
  profileId: string;
  activationDate: string;
  expirationDate: string;
  subscriptionType: SubscriptionType;
  /** رقم البناية (اختياري) — الحقل API: fat */
  fat?: string;
  /** رقم الشقة (اختياري) */
  apartmentNumber?: string;
  /** المنطقة (اختياري، حد أقصى 200 حرف) */
  zone?: string;
  /** الرسيلر/المنطقة الحالية للمشترك */
  agentResellerId?: string;
}

export interface SubscriberUpdateRequest {
  secruptionId?: string;
  ftthSubscriptionId?: string;
  ftthCustomerId?: string;
  username: string;
  password?: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  noteType?: SubscriberNoteType | null;
  note?: string;
  profileId?: string;
  isActive: boolean;
  activationDate: string;
  expirationDate: string;
  subscriptionType?: SubscriptionType;
  fat?: string;
  apartmentNumber?: string;
  zone?: string;
}

// Dashboard Stats (قديم — يُستخدم كـ fallback إن لزم)
export interface DashboardStats {
  totalSubscribers: number;
  activeSubscribers: number;
  expiringSoonSubscribers: number;
  expiredSubscribers: number;
}

/** إحصائيات لوحة الوكيل الرئيسي من GET /main-agent/dashboard */
export interface MainAgentDashboardDto {
  totalSubscribersCount: number;
  subAgentsCount: number;
  expiredSubscribersCount: number;
  activeSubscribersCount: number;
  totalDebtsAmount: number;
  totalIncomingAmount: number;
}

/** إحصائيات لوحة التحكم من GET /Subscribers/dashboard */
export interface SubscribersDashboardStats {
  total: number;
  active: number;
  online: number;
  expiringWithin3Days: number;
  offline: number;
  expired: number;
  /** مجموع amountPaid ضمن فترة الوارد */
  incomingAmount?: number;
  /** بداية الفترة التي حُسب بها الوارد */
  incomingFromDate?: string | null;
  /** نهاية الفترة التي حُسب بها الوارد */
  incomingToDate?: string | null;
  /** إجمالي الديون غير المدفوعة (للمشتركين ضمن نطاق الوكيل/الفلاتر) */
  totalDebtAmount?: number;
  /** إجمالي مبيعات المواد (صرف نوع بيع) ضمن نفس فترة fromDate/toDate */
  totalMaterialSales?: number;
  /** عند تمرير resellerId: رصيد التفعيل لتلك المنطقة */
  regionalBalanceIqd?: number | null;
  /** رصيد SAS الحالي (كنص من الباكند مثل "IQD 500,000") — يظهر فقط لوكيل نوعه SAS */
  sasBalance?: string | null;
  /** عدد المشتركين الأونلاين حالياً من لوحة SAS — يظهر فقط لوكيل نوعه SAS */
  sasOnlineUsers?: number | null;
}

/** نوع الحركة في سجل النشاط */
export enum ActivityType {
  ActivateSubscriber = 1,  // تفعيل مشترك
  AddSubscriber = 2,       // إضافة مشترك
  DeleteSubscriber = 3,    // حذف مشترك
  UpdateSubscriber = 4,    // تعديل مشترك
  PayDebt = 5              // تسديد دين
}

export interface ActivityLogItem {
  actorName: string;
  actorUsername: string;
  activityType: ActivityType;
  activityTypeName: string;
  subscriberName: string;
  subscriberUsername: string;
  createdAt: string;
}

/** فلتر سجل الحركات (اختياري) — يمرّر كـ query للـ API */
export interface ActivityLogFilterParams {
  activityType?: ActivityType;
  subscriberName?: string;
  fromDate?: string;
  toDate?: string;
}

/** طلب إنشاء موظف لوكيل — يُرسل إلى POST /api/Agents/me/employees أو POST /api/Agents/:id/employees */
export interface AgentEmployeeCreateRequest {
  username: string;
  fullName: string;
  password: string;
  /** دور المستخدم: 4 = Employee (موظف)، 5 = SubAgent (مدير ثانوي). القيمة الافتراضية 4. القيم المسموحة في الـ API هما هذان فقط. */
  role?: UserRole;
  /** صلاحيات الموظف (اختيارية، افتراضيها true في الباكند) */
  canActivateSubscriber?: boolean;
  canEditSubscriber?: boolean;
  canDeleteSubscriber?: boolean;
  canPayDebt?: boolean;
  canAccessAccounts?: boolean;
  canAccessInvoices?: boolean;
  canAccessExpensesAndSalarySheet?: boolean;
  canAccessSubscriberDashboard?: boolean;
  canViewAllSubscribers?: boolean;
  canReceiveTaskRequests?: boolean;
  allowedResellerIds?: string[];
}

/** طلب تعديل موظف لوكيل */
export interface AgentEmployeeUpdateRequest {
  fullName: string;
  isActive?: boolean;
  canActivateSubscriber?: boolean;
  canEditSubscriber?: boolean;
  canDeleteSubscriber?: boolean;
  canPayDebt?: boolean;
  canAccessAccounts?: boolean;
  canAccessInvoices?: boolean;
  canAccessExpensesAndSalarySheet?: boolean;
  canAccessSubscriberDashboard?: boolean;
  canViewAllSubscribers?: boolean;
  canReceiveTaskRequests?: boolean;
  allowedResellerIds?: string[];
}

/** عنصر رصيد منطقة من GET /Renewals/balance */
export interface AgentResellerBalanceItem {
  id: string;
  name: string;
  balanceIqd: number;
}

/** تفاصيل الرصيد: الإجمالي = الرصيد العام + أرصدة المناطق */
export interface AgentBalanceDetail {
  balanceIqd: number;
  agentPoolBalanceIqd: number;
  resellerBalances?: AgentResellerBalanceItem[] | null;
}

/** مصدر التعبئة: 1 كاش باك، 2 محفظة الوكيل */
export enum PackingSource {
  Cashback = 1,
  NormalBalance = 2,
}

export const PACKING_SOURCE_OPTIONS: { value: PackingSource; labelAr: string }[] = [
  { value: PackingSource.Cashback, labelAr: 'كاش باك' },
  { value: PackingSource.NormalBalance, labelAr: 'محفظة الوكيل' },
];

/** طلب تعبئة رصيد الوكيل */
export interface BalanceTopUpRequest {
  amountIqd: number;
  recipientName: string;
  companyName: string;
  topUpDate?: string; // ISO date "YYYY-MM-DD"
  /** إلزامي عند وجود مناطق للوكيل */
  agentResellerId?: string;
  /** مصدر التعبئة: 1 كاش باك، 2 محفظة الوكيل */
  packingSource: PackingSource;
}

/** طلب تعديل سجل تعبئة */
export interface BalanceTopUpUpdateRequest {
  amountIqd: number;
  recipientName: string;
  companyName: string;
  topUpDate?: string;
  packingSource: PackingSource;
}

/** استجابة تعبئة الرصيد */
export type BalanceTopUpResponse = AgentBalanceDetail;

/** سجل تعبئة رصيد */
export interface AgentBalanceTopUp {
  id: string;
  amountIqd: number;
  recipientName: string;
  companyName: string;
  topUpDate: string;
  createdAt: string;
  agentResellerId?: string | null;
  agentResellerName?: string | null;
  packingSource?: PackingSource;
  packingSourceLabelAr?: string;
}

/** استجابة GET /Renewals/balance/topups */
export interface BalanceTopUpsPageResponse {
  data: AgentBalanceTopUp[];
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// Renewal Receipt Types
export interface RenewalReceipt {
  id: string;
  receiptNumber: string;
  amount?: number | null;
  issueDate?: string | null;
  notes?: string;
  renewalId?: string | null;
  finalPrice: number;
  amountPaid: number;
  remainingAmount: number;
  discountAmount: number;
  discountPercent: number;
  renewalPeriod: number;
  renewalDays: number;
  renewalDate: string;
  newExpirationDate: string;
  paymentStatus: number;
  activationType?: ActivationType;
  wiFiCode: string;
  wiFiQRCode?: WiFiQRCode;
  createdAt: string;
  updatedAt?: string | null;
  subscriberId: string;
  /** اسم المستخدم للمشترك (في لوحة SAS/FTTH) — يُستخدم في تصدير Excel التفعيلات */
  subscriberUsername?: string | null;
  subscriberName: string;
  subscriberPhone: string;
  subscriberWiFiCode?: string | null;
  profileName?: string | null;
  oldProfileName: string;
  newProfileName: string;
  newProfileOriginalPrice: number;
  newProfileSalePrice: number;
  agentCompanyName: string;
  agentPhone?: string | null;
  agentAddress?: string | null;
  serviceFeesId?: string | null;
  serviceFeesName?: string | null;
  serviceFeesPrice?: number;
  serviceFeesAmountPaid?: number;
  serviceFeesRemainingAmount?: number;
  /** الفاتورة المرتبطة بالتجديد إن وُجدت (من الباكند) */
  createdReceipt?: unknown | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/** استجابة GET /api/Debts أو /api/Debts/overdue-unpaid — تحتوي إجمالي الديون المطابقة للاستعلام (كل الصفحات) */
export interface DebtsListResponse extends PaginatedResponse<Debt> {
  /** إجمالي مبالغ الديون المطابقة للاستعلام (كل الصفحات وليس الصفحة الحالية فقط) */
  totalDebtAmount?: number;
}

/** إحصائيات قائمة الوكلاء (مرتبطة بتتبع آخر دخول وانتهاء الاشتراك) */
export interface AgentsListStatistics {
  /** وكلاء سجّلوا دخولاً خلال آخر 24 ساعة */
  activeCount: number;
  /** وكلاء لم يسجّلوا دخولاً خلال 24 ساعة أو LastLoginAt == null */
  offlineCount: number;
  /** وكلاء منتهي اشتراكهم (SubscriptionEndDate <= الآن) */
  expiredSubscriptionCount: number;
}

/** استجابة GET /api/Agents مع الإحصائيات */
export interface AgentsListResponse extends PaginatedResponse<Agent> {
  statistics?: AgentsListStatistics;
}

// Renewal History Types
export interface RenewalHistory {
  id: string;
  receiptNumber: string;
  finalPrice: number;
  amountPaid: number;
  remainingAmount: number;
  discountAmount: number;
  discountPercent: number;
  renewalPeriod: number;
  renewalDays: number;
  renewalDate: string;
  newExpirationDate: string;
  paymentStatus: number;
  notes: string;
  wiFiCode: string | null;
  wiFiQRCode?: WiFiQRCode;
  createdAt: string;
  updatedAt: string | null;
  subscriberId: string;
  subscriberName: string;
  subscriberPhone: string;
  oldProfileName: string;
  newProfileName: string;
  newProfileOriginalPrice: number;
  newProfileSalePrice: number;
  agentCompanyName: string;
  serviceFeesId?: string | null;
  serviceFeesName?: string | null;
  serviceFeesPrice?: number;
  serviceFeesAmountPaid?: number;
  serviceFeesRemainingAmount?: number;
}

export interface ProfitStats {
  totalProfit: number;
  totalAmountPaid: number;
  totalOriginalPrice: number;
  averageProfitPercentage: number;
  /** عدد التجديدات في الصفحة الحالية */
  totalRenewals: number;
}

export interface DateRangeRequest {
  startDate: string;
  endDate: string;
}

// Daily Account / Handovers
export interface DailyHandover {
  id: string;
  handoverDate: string;
  amount: number;
  handedByName: string;
  receivedByName: string;
  notes?: string | null;
  createdAt: string;
  /** إن وُجد من الـ API — لملء نموذج التعديل */
  receivedByUserId?: string | null;
  receivedByAgentId?: string | null;
}

export interface DailyAccountResponse {
  summaryDate?: string;
  incomingAmount: number;
  dailyDebtPayments?: number;
  debtTotal: number;
  /** إجمالي البيع (من الباكند إن وُجد، وإلا يُستخدم incomingTotal) */
  salesTotal?: number;
  /**
   * صافي الوارد لليوم: Max(0، (مبيعات + وارد تفعيلات بعد التسليم + مدفوعات ديون اليوم) − مجموع سلف ذلك اليوم).
   * يوم التقويم كما في الحساب اليومي (العراق).
   */
  incomingTotal: number;
  /** مجموع سلف الموظفين المسحوبة في ذلك اليوم (WithdrawalDate كيوم تقويم، بما يطابق يوم الحساب اليومي) */
  dailySalaryAdvancesTotal?: number;
  /** مجموع مبيعات المخزن لذلك اليوم (من صرف نوع Sale فقط) */
  totalSaleAmount?: number;
  handovers: DailyHandover[];
}

export interface DailyHandoverRecipient {
  userId: string;
  agentId?: string | null;
  fullName: string;
  displayName: string;
}

export interface DailyHandoverCreateRequest {
  amount: number;
  receivedByUserId?: string;
  receivedByAgentId?: string;
  /** yyyy-MM-dd (optional) */
  handoverDate?: string;
  notes?: string;
}

/** جسم PUT /Renewals/daily-handover/{id} — نفس حقول الإنشاء */
export type DailyHandoverUpdateRequest = DailyHandoverCreateRequest;

// Debt Types
/** حالة إطفاء/تشغيل المشترك على الدين (من الباكند) */
export enum DebtOffOn {
  Off = 0,
  On = 1,
}

export interface Debt {
  id: string;
  subscriberId: string;
  agentId?: string;
  amount: number;
  description: string;
  dueDate: string;
  isPaid?: boolean;
  paidDate?: string;
  createdAt: string;
  updatedAt?: string;
  subscriberName: string;
  agentName?: string;
  notes?: string;
  status: DebtStatus;
  /** إطفاء / تشغيل المشترك (Off = 0، On = 1) */
  offOn?: DebtOffOn;
  // Additional fields from API response (الباكند يعتمد dueDate فقط لتاريخ التسديد)
  subscriberPhone?: string;
  agentCompanyName?: string;
  createdByUserName?: string;
  subscriberTotalDebt?: number;
  /** معرف المشترك (SecruptionId) — يُرجَع من الباكند لاستخدامه في رابط التفعيل FTTH/SAS */
  secruptionId?: string;
  /** حقول اختيارية عندما يكون الدين مرتبطاً بصرف مادة (دين مواد) */
  materialName?: string;
  materialQuantity?: number;
  materialPricePaid?: number;
  materialDebtAmount?: number;
  materialDisbursementDate?: string;
  /** تاريخ/وقت إنشاء آخر تسديد (يُرجع بعد POST تسديد دين، وفي قائمة الديون قد يكون null) */
  paymentCreatedAt?: string | null;
}

export interface DebtCreateRequest {
  subscriberId: string;
  amount: number;
  description: string;
  /** ISO datetime string */
  dueDate: string;
  notes?: string;
  /** اختياري — إن لم يُرسَل يُستخدم On */
  offOn?: DebtOffOn;
}

export interface DebtUpdateRequest {
  amount: number;
  description: string;
  /** ISO datetime string */
  dueDate: string;
  notes?: string;
  /** اختياري — يُرسل عند تغيير حالة إطفاء/تشغيل المشترك */
  offOn?: DebtOffOn;
}

export interface DebtPaymentRequest {
  paymentAmount: number;
  notes?: string;
}

// GET /Debts/subscriber/{subscriberId}/total يرجّع رقم فقط
export type SubscriberDebtTotal = number;

// WiFi QR Code Types
export interface WiFiQRCode {
  ssid: string;
  password: string;
  encryption: number;
  isHidden: boolean;
}

// Renewal Types
export interface RenewalData {
  subscriberId: string;
  newProfileId: string;
  paymentStatus: PaymentStatus;
  overrideSalePrice?: number;
  amountPaid?: number;
  notes?: string;
  wifiCode?: string;
  wiFiQRCode?: WiFiQRCode;
  remainingAmount?: number;
  debtDescription?: string;
  /** تاريخ تسديد الدين (يدوي) عند وجود متبقي */
  debtDueDate?: string;
  // إضافة معلومات إضافية لمساعدة الباكند على حساب التاريخ بشكل صحيح
  currentExpirationDate?: string;
  renewalPeriod?: number;
  /** أجور خدمة اختيارية — POST /Renewals */
  serviceFeesId?: string;
  /** السعر المُطبَّق لحظة التفعيل (قابل للتعديل) */
  serviceFeesPrice?: number;
  /** يُرسل فقط عند تفعيل خيار إضافة أجور الخدمة للفاتورة */
  serviceFeesAmountPaid?: number;
  /** عدة أجور خدمة مفعّلة — POST /Renewals */
  serviceFeesItems?: RenewalServiceFeeLineItem[];
  /** طريقة الدفع عند التفعيل — 1 كاش، 2 ماستر، 3 آجل، 4 محفظة زبون */
  activationPaymentMethod?: ActivationPaymentMethod;
  /** قناة التفعيل — 1 اعتيادي، 2 محفظة الزبون */
  activationChannel?: RenewalActivationChannel;
  /** تاريخ التفعيل المحاسبي (يوم تقويمي عراق) — من مزامنة FTTH */
  renewalDate?: string;
  /** تاريخ انتهاء الاشتراك من المصدر الخارجي */
  newExpirationDate?: string;
}

export interface RenewalServiceFeeLineItem {
  serviceFeesId: string;
  serviceFeesPrice: number;
  serviceFeesAmountPaid: number;
}

export interface SubscriberRenewalInfo {
  subscriberId: string;
  subscriberName: string;
  subscriberPhone: string;
  currentProfile: {
    id: string;
    name: string;
    price: number;
  };
  expirationDate: string;
  daysUntilExpiry: number;
  availableProfiles: Profile[];
}

// Agent Renewal Types
export interface AgentRenewalRequest {
  newSubscriptionEndDate: string;
  newSubscriptionType: SubscriptionSystemType;
}

export interface AgentSubscriptionCheck {
  expiredAgents: Agent[];
  totalExpired: number;
}

// Theme Types
export type Theme = 'light' | 'dark' | 'system';

// API Response Types
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}

// Excel Import Types
export interface ExcelImportAgent {
  id: string;
  username: string;
  fullName: string;
  companyName: string;
  phone: string;
  address: string;
  governorate: IraqGovernorates;
  isActive: boolean;
  subscriptionType: SubscriptionSystemType;
  subscriptionStartDate: string;
  subscriptionEndDate: string;
  isSubscriptionExpired: boolean;
  daysUntilExpiry: number;
  createdAt: string;
  updatedAt?: string;
  createdByUserName: string;
}

export interface ExcelImportRequest {
  agentId: string;
  file: File;
}

export interface ExcelImportResponse {
  success: boolean;
  message: string;
  importedCount?: number;
  updatedCount?: number;
  failedCount?: number;
  errors?: string[];
  importLogId?: string;
  totalRecords?: number;
  successCount?: number;
  errorCount?: number;
  errorDetails?: string;
  importDate?: string;
  activationsCreated?: number;
  skippedCount?: number;
}

// Pagination Types
export interface PaginatedResponse<T> {
  data: T[];
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  totalCount: number;
  pageNumber: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  role?: string;
  sortBy?: string;
  sortDescending?: boolean;
  /** المشتركون الذين سينتهي اشتراكهم خلال 0..N يوم (يشمل المنتهي، 0 يوم) */
  maxDaysUntilExpiry?: number;
  /** فلترة بالمطابقة الجزئية على رقم البناية (fat) */
  fat?: string;
  /** فلترة بالمطابقة الجزئية على رقم الشقة */
  apartmentNumber?: string;
  /** فلترة بالمطابقة الجزئية على الزون */
  zone?: string;
  /** فلترة بباقة واحدة */
  profileId?: string;
  /** فلترة بعدة باقات — يُفضَّل على profileId عند وجوده */
  profileIds?: string[];
  /** فلترة حسب نوع الملاحظة (SubscriberNoteType) */
  noteType?: SubscriberNoteType;
  /** تاريخ انتهاء الاشتراك من — المشتركون الذين انتهاؤهم ≥ هذا التاريخ (yyyy-MM-dd) */
  expirationFromDate?: string;
  /** تاريخ انتهاء الاشتراك إلى — المشتركون الذين انتهاؤهم ≤ هذا التاريخ (yyyy-MM-dd) */
  expirationToDate?: string;
  /** فلترة حسب الرسيلر/المنطقة */
  resellerId?: string;
  regionId?: string;
  /** فلترة المشتركين الذين لديهم تفعيل تمديد */
  hasExtensionActivation?: boolean;
}

/** معاملات استعلام قائمة الديون (GET /api/Debts) */
export interface DebtsListParams extends Omit<PaginationParams, 'status'> {
  searchTerm?: string;
  sortBy?: string;
  sortDescending?: boolean;
  /** حالة الدين (DebtStatus) — يرسل كـ DebtStatus في الباكند */
  status?: DebtStatus;
  maxDaysUntilExpiry?: number;
  fat?: string;
  zone?: string;
  noteType?: SubscriberNoteType;
  /** وصف الدين (مطابقة جزئية) — يرسل كـ DebtDescription */
  debtDescription?: string;
  /** تاريخ استلام الدين من — ISO 8601، يرسل كـ paymentCreatedAtFrom */
  paymentCreatedAtFrom?: string;
  /** تاريخ استلام الدين إلى — ISO 8601، يرسل كـ paymentCreatedAtTo */
  paymentCreatedAtTo?: string;
  /** فلترة ديون مشتركي رسيلr معيّن */
  resellerId?: string;
  /** فلترة ديون مشتركي منطقة معيّنة */
  regionId?: string;
}

/** نوع سطر السجل — GET /Accounts */
export type AccountsLedgerKind = 'Renewal' | 'DebtPayment';

export interface AccountsLedgerEntryBase {
  kind: AccountsLedgerKind;
  id: string;
  renewalDate: string;
  createdAt: string;
  amount: number;
  /** وارد عام = مبلغ الباقة + الأجور (أو مبلغ تسديد الدين) */
  generalIncome?: number;
  subscriberId?: string;
  subscriberName?: string;
  username?: string;
  executedByUserId?: string;
  executedByFullName?: string;
}

export interface AccountsLedgerRenewalEntry extends AccountsLedgerEntryBase {
  kind: 'Renewal';
  packageType?: ProfilePackageType | number;
  profileName?: string;
  agentResellerId?: string;
  receiptNumber?: string;
  activationProfit?: number;
  /** طريقة الدفع — 1 كاش، 2 ماستر */
  paymentMethod?: ActivationPaymentMethod | number;
  /** ربح أجور الخدمة */
  serviceFeesAmount?: number;
  /** دين أجور الخدمة غير المسدّد */
  serviceFeesDebtAmount?: number;
  /** الربح الكلي */
  totalProfit?: number;
  /** مبلغ الكاشباك */
  returnPrice?: number;
  /** كلفة اشتراك الوطني (واصل اشتراك) */
  nationalSubscriptionCost?: number;
  /** مبلغ الاستقطاع من رصيد المنطقة/الوكيل */
  balanceDeductionAmount?: number;
  notes?: string | null;
  subscriberNoteType?: SubscriberNoteType | number | null;
  note?: string | null;
}

export interface AccountsLedgerDebtPaymentEntry extends AccountsLedgerEntryBase {
  kind: 'DebtPayment';
  debtId?: string;
}

export type AccountsLedgerEntry = AccountsLedgerRenewalEntry | AccountsLedgerDebtPaymentEntry;

export interface AccountsLedgerPage {
  data: AccountsLedgerEntry[];
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface AccountsSubscriberNoteTypeOption {
  value: number;
  labelAr: string;
}

/** استجابة GET /api/Accounts */
export interface AccountsResponse {
  amountPaid: number;
  extension: { count: number };
  /** تسديدات ديون الاشتراك الواصلة */
  totalPaidSubscriptionDebt?: number;
  /** ديون الاشتراك غير الواصلة (آجل / غير واصل) */
  totalUnpaidSubscriptionDebt?: number;
  totalActivationProfit: number;
  /** مجموع الوارد الكلي = مبلغ الباقة + الأجور + تسديد الديون */
  totalGeneralIncome?: number;
  /** مجموع واصل اشتراك المشترك (AmountPaid) */
  totalPackageIncome?: number;
  /** مجموع استقطاع رصيد المنطقة/الوكيل عند التفعيل */
  totalBalanceDeduction?: number;
  /** مجموع وارد كلفة الوكيل */
  totalAgentPackageIncome?: number;
  /** مجموع وارد الأجور (واصل عند التفعيل + تسديد ديون الأجور) */
  totalServiceFeesIncome?: number;
  /** مجموع ديون أجور الخدمة غير الواصلة */
  totalServiceFeesDebt?: number;
  /** مجموع وارد الكاشباك */
  totalCashbackIncome?: number;
  subscriberNoteTypes?: AccountsSubscriberNoteTypeOption[];
  ledger: AccountsLedgerPage;
}

/** معاملات GET /api/Accounts و GET /api/Accounts/export/excel */
export interface AccountsListParams {
  fromDate?: string;
  toDate?: string;
  regionId?: string;
  resellerId?: string;
  executedByUserId?: string;
  subscriberName?: string;
  packageType?: ProfilePackageType | number;
  page?: number;
  pageSize?: number;
  /** للأدمن: وكيل محدد */
  agentId?: string;
}

/** معاملات GET /api/Accounts/export/excel (بدون page/pageSize/subscriberName) */
export type AccountsExportParams = Omit<AccountsListParams, 'page' | 'pageSize' | 'subscriberName'>;

// --- مصاريف المكتب (Office Expenses) ---
export interface OfficeExpense {
  id: string;
  name: string;
  amount: number;
  expenseDate: string;
  isPaid: boolean;
  paidAt: string | null;
  notes?: string | null;
  agentId?: string;
  createdAt?: string;
  updatedAt?: string | null;
}

export interface OfficeExpenseCreateRequest {
  name: string;
  amount: number;
  expenseDate: string;
  notes?: string | null;
}

export interface OfficeExpenseUpdateRequest {
  name?: string;
  amount?: number;
  expenseDate?: string;
  notes?: string | null;
}

// --- كشف الرواتب (Salary Sheet) ---
export interface SalaryDeduction {
  id: string;
  salarySheetEntryId: string;
  amount: number;
  reason: string;
  deductionDate: string;
  createdAt?: string;
}

export interface SalaryAdvance {
  id: string;
  salarySheetEntryId: string;
  amount: number;
  reason: string;
  withdrawalDate: string;
  createdAt?: string;
}

export interface SalarySheetEntry {
  id: string;
  employeeName: string;
  workType: string;
  salaryAmount: number;
  paymentDate: string;
  notes?: string | null;
  totalDeductions: number;
  totalAdvances: number;
  netSalary: number;
  deductions: SalaryDeduction[];
  advances: SalaryAdvance[];
  agentId?: string;
  createdAt?: string;
  updatedAt?: string | null;
}

export interface SalarySheetEntryCreateRequest {
  employeeName: string;
  workType: string;
  salaryAmount: number;
  paymentDate: string;
  notes?: string | null;
}

export interface SalarySheetEntryUpdateRequest {
  employeeName?: string;
  workType?: string;
  salaryAmount?: number;
  paymentDate?: string;
  notes?: string | null;
}

export interface SalaryDeductionCreateRequest {
  salarySheetEntryId: string;
  amount: number;
  reason: string;
  deductionDate: string;
}

export interface SalaryDeductionUpdateRequest {
  amount: number;
  reason: string;
  deductionDate: string;
}

export interface SalaryAdvanceCreateRequest {
  salarySheetEntryId: string;
  amount: number;
  reason: string;
  withdrawalDate: string;
}

export interface SalaryAdvanceUpdateRequest {
  amount: number;
  reason: string;
  withdrawalDate: string;
}

/** استجابة GET /api/SalarySheet (قائمة كشف الرواتب مع الإجماليات) */
export interface SalarySheetListResponse {
  data: SalarySheetEntry[];
  totalDeductions: number;
  totalAdvances: number;
}

// --- Offline / Sync (الباكند: SyncController) ---
export type SyncOperationType = 'CreateRenewal' | 'PayDebt';

export interface SyncOperationDto {
  clientId: string;
  type: SyncOperationType;
  payload: Record<string, unknown>;
}

export interface SyncUploadRequestDto {
  operations: SyncOperationDto[];
}

export interface SyncOperationResultDto {
  clientId: string;
  success: boolean;
  data?: unknown;
  message?: string;
}

export interface SyncUploadResponseDto {
  results: SyncOperationResultDto[];
}

export interface SyncChangesResponseDto {
  renewals?: unknown[];
  debts?: Debt[];
}

/** استجابة GET /api/Sync/context — سياق المزامنة دون اتصال */
export interface SyncContextResponseDto {
  serviceFees?: ServiceFees[];
}
