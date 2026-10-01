import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://rkxrpirpcvkhatwuytoo.supabase.co'
const supabasePublishableKey = 'sb_publishable_ksmYUiA-D81opktJnAhQ_A_g8Ne8UPT'

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey
)