type Props = {
  page: number;
  pageSize: number;
  totalItems: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

export function AdminPagination({
  page,
  pageSize,
  totalItems,
  itemLabel,
  onPageChange,
  onPageSizeChange,
}: Props) {
  if (totalItems === 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="admin-pagination">
      <div className="admin-muted">Showing {start}-{end} of {totalItems} {itemLabel}</div>
      <div className="admin-page-controls">
        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="admin-select admin-select-sm"
          aria-label={`Items per page for ${itemLabel}`}
        >
          {[10, 25, 50].map((size) => <option key={size} value={size}>{size} / page</option>)}
        </select>
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="btn btn-secondary btn-small"
          aria-label="Previous page"
        >
          Prev
        </button>
        <span className="admin-muted" aria-live="polite">Page {currentPage} of {totalPages}</span>
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="btn btn-secondary btn-small"
          aria-label="Next page"
        >
          Next
        </button>
      </div>
    </div>
  );
}
