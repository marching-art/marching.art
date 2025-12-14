// =============================================================================
// UI COMPONENT LIBRARY
// =============================================================================
// Centralized exports for all shared UI components.
// Usage: import { Button, Card, Modal } from '@/components/ui';

// Button Components
export {
  Button,
  IconButton,
  type ButtonProps,
  type IconButtonProps,
  type ButtonVariant,
  type ButtonSize,
} from './Button';

// Card Components
export {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  type CardProps,
  type CardHeaderProps,
  type CardContentProps,
  type CardFooterProps,
  type CardVariant,
} from './Card';

// Modal Components
export {
  Modal,
  ConfirmModal,
  type ModalProps,
  type ConfirmModalProps,
  type ModalSize,
} from './Modal';

// Tabs Components
export {
  Tabs,
  TabsList,
  TabTrigger,
  TabContent,
  SimpleTabs,
  type TabsProps,
  type TabsListProps,
  type TabTriggerProps,
  type TabContentProps,
  type SimpleTab,
  type SimpleTabsProps,
  type TabsVariant,
} from './Tabs';

// Badge Components
export {
  Badge,
  StatusBadge,
  type BadgeProps,
  type BadgeVariant,
  type BadgeSize,
  type StatusBadgeProps,
  type StatusType,
} from './Badge';

// Input Components
export {
  Input,
  Textarea,
  Select,
  type InputProps,
  type TextareaProps,
  type SelectProps,
  type SelectOption,
} from './Input';

// Loading Components
export {
  Spinner,
  LoadingOverlay,
  FullPageLoading,
  Skeleton,
  SkeletonText,
  type SpinnerProps,
  type SpinnerSize,
  type SpinnerVariant,
  type LoadingOverlayProps,
  type FullPageLoadingProps,
  type SkeletonProps,
  type SkeletonTextProps,
} from './Spinner';

// Command Console Components (System Boot / Empty States)
export {
  SystemLoader,
  ConsoleLoadingOverlay,
  ConsoleEmptyState,
  type SystemLoaderProps,
  type ConsoleLoadingOverlayProps,
  type ConsoleEmptyStateProps,
  type EmptyStateVariant,
} from './CommandConsole';

// Error Boundary Components
export {
  ErrorBoundary,
  ErrorFallback,
  FeatureErrorBoundary,
  type ErrorBoundaryProps,
  type ErrorBoundaryState,
  type ErrorFallbackProps,
  type FeatureErrorBoundaryProps,
} from './ErrorBoundary';

// DataTable Components
export {
  DataTable,
  type DataTableProps,
  type DataTableColumn,
  type ColumnAlign,
} from './DataTable';
