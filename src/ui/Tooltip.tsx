import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

interface TooltipProps {
  content: string;
  children: ComponentChildren;
}

export function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      class="tooltip-container"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <button
        type="button"
        class="tooltip-trigger"
        aria-label="Information"
        onClick={() => setVisible(!visible)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
      >
        {children}
      </button>
      {visible && (
        <span class="tooltip-bubble" role="tooltip">
          {content}
        </span>
      )}
    </span>
  );
}
