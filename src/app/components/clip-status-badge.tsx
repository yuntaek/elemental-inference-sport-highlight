import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import type { ClipStatus } from '@/app/types/events';

interface ClipStatusBadgeProps {
  status: ClipStatus;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig: Record<ClipStatus, {
  label: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  PENDING: {
    label: '대기 중',
    bgColor: 'bg-gray-500/10',
    textColor: 'text-gray-400',
    borderColor: 'border-gray-500/30',
    icon: Clock,
  },
  PROCESSING: {
    label: '처리 중',
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-400',
    borderColor: 'border-blue-500/30',
    icon: Loader2,
  },
  COMPLETED: {
    label: '완료',
    bgColor: 'bg-green-500/10',
    textColor: 'text-green-400',
    borderColor: 'border-green-500/30',
    icon: CheckCircle,
  },
  FAILED: {
    label: '실패',
    bgColor: 'bg-red-500/10',
    textColor: 'text-red-400',
    borderColor: 'border-red-500/30',
    icon: XCircle,
  },
};

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5 gap-1',
  md: 'text-sm px-3 py-1 gap-1.5',
  lg: 'text-base px-4 py-1.5 gap-2',
};

const iconSizes = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

export function ClipStatusBadge({ status, size = 'md' }: ClipStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const isProcessing = status === 'PROCESSING';

  return (
    <span
      className={`inline-flex items-center rounded-full border ${config.bgColor} ${config.textColor} ${config.borderColor} ${sizeClasses[size]}`}
    >
      <Icon className={`${iconSizes[size]} ${isProcessing ? 'animate-spin' : ''}`} />
      {config.label}
    </span>
  );
}
