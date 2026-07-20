import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

Deno.serve(async (req) => {
    // 1. Handle CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders, status: 200 });
    }

    try {
        // 2. Initialize Supabase
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        );

        // 3. Authenticate User
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        if (authError || !user) {
            console.error("Auth error:", authError);
            throw new Error("Unauthorized");
        }

        // 4. Parse Request Data
        const { business_name, settlement_bank, account_number, percentage_charge } = await req.json();

        const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');
        if (!PAYSTACK_SECRET_KEY) {
            console.error("Missing PAYSTACK_SECRET_KEY");
            throw new Error("Server configuration error: Paystack key missing");
        }

        // 5. Fetch current profile
        const { data: profile, error: fetchError } = await supabaseClient
            .from('profiles')
            .select('metadata')
            .eq('id', user.id)
            .single();

        if (fetchError) {
            console.error("Profile fetch error:", fetchError);
            throw fetchError;
        }

        const metadata = (profile?.metadata as any) || {};
        const existingCode = metadata.paystack_subaccount_code;

        let response;
        if (existingCode) {
            console.log(`Updating existing subaccount: ${existingCode}`);
            response = await fetch(`https://api.paystack.co/subaccount/${existingCode}`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    business_name,
                    settlement_bank,
                    account_number,
                }),
            });
        } else {
            console.log(`Creating new subaccount for: ${business_name}`);
            response = await fetch('https://api.paystack.co/subaccount', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    business_name,
                    settlement_bank,
                    account_number,
                    percentage_charge: percentage_charge || 10,
                }),
            });
        }

        const result = await response.json();
        console.log("Paystack response:", JSON.stringify(result));

        if (!result.status) {
            throw new Error(result.message || "Paystack integration error");
        }

        const subaccountCode = result.data.subaccount_code;

        // 6. Create Transfer Recipient for Escrow Payouts
        console.log(`Creating transfer recipient for: ${business_name}`);
        const recipientResponse = await fetch('https://api.paystack.co/transferrecipient', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: "nuban",
                name: business_name,
                account_number: account_number,
                bank_code: settlement_bank,
                currency: "KES"
            }),
        });

        const recipientResult = await recipientResponse.json();
        const recipientCode = recipientResult.status ? recipientResult.data.recipient_code : null;

        // 7. Update Profile
        const updatedMetadata = {
            ...metadata,
            paystack_subaccount_code: subaccountCode,
            paystack_recipient_code: recipientCode, // Used for automated payouts
            bank_code: settlement_bank,
            bank_account_number: account_number,
            payout_connected: true,
        };

        const { error: updateError } = await supabaseClient
            .from('profiles')
            .update({ 
                metadata: updatedMetadata,
                business_name: business_name 
            })
            .eq('id', user.id);

        if (updateError) {
            console.error("Profile update error:", updateError);
            throw updateError;
        }

        return new Response(
            JSON.stringify({ subaccount_code: subaccountCode }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            },
        );

    } catch (error: any) {
        console.error("Function error:", error.message);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            },
        );
    }
});
