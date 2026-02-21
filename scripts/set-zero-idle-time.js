const { ethers } = require('ethers');

async function setZeroIdleTime() {
  const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
  const signer = new ethers.Wallet(
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    provider
  );

  const banishmentAddress = '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9';
  const abi = ['function adjust(uint16 _min, uint16 _max, uint8 _fee, uint256 _cost, uint8 _idle, uint8 _response, uint8 _stale) external'];
  const contract = new ethers.Contract(banishmentAddress, abi, signer);

  try {
    console.log('Setting idle time to 0 for immediate testing...');
    
    // Keep other params same, set idle to 0
    const tx = await contract.adjust(5, 30, 40, 1000, 0, 3, 1);
    
    console.log('Transaction submitted:', tx.hash);
    await tx.wait();
    console.log('✅ Idle time set to 0 - you can now test banishment immediately!');
    
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
}

setZeroIdleTime();
