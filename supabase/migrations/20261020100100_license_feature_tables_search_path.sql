-- Pin the search_path of license_feature_tables() (Supabase security
-- advisor: function_search_path_mutable). The function only returns a
-- constant list, so this changes no behaviour.
alter function license_feature_tables() set search_path to 'public';
