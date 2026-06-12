import axios, { AxiosInstance, AxiosResponse } from 'axios';

import { 
  LoginRequest, 
  LoginResponse, 
  User, 
  UserCreateRequest, 
  UserUpdateRequest,
  Agent,
  AgentCreateRequest,
  AgentUpdateRequest,
  UpdateMyCredentialsRequest,
  SasActivationLinkResponse,
  PaginatedResponse,
  AgentsListResponse,
  PaginationParams,
  DebtsListParams,
  Profile,
  ProfileCreateRequest,
  ProfileUpdateRequest,
  ProfileListParams,
  Material,
  MaterialCreateRequest,
  MaterialUpdateRequest,
  MaterialDisburseRequest,
  MaterialDisbursement,
  MaterialDisbursementsResponse,
  MaterialReturnRequest,
  Subscriber,
  SubscriberCreateRequest,
  SubscriberUpdateRequest,
  SubscriberInfo,
  DashboardStats,
  SubscribersDashboardStats,
  RenewalReceipt,
  RenewalHistory,
  RenewalData,
  PaymentStatus,
  ActivationPaymentMethod,
  SubscriptionType,
  SubscriptionStatus,
  Debt,
  DebtsListResponse,
  DebtCreateRequest,
  DebtUpdateRequest,
  DebtPaymentRequest,
  ProfitStats,
  DateRangeRequest,
  DailyAccountResponse,
  AccountsResponse,
  AccountsListParams,
  AccountsExportParams,
  AccountsLedgerKind,
  DailyHandoverCreateRequest,
  DailyHandoverUpdateRequest,
  DailyHandoverRecipient,
  AgentRenewalRequest,
  AgentSubscriptionCheck,
  ExcelImportAgent,
  ExcelImportResponse,
  ActivityLogItem,
  ActivityType,
  AgentEmployeeCreateRequest,
  AgentEmployeeUpdateRequest,
  UserRole,
  SystemMessageResponse,
  SystemMessageCreateRequest,
  MessageTemplateResponse,
  SasSyncRequest,
  SasSyncResponse,
  SasSyncUsingSavedCredentialsResponse,
  SyncSubscribersRequest,
  SyncSubscribersResponse,
  CashbackTransactionsRequest,
  CashbackTransactionsResponse,
  CashbackSynchronizationFtthResponse,
  CashbackSubscriberZonesResponse,
  CashbackPackageDto,
  CashbackTransactionRecordDto,
  CashbackRecordRealTotalUpdateRequest,
  CashbackExpectedTotalUpdateRequest,
  CashbackExpectedTotalUpdateResponse,
  CashbackFetchBody,
  CustomerInvoiceCustomerCreateDto,
  CustomerInvoiceCustomerDto,
  CustomerInvoiceCustomerUpdateDto,
  CustomerInvoiceDetailDto,
  CustomerInvoicePayDebtRequest,
  CustomerInvoiceRecordCreateDto,
  CustomerInvoiceRecordDto,
  CustomerInvoicesListResponse,
  CustomerInvoiceSendWhatsAppResponse,
  CustomerInvoiceStatisticsDto,
  UpdateSubscriptionRequest,
  UpdateSubscriptionResponse,
  SaveSubscriberFromSyncRequest,
  SasSyncFromDataRequest,
  SasCredentialsItem,
  AgentResellerCredentialsDto,
  BalanceTopUpRequest,
  BalanceTopUpResponse,
  AgentBalanceTopUp,
  BalanceTopUpsPageResponse,
  AgentBalanceDetail,
  OfficeExpense,
  OfficeExpenseCreateRequest,
  OfficeExpenseUpdateRequest,
  SalarySheetEntry,
  SalarySheetEntryCreateRequest,
  SalarySheetEntryUpdateRequest,
  SalaryDeductionCreateRequest,
  SalaryDeductionUpdateRequest,
  SalaryAdvanceCreateRequest,
  SalaryAdvanceUpdateRequest,
  SalarySheetListResponse,
  SyncUploadRequestDto,
  SyncUploadResponseDto,
  SyncContextResponseDto,
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
  ResellerWhatsAppSessionRequest,
  MainAgentDashboardDto,
  AgentRegistrationRequest,
  AgentRegistrationRegisterResponse,
  AgentRegistrationApproveRequest,
  AgentRegistrationApproveResponse,
  FtthSubscribersExportBody,
  FtthSubscribersExportResponse,
  FtthSubscribersImportResponse,
  SasSubscribersExportBody,
  SasSubscribersExportResponse,
  SasSubscribersImportResponse,
  WhatsAppDeviceResponse,
  WhatsAppPairCodeResponse,
  WhatsAppStatusResponse,
} from '../types';
import { getNumberLocale } from '../utils/localeDigits';
import { createCashbackReportXlsxBlob } from '../utils/excelExport';

/** عندما يعيد السيرفر JSON بدلاً من ملف xlsx (نفس جسم الـ fetch) — نبني ملفاً محلياً حتى لا يفشل التنزيل. */
function cashBackRowDate(v: unknown): string {
  if (v == null || v === '') return '';
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString('ar-IQ');
}

/**
 * GET /Renewals قد يعيد حقولاً بصيغة PascalCase (.NET) — نملأ الحقول camelCase لتصدير Excel والواجهات.
 */
function normalizeRenewalReceiptFromApi(raw: unknown): RenewalReceipt {
  if (raw == null || typeof raw !== 'object') {
    return raw as RenewalReceipt;
  }
  const r = raw as Record<string, unknown>;
  const str = (camel: string, pascal: string, ...alts: string[]) => {
    const v =
      r[camel] ??
      r[pascal] ??
      alts.map((k) => r[k]).find((x) => x != null && x !== '');
    return v == null ? '' : String(v);
  };
  const num = (camel: string, pascal: string) => {
    const v = r[camel] ?? r[pascal];
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const serviceFeesIdRaw = r.serviceFeesId ?? r.ServiceFeesId;
  return {
    ...(r as unknown as RenewalReceipt),
    subscriberName: str('subscriberName', 'SubscriberName'),
    subscriberPhone: str('subscriberPhone', 'SubscriberPhone', 'phoneNumber', 'PhoneNumber'),
    subscriberUsername:
      (r.subscriberUsername ??
        r.SubscriberUsername ??
        r.username ??
        r.Username ??
        null) as string | null | undefined,
    subscriberWiFiCode:
      (r.subscriberWiFiCode ?? r.SubscriberWiFiCode ?? null) as string | null | undefined,
    subscriberId: str('subscriberId', 'SubscriberId'),
    serviceFeesId: serviceFeesIdRaw == null || serviceFeesIdRaw === '' ? null : String(serviceFeesIdRaw),
    serviceFeesName: (r.serviceFeesName ?? r.ServiceFeesName ?? null) as string | null | undefined,
    serviceFeesPrice: num('serviceFeesPrice', 'ServiceFeesPrice'),
    serviceFeesAmountPaid: num('serviceFeesAmountPaid', 'ServiceFeesAmountPaid'),
    serviceFeesRemainingAmount: num('serviceFeesRemainingAmount', 'ServiceFeesRemainingAmount'),
  };
}

function buildCashbackXlsxBlobFromJson(res: CashbackTransactionsResponse): Blob {
  const headers = [
    'اسم المشترك',
    'نوع التفعيل',
    'نسبة الربح',
    'سعر الاشتراك',
    'الباقة',
    'الوكيل',
    'المنطقة',
    'من تاريخ',
    'إلى تاريخ',
    'اسم المستخدم',
  ];
  const rows = (res.rows ?? []) as Record<string, unknown>[];
  const planProfitStats = new Map<string, { profitPerActivation: number; activations: number }>();
  const dataRows: (string | number)[][] = rows.map((r) => [
    String(r.subscriberName ?? ''),
    String(r.activationType ?? ''),
    r.profitPerActivation != null ? Number(r.profitPerActivation) : '',
    r.planPrice != null ? Number(r.planPrice) : '',
    String(r.subscriptionName ?? ''),
    String(r.agentName ?? ''),
    String(r.zoneId ?? ''),
    cashBackRowDate(r.subscriptionStartsAt),
    cashBackRowDate(r.subscriptionEndsAt),
    String(r.deviceUsername ?? ''),
  ]);
  for (const r of rows) {
    const name = String(r.subscriptionName ?? '').trim();
    const profit = Number(r.profitPerActivation ?? 0);
    if (!name || Number.isNaN(profit) || profit <= 0) continue;
    const prev = planProfitStats.get(name);
    if (prev) {
      prev.activations += 1;
    } else {
      planProfitStats.set(name, { profitPerActivation: profit, activations: 1 });
    }
  }
  const aoa: (string | number)[][] = [headers, ...dataRows];
  aoa.push([]);
  aoa.push(['مجموع التفعيلات:', res.totalActivations ?? '']);
  aoa.push(['مجموع تفعيلات من محفظة الوكيل', res.agentWalletActivations ?? '']);
  aoa.push(['مجموع التفعيلات من تطبيق الوطني او ماستر', res.subscriberOrMasterActivations ?? '']);
  planProfitStats.forEach((stat, subscriptionName) => {
    aoa.push([`مجموع التفعيلات ${subscriptionName}`, stat.activations]);
    aoa.push([`الربح ${stat.profitPerActivation} × ${stat.activations}`, stat.profitPerActivation * stat.activations]);
  });
  let excelGrandTotal = 0;
  for (const row of rows) {
    const p = Number((row as { profitPerActivation?: unknown }).profitPerActivation ?? 0);
    if (!Number.isNaN(p)) excelGrandTotal += p;
  }
  aoa.push(['مبلغ الراجع الكلي', excelGrandTotal]);
  return createCashbackReportXlsxBlob(aoa, 'تقرير الكاش باك', {
    colWidths: [28, 14, 12, 14, 24, 14, 18, 18, 18, 18],
  });
}

class ApiService {
  private api: AxiosInstance;

  // دالة لترجمة رسائل الخطأ إلى العربية
  private translateError(error: any): string {
    // معالجة رسائل ModelState (أخطاء التحقق)
    if (error.response?.data?.errors) {
      const errors = error.response.data.errors;
      const errorMessages: string[] = [];
      
      // جمع جميع رسائل الخطأ
      for (const field in errors) {
        if (Array.isArray(errors[field])) {
          errorMessages.push(...errors[field]);
        }
      }
      
      // إرجاع الرسائل مجمعة
      if (errorMessages.length > 0) {
        return errorMessages.join('\n');
      }
    }
    
    // رسالة نصية مباشرة في body (مثل BadRequest("نص") في .NET)
    const data = error.response?.data;
    if (typeof data === 'string' && data.trim()) {
      return data.trim();
    }
    // ProblemDetails أو غيره: حقل detail
    if (data?.detail && typeof data.detail === 'string' && data.detail.trim()) {
      return data.detail.trim();
    }
    // إذا كان الخطأ يحتوي على رسالة باللغة العربية، استخدمها
    if (data?.message) {
      const message = typeof data.message === 'string' ? data.message : String(data.message);
      
      // قائمة بالرسائل الشائعة وترجماتها
      const errorTranslations: { [key: string]: string } = {
        // رسائل المصادقة
        'Invalid credentials': 'بيانات الدخول غير صحيحة',
        'User not found': 'المستخدم غير موجود',
        'Invalid token': 'رمز المصادقة غير صالح',
        'Token expired': 'انتهت صلاحية رمز المصادقة',
        'Unauthorized': 'غير مخول للوصول',
        'Forbidden': 'ممنوع الوصول',
        'اسم المستخدم أو كلمة المرور غير صحيحة': 'اسم المستخدم أو كلمة المرور غير صحيحة',
        'اسم المستخدم أو كلمة السر غير صحيحة': 'اسم المستخدم أو كلمة السر غير صحيحة',
        'غير مصرح': 'غير مصرح',
        'غير مصرح للوصول': 'غير مصرح للوصول',
        
        // رسائل التحقق
        'Validation failed': 'فشل في التحقق من البيانات',
        'Required field': 'هذا الحقل مطلوب',
        'Invalid email': 'البريد الإلكتروني غير صالح',
        'Invalid phone number': 'رقم الهاتف غير صالح',
        'Password too short': 'كلمة المرور قصيرة جداً',
        'Username already exists': 'اسم المستخدم موجود بالفعل',
        'Email already exists': 'البريد الإلكتروني موجود بالفعل',
        
        // رسائل قاعدة البيانات
        'Database error': 'خطأ في قاعدة البيانات',
        'Record not found': 'السجل غير موجود',
        'Duplicate entry': 'هذا السجل موجود بالفعل',
        'Foreign key constraint': 'خطأ في العلاقات بين الجداول',
        'Got timeout reading communication packets': 'انتهت مهلة الاتصال بقاعدة البيانات على السيرفر. جرّب مرة أخرى أو تأكد من تشغيل قاعدة البيانات.',
        'timeout reading communication packets': 'انتهت مهلة الاتصال بقاعدة البيانات على السيرفر. جرّب مرة أخرى أو تأكد من تشغيل قاعدة البيانات.',
        
        // رسائل الملفات
        'File not found': 'الملف غير موجود',
        'File too large': 'حجم الملف كبير جداً',
        'Invalid file type': 'نوع الملف غير مدعوم',
        'Upload failed': 'فشل في رفع الملف',
        'No file uploaded': 'لم يتم رفع ملف',
        'Only Excel files (.xlsx, .xls) are allowed': 'يُسمح فقط بملفات Excel (.xlsx, .xls)',
        
        // رسائل الشبكة
        'Network error': 'خطأ في الشبكة',
        'Connection timeout': 'انتهت مهلة الاتصال',
        'Server error': 'خطأ في الخادم',
        'Service unavailable': 'الخدمة غير متاحة',
        
        // رسائل خاصة بالتطبيق - الوكلاء
        'Agent not found': 'الوكيل غير موجود',
        'الوكيل غير موجود': 'الوكيل غير موجود',
        'لا يمكن حذف الوكيل الذي قام بإنشاء وكلاء آخرين': 'لا يمكن حذف الوكيل الذي قام بإنشاء وكلاء آخرين. يرجى إعادة تعيين أو حذف الوكلاء التابعين أولاً.',
        'لا يمكن حذف الوكيل الذي لديه مشتركين': 'لا يمكن حذف الوكيل الذي لديه مشتركين. يرجى إعادة تعيين أو حذف المشتركين أولاً.',
        'لا يمكن حذف الوكيل الذي لديه ملفات شخصية': 'لا يمكن حذف الوكيل الذي لديه ملفات شخصية. يرجى حذف الملفات الشخصية أولاً.',
        'حدث خطأ أثناء حذف الوكيل': 'حدث خطأ أثناء حذف الوكيل',
        
        // رسائل خاصة بالتطبيق - المشتركين
        'Subscriber not found': 'المشترك غير موجود',
        'المشترك غير موجود': 'المشترك غير موجود',
        'الملف الشخصي غير موجود': 'الملف الشخصي غير موجود',
        'الملف الشخصي بالمعرف': 'الملف الشخصي بالمعرف المحدد غير موجود أو لا ينتمي إلى هذا الوكيل',
        'رقم الهاتف موجود بالفعل في النظام': 'رقم الهاتف المحدد موجود بالفعل في النظام',
        'حدث خطأ أثناء إنشاء المشترك': 'حدث خطأ أثناء إنشاء المشترك',
        'حدث خطأ أثناء جلب معلومات المشترك': 'حدث خطأ أثناء جلب معلومات المشترك',
        
        // رسائل خاصة بالتطبيق - الديون
        'Debt not found': 'الدين غير موجود',
        'الدين غير موجود': 'الدين غير موجود',
        
        // رسائل خاصة بالتطبيق - المستخدمين
        'Only agents can view their subscribers': 'يمكن للوكلاء فقط عرض مشتركيهم',
        'Agents can only create Subscriber users': 'يمكن للوكلاء فقط إنشاء مستخدمين من نوع المشترك',
        'المستخدم غير موجود': 'المستخدم غير موجود',
        'Subscriber not found or not authorized to view': 'المشترك غير موجود أو غير مخول للعرض',
        'Subscriber not found or not authorized to update': 'المشترك غير موجود أو غير مخول للتحديث',
        
        // رسائل خاصة بالتطبيق - التجديدات
        'Renewal not found': 'التجديد غير موجود',
        'التجديد غير موجود': 'التجديد غير موجود',
        'Receipt not found': 'الإيصال غير موجود',
        'الإيصال غير موجود': 'الإيصال غير موجود',
        'الملف الشخصي لا ينتمي إلى هذا الوكيل': 'الملف الشخصي لا ينتمي إلى هذا الوكيل',
        'حدث خطأ أثناء تصدير البيانات': 'حدث خطأ أثناء تصدير البيانات',
        
        // رسائل خاصة بالتطبيق - الباقات
        'Profile not found': 'الباقة غير موجودة',
        'الباقة غير موجودة': 'الباقة غير موجودة',
        
        // رسائل خاصة بالتطبيق - الفواتير
        'الفاتورة غير موجودة': 'الفاتورة غير موجودة',
        
        // رسائل خاصة بالتطبيق - الاستيراد
        'معرف الوكيل مطلوب للمدير': 'معرف الوكيل مطلوب للمدير',
        'لم يتم العثور على ورقة عمل في ملف Excel': 'لم يتم العثور على ورقة عمل في ملف Excel',
        'ملف Excel يجب أن يحتوي على الأقل صف رؤوس وصف بيانات واحد': 'ملف Excel يجب أن يحتوي على الأقل صف رؤوس وصف بيانات واحد',
        
        // رسائل التحقق من DTOs
        'اسم المستخدم مطلوب': 'اسم المستخدم مطلوب',
        'اسم المستخدم يجب أن يكون أقل من 100 حرف': 'اسم المستخدم يجب أن يكون أقل من 100 حرف',
        'الاسم الكامل مطلوب': 'الاسم الكامل مطلوب',
        'الاسم الكامل يجب أن يكون أقل من 200 حرف': 'الاسم الكامل يجب أن يكون أقل من 200 حرف',
        'كلمة السر مطلوبة': 'كلمة السر مطلوبة',
        'كلمة السر يجب أن تكون على الأقل 4 أحرف': 'كلمة السر يجب أن تكون على الأقل 4 أحرف',
        'اسم الشركة مطلوب': 'اسم الشركة مطلوب',
        'اسم الشركة يجب أن يكون أقل من 200 حرف': 'اسم الشركة يجب أن يكون أقل من 200 حرف',
        'رقم الهاتف يجب أن يكون أقل من 20 رقم': 'رقم الهاتف يجب أن يكون أقل من 20 رقم',
        'العنوان يجب أن يكون أقل من 500 حرف': 'العنوان يجب أن يكون أقل من 500 حرف',
        'الاسم الأول مطلوب': 'الاسم الأول مطلوب',
        'الاسم الأول يجب أن يكون أقل من 100 حرف': 'الاسم الأول يجب أن يكون أقل من 100 حرف',
        'الاسم الأخير مطلوب': 'الاسم الأخير مطلوب',
        'الاسم الأخير يجب أن يكون أقل من 100 حرف': 'الاسم الأخير يجب أن يكون أقل من 100 حرف',
        'رقم الهاتف مطلوب': 'رقم الهاتف مطلوب',
        'كود الواي فاي يجب أن يكون أقل من 100 حرف': 'كود الواي فاي يجب أن يكون أقل من 100 حرف',
        'الملاحظة يجب أن تكون أقل من 1000 حرف': 'الملاحظة يجب أن تكون أقل من 1000 حرف',
        'معرف الملف الشخصي مطلوب': 'معرف الملف الشخصي مطلوب',
        'تاريخ انتهاء الصلاحية مطلوب': 'تاريخ انتهاء الصلاحية مطلوب',
        'معرف المشترك مطلوب': 'معرف المشترك مطلوب',
        'المبلغ مطلوب': 'المبلغ مطلوب',
        'المبلغ يجب أن يكون أكبر من صفر': 'المبلغ يجب أن يكون أكبر من صفر',
        'ملاحظات الدين مطلوب': 'ملاحظات الدين مطلوب',
        'ملاحظات الدين يجب أن يكون أقل من 500 حرف': 'ملاحظات الدين يجب أن يكون أقل من 500 حرف',
        'الملاحظات يجب أن تكون أقل من 1000 حرف': 'الملاحظات يجب أن تكون أقل من 1000 حرف',
        'معرف الملف الشخصي الجديد مطلوب': 'معرف الملف الشخصي الجديد مطلوب',
        'فترة التجديد مطلوبة': 'فترة التجديد مطلوبة',
        'حالة الدفع مطلوبة': 'حالة الدفع مطلوبة',
        'سعر البيع يجب أن يكون أكبر من أو يساوي صفر': 'سعر البيع يجب أن يكون أكبر من أو يساوي صفر',
        'المبلغ المدفوع يجب أن يكون أكبر من أو يساوي صفر': 'المبلغ المدفوع يجب أن يكون أكبر من أو يساوي صفر',
        'اسم الشبكة يجب أن يكون أقل من 100 حرف': 'اسم الشبكة يجب أن يكون أقل من 100 حرف',
        'كلمة سر الشبكة يجب أن تكون أقل من 100 حرف': 'كلمة سر الشبكة يجب أن تكون أقل من 100 حرف',
        'نوع التشفير مطلوب': 'نوع التشفير مطلوب',
        
        // رسائل الاستيراد من Excel
        'الصف': 'خطأ في الصف المحدد',
        'الملف الشخصي مطلوب': 'الملف الشخصي مطلوب',
        'الملف الشخصي غير موجود لهذا الوكيل': 'الملف الشخصي غير موجود لهذا الوكيل',
        'تنسيق تاريخ الانتهاء غير صحيح': 'تنسيق تاريخ الانتهاء غير صحيح',
        
        // رسائل أخرى - الرصيد عند التفعيل/التجديد
        'Insufficient balance': 'الرصيد غير كافي',
        'InsufficientBalance': 'الرصيد غير كافي',
        'رصيد الوكيل غير كافٍ': 'الرصيد غير كافي',
        'Subscription expired': 'انتهت صلاحية الاشتراك',
        'Payment failed': 'فشل في الدفع',
        'Renewal failed': 'فشل في التجديد',
        'Export failed': 'فشل في التصدير',
        'Import failed': 'فشل في الاستيراد'
      };
      
      // البحث عن ترجمة للرسالة
      for (const [key, arabic] of Object.entries(errorTranslations)) {
        // البحث في الرسالة الأصلية
        if (message.includes(key)) {
          return arabic;
        }
        
        // البحث في الرسالة الصغيرة (case insensitive)
        if (message.toLowerCase().includes(key.toLowerCase())) {
          return arabic;
        }
      }
      
      // إذا كانت الرسالة باللغة العربية بالفعل، استخدمها كما هي
      if (/[\u0600-\u06FF]/.test(message)) {
        return message;
      }
      
      // إذا لم توجد ترجمة، استخدم الرسالة الأصلية
      return message;
    }
    
    const statusCode = error.response?.status;
    const rawMessage = (error.response?.data?.message ?? error.message ?? '') as string;
    if (statusCode === 500 && /timeout reading communication packets/i.test(rawMessage)) {
      return 'انتهت مهلة الاتصال بقاعدة البيانات على السيرفر. جرّب مرة أخرى أو تأكد من تشغيل قاعدة البيانات.';
    }

    const statusMessages: { [key: number]: string } = {
      400: 'طلب غير صالح - تحقق من البيانات المرسلة',
      401: 'غير مخول - يرجى تسجيل الدخول مرة أخرى',
      403: 'ممنوع الوصول - ليس لديك صلاحية للوصول',
      404: 'غير موجود - المورد المطلوب غير موجود',
      409: 'تعارض - البيانات المرسلة تتعارض مع البيانات الموجودة',
      422: 'خطأ في التحقق - البيانات المرسلة غير صحيحة',
      500: 'خطأ داخلي في الخادم - يرجى المحاولة لاحقاً',
      502: 'خطأ في البوابة - الخادم غير متاح',
      503: 'الخدمة غير متاحة - يرجى المحاولة لاحقاً',
      504: 'انتهت مهلة البوابة - الخادم لا يستجيب'
    };

    if (statusCode && statusMessages[statusCode]) {
      return statusMessages[statusCode];
    }

    if (error.message) {
      return `خطأ: ${error.message}`;
    }
    
    return 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.';
  }

  constructor() {
    // API URL - Priority: 1. REACT_APP_API_URL, 2. في التطوير: محلي 5112, 3. إنتاج
    // يجب أن ينتهي الرابط بـ /wakeel/api وليس /api فقط (مثلاً https://api-solid.execute-iq.com/wakeel/api)
    const defaultForDev = 'https://api-solid.execute-iq.com/wakeel/api';
    const defaultForProd = 'https://api-solid.execute-iq.com/wakeel/api';
    const baseURL = process.env.REACT_APP_API_URL
      || (process.env.NODE_ENV === 'development' ? defaultForDev : defaultForProd);

    const timeoutMs = typeof process.env.REACT_APP_API_TIMEOUT_MS !== 'undefined'
      ? Number(process.env.REACT_APP_API_TIMEOUT_MS)
      : 30000;
    this.api = axios.create({
      baseURL, // Backend API URL
      timeout: timeoutMs,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle auth errors and translate messages
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        // ترجمة رسالة الخطأ إلى العربية
        const translatedError = new Error(this.translateError(error));
        translatedError.name = error.name;
        
        // إضافة معلومات إضافية للخطأ المترجم
        (translatedError as any).originalError = error;
        (translatedError as any).status = error.response?.status;
        (translatedError as any).response = error.response;
        
        const skipRedirect = Boolean((error.config as { skipAuthRedirect?: boolean } | undefined)?.skipAuthRedirect);
        const requestUrl = String(error.config?.url ?? '');
        const isLoginRequest = /\/Auth\/login$/i.test(requestUrl);
        const onLoginPage =
          typeof window !== 'undefined' && /\/login\/?$/.test(window.location.pathname);

        if (error.response?.status === 401 && !skipRedirect && !isLoginRequest && !onLoginPage) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('meFeatures');
          const base = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
          window.location.href = `${base}/login`;
        }

        if (error.response?.status === 403 && !skipRedirect) {
          const rawMessage = String(error.response?.data?.message ?? error.response?.data ?? '');
          if (/tenant context is required/i.test(rawMessage)) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('meFeatures');
            const base = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
            window.location.href = `${base}/login`;
          }
        }
        
        return Promise.reject(translatedError);
      }
    );
  }

  // Auth endpoints
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response: AxiosResponse<LoginResponse> = await this.api.post('/Auth/login', credentials, {
      timeout: 60000, // مهلة أطول لتسجيل الدخول (قد يكون السيرفر في بداية تشغيل)
      skipAuthRedirect: true, // فشل الدخول (401) لا يعيد تحميل صفحة /login
    });
    return response.data;
  }

  /** GET /me/features — صلاحيات Features للمستخدم الحالي */
  async getMyFeatures(opts?: { skipAuthRedirect?: boolean }): Promise<import('../types').MeFeaturesResponse> {
    const response = await this.api.get<import('../types').MeFeaturesResponse>('/me/features', {
      ...(opts?.skipAuthRedirect ? { skipAuthRedirect: true } : {}),
    });
    const d = response.data as
      | (import('../types').MeFeaturesResponse & {
          TenantId?: string;
          Features?: string[];
          GlobalAccess?: boolean;
        })
      | undefined;
    return {
      tenantId: d?.tenantId ?? d?.TenantId,
      features: d?.features ?? d?.Features ?? [],
      globalAccess: d?.globalAccess ?? d?.GlobalAccess ?? false,
    };
  }

  // User endpoints
  async getCurrentUser(opts?: { skipAuthRedirect?: boolean }): Promise<User> {
    const response: AxiosResponse<User> = await this.api.get('/users/me', {
      ...(opts?.skipAuthRedirect ? { skipAuthRedirect: true } : {}),
    });
    return response.data;
  }

  /** فحص خفيف للاتصال بالسيرفر (للوضع دون اتصال) — مهلة قصيرة لتفادي انتظار 30s */
  async healthCheck(timeoutMs = 10_000): Promise<void> {
    /** لا نفعّل إعادة توجيه 401 هنا — بعض الأدوار قد لا يدعمها /users/me بينما الجلسة صالحة */
    await this.api.get('/users/me', { timeout: timeoutMs, skipAuthRedirect: true });
  }

  async getAllUsers(params?: PaginationParams): Promise<PaginatedResponse<User>> {
    const response: AxiosResponse<PaginatedResponse<User>> = await this.api.get('/users', { params });
    return response.data;
  }

  async getUserById(id: string): Promise<User> {
    const response: AxiosResponse<User> = await this.api.get(`/users/${id}`);
    return response.data;
  }

  async createUser(userData: UserCreateRequest): Promise<User> {
    const response: AxiosResponse<User> = await this.api.post('/users', userData);
    return response.data;
  }

  async updateUser(id: string, userData: UserUpdateRequest): Promise<User> {
    const response: AxiosResponse<User> = await this.api.put(`/users/${id}`, userData);
    return response.data;
  }

  async deleteUser(id: string): Promise<void> {
    await this.api.delete(`/users/${id}`);
  }

  async getMySubscribers(): Promise<User[]> {
    const response: AxiosResponse<User[]> = await this.api.get('/users/my-subscribers');
    return response.data;
  }

  // Agent endpoints — الباكند يتوقع searchTerm (وليس search)
  async getAllAgents(params?: PaginationParams): Promise<AgentsListResponse> {
    const queryParams: Record<string, unknown> = {
      page: params?.page,
      pageSize: params?.pageSize,
    };
    if (params?.search?.trim()) queryParams.searchTerm = params.search.trim();
    if (params?.expirationFromDate) queryParams.expirationFromDate = params.expirationFromDate;
    if (params?.expirationToDate) queryParams.expirationToDate = params.expirationToDate;
    const response: AxiosResponse<AgentsListResponse> = await this.api.get('/Agents', { params: queryParams });
    return response.data;
  }

  // Try to find an agent by username (best-effort for sidebar badge)
  async findAgentByUsername(username: string): Promise<Agent | null> {
    try {
      const params = { searchTerm: username, page: 1, pageSize: 10 };
      const response: AxiosResponse<AgentsListResponse> = await this.api.get('/Agents', { params });
      const list = response.data?.data || [] as any[];
      const exact = list.find((a: Agent) => a.username?.toLowerCase() === username.toLowerCase());
      return exact || list[0] || null;
    } catch (e) {
      console.warn('findAgentByUsername failed', e);
      return null;
    }
  }

  async getAgentById(id: string): Promise<Agent> {
    const response: AxiosResponse<Agent> = await this.api.get(`/Agents/${id}`);
    return response.data;
  }

  /**
   * جلب وكيل المستخدم الحالي (GET /api/Agents/me)
   * - للوكيل: يرجع وكالته
   * - للموظف: يرجع وكيله (CreatedByAgentId) الذي يملك جلسة الواتساب
   * يستخدم نفس جلسة الواتساب للوكيل والموظفين التابعين له
   */
  async getMyAgent(): Promise<Agent> {
    const response: AxiosResponse<Agent> = await this.api.get('/Agents/me');
    return response.data;
  }

  /**
   * تغيير بيانات الدخول (الوكيل/المدير الثانوي) — PUT /api/Agents/me/credentials
   * currentPassword مطلوب؛ يمكن إرسال newUsername و/أو newPassword + confirmNewPassword
   */
  async updateMyCredentials(data: UpdateMyCredentialsRequest): Promise<{ message: string }> {
    const response: AxiosResponse<{ message: string }> = await this.api.put('/Agents/me/credentials', data);
    return response.data;
  }

  /** جلب رابط تفعيل SAS/FTTH للمشترك. إن وُجد resellerId يُستخدم ذلك الرسيلر؛ وإلا إعدادات الوكيل أو رسيلر المشترك. */
  async getSasLink(subscriberId: string, resellerId?: string): Promise<SasActivationLinkResponse> {
    const params: Record<string, string> = { subscriberId };
    if (resellerId) params.resellerId = resellerId;
    const response: AxiosResponse<SasActivationLinkResponse> = await this.api.get('/Agents/sas-link', { params });
    return response.data;
  }

  /** قائمة رسيلرز الوكيل — GET /Agents/me/resellers */
  async getMyResellers(): Promise<AgentReseller[]> {
    const response = await this.api.get<AgentReseller[]>('/Agents/me/resellers');
    return response.data ?? [];
  }
  async getMyRegions(includeResellers = true): Promise<AgentRegion[]> {
    const response = await this.api.get<AgentRegion[]>('/Agents/me/regions', {
      params: { includeResellers },
    });
    return response.data ?? [];
  }

  async createMyRegion(data: AgentRegionCreateRequest): Promise<AgentRegion> {
    const response = await this.api.post<AgentRegion>('/Agents/me/regions', data);
    return response.data;
  }

  async updateMyRegion(id: string, data: AgentRegionUpdateRequest): Promise<AgentRegion> {
    const response = await this.api.put<AgentRegion>(`/Agents/me/regions/${id}`, data);
    return response.data;
  }

  async deleteMyRegion(id: string): Promise<void> {
    await this.api.delete(`/Agents/me/regions/${id}`);
  }

  /** قائمة أجور الخدمة — GET /ServiceFees */
  async getServiceFees(agentId?: string): Promise<ServiceFees[]> {
    const response = await this.api.get<ServiceFees[]>('/ServiceFees', {
      params: agentId ? { agentId } : undefined,
    });
    return response.data ?? [];
  }

  async getServiceFee(id: string): Promise<ServiceFees> {
    const response = await this.api.get<ServiceFees>(`/ServiceFees/${id}`);
    return response.data;
  }

  async createServiceFee(data: ServiceFeesCreateRequest): Promise<ServiceFees> {
    const response = await this.api.post<ServiceFees>('/ServiceFees', data);
    return response.data;
  }

  async updateServiceFee(id: string, data: ServiceFeesUpdateRequest): Promise<ServiceFees> {
    const response = await this.api.put<ServiceFees>(`/ServiceFees/${id}`, data);
    return response.data;
  }

  async deleteServiceFee(id: string): Promise<void> {
    await this.api.delete(`/ServiceFees/${id}`);
  }

  /** قائمة رسيلرز وكيل معيّن — GET /Agents/{agentId}/resellers. استخدم "me" للوكيل الحالي. للأدمن: agentId الوكيل المختار. */
  async getAgentResellers(agentId: string): Promise<AgentReseller[]> {
    const response = await this.api.get<AgentReseller[]>(`/Agents/${agentId}/resellers`);
    return response.data ?? [];
  }

  /** إضافة رسيلر — POST /Agents/me/resellers */
  async createMyReseller(data: AgentResellerCreateRequest): Promise<AgentReseller> {
    const response = await this.api.post<AgentReseller>('/Agents/me/resellers', data);
    return response.data;
  }

  /** تعديل رسيلر — PUT /Agents/me/resellers/{id} */
  async updateMyReseller(id: string, data: AgentResellerUpdateRequest): Promise<AgentReseller> {
    const response = await this.api.put<AgentReseller>(`/Agents/me/resellers/${id}`, data);
    return response.data;
  }

  /** حذف رسيلر — DELETE /Agents/me/resellers/{id} */
  async deleteMyReseller(id: string): Promise<void> {
    await this.api.delete(`/Agents/me/resellers/${id}`);
  }

  async updateResellerWhatsAppSession(resellerId: string, data: ResellerWhatsAppSessionRequest): Promise<void> {
    await this.api.put(`/Agents/me/resellers/${resellerId}/whatsapp-session`, data);
  }

  async postResellerWhatsAppDevice(resellerId: string): Promise<WhatsAppDeviceResponse> {
    const response = await this.api.post<WhatsAppDeviceResponse>(`/Agents/me/resellers/${resellerId}/whatsapp/device`);
    const d = response.data as WhatsAppDeviceResponse & { Message?: string; DeviceId?: string };
    return {
      message: d?.message ?? d?.Message,
      deviceId: d?.deviceId ?? d?.DeviceId,
    };
  }

  async postResellerWhatsAppPairCode(resellerId: string, phone?: string): Promise<WhatsAppPairCodeResponse> {
    const trimmed = phone?.trim();
    const response = await this.api.post<WhatsAppPairCodeResponse>(
      `/Agents/me/resellers/${resellerId}/whatsapp/pair-code`,
      undefined,
      trimmed ? { params: { phone: trimmed } } : undefined
    );
    const d = response.data as WhatsAppPairCodeResponse & {
      PairCode?: string;
      DeviceId?: string;
      Hint?: string;
    };
    return {
      pairCode: d.pairCode ?? d.PairCode ?? '',
      deviceId: d.deviceId ?? d.DeviceId ?? '',
      hint: d.hint ?? d.Hint,
    };
  }

  async getResellerWhatsAppStatus(resellerId: string): Promise<WhatsAppStatusResponse> {
    const response = await this.api.get<WhatsAppStatusResponse>(`/Agents/me/resellers/${resellerId}/whatsapp/status`);
    const d = response.data as WhatsAppStatusResponse & {
      DeviceId?: string;
      IsConnected?: boolean;
      IsLoggedIn?: boolean;
    };
    return {
      deviceId: d.deviceId ?? d.DeviceId ?? '',
      isConnected: d.isConnected ?? d.IsConnected ?? false,
      isLoggedIn: d.isLoggedIn ?? d.IsLoggedIn ?? false,
    };
  }

  async createAgent(agentData: AgentCreateRequest): Promise<Agent> {
    const response: AxiosResponse<Agent> = await this.api.post('/Agents', agentData);
    return response.data;
  }

  /** تسجيل طلب وكيل (بدون حساب فعّال) — POST /AgentRegistration/register */
  async registerAgent(request: AgentRegistrationRequest): Promise<AgentRegistrationRegisterResponse> {
    const response = await this.api.post<AgentRegistrationRegisterResponse>('/AgentRegistration/register', request, {
      timeout: 120_000,
    });
    return response.data ?? {};
  }

  /** موافقة الأدمن وتفعيل الحساب — POST /AgentRegistration/approve (Admin فقط) */
  async approveAgentRegistration(
    request: AgentRegistrationApproveRequest
  ): Promise<AgentRegistrationApproveResponse> {
    const response = await this.api.post<AgentRegistrationApproveResponse>('/AgentRegistration/approve', request, {
      timeout: 120_000,
    });
    return response.data ?? {};
  }

  async updateAgent(id: string, agentData: AgentUpdateRequest): Promise<Agent> {
    const response: AxiosResponse<Agent> = await this.api.put(`/Agents/${id}`, agentData);
    return response.data;
  }

  /** POST /Agents/{agentId}/whatsapp/device — تسجيل الجهاز في خادم Go (عبر Wakeel) */
  async postAgentWhatsAppDevice(agentId: string): Promise<WhatsAppDeviceResponse> {
    const response = await this.api.post<WhatsAppDeviceResponse>(`/Agents/${agentId}/whatsapp/device`);
    const d = response.data as WhatsAppDeviceResponse & { Message?: string; DeviceId?: string };
    return {
      message: d?.message ?? d?.Message,
      deviceId: d?.deviceId ?? d?.DeviceId,
    };
  }

  /** POST /Agents/{agentId}/whatsapp/pair-code — رمز الاقتران؛ phone اختياري (وإلا رقم الوكيل من السجل) */
  async postAgentWhatsAppPairCode(agentId: string, phone?: string): Promise<WhatsAppPairCodeResponse> {
    const trimmed = phone?.trim();
    const response = await this.api.post<WhatsAppPairCodeResponse>(
      `/Agents/${agentId}/whatsapp/pair-code`,
      undefined,
      trimmed ? { params: { phone: trimmed } } : undefined
    );
    const d = response.data as WhatsAppPairCodeResponse & {
      PairCode?: string;
      DeviceId?: string;
      Hint?: string;
    };
    return {
      pairCode: d.pairCode ?? d.PairCode ?? '',
      deviceId: d.deviceId ?? d.DeviceId ?? '',
      hint: d.hint ?? d.Hint,
    };
  }

  /** GET /Agents/{agentId}/whatsapp/status */
  async getAgentWhatsAppStatus(agentId: string): Promise<WhatsAppStatusResponse> {
    const response = await this.api.get<WhatsAppStatusResponse>(`/Agents/${agentId}/whatsapp/status`);
    const d = response.data as WhatsAppStatusResponse & {
      DeviceId?: string;
      IsConnected?: boolean;
      IsLoggedIn?: boolean;
    };
    return {
      deviceId: d.deviceId ?? d.DeviceId ?? '',
      isConnected: d.isConnected ?? d.IsConnected ?? false,
      isLoggedIn: d.isLoggedIn ?? d.IsLoggedIn ?? false,
    };
  }

  private static readonly WHATSAPP_ADMIN_SESSIONS_BASE = '/Agents/whatsapp/sessions';

  /** GET /Agents/whatsapp/sessions/devices — قائمة أجهزة كاملة (Admin؛ الفلترة في الفرونت) */
  async getWhatsAppSessionsDevices(): Promise<import('../types').WhatsAppSessionsListResponse> {
    const response = await this.api.get<unknown>(
      `${ApiService.WHATSAPP_ADMIN_SESSIONS_BASE}/devices`
    );
    const rawItems = ApiService.extractWhatsAppDevicesArray(response.data);
    const items = rawItems.map(ApiService.normalizeWhatsAppDeviceRow).filter((x) => x.deviceId);
    return { count: items.length, items };
  }

  /** GET /Agents/whatsapp/sessions/devices/:device_id — تفاصيل جهاز */
  async getWhatsAppSessionsDeviceDetail(
    deviceId: string
  ): Promise<import('../types').WhatsAppDeviceDetailResponse> {
    const response = await this.api.get<unknown>(
      `${ApiService.WHATSAPP_ADMIN_SESSIONS_BASE}/devices/${encodeURIComponent(deviceId)}`
    );
    const unwrapped = ApiService.unwrapWhatsAppDevicePayload(response.data);
    const row = ApiService.normalizeWhatsAppDeviceRow(unwrapped);
    const raw =
      unwrapped && typeof unwrapped === 'object' && !Array.isArray(unwrapped)
        ? (unwrapped as Record<string, unknown>)
        : null;
    return { ...row, raw };
  }

  /** DELETE /Agents/whatsapp/sessions/devices/:device_id */
  async deleteWhatsAppSessionsDevice(deviceId: string): Promise<void> {
    await this.api.delete(
      `${ApiService.WHATSAPP_ADMIN_SESSIONS_BASE}/devices/${encodeURIComponent(deviceId)}`
    );
  }

  /** GET /Agents/whatsapp/sessions/devices/:device_id/status */
  async getWhatsAppSessionsDeviceStatus(deviceId: string): Promise<import('../types').WhatsAppDeviceStatusAdmin> {
    const response = await this.api.get<unknown>(
      `${ApiService.WHATSAPP_ADMIN_SESSIONS_BASE}/devices/${encodeURIComponent(deviceId)}/status`
    );
    return ApiService.parseWhatsAppDeviceStatusPayload(response.data, deviceId);
  }

  private static extractWhatsAppDevicesArray(payload: unknown): unknown[] {
    if (Array.isArray(payload)) return payload;
    if (payload == null || typeof payload !== 'object') return [];
    const o = payload as Record<string, unknown>;
    const direct = o.items ?? o.Items ?? o.devices ?? o.Devices ?? o.data ?? o.Data ?? o.results ?? o.Results;
    if (Array.isArray(direct)) return direct;
    const wrap = o.results ?? o.Results ?? o.data ?? o.Data;
    if (wrap && typeof wrap === 'object' && !Array.isArray(wrap)) {
      const w = wrap as Record<string, unknown>;
      for (const k of ['items', 'Items', 'devices', 'Devices', 'data', 'Data']) {
        if (Array.isArray(w[k])) return w[k] as unknown[];
      }
    }
    return [];
  }

  private static normalizeWhatsAppDeviceRow(item: unknown): import('../types').WhatsAppDeviceSession {
    if (item == null || typeof item !== 'object') {
      return { deviceId: '', state: '', createdAt: '' };
    }
    const o = item as Record<string, unknown>;
    /** الباكند قد يرسل المعرف كـ id فقط (بدون deviceId) */
    const deviceId = String(
      o.deviceId ?? o.DeviceId ?? o.device_id ?? o.id ?? o.Id ?? ''
    );
    const state = String(o.state ?? o.State ?? '');
    const createdAt = String(o.createdAt ?? o.CreatedAt ?? o.created_at ?? '');
    const displayNameRaw = o.display_name ?? o.displayName ?? o.DisplayName;
    const displayName =
      displayNameRaw != null && String(displayNameRaw).trim() ? String(displayNameRaw).trim() : undefined;
    const jidRaw = o.jid ?? o.Jid;
    const jid = jidRaw != null && String(jidRaw).trim() ? String(jidRaw).trim() : undefined;
    const agentRaw = o.agent ?? o.Agent;
    let agent: import('../types').WhatsAppSessionAgentSummary | null = null;
    if (agentRaw && typeof agentRaw === 'object') {
      const a = agentRaw as Record<string, unknown>;
      agent = {
        id: String(a.id ?? a.Id ?? ''),
        companyName: String(a.companyName ?? a.CompanyName ?? ''),
        phone: String(a.phone ?? a.Phone ?? ''),
      };
    }
    return { deviceId, state, createdAt, ...(displayName ? { displayName } : {}), ...(jid ? { jid } : {}), agent };
  }

  private static unwrapWhatsAppDevicePayload(payload: unknown): unknown {
    if (payload == null || typeof payload !== 'object') return payload;
    const o = payload as Record<string, unknown>;
    const inner = o.results ?? o.Results ?? o.data ?? o.Data ?? o.device ?? o.Device;
    if (inner != null && typeof inner === 'object' && !Array.isArray(inner)) {
      return inner;
    }
    return payload;
  }

  private static parseWhatsAppDeviceStatusPayload(
    payload: unknown,
    fallbackDeviceId: string
  ): import('../types').WhatsAppDeviceStatusAdmin {
    const root = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
    const inner = (root.results ?? root.Results ?? root) as Record<string, unknown>;
    const s =
      inner && typeof inner === 'object' && !Array.isArray(inner)
        ? inner
        : ({} as Record<string, unknown>);
    return {
      deviceId: String(
        s.device_id ?? s.deviceId ?? s.DeviceId ?? s.id ?? s.Id ?? fallbackDeviceId
      ),
      isConnected: Boolean(s.is_connected ?? s.isConnected ?? s.IsConnected),
      isLoggedIn: Boolean(s.is_logged_in ?? s.isLoggedIn ?? s.IsLoggedIn),
    };
  }

  async deleteAgent(id: string): Promise<void> {
    await this.api.delete(`/Agents/${id}`);
  }

  // --- Main Agent (الوكيل الرئيسي) — إدارة الوكلاء الفرعيين ---
  /** GET /main-agent/sub-agents — قائمة الوكلاء الفرعيين مع pagination وبحث */
  async getMainAgentSubAgents(params?: { page?: number; pageSize?: number; searchTerm?: string }): Promise<AgentsListResponse> {
    const queryParams: Record<string, string | number> = {
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 10,
    };
    if (params?.searchTerm?.trim()) queryParams.searchTerm = params.searchTerm.trim();
    const response: AxiosResponse<AgentsListResponse> = await this.api.get('/main-agent/sub-agents', { params: queryParams });
    return response.data;
  }

  /** مسار لوحة الوكيل الرئيسي — GET /api/main-agent/dashboard */
  private static readonly MAIN_AGENT_DASHBOARD_PATH = '/main-agent/dashboard';

  /** GET /api/main-agent/dashboard — إحصائيات لوحة الوكيل الرئيسي (مجموع الوكلاء الفرعيين) */
  async getMainAgentDashboard(): Promise<MainAgentDashboardDto> {
    const response = await this.api.get(ApiService.MAIN_AGENT_DASHBOARD_PATH);
    const d = response.data as MainAgentDashboardDto & {
      TotalSubscribersCount?: number;
      SubAgentsCount?: number;
      ExpiredSubscribersCount?: number;
      ActiveSubscribersCount?: number;
      TotalDebtsAmount?: number;
      TotalIncomingAmount?: number;
    };
    return {
      totalSubscribersCount: d.totalSubscribersCount ?? d.TotalSubscribersCount ?? 0,
      subAgentsCount: d.subAgentsCount ?? d.SubAgentsCount ?? 0,
      expiredSubscribersCount: d.expiredSubscribersCount ?? d.ExpiredSubscribersCount ?? 0,
      activeSubscribersCount: d.activeSubscribersCount ?? d.ActiveSubscribersCount ?? 0,
      totalDebtsAmount: d.totalDebtsAmount ?? d.TotalDebtsAmount ?? 0,
      totalIncomingAmount: d.totalIncomingAmount ?? d.TotalIncomingAmount ?? 0,
    };
  }

  /** PUT /main-agent/sub-agents/{id} — تعديل وكيل فرعي */
  async updateMainAgentSubAgent(id: string, data: AgentUpdateRequest): Promise<Agent> {
    const response: AxiosResponse<Agent> = await this.api.put(`/main-agent/sub-agents/${id}`, data);
    return response.data;
  }

  /** DELETE /main-agent/sub-agents/{id} — حذف وكيل فرعي */
  async deleteMainAgentSubAgent(id: string): Promise<void> {
    await this.api.delete(`/main-agent/sub-agents/${id}`);
  }

  /** GET /main-agent/sub-agents/{agentId}/subscribers — مشتركو وكيل فرعي */
  async getMainAgentSubAgentSubscribers(agentId: string, params?: PaginationParams): Promise<PaginatedResponse<Subscriber>> {
    const queryParams: Record<string, unknown> = { page: params?.page ?? 1, pageSize: params?.pageSize ?? 10 };
    if (params?.search?.trim()) queryParams.searchTerm = params.search.trim();
    const response: AxiosResponse<PaginatedResponse<Subscriber>> = await this.api.get(
      `/main-agent/sub-agents/${agentId}/subscribers`,
      { params: queryParams }
    );
    return response.data;
  }

  /** GET /main-agent/sub-agents/{agentId}/renewals — تفعيلات/تجديدات وكيل فرعي */
  async getMainAgentSubAgentRenewals(
    agentId: string,
    params?: { page?: number; pageSize?: number; fromDate?: string; toDate?: string }
  ): Promise<PaginatedResponse<RenewalReceipt>> {
    const queryParams: Record<string, string | number> = { page: params?.page ?? 1, pageSize: params?.pageSize ?? 10 };
    if (params?.fromDate) queryParams.fromDate = params.fromDate;
    if (params?.toDate) queryParams.toDate = params.toDate;
    const response: AxiosResponse<PaginatedResponse<RenewalReceipt>> = await this.api.get(
      `/main-agent/sub-agents/${agentId}/renewals`,
      { params: queryParams }
    );
    return response.data;
  }

  /** GET /main-agent/sub-agents/{agentId}/debts — ديون مشتركي وكيل فرعي */
  async getMainAgentSubAgentDebts(agentId: string, params?: DebtsListParams): Promise<DebtsListResponse> {
    const queryParams = this.buildDebtsQueryParams(params);
    const response = await this.api.get(`/main-agent/sub-agents/${agentId}/debts`, { params: queryParams });
    const raw = response.data as DebtsListResponse & { data?: any[] };
    const transformedData = (raw.data || []).map((debt: any) => ({
      ...debt,
      isPaid: debt.status === 1,
      agentId: debt.agentId || '',
      agentName: debt.agentCompanyName || 'غير محدد',
      paidDate: undefined,
      status: debt.status ?? 0,
    }));
    return { ...raw, data: transformedData };
  }

  /** GET /main-agent/sub-agents/{agentId}/daily-account?date= — الحساب اليومي لوكيل فرعي */
  async getMainAgentSubAgentDailyAccount(agentId: string, date: string): Promise<DailyAccountResponse> {
    const response: AxiosResponse<DailyAccountResponse> = await this.api.get(
      `/main-agent/sub-agents/${agentId}/daily-account`,
      { params: { date } }
    );
    return response.data;
  }

  async renewAgentSubscription(id: string, renewalData: AgentRenewalRequest): Promise<Agent> {
    const response: AxiosResponse<Agent> = await this.api.post(`/Agents/${id}/renew`, renewalData);
    return response.data;
  }

  async checkExpiredAgents(): Promise<AgentSubscriptionCheck> {
    const response: AxiosResponse<AgentSubscriptionCheck> = await this.api.post('/Agents/check-expired');
    return response.data;
  }

  async getAgentEmployees(agentId: string): Promise<User[]> {
    const response: AxiosResponse<User[]> = await this.api.get(`/Agents/${agentId}/employees`);
    return response.data;
  }

  async createAgentEmployee(agentId: string, data: AgentEmployeeCreateRequest): Promise<User> {
    const body = {
      ...data,
      role: data.role === UserRole.SubAgent ? UserRole.SubAgent : UserRole.Employee,
    };
    const response: AxiosResponse<User> = await this.api.post(`/Agents/${agentId}/employees`, body);
    return response.data;
  }

  /** موظفو الوكيل الحالي (Agent) */
  async getMyEmployees(): Promise<User[]> {
    const response: AxiosResponse<User[]> = await this.api.get('/Agents/me/employees');
    return response.data;
  }

  /** إضافة موظف للوكيل الحالي (Agent) — Body يتضمن role: 4 (Employee) أو 5 (SubAgent) */
  async createMyEmployee(data: AgentEmployeeCreateRequest): Promise<User> {
    const body = {
      ...data,
      role: data.role === UserRole.SubAgent ? UserRole.SubAgent : UserRole.Employee,
    };
    const response: AxiosResponse<User> = await this.api.post('/Agents/me/employees', body);
    return response.data;
  }

  /** تعديل موظف تابع للوكيل الحالي (Agent) */
  async updateMyEmployee(id: string, data: AgentEmployeeUpdateRequest): Promise<User> {
    const response: AxiosResponse<User> = await this.api.put(`/Agents/me/employees/${id}`, data);
    return response.data;
  }

  /** حذف موظف تابع للوكيل الحالي (Agent) */
  async deleteMyEmployee(id: string): Promise<void> {
    await this.api.delete(`/Agents/me/employees/${id}`);
  }

  // --- Employee Tasks ---
  async createEmployeeTask(
    data: import('../types').EmployeeTaskCreateRequest
  ): Promise<import('../types').EmployeeTask | import('../types').EmployeeTaskCreateBatchResponse> {
    const response = await this.api.post('/EmployeeTasks', data);
    const d = response.data as import('../types').EmployeeTask & import('../types').EmployeeTaskCreateBatchResponse;
    if (d && Array.isArray((d as import('../types').EmployeeTaskCreateBatchResponse).tasks)) {
      return d as import('../types').EmployeeTaskCreateBatchResponse;
    }
    return d as import('../types').EmployeeTask;
  }

  async updateEmployeeTask(
    id: string,
    data: import('../types').EmployeeTaskUpdateRequest
  ): Promise<import('../types').EmployeeTask> {
    const response = await this.api.put<import('../types').EmployeeTask>(`/EmployeeTasks/${id}`, data);
    return response.data;
  }

  async deleteEmployeeTask(id: string): Promise<void> {
    await this.api.delete(`/EmployeeTasks/${id}`);
  }

  async getMyEmployeeTasks(
    params?: import('../types').EmployeeTasksQuery
  ): Promise<PaginatedResponse<import('../types').EmployeeTask>> {
    const queryParams: Record<string, string | number> = {
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 10,
    };
    if (params?.searchTerm?.trim()) queryParams.searchTerm = params.searchTerm.trim();
    if (typeof params?.status === 'number') queryParams.status = params.status;
    const response = await this.api.get<PaginatedResponse<import('../types').EmployeeTask>>('/EmployeeTasks/my', {
      params: queryParams,
    });
    return response.data;
  }

  async getAgentEmployeeTasks(
    params?: import('../types').EmployeeTasksQuery
  ): Promise<PaginatedResponse<import('../types').EmployeeTask>> {
    const queryParams: Record<string, string | number> = {
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 10,
    };
    if (params?.searchTerm?.trim()) queryParams.searchTerm = params.searchTerm.trim();
    if (typeof params?.status === 'number') queryParams.status = params.status;
    if (params?.agentId?.trim()) queryParams.agentId = params.agentId.trim();
    const response = await this.api.get<PaginatedResponse<import('../types').EmployeeTask>>('/EmployeeTasks/agent', {
      params: queryParams,
    });
    return response.data;
  }

  async getEmployeeTaskMaterials(params?: {
    page?: number;
    pageSize?: number;
    searchTerm?: string;
    agentId?: string;
  }): Promise<PaginatedResponse<import('../types').EmployeeTaskMaterialOption>> {
    const queryParams: Record<string, string | number> = {
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 10,
    };
    if (params?.searchTerm?.trim()) queryParams.searchTerm = params.searchTerm.trim();
    if (params?.agentId?.trim()) queryParams.agentId = params.agentId.trim();

    const response = await this.api.get<PaginatedResponse<import('../types').EmployeeTaskMaterialOption>>(
      '/EmployeeTasks/materials',
      { params: queryParams }
    );
    return response.data;
  }

  /** GET /EmployeeTasks/subscribers — خيارات مشتركي الوكيل (صيانة / استلام مبلغ؛ debtOnly=ذوو الدين فقط) */
  async getEmployeeTaskSubscribers(params?: {
    page?: number;
    pageSize?: number;
    searchTerm?: string;
    agentId?: string;
    debtOnly?: boolean;
  }): Promise<PaginatedResponse<import('../types').EmployeeTaskSubscriberOption>> {
    const queryParams: Record<string, string | number | boolean> = {
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 10,
    };
    if (params?.searchTerm?.trim()) queryParams.searchTerm = params.searchTerm.trim();
    if (params?.agentId?.trim()) queryParams.agentId = params.agentId.trim();
    if (params?.debtOnly === true) queryParams.debtOnly = true;

    const response = await this.api.get<PaginatedResponse<import('../types').EmployeeTaskSubscriberOption>>(
      '/EmployeeTasks/subscribers',
      { params: queryParams }
    );
    return response.data;
  }

  /** GET /EmployeeTasks/subscriber/{subscriberId}/tasks — مهام المشترك مع ترقيم */
  async getSubscriberEmployeeTasks(
    subscriberId: string,
    params?: { page?: number; pageSize?: number; searchTerm?: string }
  ): Promise<PaginatedResponse<import('../types').EmployeeTask>> {
    const queryParams: Record<string, string | number> = {
      Page: params?.page ?? 1,
      PageSize: params?.pageSize ?? 10,
    };
    if (params?.searchTerm?.trim()) queryParams.searchTerm = params.searchTerm.trim();
    const response = await this.api.get<PaginatedResponse<import('../types').EmployeeTask>>(
      `/EmployeeTasks/subscriber/${encodeURIComponent(subscriberId)}/tasks`,
      { params: queryParams }
    );
    const body = response.data;
    return {
      ...body,
      data: Array.isArray(body?.data) ? body.data : [],
    };
  }

  // --- Web Push (PWA) ---
  async getWebPushVapidPublicKey(): Promise<{ publicKey: string }> {
    const response = await this.api.get<{ publicKey: string }>('/Push/vapid-public-key');
    return response.data;
  }

  async subscribeWebPush(body: { subscription: any; userAgent?: string }): Promise<{ ok: boolean }> {
    const response = await this.api.post<{ ok: boolean }>('/Push/subscribe', body);
    return response.data;
  }

  async acceptEmployeeTask(id: string): Promise<import('../types').EmployeeTask> {
    const response = await this.api.post<import('../types').EmployeeTask>(`/EmployeeTasks/${id}/accept`);
    return response.data;
  }

  async completeEmployeeInstallationTask(
    id: string,
    data: import('../types').EmployeeTaskCompleteInstallationRequest
  ): Promise<import('../types').EmployeeTask> {
    const payload: Record<string, string> = {
      subscriberName: (data.subscriberName || '').trim(),
    };

    const phone = (data.subscriberPhone || '').trim();
    if (phone) {
      // توافق مع أكثر من اسم DTO محتمل في الباكند
      payload.subscriberPhone = phone;
      payload.phoneNumber = phone;
      payload.completedPhoneNumber = phone;
    }

    const signal = (data.signalNumber || '').trim();
    if (signal) payload.signalNumber = signal;

    const note = (data.note || '').trim();
    if (note) payload.note = note;

    const response = await this.api.post<import('../types').EmployeeTask>(`/EmployeeTasks/${id}/complete-installation`, payload);
    return response.data;
  }

  async completeEmployeeMaintenanceTask(
    id: string,
    data: import('../types').EmployeeTaskCompleteMaintenanceRequest
  ): Promise<import('../types').EmployeeTask> {
    const payload: Record<string, string> = {
      note: (data.note || '').trim(),
    };
    if (!payload.note) delete payload.note;
    const response = await this.api.post<import('../types').EmployeeTask>(
      `/EmployeeTasks/${id}/complete-maintenance`,
      payload
    );
    return response.data;
  }

  async completeEmployeeAmountReceptionTask(
    id: string,
    data: import('../types').EmployeeTaskCompleteAmountReceptionRequest
  ): Promise<import('../types').EmployeeTask> {
    const payload: Record<string, unknown> = {
      amountReceived: data.amountReceived,
    };
    const note = (data.note || '').trim();
    if (note) payload.note = note;
    const response = await this.api.post<import('../types').EmployeeTask>(
      `/EmployeeTasks/${id}/complete-amount-reception`,
      payload
    );
    return response.data;
  }

  /**
   * سجل الحركات (GET /api/ActivityLog)
   * - Agent: لا يرسل agentId (الباكند يستنتجه من التوكن)
   * - Admin: يجب إرسال agentId
   * - فلترة متقدمة: activityType (1–5), subscriberName, fromDate, toDate (yyyy-MM-dd)
   */
  async getActivityLog(params: {
    agentId?: string;
    page: number;
    pageSize: number;
    activityType?: ActivityType;
    subscriberName?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<PaginatedResponse<ActivityLogItem>> {
    const queryParams: Record<string, string | number> = {
      page: params.page,
      pageSize: params.pageSize,
    };
    if (params.agentId) queryParams.agentId = params.agentId;
    if (params.activityType != null) queryParams.activityType = params.activityType;
    if (params.subscriberName?.trim()) queryParams.subscriberName = params.subscriberName.trim();
    if (params.fromDate) queryParams.fromDate = params.fromDate.split('T')[0];
    if (params.toDate) queryParams.toDate = params.toDate.split('T')[0];
    const response: AxiosResponse<PaginatedResponse<ActivityLogItem>> = await this.api.get('/ActivityLog', {
      params: queryParams,
    });
    return response.data;
  }

  // Profile/Package endpoints
  async getProfiles(params?: ProfileListParams): Promise<PaginatedResponse<Profile>> {
    const response: AxiosResponse<PaginatedResponse<Profile> | Profile[]> = await this.api.get('/subscribers/profiles', {
      params: params ? {
        page: params.page,
        pageSize: params.pageSize,
        searchTerm: params.searchTerm || undefined,
        sortBy: params.sortBy || undefined,
        sortDescending: params.sortDescending,
        status: params.status,
        resellerId: params.resellerId || undefined,
      } : undefined,
    });
    const data = response.data;
    if (Array.isArray(data)) {
      return {
        data,
        currentPage: 1,
        pageSize: data.length,
        totalItems: data.length,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
        totalCount: data.length,
        pageNumber: 1,
      };
    }
    return data as PaginatedResponse<Profile>;
  }

  async createProfile(profileData: ProfileCreateRequest): Promise<Profile> {
    const response: AxiosResponse<Profile> = await this.api.post('/subscribers/profiles', profileData);
    return response.data;
  }

  async updateProfile(id: string, profileData: ProfileUpdateRequest): Promise<Profile> {
    const response: AxiosResponse<Profile> = await this.api.put(`/subscribers/profiles/${id}`, profileData);
    return response.data;
  }

  async deleteProfile(id: string): Promise<void> {
    await this.api.delete(`/subscribers/profiles/${id}`);
  }

  private normalizeSynchronizationDiffRow(r: any): import('../types').CashbackSynchronizationFtthRow {
    return {
      subscriberId: r?.subscriberId ?? r?.SubscriberId ?? null,
      customerId: r?.customerId ?? r?.CustomerId ?? null,
      customerName: r?.customerName ?? r?.CustomerName ?? r?.firstname ?? r?.Firstname ?? null,
      deviceUsername: r?.deviceUsername ?? r?.DeviceUsername ?? r?.username ?? r?.Username ?? null,
      subscriptionName:
        r?.subscriptionName ?? r?.SubscriptionName ?? r?.profile_details?.name ?? r?.ProfileDetails?.name ?? null,
      subscriptionEndsAt:
        r?.subscriptionEndsAt ?? r?.SubscriptionEndsAt ?? r?.new_expiration ?? r?.NewExpiration ?? null,
      localSubscriptionEndsAt: r?.localSubscriptionEndsAt ?? r?.LocalSubscriptionEndsAt ?? null,
      zoneId: r?.zoneId ?? r?.ZoneId ?? null,
      activationType: r?.activationType ?? r?.ActivationType ?? null,
      firstname: r?.firstname ?? r?.Firstname ?? null,
      profile_details: r?.profile_details ?? r?.ProfileDetails ?? null,
      new_expiration: r?.new_expiration ?? r?.NewExpiration ?? null,
      parent_username: r?.parent_username ?? r?.ParentUsername ?? null,
      username: r?.username ?? r?.Username ?? null,
      activation_method: r?.activation_method ?? r?.ActivationMethod ?? null,
    };
  }

  private normalizeSynchronizationDiffResponse(body: any): CashbackSynchronizationFtthResponse {
    const rawRows = body?.differences ?? body?.Differences ?? body?.data ?? body?.Data ?? [];
    const data = Array.isArray(rawRows) ? rawRows.map((r) => this.normalizeSynchronizationDiffRow(r)) : [];
    return {
      ...body,
      externalRowCount: body?.externalRowCount ?? body?.ExternalRowCount,
      localSubscriberCount: body?.localSubscriberCount ?? body?.LocalSubscriberCount,
      matchedPairCount: body?.matchedPairCount ?? body?.MatchedPairCount,
      data,
      count: data.length,
      serviceFees: this.normalizeServiceFeesList(body?.serviceFees ?? body?.ServiceFees),
    };
  }

  private buildSynchronizationDiffSaveBody(
    row: import('../types').CashbackSynchronizationFtthRow,
    options?: { serviceFeesId?: string; serviceFeesAmountPaid?: number }
  ): import('../types').SynchronizationDiffSaveRequest {
    const body: import('../types').SynchronizationDiffSaveRequest = {
      customerId: row.customerId ?? undefined,
      customerName: (row.customerName ?? row.firstname ?? undefined) || undefined,
      deviceUsername: (row.deviceUsername ?? row.username ?? undefined) || undefined,
      subscriptionName: (row.subscriptionName ?? row.profile_details?.name ?? undefined) || undefined,
      subscriptionEndsAt: (row.subscriptionEndsAt ?? row.new_expiration ?? undefined) || undefined,
      zoneId: row.zoneId ?? undefined,
    };
    if (options?.serviceFeesId) {
      body.serviceFeesId = options.serviceFeesId;
      body.serviceFeesAmountPaid = options.serviceFeesAmountPaid ?? 0;
    }
    return body;
  }

  private normalizeServiceFeesList(raw: unknown): ServiceFees[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((f: any) => ({
        id: String(f?.id ?? f?.Id ?? ''),
        agentId: String(f?.agentId ?? f?.AgentId ?? ''),
        name: String(f?.name ?? f?.Name ?? ''),
        price: Number(f?.price ?? f?.Price ?? 0) || 0,
      }))
      .filter((f) => f.id);
  }

  private normalizeMaterial(m: any): Material {
    return {
      ...m,
      id: m?.id ?? m?.Id ?? '',
      name: m?.name ?? m?.Name ?? '',
      imagePngUrl: m?.imagePngUrl ?? m?.ImagePngUrl ?? null,
      quantity: Number(m?.quantity ?? m?.Quantity ?? 0) || 0,
      agentPrice: Number(m?.agentPrice ?? m?.AgentPrice ?? 0) || 0,
      subscriberPrice: Number(m?.subscriberPrice ?? m?.SubscriberPrice ?? 0) || 0,
      totalAgentAmount: Number(m?.totalAgentAmount ?? m?.TotalAgentAmount ?? 0) || 0,
      notes: m?.notes ?? m?.Notes ?? null,
      agentId: m?.agentId ?? m?.AgentId,
      createdAt: m?.createdAt ?? m?.CreatedAt,
      updatedAt: m?.updatedAt ?? m?.UpdatedAt,
    };
  }

  /** قائمة المواد — GET /api/Materials مع ترقيم وفلترة (searchTerm: اسم المادة أو الملاحظات) */
  async getMaterials(
    agentId?: string,
    params?: { page?: number; pageSize?: number; searchTerm?: string }
  ): Promise<PaginatedResponse<Material>> {
    const queryParams: Record<string, number | string | undefined> = {
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 10,
    };
    if (agentId) queryParams.agentId = agentId;
    if (params?.searchTerm?.trim()) queryParams.searchTerm = params.searchTerm.trim();

    const response: AxiosResponse<PaginatedResponse<Material> | Material[]> = await this.api.get('/Materials', {
      params: queryParams,
    });
    const data = response.data;
    if (Array.isArray(data)) {
      const normalized = data.map((m) => this.normalizeMaterial(m));
      const total = normalized.length;
      return {
        data: normalized,
        currentPage: 1,
        pageSize: total,
        totalItems: total,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
        totalCount: total,
        pageNumber: 1,
      };
    }
    const paginated = data as PaginatedResponse<Material>;
    const totalItems = paginated.totalItems ?? paginated.totalCount ?? (paginated.data?.length ?? 0);
    const currentPage = paginated.currentPage ?? paginated.pageNumber ?? 1;
    const pageSize = paginated.pageSize ?? 10;
    return {
      data: (paginated.data ?? []).map((m: any) => this.normalizeMaterial(m)),
      currentPage,
      pageSize,
      totalItems,
      totalPages: paginated.totalPages ?? 1,
      hasNextPage: paginated.hasNextPage ?? false,
      hasPreviousPage: paginated.hasPreviousPage ?? false,
      totalCount: totalItems,
      pageNumber: currentPage,
    };
  }

  /** إضافة مادة — POST /api/Materials (أدمن/وكيل/مدير ثانوي، اختياري: agentId للأدمن) */
  async createMaterial(data: MaterialCreateRequest, agentId?: string): Promise<Material> {
    const response: AxiosResponse<Material> = await this.api.post('/Materials', data, {
      params: agentId ? { agentId } : undefined,
    });
    return this.normalizeMaterial(response.data);
  }

  /** تعديل مادة — PUT /api/Materials/{id} (اختياري: agentId للأدمن) */
  async updateMaterial(id: string, data: MaterialUpdateRequest, agentId?: string): Promise<Material> {
    const response: AxiosResponse<Material> = await this.api.put(`/Materials/${id}`, data, {
      params: agentId ? { agentId } : undefined,
    });
    return this.normalizeMaterial(response.data);
  }

  /** حذف مادة — DELETE /api/Materials/{id} (اختياري: agentId للأدمن) */
  async deleteMaterial(id: string, agentId?: string): Promise<void> {
    await this.api.delete(`/Materials/${id}`, {
      params: agentId ? { agentId } : undefined,
    });
  }

  /** صرف/بيع مادة — POST /api/Materials/disburse (اختياري: agentId للأدمن)، يُرجع السجل المُنشأ مع رقم الفاتورة عند البيع */
  async postMaterialDisburse(data: MaterialDisburseRequest, agentId?: string): Promise<MaterialDisbursement> {
    const response = await this.api.post<MaterialDisbursement>('/Materials/disburse', data, {
      params: agentId ? { agentId } : undefined,
    });
    return response.data;
  }

  /** استرجاع مادة — POST /api/Materials/disbursements/return (اختياري: agentId للأدمن) */
  async postMaterialReturn(data: MaterialReturnRequest, agentId?: string): Promise<void> {
    await this.api.post('/Materials/disbursements/return', data, {
      params: agentId ? { agentId } : undefined,
    });
  }

  /** قائمة المواد المصروفة — GET /api/Materials/disbursements مع فلترة وترقيم وإحصائيات */
  async getMaterialDisbursements(
    agentId?: string,
    params?: {
      page?: number;
      pageSize?: number;
      searchTerm?: string;
      disbursementType?: number;
      fromDate?: string;
      toDate?: string;
    }
  ): Promise<MaterialDisbursementsResponse> {
    const queryParams: Record<string, number | string | undefined> = {
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 10,
    };
    if (agentId) queryParams.agentId = agentId;
    if (params?.searchTerm?.trim()) queryParams.searchTerm = params.searchTerm.trim();
    if (params?.disbursementType !== undefined && params?.disbursementType !== null)
      queryParams.disbursementType = params.disbursementType;
    if (params?.fromDate?.trim()) queryParams.fromDate = params.fromDate.trim().split('T')[0];
    if (params?.toDate?.trim()) queryParams.toDate = params.toDate.trim().split('T')[0];

    const response: AxiosResponse<MaterialDisbursementsResponse> = await this.api.get('/Materials/disbursements', {
      params: queryParams,
    });
    const data = response.data;
    if (Array.isArray(data)) {
      return {
        data,
        currentPage: 1,
        pageSize: data.length,
        totalItems: data.length,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      };
    }
    const raw = data as { data?: MaterialDisbursement[]; Data?: MaterialDisbursement[]; currentPage?: number; pageSize?: number; totalItems?: number; totalPages?: number; hasNextPage?: boolean; hasPreviousPage?: boolean; statistics?: MaterialDisbursementsResponse['statistics'] };
    const items = raw.data ?? raw.Data ?? [];
    return {
      data: items,
      currentPage: raw.currentPage ?? 1,
      pageSize: raw.pageSize ?? 10,
      totalItems: raw.totalItems ?? 0,
      totalPages: raw.totalPages ?? 1,
      hasNextPage: raw.hasNextPage ?? false,
      hasPreviousPage: raw.hasPreviousPage ?? false,
      statistics: raw.statistics,
    };
  }

  // Subscriber endpoints

  /**
   * تصدير/سحب مشتركي FTTH — POST /providers/sas/ftth-subscribers-export
   * query: agentId (أدمن)، resellerId، expirationFrom، expirationTo (اختياري)
   */
  async exportFtthSubscribers(
    query: {
      agentId?: string;
      resellerId?: string;
      expirationFrom?: string;
      expirationTo?: string;
    },
    body: FtthSubscribersExportBody | Record<string, never>
  ): Promise<FtthSubscribersExportResponse> {
    const params: Record<string, string> = {};
    if (query.agentId) params.agentId = query.agentId;
    if (query.resellerId) params.resellerId = query.resellerId;
    if (query.expirationFrom) params.expirationFrom = query.expirationFrom;
    if (query.expirationTo) params.expirationTo = query.expirationTo;
    const response = await this.api.post<FtthSubscribersExportResponse>(
      '/providers/sas/ftth-subscribers-export',
      body,
      {
        params: Object.keys(params).length ? params : undefined,
        timeout: 600_000,
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const data = response.data ?? {};
    return {
      ...data,
      serviceFees: this.normalizeServiceFeesList(data.serviceFees ?? (data as any).ServiceFees),
    };
  }

  /**
   * حفظ قائمة مشتركي FTTH المُصدَّرة في قاعدة الوكيل — POST /providers/sas/ftth-subscribers-import
   */
  async importFtthSubscribers(
    payload: { data: unknown[] },
    agentId?: string
  ): Promise<FtthSubscribersImportResponse> {
    const response = await this.api.post<FtthSubscribersImportResponse>(
      '/providers/sas/ftth-subscribers-import',
      payload,
      {
        params: agentId ? { agentId } : undefined,
        timeout: 600_000,
        headers: { 'Content-Type': 'application/json' },
      }
    );
    return response.data ?? {};
  }

  /**
   * تصدير/سحب مشتركي SAS أو Earthlink — POST /providers/sas/sas-subscribers-export
   * (للوحات FTTH استخدم ftth-subscribers-export؛ هذا المسار يرد 400 إن كان الرسيلر FTTH)
   */
  async exportSasSubscribers(
    query: {
      agentId?: string;
      resellerId?: string;
      expirationFrom?: string;
      expirationTo?: string;
    },
    body: SasSubscribersExportBody | Record<string, never>
  ): Promise<SasSubscribersExportResponse> {
    const params: Record<string, string> = {};
    if (query.agentId) params.agentId = query.agentId;
    if (query.resellerId) params.resellerId = query.resellerId;
    if (query.expirationFrom) params.expirationFrom = query.expirationFrom;
    if (query.expirationTo) params.expirationTo = query.expirationTo;
    const response = await this.api.post<SasSubscribersExportResponse>(
      '/providers/sas/sas-subscribers-export',
      body,
      {
        params: Object.keys(params).length ? params : undefined,
        timeout: 600_000,
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const data = response.data ?? {};
    return {
      ...data,
      serviceFees: this.normalizeServiceFeesList(data.serviceFees ?? (data as any).ServiceFees),
    };
  }

  /**
   * حفظ قائمة مشتركي SAS المُصدَّرة في قاعدة الوكيل — POST /providers/sas/sas-subscribers-import
   */
  async importSasSubscribers(
    payload: { data: unknown[] },
    agentId?: string
  ): Promise<SasSubscribersImportResponse> {
    const response = await this.api.post<SasSubscribersImportResponse>(
      '/providers/sas/sas-subscribers-import',
      payload,
      {
        params: agentId ? { agentId } : undefined,
        timeout: 600_000,
        headers: { 'Content-Type': 'application/json' },
      }
    );
    return response.data ?? {};
  }

  async getSubscribers(params?: PaginationParams): Promise<PaginatedResponse<Subscriber>> {
    try {
      // تنظيف params - إزالة undefined values
      const cleanParams: any = {};
      if (params?.page !== undefined) cleanParams.Page = params.page;
      if (params?.pageSize !== undefined) cleanParams.PageSize = params.pageSize;
      // الباكند يستخدم searchTerm بدلاً من search
      if (params?.search && params.search.trim()) {
        cleanParams.searchTerm = params.search.trim();
      }
      // الباكند يستخدم Status (بحرف S كبير)
      if (params?.status) cleanParams.Status = params.status;
      if (params?.role) cleanParams.role = params.role;
      if (params?.sortBy) cleanParams.sortBy = params.sortBy;
      if (params?.sortDescending !== undefined) cleanParams.sortDescending = params.sortDescending === true;
      if (params?.maxDaysUntilExpiry !== undefined && params.maxDaysUntilExpiry >= 0) {
        cleanParams.maxDaysUntilExpiry = params.maxDaysUntilExpiry;
      }
      if (params?.fat?.trim()) cleanParams.fat = params.fat.trim();
      if (params?.apartmentNumber?.trim()) cleanParams.apartmentNumber = params.apartmentNumber.trim();
      if (params?.zone?.trim()) cleanParams.zone = params.zone.trim();
      const profileIds = (params?.profileIds ?? []).map((id) => id.trim()).filter(Boolean);
      if (profileIds.length > 0) {
        cleanParams.profileIds = profileIds;
      } else if (params?.profileId?.trim()) {
        cleanParams.profileId = params.profileId.trim();
      }
      if (params?.noteType !== undefined && params.noteType !== null) {
        cleanParams.noteType = params.noteType;
      }
      if (params?.expirationFromDate?.trim()) {
        cleanParams.ExpirationFromDate = params.expirationFromDate.trim().split('T')[0];
      }
      if (params?.expirationToDate?.trim()) {
        cleanParams.ExpirationToDate = params.expirationToDate.trim().split('T')[0];
      }
      if (params?.resellerId?.trim()) {
        cleanParams.resellerId = params.resellerId.trim();
      }
      if (params?.regionId?.trim()) {
        cleanParams.regionId = params.regionId.trim();
      }
      if (params?.hasExtensionActivation) {
        cleanParams.hasExtensionActivation = true;
      }
      
      console.log('🌐 API: getSubscribers called with params:', cleanParams);
      console.log('🌐 API: Full URL will be:', this.api.defaults.baseURL + '/subscribers?' + new URLSearchParams(cleanParams).toString());
      
      const response: AxiosResponse<PaginatedResponse<Subscriber>> = await this.api.get('/subscribers', {
        params: cleanParams,
        paramsSerializer: { indexes: null },
      });
      console.log('✅ API: getSubscribers response received:', {
        totalItems: response.data.totalItems,
        dataLength: response.data.data?.length,
        currentPage: response.data.currentPage
      });
      
      // معالجة البيانات القادمة من الباكند للتأكد من التطابق
      const processedData = {
        ...response.data,
        data: response.data.data.map((subscriber: any) => ({
          ...subscriber,
          // التأكد من أن paymentStatus صحيح (إذا كان 0، استخدم Unknown)
          paymentStatus: subscriber.paymentStatus === 0 ? PaymentStatus.Unknown : subscriber.paymentStatus,
          paymentMethod: subscriber.paymentMethod ?? subscriber.PaymentMethod ?? null,
          // إضافة expirationDate إذا لم يكن موجوداً (احسبه من activationDate + renewalPeriod)
          expirationDate: subscriber.expirationDate || subscriber.activationDate,
        }))
      };
      
      return processedData;
    } catch (error) {
      console.error('Error fetching subscribers:', error);
      // إرجاع بيانات وهمية للتطوير
      const mockSubscribers: Subscriber[] = [
        {
          id: '1',
          username: 'ahmed123',
          firstName: 'أحمد',
          lastName: 'محمد',
          fullName: 'أحمد محمد',
          phoneNumber: '07701234567',
          note: 'مشترك نشط',
          isActive: true,
          activationDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          subscriptionType: SubscriptionType.Paid,
          status: SubscriptionStatus.Active,
          paymentStatus: PaymentStatus.Paid,
          daysUntilExpiry: 25,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          profileName: 'باقة شهرية',
          profilePrice: 25000,
          agentCompanyName: 'وكيل بغداد'
        },
        {
          id: '2',
          username: 'fatima456',
          firstName: 'فاطمة',
          lastName: 'علي',
          fullName: 'فاطمة علي',
          phoneNumber: '07701234568',
          note: 'مشترك جديد',
          isActive: true,
          activationDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          expirationDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          subscriptionType: SubscriptionType.Paid,
          status: SubscriptionStatus.Active,
          paymentStatus: PaymentStatus.Unpaid,
          daysUntilExpiry: 3,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          profileName: 'باقة أسبوعية',
          profilePrice: 8000,
          agentCompanyName: 'وكيل بغداد'
        }
      ];
      
      return {
        data: mockSubscribers,
        currentPage: 1,
        pageSize: 10,
        totalItems: mockSubscribers.length,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
        totalCount: mockSubscribers.length,
        pageNumber: 1
      };
    }
  }

  async getSubscriberById(id: string): Promise<Subscriber> {
    const response: AxiosResponse<Subscriber> = await this.api.get(`/subscribers/${id}`);
    // معالجة البيانات للتأكد من التطابق
    const d = response.data as any;
    const mr = d.maintenanceRecords ?? d.MaintenanceRecords;
    return {
      ...response.data,
      paymentStatus: response.data.paymentStatus === 0 ? PaymentStatus.Unknown : response.data.paymentStatus,
      paymentMethod: d.paymentMethod ?? d.PaymentMethod ?? null,
      expirationDate: response.data.expirationDate || response.data.activationDate,
      maintenanceRecords: Array.isArray(mr) ? mr : [],
    };
  }

  async createSubscriber(subscriberData: SubscriberCreateRequest): Promise<Subscriber> {
    const response: AxiosResponse<Subscriber> = await this.api.post('/subscribers', subscriberData);
    return response.data;
  }

  async updateSubscriber(id: string, subscriberData: SubscriberUpdateRequest): Promise<Subscriber> {
    const response: AxiosResponse<Subscriber> = await this.api.put(`/subscribers/${id}`, subscriberData);
    return response.data;
  }

  /** تحديث noteType و note فقط */
  async updateSubscriberNote(id: string, noteType: number | null, note: string): Promise<Subscriber> {
    const payload: { noteType: number | null; note: string } = {
      noteType: noteType ?? 0,
      note: note || '',
    };
    const response: AxiosResponse<Subscriber> = await this.api.patch(`/subscribers/${id}`, payload);
    return response.data;
  }

  async deleteSubscriber(id: string): Promise<void> {
    await this.api.delete(`/subscribers/${id}`);
  }

  /**
   * إرسال رسالة تنبيه واحدة عبر `POST .../send-whatsapp-alert` (لا يُستدعى تفعيل منفصل ولا تفاصيل منفصلة).
   * الاسم التاريخي `sendWhatsAppReminder` يبقى لتوافق الاستدعاءات؛ السلوك هو نفس `sendWhatsAppAlert`.
   */
  async sendWhatsAppReminder(subscriberId: string): Promise<void> {
    await this.sendWhatsAppAlert(subscriberId);
  }

  /** مهلة أطول لإرسال واتساب لأن wwebjs على Railway قد يستغرق وقتاً */
  static readonly WHATSAPP_SEND_TIMEOUT_MS = 60000;

  /** مزامنة SAS/FTTH (جلب قائمة، JSON، إلخ) قد تتجاوز دقيقتين بعد توسيع السكربت */
  static readonly SAS_SYNC_TIMEOUT_MS = 600_000; // 10 minutes

  /** إرسال رسالة التفعيل/التجديد فقط عبر wwebjs-api */
  async sendWhatsAppActivation(subscriberId: string): Promise<void> {
    await this.api.post(`/subscribers/${subscriberId}/send-whatsapp-activation`, undefined, {
      timeout: ApiService.WHATSAPP_SEND_TIMEOUT_MS,
    });
  }

  /** إرسال رسالة التنبيه فقط عبر wwebjs-api */
  async sendWhatsAppAlert(subscriberId: string): Promise<void> {
    await this.api.post(`/subscribers/${subscriberId}/send-whatsapp-alert`, undefined, {
      timeout: ApiService.WHATSAPP_SEND_TIMEOUT_MS,
    });
  }

  /** إرسال رسالة الدين او التفاصيل فقط عبر wwebjs-api */
  async sendWhatsAppDetails(subscriberId: string): Promise<void> {
    await this.api.post(`/subscribers/${subscriberId}/send-whatsapp-details`, undefined, {
      timeout: ApiService.WHATSAPP_SEND_TIMEOUT_MS,
    });
  }

  /** إرسال تنبيه تسديد الدين عبر القالب المستقل DebtAlertMessage */
  async sendWhatsAppDebtAlert(subscriberId: string): Promise<void> {
    await this.api.post(`/subscribers/${subscriberId}/send-whatsapp-debt-alert`, undefined, {
      timeout: ApiService.WHATSAPP_SEND_TIMEOUT_MS,
    });
  }

  async getSubscriberInfo(username: string): Promise<SubscriberInfo> {
    const response: AxiosResponse<SubscriberInfo> = await this.api.get(`/subscribers/info/${username}`);
    return response.data;
  }

  /** إعدادات تطبيق المشترك (طريقة الدفع، رقم البطاقة، عنوان المكتب) — GET /api/AppSettings */
  async getAppSettings(): Promise<AppSettingsResponse> {
    const response = await this.api.get<AppSettingsResponse>('/AppSettings');
    return response.data;
  }

  /** تحديث إعدادات تطبيق المشترك — PUT /api/AppSettings */
  async updateAppSettings(data: AppSettingsUpdateRequest): Promise<AppSettingsResponse> {
    const response = await this.api.put<AppSettingsResponse>('/AppSettings', data);
    return response.data;
  }

  /** قائمة إعلانات الوكيل — GET /api/AppSettings/announcements */
  async getAgentAnnouncements(): Promise<AgentAnnouncementDto[]> {
    const response = await this.api.get<AgentAnnouncementDto[]>('/AppSettings/announcements');
    return response.data;
  }

  /** إعلان واحد — GET /api/AppSettings/announcements/{id} */
  async getAgentAnnouncementById(id: string): Promise<AgentAnnouncementDto> {
    const response = await this.api.get<AgentAnnouncementDto>(`/AppSettings/announcements/${id}`);
    return response.data;
  }

  /** إنشاء إعلان — POST /api/AppSettings/announcements */
  async createAgentAnnouncement(data: AgentAnnouncementCreateRequest): Promise<AgentAnnouncementDto> {
    const response = await this.api.post<AgentAnnouncementDto>('/AppSettings/announcements', data);
    return response.data;
  }

  /** تعديل إعلان — PUT /api/AppSettings/announcements/{id} */
  async updateAgentAnnouncement(id: string, data: AgentAnnouncementCreateRequest): Promise<AgentAnnouncementDto> {
    const response = await this.api.put<AgentAnnouncementDto>(`/AppSettings/announcements/${id}`, data);
    return response.data;
  }

  /** حذف إعلان — DELETE /api/AppSettings/announcements/{id} */
  async deleteAgentAnnouncement(id: string): Promise<void> {
    await this.api.delete(`/AppSettings/announcements/${id}`);
  }

  // Renewals
  async renewSubscribers(subscriberIds: string[]): Promise<void> {
    await this.api.post('/renewals', { subscriberIds });
  }

  async createRenewal(renewalData: RenewalData): Promise<any> {
    try {
      // Transform the data to match the expected API format
      const payload = {
        subscriberId: renewalData.subscriberId,
        newProfileId: renewalData.newProfileId,
        paymentStatus: renewalData.paymentStatus,
        overrideSalePrice: renewalData.overrideSalePrice ?? null,
        amountPaid: renewalData.amountPaid ?? null,
        debtDueDate: renewalData.debtDueDate ? `${renewalData.debtDueDate}T00:00:00` : null,
        notes: renewalData.notes || '',
        wiFiCode: renewalData.wifiCode || '',
        wiFiQRCode: renewalData.wiFiQRCode || null,
        remainingAmount: renewalData.remainingAmount || 0,
        /** وصف الدين — الباكند يحفظه في description للدين ويرجعه في الاستجابة. المفتاح المطلوب: debtDescription */
        debtDescription: renewalData.debtDescription || '',
        // إضافة معلومات إضافية لمساعدة الباكند على حساب التاريخ بشكل صحيح
        currentExpirationDate: renewalData.currentExpirationDate || null,
        renewalPeriod: renewalData.renewalPeriod || null,
        ...(renewalData.serviceFeesId
          ? {
              serviceFeesId: renewalData.serviceFeesId,
              ...(renewalData.serviceFeesPrice != null && renewalData.serviceFeesPrice >= 0
                ? { serviceFeesPrice: renewalData.serviceFeesPrice }
                : {}),
              serviceFeesAmountPaid: renewalData.serviceFeesAmountPaid ?? 0,
            }
          : {}),
        activationPaymentMethod:
          renewalData.activationPaymentMethod ?? ActivationPaymentMethod.Cash,
      };
      
      const response: AxiosResponse<any> = await this.api.post('/renewals', payload);
      
      // تسجيل استجابة الباك إند للتحقق من رقم الفاتورة
      console.log('Backend response for renewal creation:', response.data);
      console.log('Receipt number from backend:', response.data?.receiptNumber);
      
      return normalizeRenewalReceiptFromApi(response.data);
    } catch (error) {
      console.error('Error creating renewal:', error);
      throw error; // إعادة رمي الخطأ بدلاً من إرجاع بيانات وهمية
    }
  }


  /** إحصائيات المشتركين للوحة التحكم + الوارد */
  async getSubscribersDashboard(params?: {
    agentId?: string;
    fromDate?: string;
    toDate?: string;
    resellerId?: string;
    regionId?: string;
  }): Promise<SubscribersDashboardStats> {
    const response: AxiosResponse<SubscribersDashboardStats> = await this.api.get('/subscribers/dashboard', { params });
    return response.data;
  }

  // Dashboard stats (قديم — للتوافق إن استُدعي من مكان آخر)
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      const response: AxiosResponse<DashboardStats> = await this.api.get('/dashboard/stats');
      return response.data;
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      try {
        const subscribersResponse = await this.getSubscribers({ page: 1, pageSize: 1000 });
        const subscribers = subscribersResponse.data;
        const totalSubscribers = subscribers.length;
        const activeSubscribers = subscribers.filter(s =>
          s.isSubscriptionActive === true || (s.isSubscriptionActive == null && (s.status === 1 || s.status === 2))
        ).length;
        const expiringSoonSubscribers = subscribers.filter(s => s.daysUntilExpiry > 0 && s.daysUntilExpiry <= 7).length;
        const expiredSubscribers = subscribers.filter(s => s.status === 3).length;
        return {
          totalSubscribers,
          activeSubscribers,
          expiringSoonSubscribers,
          expiredSubscribers
        };
      } catch (fallbackError) {
        console.error('Error calculating dashboard stats:', fallbackError);
        return {
          totalSubscribers: 0,
          activeSubscribers: 0,
          expiringSoonSubscribers: 0,
          expiredSubscribers: 0
        };
      }
    }
  }

  // Debts stats
  async getDebtsStats(): Promise<{ totalDebtAmount: number; totalDebtors: number }> {
    const subscribersResponse = await this.getSubscribers({ page: 1, pageSize: 1000 });
    const subscribers = subscribersResponse.data;

    const subscribersWithDebts = subscribers.filter((subscriber: Subscriber) =>
      subscriber.paymentStatus === PaymentStatus.Unpaid || subscriber.paymentStatus === PaymentStatus.Pending
    );

    const totalDebtAmount = subscribersWithDebts.reduce((total: number, subscriber: Subscriber) => {
      return total + (subscriber.profilePrice || 0);
    }, 0);

    return {
      totalDebtAmount,
      totalDebtors: subscribersWithDebts.length
    };
  }

  async getSubscriberRenewalHistory(subscriberId: string): Promise<any[]> {
    try {
      const response = await this.api.get(`/subscribers/${subscriberId}/renewal-history`);
      return response.data;
    } catch (error) {
      console.error('Error fetching subscriber renewal history:', error);
      // إرجاع مصفوفة فارغة في حالة عدم توفر البيانات
      return [];
    }
  }

  async updateSubscriberProfile(id: string, profileId: string): Promise<Subscriber> {
    const response = await this.api.put(`/subscribers/profiles/${id}`, { profileId });
    return response.data;
  }

  /** يبني query params لطلبات الديون (GET /api/Debts) — يدعم DebtDescription, paymentCreatedAtFrom/To, DebtStatus */
  private buildDebtsQueryParams(params?: DebtsListParams): Record<string, string | number | boolean | undefined> {
    const queryParams: Record<string, string | number | boolean | undefined> = {
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 10,
    };
    if (params?.searchTerm?.trim()) queryParams.searchTerm = params.searchTerm.trim();
    if (params?.search?.trim()) queryParams.searchTerm = params.search.trim();
    if (params?.sortBy) queryParams.sortBy = params.sortBy;
    if (params?.sortDescending !== undefined) queryParams.sortDescending = params.sortDescending;
    if (params?.status !== undefined && params?.status !== null) queryParams.DebtStatus = params.status;
    if (params?.maxDaysUntilExpiry !== undefined && params.maxDaysUntilExpiry >= 0) queryParams.maxDaysUntilExpiry = params.maxDaysUntilExpiry;
    if (params?.fat?.trim()) queryParams.fat = params.fat.trim();
    if (params?.zone?.trim()) queryParams.zone = params.zone.trim();
    if (params?.noteType !== undefined && params.noteType !== null) queryParams.noteType = params.noteType;
    if (params?.paymentCreatedAtFrom?.trim()) queryParams.paymentCreatedAtFrom = params.paymentCreatedAtFrom.trim();
    if (params?.paymentCreatedAtTo?.trim()) queryParams.paymentCreatedAtTo = params.paymentCreatedAtTo.trim();
    if (params?.debtDescription?.trim()) queryParams.DebtDescription = params.debtDescription.trim();
    if (params?.resellerId?.trim()) queryParams.resellerId = params.resellerId.trim();
    if (params?.regionId?.trim()) queryParams.regionId = params.regionId.trim();
    return queryParams;
  }

  // Debt Management — يدعم فلترة: searchTerm, sortBy, sortDescending, DebtStatus, DebtDescription, DueDateFrom, DueDateTo, إلخ
  async getAllDebts(params?: DebtsListParams): Promise<DebtsListResponse> {
    const queryParams = this.buildDebtsQueryParams(params);
    const response = await this.api.get('/Debts', { params: queryParams });
    const raw = response.data as DebtsListResponse & { data: any[] };

    const transformedData = (raw.data || []).map((debt: any) => ({
      ...debt,
      isPaid: debt.status === 1,
      agentId: debt.agentId || '',
      agentName: debt.agentCompanyName || 'غير محدد',
      paidDate: undefined,
      status: debt.status ?? 0,
    }));

    return {
      ...raw,
      data: transformedData,
      totalDebtAmount: raw.totalDebtAmount,
    };
  }

  async getOverdueUnpaidDebts(params?: DebtsListParams): Promise<DebtsListResponse> {
    const queryParams = this.buildDebtsQueryParams(params);
    const response = await this.api.get('/Debts/overdue-unpaid', { params: queryParams });
    const raw = response.data as DebtsListResponse & { data: any[] };
    const transformedData = (raw.data || []).map((debt: any) => ({
      ...debt,
      isPaid: debt.status === 1,
      agentId: debt.agentId || '',
      agentName: debt.agentCompanyName || debt.agentName || 'غير محدد',
      paidDate: undefined,
      status: debt.status ?? 0,
    }));
    return { ...raw, data: transformedData, totalDebtAmount: raw.totalDebtAmount };
  }

  async getSubscriberDebts(subscriberId: string, params?: PaginationParams): Promise<PaginatedResponse<Debt>> {
    const response = await this.api.get(`/Debts/subscriber/${subscriberId}`, { params });
    const transformedData = (response.data?.data || []).map((debt: any) => ({
      ...debt,
      isPaid: debt.status === 1,
      agentId: debt.agentId || '',
      agentName: debt.agentCompanyName || debt.agentName || 'غير محدد',
      status: debt.status || 0,
    }));
    return { ...response.data, data: transformedData };
  }

  async getDebt(id: string): Promise<Debt> {
    const response = await this.api.get(`/Debts/${id}`);
    return {
      ...response.data,
      isPaid: response.data.status === 1, // Paid status
      status: response.data.status || 0 // Default to Unpaid if not provided
    };
  }

  async createDebt(debtData: DebtCreateRequest): Promise<Debt> {
    const response = await this.api.post('/Debts', debtData);
    return {
      ...response.data,
      isPaid: response.data.status === 1, // Paid status
      status: response.data.status || 0 // Default to Unpaid if not provided
    };
  }

  async updateDebt(id: string, debtData: DebtUpdateRequest): Promise<Debt> {
    const response = await this.api.put(`/Debts/${id}`, debtData);
    return {
      ...response.data,
      isPaid: response.data.status === 1, // Paid status
      status: response.data.status || 0 // Default to Unpaid if not provided
    };
  }

  async payDebt(id: string, paymentData: DebtPaymentRequest): Promise<Debt> {
    console.log('API: payDebt called with:', { id, paymentData });
    const response = await this.api.post(`/Debts/${id}/pay`, paymentData);
    console.log('API: payDebt response:', response.data);
    return {
      ...response.data,
      isPaid: response.data.status === 1, // Paid status
      status: response.data.status || 0 // Default to Unpaid if not provided
    };
  }

  async deleteDebt(id: string): Promise<void> {
    await this.api.delete(`/Debts/${id}`);
  }

  async getSubscriberDebtTotal(subscriberId: string): Promise<number> {
    const response = await this.api.get(`/Debts/subscriber/${subscriberId}/total`);
    return Number(response.data ?? 0) || 0;
  }

  /** تحديث حالة إطفاء/تشغيل لجميع ديون المشترك (0 = إطفاء، 1 = تشغيل) */
  async putSubscriberOffOn(subscriberId: string, offOn: 0 | 1): Promise<{ updatedCount: number; offOn: number }> {
    const response = await this.api.put(`/Debts/subscriber/${subscriberId}/offon`, { offOn });
    return response.data;
  }

  // --- مصاريف المكتب (Office Expenses) ---
  private officeExpensesParams(options?: { agentId?: string; fromDate?: string; toDate?: string }): Record<string, string> {
    const params: Record<string, string> = {};
    if (options?.agentId) params.agentId = options.agentId;
    if (options?.fromDate) params.fromDate = options.fromDate.split('T')[0];
    if (options?.toDate) params.toDate = options.toDate.split('T')[0];
    return params;
  }

  async getOfficeExpenses(agentId?: string, fromDate?: string, toDate?: string): Promise<OfficeExpense[]> {
    const params = this.officeExpensesParams({ agentId, fromDate, toDate });
    const response = await this.api.get<any[]>('/OfficeExpenses', { params });
    const raw = Array.isArray(response.data) ? response.data : [];
    return raw.map((e: any) => ({
      ...e,
      id: e.id,
      name: e.name ?? e.Name,
      amount: e.amount ?? e.Amount ?? 0,
      expenseDate: e.expenseDate ?? e.ExpenseDate ?? '',
      isPaid: e.isPaid ?? e.IsPaid ?? false,
      paidAt: e.paidAt ?? e.PaidAt ?? null,
      notes: e.notes ?? e.Notes ?? null,
    }));
  }

  async getOfficeExpense(id: string, agentId?: string): Promise<OfficeExpense> {
    const response = await this.api.get<any>(`/OfficeExpenses/${id}`, { params: this.officeExpensesParams({ agentId }) });
    const e = response.data;
    return {
      ...e,
      id: e.id,
      name: e.name ?? e.Name,
      amount: e.amount ?? e.Amount ?? 0,
      expenseDate: e.expenseDate ?? e.ExpenseDate ?? '',
      isPaid: e.isPaid ?? e.IsPaid ?? false,
      paidAt: e.paidAt ?? e.PaidAt ?? null,
      notes: e.notes ?? e.Notes ?? null,
    };
  }

  async createOfficeExpense(data: OfficeExpenseCreateRequest, agentId?: string): Promise<OfficeExpense> {
    const body = {
      Name: data.name,
      Amount: data.amount,
      ExpenseDate: data.expenseDate,
      Notes: data.notes ?? undefined,
    };
    const response = await this.api.post<any>('/OfficeExpenses', body, { params: this.officeExpensesParams({ agentId }) });
    const e = response.data;
    return {
      ...e,
      isPaid: e?.isPaid ?? e?.IsPaid ?? false,
      paidAt: e?.paidAt ?? e?.PaidAt ?? null,
    };
  }

  async updateOfficeExpense(id: string, data: OfficeExpenseUpdateRequest, agentId?: string): Promise<OfficeExpense> {
    const response = await this.api.put<any>(`/OfficeExpenses/${id}`, data, { params: this.officeExpensesParams({ agentId }) });
    const e = response.data;
    return {
      ...e,
      isPaid: e?.isPaid ?? e?.IsPaid ?? false,
      paidAt: e?.paidAt ?? e?.PaidAt ?? null,
    };
  }

  async deleteOfficeExpense(id: string, agentId?: string): Promise<void> {
    await this.api.delete(`/OfficeExpenses/${id}`, { params: this.officeExpensesParams({ agentId }) });
  }

  async payOfficeExpense(id: string, agentId?: string): Promise<OfficeExpense> {
    const response = await this.api.post<any>(`/OfficeExpenses/${id}/pay`, {}, { params: this.officeExpensesParams({ agentId }) });
    const e = response.data;
    return {
      ...e,
      isPaid: true,
      paidAt: e?.paidAt ?? e?.PaidAt ?? new Date().toISOString(),
    };
  }

  // --- كشف الرواتب (Salary Sheet) ---
  private salarySheetParams(options?: { agentId?: string; fromDate?: string; toDate?: string }): Record<string, string> {
    const params: Record<string, string> = {};
    if (options?.agentId) params.agentId = options.agentId;
    if (options?.fromDate) params.fromDate = options.fromDate.split('T')[0];
    if (options?.toDate) params.toDate = options.toDate.split('T')[0];
    return params;
  }

  async getSalarySheet(agentId?: string, fromDate?: string, toDate?: string): Promise<SalarySheetListResponse> {
    const params = this.salarySheetParams({ agentId, fromDate, toDate });
    const response = await this.api.get<any>('/SalarySheet', { params });
    const raw = response.data;
    const data = Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw) ? raw : []);
    const totalDeductions = Number(raw?.totalDeductions ?? raw?.TotalDeductions ?? 0) || 0;
    const totalAdvances = Number(raw?.totalAdvances ?? raw?.TotalAdvances ?? 0) || 0;
    return {
      data: data.map((e: any) => this.normalizeSalarySheetEntry(e)),
      totalDeductions,
      totalAdvances,
    };
  }

  private normalizeSalarySheetEntry(e: any): SalarySheetEntry {
    return {
      ...e,
      id: e.id,
      employeeName: e.employeeName ?? e.EmployeeName ?? '',
      workType: e.workType ?? e.WorkType ?? '',
      salaryAmount: e.salaryAmount ?? e.SalaryAmount ?? 0,
      paymentDate: e.paymentDate ?? e.PaymentDate ?? '',
      notes: e.notes ?? e.Notes ?? null,
      totalDeductions: e.totalDeductions ?? e.TotalDeductions ?? 0,
      totalAdvances: e.totalAdvances ?? e.TotalAdvances ?? 0,
      netSalary: e.netSalary ?? e.NetSalary ?? 0,
      deductions: (e.deductions ?? e.Deductions ?? []).map((d: any) => ({
        id: d.id,
        salarySheetEntryId: d.salarySheetEntryId ?? d.SalarySheetEntryId,
        amount: d.amount ?? d.Amount ?? 0,
        reason: d.reason ?? d.Reason ?? '',
        deductionDate: d.deductionDate ?? d.DeductionDate ?? '',
        createdAt: d.createdAt ?? d.CreatedAt,
      })),
      advances: (e.advances ?? e.Advances ?? []).map((a: any) => ({
        id: a.id,
        salarySheetEntryId: a.salarySheetEntryId ?? a.SalarySheetEntryId,
        amount: a.amount ?? a.Amount ?? 0,
        reason: a.reason ?? a.Reason ?? '',
        withdrawalDate: a.withdrawalDate ?? a.WithdrawalDate ?? '',
        createdAt: a.createdAt ?? a.CreatedAt,
      })),
    };
  }

  async getSalarySheetEntry(id: string, agentId?: string): Promise<SalarySheetEntry> {
    const response = await this.api.get<any>(`/SalarySheet/${id}`, { params: this.salarySheetParams({ agentId }) });
    return this.normalizeSalarySheetEntry(response.data);
  }

  async createSalarySheetEntry(data: SalarySheetEntryCreateRequest, agentId?: string): Promise<SalarySheetEntry> {
    const body = {
      EmployeeName: data.employeeName,
      WorkType: data.workType,
      SalaryAmount: data.salaryAmount,
      PaymentDate: data.paymentDate,
      Notes: data.notes ?? undefined,
    };
    const response = await this.api.post<any>('/SalarySheet', body, { params: this.salarySheetParams({ agentId }) });
    return this.normalizeSalarySheetEntry(response.data);
  }

  async updateSalarySheetEntry(id: string, data: SalarySheetEntryUpdateRequest, agentId?: string): Promise<SalarySheetEntry> {
    const body: Record<string, unknown> = {};
    if (data.employeeName !== undefined) body.EmployeeName = data.employeeName;
    if (data.workType !== undefined) body.WorkType = data.workType;
    if (data.salaryAmount !== undefined) body.SalaryAmount = data.salaryAmount;
    if (data.paymentDate !== undefined) body.PaymentDate = data.paymentDate;
    if (data.notes !== undefined) body.Notes = data.notes;
    const response = await this.api.put<any>(`/SalarySheet/${id}`, body, { params: this.salarySheetParams({ agentId }) });
    return this.normalizeSalarySheetEntry(response.data);
  }

  async deleteSalarySheetEntry(id: string, agentId?: string): Promise<void> {
    await this.api.delete(`/SalarySheet/${id}`, { params: this.salarySheetParams({ agentId }) });
  }

  async addSalaryDeduction(data: SalaryDeductionCreateRequest, agentId?: string): Promise<SalarySheetEntry> {
    const body = {
      SalarySheetEntryId: data.salarySheetEntryId,
      Amount: data.amount,
      Reason: data.reason,
      DeductionDate: data.deductionDate,
    };
    const response = await this.api.post<any>('/SalarySheet/deductions', body, { params: this.salarySheetParams({ agentId }) });
    return this.normalizeSalarySheetEntry(response.data);
  }

  async addSalaryAdvance(data: SalaryAdvanceCreateRequest, agentId?: string): Promise<SalarySheetEntry> {
    const body = {
      SalarySheetEntryId: data.salarySheetEntryId,
      Amount: data.amount,
      Reason: data.reason,
      WithdrawalDate: data.withdrawalDate,
    };
    const response = await this.api.post<any>('/SalarySheet/advances', body, { params: this.salarySheetParams({ agentId }) });
    return this.normalizeSalarySheetEntry(response.data);
  }

  async updateSalaryDeduction(id: string, data: SalaryDeductionUpdateRequest, agentId?: string): Promise<void> {
    const body = {
      Amount: data.amount,
      Reason: data.reason,
      DeductionDate: data.deductionDate,
    };
    await this.api.put(`/SalarySheet/deductions/${id}`, body, { params: this.salarySheetParams({ agentId }) });
  }

  async updateSalaryAdvance(id: string, data: SalaryAdvanceUpdateRequest, agentId?: string): Promise<void> {
    const body = {
      Amount: data.amount,
      Reason: data.reason,
      WithdrawalDate: data.withdrawalDate,
    };
    await this.api.put(`/SalarySheet/advances/${id}`, body, { params: this.salarySheetParams({ agentId }) });
  }

  // --- Offline Sync (الباكند: POST /sync/upload) ---
  async syncUpload(request: SyncUploadRequestDto): Promise<SyncUploadResponseDto> {
    const response = await this.api.post<SyncUploadResponseDto>('/sync/upload', request);
    return response.data;
  }

  /** سياق المزامنة دون اتصال — GET /Sync/context */
  async getSyncContext(agentId?: string): Promise<SyncContextResponseDto> {
    const response = await this.api.get<SyncContextResponseDto>('/Sync/context', {
      params: agentId ? { agentId } : undefined,
    });
    const data = response.data ?? {};
    return {
      ...data,
      serviceFees: this.normalizeServiceFeesList(data.serviceFees ?? (data as any).ServiceFees),
    };
  }

  // Utility method to get base URL
  getBaseURL(): string {
    return this.api.defaults.baseURL || '';
  }

  // دالة مساعدة لعرض رسائل الخطأ المترجمة
  static showError(error: any): string {
    // إذا كان الخطأ يحتوي على رسالة مترجمة، استخدمها
    if (error.message && typeof error.message === 'string') {
      return error.message;
    }
    
    // إذا كان الخطأ يحتوي على رسالة أصلية، ترجمها
    if (error.originalError) {
      const apiService = new ApiService();
      return apiService.translateError(error.originalError);
    }
    
    // رسالة افتراضية
    return 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.';
  }

  // Export receipts to Excel (xlsx) - client-side with custom columns
  async exportReceiptsToExcel(fromDate?: string, toDate?: string, resellerId?: string, regionId?: string): Promise<Blob> {
    const { createXlsxBlob } = await import('../utils/excelExport');
    const { receipts } = await this.getRenewalReceipts(1, 10000, fromDate, toDate, resellerId, regionId);
    // Fallback for missing receipt username: resolve from subscribers list.
    let subscribersById = new Map<string, string>();
    try {
      const subscribersRes = await this.getSubscribers({ page: 1, pageSize: 10000 });
      subscribersById = new Map(
        (subscribersRes.data ?? [])
          .filter((s) => Boolean(s?.id && s?.username))
          .map((s) => [String(s.id), String(s.username)])
      );
    } catch {
      // Keep export resilient even if subscribers lookup fails.
    }
    const headers = [
      'المشترك',
      'اسم المستخدم',
      'رقم الهاتف',
      'الباقة',
      'تاريخ التفعيل',
      'تاريخ الانتهاء',
      'السعر',
      'المبلغ المدفوع',
      'المبلغ المتبقي',
      'الخصم',
      'اسم الشركة',
    ];
    const rows = (receipts || []).map((r) => [
      r.subscriberName ?? '',
      r.subscriberUsername ?? subscribersById.get(String(r.subscriberId ?? '')) ?? '',
      r.subscriberPhone ?? '',
      r.newProfileName ?? r.profileName ?? '',
      r.renewalDate ? new Date(r.renewalDate).toLocaleDateString(getNumberLocale()) : '',
      r.newExpirationDate ? new Date(r.newExpirationDate).toLocaleDateString(getNumberLocale()) : '',
      r.newProfileSalePrice ?? r.finalPrice ?? 0,
      r.amountPaid ?? 0,
      r.remainingAmount ?? 0,
      r.discountAmount ?? 0,
      r.agentCompanyName ?? '',
    ]);
    return createXlsxBlob([headers, ...rows], 'التفعيلات', {
      alignCenter: true,
      colWidths: [22, 18, 16, 20, 16, 16, 14, 16, 16, 12, 20],
    });
  }

  // Renewal Receipts endpoints
  async getRenewalReceipts(
    page: number = 1,
    size: number = 10,
    fromDate?: string,
    toDate?: string,
    resellerId?: string,
    regionId?: string
  ): Promise<{ receipts: RenewalReceipt[], pagination: any }> {
    try {
      const token = localStorage.getItem('token');
      console.log('Current token:', token ? 'Token exists' : 'No token found');
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(size));
      if (fromDate) params.set('FromDate', fromDate);
      if (toDate) params.set('ToDate', toDate);
      if (resellerId?.trim()) params.set('resellerId', resellerId.trim());
      if (regionId?.trim()) params.set('regionId', regionId.trim());

      const response: AxiosResponse<PaginatedResponse<RenewalReceipt>> = await this.api.get(`/Renewals?${params.toString()}`);
      console.log('API Response from backend:', response.data);
      console.log('Response status:', response.status);
      
      // استخراج البيانات من الاستجابة
      let receipts: RenewalReceipt[] = [];
      let pagination: any = {};
      
      if (response.data && typeof response.data === 'object') {
        // إذا كانت البيانات في حقل 'data' (PaginatedResponse)
        if (response.data.data && Array.isArray(response.data.data)) {
          receipts = response.data.data.map(normalizeRenewalReceiptFromApi);
          pagination = {
            currentPage: response.data.currentPage,
            pageSize: response.data.pageSize,
            totalItems: response.data.totalItems,
            totalPages: response.data.totalPages,
            hasNextPage: response.data.hasNextPage,
            hasPreviousPage: response.data.hasPreviousPage
          };
          console.log('Found receipts in paginated response:', receipts.length);
          console.log('Pagination info:', pagination);
        }
        // إذا كانت البيانات مباشرة كمصفوفة
        else if (Array.isArray(response.data)) {
          receipts = response.data.map(normalizeRenewalReceiptFromApi);
          pagination = {
            currentPage: 1,
            pageSize: receipts.length,
            totalItems: receipts.length,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false
          };
          console.log('Found receipts directly:', receipts.length);
        }
        // إذا كانت البيانات في حقل آخر
        else {
          console.warn('Unexpected data structure:', response.data);
          return { receipts: [], pagination: {} };
        }
      }
      
      console.log('Number of receipts:', receipts.length);
      return { receipts, pagination };
    } catch (error) {
      console.error('Error fetching renewal receipts:', error);
      
      // إذا كان الخطأ 401، فهذا يعني مشكلة في المصادقة
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any;
        if (axiosError.response?.status === 401) {
          console.error('Authentication failed - user needs to login');
        }
      }
      
      throw error;
    }
  }

  // Renewal History endpoints - GET /Renewals?subscriberId=... returns paginated { data, ... }
  async getRenewalsBySubscriber(
    subscriberId: string,
    page: number = 1,
    pageSize: number = 10
  ): Promise<PaginatedResponse<RenewalHistory>> {
    const response = await this.api.get<PaginatedResponse<RenewalHistory>>('/Renewals', {
      params: { subscriberId, page, pageSize },
    });
    const body = response.data;
    const raw = body?.data ?? [];
    const data = Array.isArray(raw)
      ? raw.map((item) => normalizeRenewalReceiptFromApi(item as unknown) as RenewalHistory)
      : [];
    return {
      ...body,
      data,
    };
  }

  async getRenewalHistory(subscriberId: string): Promise<RenewalHistory[]> {
    const res = await this.getRenewalsBySubscriber(subscriberId, 1, 10000);
    return res.data ?? [];
  }

  // Profit endpoints
  async getProfitStats(): Promise<ProfitStats> {
    const response: AxiosResponse<ProfitStats> = await this.api.get('/Renewals/profit');
    return response.data;
  }

  async getProfitStatsByDateRange(dateRange: DateRangeRequest): Promise<ProfitStats> {
    const response: AxiosResponse<ProfitStats> = await this.api.get('/Renewals/profit/date-range', {
      params: dateRange
    });
    return response.data;
  }

  // Accounts — GET /Accounts (مجاميع + سجل موحّد)
  private buildAccountsQueryParams(
    params?: AccountsListParams | AccountsExportParams,
    options?: { includePagination?: boolean; includeSubscriberName?: boolean }
  ): Record<string, string | number> {
    const queryParams: Record<string, string | number> = {};
    if (params?.agentId) queryParams.agentId = params.agentId;
    if (params?.fromDate?.trim()) queryParams.fromDate = params.fromDate.trim();
    if (params?.toDate?.trim()) queryParams.toDate = params.toDate.trim();
    if (params?.regionId?.trim()) queryParams.regionId = params.regionId.trim();
    if (params?.resellerId?.trim()) queryParams.resellerId = params.resellerId.trim();
    if (params?.executedByUserId?.trim()) queryParams.executedByUserId = params.executedByUserId.trim();
    if (options?.includeSubscriberName !== false && params && 'subscriberName' in params && params.subscriberName?.trim()) {
      queryParams.subscriberName = params.subscriberName.trim();
    }
    if (params?.packageType !== undefined && params.packageType !== null) {
      queryParams.packageType = Number(params.packageType);
    }
    if (options?.includePagination !== false) {
      const listParams = params as AccountsListParams | undefined;
      if (listParams?.page !== undefined) queryParams.page = listParams.page;
      if (listParams?.pageSize !== undefined) queryParams.pageSize = listParams.pageSize;
    }
    return queryParams;
  }

  async getAccounts(params?: AccountsListParams): Promise<AccountsResponse> {
    const response: AxiosResponse<AccountsResponse> = await this.api.get('/Accounts', {
      params: this.buildAccountsQueryParams(params),
    });
    return response.data;
  }

  async exportAccountsToExcel(params?: AccountsExportParams): Promise<Blob> {
    const response = await this.api.get('/Accounts/export/excel', {
      params: this.buildAccountsQueryParams(params, { includePagination: false, includeSubscriberName: false }),
      responseType: 'blob',
    });
    return response.data;
  }

  async deleteAccountsLedgerEntry(
    id: string,
    kind: AccountsLedgerKind,
    agentId?: string
  ): Promise<{ message?: string }> {
    const params: Record<string, string> = { kind };
    if (agentId?.trim()) params.agentId = agentId.trim();
    const response = await this.api.delete(`/Accounts/ledger/${encodeURIComponent(id)}`, { params });
    return response.data;
  }

  async getDailyHandoverRecipients(agentId?: string): Promise<DailyHandoverRecipient[]> {
    const params: any = {};
    if (agentId) params.agentId = agentId;
    const response: AxiosResponse<DailyHandoverRecipient[]> = await this.api.get('/Renewals/daily-handover/recipients', { params });
    return response.data;
  }

  async postDailyHandover(body: DailyHandoverCreateRequest): Promise<DailyAccountResponse> {
    const payload: any = { ...body };
    if (payload.handoverDate === '' || payload.handoverDate == null) delete payload.handoverDate;
    if (payload.notes === '' || payload.notes == null) delete payload.notes;
    if (payload.receivedByUserId === '' || payload.receivedByUserId == null) delete payload.receivedByUserId;
    if (payload.receivedByAgentId === '' || payload.receivedByAgentId == null) delete payload.receivedByAgentId;
    const response: AxiosResponse<DailyAccountResponse> = await this.api.post('/Renewals/daily-handover', payload);
    return response.data;
  }

  /** PUT /Renewals/daily-handover/{id} — تعديل سجل تسليم؛ الاستجابة نفس ملخص الحساب اليومي */
  async putDailyHandover(id: string, body: DailyHandoverUpdateRequest): Promise<DailyAccountResponse> {
    const payload: any = { ...body };
    if (payload.handoverDate === '' || payload.handoverDate == null) delete payload.handoverDate;
    if (payload.notes === '' || payload.notes == null) delete payload.notes;
    if (payload.receivedByUserId === '' || payload.receivedByUserId == null) delete payload.receivedByUserId;
    if (payload.receivedByAgentId === '' || payload.receivedByAgentId == null) delete payload.receivedByAgentId;
    const response: AxiosResponse<DailyAccountResponse> = await this.api.put(
      `/Renewals/daily-handover/${encodeURIComponent(id)}`,
      payload
    );
    return response.data;
  }

  // Balance top-up (رصيد الوكيل)
  async getBalance(): Promise<AgentBalanceDetail> {
    const response: AxiosResponse<AgentBalanceDetail> = await this.api.get('/Renewals/balance');
    return response.data;
  }

  /** تعديل رصيد الوكيل مباشرة (الرصيد العام فقط — لا يغيّر أرصدة المناطق) */
  async putBalance(balanceIqd: number): Promise<AgentBalanceDetail> {
    await this.api.put('/Renewals/balance', { balanceIqd });
    return await this.getBalance();
  }

  async postBalanceTopUp(body: BalanceTopUpRequest): Promise<BalanceTopUpResponse> {
    const payload: Record<string, unknown> = { ...body };
    if (payload.topUpDate === '' || payload.topUpDate == null) delete payload.topUpDate;
    if (!payload.agentResellerId) delete payload.agentResellerId;
    const response: AxiosResponse<BalanceTopUpResponse> = await this.api.post('/Renewals/balance/topup', payload);
    return response.data;
  }

  async getBalanceTopUps(
    page: number = 1,
    pageSize: number = 20,
    fromDate?: string,
    toDate?: string
  ): Promise<BalanceTopUpsPageResponse> {
    const params: Record<string, string | number> = { page, pageSize };
    if (fromDate?.trim()) params.fromDate = fromDate.trim();
    if (toDate?.trim()) params.toDate = toDate.trim();
    const response = await this.api.get('/Renewals/balance/topups', { params });
    const raw = response.data as BalanceTopUpsPageResponse & {
      Data?: AgentBalanceTopUp[];
    };
    if (Array.isArray(raw)) {
      return {
        data: raw,
        currentPage: page,
        pageSize,
        totalItems: raw.length,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      };
    }
    const data = raw.data ?? raw.Data ?? [];
    return {
      data,
      currentPage: raw.currentPage ?? page,
      pageSize: raw.pageSize ?? pageSize,
      totalItems: raw.totalItems ?? data.length,
      totalPages: raw.totalPages ?? 1,
      hasNextPage: raw.hasNextPage ?? false,
      hasPreviousPage: raw.hasPreviousPage ?? false,
    };
  }

  // Agent Basic Update endpoint (only basic info, no subscription data)
  async updateAgentBasicInfo(agentId: string, data: {
    fullName: string;
    phone: string;
    companyName: string;
    address: string;
    governorate: string;
    isActive: boolean;
  }): Promise<void> {
    const response: AxiosResponse<void> = await this.api.put(`/Agents/${agentId}/basic-info`, data);
    return response.data;
  }

  // Agent Password Change endpoint
  async changeAgentPassword(agentId: string, passwordData: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<void> {
    const response: AxiosResponse<void> = await this.api.put(`/Agents/${agentId}/change-password`, passwordData);
    return response.data;
  }

  // Excel Import endpoints
  async getExcelImportAgents(): Promise<ExcelImportAgent[]> {
    const response: AxiosResponse<ExcelImportAgent[]> = await this.api.get('/ExcelImport/agents');
    return response.data;
  }

  async importSubscribersFromExcel(agentId: string, file: File): Promise<ExcelImportResponse> {
    const formData = new FormData();
    formData.append('file', file);
    
    // Send agentId as query parameter since FormData doesn't work
    const response: AxiosResponse<ExcelImportResponse> = await this.api.post(`/ExcelImport/subscribers?agentId=${agentId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 600000, // up to 10 minutes (Excel import can be slow)
    });
    return response.data;
  }

  // System Message - GET (called when opening login page; no auth required for active message)
  async getSystemMessage(): Promise<SystemMessageResponse | null> {
    try {
      const response: AxiosResponse<SystemMessageResponse> = await this.api.get('/SystemMessage', {
        skipAuthRedirect: true,
      });
      if (response.data?.message && response.data?.expiresAt) {
        const expiresAt = new Date(response.data.expiresAt).getTime();
        if (expiresAt > Date.now()) return response.data;
      }
      return null;
    } catch {
      return null;
    }
  }

  // System Message - POST (Admin only)
  async createSystemMessage(data: SystemMessageCreateRequest): Promise<SystemMessageResponse> {
    const response: AxiosResponse<SystemMessageResponse> = await this.api.post('/SystemMessage', data);
    return response.data;
  }

  // رسالة التفعيل (Activation Message) - للوكيل الحالي
  async getActivationMessage(): Promise<MessageTemplateResponse | null> {
    try {
      const response: AxiosResponse<MessageTemplateResponse> = await this.api.get('/ActivationMessage');
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 404) return null;
      throw err;
    }
  }

  async setActivationMessage(template: string): Promise<MessageTemplateResponse> {
    try {
      await this.getActivationMessage();
      const response: AxiosResponse<MessageTemplateResponse> = await this.api.put('/ActivationMessage', { template });
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 404) {
        const response: AxiosResponse<MessageTemplateResponse> = await this.api.post('/ActivationMessage', { template });
        return response.data;
      }
      throw err;
    }
  }

  // رسالة التنبيه (Alert Message) - للوكيل الحالي
  async getAlertMessage(): Promise<MessageTemplateResponse | null> {
    try {
      const response: AxiosResponse<MessageTemplateResponse> = await this.api.get('/AlertMessage');
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 404) return null;
      throw err;
    }
  }

  async setAlertMessage(template: string): Promise<MessageTemplateResponse> {
    try {
      await this.getAlertMessage();
      const response: AxiosResponse<MessageTemplateResponse> = await this.api.put('/AlertMessage', { template });
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 404) {
        const response: AxiosResponse<MessageTemplateResponse> = await this.api.post('/AlertMessage', { template });
        return response.data;
      }
      throw err;
    }
  }

  // alias (older frontend code): keep names but use correct backend endpoint
  async getDetailsMessage(): Promise<MessageTemplateResponse | null> {
    return await this.getSubscriberDetailsMessage();
  }

  async setDetailsMessage(template: string): Promise<MessageTemplateResponse> {
    return await this.setSubscriberDetailsMessage(template);
  }

  // رسالة تفاصيل المشترك (Subscriber Details Message) - للوكيل الحالي
  async getSubscriberDetailsMessage(): Promise<MessageTemplateResponse | null> {
    try {
      const response: AxiosResponse<MessageTemplateResponse> = await this.api.get('/SubscriberDetailsMessage');
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 404) return null;
      throw err;
    }
  }

  async setSubscriberDetailsMessage(template: string): Promise<MessageTemplateResponse> {
    try {
      await this.getSubscriberDetailsMessage();
      const response: AxiosResponse<MessageTemplateResponse> = await this.api.put('/SubscriberDetailsMessage', { template });
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 404) {
        const response: AxiosResponse<MessageTemplateResponse> = await this.api.post('/SubscriberDetailsMessage', { template });
        return response.data;
      }
      throw err;
    }
  }

  /** قالب رسالة خاصة — قالب واحد لكل وكيل (حتى 2000 حرف)، يُرسل كما هو بدون مكانات */
  async getCustomMessage(): Promise<MessageTemplateResponse | null> {
    try {
      const response: AxiosResponse<MessageTemplateResponse> = await this.api.get('/CustomMessage');
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 404) return null;
      throw err;
    }
  }

  async setCustomMessage(template: string): Promise<MessageTemplateResponse> {
    try {
      await this.getCustomMessage();
      const response: AxiosResponse<MessageTemplateResponse> = await this.api.put('/CustomMessage', { template });
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 404) {
        const response: AxiosResponse<MessageTemplateResponse> = await this.api.post('/CustomMessage', { template });
        return response.data;
      }
      throw err;
    }
  }

  /** إرسال قالب رسالة خاصة لمشترك عبر واتساب (بدون body) */
  async sendWhatsAppCustomMessage(subscriberId: string): Promise<void> {
    await this.api.post(`/subscribers/${subscriberId}/send-whatsapp-custom`, undefined, {
      timeout: ApiService.WHATSAPP_SEND_TIMEOUT_MS,
    });
  }

  /** اعتماد SAS للوكلاء (أدمن فقط) مع ترقيم وبحث وفرز */
  async getSasCredentials(params?: {
    page?: number;
    pageSize?: number;
    searchTerm?: string;
    sortBy?: string;
  }): Promise<PaginatedResponse<SasCredentialsItem>> {
    const queryParams: Record<string, number | string | undefined> = {
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 10,
    };
    if (params?.searchTerm?.trim()) queryParams.searchTerm = params.searchTerm.trim();
    if (params?.sortBy?.trim()) queryParams.sortBy = params.sortBy.trim();

    const response: AxiosResponse<PaginatedResponse<SasCredentialsItem>> = await this.api.get(
      '/providers/sas/credentials',
      { params: queryParams }
    );
    return response.data;
  }

  /** اعتماديات رسيلرز الوكلاء مع كلمة السر (أدمن فقط) — GET /providers/sas/resellers-credentials. الترتيب من الأحدث أولاً. */
  async getResellersCredentials(params?: {
    page?: number;
    pageSize?: number;
    searchTerm?: string;
    /** نص يُبحث عنه داخل اسم الشركة للوكيل (CompanyName). إن حُذف أو فُرغ: لا فلترة على الوكيل. */
    agentName?: string;
  }): Promise<PaginatedResponse<AgentResellerCredentialsDto> & { hasNextPage?: boolean; hasPreviousPage?: boolean; currentPage?: number; totalItems?: number }> {
    const queryParams: Record<string, string | number> = {
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 20,
    };
    if (params?.searchTerm?.trim()) queryParams.searchTerm = params.searchTerm.trim();
    if (params?.agentName?.trim()) queryParams.agentName = params.agentName.trim();
    const response = await this.api.get('/providers/sas/resellers-credentials', { params: queryParams });
    const raw = response.data as PaginatedResponse<AgentResellerCredentialsDto> & {
      pageNumber?: number;
      hasNextPage?: boolean;
      hasPreviousPage?: boolean;
      totalItems?: number;
    };
    return {
      ...raw,
      currentPage: raw.currentPage ?? raw.pageNumber ?? 1,
      totalItems: raw.totalItems ?? raw.totalCount ?? 0,
      hasNextPage: raw.hasNextPage ?? (raw.currentPage ?? raw.pageNumber ?? 1) < (raw.totalPages ?? 1),
      hasPreviousPage: raw.hasPreviousPage ?? (raw.currentPage ?? raw.pageNumber ?? 1) > 1,
    };
  }

  /** مزامنة من الاعتماديات المحفوظة فقط — POST /providers/sas/sync-using-saved-credentials (بدون إرسال رابط/اسم مستخدم/كلمة مرور). agentId اختياري للأدمن. */
  async syncUsingSavedSasCredentials(agentId?: string): Promise<SasSyncUsingSavedCredentialsResponse> {
    const params = agentId ? { agentId } : undefined;
    const response = await this.api.post<SasSyncUsingSavedCredentialsResponse>(
      '/providers/sas/sync-using-saved-credentials',
      undefined,
      { params, timeout: ApiService.SAS_SYNC_TIMEOUT_MS }
    );
    return response.data;
  }

  /** جلب قائمة المزامنة — POST /providers/sas/sync-subscribers. الاستعلام: agentId (اختياري للوكيل، مطلوب للأدمن)، resellerId (اختياري). الجسم اختياري عند استخدام رسيلر محفوظ. */
  async syncSubscribers(request: SyncSubscribersRequest): Promise<SyncSubscribersResponse> {
    const { agentId, resellerId, baseUrl, username, password } = request;
    const params: Record<string, string> = {};
    if (agentId) params.agentId = agentId;
    if (resellerId) params.resellerId = resellerId;
    const body =
      baseUrl != null || username != null || password != null
        ? { baseUrl: baseUrl ?? '', username: username ?? '', password: password ?? '' }
        : {};
    const response = await this.api.post<SyncSubscribersResponse>('/providers/sas/sync-subscribers', body, {
      params: Object.keys(params).length ? params : undefined,
      timeout: ApiService.SAS_SYNC_TIMEOUT_MS,
    });
    const data = response.data;
    return {
      ...data,
      data: Array.isArray(data?.data) ? data.data : [],
      serviceFees: this.normalizeServiceFeesList(data?.serviceFees ?? (data as any)?.ServiceFees),
    };
  }

  /** POST /providers/sas/synchronizationFTTH — مزامنة FTTH لآخر أسبوع (شامل اليوم) */
  async synchronizationFTTH(params?: {
    resellerId?: string;
    agentId?: string;
    onlyDiff?: boolean;
  }): Promise<CashbackSynchronizationFtthResponse> {
    const query: Record<string, string> = {};
    if (params?.resellerId) query.resellerId = params.resellerId;
    if (params?.agentId) query.agentId = params.agentId;
    if (params?.onlyDiff) query.onlyDiff = 'true';
    const response = await this.api.post<CashbackSynchronizationFtthResponse>(
      '/providers/sas/synchronizationFTTH',
      {},
      { params: Object.keys(query).length ? query : undefined, timeout: 600_000 }
    );
    return this.normalizeSynchronizationDiffResponse(response.data);
  }

  /** GET /providers/sas/synchronizationFTTH/diff — مقارنة تاريخ انتهاء FTTH مع النظام */
  async synchronizationFTTHDiff(params?: {
    resellerId?: string;
    agentId?: string;
  }): Promise<CashbackSynchronizationFtthResponse> {
    const query: Record<string, string> = {};
    if (params?.resellerId) query.resellerId = params.resellerId;
    if (params?.agentId) query.agentId = params.agentId;
    const response = await this.api.get<CashbackSynchronizationFtthResponse>(
      '/providers/sas/synchronizationFTTH/diff',
      { params: Object.keys(query).length ? query : undefined, timeout: 600_000 }
    );
    return this.normalizeSynchronizationDiffResponse(response.data);
  }

  /** GET /providers/sas/synchronizationSAS/diff — مقارنة تاريخ انتهاء SAS مع النظام */
  async synchronizationSASDiff(params?: {
    resellerId?: string;
    agentId?: string;
  }): Promise<CashbackSynchronizationFtthResponse> {
    const query: Record<string, string> = {};
    if (params?.resellerId) query.resellerId = params.resellerId;
    if (params?.agentId) query.agentId = params.agentId;
    const response = await this.api.get<CashbackSynchronizationFtthResponse>(
      '/providers/sas/synchronizationSAS/diff',
      { params: Object.keys(query).length ? query : undefined, timeout: 600_000 }
    );
    return this.normalizeSynchronizationDiffResponse(response.data);
  }

  /** POST /providers/sas/synchronizationSAS/save — حفظ صف SAS diff بدون خصم/فاتورة */
  async synchronizationSASDiffSave(
    row: import('../types').CashbackSynchronizationFtthRow,
    params?: {
      resellerId?: string;
      agentId?: string;
      serviceFeesId?: string;
      serviceFeesAmountPaid?: number;
    }
  ): Promise<{ message?: string; subscriberId?: string }> {
    const query: Record<string, string> = {};
    if (params?.resellerId) query.resellerId = params.resellerId;
    if (params?.agentId) query.agentId = params.agentId;
    const body = this.buildSynchronizationDiffSaveBody(row, {
      serviceFeesId: params?.serviceFeesId,
      serviceFeesAmountPaid: params?.serviceFeesAmountPaid,
    });
    const response = await this.api.post<{ message?: string; subscriberId?: string }>(
      '/providers/sas/synchronizationSAS/save',
      body,
      { params: Object.keys(query).length ? query : undefined, timeout: 600_000 }
    );
    return response.data ?? {};
  }

  /** POST /providers/sas/synchronizationFTTH/save — حفظ صف FTTH diff بدون خصم/فاتورة */
  async synchronizationFTTHSave(
    row: import('../types').CashbackSynchronizationFtthRow,
    params?: {
      resellerId?: string;
      agentId?: string;
      serviceFeesId?: string;
      serviceFeesAmountPaid?: number;
    }
  ): Promise<{ message?: string; subscriberId?: string }> {
    const query: Record<string, string> = {};
    if (params?.resellerId) query.resellerId = params.resellerId;
    if (params?.agentId) query.agentId = params.agentId;
    const body = this.buildSynchronizationDiffSaveBody(row, {
      serviceFeesId: params?.serviceFeesId,
      serviceFeesAmountPaid: params?.serviceFeesAmountPaid,
    });
    const response = await this.api.post<{ message?: string; subscriberId?: string }>(
      '/providers/sas/synchronizationFTTH/save',
      body,
      { params: Object.keys(query).length ? query : undefined, timeout: 600_000 }
    );
    return response.data ?? {};
  }

  /** GET /Renewals/profiles — الباقات المستخدمة في مودال التفعيل/التجديد */
  async getRenewalProfiles(resellerId?: string): Promise<Profile[]> {
    const response = await this.api.get<PaginatedResponse<Profile> | Profile[]>('/Renewals/profiles', {
      params: {
        page: 1,
        pageSize: 500,
        ...(resellerId ? { resellerId } : {}),
      },
    });
    if (Array.isArray(response.data)) return response.data;
    return response.data?.data ?? [];
  }

  /** حساب الراجع وتجهيز صفوف التصدير — POST /providers/sas/cashback-transactions */
  async getCashbackTransactions(request: CashbackTransactionsRequest): Promise<CashbackTransactionsResponse> {
    const response = await this.api.post<CashbackTransactionsResponse>(
      '/providers/sas/cashback-transactions',
      request,
      {
        timeout: 600_000,
        headers: { 'Content-Type': 'application/json' },
      }
    );
    return response.data ?? { rows: [] };
  }

  /** مناطق مشتركي الوكيل (Subscriber.Zone) — GET /providers/sas/cashback-transactions/zones. للأدمن: params.agentId إلزامي. */
  async getCashbackSubscriberZones(agentId?: string): Promise<CashbackSubscriberZonesResponse> {
    const params = agentId ? { agentId } : undefined;
    const response = await this.api.get<CashbackSubscriberZonesResponse>('/providers/sas/cashback-transactions/zones', {
      params,
    });
    return response.data ?? { zones: [] };
  }

  /** باقات الوكيل لحساب الكاش باك — GET /providers/sas/cashback-transactions/packages. للأدمن: params.agentId إلزامي. */
  async getCashbackPackages(agentId?: string): Promise<CashbackPackageDto[]> {
    const params = agentId ? { agentId } : undefined;
    const response = await this.api.get<CashbackPackageDto[] | { data?: CashbackPackageDto[] }>(
      '/providers/sas/cashback-transactions/packages',
      { params }
    );
    const d = response.data;
    if (Array.isArray(d)) return d;
    if (d && typeof d === 'object' && Array.isArray((d as { data?: CashbackPackageDto[] }).data)) {
      return (d as { data: CashbackPackageDto[] }).data;
    }
    return [];
  }

  /**
   * سجلات الكاش باك المحفوظة — GET /providers/sas/cashback-transactions/records
   * Query: agentId (اختياري للأدمن)، year، month، take (افتراضي 100، حد أقصى 500).
   */
  async getCashbackTransactionRecords(query?: {
    agentId?: string;
    year?: number;
    month?: number;
    take?: number;
  }): Promise<CashbackTransactionRecordDto[]> {
    const params: Record<string, string | number> = {};
    if (query?.agentId) params.agentId = query.agentId;
    if (query?.year != null && !Number.isNaN(query.year)) params.year = query.year;
    if (query?.month != null && !Number.isNaN(query.month)) params.month = query.month;
    const take = query?.take != null ? Math.min(500, Math.max(1, Math.floor(query.take))) : undefined;
    if (take != null) params.take = take;
    const response = await this.api.get<CashbackTransactionRecordDto[] | { data?: CashbackTransactionRecordDto[] }>(
      '/providers/sas/cashback-transactions/records',
      { params }
    );
    const d = response.data;
    if (Array.isArray(d)) return d;
    if (d && typeof d === 'object' && Array.isArray((d as { data?: CashbackTransactionRecordDto[] }).data)) {
      return (d as { data: CashbackTransactionRecordDto[] }).data;
    }
    return [];
  }

  /**
   * تحديث المبلغ الحقيقي للكاش باك لسجل محفوظ — PUT /providers/sas/cashback-transactions/records/{id}/real-total
   */
  async updateCashbackRecordRealTotal(
    recordId: string,
    body: CashbackRecordRealTotalUpdateRequest
  ): Promise<void> {
    await this.api.put(
      `/providers/sas/cashback-transactions/records/${encodeURIComponent(recordId)}/real-total`,
      body,
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * تحديث المبلغ المتوقع المحفوظ في السجل — PUT /providers/sas/cashback-transactions/records/{id}/total (المبلغ يجب أن يكون > 0)
   */
  async updateCashbackRecordExpectedTotal(
    recordId: string,
    body: CashbackExpectedTotalUpdateRequest
  ): Promise<CashbackExpectedTotalUpdateResponse> {
    const response = await this.api.put<CashbackExpectedTotalUpdateResponse>(
      `/providers/sas/cashback-transactions/records/${encodeURIComponent(recordId)}/total`,
      body,
      { headers: { 'Content-Type': 'application/json' } }
    );
    return response.data ?? { id: recordId, totalCashbackAmount: body.totalCashbackAmount };
  }

  /** يُمرَّر مع cashback-transactions/fetch مع الجسم — احتياط عند دمج الباكند للمفاتيح من الاستعلام */
  private static appendCashbackFetchDateKeysToQuery(
    params: Record<string, string>,
    body: Pick<CashbackFetchBody, 'fromDateKey' | 'toDateKey'>
  ): void {
    const f = body.fromDateKey?.trim();
    const t = body.toDateKey?.trim();
    if (f) params.fromDateKey = f;
    if (t) params.toDateKey = t;
  }

  /**
   * تقرير الكاش باك عبر السيرفر (FTTH من قاعدة البيانات) — POST /providers/sas/cashback-transactions/fetch
   * Query: resellerId، agentId، format (json افتراضياً)، واختيارياً fromDateKey/toDateKey (نفس yyyy-MM-dd في الجسم للاتساق).
   */
  async fetchCashbackTransactionsJson(
    body: CashbackFetchBody,
    query: { resellerId?: string; agentId?: string }
  ): Promise<CashbackTransactionsResponse> {
    const params: Record<string, string> = {};
    if (query.resellerId) params.resellerId = query.resellerId;
    if (query.agentId) params.agentId = query.agentId;
    ApiService.appendCashbackFetchDateKeysToQuery(params, body);
    const response = await this.api.post<CashbackTransactionsResponse>(
      '/providers/sas/cashback-transactions/fetch',
      body,
      {
        params,
        timeout: 600_000,
        headers: { 'Content-Type': 'application/json' },
      }
    );
    return response.data ?? { rows: [] };
  }

  /**
   * نفس fetch مع format=excel|xlsx — استجابة ملف Excel (أعمدة عربية + ملخص).
   * تُمرَّر fromDateKey/toDateKey في الاستعلام أيضاً إن وُجدتا في الجسم (احتياط إن أُزيلت من JSON بعد التنظيف).
   */
  async fetchCashbackTransactionsExcel(
    body: CashbackFetchBody,
    query: { resellerId?: string; agentId?: string; format?: 'excel' | 'xlsx' }
  ): Promise<{ blob: Blob; filename: string }> {
    const params: Record<string, string> = {};
    if (query.resellerId) params.resellerId = query.resellerId;
    if (query.agentId) params.agentId = query.agentId;
    params.format = query.format === 'excel' ? 'excel' : 'xlsx';
    ApiService.appendCashbackFetchDateKeysToQuery(params, body);
    try {
      const response = await this.api.post<Blob>('/providers/sas/cashback-transactions/fetch', body, {
        params,
        responseType: 'blob',
        timeout: 600_000,
        headers: { 'Content-Type': 'application/json' },
      });
      const ct = (response.headers['content-type'] || '').toLowerCase();
      if (ct.includes('application/json') && response.data) {
        const text = await new Response(response.data).text();
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new Error(text.trim().slice(0, 500) || 'فشل تصدير Excel');
        }
        const j = parsed as CashbackTransactionsResponse & {
          detail?: string;
          message?: string;
          title?: string;
        };
        /** السيرفر أحياناً يعيد نفس JSON الـ fetch بدل ملف xlsx — نُنشئ الملف من الصفوف محلياً. */
        if (Array.isArray(j.rows)) {
          const blob = buildCashbackXlsxBlobFromJson(j);
          const rawName = this.filenameFromContentDisposition(response.headers['content-disposition']);
          const filename =
            rawName && /\.(xlsx|xls)$/i.test(rawName) ? rawName : `cashback-${Date.now()}.xlsx`;
          return { blob, filename };
        }
        throw new Error(j.detail || j.message || j.title || 'فشل تصدير Excel');
      }
      const rawName = this.filenameFromContentDisposition(response.headers['content-disposition']);
      const filename = rawName && /\.(xlsx|xls)$/i.test(rawName) ? rawName : `cashback-${Date.now()}.xlsx`;
      return { blob: response.data, filename };
    } catch (e: unknown) {
      if (axios.isAxiosError(e) && e.response?.data instanceof Blob) {
        const text = await new Response(e.response.data as Blob).text();
        let msg = 'فشل تصدير Excel';
        try {
          const j = JSON.parse(text) as { detail?: string; message?: string; title?: string; errors?: Record<string, string[]> };
          msg = j.detail || j.message || j.title || msg;
          if (j.errors && typeof j.errors === 'object') {
            const parts = Object.values(j.errors).flat();
            if (parts.length) msg = parts.join('\n');
          }
        } catch {
          if (text.trim()) msg = text.trim().slice(0, 500);
        }
        throw new Error(msg);
      }
      throw e;
    }
  }

  /** Query اختياري للأدمن فقط — إلزامي لجميع طلبات CustomerInvoices */
  private static customerInvoicesAgentParams(agentId?: string): { agentId: string } | undefined {
    return agentId ? { agentId } : undefined;
  }

  private static defaultCustomerInvoiceStatistics(): CustomerInvoiceStatisticsDto {
    return {
      totalDebtAmount: 0,
      totalDebtPaid: 0,
      totalDebtRemaining: 0,
      totalBalanceAmount: 0,
      totalTransferAmount: 0,
      customerCount: 0,
    };
  }

  private static parseCustomerInvoicesListResponse(payload: unknown): CustomerInvoicesListResponse {
    if (payload && typeof payload === 'object' && Array.isArray((payload as { items?: unknown }).items)) {
      const o = payload as {
        items: CustomerInvoiceCustomerDto[];
        statistics?: CustomerInvoiceStatisticsDto;
      };
      return {
        items: o.items ?? [],
        statistics: o.statistics ?? ApiService.defaultCustomerInvoiceStatistics(),
      };
    }
    if (payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)) {
      const o = payload as { data: CustomerInvoiceCustomerDto[]; statistics?: CustomerInvoiceStatisticsDto };
      return {
        items: o.data ?? [],
        statistics: o.statistics ?? ApiService.defaultCustomerInvoiceStatistics(),
      };
    }
    if (Array.isArray(payload)) {
      return {
        items: payload as CustomerInvoiceCustomerDto[],
        statistics: ApiService.defaultCustomerInvoiceStatistics(),
      };
    }
    return { items: [], statistics: ApiService.defaultCustomerInvoiceStatistics() };
  }

  /** GET /CustomerInvoices — للأدمن: agentId إلزامي؛ فلترة اختيارية على النتائج */
  async getCustomerInvoices(query?: {
    agentId?: string;
    customerName?: string;
    customerUsername?: string;
    phoneNumber?: string;
    customerType?: number;
  }): Promise<CustomerInvoicesListResponse> {
    const params: Record<string, string | number> = {};
    if (query?.agentId) params.agentId = query.agentId;
    if (query?.customerName?.trim()) params.customerName = query.customerName.trim();
    if (query?.customerUsername?.trim()) params.customerUsername = query.customerUsername.trim();
    if (query?.phoneNumber?.trim()) params.phoneNumber = query.phoneNumber.trim();
    if (query?.customerType !== undefined && query?.customerType !== null) {
      params.customerType = query.customerType;
    }
    const response = await this.api.get<unknown>('/CustomerInvoices', {
      params: Object.keys(params).length ? params : undefined,
    });
    return ApiService.parseCustomerInvoicesListResponse(response.data);
  }

  private static normalizeCustomerInvoiceDetail(raw: unknown): CustomerInvoiceDetailDto {
    if (raw == null || typeof raw !== 'object') {
      return { id: '', agentId: '', customerName: '', customerType: 0, invoices: [] } as CustomerInvoiceDetailDto;
    }
    const r = raw as Record<string, unknown>;
    const invRaw = r.invoices ?? r.Invoices;
    const invoices = Array.isArray(invRaw) ? (invRaw as CustomerInvoiceRecordDto[]) : [];
    return { ...r, invoices } as CustomerInvoiceDetailDto;
  }

  /** GET /CustomerInvoices/{customerId} — العميل + كل فواتيره */
  async getCustomerInvoiceById(id: string, agentId?: string): Promise<CustomerInvoiceDetailDto> {
    const response = await this.api.get<unknown>(
      `/CustomerInvoices/${encodeURIComponent(id)}`,
      { params: ApiService.customerInvoicesAgentParams(agentId) }
    );
    return ApiService.normalizeCustomerInvoiceDetail(response.data);
  }

  /** POST /CustomerInvoices — إنشاء عميل فقط */
  async createCustomerInvoiceCustomer(
    body: CustomerInvoiceCustomerCreateDto,
    agentId?: string
  ): Promise<CustomerInvoiceCustomerDto> {
    const response = await this.api.post<CustomerInvoiceCustomerDto>('/CustomerInvoices', body, {
      params: ApiService.customerInvoicesAgentParams(agentId),
    });
    return response.data;
  }

  /** PUT /CustomerInvoices/{customerId} — تعديل بيانات العميل */
  async updateCustomerInvoiceCustomer(
    customerId: string,
    body: CustomerInvoiceCustomerUpdateDto,
    agentId?: string
  ): Promise<CustomerInvoiceCustomerDto> {
    const response = await this.api.put<CustomerInvoiceCustomerDto>(
      `/CustomerInvoices/${encodeURIComponent(customerId)}`,
      body,
      { params: ApiService.customerInvoicesAgentParams(agentId) }
    );
    return response.data;
  }

  /** DELETE /CustomerInvoices/{customerId} — 204 */
  async deleteCustomerInvoiceCustomer(customerId: string, agentId?: string): Promise<void> {
    await this.api.delete(`/CustomerInvoices/${encodeURIComponent(customerId)}`, {
      params: ApiService.customerInvoicesAgentParams(agentId),
    });
  }

  /** POST /CustomerInvoices/{customerId}/invoices — إضافة فاتورة (debtAmount = balance − transfer) */
  async createCustomerInvoiceRecord(
    customerId: string,
    body: CustomerInvoiceRecordCreateDto,
    agentId?: string
  ): Promise<CustomerInvoiceRecordDto> {
    const response = await this.api.post<CustomerInvoiceRecordDto>(
      `/CustomerInvoices/${encodeURIComponent(customerId)}/invoices`,
      body,
      { params: ApiService.customerInvoicesAgentParams(agentId) }
    );
    return response.data;
  }

  /** PUT /CustomerInvoices/{customerId}/invoices/{invoiceId} */
  async updateCustomerInvoiceRecord(
    customerId: string,
    invoiceId: string,
    body: CustomerInvoiceRecordCreateDto,
    agentId?: string
  ): Promise<CustomerInvoiceRecordDto> {
    const response = await this.api.put<CustomerInvoiceRecordDto>(
      `/CustomerInvoices/${encodeURIComponent(customerId)}/invoices/${encodeURIComponent(invoiceId)}`,
      body,
      { params: ApiService.customerInvoicesAgentParams(agentId) }
    );
    return response.data;
  }

  /** DELETE /CustomerInvoices/{customerId}/invoices/{invoiceId} — 204 */
  async deleteCustomerInvoiceRecord(customerId: string, invoiceId: string, agentId?: string): Promise<void> {
    await this.api.delete(
      `/CustomerInvoices/${encodeURIComponent(customerId)}/invoices/${encodeURIComponent(invoiceId)}`,
      { params: ApiService.customerInvoicesAgentParams(agentId) }
    );
  }

  /** POST /CustomerInvoices/{invoiceId}/send-whatsapp — إرسال نص الفاتورة (معرّف الفاتورة) */
  async sendCustomerInvoiceWhatsApp(
    invoiceId: string,
    agentId?: string
  ): Promise<CustomerInvoiceSendWhatsAppResponse> {
    const response = await this.api.post<CustomerInvoiceSendWhatsAppResponse>(
      `/CustomerInvoices/${encodeURIComponent(invoiceId)}/send-whatsapp`,
      undefined,
      {
        params: ApiService.customerInvoicesAgentParams(agentId),
        timeout: ApiService.WHATSAPP_SEND_TIMEOUT_MS,
      }
    );
    return response.data ?? {};
  }

  /** POST /CustomerInvoices/{invoiceId}/pay-debt — تسديد جزء من الدين */
  async payCustomerInvoiceDebt(
    invoiceId: string,
    body: CustomerInvoicePayDebtRequest,
    agentId?: string
  ): Promise<CustomerInvoiceRecordDto> {
    const response = await this.api.post<CustomerInvoiceRecordDto>(
      `/CustomerInvoices/${encodeURIComponent(invoiceId)}/pay-debt`,
      body,
      { params: ApiService.customerInvoicesAgentParams(agentId) }
    );
    return response.data;
  }

  private filenameFromContentDisposition(header?: string): string | undefined {
    if (!header) return undefined;
    const star = /filename\*=(?:UTF-8''|utf-8'')([^;\s]+)/i.exec(header);
    if (star?.[1]) {
      try {
        return decodeURIComponent(star[1].replace(/["']/g, '').trim());
      } catch {
        return star[1];
      }
    }
    const plain = /filename="([^"]+)"/i.exec(header) || /filename=([^;\s]+)/i.exec(header);
    return plain?.[1]?.replace(/["']/g, '')?.trim();
  }

  /** جلب المعاملات من FTTH (transactions) — POST /providers/sas/sync-transactions. نفس آلية sync-subscribers (agentId, resellerId + اعتماديات اختيارية). */
  // ملاحظة: واجهة sync-transactions (المعاملات) تُستخدم حالياً مباشرة من الباكند ولا تحتاج استدعاء منفصل من الفرونت.

  /**
   * تفعيل مشترك واحد من قائمة المزامنة — POST /providers/sas/update-subscription.
   * السلوك: خصم من رصيد الوكيل، إنشاء فاتورة/إيصال، ومعاملات التفعيل الكاملة (منطق منفصل عن save-subscriber).
   */
  async updateSubscription(request: UpdateSubscriptionRequest): Promise<UpdateSubscriptionResponse> {
    const response = await this.api.post<UpdateSubscriptionResponse>('/providers/sas/update-subscription', request, {
      timeout: 60000,
    });
    return response.data;
  }

  /**
   * حفظ مشترك من قائمة المزامنة — POST /providers/sas/save-subscriber.
   * السلوك: يحدّث التاريخ فقط (تاريخ الانتهاء + تاريخ الاشتراك). لا إنشاء فاتورة ولا إيصال ولا خصم رصيد.
   * (التفعيل الكامل عبر update-subscription منفصل: خصم رصيد، فاتورة، ومعاملات التفعيل.)
   */
  async saveSubscriberFromSync(
    request: SaveSubscriberFromSyncRequest,
    options?: { agentId?: string; isFtth?: boolean }
  ): Promise<{ message?: string }> {
    const params: Record<string, string> = {};
    if (options?.agentId) params.agentId = options.agentId;
    if (options?.isFtth) params.isFtth = 'true';
    const response = await this.api.post<{ message?: string }>('/providers/sas/save-subscriber', request, {
      params: Object.keys(params).length ? params : undefined,
      timeout: 30000,
    });
    return response.data ?? {};
  }

  // SAS provider sync (Admin or Agent). agentId required for Admin.
  async syncFromSas(request: SasSyncRequest, agentId?: string): Promise<SasSyncResponse> {
    const params = agentId ? { agentId } : undefined;
    const response: AxiosResponse<SasSyncResponse> = await this.api.post('/providers/sas/sync', request, {
      params,
      timeout: ApiService.SAS_SYNC_TIMEOUT_MS,
    });
    return response.data;
  }

  /** مزامنة من مصفوفة مستخدمين جاهزة (مثلاً بعد لصق JSON من لوحة SAS أو postMessage) */
  async syncFromSasData(request: SasSyncFromDataRequest, agentId?: string): Promise<SasSyncResponse> {
    const params = agentId ? { agentId } : undefined;
    const response: AxiosResponse<SasSyncResponse> = await this.api.post(
      '/providers/sas/sync-from-data',
      request,
      { params, timeout: ApiService.SAS_SYNC_TIMEOUT_MS }
    );
    return response.data;
  }

  /**
   * مزامنة من JSON خام (كما هو من SAS) — للأدمن عادة.
   * يرسل النص الخام دون تعديل (حتى لا نغيّر شكل الـ JSON).
   */
  async syncFromSasJsonRaw(rawJson: string, resetOnline: boolean = true): Promise<SasSyncResponse> {
    const response: AxiosResponse<SasSyncResponse> = await this.api.post(
      '/providers/sas/sync-from-json',
      rawJson,
      {
        params: { resetOnline },
        timeout: ApiService.SAS_SYNC_TIMEOUT_MS,
        headers: { 'Content-Type': 'application/json' },
      }
    );
    return response.data;
  }

  /**
   * سحب المشتركين من رسيلر SAS وحفظهم في قاعدة البيانات — POST /providers/sas/sync-subscribers-sas?resellerId=...
   * متاح للوكيل عندما يكون نوع الخدمة SAS. يعيد عدد المشتركين الذين تمت مزامنتهم فعلياً (synced)
   * والعدد الكلي الذي رجع من لوحة SAS (total).
   */
  async syncSubscribersFromSasReseller(resellerId: string): Promise<SasSyncResponse & { total?: number }> {
    const response: AxiosResponse<SasSyncResponse & { total?: number }> = await this.api.post(
      '/providers/sas/sync-subscribers-sas',
      {},
      { params: { resellerId }, timeout: ApiService.SAS_SYNC_TIMEOUT_MS }
    );
    return response.data;
  }

  /**
   * سحب كل مشتركي FTTH من رسيلر وحفظهم في قاعدة بيانات الوكيل مع فلتر التكرار (الاسم الكامل + username) — POST /providers/sas/sync-subscribers-save?resellerId=...
   * يرجع synced (المحفوظ فعلياً)، total (قبل الفلترة)، skippedByNameUsername (التي تم تجاهلها بسبب التكرار).
   */
  async syncSubscribersSaveFromFtthReseller(resellerId: string): Promise<SasSyncResponse & { total?: number; skippedByNameUsername?: number }> {
    const response: AxiosResponse<SasSyncResponse & { total?: number; skippedByNameUsername?: number }> = await this.api.post(
      '/providers/sas/sync-subscribers-save',
      {},
      { params: { resellerId }, timeout: ApiService.SAS_SYNC_TIMEOUT_MS }
    );
    return response.data;
  }

  /** رصيد SAS الحي — GET /sas/live-balance. الوكيل من JWT، ونوع الخدمة يجب أن يكون SAS. */
  async getSasLiveBalance(): Promise<{ status: string; balance?: string | null }> {
    const response = await this.api.get<{ status: string; balance?: string | null }>('/sas/live-balance', {
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      params: { _t: Date.now() },
    });
    return response.data;
  }

  /** عدد المتصلين الحي من SAS — GET /sas/live-online. الوكيل من JWT، ونوع الخدمة SAS. الباكند قد يرجّع onlineUsers أو online_users. */
  async getSasLiveOnline(): Promise<{ status: string; onlineUsers?: number; online_users?: number }> {
    const response = await this.api.get<{ status: string; onlineUsers?: number; online_users?: number }>('/sas/live-online', {
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      params: { _t: Date.now() },
    });
    return response.data;
  }

}

export const apiService = new ApiService();
export { ApiService };
