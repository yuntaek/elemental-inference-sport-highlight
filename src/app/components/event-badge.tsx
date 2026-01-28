import type { EventType } from '@/app/types/events';
import { getEventColor } from '@/app/utils/event-colors';

interface EventBadgeProps {
  type: EventType;
  size?: 'sm' | 'md' | 'lg';
}

export function EventBadge({ type, size = 'md' }: EventBadgeProps) {
  const colors = getEventColor(type);
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5'
  };

  const displayName = type.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full ${colors.bg} ${colors.text} border ${colors.border} ${sizeClasses[size]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${colors.badge}`} />
      {displayName}
    </span>
  );
}
