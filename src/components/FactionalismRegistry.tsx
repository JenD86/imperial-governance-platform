import { useState } from 'react';
import { ethers } from 'ethers';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/router';

interface Props {
  provider?: any;
  account: string;
  voteContract: ethers.Contract;
  onTransactionSubmitted: (hash: string) => void;
  onTokenBurned?: () => void;
}

const FactionalismRegistry = ({ provider, account, voteContract, onTransactionSubmitted, onTokenBurned }: Props) => {
  const router = useRouter();
  const [voteAddress, setVoteAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVote = async () => {
    if (!provider || !voteAddress) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      // Validate address
      if (!ethers.utils.isAddress(voteAddress)) {
        throw new Error('Invalid address format');
      }
      
      const signer = provider.getSigner();
      const contract = voteContract.connect(signer);
      
      const tx = await contract.vote(voteAddress);
      onTransactionSubmitted(tx.hash);
      await tx.wait();
      
      setVoteAddress('');
    } catch (error: any) {
      console.error('Vote error:', error);
      setError(error.message || 'Failed to submit vote');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecuse = async () => {
    if (!provider) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const signer = provider.getSigner();
      const contract = voteContract.connect(signer);
      
      const tx = await contract.recluse();
      onTransactionSubmitted(tx.hash);
      await tx.wait();
    } catch (error: any) {
      console.error('Recuse error:', error);
      setError(error.message || 'Failed to recuse');
    } finally {
      setIsLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!provider) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const signer = provider.getSigner();
      const contract = voteContract.connect(signer);
      
      // selfImmolate burns the token and returns stake
      const tx = await contract.selfImmolate();
      onTransactionSubmitted(tx.hash);
      await tx.wait();
      
      // After successful token burning, logout and redirect
      console.log('Token burned successfully, logging out user...');
      
      // Sign out from Discord
      await signOut({ redirect: false });
      
      // Disconnect wallet by clearing provider state
      if (onTokenBurned) {
        onTokenBurned();
      }
      
      // Redirect to home/signup page
      router.push('/');
      
    } catch (error: any) {
      console.error('Withdraw error:', error);
      setError(error.message || 'Failed to withdraw');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h3 className="text-lg font-daobi font-semibold mb-4">Factionalism Registry</h3>
        
        {/* Vote for Address */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Vote for Address
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={voteAddress}
                onChange={(e) => setVoteAddress(e.target.value)}
                placeholder="0x... or leave empty to abstain"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              />
              <button
                onClick={handleVote}
                disabled={isLoading}
                className="btn-primary px-6"
              >
                {isLoading ? 'Voting...' : 'Vote'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Enter a wallet address to vote for them, or leave empty to abstain (vote for 0x0)
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleRecuse}
              disabled={isLoading}
              className="btn-secondary"
            >
              {isLoading ? 'Processing...' : 'Recuse Yourself'}
            </button>
            
            <button
              onClick={handleWithdraw}
              disabled={isLoading}
              className="btn-danger"
            >
              {isLoading ? 'Processing...' : 'Withdraw to Countryside'}
            </button>
          </div>

          <div className="text-xs text-gray-500 space-y-1">
            <p><strong>Recuse:</strong> Stop participating while keeping your voting token</p>
            <p><strong>Withdraw:</strong> Burn your voting token and reclaim your stake</p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FactionalismRegistry;
