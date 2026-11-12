import React from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';

export type StatusKind = 'success' | 'error' | 'info' | 'warning';

export interface StatusMessageProps {
  kind: StatusKind;
  children: React.ReactNode;
  /** Optional bold first line. */
  title?: React.ReactNode;
  className?: string;
}

const STYLES: Record<StatusKind, { fg: string; bg: string; border: string; Icon: typeof Info }> = {
  success: { fg: 'var(--success-text)', bg: 'var(--success-soft)', border: 'var(--success)', Icon: CircleCheck },
  error: { fg: 'var(--danger-text)', bg: 'var(--danger-soft)', border: 'var(--danger)', Icon: CircleAlert },
  warning: { fg: 'var(--warning-text)', bg: 'var(--warning-soft)', border: 'var(--warning)', Icon: TriangleAlert },
  info: { fg: 'var(--accent-strong)', bg: 'var(--info-soft)', border: 'var(--accent)', Icon: Info },
};

/**
 * Inline status / feedback message styled with the semantic tokens
 * (--success / --warning / --danger / --accent). Errors use role="alert"
 * (assertive); other kinds use role="status" with aria-live="polite".
 * Mount the component once and change its children for repeated announcements.
 *
 * @example
 * {error && <StatusMessage kind="error">{isFa ? 'بارگذاری فایل ناموفق بود' : 'Failed to decode audio file'}</StatusMessage>}
 * <StatusMessage kind="success" title={isFa ? 'ذخیره شد' : 'Saved'}>{name}</StatusMessage>
 */
export function StatusMessage({ kind, children, title, className = '' }: StatusMessageProps) {
  const s = STYLES[kind];
  const { Icon } = s;
  const isError = kind === 'error';
  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={`flex items-start gap-2 rounded-control border px-3 py-2 text-xs leading-relaxed ${className}`}
      style={{
        color: s.fg,
        background: s.bg,
        borderColor: `color-mix(in srgb, ${s.border} 35%, transparent)`,
      }}
    >
      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}

export default StatusMessage;
