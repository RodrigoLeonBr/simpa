require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const errorHandler = require('./middleware/errorHandler');

const importacaoRoutes = require('./routes/importacao');
const siaRoutes        = require('./routes/sia');
const dashboardRoutes  = require('./routes/dashboard');
const cadastrosRoutes  = require('./routes/cadastros');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/importacao', importacaoRoutes);
app.use('/api/sia',        siaRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/cadastros',  cadastrosRoutes);

app.get('/api/health', (_, res) => res.json({ status: 'ok', ts: new Date() }));

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`SIMPA backend rodando em http://localhost:${PORT}`);
});

module.exports = app;
