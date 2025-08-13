// Router para endpoints de carga de datos desde CSV
import { Router } from 'express';
import multer from 'multer';
import { handleCsvUpload, handleMultiCsvDirLoad } from '../controllers/uploadController.js';

const router = Router();
const upload = multer({ dest: 'uploads/' });

// Carga de un CSV consolidado (archivo subido por multipart/form-data)
router.post('/csv', upload.single('file'), handleCsvUpload);

// Carga de los 3 CSV del proyecto (clientes/facturas/transacciones) desde un directorio
router.post('/db', handleMultiCsvDirLoad);

export default router; 