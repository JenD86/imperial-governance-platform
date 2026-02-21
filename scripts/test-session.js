// Simple test to check if the session endpoint is working
const fetch = require('node-fetch');

async function testSession() {
  try {
    console.log('Testing session endpoint...');
    
    const response = await fetch('http://localhost:3001/api/auth/session');
    const sessionData = await response.json();
    
    console.log('Session response status:', response.status);
    console.log('Session data:', JSON.stringify(sessionData, null, 2));
    
    if (sessionData && sessionData.user) {
      console.log('✅ Session is active');
      console.log('Discord ID:', sessionData.user.discordId);
      console.log('Discord Username:', sessionData.user.discordUsername);
    } else {
      console.log('❌ No active session');
    }
    
  } catch (error) {
    console.error('❌ Error testing session:', error.message);
  }
}

testSession();
