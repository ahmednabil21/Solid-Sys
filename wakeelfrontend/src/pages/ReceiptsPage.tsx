import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useOffline } from '../contexts/OfflineContext';
import { useDigits } from '../contexts/DigitsContext';
import { apiService, ApiService } from '../services/api';
import { fetchReceiptsWithCache } from '../services/offlineSync';
import {
  buildRegionResellerFilterParams,
  filterResellersByRegion,
  loadStoredOperationalRegionId,
  loadStoredOperationalResellerId,
  saveStoredOperationalRegionId,
  saveStoredOperationalResellerId,
} from '../utils/operationalFilters';
import { RenewalReceipt, PaymentStatus, ActivationType, AgentReseller, AgentRegion, UserRole } from '../types';
import { WakeelBadge } from '../components/table/WakeelBadge';
import QRCode from 'qrcode';
import WifiLoaderComponent from '../components/WifiLoaderComponent';
import { 
  Search, 
  Receipt,
  User,
  Eye,
  Printer,
  X,
  FileSpreadsheet,
  Zap,
  SlidersHorizontal,
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
  const [showAdvancedFiltersModal, setShowAdvancedFiltersModal] = useState(false);
  const [selectedOperationalRegionId, setSelectedOperationalRegionId] = useState<string>('');
  const [selectedOperationalResellerId, setSelectedOperationalResellerId] = useState<string>('');
  const printRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const isAgentOrSubAgentOrEmployee =
    user?.role === UserRole.Agent || user?.role === UserRole.SubAgent || user?.role === UserRole.Employee;

  const { data: myResellers = [] } = useQuery<AgentReseller[]>({
    queryKey: ['myResellers'],
    queryFn: () => apiService.getMyResellers(),
    enabled: isAuthenticated && !!isAgentOrSubAgentOrEmployee,
    retry: false,
  });
  const { data: myRegions = [] } = useQuery<AgentRegion[]>({
    queryKey: ['myRegions'],
    queryFn: () => apiService.getMyRegions(true),
    enabled: isAuthenticated && !!isAgentOrSubAgentOrEmployee,
    retry: false,
  });

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

  const filteredOperationalResellers = useMemo(
    () => filterResellersByRegion(myResellers, selectedOperationalRegionId),
    [myResellers, selectedOperationalRegionId]
  );

  const handleRegionCardClick = (regionId: string) => {
    const next = selectedOperationalRegionId === regionId ? '' : regionId;
    setSelectedOperationalRegionId(next);
    saveStoredOperationalRegionId(next);
    setSelectedOperationalResellerId('');
    saveStoredOperationalResellerId('');
    setCurrentPage(1);
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
    setCurrentPage(1);
  };

  const filterGlassCardBase =
    'rounded-2xl border px-3 py-2.5 text-right transition-all duration-300 min-h-[44px] backdrop-blur-xl backdrop-saturate-150 shadow-sm hover:-translate-y-0.5';
  const filterGlassCardInactive =
    'bg-white/30 dark:bg-white/5 border-white/50 dark:border-white/10 text-gray-800 dark:text-gray-100 hover:bg-white/40 dark:hover:bg-white/10 hover:shadow-md';
  const filterGlassCardRegionActive =
    'bg-primary-500/25 dark:bg-primary-500/15 border-primary-400/60 text-primary-900 dark:text-primary-100 ring-1 ring-primary-400/40 shadow-md';
  const filterGlassCardResellerActive =
    'bg-emerald-500/25 dark:bg-emerald-500/15 border-emerald-400/60 text-emerald-900 dark:text-emerald-100 ring-1 ring-emerald-400/40 shadow-md';

  const { data: receiptsData, error, isLoading } = useQuery<{ receipts: RenewalReceipt[], pagination: any }>({
    queryKey: [
      'renewal-receipts',
      'offline',
      online,
      currentPage,
      pageSize,
      appliedFromDate || null,
      appliedToDate || null,
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
        regionResellerFilter.regionId
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

  const filteredReceipts = Array.isArray(receipts) ? receipts.filter(receipt => {
    const name = receipt.subscriberName ?? '';
    const username = receipt.subscriberUsername ?? '';
    const number = receipt.receiptNumber ?? '';
    const phone = receipt.subscriberPhone ?? '';
    const term = appliedSearchTerm.toLowerCase();
    const matchesSearch = name.toLowerCase().includes(term) ||
                         username.toLowerCase().includes(term) ||
                         number.toLowerCase().includes(term) ||
                         phone.includes(appliedSearchTerm);

    return matchesSearch;
  }) : [];

  /** يطبّق نطاق التاريخ والبحث معاً */
  const handleApplyFilters = () => {
    setAppliedFromDate(fromDate);
    setAppliedToDate(toDate);
    setAppliedSearchTerm(searchTerm.trim());
    setCurrentPage(1);
    setShowAdvancedFiltersModal(false);
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

  const renderAdvancedFiltersForm = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">بحث</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="رقم الفاتورة، اسم المشترك، يوزر، أو رقم الهاتف"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">من تاريخ</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">إلى تاريخ</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm"
          />
        </div>
      </div>
    </div>
  );

  console.log('Receipts:', receipts);
  console.log('Filtered receipts:', filteredReceipts);



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
              <p><strong>التاريخ:</strong> ${formatDate(receipt.renewalDate || receipt.issueDate || receipt.createdAt)} - ${new Date(receipt.renewalDate || receipt.issueDate || receipt.createdAt).toLocaleTimeString(locale)}</p>
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

            <div class="section">
              <h3>تفاصيل التفعيل</h3>
              <div class="info-row">
                <span class="label">تاريخ الانتهاء الجديد:</span>
                <span class="value">${receipt.newExpirationDate ? formatDate(receipt.newExpirationDate) : formatDate(new Date(new Date(receipt.renewalDate || receipt.issueDate || receipt.createdAt).getTime() + (receipt.renewalDays || receipt.renewalPeriod || 30) * 24 * 60 * 60 * 1000))}</span>
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
                <span class="value">${formatNumber(receipt.finalPrice || receipt.amount || 0, { suffix: ' د.ع' })}</span>
              </div>
              <div class="info-row">
                <span class="label">المبلغ الواصل:</span>
                <span class="value" style="color: green;">${formatNumber(receipt.amountPaid || receipt.amount || 0, { suffix: ' د.ع' })}</span>
              </div>
              <div class="info-row">
                <span class="label">مبلغ الدين:</span>
                <span class="value" style="color: red;">${formatNumber(receipt.remainingAmount || 0, { suffix: ' د.ع' })}</span>
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

  const getPaymentStatusBadge = (status: PaymentStatus) => {
    const statusConfig = {
      [PaymentStatus.Paid]: { text: 'مدفوع', color: 'success' as const },
      [PaymentStatus.Unpaid]: { text: 'غير مدفوع', color: 'error' as const },
      [PaymentStatus.Pending]: { text: 'معلق', color: 'warning' as const },
      [PaymentStatus.Unknown]: { text: 'غير محدد', color: 'gray' as const },
    };
    const config = statusConfig[status] ?? statusConfig[PaymentStatus.Unknown];
    return <WakeelBadge color={config.color}>{config.text}</WakeelBadge>;
  };

  const getActivationTypeBadge = (type?: ActivationType) => {
    if (type === ActivationType.Extension) {
      return <WakeelBadge color="warning">تمديد</WakeelBadge>;
    }
    return <WakeelBadge color="primary">اشتراك</WakeelBadge>;
  };

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
            onClick={() => setShowAdvancedFiltersModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md text-sm backdrop-blur-sm"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span>الفلترة المتقدمة</span>
          </button>
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

      {isAgentOrSubAgentOrEmployee && (myRegions.length > 0 || myResellers.length > 0) && (
        <div className="mb-4 space-y-3">
          {myRegions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">المناطق</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => handleRegionCardClick('')}
                  className={`${filterGlassCardBase} ${
                    !selectedOperationalRegionId ? filterGlassCardRegionActive : filterGlassCardInactive
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
                      onClick={() => handleRegionCardClick(region.id)}
                      className={`${filterGlassCardBase} ${
                        active ? filterGlassCardRegionActive : filterGlassCardInactive
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
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => handleResellerCardClick('')}
                  className={`${filterGlassCardBase} ${
                    !selectedOperationalResellerId ? filterGlassCardResellerActive : filterGlassCardInactive
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
                      onClick={() => handleResellerCardClick(r.id)}
                      className={`${filterGlassCardBase} ${
                        active ? filterGlassCardResellerActive : filterGlassCardInactive
                      }`}
                    >
                      <div className="text-sm font-semibold truncate">{r.name}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="wakeel-table-card">
        <div className="wakeel-table-scroll">
          <table className="min-w-[1200px] w-full text-right">
            <thead>
              <tr>
                <th>رقم الفاتورة</th>
                <th>المشترك</th>
                <th>الهاتف</th>
                <th>الباقة</th>
                <th>نوع التفعيل</th>
                <th>حالة الدفع</th>
                <th>المبلغ الواصل</th>
                <th>المتبقي</th>
                <th>المدة</th>
                <th>تاريخ التفعيل</th>
                <th>تاريخ الانتهاء</th>
                <th className="w-[1%]">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredReceipts.map((receipt) => {
                const profileChanged =
                  receipt.oldProfileName &&
                  receipt.newProfileName &&
                  receipt.oldProfileName !== receipt.newProfileName;

                return (
                  <tr key={receipt.id}>
                    <td className="whitespace-nowrap font-medium">{receipt.receiptNumber || '—'}</td>
                    <td className="whitespace-nowrap">{receipt.subscriberName || '—'}</td>
                    <td className="whitespace-nowrap">{receipt.subscriberPhone || '—'}</td>
                    <td>
                      <div className="text-sm font-medium">{receipt.newProfileName || '—'}</div>
                      {profileChanged && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          من: {receipt.oldProfileName}
                        </div>
                      )}
                      {(receipt.discountAmount ?? 0) > 0 && (
                        <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                          خصم: {formatNumber(receipt.discountAmount, { suffix: ' د.ع' })}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap">{getActivationTypeBadge(receipt.activationType)}</td>
                    <td className="whitespace-nowrap">
                      {getPaymentStatusBadge(receipt.paymentStatus as PaymentStatus)}
                    </td>
                    <td className="whitespace-nowrap font-medium">
                      {formatNumber(receipt.amountPaid ?? 0, { suffix: ' د.ع' })}
                    </td>
                    <td className="whitespace-nowrap">
                      {(receipt.remainingAmount ?? 0) > 0 ? (
                        <span className="text-red-600 dark:text-red-400 font-medium">
                          {formatNumber(receipt.remainingAmount, { suffix: ' د.ع' })}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="whitespace-nowrap">{receipt.renewalDays || receipt.renewalPeriod || 0} يوم</td>
                    <td className="whitespace-nowrap">
                      {formatDate(receipt.renewalDate || receipt.issueDate || receipt.createdAt)}
                    </td>
                    <td className="whitespace-nowrap">{formatDate(receipt.newExpirationDate)}</td>
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
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {filteredReceipts.length === 0 && (
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

      {/* Receipt Modal */}
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
                    <span className="text-gray-600 dark:text-gray-400">مبلغ الدين:</span>
                    <span className="text-red-600 dark:text-red-400">{formatNumber(selectedReceipt.remainingAmount || 0, { suffix: ' د.ع' })}</span>
                  </div>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-600 dark:text-gray-400">عدد العناصر:</label>
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm dark:bg-gray-700 dark:text-white"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                عرض {((currentPage - 1) * pageSize) + 1} إلى {Math.min(currentPage * pageSize, totalItems)} من {totalItems} تفعيل
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:text-white"
              >
                السابق
              </button>
              
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                if (page > totalPages) return null;
                
                return (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`px-3 py-1 text-sm border rounded-md ${
                      page === currentPage
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-700 dark:text-white'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
              
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:text-white"
              >
                التالي
              </button>
            </div>
          </div>
        </div>
      )}

      {showAdvancedFiltersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowAdvancedFiltersModal(false)}
            aria-hidden
          />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-white/20 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-gray-200/80 dark:border-gray-700/80 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">الفلترة المتقدمة</h2>
                {(appliedFromDate || appliedToDate || appliedSearchTerm) && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {[appliedFromDate, appliedToDate].filter(Boolean).join(' — ') || appliedSearchTerm}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowAdvancedFiltersModal(false)}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="إغلاق"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5">
              {renderAdvancedFiltersForm()}
              <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={handleApplyFilters}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md text-sm"
                >
                  <Search className="h-4 w-4" />
                  تطبيق الفلاتر
                </button>
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded-md text-sm"
                >
                  تفريغ
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdvancedFiltersModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md text-sm mr-auto"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceiptsPage;