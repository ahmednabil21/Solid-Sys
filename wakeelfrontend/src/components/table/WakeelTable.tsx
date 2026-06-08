import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

/** غلاف الكارد — مثل TableCard.Root */
export function TableCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`wakeel-table-card ${className}`.trim()}>{children}</div>;
}

export function Table({
  children,
  className = '',
  plain = false,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement> & { plain?: boolean }) {
  return (
    <table
      className={`min-w-full text-right ${plain ? 'table-plain' : ''} ${className}`.trim()}
      {...props}
    >
      {children}
    </table>
  );
}

export function TableHeader({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <thead className={className}>{children}</thead>;
}

export function TableHeadRow({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <tr className={className}>{children}</tr>;
}

export type TableSortDirection = 'asc' | 'desc' | null;

export function TableHead({
  children,
  className = '',
  sortable,
  sortDirection = null,
  onSort,
  align = 'right',
}: {
  children: React.ReactNode;
  className?: string;
  sortable?: boolean;
  sortDirection?: TableSortDirection;
  onSort?: () => void;
  align?: 'right' | 'left' | 'center';
}) {
  const alignClass =
    align === 'center' ? 'text-center' : align === 'left' ? 'text-left' : 'text-right';

  const label = sortable ? (
    <button
      type="button"
      onClick={onSort}
      className="inline-flex items-center gap-1 hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded"
    >
      <span>{children}</span>
      {sortDirection === 'asc' ? (
        <ChevronUp className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
      ) : sortDirection === 'desc' ? (
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
      ) : (
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-30" aria-hidden />
      )}
    </button>
  ) : (
    children
  );

  return (
    <th scope="col" className={`${alignClass} ${className}`.trim()}>
      {label}
    </th>
  );
}

export function TableBody({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <tbody className={className}>{children}</tbody>;
}

export function TableRow({
  children,
  className = '',
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={className} {...props}>
      {children}
    </tr>
  );
}

export function TableCell({
  children,
  className = '',
  align = 'right',
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & {
  align?: 'right' | 'left' | 'center';
}) {
  const alignClass =
    align === 'center' ? 'text-center' : align === 'left' ? 'text-left' : 'text-right';
  return (
    <td className={`${alignClass} ${className}`.trim()} {...props}>
      {children}
    </td>
  );
}

/** غلاف التمرير — يُستخدم داخل TableCard أو منفرداً */
export function TableScroll({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`wakeel-table-scroll ${className}`.trim()}>{children}</div>;
}
