// =============================================================================
// PORTAL COMPONENT (TypeScript)
// =============================================================================
// Renders children directly to document.body, bypassing parent transforms
// that would break fixed positioning (common with modals and tooltips)

import { ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface PortalProps {
  /** Content to render in the portal */
  children: ReactNode;
  /** Target element to render into (defaults to document.body) */
  container?: Element;
}

const Portal: React.FC<PortalProps> = ({ children, container }) => {
  const target = container || document.body;
  return createPortal(children, target);
};

export default Portal;
