const { ethers } = require('ethers');
const fetch = require('node-fetch');

async function debugVerification() {
  try {
    console.log('=== Testing Verification Flow ===');
    
    // 1. Get CSRF token
    console.log('1. Getting CSRF token...');
    const csrfResponse = await fetch('http://localhost:3001/api/auth/csrf');
    const csrfData = await csrfResponse.json();
    console.log('CSRF token:', csrfData.csrfToken ? 'EXISTS' : 'MISSING');
    
    // 2. Test message construction
    const address = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
    const authToken = csrfData.csrfToken;
    
    const uniqueMessage = 
      `Signing this message verifies that you have completed linking your Discord account. \nAfter you sign this message, DAObi will approve your wallet address on the Voting contract, and your Discord account will be disconnected. \nNeither your address or Discord information will be saved by DAObi, but we still recommend clearing your cookies after verification is completed. \n` +
      JSON.stringify({
        address: address,
        authToken,
      });
    
    console.log('2. Message to sign:');
    console.log(uniqueMessage);
    
    // 3. Test with a known private key (Hardhat test account)
    const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const wallet = new ethers.Wallet(privateKey);
    
    console.log('3. Signing with wallet:', wallet.address);
    const signature = await wallet.signMessage(uniqueMessage);
    console.log('Signature:', signature);
    
    // 4. Verify signature locally
    const recoveredAddress = ethers.utils.verifyMessage(uniqueMessage, signature);
    console.log('4. Local verification:');
    console.log('Expected address:', address);
    console.log('Recovered address:', recoveredAddress);
    console.log('Match:', recoveredAddress === address);
    
    // 5. Test API call
    console.log('5. Testing API call...');
    const apiResponse = await fetch(`http://localhost:3001/api/verify/${address}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(signature)
    });
    
    const apiResult = await apiResponse.json();
    console.log('API Response Status:', apiResponse.status);
    console.log('API Response:', apiResult);
    
  } catch (error) {
    console.error('Error during debug:', error);
  }
}

debugVerification();
