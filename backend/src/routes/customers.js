// Router de endpoints CRUD para la entidad customers
import { Router } from 'express';
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer
} from '../controllers/customersController.js';

const router = Router();

router.get('/', getCustomers);      // Listar clientes
router.get('/:id', getCustomerById); // Obtener cliente por ID
router.post('/', createCustomer);    // Crear cliente
router.put('/:id', updateCustomer);  // Actualizar cliente
router.delete('/:id', deleteCustomer); // Eliminar cliente

export default router; 