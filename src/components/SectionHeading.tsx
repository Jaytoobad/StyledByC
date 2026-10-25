import { ReactNode } from 'react';

export type HeadingAlign = 'center' | 'left';

interface Props {
  eyebrow?: string;
  children: ReactNode;
  align?: HeadingAlign;
  as?: 'h1' | 'h2' | 'h3';
  className?: string;
}

/**
 * Reusable section heading: heading text followed by a short tan accent line.
 * The line inherits the heading alignment (centered on centered sections,
 * left-aligned on left-aligned ones). No browser underline is used.
 */
export function SectionHeading({
  eyebrow,
  children,
  align = 'center',
  as = 'h2',
  className,
}: Props) {
  const Tag = as;
  return (
    <div className={`section-head section-head--${align}${className ? ` ${className}` : ''}`}>
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <Tag className="section-heading">
        {children}
        <span className="section-heading__accent" aria-hidden="true" />
      </Tag>
    </div>
  );
}