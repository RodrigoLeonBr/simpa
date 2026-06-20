const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  buildPath,
  competenciaParts,
  hashFile,
  moveFile,
  removeFile,
  slugUnidade,
  uploadsRoot,
} = require('../src/services/storage');

describe('storage', () => {
  const previousUploadDir = process.env.UPLOAD_DIR;

  beforeEach(() => {
    process.env.UPLOAD_DIR = path.join(os.tmpdir(), `simpa-upload-test-${Date.now()}`);
  });

  afterEach(() => {
    process.env.UPLOAD_DIR = previousUploadDir;
    try {
      fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
    } catch (_err) {
      // ignore
    }
  });

  it('buildPath generates uploads/esus/{ano}/{mes}/{slug}/{filename}', () => {
    const dest = buildPath(
      '2026-05',
      'CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO',
      'relatorio.csv'
    );

    expect(dest).toContain(path.join('esus', '2026', '05'));
    expect(dest.endsWith(`${path.sep}relatorio.csv`)).toBe(true);
    expect(slugUnidade('CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO')).toMatch(
      /cafi_centro/
    );
  });

  it('competenciaParts accepts YYYY-MM and YYYY-MM-DD', () => {
    expect(competenciaParts('2026-05')).toEqual({
      label: '2026-05',
      ano: '2026',
      mes: '05',
    });
    expect(competenciaParts('2026-05-01').label).toBe('2026-05');
  });

  it('moveFile and hashFile work on disk', () => {
    const tmp = path.join(os.tmpdir(), `simpa-tmp-${Date.now()}.csv`);
    fs.writeFileSync(tmp, 'conteudo-teste');

    const dest = buildPath('2026-05', 'U1', 'test.csv');
    moveFile(tmp, dest);

    expect(fs.existsSync(dest)).toBe(true);
    expect(hashFile(dest)).toHaveLength(64);
    removeFile(dest);
    expect(fs.existsSync(dest)).toBe(false);
    expect(uploadsRoot()).toBe(process.env.UPLOAD_DIR);
  });

  it('competenciaParts rejects invalid value', () => {
    expect(() => competenciaParts('invalid')).toThrow(/competencia/i);
  });

  it('removeFile ignores missing paths', () => {
    expect(() => removeFile(path.join(os.tmpdir(), 'nao-existe.csv'))).not.toThrow();
  });
});
