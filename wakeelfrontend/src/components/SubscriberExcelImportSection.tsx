import React, { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Users,
  Loader2,
} from 'lucide-react';
import { apiService, ApiService } from '../services/api';
import {
  AgentRegion,
  AgentReseller,
  ExcelImportResponse,
} from '../types';
import { showError, showSuccess } from '../utils/notifications';
import { createXlsxBlob } from '../utils/excelExport';

const SUBSCRIBER_IMPORT_COLUMNS = [
  'Username',
  'FirstName',
  'LastName',
  'ActivationDate',
  'Expire',
  'Profile',
  'Password',
  'Phone',
  'SecruptionId',
  'FDT',
  'FAT',
  'Zone',
] as const;

const SubscriberExcelImportSection: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [selectedResellerId, setSelectedResellerId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ExcelImportResponse | null>(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  const { data: myRegions = [], isLoading: regionsLoading } = useQuery<AgentRegion[]>({
    queryKey: ['myRegions'],
    queryFn: () => apiService.getMyRegions(true),
  });

  const { data: myResellers = [], isLoading: resellersLoading } = useQuery<AgentReseller[]>({
    queryKey: ['myResellers'],
    queryFn: () => apiService.getMyResellers(),
  });

  const hasResellers = myResellers.length > 0;
  const resellersInRegion = useMemo(() => {
    if (!selectedRegionId) return myResellers;
    return myResellers.filter((r) => r.regionId === selectedRegionId);
  }, [myResellers, selectedRegionId]);

  const importMutation = useMutation({
    mutationFn: async ({
      file,
      resellerId,
    }: {
      file: File;
      resellerId?: string;
    }) => apiService.importSubscribersFromExcel(file, { resellerId }),
    onSuccess: (data) => {
      setImportResult(data);
      const errors = data.errorCount ?? 0;
      const success = data.successCount ?? data.importedCount ?? 0;
      if (errors === 0 && success > 0) {
        showSuccess('تم الاستيراد', data.message || `تم استيراد ${success} مشترك`);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else if (success > 0) {
        showSuccess('تم جزئياً', data.message);
      }
    },
    onError: (error: unknown) => {
      showError('فشل الاستيراد', ApiService.showError(error));
    },
  });

  const handleRegionChange = (regionId: string) => {
    setSelectedRegionId(regionId);
    setSelectedResellerId('');
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const blob = await apiService.downloadSubscriberExcelTemplate();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'SubscribersTemplate.xlsx';
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      const templateData = [
        [...SUBSCRIBER_IMPORT_COLUMNS],
        ['ahmed123', 'أحمد', 'محمد', '2026-02-10', '2026-03-10', 'العادي', 'password123', '07901234567', '1212', '', '', ''],
      ];
      const blob = createXlsxBlob(templateData, 'المشتركين');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'template_subscribers.xlsx';
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      showError('ملف غير مدعوم', 'يرجى اختيار ملف Excel (.xlsx أو .xls)');
      return;
    }

    setSelectedFile(file);
    setImportResult(null);
  };

  const handleImport = () => {
    if (hasResellers && !selectedResellerId) {
      showError('مطلوب', 'يرجى اختيار المنطقة والرسيلر أولاً');
      return;
    }
    if (!selectedFile) {
      showError('مطلوب', 'يرجى اختيار ملف Excel');
      return;
    }

    setImportResult(null);
    importMutation.mutate({
      file: selectedFile,
      resellerId: selectedResellerId || undefined,
    });
  };

  const resetForm = () => {
    setSelectedFile(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const selectionReady = !hasResellers || !!selectedResellerId;
  const loadingLists = regionsLoading || resellersLoading;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-start gap-3 mb-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-900/30">
          <Users className="h-5 w-5 text-primary-600 dark:text-primary-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">استيراد المشتركين من Excel</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            حدّد المنطقة والرسيلر ثم ارفع ملف Excel بنفس أعمدة استيراد المدير لإضافة المشتركين.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {hasResellers && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  المنطقة *
                </label>
                <select
                  value={selectedRegionId}
                  onChange={(e) => handleRegionChange(e.target.value)}
                  disabled={loadingLists}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">اختر المنطقة...</option>
                  {myRegions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  الرسيلر *
                </label>
                <select
                  value={selectedResellerId}
                  onChange={(e) => setSelectedResellerId(e.target.value)}
                  disabled={loadingLists || !selectedRegionId}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white disabled:opacity-60"
                >
                  <option value="">
                    {selectedRegionId ? 'اختر الرسيلر...' : 'اختر المنطقة أولاً'}
                  </option>
                  {resellersInRegion.map((reseller) => (
                    <option key={reseller.id} value={reseller.id}>
                      {reseller.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ملف Excel *
            </label>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                selectionReady
                  ? 'border-gray-300 dark:border-gray-600 hover:border-primary-500'
                  : 'border-gray-200 dark:border-gray-700 opacity-60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                disabled={!selectionReady}
                className="hidden"
                id="subscriber-excel-import-upload"
              />
              <label
                htmlFor="subscriber-excel-import-upload"
                className={selectionReady ? 'cursor-pointer' : 'cursor-not-allowed'}
              >
                <FileSpreadsheet className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedFile ? selectedFile.name : 'اضغط لاختيار ملف Excel'}
                </p>
                {!selectionReady && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    اختر المنطقة والرسيلر قبل رفع الملف
                  </p>
                )}
              </label>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleImport}
              disabled={
                importMutation.isPending || !selectedFile || !selectionReady
              }
              className="flex-1 inline-flex items-center justify-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري الاستيراد...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  استيراد المشتركين
                </>
              )}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              إعادة تعيين
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-900/40 p-5 space-y-4">
          <h3 className="font-medium text-gray-900 dark:text-white">ترتيب الأعمدة (نفس استيراد المدير)</h3>
          <p className="text-xs text-amber-700 dark:text-amber-300">
            النظام يقرأ الأعمدة بالترتيب وليس حسب اسم العنوان.
          </p>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1.5">
            <li><strong>1 — Username</strong> (مطلوب)</li>
            <li><strong>2 — FirstName</strong></li>
            <li><strong>3 — LastName</strong></li>
            <li><strong>4 — ActivationDate</strong> (اختياري)</li>
            <li><strong>5 — Expire</strong> (اختياري)</li>
            <li><strong>6 — Profile</strong> (مطلوب — يطابق اسم الباقة)</li>
            <li><strong>7 — Password</strong> (مطلوب)</li>
            <li><strong>8 — Phone</strong> (اختياري)</li>
            <li><strong>9 — SecruptionId</strong> (اختياري)</li>
            <li><strong>10 — FDT</strong> (اختياري)</li>
            <li><strong>11 — FAT</strong> (اختياري)</li>
            <li><strong>12 — Zone</strong> (اختياري عند اختيار الرسيلر أعلاه)</li>
          </ul>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            disabled={downloadingTemplate}
            className="w-full inline-flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {downloadingTemplate ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            تحميل نموذج Excel
          </button>
        </div>
      </div>

      {importResult && (
        <div
          className={`mt-6 border rounded-lg p-4 ${
            (importResult.errorCount ?? 0) === 0
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
              : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
          }`}
        >
          <div className="flex items-start gap-2">
            {(importResult.errorCount ?? 0) === 0 ? (
              <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium">{importResult.message}</p>
              <p className="text-sm mt-1">
                نجح: {importResult.successCount ?? importResult.importedCount ?? 0} — أخطاء:{' '}
                {importResult.errorCount ?? importResult.failedCount ?? 0}
              </p>
              {importResult.errors && importResult.errors.length > 0 && (
                <ul className="mt-3 text-sm space-y-1 max-h-48 overflow-y-auto">
                  {importResult.errors.slice(0, 30).map((error, index) => (
                    <li key={index} className="flex items-start gap-1">
                      <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </li>
                  ))}
                </ul>
              )}
              {importResult.errorDetails && (
                <p className="mt-2 text-sm whitespace-pre-wrap">{importResult.errorDetails}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriberExcelImportSection;
