import { useState } from "react";
import EmptyState from "../components/EmptyState";
import { formatDate } from "../utils/lettering";

export default function ReportsView({ reports, onAddReport }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("summary");
  const [payload, setPayload] = useState("{}");

  return (
    <section className="view is-active">
      <div className="section-heading"><div><p className="eyebrow">Reports</p><h2>Saved reports</h2></div></div>
      <article className="panel">
        <form className="form-grid" onSubmit={async (e) => {
          e.preventDefault();
          let parsed = {};
          try { parsed = JSON.parse(payload || "{}"); } catch { parsed = {}; }
          const ok = await onAddReport({ title, type, payload: parsed });
          if (ok) { setTitle(""); setType("summary"); setPayload("{}"); }
        }}>
          <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
          <label>Type<input value={type} onChange={(e) => setType(e.target.value)} required /></label>
          <label className="span-2">Payload (JSON)<textarea rows={4} value={payload} onChange={(e) => setPayload(e.target.value)} /></label>
          <button className="button button-primary" type="submit">Save Report</button>
        </form>
      </article>
      <article className="panel">
        {reports.length ? <div className="table-wrap"><table><thead><tr><th>Date</th><th>Title</th><th>Type</th></tr></thead><tbody>
          {reports.map((report) => <tr key={report.id}><td>{formatDate(report.created_at)}</td><td>{report.title}</td><td>{report.type}</td></tr>)}
        </tbody></table></div> : <EmptyState message="No reports stored yet." />}
      </article>
    </section>
  );
}
