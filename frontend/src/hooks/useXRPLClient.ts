import { useEffect, useState } from 'react';
import * as xrpl from 'xrpl';
import { XRPL_CONFIG } from '../utils/xrplConfig';

export function useXRPLClient() {
  const [client, setClient] = useState<xrpl.Client | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const connect = async () => {
      try {
        const newClient = new xrpl.Client(XRPL_CONFIG.rpcUrl);
        await newClient.connect();
        setClient(newClient);
        setConnected(true);
      } catch (error) {
        console.error('Failed to connect to XRPL:', error);
        setConnected(false);
      }
    };

    connect();

    return () => {
      if (client) {
        client.disconnect();
      }
    };
  }, []);

  return { client, connected };
}
