export default function FeeEstimator() {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded p-4">
      <h3 className="font-semibold text-blue-900 mb-2">Network Fee</h3>
      <p className="text-blue-700 text-sm">
        XRPL transaction fee: <strong>$0.0002</strong>
      </p>
      <p className="text-blue-700 text-sm text-xs mt-2">
        Settlement time: 3-5 seconds
      </p>
    </div>
  );
}
