-- Create Admin View for Tenant Overview
-- This view joins tenants with auth.users to show login email alongside company info

CREATE OR REPLACE VIEW admin_tenant_overview AS
SELECT 
    t.id as tenant_id,
    t.name as company_name,
    t.company_code,
    t.smtp_host,
    t.smtp_port,
    t.smtp_user,
    t.smtp_from_email,
    t.created_at as tenant_created_at,
    t.updated_at as tenant_updated_at,
    u.id as user_id,
    u.email as login_email,
    u.created_at as user_created_at,
    u.last_sign_in_at
FROM public.tenants t
LEFT JOIN auth.users u ON t.owner_id = u.id
ORDER BY t.created_at DESC;

-- Grant access to authenticated users (optional, for admin use)
-- GRANT SELECT ON admin_tenant_overview TO authenticated;
