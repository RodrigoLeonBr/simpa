const express = require('express');

const router = express.Router();

router.get('/v1/dashboard/planejamento', (_req, res) => {
  res.status(501).json({ error: 'Dashboard em implementação (Task 05)' });
});

module.exports = router;
