import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Download, Trash2, Video } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface RecordedVideo {
  id: string;
  filename: string;
  file_url: string;
  duration: number;
  file_size: number;
  quality_preset: string;
  created_at: string;
}

export function MyLibrary() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [videos, setVideos] = useState<RecordedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (user) {
      fetchVideos();
    }
  }, [user]);

  const fetchVideos = async () => {
    try {
      const { data, error } = await supabase
        .from('recordedvids')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVideos(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading videos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredVideos = videos.filter(video =>
    video.filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-lg text-muted-foreground">Loading your videos...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">My Video Library</h2>
          <p className="text-muted-foreground">
            {videos.length} video{videos.length !== 1 ? 's' : ''} recorded
          </p>
        </div>
        
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search videos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {filteredVideos.length === 0 ? (
        <div className="text-center py-12">
          <Video className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {videos.length === 0 ? 'No videos yet' : 'No videos found'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {videos.length === 0 
              ? 'Start recording to see your videos here'
              : 'Try adjusting your search terms'
            }
          </p>
          {videos.length === 0 && (
            <Button onClick={() => window.location.href = '/dashboard?tab=recorder'}>
              Start Recording
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVideos.map((video) => (
            <Card key={video.id} className="overflow-hidden">
              <div className="aspect-video bg-muted flex items-center justify-center">
                <video
                  src={video.file_url}
                  className="w-full h-full object-cover"
                  preload="metadata"
                />
              </div>
              
              <CardHeader className="pb-3">
                <CardTitle className="text-lg truncate" title={video.filename}>
                  {video.filename}
                </CardTitle>
                <CardDescription className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{formatDuration(video.duration)}</span>
                    <span>{formatFileSize(video.file_size)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-xs">
                      {video.quality_preset || 'Standard'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(video.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </CardDescription>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => window.open(video.file_url, '_blank')}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="px-3"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}