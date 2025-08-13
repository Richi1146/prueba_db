// Utilidad para cargar TRES CSV del proyecto (clientes, facturas, transacciones)
// - clientes.csv: ID_Cliente, Nombre, Dirección, Teléfono, Email
// - facturas.csv: ID_Factura, Periodo(YYYY-MM), Monto_Facturado
// - transacciones.csv: ID_Transaccion, Fecha_Hora, Monto_Pagado, Estado, Tipo, ID_Cliente, ID_Factura, ID_Plataforma
// Mapea ID_Plataforma a nombre (1=Nequi, 2=Daviplata). Solo crea pagos si Estado=Completada.
// Usa transacciones SQL para asegurar consistencia.
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import pool from '../db.js';

// Mapeo de plataformas por ID (ajustable si cambian los códigos)
const PLATFORM_ID_TO_NAME = {
  '1': 'Nequi',
  '2': 'Daviplata'
};

// Upserts auxiliares (plataformas, clientes, facturas, transacciones, pagos)
async function upsertPlatform(connection, name) {
  const [res] = await connection.query(
    `INSERT INTO platforms (name) VALUES (?)
     ON DUPLICATE KEY UPDATE name = VALUES(name)`,
    [name]
  );
  if (res.insertId) return res.insertId;
  const [[row]] = await connection.query('SELECT id FROM platforms WHERE name = ?', [name]);
  return row.id;
}

async function upsertCustomer(connection, customer) {
  const { document_number, first_name, last_name, email, phone } = customer;
  const [res] = await connection.query(
    `INSERT INTO customers (document_number, first_name, last_name, email, phone)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE first_name = VALUES(first_name), last_name = VALUES(last_name), email = VALUES(email), phone = VALUES(phone)`
    , [document_number, first_name, last_name, email || null, phone || null]
  );
  if (res.insertId) return res.insertId;
  const [[row]] = await connection.query('SELECT id FROM customers WHERE document_number = ?', [document_number]);
  return row.id;
}

async function upsertInvoice(connection, invoice) {
  const { customer_id, invoice_number, issue_date, due_date, total_amount } = invoice;
  const [res] = await connection.query(
    `INSERT INTO invoices (customer_id, invoice_number, issue_date, due_date, total_amount)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE customer_id = VALUES(customer_id), issue_date = VALUES(issue_date), due_date = VALUES(due_date), total_amount = VALUES(total_amount)`
    , [customer_id, invoice_number, issue_date, due_date || null, total_amount]
  );
  if (res.insertId) return res.insertId;
  const [[row]] = await connection.query('SELECT id FROM invoices WHERE invoice_number = ?', [invoice_number]);
  return row.id;
}

async function upsertTransaction(connection, tx) {
  const { platform_id, transaction_reference, transaction_date, amount, currency, description } = tx;
  const [res] = await connection.query(
    `INSERT INTO transactions (platform_id, transaction_reference, transaction_date, amount, currency, description)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE platform_id = VALUES(platform_id), transaction_date = VALUES(transaction_date), amount = VALUES(amount), currency = VALUES(currency), description = VALUES(description)`
    , [platform_id, transaction_reference, transaction_date, amount, currency || 'COP', description || null]
  );
  if (res.insertId) return res.insertId;
  const [[row]] = await connection.query('SELECT id FROM transactions WHERE transaction_reference = ?', [transaction_reference]);
  return row.id;
}

async function upsertInvoicePayment(connection, invoice_id, transaction_id, allocated_amount) {
  await connection.query(
    `INSERT INTO invoice_payments (invoice_id, transaction_id, allocated_amount)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE allocated_amount = VALUES(allocated_amount)`
    , [invoice_id, transaction_id, allocated_amount]
  );
}

// Utilidades auxiliares
function parseMonthToDates(periodoStr) {
  // Recibe 'YYYY-MM' y devuelve primer y último día como DATE YYYY-MM-DD
  const [yearStr, monthStr] = String(periodoStr).split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!year || !month) return { issueDate: null, dueDate: null };
  const issueDate = new Date(Date.UTC(year, month - 1, 1));
  const dueDate = new Date(Date.UTC(year, month, 0));
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { issueDate: fmt(issueDate), dueDate: fmt(dueDate) };
}

function splitName(fullName) {
  // Separa el primer nombre del resto para llenar first_name / last_name
  const name = String(fullName || '').trim();
  if (!name) return { first: '', last: '' };
  const parts = name.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

async function readCsvRows(filePath) {
  const rows = [];
  await new Promise((resolve, reject) => {
    fs.createReadStream(filePath).pipe(csv()).on('data', (d) => rows.push(d)).on('end', resolve).on('error', reject);
  });
  return rows;
}

// Punto de entrada: carga desde un directorio que contiene los 3 CSV esperados
export async function loadMultiCsvFromDir(dirPath) {
  const baseDir = path.resolve(dirPath);
  const clientesPath = path.join(baseDir, 'clientes.csv');
  const facturasPath = path.join(baseDir, 'facturas.csv');
  const transaccionesPath = path.join(baseDir, 'transacciones.csv');

  if (!fs.existsSync(clientesPath) || !fs.existsSync(facturasPath) || !fs.existsSync(transaccionesPath)) {
    throw new Error('Missing CSV files. Ensure clientes.csv, facturas.csv and transacciones.csv exist in the provided directory');
  }

  const clientes = await readCsvRows(clientesPath);
  const facturas = await readCsvRows(facturasPath);
  const transacciones = await readCsvRows(transaccionesPath);

  // Índices/Mapas para búsquedas rápidas por ID del CSV
  const clienteIdToRow = new Map();
  for (const c of clientes) {
    const id = String(c.ID_Cliente || c.id_cliente || c.ID || '').trim();
    if (!id) continue;
    clienteIdToRow.set(id, c);
  }

  const facturaIdToRow = new Map();
  for (const f of facturas) {
    const id = String(f.ID_Factura || f.id_factura || '').trim();
    if (!id) continue;
    facturaIdToRow.set(id, f);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1) Clientes
    const clienteIdToCustomerId = new Map();
    for (const [doc, c] of clienteIdToRow.entries()) {
      const nombre = c.Nombre || c.name || '';
      const { first, last } = splitName(nombre);
      const email = (c.Email || c.email || '').trim() || null;
      const phone = (c.Teléfono || c.Telefono || c.phone || '').trim() || null;
      const dbCustomerId = await upsertCustomer(connection, {
        document_number: doc,
        first_name: first,
        last_name: last,
        email,
        phone
      });
      clienteIdToCustomerId.set(doc, dbCustomerId);
    }

    // 2) Facturas (requiere identificar customer_id vía transacciones)
    const facturaIdToInvoiceId = new Map();
    for (const [invNumber, f] of facturaIdToRow.entries()) {
      const periodo = f.Periodo || f.periodo || '';
      const { issueDate, dueDate } = parseMonthToDates(periodo);
      const total = Number(f.Monto_Facturado || f.monto || f.total || 0);
      // Vincular cliente a partir de transacción relacionada
      let customer_id = null;
      const tx = transacciones.find((t) => String(t.ID_Factura || '').trim() === invNumber && String(t.ID_Cliente || '').trim());
      if (tx) {
        const doc = String(tx.ID_Cliente).trim();
        customer_id = clienteIdToCustomerId.get(doc) || null;
      }
      if (!customer_id) continue; // no se puede crear la factura sin cliente
      if (!issueDate) continue;    // issue_date es NOT NULL en el DDL

      const invoiceId = await upsertInvoice(connection, {
        customer_id,
        invoice_number: invNumber,
        issue_date: issueDate,
        due_date: dueDate,
        total_amount: total
      });
      facturaIdToInvoiceId.set(invNumber, invoiceId);
    }

    // 3) Transacciones y pagos (solo si Estado=Completada)
    for (const t of transacciones) {
      const ref = String(t.ID_Transaccion || t.id || '').trim();
      const fecha = t.Fecha_Hora || t.fecha || t.date || '';
      const monto = Number(t.Monto_Pagado || t.monto || 0);
      const estado = String(t.Estado || '').trim();
      const tipo = String(t.Tipo || '').trim();
      const idFactura = String(t.ID_Factura || '').trim();
      const idPlataforma = String(t.ID_Plataforma || '').trim();

      const platformName = PLATFORM_ID_TO_NAME[idPlataforma] || `Unknown-${idPlataforma || '0'}`;
      const platform_id = await upsertPlatform(connection, platformName);

      const txDate = fecha ? new Date(fecha) : new Date();
      const txId = await upsertTransaction(connection, {
        platform_id,
        transaction_reference: ref,
        transaction_date: txDate.toISOString().slice(0, 19).replace('T', ' '),
        amount: monto,
        currency: 'COP',
        description: `Estado: ${estado || 'N/A'}; Tipo: ${tipo || 'N/A'}`
      });

      if (estado.toLowerCase() === 'completada') {
        const invoiceId = facturaIdToInvoiceId.get(idFactura);
        if (invoiceId) {
          await upsertInvoicePayment(connection, invoiceId, txId, monto);
        }
      }
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
} 