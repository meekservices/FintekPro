import twilio from 'twilio';

async function listPhoneNumbers() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  console.log('=== Checking Twilio Account ===');
  console.log('Account SID:', accountSid);
  
  if (!accountSid || !authToken) {
    console.error('❌ Missing Twilio credentials');
    process.exit(1);
  }

  const client = twilio(accountSid, authToken);

  try {
    // List incoming phone numbers on this account
    console.log('\n📱 Phone numbers on this account:');
    const incomingNumbers = await client.incomingPhoneNumbers.list();
    
    if (incomingNumbers.length === 0) {
      console.log('   No phone numbers found on this account!');
    } else {
      incomingNumbers.forEach((num, i) => {
        console.log(`   ${i + 1}. ${num.phoneNumber} (${num.friendlyName})`);
        console.log(`      Capabilities: SMS=${num.capabilities?.sms}, Voice=${num.capabilities?.voice}`);
      });
    }

    // Check account balance/status
    console.log('\n💰 Account Info:');
    const account = await client.api.accounts(accountSid).fetch();
    console.log('   Status:', account.status);
    console.log('   Type:', account.type);
    console.log('   Name:', account.friendlyName);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.code) console.error('   Code:', error.code);
  }
}

listPhoneNumbers();
