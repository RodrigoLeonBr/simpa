const express = require('express');
const dashboardRoutes = require('./dashboard');
const importacaoRoutes = require('./importacao');
const siaRoutes = require('./sia');
const sihRoutes = require('./sih');
const cadastrosRoutes = require('./cadastros');
const adminRoutes = require('./admin');
const populacaoRoutes = require('./populacao');

const router = express.Router();

router.use('/v1/dashboard', dashboardRoutes);
router.use('/importacao', importacaoRoutes);
router.use('/sia', siaRoutes);
router.use('/sih', sihRoutes);
router.use('/cadastros', cadastrosRoutes);
router.use('/admin', adminRoutes);
router.use('/populacao', populacaoRoutes);

module.exports = router;
