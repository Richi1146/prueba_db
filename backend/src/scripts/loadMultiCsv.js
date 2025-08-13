// Script CLI: carga los 3 CSV del directorio indicado (clientes/facturas/transacciones)
// Uso: npm run load:csv:db -- <ruta-al-directorio>
import path from 'path';
import { loadMultiCsvFromDir } from '../utils/multiCsvLoader.js';

async function main() {
  const dir = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(process.cwd(), '../db');
  try {
    console.log('Cargando multi CSV desde:', dir);
    await loadMultiCsvFromDir(dir);
    console.log('Multi CSV cargado correctamente');
  } catch (err) {
    console.error('Fallo la carga multi CSV');
    console.error(err);
    process.exit(1);
  }
}

main(); 