// Expects: @supabase/supabase-js UMD loaded beforehand and window.CLUB92_CONFIG set.
(function () {
  if (!window.supabase || !window.CLUB92_CONFIG) {
    console.error('supabase-client.js: missing supabase UMD or CLUB92_CONFIG');
    return;
  }
  const { createClient } = window.supabase;
  window.sb = createClient(
    window.CLUB92_CONFIG.SUPABASE_URL,
    window.CLUB92_CONFIG.SUPABASE_ANON
  );
})();
