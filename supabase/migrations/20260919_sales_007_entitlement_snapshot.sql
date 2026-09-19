BEGIN;

ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS billing_contract_version text NOT NULL DEFAULT 'billing-v1',
  ADD COLUMN IF NOT EXISTS seat_limit integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS storage_limit_gb integer NOT NULL DEFAULT 0;

UPDATE sales_orders
SET billing_contract_version=COALESCE(NULLIF(billing_contract_version,''),'billing-v1'),
    seat_limit=CASE plan
      WHEN 'Solo' THEN 2
      WHEN 'Essencial' THEN 3
      WHEN 'Profissional' THEN 10
      WHEN 'Premium' THEN 20
      ELSE GREATEST(seat_limit,1)
    END,
    storage_limit_gb=CASE plan
      WHEN 'Solo' THEN 5
      WHEN 'Essencial' THEN 15
      WHEN 'Profissional' THEN 25
      WHEN 'Premium' THEN 100
      ELSE GREATEST(storage_limit_gb,1)
    END
WHERE seat_limit<=0 OR storage_limit_gb<=0 OR billing_contract_version='';

ALTER TABLE sales_orders
  DROP CONSTRAINT IF EXISTS sales_orders_seat_limit_check,
  ADD CONSTRAINT sales_orders_seat_limit_check CHECK (seat_limit BETWEEN 1 AND 500),
  DROP CONSTRAINT IF EXISTS sales_orders_storage_limit_gb_check,
  ADD CONSTRAINT sales_orders_storage_limit_gb_check CHECK (storage_limit_gb BETWEEN 1 AND 10000);

COMMIT;
