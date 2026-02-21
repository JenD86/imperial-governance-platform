import NextAuth from 'next-auth'
import DiscordProvider from 'next-auth/providers/discord'
import type { JWT } from 'next-auth/jwt'
import type { Session, Account, Profile } from 'next-auth'

export const authOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: {
        url: "https://discord.com/oauth2/authorize",
        params: {
          scope: "identify email",
          response_type: "code",
          prompt: "none"
        }
      }
    })
  ],
  debug: true,
  pages: {
    error: '/auth/error'
  },
  callbacks: {
    async jwt({ token, account, profile }: { token: JWT; account: Account | null; profile?: Profile }) {
      // Persist the OAuth access_token and or the user id to the token right after signin
      if (account) {
        token.accessToken = account.access_token
      }
      if (profile) {
        token.discordId = profile.id
        token.discordUsername = (profile as any).username
      }
      return token
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      // Send properties to the client, like an access_token and user id from a provider.
      (session as any).accessToken = token.accessToken as string
      if (session.user) {
        (session.user as any).discordId = token.discordId as string
        (session.user as any).discordUsername = token.discordUsername as string
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);
