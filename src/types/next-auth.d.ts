import NextAuth from "next-auth"

// Extend Window interface to include ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}

declare module "next-auth" {
  interface Session {
    accessToken?: string
    user: {
      name?: string | null
      email?: string | null
      image?: string | null
      discordId?: string
      discordUsername?: string
    }
  }

  interface Profile {
    id: string
    username: string
    discriminator: string
    avatar: string | null
  }

  interface JWT {
    accessToken?: string
    discordId?: string
    discordUsername?: string
  }
}
