import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { apiService, ApiService } from '../services/api';
import { MaterialDisburseRequest, MaterialReturnRequest, DisbursementType } from '../types';
import type { MaterialDisbursement } from '../types';
import { showSuccess, showError } from '../utils/notifications';
import { useAuth } from '../contexts/AuthContext';
import { useOffline } from '../contexts/OfflineContext';
import { useDigits } from '../contexts/DigitsContext';
import { fetchSubscribersWithCache } from '../services/offlineSync';
import { UserRole } from '../types';
import WifiLoaderComponent from '../components/WifiLoaderComponent';
import Pagination from '../components/Pagination';
import { StatCard } from '../components/StatCard';
import { Package, X, Save, ShoppingCart, Search, RefreshCw, CreditCard, Wallet, Printer, RotateCcw, Gift } from 'lucide-react';

function disbursementTypeLabel(t: number): string {
  if (t === DisbursementType.Sale) return 'بيع';
  if (t === DisbursementType.SpecialOfferPackage) return 'باقة عرض خاص';
  return 'سحب';
}

/** بيانات فاتورة بيع مادة للطباعة (نفس قياس فاتورة الاشتراك 50×80mm) */
interface MaterialInvoicePrintData {
  materialName: string;
  subscriberName: string;
  subscriberPhone?: string;
  quantity: number;
  unitSubscriberPrice?: number;
  pricePaidBySubscriber: number;
  materialDebt?: number;
  discountPercent?: number;
  notes?: string;
  createdAt: string;
  disbursementType: number;
  /** رقم الفاتورة (من الباكند عند البيع فقط) */
  invoiceNumber?: string;
}

interface PosCartItem {
  materialId: string;
  quantity: number;
  pricePaidBySubscriber: number;
  discountPercent: number;
}

function effectiveMaterialUnitPrice(subscriberPrice: number, discountPercent = 0): number {
  const pct = Math.min(100, Math.max(0, discountPercent));
  return subscriberPrice * (1 - pct / 100);
}

const MaterialsDisbursementPage: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { online } = useOffline();
  const { formatNumber, locale } = useDigits();

  /** تاريخ بغداد فقط (يُفصل عن الوقت لعرض أنظف في الجدول). */
  const formatBaghdadDateOnly = React.useCallback(
    (d: string | Date | undefined | null) => {
      if (d == null) return '';
      const date = typeof d === 'string' ? new Date(d) : d;
      if (Number.isNaN(date.getTime())) return '';
      return date.toLocaleDateString(locale, {
        timeZone: 'Asia/Baghdad',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    },
    [locale]
  );

  /** وقت بغداد 12 ساعة مع ثوانٍ. */
  const formatBaghdadTimeOnly = React.useCallback(
    (d: string | Date | undefined | null) => {
      if (d == null) return '';
      const date = typeof d === 'string' ? new Date(d) : d;
      if (Number.isNaN(date.getTime())) return '';
      return date.toLocaleTimeString(locale, {
        timeZone: 'Asia/Baghdad',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    },
    [locale]
  );
  const isAdmin = user?.role === UserRole.Admin;
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('');
  const [disbursementTypeFilter, setDisbursementTypeFilter] = useState<string>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [appliedFromDate, setAppliedFromDate] = useState('');
  const [appliedToDate, setAppliedToDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [showDisburseModal, setShowDisburseModal] = useState(false);
  const [disburseForm, setDisburseForm] = useState<MaterialDisburseRequest>({
    materialId: '',
    subscriberId: '',
    disbursementType: DisbursementType.Replacement,
    quantity: 0,
    pricePaidBySubscriber: 0,
    discountPercent: 0,
    notes: '',
  });
  const [materialSearch, setMaterialSearch] = useState('');
  const [subscriberSearch, setSubscriberSearch] = useState('');
  const [posSubscriberSearch, setPosSubscriberSearch] = useState('');
  const [showMaterialDropdown, setShowMaterialDropdown] = useState(false);
  const [showSubscriberDropdown, setShowSubscriberDropdown] = useState(false);
  const [showPosSubscriberDropdown, setShowPosSubscriberDropdown] = useState(false);
  const materialDropdownRef = useRef<HTMLDivElement>(null);
  const subscriberDropdownRef = useRef<HTMLDivElement>(null);
  const posSubscriberDropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [lastDisbursementForPrint, setLastDisbursementForPrint] = useState<MaterialInvoicePrintData | null>(null);
  const [showSuccessPrintModal, setShowSuccessPrintModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnInvoiceNumber, setReturnInvoiceNumber] = useState('');
  const [returnFoundDisbursement, setReturnFoundDisbursement] = useState<MaterialDisbursement | null>(null);
  const [returnSearching, setReturnSearching] = useState(false);
  const [returnQuantity, setReturnQuantity] = useState<number>(0);
  const [returnNotes, setReturnNotes] = useState('');
  const [selectedSubscriberIdForPos, setSelectedSubscriberIdForPos] = useState<string>('');
  const [cartItems, setCartItems] = useState<PosCartItem[]>([]);
  const [posSaleSubmitting, setPosSaleSubmitting] = useState(false);
  const isSalesHistoryMode = location.pathname.endsWith('/sales-history');
  const isPosMode = !isSalesHistoryMode;

  const { data: agentsResponse } = useQuery({
    queryKey: ['agents', 1, 100],
    queryFn: () => apiService.getAllAgents({ page: 1, pageSize: 100 }),
    enabled: isAdmin,
  });
  const agents = agentsResponse?.data ?? [];

  const { data: materialsResponse } = useQuery({
    queryKey: ['materials', isAdmin ? selectedAgentId : undefined, 1, 100],
    queryFn: () =>
      apiService.getMaterials(isAdmin ? (selectedAgentId || undefined) : undefined, {
        page: 1,
        pageSize: 100,
      }),
  });
  const list = React.useMemo(() => materialsResponse?.data ?? [], [materialsResponse?.data]);

  const { data: disbursementsResponse, error, isLoading } = useQuery({
    queryKey: [
      'material-disbursements',
      isAdmin ? selectedAgentId : undefined,
      currentPage,
      pageSize,
      appliedSearchTerm,
      disbursementTypeFilter,
      appliedFromDate,
      appliedToDate,
    ],
    queryFn: () =>
      apiService.getMaterialDisbursements(isAdmin ? (selectedAgentId || undefined) : undefined, {
        page: currentPage,
        pageSize,
        searchTerm: appliedSearchTerm.trim() || undefined,
        disbursementType:
          disbursementTypeFilter === '' ? undefined : (parseInt(disbursementTypeFilter, 10) as DisbursementType),
        fromDate: appliedFromDate.trim() || undefined,
        toDate: appliedToDate.trim() || undefined,
      }),
  });
  const disbursements = disbursementsResponse?.data ?? [];
  const statistics = disbursementsResponse?.statistics;

  const { data: subscribersResponse } = useQuery({
    queryKey: ['subscribers-for-disburse', 'offline', online, 1, 500, isAdmin ? selectedAgentId : undefined],
    queryFn: () => fetchSubscribersWithCache(online, { page: 1, pageSize: 500 }),
    enabled: true,
  });
  const subscribers = React.useMemo(() => subscribersResponse?.data ?? [], [subscribersResponse?.data]);

  const filteredMaterials = React.useMemo(() => {
    const q = (materialSearch || '').trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (m) =>
        (m.name || '').toLowerCase().includes(q) ||
        String(m.quantity ?? '').includes(q)
    );
  }, [list, materialSearch]);

  const filteredSubscribers = React.useMemo(() => {
    const q = (subscriberSearch || '').trim().toLowerCase();
    if (!q) return subscribers;
    return subscribers.filter(
      (s) =>
        (s.fullName || '').toLowerCase().includes(q) ||
        (s.firstName || '').toLowerCase().includes(q) ||
        (s.lastName || '').toLowerCase().includes(q) ||
        (s.username || '').toLowerCase().includes(q) ||
        (s.phoneNumber || '').replace(/\s/g, '').includes(q.replace(/\s/g, ''))
    );
  }, [subscribers, subscriberSearch]);

  useEffect(() => {
    if (!showDisburseModal) {
      setShowMaterialDropdown(false);
      setShowSubscriberDropdown(false);
      setMaterialSearch('');
      setSubscriberSearch('');
    }
  }, [showDisburseModal]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (materialDropdownRef.current && !materialDropdownRef.current.contains(e.target as Node)) {
        setShowMaterialDropdown(false);
      }
      if (subscriberDropdownRef.current && !subscriberDropdownRef.current.contains(e.target as Node)) {
        setShowSubscriberDropdown(false);
      }
      if (posSubscriberDropdownRef.current && !posSubscriberDropdownRef.current.contains(e.target as Node)) {
        setShowPosSubscriberDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedMaterial = list.find((m) => m.id === disburseForm.materialId);
  const selectedSubscriber = subscribers.find((s) => s.id === (isPosMode ? selectedSubscriberIdForPos : disburseForm.subscriberId));

  const filteredPosSubscribers = React.useMemo(() => {
    const q = posSubscriberSearch.trim().toLowerCase();
    if (!q) return subscribers;
    return subscribers.filter((s) => {
      const label = `${s.fullName || ''} ${s.firstName || ''} ${s.lastName || ''} ${s.username || ''} ${s.phoneNumber || ''}`.toLowerCase();
      return label.includes(q);
    });
  }, [subscribers, posSubscriberSearch]);

  const disburseMutation = useMutation({
    mutationFn: (data: MaterialDisburseRequest) =>
      apiService.postMaterialDisburse(data, isAdmin ? (selectedAgentId || undefined) : undefined),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      queryClient.invalidateQueries({ queryKey: ['material-disbursements'] });
      const fallbackSubscriberName = selectedSubscriber?.fullName?.trim() || [selectedSubscriber?.firstName, selectedSubscriber?.lastName].filter(Boolean).join(' ') || '';
      setLastDisbursementForPrint({
        materialName: created?.materialName ?? selectedMaterial?.name ?? '',
        subscriberName: created?.subscriberName ?? fallbackSubscriberName,
        subscriberPhone: created?.subscriberPhone ?? selectedSubscriber?.phoneNumber,
        quantity: created?.quantity ?? disburseForm.quantity ?? 0,
        unitSubscriberPrice: created?.unitSubscriberPrice ?? selectedMaterial?.subscriberPrice,
        discountPercent: created?.discountPercent ?? disburseForm.discountPercent ?? 0,
        pricePaidBySubscriber: created?.pricePaidBySubscriber ?? disburseForm.pricePaidBySubscriber ?? 0,
        materialDebt: created?.materialDebt,
        notes: created?.notes ?? (disburseForm.notes?.trim() || undefined),
        createdAt: created?.createdAt ?? new Date().toISOString(),
        disbursementType: created?.disbursementType ?? disburseForm.disbursementType ?? DisbursementType.Replacement,
        invoiceNumber: created?.invoiceNumber,
      });
      setShowSuccessPrintModal(true);
      setShowDisburseModal(false);
      setDisburseForm({
        materialId: '',
        subscriberId: '',
        disbursementType: DisbursementType.Replacement,
        quantity: 0,
        pricePaidBySubscriber: 0,
        discountPercent: 0,
        notes: '',
      });
      showSuccess('تم الصرف', 'تم تسجيل بيع/صرف المادة بنجاح');
    },
    onError: (err: unknown) => {
      const msg = ApiService.showError(err);
      showError('خطأ في الصرف', msg);
    },
  });

  const submitDisbursement = async () => {
    if (isPosMode) {
      if (cartDetailedItems.length === 0) {
        showError('خطأ', 'أضف مادة واحدة على الأقل للفاتورة');
        return;
      }
      if (isAdmin && !selectedAgentId) {
        showError('خطأ', 'يرجى اختيار الوكيل');
        return;
      }
      setPosSaleSubmitting(true);
      try {
        let lastCreated: MaterialDisbursement | null = null;
        for (const line of cartDetailedItems) {
          const created = await apiService.postMaterialDisburse(
            {
              materialId: line.material.id,
              subscriberId: selectedSubscriberIdForPos.trim() || null,
              disbursementType: DisbursementType.Sale,
              quantity: line.item.quantity,
              pricePaidBySubscriber: line.item.pricePaidBySubscriber || 0,
              discountPercent: line.item.discountPercent || 0,
              notes: '',
            },
            isAdmin ? (selectedAgentId || undefined) : undefined
          );
          lastCreated = created;
        }
        await queryClient.invalidateQueries({ queryKey: ['materials'] });
        await queryClient.invalidateQueries({ queryKey: ['material-disbursements'] });
        setCartItems([]);
        if (lastCreated) {
          const fallbackSubscriberName =
            selectedSubscriber?.fullName?.trim() ||
            [selectedSubscriber?.firstName, selectedSubscriber?.lastName].filter(Boolean).join(' ') ||
            '';
          setLastDisbursementForPrint({
            materialName: lastCreated.materialName ?? '',
            subscriberName: lastCreated.subscriberName ?? fallbackSubscriberName,
            subscriberPhone: lastCreated.subscriberPhone ?? selectedSubscriber?.phoneNumber,
            quantity: lastCreated.quantity ?? 0,
            unitSubscriberPrice: lastCreated.unitSubscriberPrice,
            discountPercent: lastCreated.discountPercent,
            pricePaidBySubscriber: lastCreated.pricePaidBySubscriber ?? 0,
            materialDebt: lastCreated.materialDebt,
            notes: lastCreated.notes ?? undefined,
            createdAt: lastCreated.createdAt ?? new Date().toISOString(),
            disbursementType: lastCreated.disbursementType ?? DisbursementType.Sale,
            invoiceNumber: lastCreated.invoiceNumber,
          });
          setShowSuccessPrintModal(true);
        }
        showSuccess('تم الصرف', 'تم تسجيل عناصر الفاتورة بنجاح');
      } catch (err) {
        showError('خطأ في الصرف', ApiService.showError(err));
      } finally {
        setPosSaleSubmitting(false);
      }
      return;
    }

    if (!disburseForm.materialId) {
      showError('خطأ', 'يرجى اختيار المادة');
      return;
    }
    if ((disburseForm.quantity || 0) <= 0) {
      showError('خطأ', 'الكمية يجب أن تكون أكبر من صفر');
      return;
    }
    if (isAdmin && !selectedAgentId) {
      showError('خطأ', 'يرجى اختيار الوكيل');
      return;
    }
    disburseMutation.mutate({
      materialId: disburseForm.materialId,
      subscriberId: (disburseForm.subscriberId ?? '').trim() || null,
      disbursementType: disburseForm.disbursementType,
      quantity: disburseForm.quantity ?? 0,
      pricePaidBySubscriber: disburseForm.pricePaidBySubscriber ?? 0,
      discountPercent: disburseForm.discountPercent ?? 0,
      notes: disburseForm.notes?.trim() || undefined,
    });
  };

  const handleDisburseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitDisbursement();
  };

  const handleDisburseInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setDisburseForm((prev) => ({
      ...prev,
      [name]: name === 'materialId' || name === 'subscriberId' || name === 'notes'
        ? value
        : name === 'discountPercent'
          ? Math.min(100, Math.max(0, Number(value) || 0))
          : Number(value) || 0,
    }));
  };

  const increaseMaterialQty = (materialId: string) => {
    setCartItems((prev) => {
      const existing = prev.find((i) => i.materialId === materialId);
      if (existing) {
        return prev.map((i) => (i.materialId === materialId ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { materialId, quantity: 1, pricePaidBySubscriber: 0, discountPercent: 0 }];
    });
  };

  const setCartItemQty = (materialId: string, qty: number) => {
    if (qty <= 0) {
      removeCartItem(materialId);
      return;
    }
    setCartItems((prev) => prev.map((i) => (i.materialId === materialId ? { ...i, quantity: qty } : i)));
  };

  const setCartItemPaid = (materialId: string, paid: number) => {
    setCartItems((prev) => prev.map((i) => (i.materialId === materialId ? { ...i, pricePaidBySubscriber: Math.max(0, paid) } : i)));
  };

  const setCartItemDiscount = (materialId: string, discountPercent: number) => {
    setCartItems((prev) =>
      prev.map((i) =>
        i.materialId === materialId
          ? { ...i, discountPercent: Math.min(100, Math.max(0, discountPercent)) }
          : i
      )
    );
  };

  const removeCartItem = (materialId: string) => {
    setCartItems((prev) => prev.filter((i) => i.materialId !== materialId));
  };

  const cartDetailedItems = React.useMemo(
    () =>
      cartItems
        .map((item) => {
          const material = list.find((m) => m.id === item.materialId);
          if (!material) return null;
          return { item, material };
        })
        .filter(Boolean) as Array<{ item: PosCartItem; material: (typeof list)[number] }>,
    [cartItems, list]
  );

  const cartTotal = React.useMemo(
    () =>
      cartDetailedItems.reduce(
        (sum, line) =>
          sum +
          line.item.quantity *
            effectiveMaterialUnitPrice(line.material.subscriberPrice ?? 0, line.item.discountPercent ?? 0),
        0
      ),
    [cartDetailedItems]
  );

  const returnMutation = useMutation({
    mutationFn: (data: MaterialReturnRequest) =>
      apiService.postMaterialReturn(data, isAdmin ? (selectedAgentId || undefined) : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      queryClient.invalidateQueries({ queryKey: ['material-disbursements'] });
      setShowReturnModal(false);
      setReturnInvoiceNumber('');
      setReturnFoundDisbursement(null);
      setReturnQuantity(0);
      setReturnNotes('');
      showSuccess('تم الاسترجاع', 'تم استرجاع المادة بنجاح');
    },
    onError: (err: unknown) => {
      showError('خطأ في الاسترجاع', ApiService.showError(err));
    },
  });

  const handleReturnVerify = async () => {
    const inv = returnInvoiceNumber.trim();
    if (!inv) {
      showError('خطأ', 'يرجى إدخال رقم الصرف');
      return;
    }
    if (isAdmin && !selectedAgentId) {
      showError('خطأ', 'يرجى اختيار الوكيل');
      return;
    }
    setReturnSearching(true);
    setReturnFoundDisbursement(null);
    const invNorm = inv.toUpperCase();
    const getInvoiceNum = (d: MaterialDisbursement) =>
      String((d as { invoiceNumber?: string; InvoiceNumber?: string }).invoiceNumber ?? (d as { InvoiceNumber?: string }).InvoiceNumber ?? '').trim().toUpperCase();

    try {
      let list: MaterialDisbursement[] = (await apiService.getMaterialDisbursements(
        isAdmin ? selectedAgentId || undefined : undefined,
        { searchTerm: inv, pageSize: 50 }
      )).data ?? [];

      if (list.length === 0) {
        const fallback = await apiService.getMaterialDisbursements(
          isAdmin ? selectedAgentId || undefined : undefined,
          { pageSize: 500 }
        );
        list = fallback.data ?? [];
      }

      const match = list.find((d) => getInvoiceNum(d) === invNorm);
      if (match) {
        const normalized = {
          ...match,
          invoiceNumber: match.invoiceNumber ?? (match as { InvoiceNumber?: string }).InvoiceNumber ?? inv,
        };
        setReturnFoundDisbursement(normalized);
        const maxReturn = (match.quantity ?? 0) - (match.returnedQuantity ?? 0);
        setReturnQuantity(maxReturn > 0 ? maxReturn : 0);
      } else {
        showError('غير موجود', 'لم يتم العثور على صرف بهذا رقم الصرف. تحقق من الرقم أو أن الصرف من نوع بيع.');
      }
    } catch {
      showError('خطأ', 'فشل التحقق من رقم الصرف');
    } finally {
      setReturnSearching(false);
    }
  };

  const handleReturnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const inv = returnInvoiceNumber.trim();
    if (!inv) {
      showError('خطأ', 'رقم الصرف مطلوب');
      return;
    }
    const qty = returnQuantity || 0;
    if (qty <= 0) {
      showError('خطأ', 'الكمية يجب أن تكون أكبر من صفر');
      return;
    }
    if (returnFoundDisbursement) {
      const maxReturn = (returnFoundDisbursement.quantity ?? 0) - (returnFoundDisbursement.returnedQuantity ?? 0);
      if (maxReturn <= 0) {
        showError('خطأ', 'لا يوجد كمية قابلة للاسترجاع من هذا الصرف');
        return;
      }
      if (qty > maxReturn) {
        showError('خطأ', `الكمية يجب ألا تتجاوز ${maxReturn}`);
        return;
      }
    }
    returnMutation.mutate({
      invoiceNumber: inv,
      quantity: qty,
      notes: returnNotes.trim() || undefined,
    });
  };

  /** طباعة فاتورة بيع مادة بنفس قياس فاتورة الاشتراك (50×80mm) */
  const handlePrintMaterialInvoice = (data: MaterialInvoicePrintData) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const dateBaghdad = formatBaghdadDateOnly(data.createdAt ? data.createdAt : new Date()) || '—';
    const timeBaghdad = formatBaghdadTimeOnly(data.createdAt ? data.createdAt : new Date()) || '—';
    const totalAmount =
      (data.quantity *
        effectiveMaterialUnitPrice(data.unitSubscriberPrice ?? 0, data.discountPercent ?? 0)) ||
      data.pricePaidBySubscriber;
    const typeLabel = disbursementTypeLabel(data.disbursementType);

    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>فاتورة بيع مادة</title>
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
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <h1>فاتورة بيع مادة</h1>
            ${data.invoiceNumber ? `<p><strong>رقم الصرف:</strong> ${String(data.invoiceNumber).replace(/</g, '&lt;')}</p>` : ''}
            <p><strong>التاريخ:</strong> ${dateBaghdad}</p>
            <p><strong> :</strong> ${timeBaghdad}</p>
            <p><strong>نوع العملية:</strong> ${typeLabel}</p>
          </div>
          <div class="section">
            <h3>معلومات المشترك</h3>
            <div class="info-row">
              <span class="label">اسم المشترك:</span>
              <span class="value">${(data.subscriberName || '').replace(/</g, '&lt;')}</span>
            </div>
            ${data.subscriberPhone ? `
            <div class="info-row">
              <span class="label">رقم الهاتف:</span>
              <span class="value">${String(data.subscriberPhone).replace(/</g, '&lt;')}</span>
            </div>
            ` : ''}
          </div>
          <div class="section">
            <h3>تفاصيل المادة</h3>
            <div class="info-row">
              <span class="label">المادة:</span>
              <span class="value">${(data.materialName || '').replace(/</g, '&lt;')}</span>
            </div>
            <div class="info-row">
              <span class="label">الكمية:</span>
              <span class="value">${formatNumber(data.quantity ?? 0)}</span>
            </div>
            ${typeof data.unitSubscriberPrice === 'number' ? `
            <div class="info-row">
              <span class="label">سعر الوحدة:</span>
              <span class="value">${formatNumber(data.unitSubscriberPrice, { suffix: ' د.ع' })}</span>
            </div>
            ` : ''}
            ${(data.discountPercent ?? 0) > 0 ? `
            <div class="info-row">
              <span class="label">الخصم:</span>
              <span class="value">${formatNumber(data.discountPercent ?? 0, { suffix: '%' })}</span>
            </div>
            <div class="info-row">
              <span class="label">السعر بعد الخصم:</span>
              <span class="value">${formatNumber(effectiveMaterialUnitPrice(data.unitSubscriberPrice ?? 0, data.discountPercent ?? 0), { suffix: ' د.ع' })}</span>
            </div>
            ` : ''}
          </div>
          <div class="pricing">
            <h3>التفاصيل المالية</h3>
            ${typeof data.unitSubscriberPrice === 'number' && data.quantity ? `
            <div class="info-row">
              <span class="label">الإجمالي:</span>
              <span class="value">${formatNumber(totalAmount, { suffix: ' د.ع' })}</span>
            </div>
            ` : ''}
            <div class="info-row">
              <span class="label">المبلغ المدفوع:</span>
              <span class="value" style="color: green;">${formatNumber(data.pricePaidBySubscriber ?? 0, { suffix: ' د.ع' })}</span>
            </div>
            ${(data.materialDebt ?? 0) > 0 ? `
            <div class="info-row">
              <span class="label">مبلغ الدين:</span>
              <span class="value" style="color: red;">${formatNumber(data.materialDebt ?? 0, { suffix: ' د.ع' })}</span>
            </div>
            ` : ''}
          </div>
          ${data.notes?.trim() ? `
          <div class="section">
            <h3>ملاحظات</h3>
            <p style="background: #e8f4fc; padding: 1mm; margin: 0; font-size: 5px;">${String(data.notes).replace(/</g, '&lt;')}</p>
          </div>
          ` : ''}
          <div class="footer">
            <p>شكراً لتعاملكم</p>
          </div>
        </div>
      </body>
      </html>
    `;
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    };
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-md">
          خطأ في تحميل بيانات المواد المصروفة
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
          text="تحميل سجل المواد المصروفة..."
          backColor="#E8F2FC"
          frontColor="#4645F6"
        />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            {isPosMode ? 'نقاط البيع' : 'سجل المبيعات'}
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
            {isPosMode ? 'بيع المواد بنمط الكاشير مع فاتورة مباشرة' : 'متابعة كل عمليات البيع والسحب والاسترجاع'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <div className="min-w-[180px]">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">الوكيل</label>
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white text-sm"
              >
                <option value="">-- اختر الوكيل --</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.companyName || a.fullName || a.username}
                  </option>
                ))}
              </select>
            </div>
          )}
          {isPosMode && (
            <button
              type="button"
              onClick={() => setShowDisburseModal(true)}
              disabled={(isAdmin && !selectedAgentId) || list.length === 0}
              className="flex items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm sm:text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] touch-manipulation"
            >
              <ShoppingCart className="h-4 w-4" />
              <span>نموذج بيع يدوي</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setShowReturnModal(true);
              setReturnInvoiceNumber('');
              setReturnFoundDisbursement(null);
              setReturnQuantity(0);
              setReturnNotes('');
            }}
            disabled={isAdmin && !selectedAgentId}
            className="flex items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm sm:text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] touch-manipulation"
          >
            <RotateCcw className="h-4 w-4" />
            <span>استرجاع مادة</span>
          </button>
        </div>
      </div>

      {isPosMode && (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        <div className="xl:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">المواد المتاحة</h2>
              <span className="text-xs text-gray-500 dark:text-gray-400">اضغط + لإضافة الكمية للفاتورة</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {list.map((m) => {
                const cartItem = cartItems.find((i) => i.materialId === m.id);
                const qtyInCart = cartItem?.quantity ?? 0;
                const qty = m.quantity ?? 0;
                return (
                  <div
                    key={m.id}
                    className={`rounded-2xl border p-3 text-center transition-all bg-white dark:bg-gray-800 ${
                      qtyInCart > 0
                        ? 'border-primary-400 shadow-md'
                        : 'border-gray-200 dark:border-gray-700 shadow-sm'
                    }`}
                  >
                    <div className="h-full flex flex-col justify-between gap-3">
                      <div className="space-y-2">
                        <div className="mx-auto w-20 h-20 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center p-1">
                          {m.imagePngUrl ? (
                            <img src={m.imagePngUrl} alt={m.name} className="w-full h-full object-contain" loading="lazy" />
                          ) : (
                            <Package className="h-6 w-6 text-gray-400" />
                          )}
                        </div>
                        <p className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-2 min-h-[40px]">{m.name}</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">
                          {formatNumber(m.subscriberPrice ?? 0, { suffix: ' د.ع' })}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">المتوفر: {formatNumber(qty)}</p>
                      </div>
                      <div className="flex items-center justify-center gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => setCartItemQty(m.id, qtyInCart - 1)}
                          className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-lg font-bold"
                          title="تقليل"
                        >
                          -
                        </button>
                        <span className="min-w-[28px] text-base font-semibold text-gray-900 dark:text-white">{qtyInCart}</span>
                        <button
                          type="button"
                          onClick={() => increaseMaterialQty(m.id)}
                          className="w-9 h-9 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-lg font-bold"
                          title="زيادة"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="xl:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sticky top-3">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">الفاتورة</h2>
            {cartDetailedItems.length > 0 ? (
              <div className="space-y-3">
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {cartDetailedItems.map(({ item, material }) => (
                    <div key={material.id} className="rounded-lg bg-gray-50 dark:bg-gray-700/40 p-2.5 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{material.name}</p>
                        <button type="button" onClick={() => removeCartItem(material.id)} className="text-red-500 text-xs hover:underline">حذف</button>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        سعر الوحدة: {formatNumber(material.subscriberPrice ?? 0, { suffix: ' د.ع' })}
                        {(item.discountPercent ?? 0) > 0 && (
                          <> — بعد خصم {item.discountPercent}%: {formatNumber(effectiveMaterialUnitPrice(material.subscriberPrice ?? 0, item.discountPercent ?? 0), { suffix: ' د.ع' })}</>
                        )}
                      </p>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setCartItemQty(material.id, item.quantity - 1)} className="w-7 h-7 rounded bg-gray-100 dark:bg-gray-700">-</button>
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => setCartItemQty(material.id, Number(e.target.value) || 1)}
                          className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-center dark:bg-gray-700 dark:text-white"
                        />
                        <button type="button" onClick={() => setCartItemQty(material.id, item.quantity + 1)} className="w-7 h-7 rounded bg-primary-600 text-white">+</button>
                        <span className="text-xs text-gray-500 dark:text-gray-400 mr-auto">
                          الإجمالي: {formatNumber(item.quantity * effectiveMaterialUnitPrice(material.subscriberPrice ?? 0, item.discountPercent ?? 0), { suffix: ' د.ع' })}
                        </span>
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={item.discountPercent || ''}
                        onChange={(e) => setCartItemDiscount(material.id, Number(e.target.value) || 0)}
                        placeholder="قيمة الخصم %"
                        className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm"
                      />
                      <input
                        type="number"
                        min={0}
                        value={item.pricePaidBySubscriber || ''}
                        onChange={(e) => setCartItemPaid(material.id, Number(e.target.value) || 0)}
                        placeholder="المدفوع لهذا الصنف"
                        className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm"
                      />
                    </div>
                  ))}
                </div>
                <div ref={posSubscriberDropdownRef}>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">المشترك (اختياري)</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPosSubscriberDropdown((v) => !v);
                        if (!showPosSubscriberDropdown) setPosSubscriberSearch('');
                      }}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-right flex items-center justify-between"
                    >
                      <span className="truncate text-sm">
                        {selectedSubscriber
                          ? `${selectedSubscriber.fullName || `${(selectedSubscriber.firstName || '').trim()} ${(selectedSubscriber.lastName || '').trim()}`.trim() || selectedSubscriber.username} — ${selectedSubscriber.phoneNumber || ''}`
                          : 'بدون مشترك'}
                      </span>
                      <Search className="h-4 w-4 text-gray-400 flex-shrink-0 mr-2" />
                    </button>
                    {showPosSubscriberDropdown && (
                      <div className="absolute z-20 mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-lg max-h-64 flex flex-col">
                        <div className="p-2 border-b border-gray-200 dark:border-gray-600 sticky top-0 bg-white dark:bg-gray-700">
                          <div className="relative">
                            <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                              type="text"
                              value={posSubscriberSearch}
                              onChange={(e) => setPosSubscriberSearch(e.target.value)}
                              placeholder="بحث بالاسم أو رقم الهاتف..."
                              className="w-full pl-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm dark:bg-gray-600 dark:text-white text-right"
                              autoFocus
                            />
                          </div>
                        </div>
                        <ul className="overflow-y-auto py-1 max-h-48">
                          <li>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSubscriberIdForPos('');
                                setShowPosSubscriberDropdown(false);
                                setPosSubscriberSearch('');
                              }}
                              className={`w-full text-right px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 ${
                                !selectedSubscriberIdForPos ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              بدون مشترك
                            </button>
                          </li>
                          {filteredPosSubscribers.length === 0 ? (
                            <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">لا توجد نتائج</li>
                          ) : (
                            filteredPosSubscribers.map((s) => {
                              const label = s.fullName || `${(s.firstName || '').trim()} ${(s.lastName || '').trim()}`.trim() || s.username;
                              return (
                                <li key={s.id}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedSubscriberIdForPos(s.id);
                                      setShowPosSubscriberDropdown(false);
                                      setPosSubscriberSearch('');
                                    }}
                                    className={`w-full text-right px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 ${
                                      selectedSubscriberIdForPos === s.id ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'
                                    }`}
                                  >
                                    {label} — {s.phoneNumber || ''}
                                  </button>
                                </li>
                              );
                            })
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-2 text-sm flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-300">إجمالي الفاتورة</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{formatNumber(cartTotal, { suffix: ' د.ع' })}</span>
                </div>
                <button
                  type="button"
                  onClick={() => void submitDisbursement()}
                  disabled={posSaleSubmitting || disburseMutation.isPending || (isAdmin && !selectedAgentId) || cartDetailedItems.length === 0}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {posSaleSubmitting || disburseMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-4 w-4" />
                      <span>تأكيد البيع</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">اختر مادة/مواد من الكاردات لإظهار الفاتورة.</p>
            )}
          </div>
        </div>
      </div>
      )}

      {isSalesHistoryMode && (
      <>
      <div className="mt-3 flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="بحث (المادة، المشترك، الملاحظات، الموظف الصارف)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) =>
              e.key === 'Enter' &&
              (e.preventDefault(), setAppliedSearchTerm(searchTerm.trim()), setCurrentPage(1))
            }
            className="w-full pr-10 pl-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white text-sm"
          />
        </div>
        <select
          value={disbursementTypeFilter}
          onChange={(e) => {
            setDisbursementTypeFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white text-sm"
        >
          <option value="">كل الأنواع</option>
          <option value={DisbursementType.Replacement}>سحب</option>
          <option value={DisbursementType.Sale}>بيع</option>
          <option value={DisbursementType.SpecialOfferPackage}>باقة عرض خاص</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
          <span>من تاريخ</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm"
          />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
          <span>إلى تاريخ</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm"
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setAppliedSearchTerm(searchTerm.trim());
            setAppliedFromDate(fromDate.trim().split('T')[0]);
            setAppliedToDate(toDate.trim().split('T')[0]);
            setCurrentPage(1);
          }}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md text-sm font-medium whitespace-nowrap"
        >
          بحث
        </button>
      </div>
      {!(appliedFromDate || appliedToDate) && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          بدون تحديد تاريخ: القائمة تعرض كل الصرف، والإحصائيات لليوم الحالي فقط.
        </p>
      )}

      {statistics && (
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <StatCard
            title="مواد مباعة"
            value={statistics.soldQuantity ?? 0}
            icon={ShoppingCart}
            color="green"
          />
          <StatCard
            title="مواد مسحوبة"
            value={statistics.replacedQuantity ?? 0}
            icon={RefreshCw}
            color="blue"
          />
          <StatCard
            title="مواد عرض خاص"
            value={statistics.specialOfferPackageQuantity ?? 0}
            icon={Gift}
            color="orange"
          />
          <StatCard
            title="إجمالي دين المواد"
            value={statistics.totalMaterialDebt ?? 0}
            icon={CreditCard}
            color="purple"
            isAmount
          />
          <StatCard
            title="إجمالي البيع"
            value={statistics.totalSaleAmount ?? 0}
            icon={Wallet}
            color="green"
            isAmount
          />
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="wakeel-table-scroll">
          <table className="min-w-full text-right">
            <thead>
              <tr>
                <th className="px-3 py-2 sm:px-4 sm:py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">المادة</th>
                <th className="px-3 py-2 sm:px-4 sm:py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">المشترك</th>
                <th className="px-3 py-2 sm:px-4 sm:py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">نوع الصرف</th>
                <th className="px-3 py-2 sm:px-4 sm:py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">رقم الصرف</th>
                <th className="px-3 py-2 sm:px-4 sm:py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">الكمية</th>
                <th className="px-3 py-2 sm:px-4 sm:py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">مسترجع</th>
                <th className="px-3 py-2 sm:px-4 sm:py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">المدفوع (د.ع)</th>
                <th className="px-3 py-2 sm:px-4 sm:py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">الدين  (د.ع)</th>
                <th className="px-3 py-2 sm:px-4 sm:py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">صاحب الصرف</th>
                <th className="w-[9.5rem] min-w-[9rem] max-w-[11rem] shrink-0 px-2 py-2 sm:px-2.5 sm:py-3 text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 leading-snug">التاريخ والوقت</th>
                <th className="min-w-[12rem] max-w-[min(22rem,32vw)] px-3 py-2 sm:px-4 sm:py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">ملاحظات</th>
                <th className="px-3 py-2 sm:px-4 sm:py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {(!disbursements || disbursements.length === 0) ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    <Package className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                    <p>لا توجد سجلات صرف</p>
                    <p className="text-sm mt-1">اضغط «بيع مادة» لتسجيل صرف مادة لمشترك</p>
                  </td>
                </tr>
              ) : (
                disbursements.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-3 py-2 sm:px-4 sm:py-3 text-sm font-medium text-gray-900 dark:text-white">{d.materialName}</td>
                    <td className="px-3 py-2 sm:px-4 sm:py-3 text-sm text-gray-900 dark:text-white">
                      <span className="block">{d.subscriberName}</span>
                      {d.subscriberPhone && <span className="text-xs text-gray-500 dark:text-gray-400">{d.subscriberPhone}</span>}
                    </td>
                    <td className="px-3 py-2 sm:px-4 sm:py-3 text-sm">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                        d.disbursementType === DisbursementType.Sale
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                          : d.disbursementType === DisbursementType.SpecialOfferPackage
                            ? 'bg-violet-100 text-violet-800 dark:bg-violet-900/25 dark:text-violet-300'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
                      }`}>
                        {disbursementTypeLabel(d.disbursementType ?? DisbursementType.Replacement)}
                      </span>
                    </td>
                    <td className="px-3 py-2 sm:px-4 sm:py-3 text-sm text-gray-900 dark:text-white font-mono">{d.invoiceNumber ?? '—'}</td>
                    <td className="px-3 py-2 sm:px-4 sm:py-3 text-sm text-gray-900 dark:text-white">{formatNumber(d.quantity ?? 0)}</td>
                    <td className="px-3 py-2 sm:px-4 sm:py-3 text-sm text-gray-500 dark:text-gray-400">{formatNumber(d.returnedQuantity ?? 0)}</td>
                    <td className="px-3 py-2 sm:px-4 sm:py-3 text-sm text-gray-900 dark:text-white">{formatNumber(d.pricePaidBySubscriber ?? 0)}</td>
                    <td className="px-3 py-2 sm:px-4 sm:py-3 text-sm text-gray-900 dark:text-white">{formatNumber(d.materialDebt ?? 0)}</td>
                    <td className="px-3 py-2 sm:px-4 sm:py-3 text-sm text-gray-500 dark:text-gray-400">{d.disbursedByUserName ?? '—'}</td>
                    <td className="w-[9.5rem] min-w-[9rem] max-w-[11rem] shrink-0 px-2 py-2 sm:px-2.5 sm:py-3 align-top">
                      {d.createdAt ? (
                        <div className="flex flex-col gap-1 items-stretch" dir="ltr">
                          <span className="block text-[11px] sm:text-xs text-gray-600 dark:text-gray-300 tabular-nums leading-snug text-end">
                            {formatBaghdadDateOnly(d.createdAt)}
                          </span>
                          <span className="block text-[11px] sm:text-sm font-medium text-gray-800 dark:text-gray-100 tabular-nums leading-snug text-end">
                            {formatBaghdadTimeOnly(d.createdAt)}
                          </span>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="min-w-[12rem] max-w-[min(22rem,32vw)] px-3 py-2 sm:px-4 sm:py-3 text-sm text-gray-900 dark:text-white whitespace-normal break-words leading-snug align-top">{d.notes ?? '—'}</td>
                    <td className="px-3 py-2 sm:px-4 sm:py-3 text-sm whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        {((d.quantity ?? 0) - (d.returnedQuantity ?? 0)) > 0 && (d.invoiceNumber ?? '').trim() && (
                          <button
                            type="button"
                            onClick={() => {
                              setReturnFoundDisbursement(d);
                              setReturnInvoiceNumber(d.invoiceNumber ?? '');
                              setReturnQuantity((d.quantity ?? 0) - (d.returnedQuantity ?? 0));
                              setReturnNotes('');
                              setShowReturnModal(true);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-md transition-colors"
                            title="استرجاع من هذا السجل (برقم الصرف)"
                          >
                            <RotateCcw className="h-4 w-4" />
                            <span className="hidden sm:inline">استرجاع</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handlePrintMaterialInvoice({
                            materialName: d.materialName ?? '',
                            subscriberName: d.subscriberName ?? '',
                            subscriberPhone: d.subscriberPhone,
                            quantity: d.quantity ?? 0,
                            unitSubscriberPrice: d.unitSubscriberPrice,
                            discountPercent: d.discountPercent ?? 0,
                            pricePaidBySubscriber: d.pricePaidBySubscriber ?? 0,
                            materialDebt: d.materialDebt,
                            notes: d.notes ?? undefined,
                            createdAt: d.createdAt ?? new Date().toISOString(),
                            disbursementType: d.disbursementType ?? DisbursementType.Replacement,
                            invoiceNumber: d.invoiceNumber,
                          })}
                          className="inline-flex items-center gap-1 px-2 py-1.5 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-md transition-colors"
                          title="طباعة الصرف"
                        >
                          <Printer className="h-4 w-4" />
                          <span className="hidden sm:inline">طباعة</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {disbursementsResponse && (
        <Pagination
          currentPage={disbursementsResponse.currentPage}
          totalPages={disbursementsResponse.totalPages}
          totalItems={disbursementsResponse.totalItems}
          pageSize={disbursementsResponse.pageSize}
          hasNextPage={disbursementsResponse.hasNextPage}
          hasPreviousPage={disbursementsResponse.hasPreviousPage}
          onPageChange={(page) => setCurrentPage(page)}
        />
      )}
      </>
      )}

      {/* بيع مادة Modal */}
      {showDisburseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">بيع مادة</h2>
              <button
                type="button"
                onClick={() => setShowDisburseModal(false)}
                className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleDisburseSubmit} className="p-6 space-y-4">
              <div ref={materialDropdownRef}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">المادة *</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMaterialDropdown((v) => !v);
                      setShowSubscriberDropdown(false);
                      if (!showMaterialDropdown) setMaterialSearch('');
                    }}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white text-right flex items-center justify-between"
                  >
                    <span className="truncate">
                      {selectedMaterial ? `${selectedMaterial.name} — متوفر: ${formatNumber(selectedMaterial.quantity ?? 0)}` : '-- اختر المادة أو ابحث --'}
                    </span>
                    <Search className="h-4 w-4 text-gray-400 flex-shrink-0 mr-2" />
                  </button>
                  {showMaterialDropdown && (
                    <div className="absolute z-20 mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-lg max-h-64 flex flex-col">
                      <div className="p-2 border-b border-gray-200 dark:border-gray-600 sticky top-0 bg-white dark:bg-gray-700">
                        <div className="relative">
                          <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input
                            type="text"
                            value={materialSearch}
                            onChange={(e) => setMaterialSearch(e.target.value)}
                            placeholder="بحث عن مادة..."
                            className="w-full pl-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm dark:bg-gray-600 dark:text-white text-right"
                            autoFocus
                          />
                        </div>
                      </div>
                      <ul className="overflow-y-auto py-1 max-h-48">
                        {filteredMaterials.length === 0 ? (
                          <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">لا توجد نتائج</li>
                        ) : (
                          filteredMaterials.map((m) => (
                            <li key={m.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  setDisburseForm((prev) => ({ ...prev, materialId: m.id }));
                                  setShowMaterialDropdown(false);
                                  setMaterialSearch('');
                                }}
                                className={`w-full text-right px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 ${
                                  disburseForm.materialId === m.id ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'
                                }`}
                              >
                                {m.name} — متوفر: {formatNumber(m.quantity ?? 0)}
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
              <div ref={subscriberDropdownRef}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">المشترك (اختياري — للبيع/التبديل بدون مشترك)</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSubscriberDropdown((v) => !v);
                      setShowMaterialDropdown(false);
                      if (!showSubscriberDropdown) setSubscriberSearch('');
                    }}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white text-right flex items-center justify-between"
                  >
                    <span className="truncate">
                      {selectedSubscriber
                        ? `${selectedSubscriber.fullName || `${(selectedSubscriber.firstName || '').trim()} ${(selectedSubscriber.lastName || '').trim()}`.trim() || selectedSubscriber.username} — ${selectedSubscriber.phoneNumber || ''}`
                        : '-- اختر المشترك أو بدون مشترك --'}
                    </span>
                    <Search className="h-4 w-4 text-gray-400 flex-shrink-0 mr-2" />
                  </button>
                  {showSubscriberDropdown && (
                    <div className="absolute z-20 mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-lg max-h-64 flex flex-col">
                      <div className="p-2 border-b border-gray-200 dark:border-gray-600 sticky top-0 bg-white dark:bg-gray-700">
                        <div className="relative">
                          <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input
                            type="text"
                            value={subscriberSearch}
                            onChange={(e) => setSubscriberSearch(e.target.value)}
                            placeholder="بحث بالاسم أو رقم الهاتف..."
                            className="w-full pl-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm dark:bg-gray-600 dark:text-white text-right"
                            autoFocus
                          />
                        </div>
                      </div>
                      <ul className="overflow-y-auto py-1 max-h-48">
                        <li>
                          <button
                            type="button"
                            onClick={() => {
                              setDisburseForm((prev) => ({ ...prev, subscriberId: '' }));
                              setShowSubscriberDropdown(false);
                              setSubscriberSearch('');
                            }}
                            className={`w-full text-right px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 ${
                              !disburseForm.subscriberId ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            بدون مشترك
                          </button>
                        </li>
                        {filteredSubscribers.length === 0 ? (
                          <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">لا توجد نتائج</li>
                        ) : (
                          filteredSubscribers.map((s) => {
                            const label = s.fullName || `${(s.firstName || '').trim()} ${(s.lastName || '').trim()}`.trim() || s.username;
                            return (
                              <li key={s.id}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDisburseForm((prev) => ({ ...prev, subscriberId: s.id }));
                                    setShowSubscriberDropdown(false);
                                    setSubscriberSearch('');
                                  }}
                                  className={`w-full text-right px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 ${
                                    disburseForm.subscriberId === s.id ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'
                                  }`}
                                >
                                  {label} — {s.phoneNumber || ''}
                                </button>
                              </li>
                            );
                          })
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">نوع الصرف</label>
                <select
                  name="disbursementType"
                  value={disburseForm.disbursementType}
                  onChange={handleDisburseInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value={DisbursementType.Replacement}>سحب</option>
                  <option value={DisbursementType.Sale}>بيع</option>
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">الكمية *</label>
                  <input
                    type="number"
                    name="quantity"
                    value={disburseForm.quantity || ''}
                    onChange={handleDisburseInputChange}
                    required
                    min={1}
                    max={2147483647}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">قيمة الخصم من سعر المادة (%)</label>
                  <input
                    type="number"
                    name="discountPercent"
                    value={disburseForm.discountPercent || ''}
                    onChange={handleDisburseInputChange}
                    min={0}
                    max={100}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    placeholder="0"
                  />
                  {selectedMaterial && (disburseForm.discountPercent ?? 0) > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      السعر بعد الخصم: {formatNumber(effectiveMaterialUnitPrice(selectedMaterial.subscriberPrice ?? 0, disburseForm.discountPercent ?? 0), { suffix: ' د.ع' })}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">المبلغ المدفوع من المشترك (د.ع)</label>
                  <input
                    type="number"
                    name="pricePaidBySubscriber"
                    value={disburseForm.pricePaidBySubscriber || ''}
                    onChange={handleDisburseInputChange}
                    min={0}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">ملاحظات</label>
                <textarea
                  name="notes"
                  value={disburseForm.notes ?? ''}
                  onChange={handleDisburseInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  placeholder="ملاحظات اختيارية..."
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowDisburseModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={disburseMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {disburseMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>تسجيل البيع/الصرف</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* مودال استرجاع مادة */}
      {showReturnModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">استرجاع مادة</h2>
              <button
                type="button"
                onClick={() => {
                  setShowReturnModal(false);
                  setReturnFoundDisbursement(null);
                  setReturnInvoiceNumber('');
                }}
                className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleReturnSubmit} className="p-6 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                أدخل رقم الصرف للتحقق من أن الصرف تم (بيع أو سحب) ثم حدد الكمية والملاحظات وتأكيد الاسترجاع.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="رقم الصرف (مثال: 482917AB)"
                  value={returnInvoiceNumber}
                  onChange={(e) => setReturnInvoiceNumber(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white font-mono"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={handleReturnVerify}
                  disabled={returnSearching || !returnInvoiceNumber.trim()}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {returnSearching ? 'جاري التحقق...' : 'تحقق'}
                </button>
              </div>

              {returnFoundDisbursement && (
                <>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2 text-sm">
                    <p className="font-medium text-gray-900 dark:text-white">بيانات الصرف:</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-700 dark:text-gray-300">
                      <span>المادة:</span>
                      <span>{returnFoundDisbursement.materialName}</span>
                      <span>المشترك:</span>
                      <span>{returnFoundDisbursement.subscriberName}</span>
                      <span>نوع الصرف:</span>
                      <span>{disbursementTypeLabel(returnFoundDisbursement.disbursementType ?? DisbursementType.Replacement)}</span>
                      <span>الكمية المصروفة:</span>
                      <span>{formatNumber(returnFoundDisbursement.quantity ?? 0)}</span>
                      <span>الكمية المسترجعة سابقاً:</span>
                      <span>{formatNumber(returnFoundDisbursement.returnedQuantity ?? 0)}</span>
                      <span>القابل للاسترجاع:</span>
                      <span className="font-medium">
                        {formatNumber((returnFoundDisbursement.quantity ?? 0) - (returnFoundDisbursement.returnedQuantity ?? 0))}
                      </span>
                    </div>
                  </div>
                  <div>
                    {(() => {
                      const maxReturn = Math.max(0, (returnFoundDisbursement.quantity ?? 0) - (returnFoundDisbursement.returnedQuantity ?? 0));
                      return (
                        <>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">الكمية المراد استرجاعها *</label>
                          {maxReturn === 0 ? (
                            <p className="text-sm text-amber-600 dark:text-amber-400 py-2">لا توجد كمية قابلة للاسترجاع من هذا الصرف (تم استرجاع الكامل مسبقاً).</p>
                          ) : (
                            <input
                              type="number"
                              min={0}
                              max={maxReturn}
                              value={returnQuantity || ''}
                              onChange={(e) => setReturnQuantity(Number(e.target.value) || 0)}
                              required
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                            />
                          )}
                        </>
                      );
                    })()}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">ملاحظات (اختياري)</label>
                    <textarea
                      value={returnNotes}
                      onChange={(e) => setReturnNotes(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                      placeholder="ملاحظات الاسترجاع..."
                    />
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowReturnModal(false);
                    setReturnFoundDisbursement(null);
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={
                    !returnFoundDisbursement ||
                    returnMutation.isPending ||
                    (returnFoundDisbursement && Math.max(0, (returnFoundDisbursement.quantity ?? 0) - (returnFoundDisbursement.returnedQuantity ?? 0)) === 0)
                  }
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {returnMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      <span>جاري الاسترجاع...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-4 w-4" />
                      <span>تأكيد الاسترجاع</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* مودال تم البيع بنجاح + طباعة الفاتورة */}
      {showSuccessPrintModal && lastDisbursementForPrint && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">تم البيع بنجاح</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">هل تريد طباعة فاتورة بيع المادة؟</p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowSuccessPrintModal(false);
                  setLastDisbursementForPrint(null);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
              >
                إغلاق
              </button>
              <button
                type="button"
                onClick={() => {
                  handlePrintMaterialInvoice(lastDisbursementForPrint);
                  setShowSuccessPrintModal(false);
                  setLastDisbursementForPrint(null);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors"
              >
                <Printer className="h-4 w-4" />
                طباعة الفاتورة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaterialsDisbursementPage;
