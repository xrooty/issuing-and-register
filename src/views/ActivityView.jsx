import { useState } from "react";
import EmptyState from "../components/EmptyState";
import PaginationControls from "../components/PaginationControls";
import { formatDate } from "../utils/lettering";

export default function ActivityView({ entries }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedEntries = entries.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <section className="view is-active">
      <div className="section-heading"><div><p className="eyebrow">Activity</p><h2>Audit log</h2></div></div>
      <article className="panel">
        {entries.length ? (
          <>
            <PaginationControls
              page={currentPage}
              pageSize={pageSize}
              totalItems={entries.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
            <div className="table-wrap">
              <table>
                <thead><tr><th>When</th><th>Action</th><th>Who</th><th>Client</th><th>Issued By</th><th>Entity</th><th>Details</th></tr></thead>
                <tbody>
                  {paginatedEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatDate(entry.created_at)}</td>
                      <td>{entry.action}</td>
                      <td>{entry.actor_name || "-"}</td>
                      <td>{entry.client_name || "-"}</td>
                      <td>{entry.issued_by_name || "-"}</td>
                      <td>{entry.entity}</td>
                      <td>{entry.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : <EmptyState message="No activity log entries yet." />}
      </article>
    </section>
  );
}
