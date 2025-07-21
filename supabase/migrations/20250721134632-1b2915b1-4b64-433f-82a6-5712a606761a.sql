-- Create storage bucket for recorded videos
INSERT INTO storage.buckets (id, name, public) VALUES ('recorded-videos', 'recorded-videos', true);

-- Create table for recorded video metadata
CREATE TABLE public.recordedvids (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    filename TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size BIGINT,
    duration REAL,
    quality_preset TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.recordedvids ENABLE ROW LEVEL SECURITY;

-- Create policies (making it public for now since no authentication is implemented)
CREATE POLICY "Anyone can view recorded videos" 
ON public.recordedvids 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert recorded videos" 
ON public.recordedvids 
FOR INSERT 
WITH CHECK (true);

-- Create storage policies for the bucket
CREATE POLICY "Anyone can view recorded videos in storage" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'recorded-videos');

CREATE POLICY "Anyone can upload recorded videos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'recorded-videos');

CREATE POLICY "Anyone can update recorded videos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'recorded-videos');