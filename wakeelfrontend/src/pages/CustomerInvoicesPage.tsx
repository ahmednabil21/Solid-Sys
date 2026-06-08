import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useDigits } from '../contexts/DigitsContext';
import { apiService, ApiService } from '../services/api';
import { showError, showSuccess } from '../utils/notifications';
import {
  Agent,
  CustomerInvoiceCustomerCreateDto,
  CustomerInvoiceCustomerDto,
  CustomerInvoiceCustomerType,
  CustomerInvoiceDetailDto,
  CustomerInvoicePaymentMethod,
  CustomerInvoiceRecordCreateDto,
  CustomerInvoiceRecordDto,
  CustomerInvoiceStatisticsDto,
  TenantPlanType,
  UserRole,
} from '../types';
import WifiLoaderComponent from '../components/WifiLoaderComponent';
import {
  Banknote,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  Filter,
  MessageCircle,
  Pencil,
  Plus,
  Printer,
  Receipt,
  Trash2,
  X,
} from 'lucide-react';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildCustomerInvoicePrintHtml(
  invoice: CustomerInvoiceRecordDto,
  customer: Pick<CustomerInvoiceCustomerDto, 'customerName' | 'phoneNumber' | 'address' | 'customerType'>,
  formatDate: (d: Date | string, options?: Intl.DateTimeFormatOptions) => string,
  formatNumber: (n: number, o?: { suffix?: string }) => string,
  customerTypeLabel: string,
  paymentLabel: string
): string {
  const dateStr = invoice.createdAt ? formatDate(invoice.createdAt) : '—';
  const bal = formatNumber(invoice.balanceAmount ?? 0, { suffix: ' د.ع' });
  const tr = formatNumber(invoice.transferAmount ?? 0, { suffix: ' د.ع' });
  const debt = formatNumber(invoice.debtAmount ?? 0, { suffix: ' د.ع' });
  const paid = formatNumber(invoice.debtPaid ?? 0, { suffix: ' د.ع' });
  const rem = formatNumber(invoice.debtRemaining ?? 0, { suffix: ' د.ع' });

  const styles = `
            * { box-sizing: border-box; }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
              background: white;
              color: #333;
              direction: rtl;
              font-size: 7px;
              line-height: 1.2;
            }
            .receipt {
              width: 46mm;
              max-width: 46mm;
              padding: 1.5mm;
              background: white;
              border: none;
            }
            .header {
              text-align: center;
              border-bottom: 1px solid #333;
              padding-bottom: 2mm;
              margin-bottom: 2mm;
            }
            .header h1 { margin: 0; font-size: 9px; font-weight: bold; }
            .header p { margin: 1px 0; font-size: 6px; }
            .section { margin-bottom: 2mm; }
            .section h3 { margin: 0 0 1mm 0; font-size: 7px; border-bottom: 1px solid #ddd; padding-bottom: 0.5mm; }
            .info-row { display: flex; justify-content: space-between; margin: 0.5mm 0; padding: 0; font-size: 6px; gap: 1mm; }
            .info-row:nth-child(even) { background: #f5f5f5; }
            .label { font-weight: bold; flex-shrink: 0; }
            .value { text-align: left; word-break: break-word; }
            .pricing { background: #eee; padding: 1.5mm; border-radius: 1px; margin: 1.5mm 0; }
            .pricing .info-row { margin: 0.3mm 0; }
            .footer { text-align: center; margin-top: 2mm; padding-top: 1mm; border-top: 1px solid #ddd; font-size: 5px; }
            .footer p { margin: 0.5px 0; }
            @media print {
              @page { size: 50mm 80mm; margin: 1mm; }
              body { margin: 0; padding: 0; width: 50mm; min-height: 80mm; max-width: 50mm; overflow: hidden; font-size: 6px; }
              .receipt { width: 48mm; max-width: 48mm; padding: 1mm; font-size: 6px; }
              .header h1 { font-size: 8px; }
              .header p { font-size: 5px; }
              .section h3 { font-size: 6px; }
              .info-row { font-size: 5px; }
              .pricing { padding: 1mm; }
              .footer { font-size: 5px; margin-top: 1mm; }
            }
  `;

  const addr = (customer.address ?? '').trim();
  const phone = (customer.phoneNumber ?? '').trim();

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>فاتورة عميل — ${escapeHtml(invoice.id)}</title>
  <style>${styles}</style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h1>فاتورة عميل</h1>
      <p><strong>رقم المرجع:</strong> ${escapeHtml(invoice.id)}</p>
      <p><strong>التاريخ:</strong> ${escapeHtml(dateStr)}</p>
    </div>
    <div class="section">
      <h3>بيانات العميل</h3>
      <div class="info-row"><span class="label">الاسم:</span><span class="value">${escapeHtml(customer.customerName)}</span></div>
      ${phone ? `<div class="info-row"><span class="label">الهاتف:</span><span class="value">${escapeHtml(phone)}</span></div>` : ''}
      ${addr ? `<div class="info-row"><span class="label">العنوان:</span><span class="value">${escapeHtml(addr)}</span></div>` : ''}
      <div class="info-row"><span class="label">نوع العميل:</span><span class="value">${escapeHtml(customerTypeLabel)}</span></div>
      <div class="info-row"><span class="label">طريقة الدفع:</span><span class="value">${escapeHtml(paymentLabel)}</span></div>
    </div>
    <div class="pricing">
      <h3>المبالغ</h3>
      <div class="info-row"><span class="label">مبلغ الرصيد:</span><span class="value">${escapeHtml(bal)}</span></div>
      <div class="info-row"><span class="label">مبلغ التحويل:</span><span class="value">${escapeHtml(tr)}</span></div>
      <div class="info-row"><span class="label">مبلغ الدين:</span><span class="value">${escapeHtml(debt)}</span></div>
      <div class="info-row"><span class="label">المسدد من الدين:</span><span class="value">${escapeHtml(paid)}</span></div>
      <div class="info-row"><span class="label">متبقي الدين:</span><span class="value">${escapeHtml(rem)}</span></div>
    </div>
    <div class="footer">
      <p>فاتورة عملاء — نفس قياس فاتورة التفعيل</p>
    </div>
  </div>
</body>
</html>`;
}

const CUSTOMER_TYPE_LABELS: Record<number, string> = {
  [CustomerInvoiceCustomerType.NewCustomer]: 'عميل جديد',
  [CustomerInvoiceCustomerType.Agent]: 'وكيل',
};

const PAYMENT_METHOD_LABELS: Record<number, string> = {
  [CustomerInvoicePaymentMethod.Cash]: 'نقد',
  [CustomerInvoicePaymentMethod.MasterCard]: 'Master Card',
  [CustomerInvoicePaymentMethod.ZainCash]: 'Zain Cash',
  [CustomerInvoicePaymentMethod.Other]: 'أخرى',
};

function emptyCustomerForm(): CustomerInvoiceCustomerCreateDto {
  return {
    customerName: '',
    phoneNumber: '',
    address: '',
    customerType: CustomerInvoiceCustomerType.NewCustomer,
  };
}

function customerToForm(c: CustomerInvoiceCustomerDto): CustomerInvoiceCustomerCreateDto {
  return {
    customerName: c.customerName,
    phoneNumber: c.phoneNumber ?? '',
    address: c.address ?? '',
    customerType: Number(c.customerType) as CustomerInvoiceCustomerType,
  };
}

function emptyInvoiceForm(): CustomerInvoiceRecordCreateDto {
  return {
    balanceAmount: 0,
    transferAmount: 0,
    paymentMethod: CustomerInvoicePaymentMethod.Cash,
  };
}

function recordToForm(r: CustomerInvoiceRecordDto): CustomerInvoiceRecordCreateDto {
  return {
    balanceAmount: r.balanceAmount,
    transferAmount: r.transferAmount,
    paymentMethod: Number(r.paymentMethod) as CustomerInvoicePaymentMethod,
  };
}

type InvoiceListFilters = {
  customerName: string;
  customerUsername: string;
  phoneNumber: string;
  customerType: '' | '0' | '1';
};

const emptyListFilters = (): InvoiceListFilters => ({
  customerName: '',
  customerUsername: '',
  phoneNumber: '',
  customerType: '',
});

const emptyInvoiceStatistics = (): CustomerInvoiceStatisticsDto => ({
  totalDebtAmount: 0,
  totalDebtPaid: 0,
  totalDebtRemaining: 0,
  totalBalanceAmount: 0,
  totalTransferAmount: 0,
  customerCount: 0,
});

function debtPreview(balance: number, transfer: number): number {
  return Math.max(0, balance - transfer);
}

const CustomerInvoicesPage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const { formatNumber, formatDate } = useDigits();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === UserRole.Admin;
  const canUsePage =
    user &&
    (user.role === UserRole.Admin || user.role === UserRole.Agent || user.role === UserRole.SubAgent);

  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [customerModalEditingId, setCustomerModalEditingId] = useState<string | null>(null);
  const [customerForm, setCustomerForm] = useState<CustomerInvoiceCustomerCreateDto>(emptyCustomerForm);

  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceModalCustomerId, setInvoiceModalCustomerId] = useState<string | null>(null);
  const [invoiceModalCustomerName, setInvoiceModalCustomerName] = useState('');
  const [invoiceEditingId, setInvoiceEditingId] = useState<string | null>(null);
  const [invoiceForm, setInvoiceForm] = useState<CustomerInvoiceRecordCreateDto>(emptyInvoiceForm);
  const [invoiceEditingDebtPaid, setInvoiceEditingDebtPaid] = useState(0);

  const [detailCustomerId, setDetailCustomerId] = useState<string | null>(null);

  const [invoicesDropdownOpen, setInvoicesDropdownOpen] = useState(false);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [filterDraft, setFilterDraft] = useState<InvoiceListFilters>(emptyListFilters);
  const [appliedFilters, setAppliedFilters] = useState<InvoiceListFilters>(emptyListFilters);
  const [payDebtRow, setPayDebtRow] = useState<CustomerInvoiceRecordDto | null>(null);
  const [payDebtCustomerName, setPayDebtCustomerName] = useState('');
  const [payDebtAmountStr, setPayDebtAmountStr] = useState('');

  const { data: agentsResponse } = useQuery({
    queryKey: ['allAgents', 'customer-invoices'],
    queryFn: () => apiService.getAllAgents({ page: 1, pageSize: 5000 }),
    enabled: isAuthenticated && isAdmin,
    retry: false,
  });
  const adminAgents = (agentsResponse?.data ?? []) as Agent[];

  const agentIdParam = isAdmin ? selectedAgentId : undefined;
  const listEnabled =
    !!canUsePage &&
    isAuthenticated &&
    user?.canAccessInvoices === true &&
    user?.tenantPlanType !== TenantPlanType.Vip &&
    (!isAdmin || !!selectedAgentId);

  useEffect(() => {
    setAppliedFilters(emptyListFilters());
    setFilterDraft(emptyListFilters());
  }, [selectedAgentId]);

  const listQueryKey = [
    'customer-invoices',
    agentIdParam ?? 'me',
    appliedFilters.customerName,
    appliedFilters.customerUsername,
    appliedFilters.phoneNumber,
    appliedFilters.customerType,
  ] as const;

  const {
    data: listResponse,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: listQueryKey,
    queryFn: () =>
      apiService.getCustomerInvoices({
        agentId: agentIdParam,
        customerName: appliedFilters.customerName.trim() || undefined,
        customerUsername: appliedFilters.customerUsername.trim() || undefined,
        phoneNumber: appliedFilters.phoneNumber.trim() || undefined,
        customerType:
          appliedFilters.customerType === '' ? undefined : Number(appliedFilters.customerType),
      }),
    enabled: listEnabled,
    retry: false,
  });

  const customers = listResponse?.items ?? [];
  const statistics = listResponse?.statistics ?? emptyInvoiceStatistics();

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['customer-invoice-detail', agentIdParam ?? 'me', detailCustomerId],
    queryFn: () => apiService.getCustomerInvoiceById(detailCustomerId!, agentIdParam),
    enabled: listEnabled && !!detailCustomerId,
    retry: false,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['customer-invoices'] });
    queryClient.invalidateQueries({ queryKey: ['customer-invoice-detail'] });
  };

  const createCustomerMutation = useMutation({
    mutationFn: (payload: CustomerInvoiceCustomerCreateDto) =>
      apiService.createCustomerInvoiceCustomer(payload, agentIdParam),
    onSuccess: () => {
      invalidateAll();
      setCustomerModalOpen(false);
      setCustomerModalEditingId(null);
      setCustomerForm(emptyCustomerForm());
      showSuccess('تم الحفظ', 'تمت إضافة العميل.');
    },
    onError: (err: unknown) => showError('فشل الإضافة', ApiService.showError(err)),
  });

  const updateCustomerMutation = useMutation({
    mutationFn: (args: { id: string; payload: CustomerInvoiceCustomerCreateDto }) =>
      apiService.updateCustomerInvoiceCustomer(args.id, args.payload, agentIdParam),
    onSuccess: () => {
      invalidateAll();
      setCustomerModalOpen(false);
      setCustomerModalEditingId(null);
      setCustomerForm(emptyCustomerForm());
      showSuccess('تم التحديث', 'تم تعديل بيانات العميل.');
    },
    onError: (err: unknown) => showError('فشل التحديث', ApiService.showError(err)),
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteCustomerInvoiceCustomer(id, agentIdParam),
    onSuccess: () => {
      invalidateAll();
      setDetailCustomerId(null);
      showSuccess('تم الحذف', 'تم حذف العميل.');
    },
    onError: (err: unknown) => showError('فشل الحذف', ApiService.showError(err)),
  });

  const createInvoiceMutation = useMutation({
    mutationFn: (args: { customerId: string; payload: CustomerInvoiceRecordCreateDto }) =>
      apiService.createCustomerInvoiceRecord(args.customerId, args.payload, agentIdParam),
    onSuccess: () => {
      invalidateAll();
      closeInvoiceModal();
      showSuccess('تم الحفظ', 'تمت إضافة الفاتورة.');
    },
    onError: (err: unknown) => showError('فشل الإضافة', ApiService.showError(err)),
  });

  const updateInvoiceMutation = useMutation({
    mutationFn: (args: {
      customerId: string;
      invoiceId: string;
      payload: CustomerInvoiceRecordCreateDto;
    }) => apiService.updateCustomerInvoiceRecord(args.customerId, args.invoiceId, args.payload, agentIdParam),
    onSuccess: () => {
      invalidateAll();
      closeInvoiceModal();
      showSuccess('تم التحديث', 'تم تعديل الفاتورة.');
    },
    onError: (err: unknown) => showError('فشل التحديث', ApiService.showError(err)),
  });

  const deleteInvoiceMutation = useMutation({
    mutationFn: (args: { customerId: string; invoiceId: string }) =>
      apiService.deleteCustomerInvoiceRecord(args.customerId, args.invoiceId, agentIdParam),
    onSuccess: () => {
      invalidateAll();
      showSuccess('تم الحذف', 'تم حذف الفاتورة.');
    },
    onError: (err: unknown) => showError('فشل الحذف', ApiService.showError(err)),
  });

  const sendWhatsAppMutation = useMutation({
    mutationFn: (invoiceId: string) => apiService.sendCustomerInvoiceWhatsApp(invoiceId, agentIdParam),
    onSuccess: (data) => {
      const msg = data.message ?? 'تم إرسال رسالة واتساب بنجاح.';
      const extra = data.messageId ? ` (${data.messageId})` : '';
      showSuccess('واتساب', `${msg}${extra}`);
    },
    onError: (err: unknown) => showError('إرسال واتساب', ApiService.showError(err)),
  });

  const payDebtMutation = useMutation({
    mutationFn: (args: { id: string; amount: number }) =>
      apiService.payCustomerInvoiceDebt(args.id, { amount: args.amount }, agentIdParam),
    onSuccess: () => {
      invalidateAll();
      setPayDebtRow(null);
      setPayDebtCustomerName('');
      setPayDebtAmountStr('');
      showSuccess('تسديد الدين', 'تم تسجيل المبلغ بنجاح.');
    },
    onError: (err: unknown) => showError('تسديد الدين', ApiService.showError(err)),
  });

  const openCreateCustomer = () => {
    setCustomerModalEditingId(null);
    setCustomerForm(emptyCustomerForm());
    setCustomerModalOpen(true);
  };

  const openEditCustomer = (row: CustomerInvoiceCustomerDto) => {
    setCustomerModalEditingId(row.id);
    setCustomerForm(customerToForm(row));
    setCustomerModalOpen(true);
  };

  const closeInvoiceModal = () => {
    setInvoiceModalOpen(false);
    setInvoiceModalCustomerId(null);
    setInvoiceModalCustomerName('');
    setInvoiceEditingId(null);
    setInvoiceEditingDebtPaid(0);
    setInvoiceForm(emptyInvoiceForm());
  };

  const openCreateInvoice = (customerId: string, customerName: string) => {
    setInvoiceModalCustomerId(customerId);
    setInvoiceModalCustomerName(customerName);
    setInvoiceEditingId(null);
    setInvoiceEditingDebtPaid(0);
    setInvoiceForm(emptyInvoiceForm());
    setInvoiceModalOpen(true);
  };

  const openEditInvoice = (
    customerId: string,
    customerName: string,
    inv: CustomerInvoiceRecordDto
  ) => {
    setInvoiceModalCustomerId(customerId);
    setInvoiceModalCustomerName(customerName);
    setInvoiceEditingId(inv.id);
    setInvoiceEditingDebtPaid(inv.debtPaid ?? 0);
    setInvoiceForm(recordToForm(inv));
    setInvoiceModalOpen(true);
  };

  const openPayDebt = (inv: CustomerInvoiceRecordDto, customerName: string) => {
    setPayDebtRow(inv);
    setPayDebtCustomerName(customerName);
    const rem = inv.debtRemaining ?? Math.max(0, (inv.debtAmount ?? 0) - (inv.debtPaid ?? 0));
    setPayDebtAmountStr(rem > 0 ? String(rem) : '');
  };

  const submitPayDebt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payDebtRow) return;
    const raw = payDebtAmountStr.replace(/,/g, '').trim();
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) {
      showError('التحقق', 'أدخل مبلغاً صالحاً أكبر من صفر.');
      return;
    }
    payDebtMutation.mutate({ id: payDebtRow.id, amount });
  };

  const submitCustomerForm = (e: React.FormEvent) => {
    e.preventDefault();
    const name = customerForm.customerName.trim();
    if (!name) {
      showError('التحقق', 'اسم العميل مطلوب.');
      return;
    }
    const payload: CustomerInvoiceCustomerCreateDto = {
      ...customerForm,
      customerName: name,
      phoneNumber: customerForm.phoneNumber?.trim() || null,
      address: customerForm.address?.trim() || null,
    };
    if (customerModalEditingId) {
      updateCustomerMutation.mutate({ id: customerModalEditingId, payload });
    } else {
      createCustomerMutation.mutate(payload);
    }
  };

  const submitInvoiceForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceModalCustomerId) return;
    const bal = Number(invoiceForm.balanceAmount);
    const tr = Number(invoiceForm.transferAmount);
    if (!Number.isFinite(bal) || bal < 0 || !Number.isFinite(tr) || tr < 0) {
      showError('التحقق', 'أدخل مبالغ صحيحة.');
      return;
    }
    if (tr > bal) {
      showError('التحقق', 'مبلغ التحويل لا يجوز أن يتجاوز مبلغ الرصيد.');
      return;
    }
    const debtPreviewVal = debtPreview(bal, tr);
    if (invoiceEditingId && debtPreviewVal < invoiceEditingDebtPaid) {
      showError(
        'التحقق',
        `لا يمكن أن يكون الدين المحسوب أقل من المسدد حالياً (${formatNumber(invoiceEditingDebtPaid, { suffix: ' د.ع' })}).`
      );
      return;
    }
    const payload: CustomerInvoiceRecordCreateDto = {
      balanceAmount: bal,
      transferAmount: tr,
      paymentMethod: invoiceForm.paymentMethod,
    };
    if (invoiceEditingId) {
      updateInvoiceMutation.mutate({
        customerId: invoiceModalCustomerId,
        invoiceId: invoiceEditingId,
        payload,
      });
    } else {
      createInvoiceMutation.mutate({ customerId: invoiceModalCustomerId, payload });
    }
  };

  const handleDeleteCustomer = (row: CustomerInvoiceCustomerDto) => {
    if (!window.confirm(`حذف العميل «${row.customerName}» وجميع فواتيره؟`)) return;
    deleteCustomerMutation.mutate(row.id);
  };

  const handleDeleteInvoice = (customerId: string, inv: CustomerInvoiceRecordDto) => {
    if (!window.confirm('حذف هذه الفاتورة؟')) return;
    deleteInvoiceMutation.mutate({ customerId, invoiceId: inv.id });
  };

  const handlePrintInvoice = (
    inv: CustomerInvoiceRecordDto,
    cust: Pick<CustomerInvoiceCustomerDto, 'customerName' | 'phoneNumber' | 'address' | 'customerType'>
  ) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showError('طباعة', 'تعذّر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة.');
      return;
    }
    const ct = CUSTOMER_TYPE_LABELS[Number(cust.customerType)] ?? String(cust.customerType);
    const pm = PAYMENT_METHOD_LABELS[Number(inv.paymentMethod)] ?? String(inv.paymentMethod);
    const html = buildCustomerInvoicePrintHtml(inv, cust, formatDate, formatNumber, ct, pm);
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 400);
    };
  };

  const accessDeniedMessage = useMemo(() => {
    if (!user || !canUsePage) return 'هذه الصفحة متاحة للمدير والوكيل والمدير الثانوي فقط.';
    if (user.canAccessInvoices === false) return 'لا تملك صلاحية الوصول إلى الفواتير (CanAccessInvoices).';
    if (user.tenantPlanType === TenantPlanType.Vip) return 'هذه الميزة متاحة لمستأجري Standard فقط.';
    return null;
  }, [user, canUsePage]);

  if (!isAuthenticated) return null;
  if (!canUsePage) return <Navigate to="/admin/receipts" replace />;
  if (accessDeniedMessage) {
    return (
      <div className="p-6 max-w-lg">
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-4 text-amber-900 dark:text-amber-200">
          {accessDeniedMessage}
        </div>
        <Link to="/admin/receipts" className="mt-4 inline-block text-primary-600 dark:text-primary-400">
          العودة إلى التفعيلات
        </Link>
      </div>
    );
  }

  const busy =
    createCustomerMutation.isPending ||
    updateCustomerMutation.isPending ||
    deleteCustomerMutation.isPending ||
    createInvoiceMutation.isPending ||
    updateInvoiceMutation.isPending ||
    deleteInvoiceMutation.isPending ||
    sendWhatsAppMutation.isPending ||
    payDebtMutation.isPending;

  const invoiceDebtPreview = debtPreview(
    Number(invoiceForm.balanceAmount) || 0,
    Number(invoiceForm.transferAmount) || 0
  );

  const detailForModal: CustomerInvoiceDetailDto | undefined = detailData;

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <div className="relative inline-block text-right">
            <button
              type="button"
              onClick={() => setInvoicesDropdownOpen((o) => !o)}
              className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400"
            >
              <Receipt className="h-8 w-8 text-primary-600 dark:text-primary-400 shrink-0" />
              <span>فواتير العملاء</span>
              <ChevronDown className={`h-6 w-6 transition ${invoicesDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {invoicesDropdownOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-10 cursor-default"
                  aria-label="إغلاق القائمة"
                  onClick={() => setInvoicesDropdownOpen(false)}
                />
                <div className="absolute right-0 z-20 mt-2 min-w-[220px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800">
                  <Link
                    to="/admin/receipts"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                    onClick={() => setInvoicesDropdownOpen(false)}
                  >
                    التفعيلات
                  </Link>
                  <span className="block px-4 py-2 text-sm font-medium bg-primary-50 text-primary-800 dark:bg-primary-900/30 dark:text-primary-200">
                    فواتير العملاء
                  </span>
                </div>
              </>
            )}
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
            عملاء وفواتير منفصلة — أضف عميلاً ثم سجّل فواتيره
          </p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            onClick={openCreateCustomer}
            disabled={!listEnabled || busy || (isAdmin && !selectedAgentId)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md text-sm font-medium disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            إضافة عميل
          </button>
        </div>
      </div>

      {isAdmin && (
        <div className="mb-4 max-w-md">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الوكيل</label>
          <select
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
          >
            <option value="">— اختر الوكيل —</option>
            {adminAgents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.companyName || a.fullName || a.id}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">مطلوب لعرض القائمة وجميع العمليات.</p>
        </div>
      )}

      {isAdmin && !selectedAgentId && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 p-6 text-center text-gray-600 dark:text-gray-400">
          اختر الوكيل لعرض فواتير العملاء.
        </div>
      )}

      {listEnabled && !error && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
          {(
            [
              { label: 'إجمالي الدين', value: statistics.totalDebtAmount, accent: 'border-violet-200 dark:border-violet-800' },
              { label: 'إجمالي المسدد', value: statistics.totalDebtPaid, accent: 'border-emerald-200 dark:border-emerald-800' },
              { label: 'إجمالي المتبقي', value: statistics.totalDebtRemaining, accent: 'border-amber-200 dark:border-amber-800' },
              { label: 'إجمالي الرصيد', value: statistics.totalBalanceAmount, accent: 'border-sky-200 dark:border-sky-800' },
              { label: 'إجمالي التحويل', value: statistics.totalTransferAmount, accent: 'border-teal-200 dark:border-teal-800' },
              { label: 'عدد العملاء', value: statistics.customerCount, accent: 'border-slate-200 dark:border-slate-600', isCount: true },
            ] as const
          ).map((c) => (
            <div
              key={c.label}
              className={`rounded-lg border bg-white dark:bg-gray-800/80 p-3 shadow-sm ${c.accent}`}
            >
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{c.label}</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                {'isCount' in c && c.isCount ? formatNumber(c.value) : formatNumber(c.value, { suffix: ' د.ع' })}
              </p>
            </div>
          ))}
        </div>
      )}

      {listEnabled && (
        <div className="mb-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/40 overflow-hidden">
          <button
            type="button"
            onClick={() => setAdvancedFiltersOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-100/80 dark:hover:bg-gray-700/50"
          >
            <span className="inline-flex items-center gap-2">
              <Filter className="h-4 w-4" />
              فلترة متقدمة
            </span>
            {advancedFiltersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {advancedFiltersOpen && (
            <div className="px-4 pb-4 pt-0 border-t border-gray-200 dark:border-gray-600 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">اسم العميل (جزء)</label>
                  <input
                    value={filterDraft.customerName}
                    onChange={(e) => setFilterDraft((f) => ({ ...f, customerName: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    placeholder="بحث..."
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">اسم المستخدم (جزء)</label>
                  <input
                    value={filterDraft.customerUsername}
                    onChange={(e) => setFilterDraft((f) => ({ ...f, customerUsername: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white font-mono"
                    placeholder="بحث..."
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">الهاتف (جزء)</label>
                  <input
                    value={filterDraft.phoneNumber}
                    onChange={(e) => setFilterDraft((f) => ({ ...f, phoneNumber: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    placeholder="بحث..."
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">نوع العميل</label>
                  <select
                    value={filterDraft.customerType}
                    onChange={(e) =>
                      setFilterDraft((f) => ({
                        ...f,
                        customerType: e.target.value as InvoiceListFilters['customerType'],
                      }))
                    }
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">الكل</option>
                    <option value="0">عميل جديد</option>
                    <option value="1">وكيل</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    const e = emptyListFilters();
                    setFilterDraft(e);
                    setAppliedFilters(e);
                  }}
                  className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  مسح الفلاتر
                </button>
                <button
                  type="button"
                  onClick={() => setAppliedFilters({ ...filterDraft })}
                  className="px-3 py-1.5 text-sm rounded-md bg-primary-600 hover:bg-primary-700 text-white"
                >
                  تطبيق الفلترة
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {listEnabled && isLoading && (
        <div className="py-16">
          <WifiLoaderComponent background="transparent" desktopSize="80px" mobileSize="60px" text="جاري التحميل..." />
        </div>
      )}

      {listEnabled && error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-red-700 dark:text-red-300">
          {ApiService.showError(error)}
          <button type="button" onClick={() => refetch()} className="mt-2 text-sm underline">
            إعادة المحاولة
          </button>
        </div>
      )}

      {listEnabled && !isLoading && !error && (
        <div className="wakeel-table-scroll rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="min-w-full text-right">
            <thead className="bg-gray-50 dark:bg-gray-800/80">
              <tr>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">العميل</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">الهاتف</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">الرصيد</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">المحوّل</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">الدين</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">المسدد</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">متبقي الدين</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">النوع</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">التاريخ</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[12rem]">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    لا يوجد عملاء.{isFetching ? ' جاري التحديث…' : ''}
                  </td>
                </tr>
              ) : (
                customers.map((row) => {
                  const debtRem =
                    row.debtRemaining ??
                    Math.max(0, (row.debtAmount ?? 0) - (row.debtPaid ?? 0));
                  return (
                    <tr
                      key={row.id}
                      className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50/80 dark:hover:bg-gray-800/40"
                    >
                      <td className="px-3 py-2 text-sm font-medium text-gray-900 dark:text-white">{row.customerName}</td>
                      <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">{row.phoneNumber ?? '—'}</td>
                      <td className="px-3 py-2 text-sm tabular-nums">
                        {formatNumber(row.balanceAmount ?? 0, { suffix: ' د.ع' })}
                      </td>
                      <td className="px-3 py-2 text-sm tabular-nums">
                        {formatNumber(row.transferAmount ?? 0, { suffix: ' د.ع' })}
                      </td>
                      <td className="px-3 py-2 text-sm tabular-nums">
                        {formatNumber(row.debtAmount ?? 0, { suffix: ' د.ع' })}
                      </td>
                      <td className="px-3 py-2 text-sm tabular-nums">
                        {formatNumber(row.debtPaid ?? 0, { suffix: ' د.ع' })}
                      </td>
                      <td className="px-3 py-2 text-sm tabular-nums">{formatNumber(debtRem, { suffix: ' د.ع' })}</td>
                      <td className="px-3 py-2 text-sm">
                        {CUSTOMER_TYPE_LABELS[Number(row.customerType)] ?? row.customerType}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {row.createdAt ? formatDate(row.createdAt) : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setDetailCustomerId(row.id)}
                            disabled={busy}
                            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-primary-600 dark:text-primary-400"
                            title="عرض التفاصيل والفواتير"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openCreateInvoice(row.id, row.customerName)}
                            disabled={busy}
                            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-emerald-600"
                            title="إضافة فاتورة"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditCustomer(row)}
                            disabled={busy}
                            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-amber-600"
                            title="تعديل بيانات العميل"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomer(row)}
                            disabled={busy}
                            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-red-600"
                            title="حذف العميل"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* تفاصيل العميل + الفواتير */}
      {detailCustomerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-5xl w-full max-h-[92vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Eye className="h-5 w-5" />
                تفاصيل العميل والفواتير
              </h2>
              <button
                type="button"
                onClick={() => setDetailCustomerId(null)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              {detailLoading && (
                <div className="py-8 text-center text-gray-500">
                  <WifiLoaderComponent background="transparent" desktopSize="48px" mobileSize="40px" text="" />
                </div>
              )}
              {!detailLoading && detailForModal && (
                <>
                  <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-4 bg-gray-50/80 dark:bg-gray-900/30">
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">بيانات العميل</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500">الاسم: </span>
                        <span className="font-medium">{detailForModal.customerName}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">الهاتف: </span>
                        {detailForModal.phoneNumber ?? '—'}
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-gray-500">العنوان: </span>
                        {detailForModal.address ?? '—'}
                      </div>
                      <div>
                        <span className="text-gray-500">النوع: </span>
                        {CUSTOMER_TYPE_LABELS[Number(detailForModal.customerType)] ?? detailForModal.customerType}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openCreateInvoice(detailForModal.id, detailForModal.customerName)}
                      disabled={busy}
                      className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm"
                    >
                      <Plus className="h-4 w-4" />
                      إضافة فاتورة
                    </button>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">الفواتير</h3>
                    {(detailForModal.invoices ?? []).length === 0 ? (
                      <p className="text-sm text-gray-500">لا توجد فواتير لهذا العميل بعد.</p>
                    ) : (
                      <div className="wakeel-table-scroll rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
                        <table className="min-w-full text-right text-sm">
                          <thead className="bg-gray-100 dark:bg-gray-700/80">
                            <tr>
                              <th className="px-2 py-2">الرصيد</th>
                              <th className="px-2 py-2">المحوّل</th>
                              <th className="px-2 py-2">الدين</th>
                              <th className="px-2 py-2">المسدد</th>
                              <th className="px-2 py-2">متبقي</th>
                              <th className="px-2 py-2">الدفع</th>
                              <th className="px-2 py-2">التاريخ</th>
                              <th className="px-2 py-2 min-w-[10rem]">إجراءات</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailForModal.invoices.map((inv) => {
                              const dr =
                                inv.debtRemaining ??
                                Math.max(0, (inv.debtAmount ?? 0) - (inv.debtPaid ?? 0));
                              return (
                                <tr key={inv.id} className="border-t border-gray-100 dark:border-gray-600">
                                  <td className="px-2 py-2 tabular-nums">
                                    {formatNumber(inv.balanceAmount, { suffix: ' د.ع' })}
                                  </td>
                                  <td className="px-2 py-2 tabular-nums">
                                    {formatNumber(inv.transferAmount, { suffix: ' د.ع' })}
                                  </td>
                                  <td className="px-2 py-2 tabular-nums">
                                    {formatNumber(inv.debtAmount ?? 0, { suffix: ' د.ع' })}
                                  </td>
                                  <td className="px-2 py-2 tabular-nums">
                                    {formatNumber(inv.debtPaid ?? 0, { suffix: ' د.ع' })}
                                  </td>
                                  <td className="px-2 py-2 tabular-nums">{formatNumber(dr, { suffix: ' د.ع' })}</td>
                                  <td className="px-2 py-2">
                                    {PAYMENT_METHOD_LABELS[Number(inv.paymentMethod)] ?? inv.paymentMethod}
                                  </td>
                                  <td className="px-2 py-2 whitespace-nowrap text-gray-500">
                                    {inv.createdAt ? formatDate(inv.createdAt) : '—'}
                                  </td>
                                  <td className="px-2 py-2">
                                    <div className="flex flex-wrap justify-end gap-1">
                                      <button
                                        type="button"
                                        onClick={() => openPayDebt(inv, detailForModal.customerName)}
                                        disabled={busy || dr <= 0}
                                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-violet-600 disabled:opacity-40"
                                        title="تسديد دين"
                                      >
                                        <Banknote className="h-4 w-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => sendWhatsAppMutation.mutate(inv.id)}
                                        disabled={busy || !(detailForModal.phoneNumber ?? '').trim()}
                                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-green-600 disabled:opacity-40"
                                        title="واتساب"
                                      >
                                        <MessageCircle className="h-4 w-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handlePrintInvoice(inv, {
                                            customerName: detailForModal.customerName,
                                            phoneNumber: detailForModal.phoneNumber,
                                            address: detailForModal.address,
                                            customerType: detailForModal.customerType,
                                          })
                                        }
                                        disabled={busy}
                                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700"
                                        title="طباعة"
                                      >
                                        <Printer className="h-4 w-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openEditInvoice(detailForModal.id, detailForModal.customerName, inv)
                                        }
                                        disabled={busy}
                                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-amber-600"
                                        title="تعديل"
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteInvoice(detailForModal.id, inv)}
                                        disabled={busy}
                                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-red-600"
                                        title="حذف"
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
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* عميل: إنشاء / تعديل */}
      {customerModalOpen && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {customerModalEditingId ? 'تعديل عميل' : 'عميل جديد'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setCustomerModalOpen(false);
                  setCustomerModalEditingId(null);
                  setCustomerForm(emptyCustomerForm());
                }}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={submitCustomerForm} className="p-4 space-y-3">
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">اسم العميل *</label>
                <input
                  required
                  maxLength={200}
                  value={customerForm.customerName}
                  onChange={(e) => setCustomerForm((f) => ({ ...f, customerName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">الهاتف</label>
                <input
                  maxLength={30}
                  value={customerForm.phoneNumber ?? ''}
                  onChange={(e) => setCustomerForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">العنوان</label>
                <input
                  maxLength={500}
                  value={customerForm.address ?? ''}
                  onChange={(e) => setCustomerForm((f) => ({ ...f, address: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">نوع العميل</label>
                <select
                  value={customerForm.customerType}
                  onChange={(e) =>
                    setCustomerForm((f) => ({
                      ...f,
                      customerType: Number(e.target.value) as CustomerInvoiceCustomerType,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                >
                  <option value={CustomerInvoiceCustomerType.NewCustomer}>{CUSTOMER_TYPE_LABELS[0]}</option>
                  <option value={CustomerInvoiceCustomerType.Agent}>{CUSTOMER_TYPE_LABELS[1]}</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setCustomerModalOpen(false);
                    setCustomerModalEditingId(null);
                    setCustomerForm(emptyCustomerForm());
                  }}
                  className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-md bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50"
                >
                  {busy ? 'جاري الحفظ...' : customerModalEditingId ? 'حفظ التعديل' : 'حفظ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* فاتورة: إنشاء / تعديل */}
      {invoiceModalOpen && invoiceModalCustomerId && (
        <div className="fixed inset-0 z-[56] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                {invoiceEditingId ? 'تعديل فاتورة' : 'فاتورة جديدة'} — {invoiceModalCustomerName}
              </h2>
              <button type="button" onClick={closeInvoiceModal} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={submitInvoiceForm} className="p-4 space-y-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                يُحسب مبلغ الدين تلقائياً: مبلغ الرصيد − مبلغ التحويل. لا يجوز أن يتجاوز التحويل الرصيد.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">مبلغ الرصيد *</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={invoiceForm.balanceAmount}
                    onChange={(e) => setInvoiceForm((f) => ({ ...f, balanceAmount: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">مبلغ التحويل *</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={invoiceForm.transferAmount}
                    onChange={(e) => setInvoiceForm((f) => ({ ...f, transferAmount: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white font-mono"
                  />
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40 px-3 py-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-gray-600 dark:text-gray-400">الدين المحسوب (رصيد − تحويل)</span>
                  <span className="font-mono tabular-nums">{formatNumber(invoiceDebtPreview, { suffix: ' د.ع' })}</span>
                </div>
                {invoiceEditingId && (
                  <div className="flex justify-between gap-2 mt-1">
                    <span className="text-gray-600 dark:text-gray-400">المسدد حالياً</span>
                    <span className="font-mono tabular-nums">
                      {formatNumber(invoiceEditingDebtPaid, { suffix: ' د.ع' })}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">طريقة الدفع</label>
                <select
                  value={invoiceForm.paymentMethod}
                  onChange={(e) =>
                    setInvoiceForm((f) => ({
                      ...f,
                      paymentMethod: Number(e.target.value) as CustomerInvoicePaymentMethod,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                >
                  <option value={CustomerInvoicePaymentMethod.Cash}>{PAYMENT_METHOD_LABELS[0]}</option>
                  <option value={CustomerInvoicePaymentMethod.MasterCard}>{PAYMENT_METHOD_LABELS[1]}</option>
                  <option value={CustomerInvoicePaymentMethod.ZainCash}>{PAYMENT_METHOD_LABELS[2]}</option>
                  <option value={CustomerInvoicePaymentMethod.Other}>{PAYMENT_METHOD_LABELS[3]}</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeInvoiceModal}
                  className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-md bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50"
                >
                  {busy ? 'جاري الحفظ...' : invoiceEditingId ? 'حفظ التعديل' : 'حفظ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {payDebtRow && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white inline-flex items-center gap-2">
                <Banknote className="h-5 w-5 text-violet-600" />
                تسديد دين
              </h2>
              <button
                type="button"
                onClick={() => {
                  setPayDebtRow(null);
                  setPayDebtCustomerName('');
                  setPayDebtAmountStr('');
                }}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={submitPayDebt} className="p-4 space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                العميل: <strong className="text-gray-900 dark:text-white">{payDebtCustomerName}</strong>
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                المتبقي:{' '}
                <span className="font-mono tabular-nums">
                  {formatNumber(
                    payDebtRow.debtRemaining ??
                      Math.max(0, (payDebtRow.debtAmount ?? 0) - (payDebtRow.debtPaid ?? 0)),
                    { suffix: ' د.ع' }
                  )}
                </span>
              </p>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">المبلغ المراد تسديده</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  autoFocus
                  value={payDebtAmountStr}
                  onChange={(e) => setPayDebtAmountStr(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setPayDebtRow(null);
                    setPayDebtCustomerName('');
                    setPayDebtAmountStr('');
                  }}
                  className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={payDebtMutation.isPending}
                  className="px-4 py-2 rounded-md bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50"
                >
                  {payDebtMutation.isPending ? 'جاري التسديد...' : 'تأكيد التسديد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerInvoicesPage;
