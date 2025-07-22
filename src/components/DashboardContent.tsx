import { useLocation } from 'react-router-dom';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import SimpleVideoRecorder from '@/components/SimpleVideoRecorder';
import { MyLibrary } from '@/components/MyLibrary';
import { ScreenshotBeautifier } from '@/components/ScreenshotBeautifier';
import { UserSettings } from '@/components/UserSettings';
import { useIsMobile } from '@/hooks/use-mobile';

export function DashboardContent() {
  const location = useLocation();
  const isMobile = useIsMobile();
  const { setOpen: setSidebarOpen } = useSidebar();
  const searchParams = new URLSearchParams(location.search);
  const currentTab = searchParams.get('tab') || 'recorder';
  
  const closeSidebar = () => {
    setSidebarOpen(false);
  };

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
        return <SimpleVideoRecorder onCloseSidebar={closeSidebar} />;
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
        return <SimpleVideoRecorder onCloseSidebar={closeSidebar} />;
    }
  };

  return (
    <div className="h-screen overflow-auto">
      {renderTabContent()}
    </div>
  );
}