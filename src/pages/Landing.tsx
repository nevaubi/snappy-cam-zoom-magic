import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Redirect to dashboard if already logged in
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Simple Navbar */}
      <nav className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 hidden md:flex">
            <a className="mr-6 flex items-center space-x-2" href="/">
              <span className="hidden font-bold sm:inline-block">
                SnapCam
              </span>
            </a>
          </div>
          <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <div className="w-full flex-1 md:w-auto md:flex-none">
              {/* Empty for now */}
            </div>
            <nav className="flex items-center space-x-2">
              <Button 
                variant="ghost" 
                onClick={() => navigate('/auth')}
              >
                Sign In
              </Button>
              <Button 
                onClick={() => navigate('/auth')}
              >
                Get Started
              </Button>
            </nav>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="container flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] text-center">
        <div className="space-y-6 max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl">
            Record, Edit & Share
            <span className="block text-accent-glow">
              Professional Videos
            </span>
          </h1>
          <p className="mx-auto max-w-[700px] text-muted-foreground text-lg sm:text-xl">
            Create stunning screen recordings with powerful editing tools. 
            Zoom, crop, trim and beautify your videos in seconds.
          </p>
          <div className="space-y-4 sm:space-y-0 sm:space-x-4 sm:flex sm:justify-center">
            <Button 
              size="lg" 
              className="w-full sm:w-auto"
              onClick={() => navigate('/auth')}
            >
              Start Recording Free
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}