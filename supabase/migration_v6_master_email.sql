-- Migration v6: Add email to master_data
-- This allows matching ticket purchasers by email in addition to ID/Name

ALTER TABLE master_data
ADD COLUMN IF NOT EXISTS email TEXT;

-- Create index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_master_data_email ON master_data(email);

COMMENT ON COLUMN master_data.email IS 'Email address for matching with ticket purchasers';
