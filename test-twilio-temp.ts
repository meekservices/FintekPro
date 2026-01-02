import twilio from 'twilio';

const testPhone = '+917795048528';

async function testTwilio() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const smsFrom = process.env.TWILIO_PHONE_NUMBER;
  const whatsappFrom = process.env.TWILIO_WHATSAPP_NUMBER;

  console.log('=== Twilio Test ===');
  console.log('Account SID:', accountSid ? `${accountSid.slice(0,10)}...` : 'MISSING');
  console.log('Auth Token:', authToken ? '(configured)' : 'MISSING');
  console.log('SMS From:', smsFrom);
  console.log('WhatsApp From:', whatsappFrom);
  console.log('Test To:', testPhone);
  console.log('');

  if (!accountSid || !authToken) {
    console.error('❌ Missing Twilio credentials');
    process.exit(1);
  }

  const client = twilio(accountSid, authToken);

  // Test SMS
  console.log('📱 Testing SMS...');
  try {
    const smsResult = await client.messages.create({
      body: 'FintekPro Test SMS - Your OTP is 123456. This is a test message.',
      from: smsFrom,
      to: testPhone
    });
    console.log('✅ SMS sent successfully!');
    console.log('   SID:', smsResult.sid);
    console.log('   Status:', smsResult.status);
  } catch (error: any) {
    console.error('❌ SMS failed:', error.message);
    if (error.code) console.error('   Error code:', error.code);
  }

  console.log('');

  // Test WhatsApp
  console.log('💬 Testing WhatsApp...');
  try {
    const waResult = await client.messages.create({
      body: 'FintekPro Test WhatsApp - Your OTP is 123456. This is a test message.',
      from: `whatsapp:${whatsappFrom}`,
      to: `whatsapp:${testPhone}`
    });
    console.log('✅ WhatsApp message sent successfully!');
    console.log('   SID:', waResult.sid);
    console.log('   Status:', waResult.status);
  } catch (error: any) {
    console.error('❌ WhatsApp failed:', error.message);
    if (error.code) console.error('   Error code:', error.code);
  }
}

testTwilio();
