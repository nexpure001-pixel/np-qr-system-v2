-- Migration v7: Add email_sent to participations
-- This allows tracking whether a ticket email has been sent to the participant

ALTER TABLE participations
ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT false;

-- Create index for faster filtering of unsent emails
CREATE INDEX IF NOT EXISTS idx_participations_email_sent ON participations(email_sent) WHERE email_sent = false;

COMMENT ON COLUMN participations.email_sent IS 'Flag indicating whether the ticket email has been sent';
