import { useState, type ReactNode } from 'react';

interface CollapsibleSectionProps {
  title: string;
  defaultExpanded?: boolean;
  children: ReactNode;
}

export function CollapsibleSection({
  title,
  defaultExpanded = false,
  children,
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <section className={`control-section collapsible-section${expanded ? ' is-expanded' : ''}`}>
      <button
        type="button"
        className="collapsible-section-header"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
      >
        <span className="collapsible-section-title">{title}</span>
        <span className="collapsible-section-icon">{expanded ? '−' : '+'}</span>
      </button>
      {expanded ? <div className="collapsible-section-body">{children}</div> : null}
    </section>
  );
}
