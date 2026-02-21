# DAObi Frontend Project Handoff Documentation

## Project Overview

**DAObi** is a blockchain-based governance platform with a Chinese imperial theme. The frontend provides a complete interface for token-based voting, banishment proposals, Discord verification, and mystical I Ching oracle consultations through token burning.

## Architecture

### Tech Stack
- **Framework**: Next.js 13+ with TypeScript
- **Styling**: Tailwind CSS with custom DAObi theme
- **Blockchain**: Ethereum/Hardhat local development
- **Wallet Integration**: MetaMask via ethers.js
- **Authentication**: NextAuth.js with Discord OAuth
- **API**: Next.js API routes for external service proxying

### Key Dependencies
```json
{
  "next": "^13.x",
  "react": "^18.x",
  "ethers": "^5.x",
  "next-auth": "^4.x",
  "@tailwindcss/forms": "^0.5.x"
}
```

## Environment Configuration

### Required Environment Variables (.env.local)
```bash
# Next.js Configuration
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=<generate-secure-secret>

# Discord OAuth
DISCORD_CLIENT_ID=<discord-app-client-id>
DISCORD_CLIENT_SECRET=<discord-app-secret>

# Smart Contract Addresses (Hardhat Local)
NEXT_PUBLIC_TOKEN_ADDR=0x5FbDB2315678afecb367f032d93F642f64180aa3
NEXT_PUBLIC_VOTE_ADDR=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
NEXT_PUBLIC_SEAL_ADDR=0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
NEXT_PUBLIC_BANISHMENT_ADDR=0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9

# Server-side Contract Interactions
PRIVATE_KEY=<hardhat-test-private-key>
```

## Application Structure

### Main Components

#### 1. **The Chancellery** (`/`)
- **Purpose**: User registration and Discord verification
- **Features**: 
  - Wallet connection (MetaMask)
  - Discord OAuth integration
  - Message signing for verification
  - Token minting after verification
- **Key Files**: 
  - `src/pages/index.tsx` - Main registration flow
  - `src/components/RegistrationForm.tsx` - Registration UI
  - `src/components/DiscordAuth.tsx` - Discord OAuth handling

#### 2. **Inner Courtyard** (`TabNavigation` - 'courtyard')
- **Purpose**: Voting and banishment governance
- **Features**:
  - **Factionalism Registry**: Vote for addresses, recuse, withdraw
  - **Court of Temporary Banishment**: Propose banishments, support accusations, execute banishments, tax farm stale accusations
  - Real-time blockchain event listeners
  - Smart caching with manual refresh
- **Key Files**:
  - `src/components/FactionalismRegistry.tsx`
  - `src/components/CourtOfBanishment.tsx`

#### 3. **The Hierarchy** (`TabNavigation` - 'hierarchy')
- **Purpose**: Display faction rankings and member information
- **Features**: Token holder rankings, vote counts, Discord username display
- **Key Files**: `src/components/FactionsTable.tsx`

#### 4. **Imperial Secretariat** (`TabNavigation` - 'secretariat')
- **Purpose**: Administrative lookup tools
- **Features**: Wallet ↔ Discord username bidirectional lookup
- **Key Files**: `src/components/ImperialSecretariat.tsx`

#### 5. **Ancestral Temple** (`TabNavigation` - 'temple')
- **Purpose**: Token burning with I Ching oracle readings
- **Features**: 
  - Token burning (ERC20Burnable.burn())
  - I Ching API integration via proxy
  - Mystical themed UI
- **Key Files**: 
  - `src/components/AncestralTemple.tsx`
  - `src/pages/api/iching.ts` - CORS proxy for external API

## Smart Contract Integration

### Contract Addresses & ABIs
The application interacts with four main contracts:

1. **DAObiContract3** (`NEXT_PUBLIC_TOKEN_ADDR`)
   - ERC20 token with burning capability
   - Functions: `balanceOf()`, `burn()`, `transfer()`

2. **DaobiVoteContract3** (`NEXT_PUBLIC_VOTE_ADDR`)
   - Voting token and governance
   - Functions: `vote()`, `recluse()`, `selfImmolate()`, `balanceOf()`

3. **DaobiChancellorsSeal** (`NEXT_PUBLIC_SEAL_ADDR`)
   - NFT minting for verified users
   - Functions: `mint()`, `balanceOf()`

4. **DaobiAccountability** (`NEXT_PUBLIC_BANISHMENT_ADDR`)
   - Banishment proposal system
   - Functions: `accuse()`, `support()`, `banish()`, `taxFarm()`
   - Events: `AccusationMade`, `AccusationJoined`, `Banished`

### Key Contract Interactions

#### Voting Flow
```typescript
// Vote for an address
await voteContract.vote(targetAddress);

// Recuse (unvote but keep token)
await voteContract.recluse();

// Withdraw (burn token, reclaim stake)
await voteContract.selfImmolate();
```

#### Banishment Flow
```typescript
// Propose banishment
await banishmentContract.accuse(targetAddress);

// Support accusation
await banishmentContract.support(targetAddress);

// Execute banishment (if conditions met)
await banishmentContract.banish(targetAddress);

// Tax farm stale accusations
await banishmentContract.taxFarm(targetAddress);
```

## API Routes

### `/api/auth/[...nextauth].ts`
NextAuth.js configuration for Discord OAuth with custom session handling.

### `/api/iching.ts`
CORS proxy for external I Ching API (`https://fortunerunners.com/iching/ask`).
- **Input**: `{ question: string, userId: string, language: string }`
- **Output**: Hexagram data with interpretation and advice
- **Fallback**: Provides mystical responses if external API fails

### `/api/mint.ts`
Server-side minting endpoint for verified users (uses private key).

## Development Setup

### Prerequisites
- Node.js 18+
- Hardhat blockchain running on port 8545
- MetaMask browser extension
- Discord Developer Application

### Installation & Running
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Runs on http://localhost:3001
```

### Hardhat Integration
Ensure Hardhat is running with deployed contracts:
```bash
# In contracts directory
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost
```

## Known Issues & Debugging

### Common Problems

1. **MetaMask Connection Issues**
   - **Cause**: Extension context invalidation after dev server restart
   - **Fix**: Refresh browser page completely (Ctrl+F5)

2. **"Cannot Estimate Gas" Errors**
   - **Cause**: Transaction would fail (insufficient balance, wrong contract)
   - **Fix**: Check token balances, verify contract addresses

3. **Discord OAuth Failures**
   - **Cause**: Incorrect client ID/secret or redirect URI mismatch
   - **Fix**: Verify Discord app configuration matches environment variables

4. **I Ching API Always Shows Fallback**
   - **Cause**: External API failing or CORS issues
   - **Debug**: Check server console for API request logs
   - **Fix**: Verify external API availability

### Debugging Tools

- **Browser Console**: Client-side errors and MetaMask interactions
- **Server Console**: API calls, contract interactions, I Ching requests
- **Network Tab**: HTTP requests and responses
- **MetaMask**: Transaction details and gas estimation

## Performance Optimizations

### Implemented Features
- **Smart Caching**: 2-minute cache for banishment proposals
- **Manual Refresh**: User-controlled data updates
- **Event Listeners**: Real-time blockchain event updates
- **Contract Parameter Caching**: Reduces redundant RPC calls
- **Gas Estimation**: Pre-validates transactions before submission

### Monitoring
- Transaction hashes logged to console
- API request/response logging
- Loading states for all async operations
- Error boundaries for graceful failure handling

## Security Considerations

### Environment Variables
- Never commit `.env.local` to version control
- Use different Discord apps for dev/prod environments
- Rotate secrets regularly

### Smart Contract Interactions
- All transactions require user approval via MetaMask
- Gas estimation prevents failed transactions
- Balance checking before operations
- Proper error handling for contract failures

### API Security
- CORS proxy prevents direct external API exposure
- Input validation on all API routes
- Rate limiting considerations for production

## Deployment Considerations

### Production Environment
- Update contract addresses for mainnet/testnet
- Configure production Discord OAuth app
- Set secure NEXTAUTH_SECRET
- Enable proper error logging
- Consider CDN for static assets

### Environment-Specific Configs
```bash
# Production (.env.production)
NEXTAUTH_URL=https://your-domain.com
NEXT_PUBLIC_TOKEN_ADDR=<mainnet-contract-address>
# ... other production addresses
```

## Future Enhancements

### Pending Tasks
- [ ] Fix TypeScript errors with environment variables
- [ ] Update FactionsTable to display Discord usernames from events
- [ ] Debug I Ching API response handling (currently showing fallback)
- [ ] Add comprehensive error logging
- [ ] Implement user session persistence
- [ ] Add mobile responsiveness improvements

### Potential Features
- Multi-language support for I Ching readings
- Advanced governance proposal types
- Historical voting/banishment analytics
- Push notifications for governance events
- Advanced Discord role integration

## Support & Maintenance

### Key Files to Monitor
- Environment configuration files
- Smart contract ABIs and addresses
- Discord OAuth configuration
- External API endpoints

### Regular Maintenance
- Update dependencies for security patches
- Monitor external API availability
- Verify smart contract functionality
- Test Discord OAuth integration
- Backup user verification data

## Contact & Resources

- **Smart Contracts**: Located in `/daobi/contracts/`
- **Frontend Repository**: `/simple-daobi-frontend/`
- **Discord Developer Portal**: For OAuth app management
- **I Ching API**: `https://fortunerunners.com/iching/ask`

---

*This documentation covers the current state of the DAObi frontend as of the handoff date. For technical questions or issues, refer to the codebase comments and console logging for debugging information.*
