const express = require('express');
const dashboardRoutes = require('./dashboard');

const router = express.Router();

router.use('/v1/dashboard', dashboardRoutes);

module.exports = router;
