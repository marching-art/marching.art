// =============================================================================
// DATA TABLE - SPREADSHEET STYLE
// =============================================================================
// The heart of the app. Excel, not SaaS.
// Laws: Dense cells (px-2), no rounded corners, zebra striping, sticky header

import React, { memo, useCallback, useMemo, useRef, useState, useEffect } from 'react';

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
  /** Whether this column should be sticky on horizontal scroll */
  sticky?: boolean;
  /** Additional class names for header cell */
  headerClassName?: string;
  /** Additional class names for body cells */
  cellClassName?: string;
  /** Is this a rank column? (special bold centered styling) */
  isRank?: boolean;
  /** Hide this column below the sm breakpoint. Use for low-priority columns
   *  so phones see the essentials instead of relying purely on horizontal
   *  scroll. Applied via CSS (hidden sm:table-cell) — no resize listeners. */
  hideOnMobile?: boolean;
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
  /** Enable zebra striping (default: true) */
  zebraStripes?: boolean;
  /** Empty state content when no data */
  emptyState?: React.ReactNode;
  /** Additional class name for the container */
  className?: string;
  /** Maximum height for vertical scroll */
  maxHeight?: string;
  /** Function to determine if a row should be highlighted */
  highlightRow?: (row: T, index: number) => boolean;
}

// =============================================================================
// STYLE CONSTANTS
// =============================================================================

const alignStyles: Record<ColumnAlign, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

// =============================================================================
// TABLE ROW COMPONENT
// =============================================================================

interface TableRowProps<T> {
  row: T;
  rowIndex: number;
  columns: DataTableColumn<T>[];
  onRowClick?: (row: T, index: number) => void;
  zebraStripes: boolean;
  isHighlighted: boolean;
}

const TableRowComponent = <T extends Record<string, unknown>>({
  row,
  rowIndex,
  columns,
  onRowClick,
  zebraStripes,
  isHighlighted,
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

  // Determine background for zebra and sticky cells
  const rowBg = zebraStripes && rowIndex % 2 === 1 ? 'bg-surface-sunken' : 'bg-surface-card';

  return (
    <tr
      role="row"
      className={`
        h-11 border-b border-line/50
        ${rowBg}
        ${onRowClick ? 'cursor-pointer hover:bg-surface-raised' : ''}
        ${isHighlighted ? '!bg-interactive/10 border-l-2 border-l-interactive' : ''}
      `.trim()}
      onClick={onRowClick ? handleClick : undefined}
      onKeyDown={onRowClick ? handleKeyDown : undefined}
      tabIndex={onRowClick ? 0 : undefined}
    >
      {columns.map((column) => {
        const cellValue = column.render
          ? column.render(row, rowIndex)
          : (row[column.key] as React.ReactNode);

        const isRankColumn = column.isRank || column.key === 'rank';

        return (
          <td
            key={column.key}
            className={`
              px-3 py-1.5 text-sm
              ${isRankColumn ? 'font-bold text-center text-secondary w-12' : 'font-data text-main'}
              ${alignStyles[column.align || 'left']}
              ${column.sticky ? `sticky left-0 ${rowBg} z-10` : ''}
              ${column.hideOnMobile ? 'hidden sm:table-cell' : ''}
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

const TableRow = memo(TableRowComponent) as typeof TableRowComponent;

// =============================================================================
// SKELETON ROW COMPONENT
// =============================================================================

interface SkeletonRowProps<T> {
  columns: DataTableColumn<T>[];
}

const SkeletonRow = <T,>({ columns }: SkeletonRowProps<T>) => (
  <tr className="h-10 border-b border-line/50">
    {columns.map((column) => (
      <td
        key={column.key}
        className={`
          px-2 py-1
          ${alignStyles[column.align || 'left']}
          ${column.sticky ? 'sticky left-0 bg-surface-card z-10' : ''}
          ${column.hideOnMobile ? 'hidden sm:table-cell' : ''}
        `.trim()}
        style={column.width ? { width: column.width, minWidth: column.width } : undefined}
      >
        <div className="h-4 bg-white/5 rounded-none animate-pulse" style={{ width: '70%' }} />
      </td>
    ))}
  </tr>
);

// =============================================================================
// EMPTY STATE COMPONENT
// =============================================================================

const DefaultEmptyState: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-8 text-center">
    <p className="text-sm text-muted">No data available</p>
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
  emptyState,
  className = '',
  maxHeight,
  highlightRow,
}: DataTableProps<T>) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check if horizontally scrollable
  useEffect(() => {
    const checkScroll = () => {
      const el = scrollContainerRef.current;
      if (el) {
        const hasMore = el.scrollWidth > el.clientWidth;
        const notAtEnd = el.scrollLeft < el.scrollWidth - el.clientWidth - 1;
        setCanScrollRight(hasMore && notAtEnd);
      }
    };

    checkScroll();
    window.addEventListener('resize', checkScroll);
    const el = scrollContainerRef.current;
    el?.addEventListener('scroll', checkScroll);

    return () => {
      window.removeEventListener('resize', checkScroll);
      el?.removeEventListener('scroll', checkScroll);
    };
  }, [data, columns]);

  const skeletonRowsArray = useMemo(() => Array.from({ length: skeletonRows }), [skeletonRows]);

  // Loading state
  if (isLoading) {
    return (
      <div className={`bg-surface-card border border-line ${className}`}>
        <div
          ref={scrollContainerRef}
          className="overflow-x-auto"
          style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}
        >
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface-card border-b border-line">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={`
                      px-2 py-2 text-[10px] font-bold text-muted uppercase tracking-wider
                      sticky top-0 bg-surface-card z-20
                      ${column.hideOnMobile ? 'hidden sm:table-cell' : ''}
                      ${alignStyles[column.align || 'left']}
                      ${column.sticky ? 'sticky left-0 z-30' : ''}
                      ${column.headerClassName || ''}
                    `.trim()}
                    style={
                      column.width ? { width: column.width, minWidth: column.width } : undefined
                    }
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {skeletonRowsArray.map((_, index) => (
                <SkeletonRow<T> key={index} columns={columns} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className={`bg-surface-card border border-line ${className}`}>
        {emptyState || <DefaultEmptyState />}
      </div>
    );
  }

  return (
    <div className={`relative bg-background border border-line ${className}`}>
      {/* Scrollable container */}
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto"
        style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}
      >
        <table className="w-full border-collapse">
          {/* Header - Sticky */}
          <thead>
            <tr className="bg-surface-card border-b border-line">
              {columns.map((column) => {
                const isRankColumn = column.isRank || column.key === 'rank';
                return (
                  <th
                    key={column.key}
                    scope="col"
                    className={`
                      px-2 py-2 text-[10px] font-bold text-muted uppercase tracking-wider
                      sticky top-0 bg-surface-card z-20
                      ${column.hideOnMobile ? 'hidden sm:table-cell' : ''}
                      ${isRankColumn ? 'text-center w-12' : alignStyles[column.align || 'left']}
                      ${column.sticky ? 'sticky left-0 z-30' : ''}
                      ${column.headerClassName || ''}
                    `.trim()}
                    style={
                      column.width ? { width: column.width, minWidth: column.width } : undefined
                    }
                  >
                    {column.header}
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Body - Zebra striped */}
          <tbody>
            {data.map((row, rowIndex) => (
              <TableRow<T>
                key={getRowKey(row, rowIndex)}
                row={row}
                rowIndex={rowIndex}
                columns={columns}
                onRowClick={onRowClick}
                zebraStripes={zebraStripes}
                isHighlighted={highlightRow ? highlightRow(row, rowIndex) : false}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Scroll hint - subtle right edge fade */}
      {canScrollRight && (
        <div
          className="absolute top-0 right-0 bottom-0 w-6 pointer-events-none bg-gradient-to-l from-[#0a0a0a] to-transparent"
          aria-hidden="true"
        />
      )}
    </div>
  );
};

DataTable.displayName = 'DataTable';

export default DataTable;
