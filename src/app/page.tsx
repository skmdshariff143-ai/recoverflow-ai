export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">PayBack AI</h1>
        <p className="text-lg text-gray-600">
          Predictive Revenue Recovery &amp; Prioritization Engine
        </p>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-left space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Build Progress
          </h2>
          <ul className="text-sm text-gray-700 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span>
                <strong>Milestone 1</strong> — Scaffold + Synthetic Data
                Generator (100+ records with payment history)
              </span>
            </li>
            <li className="flex items-start gap-2 text-gray-400">
              <span>○</span>
              <span>
                <strong>Milestone 2</strong> — Scoring Engine (probability +
                expected value + explanation)
              </span>
            </li>
            <li className="flex items-start gap-2 text-gray-400">
              <span>○</span>
              <span>
                <strong>Milestone 3</strong> — Ranking, Budget Allocation +
                Safety Rules
              </span>
            </li>
            <li className="flex items-start gap-2 text-gray-400">
              <span>○</span>
              <span>
                <strong>Milestone 4</strong> — Test-Mode Execution +
                Calibration
              </span>
            </li>
            <li className="flex items-start gap-2 text-gray-400">
              <span>○</span>
              <span>
                <strong>Milestone 5</strong> — Dashboard, Drill-down + Audit
                Explorer
              </span>
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}
