// Router para las consultas avanzadas solicitadas por el negocio
import { Router } from 'express';
import {
  totalPaidByCustomer,
  pendingInvoices,
  transactionsByPlatform
} from '../controllers/queriesController.js';

const router = Router();

router.get('/total-paid-by-customer', totalPaidByCustomer); // Total pagado por cliente
router.get('/pending-invoices', pendingInvoices);           // Facturas con saldo pendiente
router.get('/transactions-by-platform', transactionsByPlatform); // Transacciones por plataforma

export default router; 