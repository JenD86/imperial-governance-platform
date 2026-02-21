const { ethers } = require('ethers');

async function debugSignature() {
  try {
    console.log('=== Debugging Signature Verification ===');
    
    // Test data
    const address = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
    const authToken = 'test-csrf-token';
    
    const uniqueMessage = 
      `Signing this message verifies that you have completed linking your Discord account. \nAfter you sign this message, DAObi will approve your wallet address on the Voting contract, and your Discord account will be disconnected. \nNeither your address or Discord information will be saved by DAObi, but we still recommend clearing your cookies after verification is completed. \n` +
      JSON.stringify({
        address: address,
        authToken,
      });
    
    console.log('Message to sign:');
    console.log(uniqueMessage);
    console.log('\nMessage length:', uniqueMessage.length);
    
    // Test with Hardhat test account private key
    const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const wallet = new ethers.Wallet(privateKey);
    
    console.log('\nWallet address:', wallet.address);
    console.log('Expected address:', address);
    console.log('Addresses match:', wallet.address.toLowerCase() === address.toLowerCase());
    
    // Sign the message
    const signature = await wallet.signMessage(uniqueMessage);
    console.log('\nSignature:', signature);
    
    // Verify signature
    const recoveredAddress = ethers.utils.verifyMessage(uniqueMessage, signature);
    console.log('\nRecovered address:', recoveredAddress);
    console.log('Verification success:', recoveredAddress.toLowerCase() === address.toLowerCase());
    
    // Check if there are any special characters or encoding issues
    console.log('\nMessage bytes:', Buffer.from(uniqueMessage).toString('hex').substring(0, 100) + '...');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugSignature();
