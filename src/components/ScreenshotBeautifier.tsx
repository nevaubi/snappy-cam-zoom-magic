import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Image, Sparkles, Palette, Frame } from 'lucide-react';

export function ScreenshotBeautifier() {
  return (
    <div className="p-6 space-y-6">
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold">Screenshot Beautifier</h2>
        <p className="text-muted-foreground text-lg">
          Transform your screenshots into beautiful, professional-looking images
        </p>
      </div>

      <div className="max-w-4xl mx-auto">
        <Card className="border-dashed border-2 border-muted-foreground/25 bg-muted/10">
          <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-accent-glow/10 flex items-center justify-center">
              <Image className="w-8 h-8 text-accent-glow" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">Coming Soon</h3>
              <p className="text-muted-foreground max-w-md">
                We're working on an amazing screenshot beautifier that will help you create 
                stunning visuals with backgrounds, shadows, and professional styling.
              </p>
            </div>
            <Button disabled variant="outline">
              <Sparkles className="w-4 h-4 mr-2" />
              Beautify Screenshots
            </Button>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <Card>
            <CardHeader className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <Frame className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-lg">Custom Frames</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center">
                Add beautiful frames and borders to make your screenshots stand out
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <Palette className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-lg">Background Magic</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center">
                Replace backgrounds with gradients, colors, or remove them entirely
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-lg">Professional Effects</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center">
                Apply shadows, reflections, and other effects for a polished look
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}