import { useState, useEffect } from 'react';
import sdk from '@crossmarkio/sdk';

export function useCrosmark() {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Just mark loading as done immediately
    // We'll check for the extension when user clicks connect
    setIsLoading(false);
  }, []);

  const connect = async () => {
    try {
      setIsLoading(true);
      
      // Give SDK a moment to fully initialize
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const installed = sdk.sync.isInstalled();
      if (!installed) {
        // Redirect to Chrome Web Store
        window.open('https://chromewebstore.google.com/detail/crossmark-wallet/canipghmckojpianfgiklhbgpfmhjkjg', '_blank');
        throw new Error('Crossmark wallet not installed');
      }

      // Sign in and wait for user approval
      const response = await sdk.async.signInAndWait();
      
      if (response?.response?.data?.address) {
        setAddress(response.response.data.address);
        setIsConnected(true);
        console.log('Connected with address:', response.response.data.address);
        return response.response.data.address;
      }
    } catch (error) {
      console.error('Failed to connect Crossmark wallet:', error);
      alert('Failed to connect wallet. Make sure Crossmark extension is installed and enabled.');
      setIsConnected(false);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signTransaction = async (txJson: any) => {
    try {
      console.log('[CROSSMARK] Signing with txJson:', JSON.stringify(txJson, null, 2));
      const response = await sdk.async.signAndWait(txJson);
      console.log('[CROSSMARK] Full response:', response);
      
      // Cast to any for flexible response handling
      const resp = response as any;
      let txBlob = null;
      
      if (resp?.response?.data?.txBlob) {
        txBlob = resp.response.data.txBlob;
      } else if (resp?.txBlob) {
        txBlob = resp.txBlob;
      } else if (resp?.data?.txBlob) {
        txBlob = resp.data.txBlob;
      } else if (typeof resp === 'string') {
        txBlob = resp;
      }
      
      if (!txBlob) {
        const errorMsg = resp?.response?.data?.errorMessage || 
                        resp?.errorMessage || 
                        JSON.stringify(response);
        console.error('[CROSSMARK] No txBlob. Full response:', errorMsg);
        throw new Error(`Crossmark signing failed: ${errorMsg}`);
      }
      
      console.log('[CROSSMARK] Got txBlob, length:', txBlob.length);
      return txBlob;
    } catch (error: any) {
      console.error('[CROSSMARK] Error:', error.message || error);
      throw error;
    }
  };

  return {
    address,
    isConnected,
    isLoading,
    connect,
    signTransaction,
  };
}
