// Aplicación Express principal: configura middlewares, rutas y arranque del servidor
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import customersRouter from './routes/customers.js';
import queriesRouter from './routes/queries.js';
import uploadRouter from './routes/upload.js';

dotenv.config();

const app = express();

// Habilita CORS y parsing JSON para requests
app.use(cors());
app.use(express.json());

// Asegurar carpeta temporal de subidas (para multer)
const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Endpoint de salud para verificar disponibilidad del backend
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Rutas del dominio de negocio
app.use('/api/customers', customersRouter); // CRUD de clientes
app.use('/api/queries', queriesRouter);     // Consultas avanzadas
app.use('/api/upload', uploadRouter);       // Carga de datos vía CSV

// Manejo centralizado de errores
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
});

// Inicio del servidor HTTP
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 