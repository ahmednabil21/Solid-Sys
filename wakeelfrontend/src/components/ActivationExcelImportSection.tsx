import React, { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Receipt,
  Loader2,
} from 'lucide-react';
import { apiService, ApiService } from '../services/api';
import {
  AgentRegion,
  AgentReseller,
  ExcelImportResponse,
} from '../types';
import { showError, showSuccess } from '../utils/notifications';

const ACTIVATION_IMPORT_COLUMNS = [
  'دين اجور خدمة',
  'دين اشتراك',
  'واصل اجور خدمة',
  'واصل اشتراك',
  'اصل اجور',
  'اصل الاشتراك',
  'المقدار',
  'الرصيد',
  'رقم المعاملة',
  'التاريخ',
  'الاشتراك',
  'بطاقة تعريف',
  'رمز الاشتراك',
  'النوع',
  'الرقم التسلسلي',
  'المشترك',
  'معرف المشترك',
  'تاريخ البدء',
  'تاريخ الانتهاء',
  'نوع الدفع',
] as const;

const ActivationExcelImportSection: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [selectedResellerId, setSelectedResellerId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ExcelImportResponse | null>(null);

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
    }) => apiService.importActivationsFromExcel(file, { resellerId }),
    onSuccess: (data) => {
      setImportResult(data);
      const errors = data.errorCount ?? 0;
      const success = data.successCount ?? 0;
      const activations = data.activationsCreated ?? 0;
      const skipped = data.skippedCount ?? 0;
      if (errors === 0 && success > 0) {
        showSuccess(
          'تم الاستيراد',
          `تمت معالجة ${success} صفاً — ${activations} تفعيلاً${skipped > 0 ? ` — تخطي ${skipped}` : ''}`,
        );
      } else if (success > 0) {
        showSuccess('تم جزئياً', `نجح ${success} صف — ${activations} تفعيل — أخطاء ${errors}`);
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
          <Receipt className="h-5 w-5 text-primary-600 dark:text-primary-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">رفع اكسل تفعيلات</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            استيراد تفعيلات من ملف Excel مع تقسيم الفترات المتعددة، محفظة الزبون، الديون، والحسابات.
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                >
                  <option value="">اختر المنطقة</option>
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                >
                  <option value="">اختر الرسيلر</option>
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
              ملف Excel
            </label>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white"
              >
                <FileSpreadsheet className="h-4 w-4" />
                اختيار ملف
              </button>
              {selectedFile && (
                <span className="text-sm text-gray-600 dark:text-gray-400 truncate">
                  {selectedFile.name}
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleImport}
              disabled={importMutation.isPending || !selectedFile || !selectionReady}
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
                  رفع التفعيلات
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
          <h3 className="font-medium text-gray-900 dark:text-white">أعمدة الملف (حسب العنوان)</h3>
          <p className="text-xs text-amber-700 dark:text-amber-300">
            يُقسّم التفعيل تلقائياً عند تجاوز شهر واحد. يُتخطى الصف فقط إذا وُجد نفس رقم المعاملة مسبقاً في الاستيراد — المشتركون الموجودون يُحدَّثون وتُنشأ تفعيلات جديدة.
          </p>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 max-h-64 overflow-y-auto">
            {ACTIVATION_IMPORT_COLUMNS.map((col) => (
              <li key={col}>
                <strong>{col}</strong>
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            المطابقة تتم أولاً برمز الاشتراك (اسم المستخدم). معرف الاشتراك يُستخدم فقط عند غياب الرمز.
          </p>
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
              <p className="font-medium">نتيجة الاستيراد</p>
              <p className="text-sm mt-1">
                صفوف ناجحة: {importResult.successCount ?? 0} — تفعيلات مُنشأة:{' '}
                {importResult.activationsCreated ?? 0} — تخطي: {importResult.skippedCount ?? 0} — أخطاء:{' '}
                {importResult.errorCount ?? 0}
              </p>
              {importResult.errorDetails && (
                <p className="mt-2 text-sm whitespace-pre-wrap break-words">{importResult.errorDetails}</p>
              )}
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivationExcelImportSection;
