import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useSession } from 'next-auth/react';
import TabNavigation from '../components/TabNavigation';
import RegistrationForm from '../components/RegistrationForm';
import ImperialSecretariat from '../components/ImperialSecretariat';

// Your deployed contract addresses
const CONTRACTS = {
  TOKEN: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  VOTING: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  SEAL: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
  ACCOUNTABILITY: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9'
};

// Minimal ABIs for basic functionality
const TOKEN_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function chancellor() view returns (address)',
  'function makeClaim()',
  'function mint(uint256 amount)',
  'function claimChancellorSalary()'
];

const VOTING_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function mint(address to)',
  'function register(address _initialVote, bytes32 _name)',
  'function vote(address _voteFor)',
  'function assessVotes(address _voter) view returns (uint160)',
  'function checkStatus(address _voter) view returns (bool)',
  'function seeBallot(address _voter) view returns (address)',
  'function stake_amount() view returns (uint256)'
];

export default function Home() {
  const { data: session } = useSession();
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [account, setAccount] = useState<string>('');
  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [voteBalance, setVoteBalance] = useState<string>('0');
  const [chancellor, setChancellor] = useState<string>('');
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [votes, setVotes] = useState<string>('0');
  const [status, setStatus] = useState<string>('');
  const [stakeAmount, setStakeAmount] = useState<string>('0');
  const [allowance, setAllowance] = useState<string>('0');
  const [lastTransactionHash, setLastTransactionHash] = useState<string>('');
  const [currentChancellor, setCurrentChancellor] = useState<string>('');
  const [userVotes, setUserVotes] = useState<string>('0');
  const [chancellorVotes, setChancellorVotes] = useState<string>('0');
  const [hasSeal, setHasSeal] = useState<boolean>(false);
  const [chancellorSalary, setChancellorSalary] = useState<string>('0');
  const [salaryInterval, setSalaryInterval] = useState<string>('0');
  const [lastSalaryClaim, setLastSalaryClaim] = useState<string>('0');
  const [canClaimSalary, setCanClaimSalary] = useState<boolean>(false);
  const [sealExists, setSealExists] = useState<boolean>(false);
  const [userIsChancellor, setUserIsChancellor] = useState<boolean>(false);

  // Connect wallet
  const connectWallet = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send('eth_requestAccounts', []);
        const signer = provider.getSigner();
        const address = await signer.getAddress();
        
        setProvider(provider);
        setAccount(address);
        setStatus('Connected to wallet');
        
        // Switch to Hardhat network if needed
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x539' }], // 1337 in hex
          });
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            // Network doesn't exist, add it
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x539',
                chainName: 'DAObi Local',
                rpcUrls: ['http://127.0.0.1:8545'],
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }
              }]
            });
          }
        }
        
        loadData(provider, address);
      } catch (error) {
        console.error('Error connecting wallet:', error);
        setStatus('Error connecting wallet');
      }
    } else {
      setStatus('Please install MetaMask');
    }
  };

  // Load contract data
  const loadData = async (provider: ethers.providers.Web3Provider, address: string) => {
    try {
      const tokenContract = new ethers.Contract(CONTRACTS.TOKEN, TOKEN_ABI, provider);
      const votingContract = new ethers.Contract(CONTRACTS.VOTING, VOTING_ABI, provider);
      
      // Get token balance
      const tokenBal = await tokenContract.balanceOf(address);
      setTokenBalance(ethers.utils.formatEther(tokenBal));
      
      // Get voting token balance
      const voteBal = await votingContract.balanceOf(address);
      setVoteBalance(voteBal.toString());
      
      // Get chancellor
      const chanc = await tokenContract.chancellor();
      setChancellor(chanc);
      
      // Check if registered
      const registered = await votingContract.checkStatus(address);
      setIsRegistered(registered);
      
      // Get votes
      const userVotes = await votingContract.assessVotes(address);
      setVotes(userVotes.toString());
      
      // Get stake amount required for voting tokens
      const stakeAmt = await votingContract.stake_amount();
      setStakeAmount(ethers.utils.formatEther(stakeAmt));
      
      // Get current allowance for voting contract
      const currentAllowance = await tokenContract.allowance(address, CONTRACTS.VOTING);
      setAllowance(ethers.utils.formatEther(currentAllowance));
      
      // Get chancellor-related data - read live from chain
      const currentChancellor = await tokenContract.chancellor();
      setCurrentChancellor(currentChancellor);
      
      // Check if current user has CHANCELLOR_ROLE (not just address comparison)
      let userHasChancellorRole = false;
      try {
        // Create contract instance with hasRole function for role checking
        const tokenContractWithRoles = new ethers.Contract(
          CONTRACTS.TOKEN,
          [
            'function hasRole(bytes32 role, address account) view returns (bool)',
            'function chancellorSalary() view returns (uint256)',
            'function salaryInterval() view returns (uint256)',
            'function lastSalaryClaim() view returns (uint256)',
            'function chancellor() view returns (address)'
          ],
          provider
        );
        
        const chancellorRole = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('CHANCELLOR_ROLE'));
        userHasChancellorRole = await tokenContractWithRoles.hasRole(chancellorRole, address);
        setUserIsChancellor(userHasChancellorRole);
      } catch (error) {
        console.warn('Could not check CHANCELLOR_ROLE:', error);
        setUserIsChancellor(false);
      }
      
      // Get user's vote count if they're registered
      if (registered) {
        const userVoteCount = await votingContract.assessVotes(address);
        setUserVotes(userVoteCount.toString());
        
        // Get current chancellor's vote count
        if (currentChancellor && currentChancellor !== ethers.constants.AddressZero) {
          try {
            const chancellorVoteCount = await votingContract.assessVotes(currentChancellor);
            setChancellorVotes(chancellorVoteCount.toString());
          } catch (error) {
            console.warn('Could not get chancellor vote count:', error);
            setChancellorVotes('0');
          }
        }
      }
      
      // Check seal status and admin permissions
      try {
        const sealContract = new ethers.Contract(
          CONTRACTS.SEAL,
          [
            'function ownerOf(uint256 tokenId) view returns (address)', 
            'function totalSupply() view returns (uint256)',
            'function hasRole(bytes32 role, address account) view returns (bool)'
          ],
          provider
        );
        
        // Check if seal exists
        const totalSeals = await sealContract.totalSupply();
        setSealExists(totalSeals.gt(0));
        
        if (totalSeals.gt(0)) {
          const sealOwner = await sealContract.ownerOf(1);
          setHasSeal(sealOwner.toLowerCase() === address.toLowerCase());
        } else {
          setHasSeal(false);
        }
        
      } catch (error) {
        console.warn('Could not check seal status:', error);
        setHasSeal(false);
        setSealExists(false);
      }
      
      // Get salary information using the contract instance with proper ABI
      try {
        const tokenContractWithRoles = new ethers.Contract(
          CONTRACTS.TOKEN,
          [
            'function hasRole(bytes32 role, address account) view returns (bool)',
            'function chancellorSalary() view returns (uint256)',
            'function salaryInterval() view returns (uint256)',
            'function lastSalaryClaim() view returns (uint256)',
            'function chancellor() view returns (address)'
          ],
          provider
        );
        
        const salary = await tokenContractWithRoles.chancellorSalary();
        const interval = await tokenContractWithRoles.salaryInterval();
        const lastClaim = await tokenContractWithRoles.lastSalaryClaim();
        
        console.log('Raw salary from contract:', salary.toString());
        console.log('Raw interval from contract:', interval.toString());
        console.log('Raw lastClaim from contract:', lastClaim.toString());
        
        setChancellorSalary(ethers.utils.formatEther(salary));
        setSalaryInterval((parseInt(interval.toString()) / 3600).toString()); // Convert to hours
        setLastSalaryClaim(lastClaim.toString());
        
        // Check if salary can be claimed - use actual role check, not address comparison
        const currentTime = Math.floor(Date.now() / 1000);
        const canClaim = currentTime > (parseInt(lastClaim.toString()) + parseInt(interval.toString()));
        setCanClaimSalary(canClaim && userHasChancellorRole && hasSeal);
      } catch (error) {
        console.warn('Could not get salary information:', error);
      }
      
      setStatus('Data loaded successfully');
    } catch (error) {
      console.error('Error loading data:', error);
      setStatus('Error loading contract data');
    }
  };

  // Approve tokens for staking
  const approveTokens = async () => {
    if (!provider || !account) return;
    
    try {
      const signer = provider.getSigner();
      const tokenContract = new ethers.Contract(CONTRACTS.TOKEN, TOKEN_ABI, signer);
      const votingContract = new ethers.Contract(CONTRACTS.VOTING, VOTING_ABI, provider);
      
      // Get the required stake amount
      const stakeAmt = await votingContract.stake_amount();
      
      setStatus('Approving tokens for staking...');
      const tx = await tokenContract.approve(CONTRACTS.VOTING, stakeAmt);
      await tx.wait();
      
      setStatus('Tokens approved! You can now mint voting token.');
      setLastTransactionHash(tx.hash);
      loadData(provider, account);
    } catch (error) {
      console.error('Error approving tokens:', error);
      setStatus('Error approving tokens');
    }
  };

  // Mint voting token (requires prior approval)
  const mintVotingToken = async () => {
    if (!provider || !account) return;
    
    try {
      const signer = provider.getSigner();
      const votingContract = new ethers.Contract(CONTRACTS.VOTING, VOTING_ABI, signer);
      
      setStatus('Minting voting token (staking tokens)...');
      const tx = await votingContract.mint(account);
      await tx.wait();
      
      setStatus('Voting token minted! Tokens staked successfully.');
      setLastTransactionHash(tx.hash);
      loadData(provider, account);
    } catch (error) {
      console.error('Error minting voting token:', error);
      setStatus('Error minting voting token');
    }
  };

  // Register to vote (now handled by Discord integration)
  const handleRegistrationComplete = () => {
    // Refresh data after Discord registration completes
    if (provider && account) {
      loadData(provider, account);
    }
  };

  // Claim chancellor seal (makeClaim function)
  const handleClaimSeal = async () => {
    if (!provider || !account) return;
    
    try {
      setStatus('Claiming chancellorship...');
      const signer = provider.getSigner();
      const tokenContract = new ethers.Contract(
        CONTRACTS.TOKEN,
        ['function makeClaim() external'],
        signer
      );
      
      const tx = await tokenContract.makeClaim();
      setLastTransactionHash(tx.hash);
      setStatus('Claim transaction submitted...');
      
      await tx.wait();
      setStatus('Chancellorship claimed successfully!');
      
      // Refresh data
      if (provider && account) {
        loadData(provider, account);
      }
    } catch (error: any) {
      console.error('Error claiming chancellorship:', error);
      if (error.message.includes('You are already Chancellor')) {
        setStatus('You are already the Chancellor!');
      } else if (error.message.includes('You need AT LEAST one vote')) {
        setStatus('You need at least one vote to claim chancellorship!');
      } else if (error.message.includes('withdrawn from service')) {
        setStatus('You must be actively serving to claim chancellorship!');
      } else {
        setStatus(`Failed to claim chancellorship: ${error.message}`);
      }
    }
  };

  // Claim chancellor salary
  const handleClaimSalary = async () => {
    if (!provider || !account) return;
    
    try {
      setStatus('Claiming salary...');
      const signer = provider.getSigner();
      const tokenContract = new ethers.Contract(
        CONTRACTS.TOKEN,
        ['function claimChancellorSalary() external'],
        signer
      );
      
      const tx = await tokenContract.claimChancellorSalary();
      setLastTransactionHash(tx.hash);
      setStatus('Salary claim transaction submitted...');
      
      await tx.wait();
      setStatus('Salary claimed successfully!');
      
      // Refresh data
      if (provider && account) {
        loadData(provider, account);
      }
    } catch (error: any) {
      console.error('Error claiming salary:', error);
      if (error.message.includes('Not enough time has elapsed')) {
        setStatus('Not enough time has elapsed since last salary payment!');
      } else if (error.message.includes('AccessControl')) {
        setStatus('Only the Chancellor can claim salary!');
      } else {
        setStatus(`Failed to claim salary: ${error.message}`);
      }
    }
  };

  // Mint chancellor seal NFT (admin only)
  const handleMintSeal = async () => {
    if (!provider || !account) return;
    
    try {
      setStatus('Minting Chancellor Seal...');
      const signer = provider.getSigner();
      const sealContract = new ethers.Contract(
        CONTRACTS.SEAL,
        ['function mint(address to) external'],
        signer
      );
      
      // Mint seal to current chancellor
      const tx = await sealContract.mint(currentChancellor);
      setLastTransactionHash(tx.hash);
      setStatus('Seal mint transaction submitted...');
      
      await tx.wait();
      setStatus('Chancellor Seal minted successfully!');
      
      // Refresh data
      if (provider && account) {
        loadData(provider, account);
      }
    } catch (error: any) {
      console.error('Error minting seal:', error);
      if (error.message.includes('A Chancellor Seal Already Exists')) {
        setStatus('Chancellor Seal already exists!');
      } else if (error.message.includes('AccessControl')) {
        setStatus('Only the Seal Manager can mint the seal!');
      } else {
        setStatus(`Failed to mint seal: ${error.message}`);
      }
    }
  };

  // Handle token burning - disconnect wallet and reset state
  const handleTokenBurned = () => {
    console.log('Token burned, disconnecting wallet and resetting state...');
    
    // Reset all state
    setAccount('');
    setProvider(null);
    setTokenBalance('0');
    setVoteBalance('0');
    setChancellor('');
    setIsRegistered(false);
    setVotes('0');
    setStakeAmount('0');
    setAllowance('0');
    setLastTransactionHash('');
    setStatus('Token burned - wallet disconnected');
  };

  // Handle token approval for staking
  const handleApprove = async () => {
    if (!provider || !account) return;
    
    try {
      setStatus('Approving tokens...');
      const signer = provider.getSigner();
      const tokenContract = new ethers.Contract(
        process.env.NEXT_PUBLIC_TOKEN_ADDR!,
        ['function approve(address spender, uint256 amount) external returns (bool)'],
        signer
      );
      
      const approveAmount = ethers.utils.parseEther('100');
      const tx = await tokenContract.approve(
        process.env.NEXT_PUBLIC_VOTE_ADDR!,
        approveAmount
      );
      
      setLastTransactionHash(tx.hash);
      setStatus('Approval transaction submitted...');
      
      await tx.wait();
      setStatus('Tokens approved successfully!');
      
      // Refresh allowance
      if (provider && account) {
        loadData(provider, account);
      }
    } catch (error: any) {
      console.error('Approval error:', error);
      setStatus(`Approval failed: ${error.message}`);
    }
  };

  // Handle combined staking and registration with proper error handling
  const handleStakeAndRegister = async () => {
    if (!provider || !account) return;
    
    try {
      setStatus('Starting registration process...');
      const signer = provider.getSigner();
      
      const voteContract = new ethers.Contract(
        process.env.NEXT_PUBLIC_VOTE_ADDR!,
        [
          'function mint(address to) external',
          'function register(address _initialVote, bytes32 _name) external',
          'function balanceOf(address owner) view returns (uint256)',
          'function checkStatus(address _voter) view returns (bool)'
        ],
        signer
      );
      
      // Get Discord username for registration
      const discordName = session?.user?.discordUsername || session?.user?.name || 'Courtier';
      const registrationName = ethers.utils.formatBytes32String(discordName);
      
      // Check if user already has a token
      const existingBalance = await voteContract.balanceOf(account);
      const isAlreadyRegistered = await voteContract.checkStatus(account);
      
      if (existingBalance.gt(0) && isAlreadyRegistered) {
        setStatus('You are already registered!');
        return;
      }
      
      if (existingBalance.gt(0) && !isAlreadyRegistered) {
        // User has token but not registered - skip mint, go straight to register
        setStatus('Found existing token, completing registration...');
        const registerTx = await voteContract.register(account, registrationName);
        setLastTransactionHash(registerTx.hash);
        await registerTx.wait();
        setStatus('Registration completed successfully!');
      } else {
        // Normal flow: mint then register
        setStatus('Minting voting token...');
        const mintTx = await voteContract.mint(account);
        setLastTransactionHash(mintTx.hash);
        await mintTx.wait();
        
        setStatus('Completing registration...');
        const registerTx = await voteContract.register(account, registrationName);
        setLastTransactionHash(registerTx.hash);
        await registerTx.wait();
        setStatus('Successfully staked and registered!');
      }
      
      // Refresh all data
      if (provider && account) {
        loadData(provider, account);
      }
      
    } catch (error: any) {
      console.error('Registration error:', error);
      
      // Provide specific error handling and recovery instructions
      if (error.message.includes('already has a token')) {
        setStatus('You already have a voting token. Checking registration status...');
        // Try to complete registration if token exists but not registered
        try {
          const voteContract = new ethers.Contract(
            process.env.NEXT_PUBLIC_VOTE_ADDR!,
            ['function register(address _initialVote, bytes32 _name) external'],
            provider.getSigner()
          );
          const discordName = session?.user?.discordUsername || session?.user?.name || 'Courtier';
          const registrationName = ethers.utils.formatBytes32String(discordName);
          const registerTx = await voteContract.register(account, registrationName);
          await registerTx.wait();
          setStatus('Registration completed!');
          if (provider && account) loadData(provider, account);
        } catch (regError: any) {
          setStatus(`Registration failed: ${regError.message}. You may need to burn your token via console and retry.`);
        }
      } else if (error.message.includes('AccessControl')) {
        setStatus('Permission denied. The account may not have minting permissions. Contact admin.');
      } else {
        setStatus(`Registration failed: ${error.message}`);
      }
    }
  };

  // Claim chancellorship
  const claimChancellorship = async () => {
    if (!provider || !account) return;
    
    try {
      const signer = provider.getSigner();
      const tokenContract = new ethers.Contract(CONTRACTS.TOKEN, TOKEN_ABI, signer);
      
      setStatus('Claiming chancellorship...');
      const tx = await tokenContract.makeClaim();
      await tx.wait();
      
      setStatus('Chancellorship claimed!');
      setLastTransactionHash(tx.hash);
      loadData(provider, account);
    } catch (error) {
      console.error('Error claiming chancellorship:', error);
      setStatus('Error claiming chancellorship');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-3xl font-daobi font-bold text-gray-900 dark:text-white text-center">
            DAObi Governance Portal
          </h1>
        </div>
      </header>
      
      {/* Connection Status */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="card p-6 mb-6">
          <h3 className="text-lg font-daobi font-semibold mb-4">Connection Status</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{status}</p>
              {account && (
                <p className="text-sm font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                  Connected: {account.slice(0, 6)}...{account.slice(-4)}
                </p>
              )}
            </div>
            {(!account || !isRegistered) && (
              <RegistrationForm
                address={account}
                hasVoteToken={parseInt(voteBalance) > 0}
                isRegistered={isRegistered}
                provider={provider}
                tokenBalance={tokenBalance}
                allowance={allowance}
                onWalletConnect={connectWallet}
                onRegistrationComplete={handleRegistrationComplete}
                onApprove={handleApprove}
                onStakeAndRegister={handleStakeAndRegister}
              />
            )}
          </div>
        </div>

      {account && (
        <TabNavigation 
          provider={provider} 
          account={account} 
          lastTransactionHash={lastTransactionHash}
          onTokenBurned={handleTokenBurned}
        >
          <div className="space-y-6">
            {/* Your Status Card */}
            <div className="card p-6">
              <h3 className="text-xl font-daobi font-semibold mb-4">Your Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">DAObi Balance:</span>
                    <span className="font-semibold">{tokenBalance} DB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Voting Tokens:</span>
                    <span className="font-semibold">{voteBalance}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Your Votes:</span>
                    <span className="font-semibold">{votes}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Registered:</span>
                    <span className={`font-semibold ${isRegistered ? 'text-green-600' : 'text-red-600'}`}>
                      {isRegistered ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Current Chancellor:</span>
                    <span className="font-mono text-xs">{chancellor.slice(0, 6)}...{chancellor.slice(-4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">You are Chancellor:</span>
                    <span className={`font-semibold ${
                      chancellor.toLowerCase() === account.toLowerCase() 
                        ? 'text-daobi-gold' 
                        : 'text-gray-500'
                    }`}>
                      {chancellor.toLowerCase() === account.toLowerCase() ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Staking Info */}
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 className="font-daobi font-semibold mb-3">Voting Token Staking Info</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="text-gray-600 dark:text-gray-400">Required Stake</div>
                    <div className="font-semibold text-lg">{stakeAmount} DB</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="text-gray-600 dark:text-gray-400">Your Votes</div>
                    <div className="font-semibold text-lg">{userVotes}</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="text-gray-600 dark:text-gray-400">Chancellor Votes</div>
                    <div className="font-semibold text-lg">{chancellorVotes}</div>
                  </div>
                </div>
              </div>
              
              {/* Chancellor Management - Show if user is eligible or has chancellor role */}
              {isRegistered && (parseInt(userVotes) > 0 || userIsChancellor) && (
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="font-daobi font-semibold mb-3">Chancellor Management</h4>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-sm mb-4">
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-gray-600 dark:text-gray-400">Seal Exists</div>
                      <div className={`font-semibold text-lg ${
                        sealExists ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {sealExists ? 'Yes' : 'No'}
                      </div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-gray-600 dark:text-gray-400">You Hold Seal</div>
                      <div className={`font-semibold text-lg ${
                        hasSeal ? 'text-green-600' : 'text-orange-600'
                      }`}>
                        {hasSeal ? 'Yes' : 'No'}
                      </div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-gray-600 dark:text-gray-400">Chancellor Role</div>
                      <div className={`font-semibold text-lg ${
                        userIsChancellor ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {userIsChancellor ? 'Yes' : 'No'}
                      </div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-gray-600 dark:text-gray-400">Daily Salary</div>
                      <div className="font-semibold text-lg">{chancellorSalary} DB</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-gray-600 dark:text-gray-400">Can Claim Salary</div>
                      <div className={`font-semibold text-lg ${
                        canClaimSalary ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {canClaimSalary ? 'Yes' : 'No'}
                      </div>
                    </div>
                  </div>
                  
                  {/* Chancellor Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    {/* Claim chancellorship if eligible and seal exists */}
                    {sealExists && !hasSeal && (parseInt(userVotes) > parseInt(chancellorVotes) || currentChancellor === ethers.constants.AddressZero) && (
                      <button
                        onClick={handleClaimSeal}
                        className="btn-primary flex-1"
                        disabled={!provider || !account}
                      >
                        👑 Claim Chancellor Seal
                      </button>
                    )}
                    
                    {/* Claim salary if user has seal and can claim */}
                    {hasSeal && canClaimSalary && (
                      <button
                        onClick={handleClaimSalary}
                        className="btn-secondary flex-1"
                        disabled={!provider || !account}
                      >
                        💰 Claim Daily Salary
                      </button>
                    )}
                    
                    {/* Show appropriate status messages */}
                    {!sealExists && (
                      <div className="text-center text-gray-600 dark:text-gray-400 py-2">
                        ⚠️ Chancellor Seal not yet deployed. Contact admin.
                      </div>
                    )}
                    
                    {sealExists && !hasSeal && !(parseInt(userVotes) > parseInt(chancellorVotes) || currentChancellor === ethers.constants.AddressZero) && (
                      <div className="text-center text-gray-600 dark:text-gray-400 py-2">
                        {parseInt(userVotes) === 0 
                          ? '📊 You need votes to claim chancellorship.'
                          : '📈 You need more votes than the current Chancellor (' + chancellorVotes + ') to claim the seal.'}
                      </div>
                    )}
                    
                    {hasSeal && !canClaimSalary && (
                      <div className="text-center text-gray-600 dark:text-gray-400 py-2">
                        {parseInt(lastSalaryClaim) === 0 
                          ? '⏰ You are the Chancellor! First salary is ready to claim.'
                          : `⏰ You are the Chancellor! Salary will be available in ${Math.max(0, Math.ceil((parseInt(lastSalaryClaim) + parseInt(salaryInterval) - Date.now() / 1000) / 3600))} hours.`}
                      </div>
                    )}
                    
                    {hasSeal && canClaimSalary && (
                      <div className="text-center text-green-600 py-2">
                        ✅ You can claim your daily salary!
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Actions Card */}
            <div className="card p-6">
              <h3 className="text-xl font-daobi font-semibold mb-4">Actions</h3>
              <div className="space-y-4">
                
                {voteBalance === '0' && parseFloat(allowance) < parseFloat(stakeAmount) && (
                  <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-orange-800 dark:text-orange-200">Step 1: Approve Tokens</h4>
                        <p className="text-sm text-orange-600 dark:text-orange-300">
                          Approve {stakeAmount} DB for staking to mint voting tokens
                        </p>
                      </div>
                      <button 
                        onClick={approveTokens}
                        className="bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2 rounded-lg transition-colors duration-200"
                      >
                        Approve {stakeAmount} DB
                      </button>
                    </div>
                  </div>
                )}
                
                {voteBalance === '0' && parseFloat(allowance) >= parseFloat(stakeAmount) && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-green-800 dark:text-green-200">Step 2: Mint Voting Token</h4>
                        <p className="text-sm text-green-600 dark:text-green-300">
                          Stakes {stakeAmount} DB and mints your voting token
                        </p>
                      </div>
                      <button 
                        onClick={mintVotingToken}
                        className="bg-green-500 hover:bg-green-600 text-white font-medium px-4 py-2 rounded-lg transition-colors duration-200"
                      >
                        Mint Voting Token
                      </button>
                    </div>
                  </div>
                )}
                
                {voteBalance !== '0' && !isRegistered && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-blue-800 dark:text-blue-200">Register to Vote</h4>
                        <p className="text-sm text-blue-600 dark:text-blue-300">
                          Complete your registration to participate in governance
                        </p>
                      </div>
                      <RegistrationForm
                        address={account}
                        hasVoteToken={parseInt(voteBalance) > 0}
                        isRegistered={isRegistered}
                        provider={provider}
                        onWalletConnect={connectWallet}
                        onRegistrationComplete={handleRegistrationComplete}
                      />
                    </div>
                  </div>
                )}
                
                {isRegistered && votes !== '0' && chancellor.toLowerCase() !== account.toLowerCase() && (
                  <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-purple-800 dark:text-purple-200">Claim Chancellorship</h4>
                        <p className="text-sm text-purple-600 dark:text-purple-300">
                          You have votes and can challenge the current chancellor
                        </p>
                      </div>
                      <button 
                        onClick={claimChancellorship}
                        className="bg-purple-500 hover:bg-purple-600 text-white font-medium px-4 py-2 rounded-lg transition-colors duration-200"
                      >
                        Claim Chancellorship
                      </button>
                    </div>
                  </div>
                )}
                
                {chancellor.toLowerCase() === account.toLowerCase() && (
                  <div className="p-4 bg-gradient-to-r from-daobi-amber to-daobi-gold text-white rounded-lg">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">🎉</span>
                      <div>
                        <h4 className="font-daobi font-semibold">You are the Chancellor!</h4>
                        <p className="text-sm opacity-90">
                          You hold the highest office in the DAObi governance system.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {voteBalance === '0' && parseFloat(allowance) >= parseFloat(stakeAmount) && (
                  <div className="text-center text-gray-500 dark:text-gray-400 text-sm">
                    Complete the steps above to participate in DAObi governance
                  </div>
                )}
              </div>
            </div>

            {/* Contract Addresses Card */}
            <div className="card p-6">
              <h3 className="text-xl font-daobi font-semibold mb-4">Contract Addresses</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Token:</span>
                    <div className="font-mono text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded mt-1 break-all">
                      {CONTRACTS.TOKEN}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Voting:</span>
                    <div className="font-mono text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded mt-1 break-all">
                      {CONTRACTS.VOTING}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Seal:</span>
                    <div className="font-mono text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded mt-1 break-all">
                      {CONTRACTS.SEAL}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Accountability:</span>
                    <div className="font-mono text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded mt-1 break-all">
                      {CONTRACTS.ACCOUNTABILITY}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabNavigation>
      )}
      </div>
    </div>
  );
}
