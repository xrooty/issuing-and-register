import { useMemo, useState } from "react";
import EmptyState from "../components/EmptyState";
import PaginationControls from "../components/PaginationControls";

export default function AllClientsView({ clients, permissions, onDeleteClient, onOpenClient, onEditClient }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return clients.filter((client) => {
      const matchStatus = !statusFilter || String(client.status || "").toLowerCase() === statusFilter.toLowerCase();
      if (!needle) return matchStatus;
      const hay = [
        client.client_name,
        client.company,
        client.contact_name,
        client.email,
        client.phone,
        client.city,
        client.industry,
      ].join(" ").toLowerCase();
      return matchStatus && hay.includes(needle);
    });
  }, [clients, query, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedClients = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <section className="view is-active">
      <div className="section-heading"><div><p className="eyebrow">CRM</p><h2>All Clients</h2></div></div>
      <article className="panel">
        <div className="filters">
          <label>Search<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, company, email, phone..." /></label>
          <label>Status
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All</option>
              <option value="active">active</option>
              <option value="on_hold">on_hold</option>
              <option value="closed">closed</option>
            </select>
          </label>
        </div>

        {filtered.length ? (
          <>
            <PaginationControls
              page={currentPage}
              pageSize={pageSize}
              totalItems={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
            <div className="table-wrap">
              <table>
                <thead><tr><th>Client</th><th>Company</th><th>Email</th><th>Phone</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {paginatedClients.map((client) => (
                    <tr key={client.id}>
                      <td>{client.client_name}</td>
                      <td>{client.company}</td>
                      <td>{client.email}</td>
                      <td>{client.phone}</td>
                      <td>{client.status}</td>
                      <td>
                        <div className="row-actions">
                          <button className="button button-secondary" type="button" onClick={() => onOpenClient(client.id)}>View Client</button>
                          {permissions?.edit && <button className="button button-secondary" type="button" onClick={() => onEditClient?.(client.id)}>Edit</button>}
                          {permissions?.delete && <button className="button button-secondary" type="button" onClick={() => onDeleteClient(client.id)}>Delete</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : <EmptyState message="No clients found." />}
      </article>
    </section>
  );
}
