/**
 * Create Test User Script
 * Crea un usuario de prueba en Firebase Authentication
 * Ejecutar con: npm run create-test-user
 */

import { initializeFirebaseAdmin } from '../src/server/config/firebaseAdmin';
import { getAdmin } from '../src/server/config/firebaseAdmin';

const TEST_USER_EMAIL = 'admin@test.com';
const TEST_USER_PASSWORD = 'admin123';

async function createTestUser() {
  try {
    console.log('🔥 Initializing Firebase Admin SDK...');
    initializeFirebaseAdmin();
    
    const admin = getAdmin();
    const auth = admin.auth();

    console.log(`\n📝 Creating test user: ${TEST_USER_EMAIL}`);

    try {
      // Intentar obtener el usuario primero
      const existingUser = await auth.getUserByEmail(TEST_USER_EMAIL);
      console.log('⚠️  User already exists with UID:', existingUser.uid);
      console.log('\n✅ You can use these credentials to login:');
      console.log(`   Email: ${TEST_USER_EMAIL}`);
      console.log(`   Password: ${TEST_USER_PASSWORD}`);
      return;
    } catch (error: any) {
      // Usuario no existe, crearlo
      if (error.code === 'auth/user-not-found') {
        const userRecord = await auth.createUser({
          email: TEST_USER_EMAIL,
          password: TEST_USER_PASSWORD,
          emailVerified: true,
          disabled: false
        });

        console.log('✅ Test user created successfully!');
        console.log('   UID:', userRecord.uid);
        console.log('   Email:', userRecord.email);
        console.log('\n🔑 Login Credentials:');
        console.log(`   Email: ${TEST_USER_EMAIL}`);
        console.log(`   Password: ${TEST_USER_PASSWORD}`);
        console.log('\n💡 You can now login at: http://localhost:5173/login');
      } else {
        throw error;
      }
    }

  } catch (error: any) {
    console.error('❌ Error creating test user:', error.message);
    process.exit(1);
  }
}

// Ejecutar script
createTestUser()
  .then(() => {
    console.log('\n✨ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
