import { createPool } from 'mysql2';

const connection = createPool({
  connectionLimit: 10,
  acquireTimeout: 10000,
  host: process.env.HOST,
  user: process.env.DB_USER,
  password: process.env.PASSWORD,
  database: process.env.DATABASE,
});

connection.on('connection', con => {
  console.log(`A connection was made ${con.threadId}`);
});

connection.on('error', err => {
  console.log('[mysql error]', err);
});

connection.on('end', con => {
  console.log(`A connection was ended ${con.threadId}`);
});

export default connection;
