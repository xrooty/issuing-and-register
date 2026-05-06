export default function EmptyState({ title = "No records yet", message = "Start by adding data from the available form." }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  );
}
