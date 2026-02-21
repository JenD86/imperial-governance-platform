const { ethers } = require('ethers');

async function checkUserStatus() {
  // Connect to local Hardhat network
  const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
  
  // User's address
  const userAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
  
  // Contract addresses
  const voteContractAddress = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
  const tokenContractAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
  
  // ABIs
  const voteAbi = [
    'function balanceOf(address owner) view returns (uint256)',
    'function checkStatus(address _voter) view returns (bool)',
    'function assessVotes(address _voter) view returns (uint160)',
    'function getVoteDate(address _voter) view returns (uint32)'
  ];
  
  const tokenAbi = [
    'function balanceOf(address owner) view returns (uint256)'
  ];

  try {
    const voteContract = new ethers.Contract(voteContractAddress, voteAbi, provider);
    const tokenContract = new ethers.Contract(tokenContractAddress, tokenAbi, provider);
    
    console.log('=== User Status Check ===');
    console.log('Address:', userAddress);
    
    // Check voting token balance
    const voteBalance = await voteContract.balanceOf(userAddress);
    console.log('Voting Token Balance:', voteBalance.toString());
    
    // Check if registered
    const isRegistered = await voteContract.checkStatus(userAddress);
    console.log('Is Registered:', isRegistered);
    
    // Check votes received
    const votes = await voteContract.assessVotes(userAddress);
    console.log('Votes Received:', votes.toString());
    
    // Check last vote date
    const lastVoteDate = await voteContract.getVoteDate(userAddress);
    console.log('Last Vote Date:', lastVoteDate.toString());
    
    // Check DAObi token balance
    const tokenBalance = await tokenContract.balanceOf(userAddress);
    console.log('DAObi Token Balance:', ethers.utils.formatEther(tokenBalance));
    
    console.log('\n=== Analysis ===');
    if (voteBalance.toString() === '0') {
      console.log('✅ Token burn was successful - user has no voting tokens');
      console.log('❌ User needs to re-register to get new voting token');
    } else {
      console.log('❌ Token burn may have failed - user still has voting tokens');
    }
    
    if (!isRegistered) {
      console.log('✅ User registration was cleared');
    } else {
      console.log('❌ User is still registered (this might be the issue)');
    }
    
  } catch (error) {
    console.error('❌ Error checking user status:', error.message);
  }
}

checkUserStatus();
