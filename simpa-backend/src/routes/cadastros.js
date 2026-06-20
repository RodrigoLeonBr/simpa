const express = require('express');
const { ENTITIES } = require('../services/cadastroRegistry');
const {
  listEntity,
  createEntity,
  updateEntity,
  inactivateEntity,
} = require('../services/cadastrosService');

const router = express.Router();

function registerResource(pathKey) {
  router.get(`/${pathKey}`, async (req, res, next) => {
    try {
      const rows = await listEntity(pathKey, req.query);
      return res.json(rows);
    } catch (err) {
      return next(err);
    }
  });

  router.post(`/${pathKey}`, async (req, res, next) => {
    try {
      const row = await createEntity(pathKey, req.body);
      return res.status(201).json(row);
    } catch (err) {
      return next(err);
    }
  });

  router.put(`/${pathKey}/:id`, async (req, res, next) => {
    try {
      const row = await updateEntity(pathKey, req.params.id, req.body);
      return res.json(row);
    } catch (err) {
      return next(err);
    }
  });

  router.delete(`/${pathKey}/:id`, async (req, res, next) => {
    try {
      const result = await inactivateEntity(pathKey, req.params.id);
      return res.json(result);
    } catch (err) {
      return next(err);
    }
  });
}

Object.keys(ENTITIES).forEach(registerResource);

module.exports = router;
