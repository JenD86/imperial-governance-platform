const { ethers } = require('ethers');

async function initializeBanishmentParams() {
  // Connect to local Hardhat network
  const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
  
  // Use the first Hardhat account (has admin role)
  const signer = new ethers.Wallet(
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    provider
  );

  // Contract address from .env.local
  const banishmentAddress = '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9';
  
  // Contract ABI for the adjust function
  const abi = [
    'function adjust(uint16 _min, uint16 _max, uint8 _fee, uint256 _cost, uint8 _idle, uint8 _response, uint8 _stale) external'
  ];

  const contract = new ethers.Contract(banishmentAddress, abi, signer);

  try {
    console.log('Initializing banishment contract parameters...');
    
    // Set parameters: min=5, max=30, fee=40, cost=1000, idle=1 (for testing), response=3, stale=1
    // Using idle=1 day instead of 7 for easier testing
    const tx = await contract.adjust(
      5,    // minSupporters
      30,   // maxSupporters  
      40,   // handlingFee (1/40 = 2.5%)
      1000, // cost (1000 tokens)
      1,    // idleDays (1 day for testing - change to 7 for production)
      3,    // responseDays
      1     // staleDays
    );
    
    console.log('Transaction submitted:', tx.hash);
    await tx.wait();
    console.log('✅ Banishment parameters initialized successfully!');
    
    // Verify parameters were set
    const readAbi = [
      'function minSupporters() view returns (uint16)',
      'function idleDays() view returns (uint8)',
      'function cost() view returns (uint256)'
    ];
    
    const readContract = new ethers.Contract(banishmentAddress, readAbi, provider);
    
    const minSupporters = await readContract.minSupporters();
    const idleDays = await readContract.idleDays();
    const cost = await readContract.cost();
    
    console.log('Verified parameters:');
    console.log('- Min supporters:', minSupporters.toString());
    console.log('- Idle days:', idleDays.toString());
    console.log('- Cost:', ethers.utils.formatEther(cost), 'tokens');
    
  } catch (error) {
    console.error('❌ Failed to initialize parameters:', error.message);
  }
}

initializeBanishmentParams();
