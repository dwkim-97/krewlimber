import {openDatabase} from '../server/db';
import {assertDemoDatabase, seedDemoUsers} from '../server/demo-fixtures';

const path = process.env.DEMO_DATABASE_PATH;
if (!path) throw new Error('Set DEMO_DATABASE_PATH to a dedicated temporary preview database.');
assertDemoDatabase(path, process.env.NODE_ENV === 'production' ? 'production' : 'development');
const db = openDatabase(path);
try {
  console.log(JSON.stringify(await seedDemoUsers(db)));
} finally {
  db.close();
}
