// Controlador de la entidad customers: validación y operaciones CRUD
import pool from '../db.js';

// Validación basica del payload de cliente
function validateCustomerPayload(body) {
  const errors = [];
  if (!body.document_number || String(body.document_number).trim().length === 0) {
    errors.push('document_number is required');
  }
  if (!body.first_name || String(body.first_name).trim().length === 0) {
    errors.push('first_name is required');
  }
  if (!body.last_name || String(body.last_name).trim().length === 0) {
    errors.push('last_name is required');
  }
  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    errors.push('email is invalid');
  }
  return errors;
}

// GET /api/customers
export async function getCustomers(_req, res, next) {
  try {
    const [rows] = await pool.query('SELECT id, document_number, first_name, last_name, email, phone FROM customers ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// GET /api/customers/:id
export async function getCustomerById(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT id, document_number, first_name, last_name, email, phone FROM customers WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Customer not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

// POST /api/customers
export async function createCustomer(req, res, next) {
  try {
    const errors = validateCustomerPayload(req.body);
    if (errors.length) return res.status(400).json({ message: 'Validation failed', errors });

    const { document_number, first_name, last_name, email = null, phone = null } = req.body;
    const [result] = await pool.query(
      `INSERT INTO customers (document_number, first_name, last_name, email, phone)
       VALUES (?, ?, ?, ?, ?)`,
      [document_number, first_name, last_name, email, phone]
    );

    const [created] = await pool.query('SELECT id, document_number, first_name, last_name, email, phone FROM customers WHERE id = ?', [result.insertId]);
    res.status(201).json(created[0]);
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Duplicate entry (document_number or email must be unique)' });
    }
    next(err);
  }
}

// PUT /api/customers/:id
export async function updateCustomer(req, res, next) {
  try {
    const { id } = req.params;
    // Permitimos actualización parcial, validamos formato general
    const errors = validateCustomerPayload({ ...req.body, document_number: req.body.document_number ?? 'placeholder' });
    if (errors.filter(e => e !== 'document_number is required').length) {
      return res.status(400).json({ message: 'Validation failed', errors });
    }

    const fields = [];
    const values = [];
    const allowed = ['document_number', 'first_name', 'last_name', 'email', 'phone'];
    for (const key of allowed) {
      if (key in req.body) {
        fields.push(`${key} = ?`);
        values.push(req.body[key]);
      }
    }
    if (fields.length === 0) return res.status(400).json({ message: 'No fields to update' });

    values.push(id);
    const [result] = await pool.query(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`, values);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Customer not found' });

    const [updated] = await pool.query('SELECT id, document_number, first_name, last_name, email, phone FROM customers WHERE id = ?', [id]);
    res.json(updated[0]);
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Duplicate entry (document_number or email must be unique)' });
    }
    next(err);
  }
}

// DELETE /api/customers/:id
export async function deleteCustomer(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    await connection.beginTransaction();

    // Validar existencia de cliente
    const [existsRows] = await connection.query('SELECT id FROM customers WHERE id = ?', [id]);
    if (existsRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Obtener facturas del cliente
    const [invoiceRows] = await connection.query('SELECT id FROM invoices WHERE customer_id = ?', [id]);
    const invoiceIds = invoiceRows.map(r => r.id);

    if (invoiceIds.length > 0) {
      // Obtener transacciones involucradas en los pagos de esas facturas
      const placeholders = invoiceIds.map(() => '?').join(',');
      const [txRows] = await connection.query(
        `SELECT DISTINCT transaction_id FROM invoice_payments WHERE invoice_id IN (${placeholders})`,
        invoiceIds
      );
      const transactionIds = txRows.map(r => r.transaction_id);

      // Eliminar pagos de esas facturas
      await connection.query(
        `DELETE FROM invoice_payments WHERE invoice_id IN (${placeholders})`,
        invoiceIds
      );

      // Eliminar facturas del cliente
      await connection.query(
        `DELETE FROM invoices WHERE id IN (${placeholders})`,
        invoiceIds
      );

      // Eliminar transacciones huerfanas (que ya no tengan pagos asociados)
      if (transactionIds.length > 0) {
        const txPlaceholders = transactionIds.map(() => '?').join(',');
        await connection.query(
          `DELETE FROM transactions t
           WHERE t.id IN (${txPlaceholders})
             AND NOT EXISTS (SELECT 1 FROM invoice_payments ip WHERE ip.transaction_id = t.id)`,
          transactionIds
        );
      }
    }

    // Eliminar el cliente
    await connection.query('DELETE FROM customers WHERE id = ?', [id]);

    await connection.commit();
    res.status(204).send();
  } catch (err) {
    try { await connection.rollback(); } catch (_) {}
    next(err);
  } finally {
    connection.release();
  }
} 