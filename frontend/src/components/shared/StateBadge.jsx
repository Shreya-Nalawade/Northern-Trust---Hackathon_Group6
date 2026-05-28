import { getStateConfig } from '../../utils/helpers';

export function StateBadge({ state, isTask = false, size = 'md', pulse = false }) {
  const config = getStateConfig(state, isTask);
  const shouldPulse = pulse || state === 'RUNNING' || state === 'IN_PROGRESS';

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full border ${sizeClasses[size]}`}
      style={{
        color: config.color,
        backgroundColor: config.bg,
        borderColor: config.border,
      }}
    >
      {shouldPulse && (
        <span
          className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ backgroundColor: config.color }}
        />
      )}
      {config.label}
    </span>
  );
}

export default StateBadge;
