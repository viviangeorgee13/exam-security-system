import { resolveAnomaly } from '../services/api';

export default function AnomalyCard({ anomaly, onResolved }) {
  const getRiskColor = (score) => {
    if (score >= 80) return 'border-red-500 bg-red-50';
    if (score >= 50) return 'border-orange-500 bg-orange-50';
    return 'border-yellow-500 bg-yellow-50';
  };

  const getRiskLabel = (score) => {
    if (score >= 80) return { text: 'HIGH RISK', color: 'text-red-600' };
    if (score >= 50) return { text: 'MEDIUM RISK', color: 'text-orange-600' };
    return { text: 'LOW RISK', color: 'text-yellow-600' };
  };

  const handleResolve = async () => {
    try {
      await resolveAnomaly(anomaly.id);
      if (onResolved) onResolved();
    } catch (err) {
      alert('Failed to resolve anomaly');
    }
  };

  const risk = getRiskLabel(anomaly.riskScore);

  return (
    <div className={`border-l-4 rounded-lg p-4 mb-4 ${getRiskColor(anomaly.riskScore)}`}>
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`font-bold text-sm ${risk.color}`}>
              {risk.text}
            </span>
            <span className="text-gray-500 text-sm">
              Score: <strong>{anomaly.riskScore}</strong>
            </span>
          </div>
          <p className="text-gray-800 font-medium">
            {anomaly.user?.name} ({anomaly.user?.email})
          </p>
          <p className="text-gray-600 text-sm">
            Paper: {anomaly.paper?.title}
          </p>
          <ul className="mt-2 text-sm text-gray-600 list-disc list-inside">
            {Array.isArray(anomaly.reasons) && anomaly.reasons.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
          <p className="text-gray-400 text-xs mt-2">
            {new Date(anomaly.createdAt).toLocaleString()}
          </p>
        </div>
        <div>
          {anomaly.resolved ? (
            <span className="text-green-600 text-sm font-medium">✅ Resolved</span>
          ) : (
            <button
              onClick={handleResolve}
              className="bg-white border border-gray-300 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-50"
            >
              Resolve
            </button>
          )}
        </div>
      </div>
    </div>
  );
}