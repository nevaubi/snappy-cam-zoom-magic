import { useState } from 'react';
import { 
  Video, 
  Camera, 
  Image, 
  Settings,
  LogOut
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const menuItems = [
  { 
    title: 'My Library', 
    url: '/dashboard?tab=library', 
    icon: Video 
  },
  { 
    title: 'Screen Recorder', 
    url: '/dashboard?tab=recorder', 
    icon: Camera 
  },
  { 
    title: 'Screenshot Beautifier', 
    url: '/dashboard?tab=beautifier', 
    icon: Image 
  },
  { 
    title: 'Settings', 
    url: '/dashboard?tab=settings', 
    icon: Settings 
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  
  const searchParams = new URLSearchParams(location.search);
  const currentTab = searchParams.get('tab') || 'recorder';

  const isActive = (url: string) => {
    const urlParams = new URLSearchParams(new URL(url, window.location.origin).search);
    const urlTab = urlParams.get('tab') || 'recorder';
    return currentTab === urlTab;
  };

  const handleNavigation = (url: string) => {
    navigate(url);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Signed out successfully",
        description: "You have been logged out of your account.",
      });
    } catch (error) {
      toast({
        title: "Error signing out",
        description: "There was a problem signing you out. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Sidebar className={state === 'collapsed' ? 'w-14' : 'w-60'} collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            <Camera className="h-6 w-6 text-accent-glow" />
            {state !== 'collapsed' && (
              <span className="font-bold text-lg">SnapCam</span>
            )}
          </div>
          <SidebarTrigger />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild
                    isActive={isActive(item.url)}
                  >
                    <button
                      onClick={() => handleNavigation(item.url)}
                      className="flex items-center gap-2 w-full"
                    >
                      <item.icon className="h-4 w-4" />
                      {state !== 'collapsed' && <span>{item.title}</span>}
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="p-2 space-y-2">
          {state !== 'collapsed' && user && (
            <div className="text-xs text-muted-foreground px-2 truncate">
              {user.email}
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="w-full justify-start"
          >
            <LogOut className="h-4 w-4" />
            {state !== 'collapsed' && <span className="ml-2">Sign Out</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}