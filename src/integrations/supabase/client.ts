import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cnhhusxhcxjhizzzxorm.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuaGh1c3hoY3hqaGl6enp4b3JtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxMDUyMzQsImV4cCI6MjA2ODY4MTIzNH0.9Qix5Z5u7D71WRcjU59q3cUlrl0JjhY_B5Z6ju_oEAw'

export const supabase = createClient(supabaseUrl, supabaseKey)