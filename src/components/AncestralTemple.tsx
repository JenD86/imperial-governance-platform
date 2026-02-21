import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

interface Props {
  provider?: any;
  account: string;
  tokenContract: ethers.Contract;
  onTransactionSubmitted: (hash: string) => void;
}

interface IChingReading {
  hexagram: {
    number: number;
    name: string;
    chineseName: string;
    description: string;
  };
  interpretation: string;
  advice: string;
  question: string;
  timestamp: string;
}

const AncestralTemple = ({ provider, account, tokenContract, onTransactionSubmitted }: Props) => {
  const [burnAmount, setBurnAmount] = useState('');
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [reading, setReading] = useState<IChingReading | null>(null);
  const [tokenBalance, setTokenBalance] = useState('0');

  // Load user's token balance
  const loadBalance = async () => {
    if (!tokenContract || !account) return;
    
    try {
      const balance = await tokenContract.balanceOf(account);
      setTokenBalance(ethers.utils.formatEther(balance));
    } catch (error) {
      console.error('Failed to load balance:', error);
    }
  };

  // Burn tokens to null address
  const handleBurnTokens = async () => {
    if (!provider || !burnAmount || !question.trim()) return;
    
    const amount = parseFloat(burnAmount);
    if (amount <= 0) {
      setError('Please enter a valid amount to burn');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const signer = provider.getSigner();
      const contract = tokenContract.connect(signer);
      
      // Convert amount to wei
      const amountWei = ethers.utils.parseEther(burnAmount);
      
      // Check balance first
      const balance = await contract.balanceOf(account);
      if (balance.lt(amountWei)) {
        throw new Error('Insufficient token balance');
      }
      
      // Estimate gas first to catch errors early
      try {
        await contract.estimateGas.burn(amountWei);
      } catch (gasError: any) {
        console.error('Gas estimation failed:', gasError);
        throw new Error('Transaction would fail. Check if you have enough tokens and the contract allows burning.');
      }
      
      // Use the proper burn function from ERC20Burnable
      const tx = await contract.burn(amountWei, {
        gasLimit: 100000 // Set a reasonable gas limit
      });
      onTransactionSubmitted(tx.hash);
      
      // Wait for transaction confirmation
      await tx.wait();
      
      // Get I Ching reading
      await getIChingReading();
      
      // Clear form
      setBurnAmount('');
      setQuestion('');
      
      // Refresh balance
      await loadBalance();
      
    } catch (error: any) {
      console.error('Burn error:', error);
      setError(error.message || 'Failed to burn tokens');
    } finally {
      setIsLoading(false);
    }
  };

  // Get I Ching reading from our API proxy
  const getIChingReading = async () => {
    try {
      const response = await fetch('/api/iching', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: question.trim(),
          userId: account, // Use wallet address as userId
          language: 'en'
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      
      // Transform API response to our interface
      const iChingReading: IChingReading = {
        hexagram: {
          number: data.hexagram?.number || 1,
          name: data.hexagram?.name || 'Unknown',
          chineseName: data.hexagram?.chineseName || '未知',
          description: data.hexagram?.description || 'The wisdom of the ancients speaks...'
        },
        interpretation: data.interpretation || 'The spirits have spoken through your offering.',
        advice: data.advice || 'Reflect upon your path and seek balance.',
        question: question.trim(),
        timestamp: new Date().toISOString()
      };

      setReading(iChingReading);
      
    } catch (error) {
      console.error('I Ching API error:', error);
      // Provide fallback reading if API fails
      setReading({
        hexagram: {
          number: Math.floor(Math.random() * 64) + 1,
          name: 'The Oracle Speaks',
          chineseName: '神谕',
          description: 'Your offering has been received by the ancestors.'
        },
        interpretation: 'The burning of tokens creates a bridge between the material and spiritual realms. Your sacrifice has been acknowledged.',
        advice: 'In times of uncertainty, remember that loss can lead to wisdom, and sacrifice can bring clarity.',
        question: question.trim(),
        timestamp: new Date().toISOString()
      });
    }
  };

  // Load balance on component mount
  useEffect(() => {
    loadBalance();
  }, [tokenContract, account]);

  return (
    <div className="space-y-6">
      <div className="card p-6 bg-gradient-to-b from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border-purple-200 dark:border-purple-800">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-daobi font-semibold text-purple-800 dark:text-purple-200 mb-2">
            🏛️ Ancestral Temple
          </h2>
          <p className="text-purple-600 dark:text-purple-300 text-sm">
            Burn tokens as an offering to receive wisdom from the I Ching
          </p>
        </div>

        {/* Token Balance */}
        <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg border">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">Your Token Balance:</span>
            <span className="font-mono font-semibold">{parseFloat(tokenBalance).toFixed(4)} DAObi</span>
          </div>
        </div>

        {/* Offering Form */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-2 text-purple-700 dark:text-purple-300">
              Question for the Oracle
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask the ancestors for guidance..."
              className="w-full px-3 py-2 border border-purple-300 dark:border-purple-600 rounded-lg 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                       focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              rows={3}
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-purple-700 dark:text-purple-300">
              Token Offering Amount
            </label>
            <div className="flex space-x-2">
              <input
                type="number"
                value={burnAmount}
                onChange={(e) => setBurnAmount(e.target.value)}
                placeholder="0.0"
                step="0.001"
                min="0"
                className="flex-1 px-3 py-2 border border-purple-300 dark:border-purple-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                         focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={isLoading}
              />
              <button
                onClick={handleBurnTokens}
                disabled={isLoading || !burnAmount || !question.trim()}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 
                         text-white rounded-lg font-medium transition-colors"
              >
                {isLoading ? '🔥 Burning...' : '🔥 Make Offering'}
              </button>
            </div>
            <p className="text-xs text-purple-500 mt-1">
              Tokens will be permanently burned (sent to 0x0 address)
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-4">
            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* I Ching Reading Display */}
        {reading && (
          <div className="mt-6 p-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 
                         border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="text-center mb-4">
              <h3 className="text-xl font-daobi font-semibold text-amber-800 dark:text-amber-200 mb-2">
                ☯️ Oracle's Response
              </h3>
              <p className="text-sm text-amber-600 dark:text-amber-400">
                {new Date(reading.timestamp).toLocaleString()}
              </p>
            </div>

            <div className="space-y-4">
              <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg">
                <h4 className="font-semibold text-lg mb-1">
                  Hexagram {reading.hexagram.number}: {reading.hexagram.name}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {reading.hexagram.chineseName}
                </p>
                <p className="text-sm italic">{reading.hexagram.description}</p>
              </div>

              <div className="space-y-3">
                <div>
                  <h5 className="font-semibold text-amber-800 dark:text-amber-200 mb-1">Your Question:</h5>
                  <p className="text-sm italic">"{reading.question}"</p>
                </div>

                <div>
                  <h5 className="font-semibold text-amber-800 dark:text-amber-200 mb-1">Interpretation:</h5>
                  <p className="text-sm">{reading.interpretation}</p>
                </div>

                <div>
                  <h5 className="font-semibold text-amber-800 dark:text-amber-200 mb-1">Guidance:</h5>
                  <p className="text-sm">{reading.advice}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AncestralTemple;
