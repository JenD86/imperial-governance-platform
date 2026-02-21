# DAObi Frontend Deployment Guide

## 🏛️ Production Deployment to daobi.org

### Discord Application Setup

1. **Create Discord Application**:
   - Go to https://discord.com/developers/applications
   - Create new application named "DAObi"
   - Navigate to OAuth2 → General

2. **Configure OAuth2**:
   - **Local Development**: Add redirect URL: `http://localhost:3001/api/auth/callback/discord`
   - **Production**: Add redirect URL: `https://daobi.org/api/auth/callback/discord`
   - Copy Client ID and Client Secret

### Environment Configuration

#### Local Development (.env.local)
```bash
# Next.js Configuration
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_URL_INTERNAL=http://localhost:3001
NEXTAUTH_SECRET=your-random-secret-here

# Discord OAuth Configuration
DISCORD_CLIENT_ID=your-discord-client-id-here
DISCORD_CLIENT_SECRET=your-discord-client-secret-here

# Contract Addresses (Local Hardhat)
NEXT_PUBLIC_TOKEN_ADDR=0x5FbDB2315678afecb367f032d93F642f64180aa3
NEXT_PUBLIC_VOTE_ADDR=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
NEXT_PUBLIC_SEAL_ADDR=0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
NEXT_PUBLIC_BANISHMENT_ADDR=0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9

# Private key for server-side contract interactions
PRIVATE_KEY=your-hardhat-private-key-here
```

#### Production (.env.production)
```bash
# Production Configuration for daobi.org
NEXTAUTH_URL=https://daobi.org
NEXTAUTH_URL_INTERNAL=https://daobi.org
NEXTAUTH_SECRET=your-production-nextauth-secret-here

# Discord OAuth Configuration (Production)
DISCORD_CLIENT_ID=your-production-discord-client-id-here
DISCORD_CLIENT_SECRET=your-production-discord-client-secret-here

# Contract Addresses (Polygon Mainnet)
NEXT_PUBLIC_TOKEN_ADDR=your-polygon-token-contract-address
NEXT_PUBLIC_VOTE_ADDR=your-polygon-voting-contract-address
NEXT_PUBLIC_SEAL_ADDR=your-polygon-seal-contract-address
NEXT_PUBLIC_BANISHMENT_ADDR=your-polygon-banishment-contract-address

# Private key for server-side contract interactions (Use secure key management)
PRIVATE_KEY=your-production-private-key-here
```

### Deployment Steps

1. **Build the Application**:
   ```bash
   npm run build
   ```

2. **Deploy to Hosting Platform**:
   - **Vercel**: Connect GitHub repo, set environment variables
   - **Netlify**: Deploy build folder, configure environment variables
   - **Custom Server**: Upload build files, configure reverse proxy

3. **Configure Custom Domain**:
   - Point daobi.org to your hosting platform
   - Ensure SSL certificate is configured
   - Update Discord OAuth redirect URLs

### Key Features

- **Discord Integration**: Users authenticate with Discord for anti-bot protection
- **Polygon Optimized**: Smart caching reduces RPC costs (~$2/day for 50 users)
- **On-Demand Updates**: FactionsTable refreshes after user interactions
- **Real Usernames**: Discord usernames appear in governance interface
- **Mobile Responsive**: TailwindCSS ensures great UX on all devices

### Security Notes

- Discord sessions auto-disconnect after registration for privacy
- Private keys should use secure key management in production
- NextAuth secret should be cryptographically random
- Consider rate limiting for API endpoints

### Support

The frontend automatically detects environment (development vs production) and configures:
- RPC endpoints (localhost vs Polygon)
- Contract addresses (local vs mainnet)
- Discord OAuth URLs
- Caching strategies

Ready for production deployment at daobi.org! 🚀
