-- =============================================================================
-- PharmaFlow PostgreSQL Initialization Script
-- Runs automatically on first `docker compose up` (postgres container).
-- Creates one database per service that uses PostgreSQL.
-- =============================================================================

-- order-service DB
CREATE DATABASE order_service;
GRANT ALL PRIVILEGES ON DATABASE order_service TO pharmaflow;

-- product-service DB
CREATE DATABASE product_service;
GRANT ALL PRIVILEGES ON DATABASE product_service TO pharmaflow;
