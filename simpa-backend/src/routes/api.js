const express = require('express');
const dashboardRoutes = require('./dashboard');
const importacaoRoutes = require('./importacao');
const siaRoutes = require('./sia');

const router = express.Router();

router.use('/v1/dashboard', dashboardRoutes);
router.use('/importacao', importacaoRoutes);
router.use('/sia', siaRoutes);

module.exports = router;
