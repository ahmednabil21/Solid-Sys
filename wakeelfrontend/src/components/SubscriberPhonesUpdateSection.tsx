import React, { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Phone,
  Loader2,
} from 'lucide-react';
import { apiService, ApiService } from '../services/api';
import { ExcelImportAgent, ExcelImportResponse } from '../types';
import { showError, showSuccess } from '../utils/notifications';

type Props = {
  isAdmin: boolean;
};

const SubscriberPhonesUpdateSection: React.FC<Props> = ({ isAdmin }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ExcelImportResponse | null>(null);

  const { data: agents, isLoading: agentsLoading } = useQuery<ExcelImportAgent[]>({
    queryKey: ['excelImportAgents'],
    queryFn: () => apiService.getExcelImportAgents(),
    enabled: isAdmin,
  });

  const importMutation = useMutation({
    mutationFn: async ({ file, agentId }: { file: File; agentId?: string }) =>
      apiService.importSubscribersPhonesFromExcel(file, agentId),
    onSuccess: (data) => {
      setImportResult(data);
      if ((data.successCount ?? 0) > 0 && (data.errorCount ?? 0) === 0) {
        showSuccess('تم التحديث', data.message);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else if ((data.successCount ?? 0) > 0) {
        showSuccess('تم جزئياً', data.message);
      }
    },
    onError: (error: unknown) => {
      showError('فشل التحديث', ApiService.showError(error));
    },
  });

  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const blob = await apiService.downloadSubscriberPhonesExcelTemplate();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'SubscriberPhonesTemplate.xlsx';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showError('خطأ', ApiService.showError(error));
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
    if (isAdmin && !selectedAgentId) {
      showError('مطلوب', 'يرجى اختيار الوكيل');
      return;
    }
    if (!selectedFile) {
      showError('مطلوب', 'يرجى اختيار ملف Excel');
      return;
    }

    setImportResult(null);
    importMutation.mutate({
      file: selectedFile,
      agentId: isAdmin ? selectedAgentId : undefined,
    });
  };

  const resetForm = () => {
    setSelectedFile(null);
    setSelectedAgentId('');
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-start gap-3 mb-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-900/30">
          <Phone className="h-5 w-5 text-primary-600 dark:text-primary-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">تحديث أرقام المشتركين</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            ارفع ملف Excel لتحديث أرقام الهواتف للمشتركين الموجودين فقط دون تغيير باقي البيانات.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {isAdmin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                الوكيل *
              </label>
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                disabled={agentsLoading}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">اختر الوكيل...</option>
                {agents?.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.fullName} — {agent.companyName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ملف Excel *
            </label>
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-primary-500 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                id="phones-file-upload"
              />
              <label htmlFor="phones-file-upload" className="cursor-pointer">
                <FileSpreadsheet className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedFile ? selectedFile.name : 'اضغط لاختيار ملف Excel'}
                </p>
              </label>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleImport}
              disabled={importMutation.isPending || !selectedFile || (isAdmin && !selectedAgentId)}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري التحديث...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  تحديث الأرقام
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
          <h3 className="font-medium text-gray-900 dark:text-white">ترتيب الأعمدة المطلوبة</h3>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1.5">
            <li><strong>1 — Username</strong> (مطلوب) — اسم مستخدم المشترك</li>
            <li><strong>2 — FirstName</strong> — الاسم الأول</li>
            <li><strong>3 — LastName</strong> — اللقب (إن وُجد العمود)</li>
            <li className="text-gray-400">4–7 — غير مستخدمة (اتركها فارغة)</li>
            <li><strong>8 — Phone</strong> (مطلوب) — رقم الهاتف الجديد</li>
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
            تحميل قالب Excel
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
                نجح: {importResult.successCount ?? 0} — أخطاء: {importResult.errorCount ?? 0}
              </p>
              {importResult.errors && importResult.errors.length > 0 && (
                <ul className="mt-3 text-sm space-y-1 max-h-48 overflow-y-auto">
                  {importResult.errors.slice(0, 30).map((error, index) => (
                    <li key={index} className="flex items-start gap-1">
                      <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </li>
                  ))}
                  {importResult.errors.length > 30 && (
                    <li className="text-xs opacity-80">... و{importResult.errors.length - 30} خطأ إضافي</li>
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriberPhonesUpdateSection;
