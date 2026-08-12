import React from 'react';

const cx = (...classes: Array<string | false | null | undefined>): string => classes.filter(Boolean).join(' ');

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  variant = 'primary',
  loading = false,
  disabled,
  className,
  children,
  ...props
}, ref) {
  return (
    <button
      ref={ref}
      className={cx('ui-button', `ui-button-${variant}`, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {children}
    </button>
  );
});

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cx('ui-input', className)} {...props} />;
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cx('ui-textarea', className)} {...props} />;
});

export const Label: React.FC<React.LabelHTMLAttributes<HTMLLabelElement>> = ({ className, ...props }) => (
  <label className={cx('ui-label', className)} {...props} />
);

export interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  muted?: boolean;
}

export const Surface = React.forwardRef<HTMLDivElement, SurfaceProps>(function Surface({ muted = false, className, ...props }, ref) {
  return <div ref={ref} className={cx('ui-surface', muted && 'ui-surface-muted', className)} {...props} />;
});

type BadgeTone = 'neutral' | 'success' | 'warning';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export const Badge: React.FC<BadgeProps> = ({ tone = 'neutral', className, ...props }) => (
  <span className={cx('ui-badge', tone !== 'neutral' && `ui-badge-${tone}`, className)} {...props} />
);

type MessageTone = 'muted' | 'error' | 'success';

export interface FieldMessageProps extends React.HTMLAttributes<HTMLParagraphElement> {
  tone?: MessageTone;
}

export const FieldMessage: React.FC<FieldMessageProps> = ({ tone = 'muted', className, ...props }) => (
  <p
    className={cx('ui-field-message', tone !== 'muted' && `ui-field-message-${tone}`, className)}
    role={tone === 'error' ? 'alert' : props.role}
    {...props}
  />
);

export interface PageHeaderProps extends React.HTMLAttributes<HTMLElement> {
  title: string;
  description?: string;
  eyebrow?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, eyebrow, className, ...props }) => (
  <header className={cx('ui-page-header', className)} {...props}>
    {eyebrow && <Badge>{eyebrow}</Badge>}
    <h1 className={eyebrow ? 'mt-3' : undefined}>{title}</h1>
    {description && <p>{description}</p>}
  </header>
);

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, action, className, ...props }) => (
  <div className={cx('ui-empty-state', className)} {...props}>
    <h2>{title}</h2>
    {description && <p>{description}</p>}
    {action}
  </div>
);
