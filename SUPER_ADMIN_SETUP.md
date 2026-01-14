# Super Admin Configuration

## Required Environment Variables

Add these to your `.env.local` file:

```bash
# Super Admin Email (only this email can access /admin/super/create-tenant)
SUPER_ADMIN_EMAIL=your-email@example.com

# Supabase Service Role Key (for creating auth users)
# Get this from: Supabase Dashboard → Settings → API → service_role key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

## Setup Instructions

1. Copy the above variables to your `.env.local` file
2. Replace `your-email@example.com` with your actual email address
3. Get the Service Role Key from Supabase Dashboard
4. Restart the development server

## Usage

Access the super admin page at:
- Local: http://localhost:3000/admin/super/create-tenant
- Production: https://your-domain.vercel.app/admin/super/create-tenant

Only the email specified in `SUPER_ADMIN_EMAIL` can access this page.
