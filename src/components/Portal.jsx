// src/components/Portal.jsx
import { createPortal } from 'react-dom';

/**
 * Portal component to render children directly to document.body
 * This bypasses any parent transforms that would break fixed positioning
 */
const Portal = ({ children }) => {
  return createPortal(children, document.body);
};

export default Portal;
