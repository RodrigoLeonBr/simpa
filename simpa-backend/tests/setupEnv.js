const path = require('path');
const fs = require('fs');

const envPath =
  process.env.DOTENV_PATH || path.join(__dirname, '../..', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

if (process.env.PG_HOST === 'postgres') {
  process.env.PG_HOST = '127.0.0.1';
  process.env.PG_PORT = process.env.PG_PUBLISH_PORT || '5433';
}
