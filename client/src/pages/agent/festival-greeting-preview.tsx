import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Share2, Sparkles } from 'lucide-react';

interface AgentInfo {
  name: string;
  email: string;
  phone: string;
  designation: string;
}

export default function FestivalGreetingPreview() {
  const [agentInfo, setAgentInfo] = useState<AgentInfo>({
    name: 'Sangram Kesari Mohanty',
    email: 'sangram@fintekpro.com',
    phone: '+91 98765 43210',
    designation: 'Senior Financial Advisor',
  });

  const templateRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (!templateRef.current) return;
    
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(templateRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
      });
      
      const link = document.createElement('a');
      link.download = 'diwali-greeting.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error generating image:', error);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-yellow-500" />
          Festival Greeting Templates
        </h1>
        <p className="text-muted-foreground">
          Preview and customize greeting templates for Indian festivals
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Customization Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Personalize Your Greeting</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Your Name</Label>
              <Input
                id="name"
                value={agentInfo.name}
                onChange={(e) => setAgentInfo({ ...agentInfo, name: e.target.value })}
                placeholder="Enter your name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="designation">Designation</Label>
              <Input
                id="designation"
                value={agentInfo.designation}
                onChange={(e) => setAgentInfo({ ...agentInfo, designation: e.target.value })}
                placeholder="Enter your designation"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={agentInfo.email}
                onChange={(e) => setAgentInfo({ ...agentInfo, email: e.target.value })}
                placeholder="Enter your email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={agentInfo.phone}
                onChange={(e) => setAgentInfo({ ...agentInfo, phone: e.target.value })}
                placeholder="Enter your phone number"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button onClick={handleDownload} className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Download Image
              </Button>
              <Button variant="outline" className="flex-1">
                <Share2 className="h-4 w-4 mr-2" />
                Share via WhatsApp
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Template Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Preview - Diwali 2026</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              ref={templateRef}
              className="relative overflow-hidden rounded-xl shadow-2xl"
              style={{
                width: '100%',
                aspectRatio: '1/1',
                background: 'linear-gradient(135deg, #1a0a2e 0%, #2d1b4e 30%, #4a2c6a 60%, #6b3d8a 100%)',
              }}
            >
              {/* Decorative Elements */}
              <div className="absolute inset-0">
                {/* Floating Diyas */}
                <div className="absolute top-4 left-4 text-4xl animate-pulse">🪔</div>
                <div className="absolute top-8 right-8 text-3xl animate-pulse" style={{ animationDelay: '0.5s' }}>🪔</div>
                <div className="absolute bottom-32 left-8 text-3xl animate-pulse" style={{ animationDelay: '1s' }}>🪔</div>
                <div className="absolute top-20 left-1/4 text-2xl animate-pulse" style={{ animationDelay: '0.3s' }}>✨</div>
                <div className="absolute top-16 right-1/4 text-2xl animate-pulse" style={{ animationDelay: '0.7s' }}>✨</div>
                
                {/* Sparkle decorations */}
                <div className="absolute top-1/4 right-12 text-yellow-300 text-xl">⭐</div>
                <div className="absolute top-1/3 left-16 text-orange-300 text-lg">⭐</div>
                
                {/* Rangoli pattern at bottom */}
                <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 opacity-30">
                  <div className="w-48 h-48 rounded-full border-4 border-yellow-400/50"></div>
                </div>
              </div>

              {/* Main Content */}
              <div className="relative z-10 h-full flex flex-col items-center justify-center p-6 text-center">
                {/* Festival Name */}
                <div className="mb-2">
                  <span className="text-yellow-300 text-lg font-medium tracking-widest uppercase">
                    Happy
                  </span>
                </div>
                
                {/* Main Title */}
                <h1 
                  className="text-5xl md:text-6xl font-bold mb-3"
                  style={{
                    background: 'linear-gradient(180deg, #ffd700 0%, #ff8c00 50%, #ff6347 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    textShadow: '0 0 30px rgba(255, 215, 0, 0.5)',
                    fontFamily: 'Georgia, serif',
                  }}
                >
                  DIWALI
                </h1>

                {/* Decorative Line */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px w-12 bg-gradient-to-r from-transparent to-yellow-400"></div>
                  <span className="text-2xl">🪔</span>
                  <div className="h-px w-12 bg-gradient-to-l from-transparent to-yellow-400"></div>
                </div>

                {/* Blessing Message */}
                <p className="text-yellow-100/90 text-sm md:text-base mb-6 max-w-xs font-light italic">
                  "May this festival of lights bring joy, prosperity, and success to you and your family"
                </p>

                {/* Agent Info Card */}
                <div 
                  className="mt-auto w-full max-w-xs rounded-lg p-4"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,215,0,0.15) 0%, rgba(255,140,0,0.1) 100%)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                  }}
                >
                  <div className="text-white font-semibold text-lg mb-1">
                    {agentInfo.name || 'Your Name'}
                  </div>
                  <div className="text-yellow-300/80 text-xs mb-2">
                    {agentInfo.designation || 'Financial Advisor'}
                  </div>
                  <div className="text-yellow-100/70 text-xs space-y-0.5">
                    <div>📧 {agentInfo.email || 'email@example.com'}</div>
                    <div>📞 {agentInfo.phone || '+91 XXXXX XXXXX'}</div>
                  </div>
                  
                  {/* Company Branding */}
                  <div className="mt-3 pt-2 border-t border-yellow-400/20">
                    <div className="text-yellow-400 text-xs font-bold tracking-wider">
                      FintekPro
                    </div>
                    <div className="text-yellow-100/50 text-[10px]">
                      Your Trusted Financial Partner
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Other Festival Templates Preview */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">More Festival Templates</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { name: 'Holi', emoji: '🎨', colors: 'from-pink-500 via-purple-500 to-blue-500' },
            { name: 'Eid', emoji: '🌙', colors: 'from-emerald-600 to-teal-800' },
            { name: 'Christmas', emoji: '🎄', colors: 'from-red-600 to-green-700' },
            { name: 'Ganesh Chaturthi', emoji: '🐘', colors: 'from-orange-500 to-red-600' },
            { name: 'Durga Puja', emoji: '🪷', colors: 'from-red-500 to-yellow-500' },
            { name: 'Onam', emoji: '🌸', colors: 'from-yellow-400 to-orange-500' },
            { name: 'Pongal', emoji: '🌾', colors: 'from-amber-500 to-orange-600' },
            { name: 'New Year', emoji: '🎆', colors: 'from-blue-900 to-purple-900' },
          ].map((festival) => (
            <Card 
              key={festival.name}
              className="cursor-pointer hover:scale-105 transition-transform overflow-hidden"
            >
              <div 
                className={`h-24 bg-gradient-to-br ${festival.colors} flex items-center justify-center`}
              >
                <span className="text-4xl">{festival.emoji}</span>
              </div>
              <CardContent className="p-3 text-center">
                <span className="text-sm font-medium">{festival.name}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
