import EmptyState from "../components/EmptyState";
import { formatDate } from "../utils/lettering";

export default function DashboardView({ metrics, recentLetters }) {
  return (
    <section className="view is-active">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Overview</p>
          <h2>Operational snapshot</h2>
        </div>
      </div>

      <div className="metrics-grid">
        {metrics.map((item) => (
          <article className="metric-card" key={item.label}>
            <span className="metric-label">{item.label}</span>
            <strong className="metric-value">{item.value}</strong>
          </article>
        ))}
      </div>

      <div className="dashboard-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Recent activity</p>
              <h3>Latest issued letters</h3>
            </div>
          </div>
          {recentLetters.length ? (
            <div className="card-list">
              {recentLetters.map((letter) => (
                <div className="register-card" key={letter.id}>
                  <h4>{letter.subject}</h4>
                  <p>
                    {letter.letterNo} - {formatDate(letter.issueDate)}
                  </p>
                  <p>
                    {letter.recipientName} - {letter.companyName} / {letter.departmentName}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="Issued letters will appear here once the register starts filling up." />
          )}
        </article>

        <article className="panel panel-accent">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Checklist</p>
              <h3>Suggested next steps</h3>
            </div>
          </div>
          <ul className="checklist">
            <li>Add each company with short code, contact details, and default reference format.</li>
            <li>Create departments under each company before issuing letters.</li>
            <li>Maintain one template per letter type for cleaner issuing flow.</li>
            <li>Export the register regularly for management reporting.</li>
          </ul>
        </article>
      </div>
    </section>
  );
}
