import { useState } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import DiscordAuth from './DiscordAuth';

interface Props {
  address: string;
  hasVoteToken: boolean;
  isRegistered: boolean;
  provider?: any;
  tokenBalance: string;
  allowance: string;
  onWalletConnect: () => void;
  onRegistrationComplete: () => void;
  onApprove: () => void;
  onStakeAndRegister: () => void;
}

const RegistrationForm = ({ 
  address, 
  hasVoteToken, 
  isRegistered, 
  provider,
  tokenBalance,
  allowance,
  onWalletConnect,
  onRegistrationComplete,
  onApprove,
  onStakeAndRegister
}: Props) => {
  const { data: session, status } = useSession();
  const [isApproving, setIsApproving] = useState(false);
  const [isStaking, setIsStaking] = useState(false);
  
  const hasEnoughTokens = parseFloat(tokenBalance) >= 100;
  const hasApproval = parseFloat(allowance) >= 100;

  if (hasVoteToken || isRegistered) {
    return null; // Don't show if already registered
  }

  return (
    <div className="card p-6 mb-6">
      <h3 className="text-xl font-daobi font-semibold mb-4">Join DAObi</h3>
      
      {/* Step 1: Discord Connection */}
      {!session ? (
        <div className="space-y-4">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">1</span>
            </div>
            <div>
              <p className="font-semibold">Connect Discord</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Verify your identity to prevent bot registrations
              </p>
            </div>
          </div>
          <button
            className="btn-primary"
            onClick={() => signIn('discord')}
            disabled={status === 'loading'}
          >
            {status === 'loading' ? 'Loading...' : 'Connect Discord'}
          </button>
        </div>
      ) : !address ? (
        /* Step 2: Wallet Connection */
        <div className="space-y-4">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm">✓</span>
            </div>
            <div>
              <p className="font-semibold">Discord Connected</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {session.user?.discordUsername || session.user?.name}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">2</span>
            </div>
            <div>
              <p className="font-semibold">Connect Wallet</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Connect your wallet to stake tokens and join
              </p>
            </div>
          </div>
          <button
            className="btn-primary"
            onClick={onWalletConnect}
          >
            Connect Wallet
          </button>
        </div>
      ) : !hasApproval ? (
        /* Step 3: Token Approval */
        <div className="space-y-4">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm">✓</span>
            </div>
            <div>
              <p className="font-semibold">Discord & Wallet Connected</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                {address.slice(0, 6)}...{address.slice(-4)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">3</span>
            </div>
            <div>
              <p className="font-semibold">Approve Tokens</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Approve 100.0 DB for staking to mint voting tokens
              </p>
            </div>
          </div>
          
          {!hasEnoughTokens ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-700 dark:text-red-300 text-sm">
                ⚠️ Insufficient DAObi tokens. You need 100 DB to stake.
                <br />Current balance: {parseFloat(tokenBalance).toFixed(2)} DB
              </p>
            </div>
          ) : (
            <button
              className="btn-primary"
              onClick={async () => {
                setIsApproving(true);
                await onApprove();
                setIsApproving(false);
              }}
              disabled={isApproving}
            >
              {isApproving ? 'Approving...' : 'Approve 100 DB'}
            </button>
          )}
        </div>
      ) : (
        /* Step 4: Stake and Register */
        <div className="space-y-4">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm">✓</span>
            </div>
            <div>
              <p className="font-semibold">Ready to Join</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Tokens approved - stake and mint your voting token
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">4</span>
            </div>
            <div>
              <p className="font-semibold">Stake & Register</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Stake 100 DB and mint your voting token to complete registration
              </p>
            </div>
          </div>
          
          <button
            className="btn-primary"
            onClick={async () => {
              setIsStaking(true);
              await onStakeAndRegister();
              setIsStaking(false);
            }}
            disabled={isStaking}
          >
            {isStaking ? 'Staking & Registering...' : 'Stake 100 DB & Register'}
          </button>
          
          <button
            className="btn-secondary text-sm"
            onClick={() => signOut()}
          >
            Disconnect Discord
          </button>
        </div>
      )}
    </div>
  );
};

export default RegistrationForm;
