import {assertDemoDatabase} from '../server/demo-fixtures';
import {openDatabase} from '../server/db';
import {seedBoardDemo} from '../server/boards-demo';

const path = process.env.DEMO_DATABASE_PATH;
if (!path) throw new Error('DEMO_DATABASE_PATH is required.');
assertDemoDatabase(path, process.env.NODE_ENV === 'production' ? 'production' : 'development');
const db = openDatabase(path);
try {
  console.log(await seedBoardDemo(db));
} finally {
  db.close();
}
