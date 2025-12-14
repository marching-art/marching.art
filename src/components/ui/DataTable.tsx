import React, { memo, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Skeleton } from './Spinner';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export type ColumnAlign = 'left' | 'center' | 'right';

export interface DataTableColumn<T = Record<string, unknown>> {
  /** Unique key identifier for the column */
  key: string;
  /** Header text displayed in thead */
  header: React.ReactNode;
  /** Custom render function for cell content */
  render?: (row: T, rowIndex: number) => React.ReactNode;
  /** Column width (e.g., '100px', '20%', 'auto') */
  width?: string;
  /** Text alignment */
  align?: ColumnAlign;
  /** Whether this column should be sticky on mobile horizontal scroll */
  sticky?: boolean;
  /** Additional class names for header cell */
  headerClassName?: string;
  /** Additional class names for body cells */
  cellClassName?: string;
}

export interface DataTableProps<T = Record<string, unknown>> {
  /** Column definitions */
  columns: DataTableColumn<T>[];
  /** Data array to display */
  data: T[];
  /** Unique key extractor for rows (defaults to index) */
  getRowKey?: (row: T, index: number) => string | number;
  /** Click handler for rows */
  onRowClick?: (row: T, index: number) => void;
  /** Loading state - shows skeleton rows */
  isLoading?: boolean;
  /** Number of skeleton rows to show when loading */
  skeletonRows?: number;
  /** Enable zebra striping (alternating row backgrounds) */
  zebraStripes?: boolean;
  /** Mobile card renderer - renders cards instead of table rows on mobile */
  mobileCardRenderer?: (row: T, index: number) => React.ReactNode;
  /** Breakpoint for mobile card view (default: 'md') */
  mobileBreakpoint?: 'sm' | 'md' | 'lg';
  /** Empty state content when no data */
  emptyState?: React.ReactNode;
  /** Additional class name for the container */
  className?: string;
  /** Additional class name for the table */
  tableClassName?: string;
  /** Row height variant */
  rowHeight?: 'compact' | 'default';
  /** Maximum height for the table container (enables vertical scroll) */
  maxHeight?: string;
}

// =============================================================================
// STYLE CONSTANTS
// =============================================================================

const alignStyles: Record<ColumnAlign, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

const rowHeightStyles = {
  compact: 'h-10',
  default: 'h-12',
};

const breakpointStyles = {
  sm: 'sm:hidden',
  md: 'md:hidden',
  lg: 'lg:hidden',
};

const tableBreakpointStyles = {
  sm: 'hidden sm:block',
  md: 'hidden md:block',
  lg: 'hidden lg:block',
};

// =============================================================================
// MEMOIZED ROW COMPONENT
// =============================================================================

interface TableRowProps<T> {
  row: T;
  rowIndex: number;
  columns: DataTableColumn<T>[];
  onRowClick?: (row: T, index: number) => void;
  zebraStripes: boolean;
  rowHeight: 'compact' | 'default';
}

const TableRowComponent = <T extends Record<string, unknown>>({
  row,
  rowIndex,
  columns,
  onRowClick,
  zebraStripes,
  rowHeight,
}: TableRowProps<T>) => {
  const handleClick = useCallback(() => {
    onRowClick?.(row, rowIndex);
  }, [onRowClick, row, rowIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        onRowClick(row, rowIndex);
      }
    },
    [onRowClick, row, rowIndex]
  );

  const zebraClass = zebraStripes && rowIndex % 2 === 1 ? 'bg-cream-500/[0.02]' : '';
  const clickableClass = onRowClick
    ? 'cursor-pointer hover:bg-cream-500/5 focus:bg-cream-500/5 focus:outline-none'
    : '';

  return (
    <tr
      role="row"
      className={`
        ${rowHeightStyles[rowHeight]}
        border-b border-cream-500/5
        transition-colors duration-150
        ${zebraClass}
        ${clickableClass}
      `.trim()}
      onClick={onRowClick ? handleClick : undefined}
      onKeyDown={onRowClick ? handleKeyDown : undefined}
      tabIndex={onRowClick ? 0 : undefined}
    >
      {columns.map((column) => {
        const cellValue = column.render
          ? column.render(row, rowIndex)
          : (row[column.key] as React.ReactNode);

        return (
          <td
            key={column.key}
            className={`
              px-4 py-2 text-sm text-cream-500
              ${alignStyles[column.align || 'left']}
              ${column.sticky ? 'sticky left-0 bg-charcoal-900/95 backdrop-blur-sm z-10' : ''}
              ${column.cellClassName || ''}
            `.trim()}
            style={column.width ? { width: column.width, minWidth: column.width } : undefined}
          >
            {cellValue}
          </td>
        );
      })}
    </tr>
  );
};

// Memoize with generic type support
const TableRow = memo(TableRowComponent) as typeof TableRowComponent;

// =============================================================================
// SKELETON ROW COMPONENT
// =============================================================================

interface SkeletonRowProps<T> {
  columns: DataTableColumn<T>[];
  rowHeight: 'compact' | 'default';
}

const SkeletonRow = <T,>({ columns, rowHeight }: SkeletonRowProps<T>) => (
  <tr className={`${rowHeightStyles[rowHeight]} border-b border-cream-500/5`}>
    {columns.map((column) => (
      <td
        key={column.key}
        className={`
          px-4 py-2
          ${alignStyles[column.align || 'left']}
          ${column.sticky ? 'sticky left-0 bg-charcoal-900/95 backdrop-blur-sm z-10' : ''}
        `.trim()}
        style={column.width ? { width: column.width, minWidth: column.width } : undefined}
      >
        <Skeleton height={16} width="80%" rounded="sm" />
      </td>
    ))}
  </tr>
);

// =============================================================================
// MOBILE CARD LIST COMPONENT
// =============================================================================

interface MobileCardListProps<T> {
  data: T[];
  getRowKey: (row: T, index: number) => string | number;
  mobileCardRenderer: (row: T, index: number) => React.ReactNode;
}

const MobileCardList = <T,>({
  data,
  getRowKey,
  mobileCardRenderer,
}: MobileCardListProps<T>) => (
  <div className="space-y-3">
    {data.map((row, index) => (
      <motion.div
        key={getRowKey(row, index)}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.02, duration: 0.2 }}
      >
        {mobileCardRenderer(row, index)}
      </motion.div>
    ))}
  </div>
);

// =============================================================================
// EMPTY STATE COMPONENT
// =============================================================================

const DefaultEmptyState: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <div className="w-16 h-16 mb-4 rounded-full bg-cream-500/5 flex items-center justify-center">
      <svg
        className="w-8 h-8 text-cream-500/30"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
        />
      </svg>
    </div>
    <p className="text-sm text-cream-500/50 font-medium">No data available</p>
  </div>
);

// =============================================================================
// DATA TABLE COMPONENT
// =============================================================================

export const DataTable = <T extends Record<string, unknown>>({
  columns,
  data,
  getRowKey = (_, index) => index,
  onRowClick,
  isLoading = false,
  skeletonRows = 5,
  zebraStripes = true,
  mobileCardRenderer,
  mobileBreakpoint = 'md',
  emptyState,
  className = '',
  tableClassName = '',
  rowHeight = 'default',
  maxHeight,
}: DataTableProps<T>) => {
  // Memoize skeleton rows array
  const skeletonRowsArray = useMemo(
    () => Array.from({ length: skeletonRows }),
    [skeletonRows]
  );

  // Determine if we have sticky columns for horizontal scroll
  const hasStickyColumn = useMemo(
    () => columns.some((col) => col.sticky),
    [columns]
  );

  // Show loading state
  if (isLoading) {
    return (
      <div
        className={`
          bg-black/40 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden
          ${className}
        `.trim()}
      >
        <div className={maxHeight ? `overflow-auto` : ''} style={maxHeight ? { maxHeight } : undefined}>
          <table className={`w-full ${tableClassName}`}>
            <thead className="sticky top-0 z-20 bg-charcoal-900/95 backdrop-blur-sm">
              <tr className="border-b border-cream-500/10">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={`
                      px-4 py-3 text-xs font-display font-semibold text-cream-500/60 uppercase tracking-wider
                      ${alignStyles[column.align || 'left']}
                      ${column.sticky ? 'sticky left-0 bg-charcoal-900/95 backdrop-blur-sm z-30' : ''}
                      ${column.headerClassName || ''}
                    `.trim()}
                    style={column.width ? { width: column.width, minWidth: column.width } : undefined}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {skeletonRowsArray.map((_: unknown, index: number) => (
                <SkeletonRow<T> key={index} columns={columns} rowHeight={rowHeight} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Show empty state
  if (data.length === 0) {
    return (
      <div
        className={`
          bg-black/40 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden
          ${className}
        `.trim()}
      >
        {emptyState || <DefaultEmptyState />}
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Mobile Card View (when mobileCardRenderer is provided) */}
      {mobileCardRenderer && (
        <div className={breakpointStyles[mobileBreakpoint]}>
          <MobileCardList
            data={data}
            getRowKey={getRowKey}
            mobileCardRenderer={mobileCardRenderer}
          />
        </div>
      )}

      {/* Table View */}
      <div
        className={`
          bg-black/40 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden
          ${mobileCardRenderer ? tableBreakpointStyles[mobileBreakpoint] : ''}
        `.trim()}
      >
        <div
          className={`
            ${hasStickyColumn ? 'overflow-x-auto' : ''}
            ${maxHeight ? 'overflow-y-auto' : ''}
          `.trim()}
          style={maxHeight ? { maxHeight } : undefined}
        >
          <table className={`w-full ${tableClassName}`}>
            <thead className="sticky top-0 z-20 bg-charcoal-900/95 backdrop-blur-sm">
              <tr className="border-b border-cream-500/10">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={`
                      px-4 py-3 text-xs font-display font-semibold text-cream-500/60 uppercase tracking-wider
                      ${alignStyles[column.align || 'left']}
                      ${column.sticky ? 'sticky left-0 bg-charcoal-900/95 backdrop-blur-sm z-30' : ''}
                      ${column.headerClassName || ''}
                    `.trim()}
                    style={column.width ? { width: column.width, minWidth: column.width } : undefined}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, rowIndex) => (
                <TableRow<T>
                  key={getRowKey(row, rowIndex)}
                  row={row}
                  rowIndex={rowIndex}
                  columns={columns}
                  onRowClick={onRowClick}
                  zebraStripes={zebraStripes}
                  rowHeight={rowHeight}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

DataTable.displayName = 'DataTable';

export default DataTable;
