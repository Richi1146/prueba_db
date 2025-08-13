// Controladores de consultas avanzadas
import pool from '../db.js';

// 1) Total pagado por cada cliente (suma de montos asignados a sus facturas)
export async function totalPaidByCustomer(_req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT 
        c.id AS customer_id,
        c.document_number,
        c.first_name,
        c.last_name,
        COALESCE(SUM(ip.allocated_amount), 0) AS total_paid
      FROM customers c
      LEFT JOIN invoices i ON i.customer_id = c.id
      LEFT JOIN invoice_payments ip ON ip.invoice_id = i.id
      GROUP BY c.id
      ORDER BY total_paid DESC, c.id ASC;
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// 2) Facturas pendientes con info de cliente y referencias de transacción
export async function pendingInvoices(_req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT 
        i.id AS invoice_id,
        i.invoice_number,
        i.total_amount,
        COALESCE(SUM(ip.allocated_amount), 0) AS total_paid,
        (i.total_amount - COALESCE(SUM(ip.allocated_amount), 0)) AS pending_amount,
        c.first_name,
        c.last_name,
        GROUP_CONCAT(DISTINCT t.transaction_reference ORDER BY t.transaction_date SEPARATOR ',') AS transaction_references
      FROM invoices i
      JOIN customers c ON c.id = i.customer_id
      LEFT JOIN invoice_payments ip ON ip.invoice_id = i.id
      LEFT JOIN transactions t ON t.id = ip.transaction_id
      GROUP BY i.id
      HAVING pending_amount > 0
      ORDER BY pending_amount DESC;
    `);
    res.json(rows.map(r => ({ ...r, transaction_references: r.transaction_references ? r.transaction_references.split(',') : [] })));
  } catch (err) {
    next(err);
  }
}

// 3) Listado de transacciones filtrado por plataforma (Nequi, Daviplata, etc.)
export async function transactionsByPlatform(req, res, next) {
  try {
    const platform = req.query.platform;
    if (!platform) return res.status(400).json({ message: 'platform query param is required (e.g., Nequi, Daviplata)' });

    const [rows] = await pool.query(`
      SELECT 
        t.id AS transaction_id,
        t.transaction_reference,
        t.transaction_date,
        t.amount,
        t.currency,
        p.name AS platform,
        i.invoice_number,
        c.first_name,
        c.last_name
      FROM transactions t
      JOIN platforms p ON p.id = t.platform_id
      LEFT JOIN invoice_payments ip ON ip.transaction_id = t.id
      LEFT JOIN invoices i ON i.id = ip.invoice_id
      LEFT JOIN customers c ON c.id = i.customer_id
      WHERE p.name = ?
      ORDER BY t.transaction_date DESC, t.id DESC
    `, [platform]);

    res.json(rows);
  } catch (err) {
    next(err);
  }
} 