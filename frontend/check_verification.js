
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
        }
    })
} catch (e) {
    console.log("Could not read .env file", e)
}

const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseKey = env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env")
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const email = "okelloulak2004@gmail.com"

async function checkStatus() {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .single()

    if (error) {
        console.error("Error:", error)
    } else {
        console.log("User Profile:", data)
    }
}

checkStatus()
