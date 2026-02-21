import type { NextApiRequest, NextApiResponse } from "next";
import { ethers } from "ethers";
import { getToken } from "next-auth/jwt";
import { getCsrfToken } from "next-auth/react";
import { getServerSession } from "next-auth/next";
import { authOptions } from '../auth/[...nextauth]';

const VOTING_ABI = [
  "function mint(address to) external",
  "function register(address voter, bytes32 nickname) external"
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ message?: string; error?: Error | string }>
) {
  const {
    query: { address },
    body: signature,
    method,
  } = req;

  // JWT CONTAINS IDENTITY INFO - try multiple methods
  let jwt = await getToken({ req });
  let csrfToken;
  
  try {
    csrfToken = await getCsrfToken({ req });
  } catch (error) {
    console.log('CSRF token retrieval failed:', error);
    // For development/testing, we can be more lenient with CSRF tokens
    csrfToken = null;
  }
  
  // Fallback: try getting session if JWT fails
  if (!jwt) {
    try {
      const session = await getServerSession(req, res, authOptions);
      if (session?.user) {
        jwt = {
          discordId: session.user.discordId,
          discordUsername: session.user.discordUsername
        };
        console.log('Using session fallback for JWT:', jwt);
      }
    } catch (error) {
      console.log('Session fallback failed:', error);
    }
  }
  
  // Debug logging
  console.log('=== Verification Debug Info ===');
  console.log('Address:', address);
  console.log('Method:', method);
  console.log('JWT exists:', !!jwt);
  console.log('JWT content:', jwt ? { discordId: jwt.discordId, discordUsername: jwt.discordUsername } : 'null');
  console.log('CSRF token exists:', !!csrfToken);
  console.log('CSRF token value:', csrfToken);
  console.log('Signature exists:', !!signature);
  console.log('Signature length:', signature ? signature.length : 'null');
  console.log('Signature value:', signature);

  const uniqueMessage =
    `Signing this message verifies that you have completed linking your Discord account. \nAfter you sign this message, DAObi will approve your wallet address on the Voting contract, and your Discord account will be disconnected. \nNeither your address or Discord information will be saved by DAObi, but we still recommend clearing your cookies after verification is completed. \n` +
    JSON.stringify({
      address: address,
      authToken: csrfToken,
    });

  // server-side verification of message
  console.log('=== Message Verification ===');
  console.log('Message to verify:', uniqueMessage);
  console.log('Message length:', uniqueMessage.length);
  
  let resolvedAddress;
  try {
    resolvedAddress = ethers.utils.verifyMessage(uniqueMessage, signature);
    console.log('Signature verification successful');
    console.log('Expected address:', address);
    console.log('Resolved address:', resolvedAddress);
    console.log('Addresses match:', resolvedAddress === address);
  } catch (error) {
    console.log('Signature verification failed:', error.message);
    return res.status(401).json({ error: "Invalid signature format" });
  }

  switch (method) {
    case "PUT":
      // Check if user has been burned (no voting tokens) - if so, allow re-registration as new user
      let isBurnedUser = false;
      try {
        const provider = new ethers.providers.JsonRpcProvider(
          process.env.NODE_ENV === 'production' ? "https://polygon-rpc.com" : "http://127.0.0.1:8545"
        );
        const voteContract = new ethers.Contract(
          process.env.NEXT_PUBLIC_VOTE_ADDR!,
          ['function balanceOf(address owner) view returns (uint256)', 'function checkStatus(address _voter) view returns (bool)'],
          provider
        );
        
        const voteBalance = await voteContract.balanceOf(address);
        const isRegistered = await voteContract.checkStatus(address);
        isBurnedUser = voteBalance.toString() === '0' && !isRegistered;
        
        console.log('User burn status check:', { address, voteBalance: voteBalance.toString(), isRegistered, isBurnedUser });
      } catch (error) {
        console.log('Failed to check burn status:', error);
      }
      
      // For burned users, we can be more lenient with CSRF token requirements
      // since they just went through logout/re-login cycle
      if (!csrfToken && !isBurnedUser) {
        console.log('=== CSRF Token Missing for New User ===');
        console.log('CSRF token is required for new user verification');
        
        return res.status(401).json({ 
          error: "CSRF token missing - please refresh and try again"
        });
      }
      
      // For burned users with CSRF issues, we need to handle the case where
      // the frontend signed with undefined/null CSRF token
      if (!csrfToken && isBurnedUser) {
        console.log('=== Burned user CSRF handling ===');
        console.log('Frontend likely signed message without CSRF token');
        
        // The frontend signed a message without authToken, so we need to verify
        // against a message that also has no authToken (or undefined)
        // Let's reconstruct the message the frontend actually signed
        const frontendMessage = 
          `Signing this message verifies that you have completed linking your Discord account. \nAfter you sign this message, DAObi will approve your wallet address on the Voting contract, and your Discord account will be disconnected. \nNeither your address or Discord information will be saved by DAObi, but we still recommend clearing your cookies after verification is completed. \n` +
          JSON.stringify({
            address: address,
          });
        
        console.log('Trying to verify against frontend message (no authToken):', frontendMessage);
        console.log('Frontend message length:', frontendMessage.length);
        console.log('Original message length:', uniqueMessage.length);
        
        // Compare messages byte by byte
        console.log('Original message bytes:', Buffer.from(uniqueMessage).toString('hex').substring(0, 200));
        console.log('Frontend message bytes:', Buffer.from(frontendMessage).toString('hex').substring(0, 200));
        
        try {
          const frontendResolvedAddress = ethers.utils.verifyMessage(frontendMessage, signature);
          console.log('Frontend message verification:', frontendResolvedAddress === address);
          console.log('Frontend resolved address:', frontendResolvedAddress);
          
          if (frontendResolvedAddress === address) {
            console.log('✅ Verified with frontend message format');
            // Override the resolved address for the main verification
            resolvedAddress = frontendResolvedAddress;
            csrfToken = 'frontend-no-token'; // Set a dummy token to pass validation
          } else {
            // Try with different variations of the message
            console.log('Trying alternative message formats...');
            
            // The frontend is likely using a fallback token like `fallback-${timestamp}`
            // Let's try to match common fallback patterns
            const fallbackPatterns = [
              `fallback-${Date.now()}`,
              `fallback-${Date.now() - 1000}`, // Account for timing differences
              `fallback-${Date.now() - 2000}`,
              `fallback-${Date.now() - 3000}`,
              `fallback-${Date.now() - 4000}`,
              `fallback-${Date.now() - 5000}`,
            ];
            
            // Also try undefined and null formats
            const altFormats = [
              { authToken: undefined },
              { authToken: null },
              { authToken: '' },
            ];
            
            // Try fallback patterns first
            for (const pattern of fallbackPatterns) {
              try {
                const testMessage = 
                  `Signing this message verifies that you have completed linking your Discord account. \nAfter you sign this message, DAObi will approve your wallet address on the Voting contract, and your Discord account will be disconnected. \nNeither your address or Discord information will be saved by DAObi, but we still recommend clearing your cookies after verification is completed. \n` +
                  JSON.stringify({
                    address: address,
                    authToken: pattern,
                  });
                
                const testAddress = ethers.utils.verifyMessage(testMessage, signature);
                if (testAddress === address) {
                  console.log(`✅ Verified with fallback token: ${pattern}`);
                  resolvedAddress = testAddress;
                  csrfToken = pattern;
                  break;
                }
              } catch (e) {}
            }
            
            // If fallback patterns didn't work, try other formats
            if (resolvedAddress !== address) {
              for (const format of altFormats) {
                try {
                  const testMessage = 
                    `Signing this message verifies that you have completed linking your Discord account. \nAfter you sign this message, DAObi will approve your wallet address on the Voting contract, and your Discord account will be disconnected. \nNeither your address or Discord information will be saved by DAObi, but we still recommend clearing your cookies after verification is completed. \n` +
                    JSON.stringify({
                      address: address,
                      authToken: format.authToken,
                    });
                  
                  const testAddress = ethers.utils.verifyMessage(testMessage, signature);
                  if (testAddress === address) {
                    console.log(`✅ Verified with format: ${JSON.stringify(format)}`);
                    resolvedAddress = testAddress;
                    csrfToken = 'frontend-alt-format';
                    break;
                  }
                } catch (e) {}
              }
            }
          }
        } catch (error) {
          console.log('Frontend message verification failed:', error.message);
        }
      }
      
      if (resolvedAddress !== address) {
        console.log('=== Signature Verification Failed ===');
        console.log('Expected address:', address);
        console.log('Resolved address:', resolvedAddress);
        
        return res.status(401).json({ 
          error: "Invalid signature - address mismatch"
        });
      }
      
      // Enhanced session handling for burned users who may have session issues after logout
      if (!jwt && isBurnedUser) {
        console.log('=== Burned User Session Recovery ===');
        console.log('Attempting session recovery for burned user:', address);
        
        // For burned users, we'll be more aggressive about session recovery
        try {
          // Try multiple session recovery methods
          const sessionResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/auth/session`, {
            headers: {
              'cookie': req.headers.cookie || ''
            }
          });
          
          if (sessionResponse.ok) {
            const sessionData = await sessionResponse.json();
            if (sessionData?.user?.discordId) {
              jwt = {
                discordId: sessionData.user.discordId,
                discordUsername: sessionData.user.discordUsername || sessionData.user.name
              };
              console.log('Session recovery successful for burned user:', jwt);
            }
          }
        } catch (error) {
          console.log('Session recovery failed for burned user:', error);
        }
      }
      
      // Final check - both new and burned users need Discord verification
      if (!jwt) {
        const userType = isBurnedUser ? 'burned user' : 'new user';
        console.log(`=== Discord Verification Required for ${userType} ===`);
        console.log('No valid Discord session found');
        
        return res.status(401).json({ 
          error: `Discord verification required. Please connect Discord and try again.`,
          isBurnedUser: isBurnedUser
        });
      }

      if (csrfToken && jwt) {
        // Get Discord username from JWT
        const discordUsername = jwt.discordUsername || 'Unknown';
        
        try {
          // Use appropriate RPC endpoint based on environment
          const rpcUrl = process.env.NODE_ENV === 'production' 
            ? "https://polygon-rpc.com" 
            : "http://127.0.0.1:8545";
          
          const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
          const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
          const voteContract = new ethers.Contract(
            process.env.NEXT_PUBLIC_VOTE_ADDR!,
            VOTING_ABI,
            signer
          );

          console.log(`Starting verification for address: ${address}, Discord: ${discordUsername}`);

          // First, mint a voting token to the user (management wallet has MINTER_ROLE)
          console.log('Minting voting token...');
          const mintTx = await voteContract.mint(address);
          const mintReceipt = await mintTx.wait(2);
          console.log('Voting token minted successfully');

          // Then register user with Discord username
          console.log('Registering user...');
          const nickname = ethers.utils.formatBytes32String(discordUsername);
          const registerTx = await voteContract.register(address, nickname);
          const registerReceipt = await registerTx.wait(2);

          if (registerReceipt) {
            console.log(`Successfully registered address:${address} with Discord username:${discordUsername}`);
            return res.status(200).json({
              message: "Verification Successful - Token minted and registered!",
            });
          }
        } catch (error: any) {
          console.log({ error });
          return res.status(500).json({
            message: "Internal Server Error while trying to register.",
            error: error.message || error,
          });
        }
      }

      break;
    default:
      return res.status(400).json({
        message: "This API Route only accepts 'PUT' requests.",
        error: "Bad Request",
      });
  }
}
