import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  padding?: boolean;
  className?: string;
  noBorder?: boolean;
}

export default function Card({ children, title, subtitle, action, padding = true, className = '', noBorder }: CardProps) {
  return (
    <div className={`bg-white rounded-xl shadow-sm ${noBorder ? '' : 'border'} ${className}`}>
      {(title || action) && (
        <div className={`flex items-center justify-between ${padding ? 'px-6 pt-5 pb-0' : 'px-6 py-4 border-b'}`}>
          <div>
            {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
            {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={padding ? 'p-6' : ''}>{children}</div>
    </div>
  );
}

export function CardGrid({ children, cols = 4 }: { children: ReactNode; cols?: 1 | 2 | 3 | 4 }) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };
  return <div className={`grid ${gridCols[cols]} gap-4`}>{children}</div>;
}
