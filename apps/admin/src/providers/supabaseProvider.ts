import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from '../config';

export const supabase = createClient(
    supabaseConfig.url,
    supabaseConfig.anonKey
);

// Custom data provider wrapper if needed for ra-data-supabase
import { supabaseDataProvider } from 'ra-supabase';

export const dataProvider = supabaseDataProvider(
    supabase,
    {
        resources: {
            question_packs: 'question_packs',
            questions: 'questions',
            profiles: 'profiles',
            couples: 'couples'
        }
    }
);
