CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  document_number VARCHAR(50) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE,
  phone VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS platforms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  issue_date DATE NOT NULL,
  due_date DATE,
  total_amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_invoices_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  platform_id INT NOT NULL,
  transaction_reference VARCHAR(100) NOT NULL UNIQUE,
  transaction_date DATETIME NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'COP',
  description VARCHAR(255),
  CONSTRAINT fk_transactions_platform FOREIGN KEY (platform_id) REFERENCES platforms(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS invoice_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  transaction_id INT NOT NULL,
  allocated_amount DECIMAL(12,2) NOT NULL,
  CONSTRAINT uq_invoice_transaction UNIQUE (invoice_id, transaction_id),
  CONSTRAINT fk_ip_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_ip_transaction FOREIGN KEY (transaction_id) REFERENCES transactions(id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

