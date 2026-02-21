import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

interface Props {
  provider?: any;
  account: string;
  banishmentContract: ethers.Contract;
  onTransactionSubmitted: (hash: string) => void;
}

interface BanishmentProposal {
  target: string;
  accuser: string;
  supporters: string[];
  accusationTime: number;
  accBalance: string;
  isStale: boolean;
  canExecute: boolean;
}

const CourtOfBanishment = ({ provider, account, banishmentContract, onTransactionSubmitted }: Props) => {
  const [banishAddress, setBanishAddress] = useState('');
  const [proposals, setProposals] = useState<BanishmentProposal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState<{ type: 'error' | 'warning' | 'success'; message: string } | null>(null);
  const [lastUpdate, setLastUpdate] = useState(0);
  const [contractParams, setContractParams] = useState<{
    responseDays: number;
    staleDays: number;
    minSupporters: number;
    idleDays: number;
  } | null>(null);

  // Load contract parameters (cached)
  const loadContractParams = async () => {
    if (!banishmentContract || contractParams) return contractParams;

    try {
      const responseDays = await banishmentContract.responseDays();
      const staleDays = await banishmentContract.staleDays();
      const minSupporters = await banishmentContract.minSupporters();
      const idleDays = await banishmentContract.idleDays();
      
      const params = {
        responseDays: responseDays.toNumber(),
        staleDays: staleDays.toNumber(),
        minSupporters: minSupporters.toNumber(),
        idleDays: idleDays.toNumber()
      };
      
      setContractParams(params);
      return params;
    } catch (error) {
      console.error('Failed to load contract parameters:', error);
      return null;
    }
  };

  // Load banishment proposals with caching
  const loadProposals = async (forceRefresh = false) => {
    if (!banishmentContract) return;

    const now = Date.now();
    // Skip if data is fresh (less than 2 minutes old) and not forced
    if (!forceRefresh && lastUpdate && (now - lastUpdate) < 2 * 60 * 1000) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const proposals: BanishmentProposal[] = [];
      
      // Load contract parameters (cached)
      const params = await loadContractParams();
      if (!params) {
        throw new Error('Failed to load contract parameters');
      }
      
      // Get AccusationMade events to find all active accusations
      const filter = banishmentContract.filters.AccusationMade();
      const events = await banishmentContract.queryFilter(filter);
      
      for (const event of events) {
        const target = event.args?._target;
        if (!target) continue;
        
        try {
          // Read from grudgeBook mapping
          const accusation = await banishmentContract.grudgeBook(target);
          
          // Skip if accusation doesn't exist (accuser is zero address)
          if (accusation.accuser === ethers.constants.AddressZero) continue;
          
          const currentTime = Math.floor(Date.now() / 1000);
          const accusationTime = accusation.accusationTime.toNumber();
          
          const responseDeadline = accusationTime + (params.responseDays * 86400);
          const staleDeadline = responseDeadline + (params.staleDays * 86400);
          
          const isStale = currentTime > staleDeadline;
          const canExecute = !isStale && 
                           currentTime > responseDeadline && 
                           accusation.supporters.length >= params.minSupporters;
          
          proposals.push({
            target,
            accuser: accusation.accuser,
            supporters: accusation.supporters,
            accusationTime,
            accBalance: ethers.utils.formatEther(accusation.accBalance),
            isStale,
            canExecute
          });
        } catch (err) {
          console.warn(`Failed to load accusation for ${target}:`, err);
        }
      }
      
      setProposals(proposals);
      setLastUpdate(now);
    } catch (error) {
      console.error('Failed to load proposals:', error);
      setError(error instanceof Error ? error.message : 'Failed to load proposals');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load and event listeners
  useEffect(() => {
    loadProposals();
    
    // Set up event listeners for real-time updates
    if (banishmentContract) {
      const handleAccusation = () => {
        console.log('New accusation detected, refreshing...');
        loadProposals(true);
      };
      
      const handleSupport = () => {
        console.log('New support detected, refreshing...');
        loadProposals(true);
      };
      
      const handleBanishment = () => {
        console.log('Banishment executed, refreshing...');
        loadProposals(true);
      };
      
      banishmentContract.on('AccusationMade', handleAccusation);
      banishmentContract.on('AccusationJoined', handleSupport);
      banishmentContract.on('Banished', handleBanishment);
      
      return () => {
        banishmentContract.off('AccusationMade', handleAccusation);
        banishmentContract.off('AccusationJoined', handleSupport);
        banishmentContract.off('Banished', handleBanishment);
      };
    }
  }, [banishmentContract]);

  // Check if target is idle enough to be accused
  const checkTargetIdleStatus = async (targetAddress: string) => {
    if (!banishmentContract || !provider) return { isIdle: false, message: 'Contract not available' };
    
    try {
      const params = await loadContractParams();
      if (!params) {
        return { isIdle: false, message: 'Failed to load contract parameters' };
      }

      // Get vote contract to check last vote date
      const voteContractAddress = process.env.NEXT_PUBLIC_VOTE_ADDR;
      const voteContract = new ethers.Contract(
        voteContractAddress!,
        ['function getVoteDate(address) view returns (uint32)'],
        provider
      );

      const lastVoteDate = await voteContract.getVoteDate(targetAddress);
      const currentTime = Math.floor(Date.now() / 1000);
      const idleTime = currentTime - lastVoteDate.toNumber();
      const requiredIdleTime = params.idleDays * 86400; // Convert days to seconds

      const isIdle = idleTime >= requiredIdleTime;
      
      if (!isIdle) {
        const remainingTime = requiredIdleTime - idleTime;
        const remainingDays = Math.ceil(remainingTime / 86400);
        return { 
          isIdle: false, 
          message: `Courtier not idle. Must wait ${remainingDays} more day(s) before accusation.` 
        };
      }

      return { isIdle: true, message: 'Target is idle and can be accused' };
    } catch (error) {
      console.error('Error checking idle status:', error);
      return { isIdle: false, message: 'Failed to check idle status' };
    }
  };

  const handleProposeBanishment = async () => {
    if (!provider || !banishAddress) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      if (!ethers.utils.isAddress(banishAddress)) {
        throw new Error('Invalid address format');
      }
      
      // Check if target is idle before attempting transaction
      const idleStatus = await checkTargetIdleStatus(banishAddress);
      if (!idleStatus.isIdle) {
        setNotification({ type: 'warning', message: idleStatus.message });
        setError(idleStatus.message);
        setIsLoading(false);
        // Auto-clear notification after 5 seconds
        setTimeout(() => setNotification(null), 5000);
        return;
      }
      
      const signer = provider.getSigner();
      const contract = banishmentContract.connect(signer);
      
      // Call the makeAccusation function (requires staking tokens)
      const tx = await contract.makeAccusation(banishAddress);
      onTransactionSubmitted(tx.hash);
      await tx.wait();
      
      setBanishAddress('');
      setNotification({ type: 'success', message: 'Banishment proposal submitted successfully!' });
      setTimeout(() => setNotification(null), 5000);
      loadProposals(); // Refresh the list
    } catch (error: any) {
      console.error('Banishment proposal error:', error);
      
      // Handle specific error messages
      let errorMsg = '';
      if (error.message.includes('Target has not been idle')) {
        errorMsg = 'Courtier not idle. They must be inactive longer before accusation.';
        setNotification({ type: 'warning', message: errorMsg });
      } else if (error.message.includes('You lack the funds')) {
        errorMsg = 'Insufficient tokens to make accusation. Check your balance.';
        setNotification({ type: 'error', message: errorMsg });
      } else if (error.message.includes('You already have an open accusation')) {
        errorMsg = 'You already have an active accusation against this courtier.';
        setNotification({ type: 'warning', message: errorMsg });
      } else {
        errorMsg = error.message || 'Failed to propose banishment';
        setNotification({ type: 'error', message: errorMsg });
      }
      setError(errorMsg);
      // Auto-clear notification after 5 seconds
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSupportBanishment = async (target: string) => {
    if (!provider) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const signer = provider.getSigner();
      const contract = banishmentContract.connect(signer);
      
      // Support by making another accusation against the same target
      const tx = await contract.makeAccusation(target);
      onTransactionSubmitted(tx.hash);
      await tx.wait();
      
      loadProposals(); // Refresh the list
    } catch (error: any) {
      console.error('Support banishment error:', error);
      setError(error.message || 'Failed to support banishment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecuteBanishment = async (target: string) => {
    if (!provider) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const signer = provider.getSigner();
      const contract = banishmentContract.connect(signer);
      
      const tx = await contract.banish(target);
      onTransactionSubmitted(tx.hash);
      await tx.wait();
      
      loadProposals(); // Refresh the list
    } catch (error: any) {
      console.error('Execute banishment error:', error);
      setError(error.message || 'Failed to execute banishment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTaxFarm = async (target: string) => {
    if (!provider) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const signer = provider.getSigner();
      const contract = banishmentContract.connect(signer);
      
      // Call function to remove stale accusation and claim staked tokens
      const tx = await contract.thirdPartyRefute(target);
      onTransactionSubmitted(tx.hash);
      await tx.wait();
      
      loadProposals(); // Refresh the list
    } catch (error: any) {
      console.error('Tax farm error:', error);
      setError(error.message || 'Failed to tax farm');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Notification Popup */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-md ${
          notification.type === 'error' ? 'bg-red-100 border border-red-400 text-red-700' :
          notification.type === 'warning' ? 'bg-yellow-100 border border-yellow-400 text-yellow-700' :
          'bg-green-100 border border-green-400 text-green-700'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="mr-2">
                {notification.type === 'error' ? '❌' :
                 notification.type === 'warning' ? '⚠️' : '✅'}
              </span>
              <span className="text-sm font-medium">{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="ml-4 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      
      <div className="card p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-daobi font-semibold">Court of Temporary Banishment</h3>
          <div className="flex items-center space-x-2">
            {lastUpdate > 0 && (
              <span className="text-xs text-gray-500">
                Updated {Math.floor((Date.now() - lastUpdate) / 1000 / 60)}m ago
              </span>
            )}
            <button
              onClick={() => loadProposals(true)}
              disabled={isLoading}
              className="btn-secondary text-xs px-3 py-1"
            >
              {isLoading ? '⟳' : '↻'} Refresh
            </button>
          </div>
        </div>
        
        {/* Propose Banishment */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-2">
              Propose Banishment
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={banishAddress}
                onChange={(e) => setBanishAddress(e.target.value)}
                placeholder="0x... address to banish"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                         focus:ring-2 focus:ring-red-500 focus:border-transparent"
                disabled={isLoading}
              />
              <button
                onClick={handleProposeBanishment}
                disabled={isLoading || !banishAddress}
                className="btn-danger px-6"
              >
                {isLoading ? 'Proposing...' : 'Propose Banishment'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Requires staking tokens. You must gather enough supporters within the time limit.
            </p>
          </div>
        </div>

        {/* Current Proposals */}
        <div className="space-y-4">
          <h4 className="font-semibold">Active Banishment Proposals</h4>
          {proposals.filter(p => !p.isStale && !p.canExecute).length === 0 ? (
            <p className="text-gray-500 text-sm">No active proposals</p>
          ) : (
            <div className="space-y-3">
              {proposals.filter(p => !p.isStale && !p.canExecute).map((proposal, index) => (
                <div key={index} className="p-4 border border-orange-200 dark:border-orange-800 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-mono text-sm">{proposal.target}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Proposed by: {proposal.accuser.slice(0, 6)}...{proposal.accuser.slice(-4)}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Supporters: {proposal.supporters.length}
                      </p>
                    </div>
                    <button
                      onClick={() => handleSupportBanishment(proposal.target)}
                      disabled={isLoading || proposal.supporters.includes(account)}
                      className="btn-secondary text-xs"
                    >
                      {proposal.supporters.includes(account) ? 'Supported' : 'Support'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ready for Execution */}
        <div className="space-y-4">
          <h4 className="font-semibold">Ready for Execution</h4>
          {proposals.filter(p => p.canExecute).length === 0 ? (
            <p className="text-gray-500 text-sm">No banishments ready for execution</p>
          ) : (
            <div className="space-y-3">
              {proposals.filter(p => p.canExecute).map((proposal, index) => (
                <div key={index} className="p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/20">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-mono text-sm">{proposal.target}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Proposed by: {proposal.accuser.slice(0, 6)}...{proposal.accuser.slice(-4)}
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-400">
                        ✓ Sufficient support gathered
                      </p>
                    </div>
                    {proposal.accuser.toLowerCase() === account.toLowerCase() && (
                      <button
                        onClick={() => handleExecuteBanishment(proposal.target)}
                        disabled={isLoading}
                        className="btn-danger text-xs"
                      >
                        Execute Banishment
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stale Accusations */}
        <div className="space-y-4">
          <h4 className="font-semibold">Stale Accusations (Tax Farm)</h4>
          {proposals.filter(p => p.isStale).length === 0 ? (
            <p className="text-gray-500 text-sm">No stale accusations</p>
          ) : (
            <div className="space-y-3">
              {proposals.filter(p => p.isStale).map((proposal, index) => (
                <div key={index} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-mono text-sm">{proposal.target}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Proposed by: {proposal.accuser.slice(0, 6)}...{proposal.accuser.slice(-4)}
                      </p>
                      <p className="text-xs text-gray-500">
                        ⏰ Timed out without sufficient support
                      </p>
                    </div>
                    <button
                      onClick={() => handleTaxFarm(proposal.target)}
                      disabled={isLoading}
                      className="btn-secondary text-xs"
                    >
                      Tax Farm
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CourtOfBanishment;
