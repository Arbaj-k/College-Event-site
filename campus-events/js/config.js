/*
 * PUBLIC Supabase settings – this is the ONLY file you need to edit.
 *
 * Find both values in Supabase: Project Settings > API
 *   SUPABASE_URL      -> "Project URL"
 *   SUPABASE_ANON_KEY -> the "anon" / "publishable" key
 *
 * The anon key is meant to be public: Row Level Security in the database
 * decides what visitors can do. NEVER paste the "service_role" / "secret"
 * key here. On Netlify you can leave this file as is and set the
 * SUPABASE_URL and SUPABASE_ANON_KEY environment variables instead
 * (build-config.js will write this file for you during deploy).
 */
   window.CE_CONFIG = {
     SUPABASE_URL: "https://xeablvxtlxdwuiiawsgq.supabase.co",
     SUPABASE_ANON_KEY: "sb_publishable_tZ8LD25PjM-U-CB0tp3fYA_TtoAFKRD"
   };
