// Utilidad para cargar un CSV consolidado a la base de datos
// Espera columnas compatibles con: customer_*, invoice_*, platform/transaction_*
// Aplica upsert para evitar duplicados y usa transacciones para consistencia
import fs from 'fs';
import csv from 'csv-parser';
import pool from '../db.js';

// Mapeo de plataformas por ID (para CSVs que traen ID_Plataforma)
const PLATFORM_ID_TO_NAME = { '1': 'Nequi', '2': 'Daviplata' };

function splitName(fullName) {
  const name = String(fullName || '').trim();
  if (!name) return { first: '', last: '' };
  const parts = name.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

function parseMonthToDates(periodoStr) {
  const [yearStr, monthStr] = String(periodoStr || '').trim().split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!year || !month) return { issueDate: null, dueDate: null };
  const issueDate = new Date(Date.UTC(year, month - 1, 1));
  const dueDate = new Date(Date.UTC(year, month, 0));
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { issueDate: fmt(issueDate), dueDate: fmt(dueDate) };
}

// Inserta o actualiza plataforma por nombre (UNIQUE)
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

// Inserta o actualiza cliente por document_number (UNIQUE)
async function upsertCustomer(connection, customer) {
  const { document_number, first_name, last_name, email, phone } = customer;
  const [res] = await connection.query(
    `INSERT INTO customers (document_number, first_name, last_name, email, phone)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE first_name = VALUES(first_name), last_name = VALUES(last_name), email = VALUES(email), phone = VALUES(phone)`,
    [document_number, first_name, last_name, email || null, phone || null]
  );
  if (res.insertId) return res.insertId;
  const [[row]] = await connection.query('SELECT id FROM customers WHERE document_number = ?', [document_number]);
  return row.id;
}

// Inserta o actualiza factura por invoice_number (UNIQUE)
async function upsertInvoice(connection, invoice) {
  const { customer_id, invoice_number, issue_date, due_date, total_amount } = invoice;
  const [res] = await connection.query(
    `INSERT INTO invoices (customer_id, invoice_number, issue_date, due_date, total_amount)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE customer_id = VALUES(customer_id), issue_date = VALUES(issue_date), due_date = VALUES(due_date), total_amount = VALUES(total_amount)`,
    [customer_id, invoice_number, issue_date || null, due_date || null, total_amount]
  );
  if (res.insertId) return res.insertId;
  const [[row]] = await connection.query('SELECT id FROM invoices WHERE invoice_number = ?', [invoice_number]);
  return row.id;
}

// Inserta o actualiza transacción por transaction_reference (UNIQUE)
async function upsertTransaction(connection, tx) {
  const { platform_id, transaction_reference, transaction_date, amount, currency, description } = tx;
  const [res] = await connection.query(
    `INSERT INTO transactions (platform_id, transaction_reference, transaction_date, amount, currency, description)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE platform_id = VALUES(platform_id), transaction_date = VALUES(transaction_date), amount = VALUES(amount), currency = VALUES(currency), description = VALUES(description)`,
    [platform_id, transaction_reference, transaction_date, amount, currency || 'COP', description || null]
  );
  if (res.insertId) return res.insertId;
  const [[row]] = await connection.query('SELECT id FROM transactions WHERE transaction_reference = ?', [transaction_reference]);
  return row.id;
}

// Inserta/actualiza asignación de pago (única por factura+transacción)
async function upsertInvoicePayment(connection, invoice_id, transaction_id, allocated_amount) {
  await connection.query(
    `INSERT INTO invoice_payments (invoice_id, transaction_id, allocated_amount)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE allocated_amount = VALUES(allocated_amount)`,
    [invoice_id, transaction_id, allocated_amount]
  );
}

// Carga el CSV consolidado dentro de una transacción y retorna un resumen
export async function loadCsvIntoDatabase(csvPath) {
  const rows = [];
  await new Promise((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (data) => rows.push(data))
      .on('end', resolve)
      .on('error', reject);
  });

  const summary = { processedRows: rows.length, customers: 0, invoices: 0, transactions: 0, invoicePayments: 0 };

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (const row of rows) {
      // Cliente
      const document_number = String(
        row.customer_document || row.document_number || row.ID_Cliente || row.id_cliente || row.ID || ''
      ).trim();
      if (!document_number) continue; // saltar filas inválidas

      let first_name = (row.customer_first_name || row.first_name || '').trim();
      let last_name = (row.customer_last_name || row.last_name || '').trim();
      if (!first_name && !last_name) {
        const nameField = row.Nombre || row.name || '';
        const { first, last } = splitName(nameField);
        first_name = first;
        last_name = last;
      }
      const email = (row.email || row.Email || '').trim() || null;
      const phone = (row.phone || row.Teléfono || row.Telefono || '').trim() || null;
      const customer_id = await upsertCustomer(connection, { document_number, first_name, last_name, email, phone });
      summary.customers += 1;

      // Factura
      const invoice_number = String(row.invoice_number || row.ID_Factura || '').trim();
      // issue_date directo o derivado desde Periodo
      const issue_date_direct = row.issue_date ? new Date(row.issue_date) : null;
      const due_date_direct = row.due_date ? new Date(row.due_date) : null;
      const issueDateStr = issue_date_direct ? issue_date_direct.toISOString().slice(0, 10) : null;
      const dueDateStr = due_date_direct ? due_date_direct.toISOString().slice(0, 10) : null;
      let issueDateFinal = issueDateStr;
      let dueDateFinal = dueDateStr;
      if (!issueDateFinal && (row.Periodo || row.periodo)) {
        const { issueDate, dueDate } = parseMonthToDates(row.Periodo || row.periodo);
        issueDateFinal = issueDate;
        dueDateFinal = dueDate;
      }
      const total_amount = row.invoice_total || row.invoice_total_amount || row.total_amount || row.invoice_amount || row.Monto_Facturado;

      const invoice_id = invoice_number && total_amount != null && issueDateFinal
        ? await upsertInvoice(connection, {
            customer_id,
            invoice_number,
            issue_date: issueDateFinal,
            due_date: dueDateFinal,
            total_amount: Number(total_amount)
          })
        : null;
      if (invoice_id) summary.invoices += 1;

      // Transacción y asignación
      const platform_id_from_number = (id) => upsertPlatform(connection, PLATFORM_ID_TO_NAME[String(id)] || `Unknown-${String(id || '0')}`);
      const platform_name = (row.platform || row.platform_name || '').trim() || null;
      const platform_id = platform_name ? await upsertPlatform(connection, platform_name)
        : (row.ID_Plataforma ? await platform_id_from_number(row.ID_Plataforma) : null);

      const transaction_reference = (row.transaction_reference || row.tx_reference || row.ID_Transaccion || '').trim() || null;
      const transaction_date_direct = row.transaction_date ? new Date(row.transaction_date)
        : (row.Fecha_Hora ? new Date(row.Fecha_Hora) : null);
      const transaction_date_str = transaction_date_direct
        ? transaction_date_direct.toISOString().slice(0, 19).replace('T', ' ')
        : new Date().toISOString().slice(0, 19).replace('T', ' ');
      const amount = row.transaction_amount || row.amount || row.Monto_Pagado;
      const currency = (row.currency || 'COP').trim();
      const description = (row.description || row.note || '').trim() || null;

      let transaction_id = null;
      if ((platform_id || platform_name) && transaction_reference && amount != null) {
        const ensuredPlatformId = platform_id || await upsertPlatform(connection, platform_name);
        transaction_id = await upsertTransaction(connection, {
          platform_id: ensuredPlatformId,
          transaction_reference,
          transaction_date: transaction_date_str,
          amount: Number(amount),
          currency,
          description
        });
        summary.transactions += 1;
      }

      // Monto asignado: soporta allocated_amount/payment_amount/Monto_Pagado
      let allocated_amount = row.allocated_amount || row.payment_amount || row.Monto_Pagado || null;
      // Si viene Estado y no es Completada, no asignar
      const estado = String(row.Estado || '').trim().toLowerCase();
      if (estado && estado !== 'completada') {
        allocated_amount = null;
      }

      if (invoice_id && transaction_id && allocated_amount != null) {
        await upsertInvoicePayment(connection, invoice_id, transaction_id, Number(allocated_amount));
        summary.invoicePayments += 1;
      }
    }

    await connection.commit();
    return summary;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
} 