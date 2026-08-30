-- ==============================================================================
-- NoteSync Supabase Database Schema & Storage Setup
-- Run this SQL in your Supabase Project -> SQL Editor
-- ==============================================================================

-- 1. Create Topics Table
CREATE TABLE IF NOT EXISTS public.topics (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    color_hex TEXT NOT NULL DEFAULT '#007AFF',
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

-- 2. Create Tags Table
CREATE TABLE IF NOT EXISTS public.tags (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    last_used_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

-- 3. Create Notes Table
CREATE TABLE IF NOT EXISTS public.notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    body_text TEXT NOT NULL DEFAULT '',
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
    is_reminder BOOLEAN NOT NULL DEFAULT FALSE,
    reminder_date BIGINT,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    priority TEXT NOT NULL DEFAULT 'Medium',
    kanban_status TEXT NOT NULL DEFAULT 'To-Do',
    topic_id TEXT REFERENCES public.topics(id) ON DELETE SET NULL,
    tags TEXT[] DEFAULT '{}',
    audio_url TEXT,
    audio_duration NUMERIC DEFAULT 0
);

-- 4. Enable Row Level Security (RLS) & Public Access Policies for Personal App
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Allow public access with anon key (ideal for personal private app)
CREATE POLICY "Allow all operations on topics" ON public.topics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on tags" ON public.tags FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on notes" ON public.notes FOR ALL USING (true) WITH CHECK (true);

-- 5. Create Storage Bucket for Voice Note Audio Recordings
INSERT INTO storage.buckets (id, name, public) 
VALUES ('voice-notes', 'voice-notes', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow public upload and reading of voice notes
CREATE POLICY "Allow public uploads to voice-notes" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'voice-notes');

CREATE POLICY "Allow public reading of voice-notes" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'voice-notes');

CREATE POLICY "Allow public deletes of voice-notes" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'voice-notes');

-- 6. Seed Default Initial Topics
INSERT INTO public.topics (id, title, color_hex, created_at)
VALUES 
    ('topic-work', 'Work', '#007AFF', (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT),
    ('topic-personal', 'Personal', '#34C759', (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT),
    ('topic-ideas', 'Ideas', '#AF52DE', (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT)
ON CONFLICT (id) DO NOTHING;
