const express = require('express');
const bcrypt = require('bcrypt');
const fs = require('fs');
const multer = require('multer');
const os = require('os');
const { query } = require('../services/db');
const requireAdmin = require('../middleware/requireAdmin');
const requireAdminOrPlanning = require('../middleware/requireAdminOrPlanning');
const { logAudit } = require('../services/auditService');
const backupService = require('../services/backupService');

const router = express.Router();

const VALID_PERFIS = [
  'Administrador',
  'Gestor Secretaria',
  'Gestor de Unidade',
  'Planejamento',
];

const MAX_RESTORE_BYTES =
  Math.max(1, parseInt(process.env.BACKUP_MAX_RESTORE_MB || '500', 10)) * 1024 * 1024;
const restoreUpload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: MAX_RESTORE_BYTES, files: 1 },
});

function clientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || null;
}

function validateSenha(senha) {
  if (!senha || String(senha).length < 8) {
    return 'senha deve ter ao menos 8 caracteres';
  }
  return null;
}

router.get('/audit-log', requireAdminOrPlanning, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];

    if (req.query.usuario_id) {
      params.push(req.query.usuario_id);
      conditions.push(`a.usuario_id = $${params.length}`);
    }
    if (req.query.acao) {
      params.push(req.query.acao);
      conditions.push(`a.acao = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(
      `SELECT COUNT(*)::int AS total FROM audit_log a ${where}`,
      params
    );
    const total = countResult.rows[0].total;

    params.push(limit, offset);
    const { rows } = await query(
      `SELECT a.id, a.usuario_id, u.username, a.acao, a.recurso,
              a.detalhes, a.ip, a.criado_em
       FROM audit_log a
       LEFT JOIN usuarios u ON u.id = a.usuario_id
       ${where}
       ORDER BY a.criado_em DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.json({
      data: rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    return next(err);
  }
});

router.use(requireAdmin);

router.get('/usuarios', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, username, nome, perfil, ativo, criado_em, ultimo_login
       FROM usuarios
       ORDER BY nome`
    );
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

router.post('/usuarios', async (req, res, next) => {
  try {
    const { username, senha, nome, perfil } = req.body || {};

    if (!username || !senha || !nome || !perfil) {
      return res.status(400).json({
        error: 'username, senha, nome e perfil são obrigatórios',
      });
    }

    if (!VALID_PERFIS.includes(perfil)) {
      return res.status(400).json({ error: 'perfil inválido' });
    }

    const senhaError = validateSenha(senha);
    if (senhaError) {
      return res.status(400).json({ error: senhaError });
    }

    const senhaHash = await bcrypt.hash(senha, 10);
    const { rows } = await query(
      `INSERT INTO usuarios (username, senha_hash, nome, perfil)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, nome, perfil, ativo, criado_em`,
      [username, senhaHash, nome, perfil]
    );

    await logAudit({
      usuarioId: req.user.id,
      acao: 'usuario_create',
      recurso: `admin/usuarios/${rows[0].id}`,
      detalhes: { username, perfil },
      ip: clientIp(req),
    });

    return res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'username já existe' });
    }
    return next(err);
  }
});

router.put('/usuarios/:id', async (req, res, next) => {
  try {
    const { nome, perfil, ativo, senha } = req.body || {};

    if (perfil && !VALID_PERFIS.includes(perfil)) {
      return res.status(400).json({ error: 'perfil inválido' });
    }

    const sets = [];
    const params = [];

    if (nome !== undefined) {
      params.push(nome);
      sets.push(`nome=$${params.length}`);
    }
    if (perfil !== undefined) {
      params.push(perfil);
      sets.push(`perfil=$${params.length}`);
    }
    if (ativo !== undefined) {
      params.push(ativo);
      sets.push(`ativo=$${params.length}`);
    }
    if (senha) {
      const senhaError = validateSenha(senha);
      if (senhaError) {
        return res.status(400).json({ error: senhaError });
      }
      const senhaHash = await bcrypt.hash(senha, 10);
      params.push(senhaHash);
      sets.push(`senha_hash=$${params.length}`);
    }

    if (!sets.length) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    if (ativo === false && String(req.params.id) === String(req.user.id)) {
      return res.status(403).json({ error: 'Não é possível inativar a própria conta' });
    }

    params.push(req.params.id);
    const { rows } = await query(
      `UPDATE usuarios SET ${sets.join(', ')} WHERE id=$${params.length}
       RETURNING id, username, nome, perfil, ativo, criado_em, ultimo_login`,
      params
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    await logAudit({
      usuarioId: req.user.id,
      acao: 'usuario_update',
      recurso: `admin/usuarios/${rows[0].id}`,
      detalhes: { nome, perfil, ativo, senha_reset: Boolean(senha) },
      ip: clientIp(req),
    });

    return res.json(rows[0]);
  } catch (err) {
    return next(err);
  }
});

router.delete('/usuarios/:id', async (req, res, next) => {
  try {
    const targetId = String(req.params.id);
    if (targetId === String(req.user.id)) {
      return res.status(403).json({ error: 'Não é possível inativar a própria conta' });
    }

    const admins = await query(
      `SELECT id FROM usuarios WHERE perfil = 'Administrador' AND ativo = true`,
    );
    if (admins.rows.length === 1 && String(admins.rows[0].id) === targetId) {
      return res.status(403).json({ error: 'Não é possível inativar o último administrador' });
    }

    const { rows } = await query(
      `UPDATE usuarios SET ativo=false WHERE id=$1
       RETURNING id, username, ativo`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    await logAudit({
      usuarioId: req.user.id,
      acao: 'usuario_inactivate',
      recurso: `admin/usuarios/${rows[0].id}`,
      detalhes: { username: rows[0].username },
      ip: clientIp(req),
    });

    return res.json({ inativado: true, id: rows[0].id });
  } catch (err) {
    return next(err);
  }
});

router.get('/configuracoes', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT chave, valor, descricao, atualizado_em
       FROM configuracoes
       ORDER BY chave`
    );
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

router.put('/configuracoes', async (req, res, next) => {
  try {
    const items = Array.isArray(req.body?.configuracoes)
      ? req.body.configuracoes
      : req.body?.chave
        ? [req.body]
        : [];

    if (!items.length) {
      return res.status(400).json({
        error: 'Informe configuracoes[] ou chave/valor',
      });
    }

    const updated = [];
    for (const item of items) {
      if (!item.chave || item.valor === undefined) {
        return res.status(400).json({ error: 'chave e valor são obrigatórios' });
      }

      const { rows } = await query(
        `INSERT INTO configuracoes (chave, valor, descricao)
         VALUES ($1, $2, $3)
         ON CONFLICT (chave) DO UPDATE SET
           valor = EXCLUDED.valor,
           descricao = COALESCE(EXCLUDED.descricao, configuracoes.descricao),
           atualizado_em = now()
         RETURNING chave, valor, descricao, atualizado_em`,
        [item.chave, String(item.valor), item.descricao || null]
      );
      updated.push(rows[0]);
    }

    await logAudit({
      usuarioId: req.user.id,
      acao: 'config_update',
      recurso: 'admin/configuracoes',
      detalhes: { chaves: updated.map((row) => row.chave) },
      ip: clientIp(req),
    });

    return res.json(updated);
  } catch (err) {
    return next(err);
  }
});

router.get('/backup', async (_req, res, next) => {
  try {
    return res.json(backupService.listBackups());
  } catch (err) {
    return next(err);
  }
});

router.post('/backup', async (req, res, next) => {
  try {
    const backup = await backupService.createBackup();
    await logAudit({
      usuarioId: req.user.id,
      acao: 'backup_create',
      recurso: `admin/backup/${backup.filename}`,
      detalhes: { size: backup.size },
      ip: clientIp(req),
    });
    return res.status(201).json(backup);
  } catch (err) {
    return next(err);
  }
});

router.get('/backup/:filename', async (req, res, next) => {
  try {
    const filepath = backupService.resolveBackupPath(req.params.filename);
    if (!filepath) {
      return res.status(404).json({ error: 'Backup não encontrado' });
    }
    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${backupService.safeBackupFilename(req.params.filename)}"`
    );
    fs.createReadStream(filepath).pipe(res);
  } catch (err) {
    return next(err);
  }
});

router.delete('/backup/:filename', async (req, res, next) => {
  try {
    const removed = backupService.deleteBackup(req.params.filename);
    if (!removed) {
      return res.status(404).json({ error: 'Backup não encontrado' });
    }
    await logAudit({
      usuarioId: req.user.id,
      acao: 'backup_delete',
      recurso: `admin/backup/${req.params.filename}`,
      detalhes: {},
      ip: clientIp(req),
    });
    return res.json({ deleted: true, filename: req.params.filename });
  } catch (err) {
    return next(err);
  }
});

router.post('/backup/restore', restoreUpload.single('file'), async (req, res, next) => {
  let tempPath = req.file?.path;
  try {
    const confirm = req.body?.confirm;
    let result;

    if (req.file) {
      if (!req.file.originalname.toLowerCase().endsWith('.sql')) {
        return res.status(400).json({ error: 'Envie um arquivo .sql de backup' });
      }
      result = await backupService.restoreFromUpload(req.file.path, confirm);
    } else if (req.body?.filename) {
      result = await backupService.restoreFromStored(req.body.filename, confirm);
    } else {
      return res.status(400).json({ error: 'Informe file (upload) ou filename (backup armazenado)' });
    }

    await logAudit({
      usuarioId: req.user.id,
      acao: 'backup_restore',
      recurso: 'admin/backup/restore',
      detalhes: {
        filename: req.body?.filename || req.file?.originalname,
        mode: result.mode,
      },
      ip: clientIp(req),
    });

    return res.json({ restored: true, mode: result.mode });
  } catch (err) {
    return next(err);
  } finally {
    if (tempPath) {
      fs.promises.unlink(tempPath).catch(() => {});
    }
  }
});

module.exports = router;
