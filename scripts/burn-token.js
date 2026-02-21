const { ethers } = require('ethers');
require('dotenv').config();

async function burnVotingToken() {
  try {
    // Connect to local Hardhat network
    const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
    
    // Use the first account (same as your frontend)
    const privateKey = process.env.PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const wallet = new ethers.Wallet(privateKey, provider);
    
    console.log('Wallet address:', wallet.address);
    
    // Connect to the voting contract
    const voteContractAddress = process.env.NEXT_PUBLIC_VOTE_ADDR;
    if (!voteContractAddress) {
      throw new Error('NEXT_PUBLIC_VOTE_ADDR not found in .env.local');
    }
    
    console.log('Vote contract address:', voteContractAddress);
    
    const voteContract = new ethers.Contract(
      voteContractAddress,
      [
        'function balanceOf(address owner) view returns (uint256)',
        'function selfImmolate() external',
        'function checkStatus(address _voter) view returns (bool)',
        'function stakes(address) view returns (uint256)'
      ],
      wallet
    );
    
    // Check current status
    const tokenBalance = await voteContract.balanceOf(wallet.address);
    const isRegistered = await voteContract.checkStatus(wallet.address);
    const stakeAmount = await voteContract.stakes(wallet.address);
    
    console.log('\n=== Current Status ===');
    console.log('Voting tokens:', tokenBalance.toString());
    console.log('Registered:', isRegistered);
    console.log('Stake amount:', ethers.utils.formatEther(stakeAmount), 'DB');
    
    if (tokenBalance.eq(0)) {
      console.log('\nNo voting token to burn!');
      return;
    }
    
    console.log('\n=== Burning Token ===');
    console.log('Calling selfImmolate()...');
    
    const tx = await voteContract.selfImmolate();
    console.log('Transaction hash:', tx.hash);
    console.log('Waiting for confirmation...');
    
    const receipt = await tx.wait();
    console.log('Transaction confirmed in block:', receipt.blockNumber);
    
    // Check final status
    const finalTokenBalance = await voteContract.balanceOf(wallet.address);
    const finalStakeAmount = await voteContract.stakes(wallet.address);
    
    console.log('\n=== Final Status ===');
    console.log('Voting tokens:', finalTokenBalance.toString());
    console.log('Stake amount:', ethers.utils.formatEther(finalStakeAmount), 'DB');
    console.log('\n✅ Token burned successfully! You can now retry registration.');
    
  } catch (error) {
    console.error('Error burning token:', error.message);
    if (error.reason) {
      console.error('Reason:', error.reason);
    }
  }
}

burnVotingToken();
