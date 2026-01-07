export default function FeedbackCTA() {
  const issueUrl = 'https://github.com/ci2000nahc/riplx/issues/new/choose';
  return (
    <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 p-4 rounded-lg flex flex-col gap-2">
      <div className="font-semibold">Developer feedback wanted</div>
      <div className="text-sm text-indigo-800">
        Share bugs, docs gaps, or UX friction. High-quality feedback contributes to the developer feedback bounty.
      </div>
      <div>
        <a
          href={issueUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-block bg-indigo-600 text-white px-3 py-2 rounded text-sm font-semibold hover:bg-indigo-700"
        >
          Open feedback form
        </a>
      </div>
    </div>
  );
}
