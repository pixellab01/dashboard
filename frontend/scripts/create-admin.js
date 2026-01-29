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

async function createOrUpdateAdmin() {
  const uri = process.env.MONGODB_URI;
  
  if (!uri) {
    console.error('❌ MONGODB_URI not found in .env.local');
    console.error('   Please make sure MONGODB_URI is set in your .env.local file');
    process.exit(1);
  }

  // Get admin details from command line arguments or use defaults
  const args = process.argv.slice(2);
  let email = 'admin@example.com';
  let password = 'admin123';
  let name = 'Admin User';

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email' && args[i + 1]) {
      email = args[i + 1];
      i++;
    } else if (args[i] === '--password' && args[i + 1]) {
      password = args[i + 1];
      i++;
    } else if (args[i] === '--name' && args[i + 1]) {
      name = args[i + 1];
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Usage: node scripts/create-admin.js [options]

Options:
  --email <email>     Admin email (default: admin@example.com)
  --password <pass>   Admin password (default: admin123)
  --name <name>       Admin name (default: Admin User)
  --help, -h          Show this help message

Examples:
  node scripts/create-admin.js
  node scripts/create-admin.js --email admin@mydomain.com --password mypass123
  node scripts/create-admin.js --email admin@mydomain.com --password mypass123 --name "Super Admin"
      `);
      process.exit(0);
    }
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db('dashboard');
    const usersCollection = db.collection('users');

    // Find all existing admin users
    const existingAdmins = await usersCollection.find({ role: 'admin' }).toArray();

    if (existingAdmins.length > 0) {
      console.log(`⚠️  Found ${existingAdmins.length} existing admin user(s)`);
      
      // If there are multiple admins, remove extras and keep only one
      if (existingAdmins.length > 1) {
        console.log('⚠️  Multiple admin users found. Removing extras...');
        const adminToKeep = existingAdmins[0]._id;
        const result = await usersCollection.deleteMany({
          role: 'admin',
          _id: { $ne: adminToKeep }
        });
        console.log(`   Removed ${result.deletedCount} extra admin user(s)\n`);
      }

      // Update the existing admin user
      const adminId = existingAdmins[0]._id;
      const updateResult = await usersCollection.updateOne(
        { _id: adminId },
        {
          $set: {
            email: email,
            password: password,
            name: name,
            role: 'admin',
            updatedAt: new Date().toISOString()
          }
        }
      );

      if (updateResult.modifiedCount > 0) {
        console.log('✅ Admin user updated successfully!\n');
        console.log('📋 Updated Admin Details:');
        console.log(`   - Email: ${email}`);
        console.log(`   - Password: ${password}`);
        console.log(`   - Name: ${name}`);
        console.log(`   - Role: admin\n`);
      } else {
        console.log('ℹ️  Admin user exists with the same details (no update needed)\n');
        console.log('📋 Current Admin Details:');
        console.log(`   - Email: ${email}`);
        console.log(`   - Password: ${password}`);
        console.log(`   - Name: ${name}`);
        console.log(`   - Role: admin\n`);
      }
    } else {
      // Create new admin user
      const newAdmin = {
        email: email,
        password: password,
        name: name,
        role: 'admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const insertResult = await usersCollection.insertOne(newAdmin);

      if (insertResult.insertedId) {
        console.log('✅ Admin user created successfully!\n');
        console.log('📋 Admin Details:');
        console.log(`   - Email: ${email}`);
        console.log(`   - Password: ${password}`);
        console.log(`   - Name: ${name}`);
        console.log(`   - Role: admin\n`);
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log('✅ Connection closed');
  }
}

createOrUpdateAdmin();
