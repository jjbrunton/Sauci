export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    // Allows to automatically instantiate createClient with right options
    // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
    __InternalSupabase: {
        PostgrestVersion: "14.1"
    }
    public: {
        Tables: {
            categories: {
                Row: {
                    id: string
                    name: string
                    description: string | null
                    icon: string | null
                    sort_order: number | null
                    created_at: string | null
                }
                Insert: {
                    id?: string
                    name: string
                    description?: string | null
                    icon?: string | null
                    sort_order?: number | null
                    created_at?: string | null
                }
                Update: {
                    id?: string
                    name?: string
                    description?: string | null
                    icon?: string | null
                    sort_order?: number | null
                    created_at?: string | null
                }
                Relationships: []
            }
            couple_packs: {
                Row: {
                    couple_id: string
                    created_at: string | null
                    enabled: boolean | null
                    pack_id: string
                }
                Insert: {
                    couple_id: string
                    created_at?: string | null
                    enabled?: boolean | null
                    pack_id: string
                }
                Update: {
                    couple_id?: string
                    created_at?: string | null
                    enabled?: boolean | null
                    pack_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "couple_packs_couple_id_fkey"
                        columns: ["couple_id"]
                        isOneToOne: false
                        referencedRelation: "couples"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "couple_packs_pack_id_fkey"
                        columns: ["pack_id"]
                        isOneToOne: false
                        referencedRelation: "question_packs"
                        referencedColumns: ["id"]
                    },
                ]
            }
            couples: {
                Row: {
                    created_at: string | null
                    id: string
                    invite_code: string | null
                }
                Insert: {
                    created_at?: string | null
                    id?: string
                    invite_code?: string | null
                }
                Update: {
                    created_at?: string | null
                    id?: string
                    invite_code?: string | null
                }
                Relationships: []
            }
            matches: {
                Row: {
                    couple_id: string
                    created_at: string | null
                    id: string
                    is_new: boolean | null
                    match_type: Database["public"]["Enums"]["match_type"]
                    question_id: string
                }
                Insert: {
                    couple_id: string
                    created_at?: string | null
                    id?: string
                    is_new?: boolean | null
                    match_type: Database["public"]["Enums"]["match_type"]
                    question_id: string
                }
                Update: {
                    couple_id?: string
                    created_at?: string | null
                    id?: string
                    is_new?: boolean | null
                    match_type?: Database["public"]["Enums"]["match_type"]
                    question_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "matches_couple_id_fkey"
                        columns: ["couple_id"]
                        isOneToOne: false
                        referencedRelation: "couples"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "matches_question_id_fkey"
                        columns: ["question_id"]
                        isOneToOne: false
                        referencedRelation: "questions"
                        referencedColumns: ["id"]
                    },
                ]
            }
            messages: {
                Row: {
                    content: string | null
                    created_at: string | null
                    delivered_at: string | null
                    id: string
                    match_id: string
                    media_path: string | null
                    media_viewed_at: string | null
                    read_at: string | null
                    user_id: string
                }
                Insert: {
                    content?: string | null
                    created_at?: string | null
                    delivered_at?: string | null
                    id?: string
                    match_id: string
                    media_path?: string | null
                    media_viewed_at?: string | null
                    read_at?: string | null
                    user_id: string
                }
                Update: {
                    content?: string | null
                    created_at?: string | null
                    delivered_at?: string | null
                    id?: string
                    match_id?: string
                    media_path?: string | null
                    media_viewed_at?: string | null
                    read_at?: string | null
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "messages_match_id_fkey"
                        columns: ["match_id"]
                        isOneToOne: false
                        referencedRelation: "matches"
                        referencedColumns: ["id"]
                    },
                ]
            }
            profiles: {
                Row: {
                    avatar_url: string | null
                    couple_id: string | null
                    created_at: string | null
                    email: string | null
                    id: string
                    is_premium: boolean | null
                    name: string | null
                    push_token: string | null
                    updated_at: string | null
                }
                Insert: {
                    avatar_url?: string | null
                    couple_id?: string | null
                    created_at?: string | null
                    email?: string | null
                    id: string
                    is_premium?: boolean | null
                    name?: string | null
                    push_token?: string | null
                    updated_at?: string | null
                }
                Update: {
                    avatar_url?: string | null
                    couple_id?: string | null
                    created_at?: string | null
                    email?: string | null
                    id?: string
                    is_premium?: boolean | null
                    name?: string | null
                    push_token?: string | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "profiles_couple_id_fkey"
                        columns: ["couple_id"]
                        isOneToOne: false
                        referencedRelation: "couples"
                        referencedColumns: ["id"]
                    },
                ]
            }
            question_packs: {
                Row: {
                    id: string
                    name: string
                    description: string | null
                    icon: string | null
                    is_premium: boolean | null
                    is_public: boolean | null
                    sort_order: number | null
                    category_id: string | null
                    created_at: string | null
                }
                Insert: {
                    id?: string
                    name: string
                    description?: string | null
                    icon?: string | null
                    is_premium?: boolean | null
                    is_public?: boolean | null
                    sort_order?: number | null
                    category_id?: string | null
                    created_at?: string | null
                }
                Update: {
                    id?: string
                    name?: string
                    description?: string | null
                    icon?: string | null
                    is_premium?: boolean | null
                    is_public?: boolean | null
                    sort_order?: number | null
                    category_id?: string | null
                    created_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "question_packs_category_id_fkey"
                        columns: ["category_id"]
                        isOneToOne: false
                        referencedRelation: "categories"
                        referencedColumns: ["id"]
                    }
                ]
            }
            questions: {
                Row: {
                    created_at: string | null
                    id: string
                    intensity: number | null
                    pack_id: string
                    text: string
                    partner_text: string | null
                }
                Insert: {
                    created_at?: string | null
                    id?: string
                    intensity?: number | null
                    pack_id: string
                    text: string
                    partner_text?: string | null
                }
                Update: {
                    created_at?: string | null
                    id?: string
                    intensity?: number | null
                    pack_id?: string
                    text?: string
                    partner_text?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "questions_pack_id_fkey"
                        columns: ["pack_id"]
                        isOneToOne: false
                        referencedRelation: "question_packs"
                        referencedColumns: ["id"]
                    },
                ]
            }
            responses: {
                Row: {
                    answer: Database["public"]["Enums"]["answer_type"]
                    couple_id: string
                    created_at: string | null
                    id: string
                    question_id: string
                    user_id: string
                }
                Insert: {
                    answer: Database["public"]["Enums"]["answer_type"]
                    couple_id: string
                    created_at?: string | null
                    id?: string
                    question_id: string
                    user_id: string
                }
                Update: {
                    answer?: Database["public"]["Enums"]["answer_type"]
                    couple_id?: string
                    created_at?: string | null
                    id?: string
                    question_id?: string
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "responses_couple_id_fkey"
                        columns: ["couple_id"]
                        isOneToOne: false
                        referencedRelation: "couples"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "responses_question_id_fkey"
                        columns: ["question_id"]
                        isOneToOne: false
                        referencedRelation: "questions"
                        referencedColumns: ["id"]
                    },
                ]
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            get_recommended_questions: {
                Args: {
                    target_pack_id?: string
                }
                Returns: {
                    id: string
                    text: string
                    partner_text: string | null
                    is_two_part: boolean
                    pack_id: string
                    intensity: number
                    partner_answered: boolean
                }[]
            }
        }
        Enums: {
            answer_type: "yes" | "no" | "maybe"
            match_type: "yes_yes" | "yes_maybe" | "maybe_maybe"
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

// Helper type to get schema keys excluding internal keys
type SchemaName = Exclude<keyof Database, "__InternalSupabase">

// Helper to safely get schema
type GetSchema<S extends SchemaName> = Database[S]

export type Tables<
    PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: SchemaName },
    TableName extends PublicTableNameOrOptions extends { schema: SchemaName }
    ? keyof (GetSchema<PublicTableNameOrOptions["schema"]>["Tables"] &
        GetSchema<PublicTableNameOrOptions["schema"]>["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: SchemaName }
    ? (GetSchema<PublicTableNameOrOptions["schema"]>["Tables"] &
        GetSchema<PublicTableNameOrOptions["schema"]>["Views"])[TableName] extends {
            Row: infer R
        }
    ? R
    : never
    : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
            Row: infer R
        }
    ? R
    : never
    : never

export type TablesInsert<
    PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: SchemaName },
    TableName extends PublicTableNameOrOptions extends { schema: SchemaName }
    ? keyof GetSchema<PublicTableNameOrOptions["schema"]>["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: SchemaName }
    ? GetSchema<PublicTableNameOrOptions["schema"]>["Tables"][TableName] extends {
        Insert: infer I
    }
    ? I
    : never
    : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
    }
    ? I
    : never
    : never

export type TablesUpdate<
    PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: SchemaName },
    TableName extends PublicTableNameOrOptions extends { schema: SchemaName }
    ? keyof GetSchema<PublicTableNameOrOptions["schema"]>["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: SchemaName }
    ? GetSchema<PublicTableNameOrOptions["schema"]>["Tables"][TableName] extends {
        Update: infer U
    }
    ? U
    : never
    : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
    }
    ? U
    : never
    : never

export type Enums<
    PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: SchemaName },
    EnumName extends PublicEnumNameOrOptions extends { schema: SchemaName }
    ? keyof GetSchema<PublicEnumNameOrOptions["schema"]>["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: SchemaName }
    ? GetSchema<PublicEnumNameOrOptions["schema"]>["Enums"][EnumName]
    : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
    PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: SchemaName },
    CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
        schema: SchemaName
    }
    ? keyof GetSchema<PublicCompositeTypeNameOrOptions["schema"]>["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: SchemaName }
    ? GetSchema<PublicCompositeTypeNameOrOptions["schema"]>["CompositeTypes"][CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
    public: {
        Enums: {
            answer_type: ["yes", "no", "maybe"],
            match_type: ["yes_yes", "yes_maybe", "maybe_maybe"],
        },
    },
} as const
