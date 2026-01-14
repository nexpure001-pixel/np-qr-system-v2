
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { join } from 'path';

// Load .env.local
dotenv.config({ path: join(process.cwd(), '.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
    console.error('Error: Missiong env variables');
    process.exit(1);
}

const supabase = createClient(url, key);

async function check() {
    console.log(`Checking connection to: ${url}`);

    // Try to query tenants table
    const { error } = await supabase.from('events').select('*');
    if (error) {
        if (error.code === '42P01') { // undefined_table
            console.log("SUCCESS: Connection successful, but tables do not exist yet (as expected before migration).");
            console.log("ACTION: Please run the migration SQL.");
        } else {
            console.error("ERROR: Connection successful but query failed:", error.message, error.code);
        }
    } else {
        console.log("SUCCESS: Connection successful AND tables exist.");
    }
}

check();
