// Controladores de carga de datos desde CSV
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadCsvIntoDatabase } from '../utils/csvLoader.js';
import { loadMultiCsvFromDir } from '../utils/multiCsvLoader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// POST /api/upload/csv
// Recibe un archivo CSV (consolidado) y lo carga a la BD
export async function handleCsvUpload(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ message: 'file is required (multipart/form-data, field name: file)' });
    const filePath = path.resolve(__dirname, '../../', req.file.path);
    await loadCsvIntoDatabase(filePath);
    // Borramos el archivo temporal después de cargar
    fs.unlink(filePath, () => {});
    res.json({ message: 'CSV loaded successfully' });
  } catch (err) {
    next(err);
  }
}

// POST /api/upload/db
// Carga los 3 CSV que están en el proyecto (por defecto en ../db)
export async function handleMultiCsvDirLoad(req, res, next) {
  try {
    const dirFromBody = req.body?.dir;
    const baseDir = dirFromBody
      ? path.isAbsolute(dirFromBody) ? dirFromBody : path.resolve(process.cwd(), dirFromBody)
      : path.resolve(process.cwd(), '../db');
    await loadMultiCsvFromDir(baseDir);
    res.json({ message: 'Multi CSV (clientes/facturas/transacciones) loaded successfully', dir: baseDir });
  } catch (err) {
    next(err);
  }
} 