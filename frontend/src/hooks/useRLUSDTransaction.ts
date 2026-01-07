import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { API_BASE_URL } from '../utils/xrplConfig';

interface SendPaymentParams {
  destination: string;
  amount: string;
  signedBlob?: string;
}

export function useRLUSDTransaction() {
  return useMutation({
    mutationFn: async (params: SendPaymentParams) => {
      // TODO: Implement transaction preparation and submission
      const response = await axios.post(
        `${API_BASE_URL}/api/transactions/prepare`,
        {
          destination: params.destination,
          amount: params.amount,
          currency: 'USD',
        }
      );
      return response.data;
    },
  });
}
