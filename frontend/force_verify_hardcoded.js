
import { createClient } from '@supabase/supabase-js'

// Hardcoding from the file we read earlier
const supabaseUrl = "https://rjzgzxxdrltlteeshtuw.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqemd6eHhkcmx0bHRlZXNodHV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNDc4MjUsImV4cCI6MjA4MzkyMzgyNX0.rRudHu14sWNALKESz2Wwsjn_40xYaStRUlfdXZFVikA"

const userId = "4ef8e5a8-5a07-4ee5-830d-3db70c652886"
const webhookUrl = `${supabaseUrl}/functions/v1/shufti-webhook`

async function triggerWebhook() {
    console.log(`Triggering Webhook at ${webhookUrl}...`)

    const payload = {
        event: "verification.accepted",
        reference: `VERIFY_${userId}_MANUAL_FORCE`
    }

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`
            },
            body: JSON.stringify(payload)
        })

        const text = await response.text()
        console.log("Webhook Response:", response.status, text)
    } catch (e) {
        console.error("Webhook Trigger Failed:", e)
    }
}

triggerWebhook()
