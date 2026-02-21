import { useEffect, useState } from "react";
import { getCsrfToken } from "next-auth/react";

interface Props {
  signOut: () => void;
  address: string;
  provider?: any;
}

const DiscordAuth = ({ signOut, address, provider }: Props) => {
  const [authToken, setAuthToken] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [verificationStatus, setVerificationStatus] = useState<any>({
    loading: false,
    message: null,
    error: null,
  });

  // Get CSRF token on mount
  useEffect(() => {
    const getToken = async () => {
      try {
        const token = await getCsrfToken();
        setAuthToken(token || '');
        console.log('CSRF token retrieved:', !!token);
      } catch (error) {
        console.log('CSRF token retrieval failed:', error);
        // For burned users, create a fallback token
        const fallbackToken = `fallback-${Date.now()}`;
        setAuthToken(fallbackToken);
        console.log('Using fallback CSRF token for burned user');
      }
    };
    getToken();
  }, []);

  const handleSignAndVerify = async () => {
    console.log('Sign button clicked', { provider: !!provider, address, authToken: !!authToken, isLoading });
    
    if (!provider || !address || isLoading) {
      console.log('Missing requirements:', { provider: !!provider, address, authToken: !!authToken, isLoading });
      return;
    }
    
    // If no authToken, create a fallback for burned users
    let finalAuthToken = authToken;
    if (!authToken) {
      finalAuthToken = `fallback-${Date.now()}`;
      console.log('Using fallback auth token:', finalAuthToken);
    }
    
    // Debug: Check if we have a valid session
    try {
      const sessionResponse = await fetch('/api/auth/session');
      const sessionData = await sessionResponse.json();
      console.log('Current session data:', sessionData);
    } catch (error) {
      console.log('Failed to fetch session:', error);
    }
    
    setIsLoading(true);
    setVerificationStatus({ loading: true, message: null, error: null });
    
    try {
      const uniqueMessage =
        `Signing this message verifies that you have completed linking your Discord account. \nAfter you sign this message, DAObi will approve your wallet address on the Voting contract, and your Discord account will be disconnected. \nNeither your address or Discord information will be saved by DAObi, but we still recommend clearing your cookies after verification is completed. \n` +
        JSON.stringify({
          address: address,
          authToken: finalAuthToken,
        });
        
      console.log('Message to sign:', uniqueMessage);
      console.log('Using auth token:', finalAuthToken);

      // Request signature from user
      const signer = provider.getSigner();
      const signature = await signer.signMessage(uniqueMessage);

      // Submit verification to API
      const res = await fetch(`/api/verify/${address}`, {
        method: "PUT",
        body: JSON.stringify(signature),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const json = await res.json();
      console.log('Verification API response:', json);

      if (json?.message === "Verification Successful") {
        console.log("Successfully Verified");
        setVerificationStatus({
          loading: false,
          message: "Registration successful! Discord disconnected.",
          error: null,
        });
        setTimeout(() => {
          signOut();
        }, 2000);
      } else {
        console.log(`Error verifying...\n`, { ...json });
        setVerificationStatus({
          loading: false,
          message: json?.message || 'Verification failed',
          error: json?.error?.reason ?? json?.error ?? `HTTP ${res.status}: ${res.statusText}`,
        });
      }
    } catch (error: any) {
      console.error('Error during verification:', error);
      setVerificationStatus({
        loading: false,
        message: null,
        error: error.message || 'Failed to sign message or verify',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {!verificationStatus?.error && !verificationStatus?.message && (
        <button
          className={`btn-primary ${isLoading ? 'animate-pulse' : ''}`}
          onClick={handleSignAndVerify}
          disabled={isLoading || !authToken}
        >
          {isLoading ? 'Signing Message...' : 'Sign Message To Complete Verification'}
        </button>
      )}

      {verificationStatus?.message && (
        <div className="card p-4 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <p className="text-green-700 dark:text-green-300">
            {verificationStatus.message}
          </p>
        </div>
      )}

      {verificationStatus?.error && (
        <div className="card p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <p className="text-red-700 dark:text-red-300">
            {verificationStatus?.message ?? verificationStatus?.error}
            <br />
            <button 
              onClick={handleSignAndVerify}
              className="mt-2 text-sm underline hover:no-underline"
            >
              Try again
            </button>
          </p>
        </div>
      )}
    </div>
  );
};

export default DiscordAuth;
