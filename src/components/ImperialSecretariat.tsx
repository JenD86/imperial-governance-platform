import React, { useState } from 'react';
import { ethers } from 'ethers';

interface LookupResult {
  address?: string;
  discordUsername?: string;
  error?: string;
}

const ImperialSecretariat: React.FC = () => {
  const [walletInput, setWalletInput] = useState('');
  const [discordInput, setDiscordInput] = useState('');
  const [walletResult, setWalletResult] = useState<LookupResult | null>(null);
  const [discordResult, setDiscordResult] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);

  const VOTING_ABI = [
    "event Registered(address indexed regVoter, bytes32 nickname, address initVote)",
    "function balanceOf(address owner) external view returns (uint256)"
  ];

  const lookupDiscordByWallet = async () => {
    if (!walletInput.trim()) return;
    
    setLoading(true);
    setWalletResult(null);

    try {
      // Validate wallet address
      if (!ethers.utils.isAddress(walletInput)) {
        setWalletResult({ error: 'Invalid wallet address format' });
        return;
      }

      const provider = new ethers.providers.JsonRpcProvider(
        process.env.NODE_ENV === 'production' 
          ? "https://polygon-rpc.com" 
          : "http://127.0.0.1:8545"
      );

      const voteContract = new ethers.Contract(
        process.env.NEXT_PUBLIC_VOTE_ADDR!,
        VOTING_ABI,
        provider
      );

      // Query registration events for this address
      const filter = voteContract.filters.Registered(walletInput);
      const events = await voteContract.queryFilter(filter);

      if (events.length > 0) {
        const latestEvent = events[events.length - 1];
        if (latestEvent.args) {
          const nickname = ethers.utils.parseBytes32String(latestEvent.args.nickname);
          setWalletResult({
            address: walletInput,
            discordUsername: nickname
          });
        } else {
          setWalletResult({
            address: walletInput,
            error: 'Invalid event data found for this wallet'
          });
        }
      } else {
        setWalletResult({
          address: walletInput,
          error: 'No Discord registration found for this wallet'
        });
      }
    } catch (error: any) {
      setWalletResult({
        error: `Error looking up wallet: ${error.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  const lookupWalletByDiscord = async () => {
    if (!discordInput.trim()) return;
    
    setLoading(true);
    setDiscordResult(null);

    try {
      const provider = new ethers.providers.JsonRpcProvider(
        process.env.NODE_ENV === 'production' 
          ? "https://polygon-rpc.com" 
          : "http://127.0.0.1:8545"
      );

      const voteContract = new ethers.Contract(
        process.env.NEXT_PUBLIC_VOTE_ADDR!,
        VOTING_ABI,
        provider
      );

      // Query all registration events
      const filter = voteContract.filters.Registered();
      const events = await voteContract.queryFilter(filter);

      // Search for matching Discord username
      const matchingEvent = events.find(event => {
        if (!event.args) return false;
        const nickname = ethers.utils.parseBytes32String(event.args.nickname);
        return nickname.toLowerCase() === discordInput.toLowerCase();
      });

      if (matchingEvent && matchingEvent.args) {
        setDiscordResult({
          address: matchingEvent.args.regVoter,
          discordUsername: discordInput
        });
      } else {
        setDiscordResult({
          discordUsername: discordInput,
          error: 'No wallet found for this Discord username'
        });
      }
    } catch (error: any) {
      setDiscordResult({
        error: `Error looking up Discord username: ${error.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-yellow-400 mb-2">Imperial Secretariat</h2>
        <p className="text-gray-300">Query wallet addresses and Discord usernames</p>
      </div>

      {/* Wallet to Discord Lookup */}
      <div className="bg-gray-800 rounded-lg p-6 border border-yellow-600">
        <h3 className="text-xl font-semibold text-yellow-400 mb-4">Wallet → Discord Username</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Wallet Address
            </label>
            <input
              type="text"
              value={walletInput}
              onChange={(e) => setWalletInput(e.target.value)}
              placeholder="0x..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>
          <button
            onClick={lookupDiscordByWallet}
            disabled={loading || !walletInput.trim()}
            className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            {loading ? 'Looking up...' : 'Lookup Discord Username'}
          </button>
          
          {walletResult && (
            <div className="mt-4 p-4 bg-gray-700 rounded-md">
              {walletResult.error ? (
                <p className="text-red-400">{walletResult.error}</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-green-400">✓ Registration found</p>
                  <p className="text-gray-300">
                    <span className="font-medium">Wallet:</span> {walletResult.address}
                  </p>
                  <p className="text-gray-300">
                    <span className="font-medium">Discord:</span> {walletResult.discordUsername}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Discord to Wallet Lookup */}
      <div className="bg-gray-800 rounded-lg p-6 border border-yellow-600">
        <h3 className="text-xl font-semibold text-yellow-400 mb-4">Discord Username → Wallet</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Discord Username
            </label>
            <input
              type="text"
              value={discordInput}
              onChange={(e) => setDiscordInput(e.target.value)}
              placeholder="username"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>
          <button
            onClick={lookupWalletByDiscord}
            disabled={loading || !discordInput.trim()}
            className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            {loading ? 'Looking up...' : 'Lookup Wallet Address'}
          </button>
          
          {discordResult && (
            <div className="mt-4 p-4 bg-gray-700 rounded-md">
              {discordResult.error ? (
                <p className="text-red-400">{discordResult.error}</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-green-400">✓ Registration found</p>
                  <p className="text-gray-300">
                    <span className="font-medium">Discord:</span> {discordResult.discordUsername}
                  </p>
                  <p className="text-gray-300">
                    <span className="font-medium">Wallet:</span> {discordResult.address}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImperialSecretariat;
