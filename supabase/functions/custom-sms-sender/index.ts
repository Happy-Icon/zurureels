import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const AFRICASTALKING_API_KEY = Deno.env.get("AFRICASTALKING_API_KEY") || "";
const AFRICASTALKING_USERNAME = Deno.env.get("AFRICASTALKING_USERNAME") || "";

serve(async (req) => {
    console.log("--- REQUEST RECEIVED ---");
    let payloadStr = "";
    try {
        // 1. Safely read text first in case it isn't JSON
        payloadStr = await req.text();
        console.log("Raw Payload:", payloadStr);

        const payload = JSON.parse(payloadStr);
        const user = payload?.user || {};
        const sms = payload?.sms || {};

        const phone = user.phone;
        const otp = sms.otp || sms.code; // Just in case it's named code

        if (!phone || !otp) {
            console.error("Missing phone or OTP:", { phone, otp });
            return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 200 });
        }

        console.log(`Preparing to send OTP ${otp} to ${phone}`);

        const body = new URLSearchParams();
        body.append("username", AFRICASTALKING_USERNAME);
        body.append("to", phone);
        body.append("message", `Your ZuruSasa verification code is: ${otp}`);

        console.log("Calling Africa's Talking API...");
        const response = await fetch("https://api.africastalking.com/version1/messaging", {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
                "apiKey": AFRICASTALKING_API_KEY,
            },
            body: body.toString(),
        });

        const resultText = await response.text();
        console.log("Africa's Talking Raw Response:", resultText);

        // Supabase Auth strictly demands a HTTP 200 response. 
        // If you return 400 or 500, it breaks the entire login flow.
        return new Response(JSON.stringify({ success: true, at_response: resultText }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });

    } catch (error: any) {
        console.error("Critical Function Error:", error.message, error.stack);
        console.error("Failed on payload:", payloadStr);

        // STILL return 200 so we don't crash Supabase Auth
        return new Response(JSON.stringify({ error: error.message }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }
});
