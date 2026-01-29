const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Read .env.local file
function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=:#]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        process.env[key] = value;
      }
    });
  }
}

loadEnvFile();

async function getAdminCredentials() {
  const uri = process.env.MONGODB_URI;
  
  if (!uri) {
    console.error('❌ MONGODB_URI not found in .env.local');
    console.error('   Please make sure MONGODB_URI is set in your .env.local file');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db('dashboard');
    const usersCollection = db.collection('users');

    // Find all admin users
    const adminUsers = await usersCollection.find({ role: 'admin' }).toArray();

    if (adminUsers.length === 0) {
      console.log('❌ No admin users found in the database.');
      console.log('   You may need to create an admin user first.\n');
      
      // Show all users
      const allUsers = await usersCollection.find({}).toArray();
      if (allUsers.length > 0) {
        console.log('📋 All users in database:');
        allUsers.forEach((user, index) => {
          console.log(`\n   User ${index + 1}:`);
          console.log(`   - Email: ${user.email}`);
          console.log(`   - Role: ${user.role || 'not set'}`);
          console.log(`   - Name: ${user.name || 'not set'}`);
        });
      }
    } else {
      console.log(`✅ Found ${adminUsers.length} admin user(s):\n`);
      adminUsers.forEach((user, index) => {
        console.log(`   Admin ${index + 1}:`);
        console.log(`   - Email: ${user.email}`);
        console.log(`   - Password: ${user.password}`);
        console.log(`   - Name: ${user.name || 'not set'}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log('✅ Connection closed');
  }
}

getAdminCredentials();
