import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WalletConnect from './components/WalletConnect';
import BalanceDisplay from './components/BalanceDisplay';
import SendForm from './components/SendForm';
import TransactionHistory from './components/TransactionHistory';
import SwapForm from './components/SwapForm';
import FeedbackCTA from './components/FeedbackCTA';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-amber-100 border-b border-amber-200 text-amber-900 text-sm text-center py-2">
          XRPL Testnet mode • Uses testnet RPC and assets only
        </div>
        <header className="bg-white shadow">
          <div className="max-w-4xl mx-auto px-4 py-6">
            <h1 className="text-3xl font-bold text-gray-900">
              RLUSD Payment App
            </h1>
            <p className="text-gray-600 mt-2">
              Send RLUSD instantly with 3-5 second settlement
            </p>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <WalletConnect />
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <FeedbackCTA />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <BalanceDisplay />
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <SendForm />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 mt-6">
            <SwapForm />
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 mt-6">
            <TransactionHistory />
          </div>
        </main>
      </div>
    </QueryClientProvider>
  );
}

export default App;
