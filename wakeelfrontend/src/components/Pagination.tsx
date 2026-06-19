import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onPageChange: (page: number) => void;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
  className?: string;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  hasNextPage,
  hasPreviousPage,
  onPageChange,
  pageSizeOptions,
  onPageSizeChange,
  className = '',
}) => {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const safeCurrentPage = Math.max(1, Math.min(currentPage || 1, totalPages || 1));
  const computedHasPrev = safeCurrentPage > 1;
  const computedHasNext = safeCurrentPage < totalPages;

  const safeOnPageChange = (page: number) => {
    const next = Math.max(1, Math.min(page, totalPages || 1));
    onPageChange(next);
  };

  const getPageNumbers = (): (number | '...')[] => {
    if (totalPages <= 1) return [1];
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages = new Set<number>();
    pages.add(1);
    pages.add(totalPages);
    for (let d = -1; d <= 1; d++) {
      const p = safeCurrentPage + d;
      if (p >= 1 && p <= totalPages) pages.add(p);
    }

    const sorted = Array.from(pages).sort((a, b) => a - b);
    const result: (number | '...')[] = [];
    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      const prev = sorted[i - 1];
      if (prev != null && p - prev > 1) result.push('...');
      result.push(p);
    }
    return result;
  };

  const canPrev = hasPreviousPage ?? computedHasPrev;
  const canNext = hasNextPage ?? computedHasNext;

  return (
    <div className={`wakeel-table-pagination ${className}`.trim()}>
      <div className="flex flex-wrap items-center gap-3 order-2 sm:order-1">
        <p className="wakeel-table-pagination-meta">
          {totalItems === 0
            ? 'لا توجد عناصر'
            : `عرض ${startItem}–${endItem} من ${totalItems}`}
        </p>
        {pageSizeOptions && pageSizeOptions.length > 0 && onPageSizeChange && (
          <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span>عرض</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm"
              aria-label="عدد الصفوف في الصفحة"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span>سطر</span>
          </label>
        )}
      </div>

      <div className="wakeel-table-pagination-nav order-1 sm:order-2">
        <button
          type="button"
          onClick={() => safeOnPageChange(safeCurrentPage - 1)}
          disabled={!canPrev}
          className="wakeel-table-pagination-btn"
          aria-label="الصفحة السابقة"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {getPageNumbers().map((page, idx) =>
          page === '...' ? (
            <span key={`ellipsis-${idx}`} className="px-1 text-sm text-gray-400">
              …
            </span>
          ) : (
            <button
              key={page}
              type="button"
              onClick={() => safeOnPageChange(page)}
              aria-current={safeCurrentPage === page ? 'page' : undefined}
              className={`wakeel-table-pagination-btn ${
                safeCurrentPage === page ? 'wakeel-table-pagination-btn-active' : ''
              }`}
            >
              {page}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => safeOnPageChange(safeCurrentPage + 1)}
          disabled={!canNext}
          className="wakeel-table-pagination-btn"
          aria-label="الصفحة التالية"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
