import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { API_BASE_URL } from '../utils/xrplConfig';

interface BalanceData {
  address: string;
  xrp_balance: string;
  rlusd_balance: string;
  error?: string;
}

export function useRLUSDBalance(address: string | null) {
  return useQuery({
    queryKey: ['balance', address],
    queryFn: async () => {
      if (!address) return null;

      const response = await axios.get<BalanceData>(
        `${API_BASE_URL}/api/balance/${address}`
      );
      return response.data;
    },
    enabled: !!address,
    refetchInterval: 5000, // Refresh every 5 seconds
  });
}
