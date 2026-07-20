
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL') ?? '';
const supabaseKey = Deno.env.get('VITE_SUPABASE_ANON_KEY') ?? '';

const supabase = createClient(supabaseUrl, supabaseKey);

const email = "okelloulak2004@gmail.com";

const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .single();

if (error) {
    console.error("Error:", error);
} else {
    console.log("User Profile:", data);
}
