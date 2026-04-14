import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ckusqeaiuhexuoskovha.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrdXNxZWFpdWhleHVvc2tvdmhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0Mjc1MDYsImV4cCI6MjA4MzAwMzUwNn0.ZDUgaQUmNhurCm8KT_zZEboaoSai-jyuODSKkZTJs6M";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
