import { useLocation } from 'react-router-dom';
import { SidebarTrigger } from '@/components/ui/sidebar';
import SimpleVideoRecorder from '@/components/SimpleVideoRecorder';
import { MyLibrary } from '@/components/MyLibrary';
import { ScreenshotBeautifier } from '@/components/ScreenshotBeautifier';
import { UserSettings } from '@/components/UserSettings';
import { useIsMobile } from '@/hooks/use-mobile';

export function DashboardContent() {
  const location = useLocation();
  const isMobile = useIsMobile();
  const searchParams = new URLSearchParams(location.search);
  const currentTab = searchParams.get('tab') || 'recorder';

  const renderTabContent = () => {
    switch (currentTab) {
      case 'library':
        return <MyLibrary />;
      case 'recorder':
        if (isMobile) {
          return (
            <div className="flex items-center justify-center min-h-[60vh] p-8">
              <div className="text-center space-y-4 max-w-md">
                <h2 className="text-2xl font-semibold">Desktop Only</h2>
                <p className="text-muted-foreground">
                  Screen recording and video editing features are not available on mobile devices. 
                  Please access this from a desktop or laptop computer.
                </p>
              </div>
            </div>
          );
        }
        return <SimpleVideoRecorder />;
      case 'beautifier':
        if (isMobile) {
          return (
            <div className="flex items-center justify-center min-h-[60vh] p-8">
              <div className="text-center space-y-4 max-w-md">
                <h2 className="text-2xl font-semibold">Desktop Only</h2>
                <p className="text-muted-foreground">
                  Screenshot beautifier features are not available on mobile devices. 
                  Please access this from a desktop or laptop computer.
                </p>
              </div>
            </div>
          );
        }
        return <ScreenshotBeautifier />;
      case 'settings':
        return <UserSettings />;
      default:
        return <SimpleVideoRecorder />;
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header with sidebar trigger */}
      <header className="h-12 flex items-center border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
        <SidebarTrigger />
        <div className="ml-4">
          <h1 className="text-lg font-semibold capitalize">
            {currentTab === 'recorder' ? 'Screen Recorder' : 
             currentTab === 'library' ? 'My Library' :
             currentTab === 'beautifier' ? 'Screenshot Beautifier' :
             currentTab === 'settings' ? 'Settings' : 'Dashboard'}
          </h1>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        {renderTabContent()}
      </div>
    </div>
  );
}