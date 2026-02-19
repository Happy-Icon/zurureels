
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Read .env
const envPath = path.resolve(__dirname, '.env')
let env = {}
try {
    const envContent = fs.readFileSync(envPath, 'utf8')
    envContent.split('\n').forEach(line => {
        const [key, value] = line.split('=')
        if (key && value) {
            env[key.trim()] = value.trim()
            // Remove surrounding quotes if any
            env[key.trim()] = env[key.trim()].replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
        }
    })
} catch (e) {
    console.log("Could not read .env file", e)
}

const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseKey = env.VITE_SUPABASE_ANON_KEY
// NOTE: Anon key might not have permission to UPDATE profiles depending on RLS.
// If this fails, we need the SERVICE_ROLE_KEY.
// But usually users can update their own profile? Or maybe not 'verification_status'.
// Let's try with Anon first, assuming RLS allows update if auth matches (we might need to sign in).

// WAIT: verification_status is usually protected. We need Service Role Key.
// check if we have it in backend .env or we can cheat and sign in as the user?
// No, logging in as user won't help if the column is protected. 

// Let's assume for a moment current RLS allows update or we can get Service Role.
// I don't see Service Role in frontend/.env. 

// PLAN B: If this fails, I will use 'supabase functions' to run a privileged command 
// or ask user to use dashboard.

// Let's check backend/.env if it exists
// actually I'll just try with anon key first, maybe RLS is loose.

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env")
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const userId = "4ef8e5a8-5a07-4ee5-830d-3db70c652886"

async function forceVerify() {
    console.log(`Attempting to update user ${userId} to 'verified'...`)

    const { data, error } = await supabase
        .from('profiles')
        .update({ verification_status: 'verified' })
        .eq('id', userId)
        .select()

    if (error) {
        console.error("Error updating profile:", error)
    } else {
        console.log("Success! Updated profile:", data)
    }
}

forceVerify()
