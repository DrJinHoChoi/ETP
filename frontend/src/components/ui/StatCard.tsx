interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: { value: number; label: string };
  variant?: 'default' | 'gradient-green' | 'gradient-blue' | 'gradient-indigo' | 'gradient-orange';
}

const gradients: Record<string, string> = {
  default: 'bg-white border',
  'gradient-green': 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white',
  'gradient-blue': 'bg-gradient-to-br from-blue-500 to-blue-700 text-white',
  'gradient-indigo': 'bg-gradient-to-br from-indigo-500 to-indigo-700 text-white',
  'gradient-orange': 'bg-gradient-to-br from-orange-500 to-orange-700 text-white',
};

export default function StatCard({ title, value, subtitle, icon, trend, variant = 'default' }: StatCardProps) {
  const isGradient = variant !== 'default';

  return (
    <div className={`p-5 rounded-xl shadow-sm ${gradients[variant]} transition-shadow hover:shadow-md`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className={`text-sm font-medium ${isGradient ? 'opacity-80' : 'text-gray-500'}`}>{title}</p>
          <p className={`text-2xl font-bold mt-1 ${isGradient ? '' : 'text-gray-900'}`}>{value}</p>
          {subtitle && (
            <p className={`text-xs mt-1 ${isGradient ? 'opacity-70' : 'text-gray-400'}`}>{subtitle}</p>
          )}
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend.value >= 0 ? (isGradient ? 'text-white' : 'text-emerald-600') : (isGradient ? 'text-red-200' : 'text-red-600')}`}>
              <span>{trend.value >= 0 ? '↑' : '↓'}</span>
              <span>{Math.abs(trend.value)}%</span>
              <span className={isGradient ? 'opacity-70' : 'text-gray-400'}>{trend.label}</span>
            </div>
          )}
        </div>
        {icon && (
          <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${isGradient ? 'bg-white/15' : 'bg-gray-100'}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
