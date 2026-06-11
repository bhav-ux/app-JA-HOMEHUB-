import admin from 'firebase-admin';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const [, , email, familyId] = process.argv;
const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!email || !familyId || !keyPath) {
  console.error('Usage: GOOGLE_APPLICATION_CREDENTIALS=<path-to-service-account.json> node scripts/promoteAdmin.mjs <email> <familyId>');
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

async function promoteAdmin() {
  const user = await auth.getUserByEmail(email);
  const familyRef = db.collection('families').doc(familyId);
  const familySnap = await familyRef.get();

  if (!familySnap.exists) {
    throw new Error(`Family ${familyId} not found`);
  }

  const data = familySnap.data();
  if (!(data.members || []).includes(user.uid)) {
    throw new Error(`${email} (${user.uid}) is not a member of family ${familyId}`);
  }

  await familyRef.update({
    adminIds: admin.firestore.FieldValue.arrayUnion(user.uid),
  });

  console.log(`Promoted ${email} (${user.uid}) to admin of family ${familyId}`);
}

promoteAdmin()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed:', err.message);
    process.exit(1);
  });
