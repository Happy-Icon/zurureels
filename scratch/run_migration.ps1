$headers = @{
    "Authorization" = "Bearer sbp_v0_e5ece8a1f051cfbbea683667e08da1c758d21f6e"
    "Content-Type"  = "application/json"
}

$sql = Get-Content -Path "backend/supabase/migrations/20260430000000_FULL_PRODUCTION_MASTER.sql" -Raw

$body = @{
    query = $sql
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/rjzgzxxdrltlteeshtuw/query" -Method Post -Headers $headers -Body $body
    $response | ConvertTo-Json
} catch {
    $_.Exception.Message
    $_.ErrorDetails.Message
}
