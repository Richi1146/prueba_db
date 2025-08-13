// Script CLI: carga un CSV consolidado
// Uso: npm run load:csv -- <ruta-al-csv>
import { loadCsvIntoDatabase } from '../utils/csvLoader.js';

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Uso: npm run load:csv -- <ruta-al-csv>');
    process.exit(1);
  }
  try {
    console.log('Cargando CSV:', csvPath);
    const summary = await loadCsvIntoDatabase(csvPath);
    console.log('CSV cargado correctamente');
    console.log('Resumen:', JSON.stringify(summary, null, 2));
  } catch (err) {
    console.error('Fallo la carga del CSV');
    console.error(err);
    process.exit(1);
  }
}

main();