const { Client } = require('pg');

async function grantAgentRole() {
  const connectionString = "postgresql://postgres:66ba0a6b1acf6d425a982cbf857b70672ed9889b55bb015d@localhost:5433/fintekpro";
  
  console.log("Connecting to:", connectionString.replace(/:[^:@]*@/, ':***@'));
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log("Connected to database.");

    const email = 'sangram.m@outlook.com';

    // First check if user exists
    const userRes = await client.query('SELECT id, email, roles FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) {
      console.log(`User with email ${email} not found.`);
      process.exit(1);
    }

    const user = userRes.rows[0];
    console.log(`Current roles for ${email}:`, user.roles);

    let newRoles = user.roles || ['user'];
    if (!newRoles.includes('agent')) {
      newRoles.push('agent');
    }
    
    // Also grant admin if they are the owner
    if (!newRoles.includes('admin')) {
      newRoles.push('admin');
    }

    const updateRes = await client.query(
      'UPDATE users SET roles = $1 WHERE email = $2 RETURNING id, email, roles',
      [newRoles, email]
    );

    console.log("Successfully updated user roles:");
    console.log(updateRes.rows[0]);

  } catch (error) {
    console.error("Error executing query:", error);
  } finally {
    await client.end();
  }
}

grantAgentRole();
