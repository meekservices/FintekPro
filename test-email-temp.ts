import nodemailer from 'nodemailer';

async function testEmail() {
  const host = process.env.EMAIL_HOST;
  const port = parseInt(process.env.EMAIL_PORT || '587');
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  console.log('Testing email configuration...');
  console.log('Host:', host);
  console.log('Port:', port);
  console.log('User:', user);
  console.log('Pass:', pass ? '(configured)' : '(missing)');

  if (!host || !user || !pass) {
    console.error('❌ Missing email configuration');
    process.exit(1);
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    console.log('\n🔍 Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully!');

    // Send a test email
    console.log('\n📧 Sending test email to self...');
    const info = await transporter.sendMail({
      from: `"FintekPro Test" <${user}>`,
      to: user, // Send to self for testing
      subject: 'FintekPro Email Test - ' + new Date().toISOString(),
      text: 'This is a test email to verify the mail server is working.',
      html: '<h1>Email Test Successful!</h1><p>The mail server is working correctly.</p>',
    });

    console.log('✅ Test email sent successfully!');
    console.log('   Message ID:', info.messageId);
    console.log('   Accepted:', info.accepted?.join(', '));
    
  } catch (error: any) {
    console.error('❌ Email test failed:', error.message);
    if (error.code) console.error('   Error code:', error.code);
    if (error.response) console.error('   Server response:', error.response);
    process.exit(1);
  }
}

testEmail();
