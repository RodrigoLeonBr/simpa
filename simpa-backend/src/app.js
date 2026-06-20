const path = require('path');
const fs = require('fs');

const envPath = process.env.DOTENV_PATH || path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const express = require('express');
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');
const verifyJWT = require('./middleware/verifyJWT');
const authRoutes = require('./routes/auth');
const healthRoutes = require('./routes/health');
const apiRoutes = require('./routes/api');

const app = express();

app.use(cors());
app.use(express.json());
app.use(requestLogger);

app.use('/auth', authRoutes);
app.use('/api/health', healthRoutes);
app.use('/api', verifyJWT, apiRoutes);

app.use(errorHandler);

module.exports = app;

if (require.main === module) {
  const PORT = parseInt(process.env.PORT || '3001', 10);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SIMPA API listening on ${PORT}`);
  });
}
