// Test script to verify Google Cloud Storage permissions
import { objectStorageClient } from './server/objectStorage';

const BUCKET_NAME = 'replit-objstore-7b306d6a-5cfa-4282-bce0-65a5f8cd4c06';

async function testObjectStorage() {
  console.log('🧪 Testing Object Storage Permissions...\n');
  console.log(`📦 Bucket: ${BUCKET_NAME}`);
  console.log(`🔑 Service Account: lore-service@marine-cycle-160323.iam.gserviceaccount.com\n`);

  try {
    // Test 1: Check if bucket exists and is accessible
    console.log('Test 1: Checking bucket access...');
    const bucket = objectStorageClient.bucket(BUCKET_NAME);
    const [exists] = await bucket.exists();
    
    if (exists) {
      console.log('✅ Bucket exists and is accessible\n');
    } else {
      console.log('❌ Bucket not found or not accessible\n');
      process.exit(1);
    }

    // Test 2: List files in public directory
    console.log('Test 2: Listing files in /public directory...');
    const [files] = await bucket.getFiles({ prefix: 'public/' });
    console.log(`✅ Found ${files.length} files in public directory`);
    if (files.length > 0) {
      console.log('   Sample files:');
      files.slice(0, 5).forEach(file => {
        console.log(`   - ${file.name}`);
      });
    }
    console.log('');

    // Test 3: List files in private directory
    console.log('Test 3: Listing files in /.private directory...');
    const [privateFiles] = await bucket.getFiles({ prefix: '.private/' });
    console.log(`✅ Found ${privateFiles.length} files in private directory`);
    if (privateFiles.length > 0) {
      console.log('   Sample files:');
      privateFiles.slice(0, 5).forEach(file => {
        console.log(`   - ${file.name}`);
      });
    }
    console.log('');

    // Test 4: Get bucket metadata
    console.log('Test 4: Checking bucket metadata...');
    const [metadata] = await bucket.getMetadata();
    console.log('✅ Bucket metadata retrieved:');
    console.log(`   - Location: ${metadata.location}`);
    console.log(`   - Storage Class: ${metadata.storageClass}`);
    console.log('');

    console.log('🎉 All tests passed! Object storage is properly configured.');
    console.log('\n📋 Summary:');
    console.log('   ✅ Bucket accessible');
    console.log('   ✅ Can list files in public directory');
    console.log('   ✅ Can list files in private directory');
    console.log('   ✅ Can read bucket metadata');
    console.log('\n✨ The Storage Object Viewer permissions are working correctly!');

  } catch (error: any) {
    console.error('❌ Error testing object storage:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Verify you granted "Storage Object Viewer" role to:');
    console.error('      lore-service@marine-cycle-160323.iam.gserviceaccount.com');
    console.error('   2. Check the bucket name matches:');
    console.error(`      ${BUCKET_NAME}`);
    console.error('   3. Ensure permissions were granted at the bucket level');
    process.exit(1);
  }
}

testObjectStorage();
