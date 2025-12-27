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
                    }
                ]
            }
            profiles: {
                Row: {
                    avatar_url: string | null
                    couple_id: string | null
                    created_at: string | null
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
                    {
                        foreignKeyName: "profiles_id_fkey"
                        columns: ["id"]
                        isOneToOne: true
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    }
                ]
            }
            question_packs: {
                Row: {
                    created_at: string | null
                    description: string | null
                    icon: string | null
                    id: string
                    is_premium: boolean | null
                    is_public: boolean | null
                    name: string
                    sort_order: number | null
                }
                Insert: {
                    created_at?: string | null
                    description?: string | null
                    icon?: string | null
                    id?: string
                    is_premium?: boolean | null
                    is_public?: boolean | null
                    name: string
                    sort_order?: number | null
                }
                Update: {
                    created_at?: string | null
                    description?: string | null
                    icon?: string | null
                    id?: string
                    is_premium?: boolean | null
                    is_public?: boolean | null
                    name?: string
                    sort_order?: number | null
                }
                Relationships: []
            }
            questions: {
                Row: {
                    created_at: string | null
                    id: string
                    intensity: number | null
                    pack_id: string
                    text: string
                }
                Insert: {
                    created_at?: string | null
                    id?: string
                    intensity?: number | null
                    pack_id: string
                    text: string
                }
                Update: {
                    created_at?: string | null
                    id?: string
                    intensity?: number | null
                    pack_id?: string
                    text?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "questions_pack_id_fkey"
                        columns: ["pack_id"]
                        isOneToOne: false
                        referencedRelation: "question_packs"
                        referencedColumns: ["id"]
                    }
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
                    {
                        foreignKeyName: "responses_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    }
                ]
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
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

export type Tables<
    PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
    TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
    ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
    TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
    ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
    TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
    ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
    EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
    ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
    : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never
