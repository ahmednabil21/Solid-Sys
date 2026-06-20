import React from 'react';

type ListPageWithFiltersProps = {
  sidebar?: React.ReactNode;
  children: React.ReactNode;
};

/** تخطيط قائمة: المحتوى + شريط فلترة المناطق/الرسيلرز على يمين الصفحة (RTL). */
const ListPageWithFilters: React.FC<ListPageWithFiltersProps> = ({ sidebar, children }) => {
  if (!sidebar) {
    return <>{children}</>;
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[11.5rem_minmax(0,1fr)] gap-4 items-start">
      <div className="order-1 xl:order-none">{sidebar}</div>
      <div className="min-w-0 order-2 xl:order-none">{children}</div>
    </div>
  );
};

export default ListPageWithFilters;
