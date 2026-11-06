import {assertDemoDatabase} from '../server/demo-fixtures';
import {seedExistingDemoClimbs} from '../server/demo-climbs';
import {openDatabase, transaction} from '../server/db';

const path = process.env.DATABASE_PATH ?? '';
assertDemoDatabase(path, process.env.NODE_ENV === 'production' ? 'production' : 'development');
const db = openDatabase(path);
try {
  console.log(transaction(db, () => seedExistingDemoClimbs(db)));
} finally {
  db.close();
}
