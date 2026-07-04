import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useOffline } from '../contexts/OfflineContext';
import { useDigits } from '../contexts/DigitsContext';
import { useConfirmation } from '../contexts/ConfirmationContext';
import { apiService, ApiService } from '../services/api';
import { fetchReceiptsWithCache } from '../services/offlineSync';
import { showSuccess, showError } from '../utils/notifications';
import {
  buildRegionResellerFilterParams,
} from '../utils/operationalFilters';
import { RenewalReceipt, UserRole } from '../types';
import { hasPageAction } from '../utils/employeePermissions';
import { WakeelBadge } from '../components/table/WakeelBadge';
import { formatReceiptPrintDate, resolveReceiptPrintAmounts } from '../utils/receiptPrint';
import {
  getCombinedPaymentPaid,
  getServiceFeesReceivedAmount,
  getSubscriptionReceivedAmount,
} from '../utils/renewalReceiptDisplay';
import PageSearchDateFilterBar from '../components/filters/PageSearchDateFilterBar';
import OperationalFiltersSidebar from '../components/filters/OperationalFiltersSidebar';
import ListPageWithFilters from '../components/layout/ListPageWithFilters';
import Pagination from '../components/Pagination';
import { STANDARD_PAGE_SIZE_OPTIONS } from '../constants/pagination';
import { useOperationalFilters } from '../hooks/useOperationalFilters';
import QRCode from 'qrcode';
import WifiLoaderComponent from '../components/WifiLoaderComponent';
import { 
  Receipt,
  User,
  Eye,
  Printer,
  X,
  FileSpreadsheet,
  Zap,
  Trash2,
} from 'lucide-react';

const ReceiptsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { online } = useOffline();
  const { formatNumber, formatDate, locale } = useDigits();
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('');
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<RenewalReceipt | null>(null);
  const [showDropdown, setShowDropdown] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [appliedFromDate, setAppliedFromDate] = useState('');
  const [appliedToDate, setAppliedToDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { confirmAction } = useConfirmation();

  const isAgentOrSubAgentOrEmployee =
    user?.role === UserRole.Agent || user?.role === UserRole.SubAgent || user?.role === UserRole.Employee;

  const {
    myRegions,
    myResellers,
    filteredOperationalResellers,
    selectedOperationalRegionId,
    selectedOperationalResellerId,
    handleRegionSelect,
    handleResellerSelect,
    showOperationalFilters,
  } = useOperationalFilters(isAuthenticated && !!isAgentOrSubAgentOrEmployee, () => setCurrentPage(1));

  const canDeleteRenewal =
    user?.role === UserRole.Admin ||
    user?.role === UserRole.Agent ||
    user?.role === UserRole.SubAgent ||
    hasPageAction(user, 'Activations', 'delete');

  const deleteRenewalMutation = useMutation({
    mutationFn: (renewalId: string) => apiService.deleteRenewal(renewalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['renewal-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['subscribers'] });
      queryClient.invalidateQueries({ queryKey: ['subscribers-dashboard'] });
      showSuccess('تم الحذف', 'تم حذف التفعيل بنجاح');
    },
    onError: (err: unknown) => {
      showError('فشل الحذف', ApiService.showError(err));
    },
  });

  const handleDeleteRenewal = async (receipt: RenewalReceipt) => {
    const renewalId = receipt.renewalId || receipt.id;
    if (!renewalId) {
      showError('خطأ', 'معرف التفعيل غير متوفر');
      return;
    }
    const ok = await confirmAction(
      'حذف التفعيل',
      `هل تريد حذف تفعيل ${receipt.subscriberName || receipt.receiptNumber || renewalId}؟ لا يمكن التراجع.`
    );
    if (!ok) return;
    deleteRenewalMutation.mutate(renewalId);
  };

  const { data: receiptsData, error, isLoading } = useQuery<{ receipts: RenewalReceipt[], pagination: any }>({
    queryKey: [
      'renewal-receipts',
      'offline',
      online,
      currentPage,
      pageSize,
      appliedFromDate || null,
      appliedToDate || null,
      appliedSearchTerm || null,
      selectedOperationalRegionId || null,
      selectedOperationalResellerId || null,
    ],
    queryFn: async () => {
      const regionResellerFilter = buildRegionResellerFilterParams(
        selectedOperationalRegionId,
        selectedOperationalResellerId,
        myResellers
      );
      const data = await fetchReceiptsWithCache(
        online,
        currentPage,
        pageSize,
        appliedFromDate || undefined,
        appliedToDate || undefined,
        regionResellerFilter.resellerId,
        regionResellerFilter.regionId,
        appliedSearchTerm || undefined
      );
      if (data.pagination) {
        setTotalItems(data.pagination.totalItems ?? 0);
        setTotalPages(data.pagination.totalPages ?? 0);
        setCurrentPage(data.pagination.currentPage ?? 1);
      }
      return data;
    },
    enabled: isAuthenticated,
    retry: 1,
    refetchOnWindowFocus: false
  });

  // استخراج الفواتير من البيانات
  const receipts = useMemo(() => receiptsData?.receipts || [], [receiptsData?.receipts]);

  // تسجيل حالة المصادقة
  useEffect(() => {
    console.log('ReceiptsPage mounted');
    console.log('isAuthenticated:', isAuthenticated);
    console.log('user:', user);
    console.log('token:', localStorage.getItem('token'));
  }, [isAuthenticated, user]);

  // استخدام useEffect للتعامل مع النجاح والفشل
  useEffect(() => {
    if (receipts) {
      console.log('Receipts loaded:', receipts);
    }
  }, [receipts]);

  useEffect(() => {
    if (error) {
      console.error('Error loading receipts:', error);
      
      // التحقق من خطأ المصادقة
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any;
        if (axiosError.response?.status === 401) {
          console.error('Authentication failed - user needs to login');
          // يمكن إضافة إشعار للمستخدم هنا
        }
      }
    }
  }, [error]);

  // إذا لم يكن المستخدم مسجل الدخول، إظهار رسالة
  if (!isAuthenticated) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <User className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">يرجى تسجيل الدخول</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            يجب تسجيل الدخول لعرض التفعيلات
          </p>
          <button
            onClick={() => navigate('/login')}
            className="mt-4 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors"
          >
            تسجيل الدخول
          </button>
        </div>
      </div>
    );
  }

  const handleApplyFilters = () => {
    setAppliedFromDate(fromDate);
    setAppliedToDate(toDate);
    setAppliedSearchTerm(searchTerm.trim());
    setCurrentPage(1);
  };

  /** يفرّغ حقول البحث والتواريخ */
  const handleClearFilters = () => {
    setSearchTerm('');
    setAppliedSearchTerm('');
    setFromDate('');
    setToDate('');
    setAppliedFromDate('');
    setAppliedToDate('');
    setCurrentPage(1);
  };

  const getCombinedPaymentStatusBadge = (receipt: RenewalReceipt) => {
    const paid = getCombinedPaymentPaid(receipt);
    return (
      <WakeelBadge color={paid ? 'success' : 'error'}>
        {paid ? 'مدفوع' : 'غير مدفوع'}
      </WakeelBadge>
    );
  };



  const _handleViewReceipt = (receipt: RenewalReceipt) => {
    setSelectedReceipt(receipt);
    setShowReceiptModal(true);
    setShowDropdown(null);
  };
  void _handleViewReceipt;

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
    } catch (error) {
      console.error('Error generating QR Code:', error);
      return '';
    }
  };

  const handlePrintReceipt = async (receipt: RenewalReceipt) => {
    setSelectedReceipt(receipt);
    setTimeout(async () => {
      // إنشاء نافذة طباعة جديدة
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      // إنشاء QR Code
      let qrCodeHtml = '';
      if (receipt.wiFiQRCode || receipt.wiFiCode) {
        let wifiString = '';
        if (receipt.wiFiQRCode) {
          wifiString = `WIFI:T:${receipt.wiFiQRCode.encryption === 0 ? 'WPA' : receipt.wiFiQRCode.encryption === 1 ? 'WEP' : 'nopass'};S:${receipt.wiFiQRCode.ssid};P:${receipt.wiFiQRCode.password};H:${receipt.wiFiQRCode.isHidden ? 'true' : 'false'};;`;
        } else {
          wifiString = receipt.wiFiCode || '';
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
                ` : `<div>${receipt.wiFiCode}</div>`}
              </div>
            </div>
          </div>
        `;
      }

      const printAmounts = resolveReceiptPrintAmounts(receipt);
      const printDate = formatReceiptPrintDate(
        locale,
        receipt.renewalDate || receipt.issueDate || receipt.createdAt
      );

      const printContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>فاتورة التفعيل - ${receipt.receiptNumber}</title>
          <style>
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
            .info-row { display: flex; justify-content: space-between; margin: 0.5mm 0; padding: 0; font-size: 6px; }
            .info-row:nth-child(even) { background: #f5f5f5; }
            .label { font-weight: bold; }
            .value { text-align: left; }
            .pricing { background: #eee; padding: 1.5mm; border-radius: 1px; margin: 1.5mm 0; }
            .pricing .info-row { margin: 0.3mm 0; }
            .footer { text-align: center; margin-top: 2mm; padding-top: 1mm; border-top: 1px solid #ddd; font-size: 5px; }
            .footer p { margin: 0.5px 0; }
            .qrcode-block { text-align: center; margin: 1.5mm 0; }
            .qrcode-title { font-size: 6px; margin-bottom: 0.5mm; font-weight: bold; }
            .qrcode-wrap { display: inline-block; padding: 1mm; border: 1px solid #ddd; }
            .qrcode-img { width: 22mm; height: 22mm; display: block; }
            .qrcode-placeholder { width: 22mm; height: 22mm; background: #f0f0f0; display: flex; align-items: center; justify-content: center; font-size: 6px; }
            .qrcode-info { margin-top: 0.5mm; font-size: 5px; }
            .qrcode-info div { margin: 0; }
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
              .qrcode-img { width: 20mm; height: 20mm; }
              .qrcode-placeholder { width: 20mm; height: 20mm; }
              .qrcode-info { font-size: 4px; }
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <h1>فاتورة التفعيل</h1>
              <p><strong>رقم الفاتورة:</strong> ${receipt.receiptNumber}</p>
              <p><strong>التاريخ:</strong> ${printDate}</p>
            </div>

            <div class="section">
              <h3>معلومات المشترك</h3>
              <div class="info-row">
                <span class="label">اسم المشترك:</span>
                <span class="value">${receipt.subscriberName}</span>
              </div>
              <div class="info-row">
                <span class="label">رقم الهاتف:</span>
                <span class="value">${receipt.subscriberPhone}</span>
              </div>
              <div class="info-row">
                <span class="label">الباقة:</span>
                <span class="value">${receipt.newProfileName || receipt.profileName}</span>
              </div>
            </div>

            ${qrCodeHtml}

            <div class="pricing">
              <h3>التفاصيل المالية</h3>
              ${receipt.discountAmount > 0 ? `
              <div class="info-row">
                <span class="label">الخصم:</span>
                <span class="value" style="color: red;">-${formatNumber(receipt.discountAmount, { suffix: ' د.ع' })} (${receipt.discountPercent.toFixed(1)}%)</span>
              </div>
              ` : ''}
              <div class="info-row">
                <span class="label">سعر الاشتراك:</span>
                <span class="value">${formatNumber(printAmounts.subscriptionPrice, { suffix: ' د.ع' })}</span>
              </div>
              <div class="info-row">
                <span class="label">المبلغ الواصل:</span>
                <span class="value" style="color: green;">${formatNumber(printAmounts.amountPaid, { suffix: ' د.ع' })}</span>
              </div>
              <div class="info-row">
                <span class="label">دين الاشتراك:</span>
                <span class="value" style="color: red;">${formatNumber(printAmounts.debt, { suffix: ' د.ع' })}</span>
              </div>
            </div>

            ${receipt.notes ? `
            <div class="section">
              <h3>ملاحظات</h3>
              <p style="background: #e8f4fc; padding: 1mm; margin: 0; font-size: 5px;">${receipt.notes}</p>
            </div>
            ` : ''}
          </div>

        </body>
        </html>
      `;

      printWindow.document.write(printContent);
      printWindow.document.close();

      // انتظار تحميل المحتوى ثم الطباعة
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 500);
      };
    }, 100);
    setShowDropdown(null);
  };


  const handleRefreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['renewal-receipts'] });
  };

  // دالة لطباعة الفاتورة كـ PDF من الفرونت إند
  const handlePrintReceiptPDF = async (receiptId: string) => {
    try {
      console.log('Printing PDF for receipt ID:', receiptId);
      
      // البحث عن الفاتورة في البيانات المحملة
      const receipt = receipts?.find(r => r.id === receiptId);
      if (!receipt) {
        alert('لم يتم العثور على الفاتورة المطلوبة');
        return;
      }
      
      // استخدام نفس دالة الطباعة العادية
      await handlePrintReceipt(receipt);
      
    } catch (error: any) {
      console.error('Error printing PDF:', error);
      const errorMessage = ApiService.showError(error);
      alert(errorMessage);
    }
  };

  // دالة لتصدير الفواتير إلى Excel
  const handleExportToExcel = async () => {
    try {
      setIsExporting(true);
      console.log('Exporting receipts to Excel...');
      
      // استخدام apiService لتصدير البيانات
      const regionResellerFilter = buildRegionResellerFilterParams(
        selectedOperationalRegionId,
        selectedOperationalResellerId,
        myResellers
      );
      const blob = await apiService.exportReceiptsToExcel(
        appliedFromDate || undefined,
        appliedToDate || undefined,
        regionResellerFilter.resellerId,
        regionResellerFilter.regionId
      );
      
      // إنشاء رابط تحميل للملف
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // تحديد اسم الملف
      const fileName = `تفعيلات_${appliedFromDate || 'all'}_${appliedToDate || 'all'}.xlsx`;
      link.download = fileName;
      
      // إضافة الرابط إلى الصفحة وتشغيله
      document.body.appendChild(link);
      link.click();
      
      // تنظيف الرابط
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      // إظهار رسالة نجاح
      alert('تم تحميل ملف Excel بنجاح');
      
    } catch (error: any) {
      console.error('Error exporting to Excel:', error);
      const errorMessage = ApiService.showError(error);
      alert(errorMessage);
      
      if (error.status === 401) {
        navigate('/login');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1); // العودة إلى الصفحة الأولى عند تغيير حجم الصفحة
  };

  const _handleTestData = () => {
  };
  void _handleTestData;

  const handleLoginRedirect = () => {
    // حذف الـ token القديم وإعادة التوجيه إلى صفحة تسجيل الدخول
    localStorage.removeItem('token');
    navigate('/login');
  };

  const _testDirectAPI = async () => {
    try {
      console.log('Testing direct API call...');
      console.log('Current user:', user);
      console.log('User role:', user?.role);
      console.log('API base URL:', apiService.getBaseURL());
      
      const data = await apiService.getRenewalReceipts(currentPage, pageSize);
      console.log('Direct API response:', data);
      console.log('Response type:', typeof data);
      console.log('Receipts:', data.receipts);
      console.log('Pagination:', data.pagination);
      
      if (data.receipts && data.receipts.length > 0) {
        console.log('First receipt:', data.receipts[0]);
        alert(`تم جلب ${data.receipts.length} فاتورة بنجاح\nأول فاتورة: ${data.receipts[0].receiptNumber}\nإجمالي الفواتير: ${data.pagination.totalItems}\nالصفحة الحالية: ${data.pagination.currentPage}/${data.pagination.totalPages}`);
      } else {
        alert(`تم جلب البيانات بنجاح لكن لا توجد فواتير\nالسبب المحتمل:\n1. لا توجد فواتير في النظام\n2. المستخدم غير مخول لعرض الفواتير\n3. مشكلة في الصلاحيات`);
      }
    } catch (error: any) {
      console.error('Direct API error:', error);
      const errorMessage = ApiService.showError(error);
      alert(`خطأ في API: ${errorMessage}`);
    }
  };
  void _testDirectAPI;

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <Receipt className="h-5 w-5 text-red-400" />
            </div>
            <div className="mr-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                خطأ في تحميل البيانات
              </h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                <p>حدث خطأ أثناء تحميل التفعيلات.</p>
              </div>
            </div>
          </div>
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
          text="تحميل التفعيلات..."
          backColor="#E8F2FC"
          frontColor="#4645F6"
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
            <Zap className="h-8 w-8 shrink-0 text-primary-600 dark:text-primary-400" aria-hidden />
            التفعيلات
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            عرض وإدارة سجلات تفعيل المشتركين
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportToExcel}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                <span>جاري التصدير...</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-4 w-4" />
                <span>تصدير Excel</span>
              </>
            )}
          </button>
        </div>
      </div>

      <ListPageWithFilters
        sidebar={
          showOperationalFilters ? (
            <OperationalFiltersSidebar
              regions={myRegions}
              resellers={filteredOperationalResellers}
              selectedRegionId={selectedOperationalRegionId}
              selectedResellerId={selectedOperationalResellerId}
              onRegionSelect={handleRegionSelect}
              onResellerSelect={handleResellerSelect}
            />
          ) : undefined
        }
      >
        <PageSearchDateFilterBar
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          searchPlaceholder="رقم الفاتورة، اسم المشترك، يوزر، أو رقم الهاتف"
          fromDate={fromDate}
          toDate={toDate}
          onFromDateChange={setFromDate}
          onToDateChange={setToDate}
          onApply={handleApplyFilters}
          onClear={handleClearFilters}
        />

        {/* Table */}
        <div className="wakeel-table-card">
        <div className="wakeel-table-scroll">
          <table className="min-w-[1200px] w-full text-right">
            <thead>
              <tr>
                <th>رقم الفاتورة</th>
                <th>اسم المشترك</th>
                <th>الباقة</th>
                <th>المبلغ الواصل</th>
                <th>مبلغ الأجر الواصل</th>
                <th>حالة الدفع</th>
                <th>تاريخ التفعيل</th>
                <th>تاريخ طباعة الفاتورة</th>
                <th>بواسطة الموظف</th>
                <th className="w-[1%]">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((receipt) => {
                const profileChanged =
                  receipt.oldProfileName &&
                  receipt.newProfileName &&
                  receipt.oldProfileName !== receipt.newProfileName;

                return (
                  <tr key={receipt.id}>
                    <td className="whitespace-nowrap font-medium">{receipt.receiptNumber || '—'}</td>
                    <td className="whitespace-nowrap">{receipt.subscriberName || '—'}</td>
                    <td>
                      <div className="text-sm font-medium">{receipt.newProfileName || '—'}</div>
                      {profileChanged && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          من: {receipt.oldProfileName}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap font-medium">
                      {formatNumber(getSubscriptionReceivedAmount(receipt), { suffix: ' د.ع' })}
                    </td>
                    <td className="whitespace-nowrap font-medium">
                      {formatNumber(getServiceFeesReceivedAmount(receipt), { suffix: ' د.ع' })}
                    </td>
                    <td className="whitespace-nowrap">
                      {getCombinedPaymentStatusBadge(receipt)}
                    </td>
                    <td className="whitespace-nowrap">
                      {formatDate(receipt.renewalDate || receipt.createdAt)}
                    </td>
                    <td className="whitespace-nowrap">
                      {receipt.receiptIssueDate
                        ? formatDate(receipt.receiptIssueDate)
                        : receipt.issueDate
                          ? formatDate(receipt.issueDate)
                          : '—'}
                    </td>
                    <td className="whitespace-nowrap">{receipt.performedByFullName || '—'}</td>
                    <td className="whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedReceipt(receipt)}
                          className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300"
                          title="عرض التفاصيل"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePrintReceiptPDF(receipt.id)}
                          className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                          title="طباعة الفاتورة"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                        {canDeleteRenewal && (
                          <button
                            type="button"
                            onClick={() => handleDeleteRenewal(receipt)}
                            disabled={deleteRenewalMutation.isPending}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                            title="حذف التفعيل"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {receipts.length === 0 && (
          <div className="text-center py-12">
            <Receipt className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">لا توجد تفعيلات</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              لم يتم العثور على تفعيلات تطابق معايير البحث.
            </p>
            {error && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <p className="text-sm text-red-700 dark:text-red-300">
                  خطأ في تحميل البيانات: {String(error)}
                </p>
                {error && typeof error === 'object' && 'response' in error && (error as any).response?.status === 401 && (
                  <div className="mt-2 p-2 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded">
                    <p className="text-xs text-yellow-800 dark:text-yellow-200">
                      ⚠️ خطأ في المصادقة: يرجى تسجيل الدخول مرة أخرى
                    </p>
                    <button
                      onClick={handleLoginRedirect}
                      className="mt-2 px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded transition-colors"
                    >
                      تسجيل الدخول
                    </button>
                  </div>
                )}
              </div>
            )}
            {!isLoading && !error && receipts && Array.isArray(receipts) && receipts.length === 0 && (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  لا توجد تفعيلات في النظام بعد.
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  البيانات تم تحميلها بنجاح من الباكند، لكن لا توجد تفعيلات مسجّلة حالياً.
                </p>
                <button
                  onClick={handleRefreshData}
                  className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
                >
                  إعادة تحميل البيانات
                </button>
              </div>
            )}
            {!isLoading && !error && (!receipts || !Array.isArray(receipts)) && (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  البيانات غير محملة بعد. تحقق من وحدة التحكم للمزيد من التفاصيل.
                </p>
                <button
                  onClick={handleRefreshData}
                  className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
                >
                  إعادة تحميل البيانات
                </button>
              </div>
            )}
          </div>
        )}

        </div>

        {totalItems > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            hasNextPage={currentPage < totalPages}
            hasPreviousPage={currentPage > 1}
            onPageChange={handlePageChange}
            pageSizeOptions={[...STANDARD_PAGE_SIZE_OPTIONS]}
            onPageSizeChange={handlePageSizeChange}
            className="mt-4"
          />
        )}
      </ListPageWithFilters>
      {showReceiptModal && selectedReceipt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6 no-print">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  فاتورة التفعيل
                </h2>
                <button
                  onClick={() => setShowReceiptModal(false)}
                  className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
              
              <div ref={printRef} className="space-y-4">
                {/* Receipt Title */}
                <div className="text-center mb-4">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    فاتورة التفعيل
                  </h2>
                </div>

                {/* Receipt Header */}
                <div className="text-center border-b border-gray-200 dark:border-gray-700 pb-4">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {selectedReceipt.receiptNumber}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(selectedReceipt.renewalDate || selectedReceipt.issueDate || selectedReceipt.createdAt)} - {new Date(selectedReceipt.renewalDate || selectedReceipt.issueDate || selectedReceipt.createdAt).toLocaleTimeString(locale)}
                  </p>
                </div>

                {/* Subscriber Info */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">المشترك:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{selectedReceipt.subscriberName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">رقم الهاتف:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{selectedReceipt.subscriberPhone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">الباقة:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{selectedReceipt.newProfileName || selectedReceipt.profileName || 'العادي'}</span>
                  </div>
                </div>

                {/* Pricing Details */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between font-bold text-lg border-t border-gray-200 dark:border-gray-600 pt-2">
                    <span className="text-gray-900 dark:text-white">سعر الاشتراك:</span>
                    <span className="text-primary-600 dark:text-primary-400">{formatNumber(selectedReceipt.newProfileSalePrice || selectedReceipt.finalPrice || 0, { suffix: ' د.ع' })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">المبلغ الواصل:</span>
                    <span className="text-green-600 dark:text-green-400">{formatNumber(selectedReceipt.amountPaid || selectedReceipt.finalPrice || 0, { suffix: ' د.ع' })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">دين الاشتراك:</span>
                    <span className="text-red-600 dark:text-red-400">{formatNumber(selectedReceipt.remainingAmount || 0, { suffix: ' د.ع' })}</span>
                  </div>
                  {(selectedReceipt.serviceFeesName || selectedReceipt.serviceFeesId) && (
                    <div className="border-t border-gray-200 dark:border-gray-600 pt-2 mt-2 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">أجور الخدمة:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{selectedReceipt.serviceFeesName || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">سعر الخدمة:</span>
                        <span className="text-primary-600 dark:text-primary-400">{formatNumber(selectedReceipt.serviceFeesPrice || 0, { suffix: ' د.ع' })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">الواصل (خدمة):</span>
                        <span className="text-green-600 dark:text-green-400">{formatNumber(selectedReceipt.serviceFeesAmountPaid || 0, { suffix: ' د.ع' })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">دين أجور الخدمة:</span>
                        <span className="text-red-600 dark:text-red-400">{formatNumber(selectedReceipt.serviceFeesRemainingAmount || 0, { suffix: ' د.ع' })}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Renewal Details */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">تاريخ الانتهاء الجديد:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {selectedReceipt.newExpirationDate ? formatDate(selectedReceipt.newExpirationDate) : formatDate(new Date(new Date(selectedReceipt.renewalDate || selectedReceipt.issueDate || selectedReceipt.createdAt).getTime() + (selectedReceipt.renewalDays || selectedReceipt.renewalPeriod || 30) * 24 * 60 * 60 * 1000))}
                    </span>
                  </div>
                  {(selectedReceipt.wiFiCode || selectedReceipt.subscriberWiFiCode) && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">رمز الشبكة:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{selectedReceipt.wiFiCode || selectedReceipt.subscriberWiFiCode}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">ملاحظات الدين:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{selectedReceipt.remainingAmount > 0 ? `متبقي ${formatNumber(selectedReceipt.remainingAmount, { suffix: ' د.ع' })}` : 'لا يوجد دين'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">حالة الدفع:</span>
                    <span className={`font-medium ${
                      selectedReceipt.paymentStatus === 1 ? 'text-green-600 dark:text-green-400' :
                      selectedReceipt.paymentStatus === 2 ? 'text-red-600 dark:text-red-400' :
                      'text-yellow-600 dark:text-yellow-400'
                    }`}>
                      {selectedReceipt.paymentStatus === 1 ? 'مدفوع' :
                       selectedReceipt.paymentStatus === 2 ? 'غير مدفوع' : 'معلق'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 no-print">
                <button
                  onClick={() => setShowReceiptModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  إغلاق
                </button>
                <button
                  onClick={() => handlePrintReceiptPDF(selectedReceipt.id)}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
                >
                  <Printer className="h-4 w-4" />
                  <span>طباعة</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Close dropdown when clicking outside */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowDropdown(null)}
        />
      )}

    </div>
  );
};

export default ReceiptsPage;