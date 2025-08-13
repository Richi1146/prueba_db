// Utilidad para cargar un CSV consolidado a la base de datos
// Espera columnas compatibles con: customer_*, invoice_*, platform/transaction_*
// Aplica upsert para evitar duplicados y usa transacciones para consistencia
import fs from 'fs';
import csv from 'csv-parser';
import pool from '../db.js';

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

// Carga el CSV consolidado dentro de una transacción
export async function loadCsvIntoDatabase(csvPath) {
  const rows = [];
  await new Promise((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (data) => rows.push(data))
      .on('end', resolve)
      .on('error', reject);
  });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (const row of rows) {
      // Cliente
      const document_number = String(row.customer_document || row.document_number || '').trim();
      if (!document_number) continue; // saltar filas inválidas
      const first_name = (row.customer_first_name || row.first_name || '').trim();
      const last_name = (row.customer_last_name || row.last_name || '').trim();
      const email = (row.email || '').trim() || null;
      const phone = (row.phone || '').trim() || null;
      const customer_id = await upsertCustomer(connection, { document_number, first_name, last_name, email, phone });

      // Factura (issue_date es NOT NULL en el DDL)
      const invoice_number = String(row.invoice_number || '').trim();
      const issue_date = row.issue_date ? new Date(row.issue_date) : null;
      const due_date = row.due_date ? new Date(row.due_date) : null;
      const total_amount = row.invoice_total || row.invoice_total_amount || row.total_amount || row.invoice_amount;
      const invoice_id = invoice_number && total_amount != null
        ? await upsertInvoice(connection, {
            customer_id,
            invoice_number,
            issue_date: issue_date ? issue_date.toISOString().slice(0, 10) : null,
            due_date: due_date ? due_date.toISOString().slice(0, 10) : null,
            total_amount: Number(total_amount)
          })
        : null;

      // Transacción y asignación
      const platform_name = (row.platform || row.platform_name || '').trim() || null;
      const transaction_reference = (row.transaction_reference || row.tx_reference || '').trim() || null;
      const transaction_date = row.transaction_date ? new Date(row.transaction_date) : null;
      const amount = row.transaction_amount || row.amount;
      const currency = (row.currency || 'COP').trim();
      const description = (row.description || row.note || '').trim() || null;

      let transaction_id = null;
      if (platform_name && transaction_reference && amount != null) {
        const platform_id = await upsertPlatform(connection, platform_name);
        transaction_id = await upsertTransaction(connection, {
          platform_id,
          transaction_reference,
          transaction_date: transaction_date ? transaction_date.toISOString().slice(0, 19).replace('T', ' ') : new Date().toISOString().slice(0, 19).replace('T', ' '),
          amount: Number(amount),
          currency,
          description
        });
      }

      const allocated_amount = row.allocated_amount || row.payment_amount || null;
      if (invoice_id && transaction_id && allocated_amount != null) {
        await upsertInvoicePayment(connection, invoice_id, transaction_id, Number(allocated_amount));
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