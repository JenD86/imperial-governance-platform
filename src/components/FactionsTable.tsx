import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

// Your deployed contract addresses
const CONTRACTS = {
  TOKEN: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  VOTING: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  SEAL: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
  ACCOUNTABILITY: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9'
};

// Minimal ABIs for factions data
const VOTING_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function assessVotes(address _voter) view returns (uint160)',
  'function checkStatus(address _voter) view returns (bool)',
  'function seeBallot(address _voter) view returns (address)',
  'function seeNickname(address _voter) view returns (bytes32)',
  'event Registered(address indexed regVoter, bytes32 nickname, address initVote)',
  'event Voted(address indexed voter, address indexed candidate)'
];

const TOKEN_ABI = [
  'function chancellor() view returns (address)'
];

interface Faction {
  leader: string;
  leaderName: string;
  votes: number;
  supporters: string[];
}

interface FactionsTableProps {
  provider?: ethers.providers.Web3Provider;
  onDemandUpdate?: boolean;
  lastTransactionHash?: string;
}

export default function FactionsTable({ provider, onDemandUpdate = false, lastTransactionHash }: FactionsTableProps) {
  const [factions, setFactions] = useState<Faction[]>([]);
  const [chancellor, setChancellor] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Simple mock data for local development - avoids heavy blockchain queries
  const generateMockFactions = (): Faction[] => {
    return [
      {
        leader: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        leaderName: 'The Founder',
        votes: 1,
        supporters: ['The Founder']
      },
      {
        leader: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        leaderName: 'The Challenger',
        votes: 0,
        supporters: []
      },
      {
        leader: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        leaderName: 'The Rebel',
        votes: 0,
        supporters: []
      }
    ];
  };

  // Smart cache check - 10 minutes for production, 2 minutes for local
  const isCacheValid = () => {
    const cacheKey = 'daobi_factions_cache_time';
    const cacheTime = localStorage.getItem(cacheKey);
    if (!cacheTime) return false;
    
    const cacheExpiry = provider?.network?.chainId === 137 ? 600000 : 120000; // 10min for Polygon, 2min for local
    return Date.now() - parseInt(cacheTime) < cacheExpiry;
  };

  // Load cached data immediately for better UX
  const loadCachedData = () => {
    const cachedFactions = localStorage.getItem('daobi_factions_cache');
    const cacheTime = localStorage.getItem('daobi_factions_cache_time');
    
    if (cachedFactions && cacheTime) {
      setFactions(JSON.parse(cachedFactions));
      setLastUpdate(new Date(parseInt(cacheTime)));
      return true;
    }
    return false;
  };

  // Production-ready event processing (cached)
  const loadFromEvents = async (forceRefresh = false) => {
    if (!provider) return false;

    try {
      // Use cache unless force refresh or cache expired
      if (!forceRefresh && isCacheValid()) {
        return loadCachedData();
      }

      setIsRefreshing(true);
      
      // Load fresh data - optimized for Polygon
      const votingContract = new ethers.Contract(CONTRACTS.VOTING, VOTING_ABI, provider);
      const tokenContract = new ethers.Contract(CONTRACTS.TOKEN, TOKEN_ABI, provider);

      // Get current chancellor first
      const currentChancellor = await tokenContract.chancellor();
      setChancellor(currentChancellor);

      // Get events in chunks - smaller range for faster queries
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 10000); // Last ~5 hours on Polygon
      
      const [regEvents, voteEvents] = await Promise.all([
        votingContract.queryFilter('Registered', fromBlock, currentBlock),
        votingContract.queryFilter('Voted', fromBlock, currentBlock)
      ]);

      let processedFactions;
      if (regEvents.length === 0 && voteEvents.length === 0) {
        // No events found, use mock data with current chancellor
        processedFactions = generateMockFactions();
        if (processedFactions.length > 0) {
          processedFactions[0].leader = currentChancellor;
          processedFactions[0].leaderName = currentChancellor === '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' 
            ? 'The Founder' 
            : 'Current Chancellor';
        }
      } else {
        processedFactions = await processEvents(regEvents, voteEvents, votingContract);
      }
      
      // Cache the results
      const now = Date.now();
      localStorage.setItem('daobi_factions_cache', JSON.stringify(processedFactions));
      localStorage.setItem('daobi_factions_cache_time', now.toString());
      
      setFactions(processedFactions);
      setLastUpdate(new Date(now));
      setIsRefreshing(false);
      return true;
    } catch (error) {
      console.error('Failed to load from events:', error);
      setIsRefreshing(false);
      return false;
    }
  };

  // Process contract events into factions
  const processEvents = async (regEvents: any[], voteEvents: any[], votingContract: ethers.Contract): Promise<Faction[]> => {
    const users = new Map<string, { name: string, vote: string }>();
    
    // Process registration events
    regEvents.forEach(event => {
      try {
        const voter = event.args.regVoter;
        const nickname = ethers.utils.parseBytes32String(event.args.nickname);
        const initVote = event.args.initVote;
        
        users.set(voter.toLowerCase(), { name: nickname, vote: initVote.toLowerCase() });
      } catch (error) {
        console.warn('Error processing registration event:', error);
      }
    });
    
    // Process vote events (override initial votes)
    voteEvents.forEach(event => {
      try {
        const voter = event.args.voter.toLowerCase();
        const candidate = event.args.candidate.toLowerCase();
        
        if (users.has(voter)) {
          const user = users.get(voter)!;
          users.set(voter, { ...user, vote: candidate });
        }
      } catch (error) {
        console.warn('Error processing vote event:', error);
      }
    });
    
    // Filter out recused users by checking current serving status
    const activeUsers = new Map<string, { name: string, vote: string }>();
    
    for (const [userAddr, userData] of Array.from(users.entries())) {
      try {
        const isServing = await votingContract.checkStatus(userAddr);
        if (isServing) {
          activeUsers.set(userAddr, userData);
        }
      } catch (error) {
        console.warn(`Error checking serving status for ${userAddr}:`, error);
        // If we can't check status, assume they're still active to avoid hiding users
        activeUsers.set(userAddr, userData);
      }
    }
    
    // Build factions from active users only
    const factionMap = new Map<string, Faction>();
    
    activeUsers.forEach((userData, userAddr) => {
      const leaderAddr = userData.vote;
      const leaderData = activeUsers.get(leaderAddr);
      
      if (!leaderData) return;
      
      const leaderName = leaderData.name || `Leader ${leaderAddr.slice(0, 6)}`;
      
      if (!factionMap.has(leaderAddr)) {
        factionMap.set(leaderAddr, {
          leader: leaderAddr,
          leaderName,
          votes: 0,
          supporters: []
        });
      }
      
      const faction = factionMap.get(leaderAddr)!;
      faction.votes += 1;
      faction.supporters.push(userData.name);
    });
    
    return Array.from(factionMap.values())
      .sort((a, b) => b.votes - a.votes);
  };

  // Main loading function with fallback strategy
  const loadFactionsData = async (forceRefresh = false) => {
    if (!provider) {
      setFactions(generateMockFactions());
      setLoading(false);
      return;
    }

    // Load cached data immediately for better UX
    if (!forceRefresh && loadCachedData()) {
      setLoading(false);
    }

    // Then try to get fresh data
    const success = await loadFromEvents(forceRefresh);
    
    if (!success) {
      console.warn('Failed to load factions data, using mock data');
      const mockFactions = generateMockFactions();
      setFactions(mockFactions);
    }
    
    setLoading(false);
  };

  // Manual refresh function
  const handleManualRefresh = () => {
    loadFactionsData(true);
  };

  // Load data on mount and when provider changes
  useEffect(() => {
    loadFactionsData();
  }, [provider]);

  // Trigger update when transaction hash changes (after user actions)
  useEffect(() => {
    if (lastTransactionHash && onDemandUpdate) {
      // Wait 3 seconds for block confirmation, then refresh
      const timer = setTimeout(() => {
        loadFactionsData(true);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [lastTransactionHash, onDemandUpdate]);

  // Refresh when page becomes visible (user returns to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && !isCacheValid()) {
        loadFactionsData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-daobi-orange"></div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex flex-col mb-6">
        <div className="flex justify-between items-center">
          <button className="btn-primary font-daobi">
            Visit the Court
          </button>
          <div className="flex items-center space-x-4">
            {lastUpdate && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Updated: {lastUpdate.toLocaleTimeString()}
              </div>
            )}
            <button 
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className={`text-sm px-3 py-1 rounded transition-colors ${
                isRefreshing 
                  ? 'text-gray-400 cursor-not-allowed' 
                  : 'text-daobi-orange hover:text-daobi-amber hover:bg-orange-50 dark:hover:bg-orange-900/20'
              }`}
              title="Refresh factions data"
            >
              {isRefreshing ? '🔄 Updating...' : '🔄 Refresh'}
            </button>
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <div className="card p-6">
          <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th scope="col" className="px-6 py-3 font-daobi text-lg">
                  Leader
                </th>
                <th scope="col" className="px-6 py-3 text-lg">
                  #
                </th>
                <th scope="col" className="px-6 py-3 font-daobi text-lg">
                  Supporters
                </th>
              </tr>
            </thead>
            <tbody>
              {factions.map((faction, index) => (
                <tr
                  key={faction.leader}
                  className="bg-white border-b dark:bg-gray-900 dark:border-gray-700"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`${
                        faction.leader.toLowerCase() === chancellor.toLowerCase()
                          ? "gradient-chancellor font-daobi"
                          : "gradient-faction"
                      } card p-3 mx-1 rounded-lg shadow-sm`}
                    >
                      {faction.leaderName}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium">
                    {faction.votes}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {faction.supporters.map((supporter, idx) => (
                      <span 
                        key={idx} 
                        className="card p-2 mx-1 text-xs bg-gray-100 dark:bg-gray-700 rounded"
                      >
                        {supporter}
                      </span>
                    ))}
                    {faction.supporters.length === 0 && (
                      <span className="text-gray-400 italic">No supporters yet</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>
          {provider?.network?.chainId === 137 
            ? 'Polygon Network - Updates on user interactions and every 10 minutes' 
            : 'Local Development - Updates on demand'
          }
        </p>
        {onDemandUpdate && (
          <p className="mt-1 text-xs">
            💡 Factions update automatically after your governance actions
          </p>
        )}
      </div>
    </div>
  );
}
