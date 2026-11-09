export default function EmptyState({ icon = '📭', title, description, action }) {
  return (
    <div className="text-center py-12 px-4">
      <div className="text-5xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-slate-700 mb-2">
        {title || 'Nuk ka të dhëna'}
      </h3>
      {description && (
        <p className="text-sm text-slate-500 mb-4">{description}</p>
      )}
      {action}
    </div>
  );
}