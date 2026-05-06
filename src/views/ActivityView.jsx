import EmptyState from "../components/EmptyState";
import { formatDate } from "../utils/lettering";

export default function ActivityView({ entries }) {
  return (
    <section className="view is-active">
      <div className="section-heading"><div><p className="eyebrow">Activity</p><h2>Audit log</h2></div></div>
      <article className="panel">
        {entries.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>When</th><th>Action</th><th>Who</th><th>Client</th><th>Issued By</th><th>Entity</th><th>Details</th></tr></thead>
              <tbody>
                {entries.map((entry) => (
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
        ) : <EmptyState message="No activity log entries yet." />}
      </article>
    </section>
  );
}
