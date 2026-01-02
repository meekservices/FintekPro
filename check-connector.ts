async function checkConnector() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  console.log('Connector Hostname:', hostname);
  console.log('Token available:', !!xReplitToken);

  if (!xReplitToken) {
    console.log('No token available');
    return;
  }

  const response = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=twilio',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  );
  
  const data = await response.json();
  console.log('\nConnector Response:');
  if (data.items?.[0]) {
    const settings = data.items[0].settings;
    console.log('Account SID:', settings.account_sid);
    console.log('API Key:', settings.api_key?.substring(0, 10) + '...');
    console.log('Phone Number:', settings.phone_number);
  } else {
    console.log('No Twilio connector found');
    console.log('Full response:', JSON.stringify(data, null, 2));
  }
}

checkConnector();
