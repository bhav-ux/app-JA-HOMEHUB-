import admin from 'firebase-admin';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const [, , email, familyId] = process.argv;
const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!email || !familyId || !keyPath) {
  console.error('Usage: GOOGLE_APPLICATION_CREDENTIALS=<path-to-service-account.json> node scripts/transferOwnership.mjs <newOwnerEmail> <familyId>');
  process.exit(1);
}

const serviceAccount = require(keyPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const auth = admin.auth();

async function transferOwnership() {
  const newOwner = await auth.getUserByEmail(email);
  const familyRef = db.collection('families').doc(familyId);
  const familySnap = await familyRef.get();

  if (!familySnap.exists) {
    throw new Error(`Family ${familyId} not found`);
  }

  const data = familySnap.data();
  const members = data.members || [];

  if (!members.includes(newOwner.uid)) {
    throw new Error(`${email} (${newOwner.uid}) is not a member of family ${familyId}`);
  }

  const newAdminIds = members.filter((uid) => uid !== newOwner.uid);

  await familyRef.update({
    ownerId: newOwner.uid,
    adminIds: newAdminIds,
  });

  console.log(`${email} (${newOwner.uid}) is now the owner of family ${familyId}`);
  console.log(`adminIds set to: ${JSON.stringify(newAdminIds)}`);
}

transferOwnership()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed:', err.message);
    process.exit(1);
  });
