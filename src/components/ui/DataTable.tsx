// =============================================================================
// DATA TABLE - ESPN SPREADSHEET STYLE
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

  return (
    <tr
      role="row"
      className={`
        h-10 border-b border-[#333]/50
        ${zebraStripes && rowIndex % 2 === 1 ? 'bg-white/[0.03]' : ''}
        ${onRowClick ? 'cursor-pointer hover:bg-white/5' : ''}
        ${isHighlighted ? 'bg-[#0057B8]/10 border-l-2 border-l-[#0057B8]' : ''}
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
              px-2 py-1 text-sm
              ${isRankColumn ? 'font-bold text-center text-gray-300 w-12' : 'font-data text-gray-100'}
              ${alignStyles[column.align || 'left']}
              ${column.sticky ? 'sticky left-0 bg-[#1a1a1a] z-10' : ''}
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
  <tr className="h-10 border-b border-[#333]/50">
    {columns.map((column) => (
      <td
        key={column.key}
        className={`
          px-2 py-1
          ${alignStyles[column.align || 'left']}
          ${column.sticky ? 'sticky left-0 bg-[#1a1a1a] z-10' : ''}
        `.trim()}
        style={column.width ? { width: column.width, minWidth: column.width } : undefined}
      >
        <div className="h-4 bg-white/5 rounded animate-pulse" style={{ width: '70%' }} />
      </td>
    ))}
  </tr>
);

// =============================================================================
// EMPTY STATE COMPONENT
// =============================================================================

const DefaultEmptyState: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-8 text-center">
    <p className="text-sm text-gray-500">No data available</p>
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

  const skeletonRowsArray = useMemo(
    () => Array.from({ length: skeletonRows }),
    [skeletonRows]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className={`bg-[#1a1a1a] border border-[#333] ${className}`}>
        <div
          ref={scrollContainerRef}
          className="overflow-x-auto"
          style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}
        >
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#1a1a1a] border-b border-[#333]">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={`
                      px-2 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider
                      sticky top-0 bg-[#1a1a1a] z-20
                      ${alignStyles[column.align || 'left']}
                      ${column.sticky ? 'sticky left-0 z-30' : ''}
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
      <div className={`bg-[#1a1a1a] border border-[#333] ${className}`}>
        {emptyState || <DefaultEmptyState />}
      </div>
    );
  }

  return (
    <div className={`relative bg-[#0a0a0a] border border-[#333] ${className}`}>
      {/* Scrollable container */}
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto"
        style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}
      >
        <table className="w-full border-collapse">
          {/* Header - Sticky */}
          <thead>
            <tr className="bg-[#1a1a1a] border-b border-[#333]">
              {columns.map((column) => {
                const isRankColumn = column.isRank || column.key === 'rank';
                return (
                  <th
                    key={column.key}
                    scope="col"
                    className={`
                      px-2 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider
                      sticky top-0 bg-[#1a1a1a] z-20
                      ${isRankColumn ? 'text-center w-12' : alignStyles[column.align || 'left']}
                      ${column.sticky ? 'sticky left-0 z-30' : ''}
                      ${column.headerClassName || ''}
                    `.trim()}
                    style={column.width ? { width: column.width, minWidth: column.width } : undefined}
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
