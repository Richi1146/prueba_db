# Fintech SQL Data Management

A simple full-stack project to normalize, store and manage Fintech (Nequi/Daviplata) data in a MySQL database. Includes:

- CSV bulk load into a normalized schema 
- REST API (Express) with CRUD for `customers`
- Advanced queries endpoints for business questions
- Minimal Bootstrap dashboard for managing customers
- Postman collection

## Tech stack

- Node.js + Express
- MySQL (mysql2/promise)
- CSV parsing with `csv-parser`
- Multer for local CSV upload (extra points)
- Bootstrap frontend

## Normalization (1NF, 2NF, 3NF)

From messy Excel, we identified these entities and relationships:

- `customers` (1..n) `invoices`
- `platforms` (Nequi, Daviplata, ...)
- `transactions` belong to a `platform`
- Payments allocate a `transaction` amount to one or more `invoices` via `invoice_payments`

This removes repeating groups (1NF), ensures full dependency on the key (2NF), and removes transitive dependencies (3NF). Emails and document numbers are unique attributes of `customers`. `platforms` are separated to avoid duplication. `invoice_payments` resolves many-to-many between `invoices` and `transactions` and stores only allocation facts.

See `db/schema.sql` for the full DDL. You can export an ERD image from a Mermaid or draw.io file. Suggested Mermaid ERD (export it as PNG/PDF):

## Database setup

1) Install MySQL locally and create the database with your required name:

- Edit `db/create_database.sql` replacing `pd_nombre_apellido_clan` accordingly
- Then run in MySQL client (Workbench, CLI):

```sql
SOURCE D:/path/to/project/db/create_database.sql;
SOURCE D:/path/to/project/db/schema.sql;
```

2) Copy backend/.env example and set credentials:

```bash
cd backend
copy .env.example .env
```

Edit `.env` with your values (default points to DB `test`):

```
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=12345
DB_NAME=test
DB_PORT=3306
```

If you want to quickly create the `test` database:

```sql
SOURCE D:/path/to/project/db/create_database_test.sql;
SOURCE D:/path/to/project/db/schema.sql;
```

## Install and run backend

```bash
cd backend
npm install
npm run dev
```

Health check: `GET http://localhost:3000/api/health`

## Frontend dashboard

Open `frontend/index.html` in your browser. It points to `http://localhost:3000/api`.

## CSV bulk load

- Sample CSV (single consolidated): `db/sample_data.csv`
- Your project CSVs (separate files):
  - `db/clientes.csv` with headers: `ID_Cliente,Nombre,Dirección,Teléfono,Email`
  - `db/facturas.csv` with headers: `ID_Factura,Periodo,Monto_Facturado` (Periodo format: `YYYY-MM`)
  - `db/transacciones.csv` with headers: `ID_Transaccion,Fecha_Hora,Monto_Pagado,Estado,Tipo,ID_Cliente,ID_Factura,ID_Plataforma` (ID_Plataforma: 1=Nequi, 2=Daviplata)

Two ways to load:

- CLI (single consolidated):
```bash
cd backend
npm run load:csv -- ../db/sample_data.csv
```

- CLI (from your 3 CSVs in db/):
```bash
cd backend
npm run load:csv:db -- ../db
```

- Endpoint (extra, accepts only consolidated CSV via multipart): `POST http://localhost:3000/api/upload/csv` with multipart/form-data, field `file`.

## CRUD endpoints (customers)

- GET `/api/customers`
- GET `/api/customers/:id`
- POST `/api/customers`
- PUT `/api/customers/:id`
- DELETE `/api/customers/:id`

Payload example (POST):

```json
{
  "document_number": "12345",
  "first_name": "Jane",
  "last_name": "Doe",
  "email": "jane@example.com",
  "phone": "3000000000"
}
```

## Advanced queries (Postman only)

1) Total paid by customer: `GET /api/queries/total-paid-by-customer`
2) Pending invoices with customer and transactions: `GET /api/queries/pending-invoices`
3) Transactions by platform: `GET /api/queries/transactions-by-platform?platform=Nequi`

Import `postman/Fintech-DB.postman_collection.json` and set `{{baseUrl}}` to `http://localhost:3000/api` if needed.

## Developer

- Name: Jerónimo Gutiérrez Arias
- Clan: Berners Lee
- Email: jeronimogutierrezarias@outlook.com 