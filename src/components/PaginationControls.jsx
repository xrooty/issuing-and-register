export const PAGE_SIZE_OPTIONS = [10, 20, 50];

export default function PaginationControls({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems ? (page - 1) * pageSize + 1 : 0;
  const endItem = Math.min(totalItems, page * pageSize);

  return (
    <div className="pagination-controls">
      <label>
        Rows
        <select
          value={pageSize}
          onChange={(event) => {
            onPageSizeChange(Number(event.target.value));
            onPageChange(1);
          }}
        >
          {PAGE_SIZE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <span>
        {startItem}-{endItem} of {totalItems}
      </span>
      <div className="row-actions">
        <button
          className="button button-secondary"
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          Previous
        </button>
        <button
          className="button button-secondary"
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}
