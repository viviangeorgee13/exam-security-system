export default function AuditLogTable({ logs }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No audit logs found.
      </div>
    );
  }

  const getEventColor = (eventType) => {
    if (eventType.includes('FAILED') || eventType.includes('LOCKED')) return 'bg-red-100 text-red-700';
    if (eventType.includes('ANOMALY')) return 'bg-orange-100 text-orange-700';
    if (eventType.includes('DOWNLOADED')) return 'bg-blue-100 text-blue-700';
    if (eventType.includes('RELEASED')) return 'bg-green-100 text-green-700';
    if (eventType.includes('LOGIN')) return 'bg-purple-100 text-purple-700';
    return 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b">
            <th className="text-left px-4 py-3 font-medium text-gray-600">Event</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">User</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Paper</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Time</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b hover:bg-gray-50">
              <td className="px-4 py-3">
                <span className={`px-2 py-1 rounded text-xs font-medium ${getEventColor(log.eventType)}`}>
                  {log.eventType}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-600">
                {log.user?.email || 'System'}
              </td>
              <td className="px-4 py-3 text-gray-600">
                {log.paperId ? log.paperId.slice(0, 8) + '...' : '-'}
              </td>
              <td className="px-4 py-3 text-gray-500">
                {new Date(log.createdAt).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}