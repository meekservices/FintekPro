import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Download, Share2, Sparkles, Save, User, Edit2, Check, X, Send, Users, Mail, MessageSquare } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface AgentInfo {
  name: string;
  email: string;
  phone: string;
  designation: string;
}

interface FestivalTemplate {
  id: string;
  name: string;
  emoji: string;
  category: 'major' | 'regional';
  gradient: string;
  primaryColor: string;
  secondaryColor: string;
  message: string;
  decorEmojis: string[];
}

const festivals: FestivalTemplate[] = [
  // Major Festivals
  {
    id: 'diwali',
    name: 'Diwali',
    emoji: '🪔',
    category: 'major',
    gradient: 'linear-gradient(135deg, #1a0a2e 0%, #2d1b4e 30%, #4a2c6a 60%, #6b3d8a 100%)',
    primaryColor: '#ffd700',
    secondaryColor: '#ff8c00',
    message: 'May this festival of lights bring joy, prosperity, and success to you and your family',
    decorEmojis: ['🪔', '✨', '⭐', '🎇']
  },
  {
    id: 'holi',
    name: 'Holi',
    emoji: '🎨',
    category: 'major',
    gradient: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 25%, #f368e0 50%, #5f27cd 75%, #0abde3 100%)',
    primaryColor: '#ffffff',
    secondaryColor: '#ffeb3b',
    message: 'May your life be filled with vibrant colors of happiness, love, and prosperity',
    decorEmojis: ['🎨', '🌈', '💜', '💛']
  },
  {
    id: 'eid',
    name: 'Eid',
    emoji: '🌙',
    category: 'major',
    gradient: 'linear-gradient(135deg, #004d40 0%, #00695c 50%, #00897b 100%)',
    primaryColor: '#ffd700',
    secondaryColor: '#c0ca33',
    message: 'Wishing you and your family a blessed Eid filled with peace, happiness, and prosperity',
    decorEmojis: ['🌙', '⭐', '🕌', '✨']
  },
  {
    id: 'christmas',
    name: 'Christmas',
    emoji: '🎄',
    category: 'major',
    gradient: 'linear-gradient(135deg, #b71c1c 0%, #c62828 50%, #1b5e20 100%)',
    primaryColor: '#ffd700',
    secondaryColor: '#ffffff',
    message: 'Wishing you a Merry Christmas filled with love, joy, and wonderful blessings',
    decorEmojis: ['🎄', '🎅', '⭐', '🎁']
  },
  {
    id: 'ganesh-chaturthi',
    name: 'Ganesh Chaturthi',
    emoji: '🐘',
    category: 'major',
    gradient: 'linear-gradient(135deg, #ff5722 0%, #ff7043 50%, #ffab40 100%)',
    primaryColor: '#ffffff',
    secondaryColor: '#ffeb3b',
    message: 'May Lord Ganesha remove all obstacles and shower you with wisdom and prosperity',
    decorEmojis: ['🐘', '🪷', '🙏', '✨']
  },
  {
    id: 'durga-puja',
    name: 'Durga Puja',
    emoji: '🪷',
    category: 'major',
    gradient: 'linear-gradient(135deg, #d32f2f 0%, #f44336 30%, #ffb300 70%, #ffc107 100%)',
    primaryColor: '#ffffff',
    secondaryColor: '#ffd700',
    message: 'May Goddess Durga bless you with strength, courage, and happiness',
    decorEmojis: ['🪷', '🙏', '✨', '🔔']
  },
  {
    id: 'onam',
    name: 'Onam',
    emoji: '🌸',
    category: 'major',
    gradient: 'linear-gradient(135deg, #f57c00 0%, #ff9800 50%, #ffc107 100%)',
    primaryColor: '#ffffff',
    secondaryColor: '#4caf50',
    message: 'Wishing you a harvest of happiness, health, and prosperity this Onam',
    decorEmojis: ['🌸', '🌺', '🛶', '🌾']
  },
  {
    id: 'pongal',
    name: 'Pongal',
    emoji: '🌾',
    category: 'major',
    gradient: 'linear-gradient(135deg, #e65100 0%, #ef6c00 50%, #ff9800 100%)',
    primaryColor: '#ffffff',
    secondaryColor: '#ffeb3b',
    message: 'May this Pongal bring abundant harvest of happiness and prosperity to you',
    decorEmojis: ['🌾', '☀️', '🐂', '🍚']
  },
  {
    id: 'new-year',
    name: 'New Year',
    emoji: '🎆',
    category: 'major',
    gradient: 'linear-gradient(135deg, #0d47a1 0%, #1565c0 30%, #1976d2 60%, #1e88e5 100%)',
    primaryColor: '#ffd700',
    secondaryColor: '#ffffff',
    message: 'Wishing you a year filled with new hopes, new joys, and new beginnings',
    decorEmojis: ['🎆', '🎉', '✨', '🥂']
  },
  // Regional Festivals
  {
    id: 'ugadi',
    name: 'Ugadi',
    emoji: '🌿',
    category: 'regional',
    gradient: 'linear-gradient(135deg, #2e7d32 0%, #43a047 50%, #66bb6a 100%)',
    primaryColor: '#ffd700',
    secondaryColor: '#ffffff',
    message: 'May this Ugadi usher in new hopes, opportunities, and prosperity',
    decorEmojis: ['🌿', '🥭', '🌺', '✨']
  },
  {
    id: 'vishu',
    name: 'Vishu',
    emoji: '🌻',
    category: 'regional',
    gradient: 'linear-gradient(135deg, #f9a825 0%, #fbc02d 50%, #ffeb3b 100%)',
    primaryColor: '#1a237e',
    secondaryColor: '#ffffff',
    message: 'Wishing you a Vishu filled with the golden glow of happiness and prosperity',
    decorEmojis: ['🌻', '🪔', '🌾', '✨']
  },
  {
    id: 'bihu',
    name: 'Bihu',
    emoji: '🎋',
    category: 'regional',
    gradient: 'linear-gradient(135deg, #f57f17 0%, #f9a825 50%, #4caf50 100%)',
    primaryColor: '#ffffff',
    secondaryColor: '#ffeb3b',
    message: 'Wishing you joy, prosperity, and new beginnings this Bihu',
    decorEmojis: ['🎋', '🌾', '💃', '🪘']
  },
  {
    id: 'baisakhi',
    name: 'Baisakhi',
    emoji: '🌾',
    category: 'regional',
    gradient: 'linear-gradient(135deg, #ff6f00 0%, #ff8f00 50%, #ffa000 100%)',
    primaryColor: '#ffffff',
    secondaryColor: '#4caf50',
    message: 'May the spirit of Baisakhi bring you abundance, happiness, and prosperity',
    decorEmojis: ['🌾', '💫', '🙏', '☀️']
  },
  {
    id: 'lohri',
    name: 'Lohri',
    emoji: '🔥',
    category: 'regional',
    gradient: 'linear-gradient(135deg, #bf360c 0%, #e64a19 50%, #ff5722 100%)',
    primaryColor: '#ffd700',
    secondaryColor: '#ffffff',
    message: 'May the warmth of Lohri bonfire bring love and happiness to your life',
    decorEmojis: ['🔥', '🥜', '🎉', '✨']
  },
  {
    id: 'makar-sankranti',
    name: 'Makar Sankranti',
    emoji: '🪁',
    category: 'regional',
    gradient: 'linear-gradient(135deg, #0288d1 0%, #039be5 50%, #4fc3f7 100%)',
    primaryColor: '#ffeb3b',
    secondaryColor: '#ffffff',
    message: 'May your life soar high with success like the colorful kites in the sky',
    decorEmojis: ['🪁', '☀️', '🌾', '✨']
  },
  {
    id: 'raksha-bandhan',
    name: 'Raksha Bandhan',
    emoji: '🎀',
    category: 'regional',
    gradient: 'linear-gradient(135deg, #ec407a 0%, #f48fb1 50%, #f8bbd9 100%)',
    primaryColor: '#ffffff',
    secondaryColor: '#ffd700',
    message: 'Celebrating the beautiful bond of love, care, and protection',
    decorEmojis: ['🎀', '💝', '🤝', '✨']
  },
  {
    id: 'navratri',
    name: 'Navratri',
    emoji: '🙏',
    category: 'regional',
    gradient: 'linear-gradient(135deg, #c62828 0%, #ef5350 30%, #ff8a65 60%, #ffcc80 100%)',
    primaryColor: '#ffffff',
    secondaryColor: '#ffd700',
    message: 'May the divine blessings of Goddess Durga bring you strength and prosperity',
    decorEmojis: ['🙏', '💃', '🔔', '✨']
  },
  {
    id: 'maha-shivaratri',
    name: 'Maha Shivaratri',
    emoji: '🔱',
    category: 'major',
    gradient: 'linear-gradient(135deg, #1a237e 0%, #283593 30%, #3949ab 60%, #5c6bc0 100%)',
    primaryColor: '#e0e0e0',
    secondaryColor: '#b0bec5',
    message: 'May Lord Shiva bless you with peace, prosperity, and spiritual awakening',
    decorEmojis: ['🔱', '🙏', '📿', '✨']
  },
  {
    id: 'janmashtami',
    name: 'Janmashtami',
    emoji: '🦚',
    category: 'major',
    gradient: 'linear-gradient(135deg, #1565c0 0%, #1e88e5 30%, #42a5f5 60%, #90caf9 100%)',
    primaryColor: '#ffd700',
    secondaryColor: '#ffffff',
    message: 'May Lord Krishna fill your life with love, joy, and divine blessings',
    decorEmojis: ['🦚', '🪈', '🧈', '✨']
  },
  {
    id: 'independence-day',
    name: 'Independence Day',
    emoji: '🇮🇳',
    category: 'major',
    gradient: 'linear-gradient(135deg, #ff9933 0%, #ffffff 50%, #138808 100%)',
    primaryColor: '#1a237e',
    secondaryColor: '#ff6f00',
    message: 'Saluting the spirit of freedom and celebrating the pride of our great nation',
    decorEmojis: ['🇮🇳', '🕊️', '⭐', '🎗️']
  },
  {
    id: 'republic-day',
    name: 'Republic Day',
    emoji: '🏛️',
    category: 'major',
    gradient: 'linear-gradient(135deg, #e65100 0%, #ff9800 30%, #ffffff 50%, #2e7d32 70%, #1b5e20 100%)',
    primaryColor: '#1a237e',
    secondaryColor: '#ff6f00',
    message: 'Celebrating the constitution that unites us and the values that define us',
    decorEmojis: ['🏛️', '🇮🇳', '⭐', '🎖️']
  },
  {
    id: 'guru-nanak-jayanti',
    name: 'Guru Nanak Jayanti',
    emoji: '🙏',
    category: 'regional',
    gradient: 'linear-gradient(135deg, #ff8f00 0%, #ffa000 30%, #ffca28 60%, #fff176 100%)',
    primaryColor: '#1a237e',
    secondaryColor: '#ffffff',
    message: 'May the teachings of Guru Nanak Dev Ji guide you towards truth, compassion, and contentment',
    decorEmojis: ['🙏', '📖', '☀️', '✨']
  },
  {
    id: 'chhath-puja',
    name: 'Chhath Puja',
    emoji: '☀️',
    category: 'regional',
    gradient: 'linear-gradient(135deg, #e65100 0%, #ff6d00 30%, #ff9100 60%, #ffab40 100%)',
    primaryColor: '#ffffff',
    secondaryColor: '#ffd700',
    message: 'May the Sun God bless you with health, happiness, and abundant prosperity',
    decorEmojis: ['☀️', '🙏', '🌊', '✨']
  },
  {
    id: 'karwa-chauth',
    name: 'Karwa Chauth',
    emoji: '🌙',
    category: 'regional',
    gradient: 'linear-gradient(135deg, #880e4f 0%, #ad1457 30%, #c62828 60%, #e53935 100%)',
    primaryColor: '#ffd700',
    secondaryColor: '#ffffff',
    message: 'Celebrating the beautiful bond of love, devotion, and togetherness',
    decorEmojis: ['🌙', '💑', '🪔', '✨']
  },
  {
    id: 'gudi-padwa',
    name: 'Gudi Padwa',
    emoji: '🚩',
    category: 'regional',
    gradient: 'linear-gradient(135deg, #e65100 0%, #f57c00 30%, #ff9800 60%, #ffc107 100%)',
    primaryColor: '#ffffff',
    secondaryColor: '#ffd700',
    message: 'May this auspicious new year bring you success, happiness, and new beginnings',
    decorEmojis: ['🚩', '🌿', '🥭', '✨']
  },
  {
    id: 'dussehra',
    name: 'Dussehra',
    emoji: '🏹',
    category: 'major',
    gradient: 'linear-gradient(135deg, #b71c1c 0%, #c62828 30%, #e53935 60%, #ff5252 100%)',
    primaryColor: '#ffd700',
    secondaryColor: '#ffffff',
    message: 'May the triumph of good over evil inspire you to conquer every challenge in life',
    decorEmojis: ['🏹', '🔥', '⚔️', '✨']
  },
  {
    id: 'ram-navami',
    name: 'Ram Navami',
    emoji: '🙏',
    category: 'regional',
    gradient: 'linear-gradient(135deg, #e65100 0%, #ff6d00 30%, #ff9100 60%, #ffd54f 100%)',
    primaryColor: '#ffffff',
    secondaryColor: '#ffd700',
    message: 'May Lord Ram bless you with wisdom, courage, and righteousness',
    decorEmojis: ['🙏', '🏹', '🪷', '✨']
  },
  {
    id: 'hanuman-jayanti',
    name: 'Hanuman Jayanti',
    emoji: '🙏',
    category: 'regional',
    gradient: 'linear-gradient(135deg, #ff3d00 0%, #ff6e40 30%, #ff9e80 60%, #ffccbc 100%)',
    primaryColor: '#ffffff',
    secondaryColor: '#ffd700',
    message: 'May Lord Hanuman bless you with strength, devotion, and fearlessness',
    decorEmojis: ['🙏', '💪', '🚩', '✨']
  },
  {
    id: 'maharashtra-day',
    name: 'Maharashtra Day',
    emoji: '🏛️',
    category: 'regional',
    gradient: 'linear-gradient(135deg, #ff6f00 0%, #ff8f00 30%, #ffa000 60%, #ffca28 100%)',
    primaryColor: '#1a237e',
    secondaryColor: '#ffffff',
    message: 'Celebrating the pride, culture, and spirit of Maharashtra',
    decorEmojis: ['🏛️', '🚩', '⭐', '✨']
  },
  {
    id: 'buddha-purnima',
    name: 'Buddha Purnima',
    emoji: '🧘',
    category: 'regional',
    gradient: 'linear-gradient(135deg, #1565c0 0%, #42a5f5 30%, #90caf9 60%, #e3f2fd 100%)',
    primaryColor: '#ffd700',
    secondaryColor: '#ffffff',
    message: 'May the wisdom of Lord Buddha guide you on the path of peace and enlightenment',
    decorEmojis: ['🧘', '🪷', '☸️', '✨']
  },
  {
    id: 'ambedkar-jayanti',
    name: 'Ambedkar Jayanti',
    emoji: '📘',
    category: 'regional',
    gradient: 'linear-gradient(135deg, #1565c0 0%, #1976d2 30%, #1e88e5 60%, #42a5f5 100%)',
    primaryColor: '#ffffff',
    secondaryColor: '#ffd700',
    message: 'Honoring the architect of our constitution and champion of equality and justice',
    decorEmojis: ['📘', '⚖️', '🇮🇳', '✨']
  },
  {
    id: 'gandhi-jayanti',
    name: 'Gandhi Jayanti',
    emoji: '🕊️',
    category: 'major',
    gradient: 'linear-gradient(135deg, #e8eaf6 0%, #c5cae9 30%, #9fa8da 60%, #7986cb 100%)',
    primaryColor: '#1a237e',
    secondaryColor: '#4a148c',
    message: 'Be the change you wish to see in the world - honoring the Father of our Nation',
    decorEmojis: ['🕊️', '🙏', '🇮🇳', '✨']
  },
  {
    id: 'teachers-day',
    name: "Teachers' Day",
    emoji: '📚',
    category: 'regional',
    gradient: 'linear-gradient(135deg, #4a148c 0%, #6a1b9a 30%, #7b1fa2 60%, #9c27b0 100%)',
    primaryColor: '#ffd700',
    secondaryColor: '#ffffff',
    message: 'Honoring the mentors who shape minds, inspire dreams, and build futures',
    decorEmojis: ['📚', '🎓', '🍎', '✨']
  },
  {
    id: 'childrens-day',
    name: "Children's Day",
    emoji: '🧒',
    category: 'regional',
    gradient: 'linear-gradient(135deg, #00bcd4 0%, #26c6da 30%, #4dd0e1 60%, #80deea 100%)',
    primaryColor: '#ffffff',
    secondaryColor: '#ffeb3b',
    message: 'Celebrating the joy, innocence, and endless possibilities of every child',
    decorEmojis: ['🧒', '🎈', '🌈', '⭐']
  }
];

export default function FestivalGreetingPreview() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFestival, setSelectedFestival] = useState<FestivalTemplate>(festivals[0]);
  const [agentInfo, setAgentInfo] = useState<AgentInfo>({
    name: '',
    email: '',
    phone: '',
    designation: '',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<AgentInfo>({
    name: '',
    email: '',
    phone: '',
    designation: '',
  });
  const templateRef = useRef<HTMLDivElement>(null);

  // Fetch marketing profile from backend
  const { data: marketingProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['/api/agent/marketing-profile'],
  });

  // Save marketing profile mutation
  const saveProfileMutation = useMutation({
    mutationFn: async (data: AgentInfo) => {
      return apiRequest('/api/agent/marketing-profile', {
        method: 'POST',
        body: JSON.stringify({
          marketingName: data.name,
          marketingDesignation: data.designation,
          marketingEmail: data.email,
          marketingPhone: data.phone,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agent/marketing-profile'] });
      toast({
        title: 'Profile Saved',
        description: 'Your marketing profile has been saved successfully.',
      });
      setIsEditing(false);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to save marketing profile. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Load profile data
  useEffect(() => {
    if (marketingProfile && typeof marketingProfile === 'object') {
      const profile = marketingProfile as any;
      const info: AgentInfo = {
        name: profile.marketingName || profile.fullName || '',
        designation: profile.marketingDesignation || 'Financial Advisor',
        email: profile.marketingEmail || profile.email || '',
        phone: profile.marketingPhone || profile.phone || '',
      };
      setAgentInfo(info);
      setEditForm(info);
    }
  }, [marketingProfile]);

  const handleSaveProfile = () => {
    saveProfileMutation.mutate(editForm);
  };

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
      link.download = `${selectedFestival.id}-greeting.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      toast({
        title: 'Downloaded!',
        description: `${selectedFestival.name} greeting saved as PNG.`,
      });
    } catch (error) {
      console.error('Error generating image:', error);
      toast({
        title: 'Download Failed',
        description: 'Failed to generate image. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleShare = async () => {
    if (!templateRef.current) return;
    
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(templateRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
      });
      
      // Convert to blob for sharing
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        
        // Check if Web Share API is available
        if (navigator.share && navigator.canShare) {
          const file = new File([blob], `${selectedFestival.id}-greeting.png`, { type: 'image/png' });
          try {
            await navigator.share({
              files: [file],
              title: `Happy ${selectedFestival.name}!`,
              text: selectedFestival.message,
            });
          } catch (shareError) {
            // Fallback to WhatsApp direct link
            const url = encodeURIComponent(`Happy ${selectedFestival.name}! ${selectedFestival.message}`);
            window.open(`https://wa.me/?text=${url}`, '_blank');
          }
        } else {
          // Fallback for desktop
          const url = encodeURIComponent(`Happy ${selectedFestival.name}! ${selectedFestival.message} - ${agentInfo.name}, ${agentInfo.designation}`);
          window.open(`https://wa.me/?text=${url}`, '_blank');
        }
      }, 'image/png');
      
      toast({
        title: 'Share',
        description: 'Opening share dialog...',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const majorFestivals = festivals.filter(f => f.category === 'major');
  const regionalFestivals = festivals.filter(f => f.category === 'regional');

  // Marketing state
  const [activeTab, setActiveTab] = useState<'create' | 'marketing'>('create');
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [marketingChannel, setMarketingChannel] = useState<'email' | 'whatsapp'>('email');

  // Fetch assigned clients
  const { data: assignedClients = [], isLoading: isLoadingClients } = useQuery({
    queryKey: ['/api/agent/marketing/clients'],
  });

  // Send greetings mutation
  const sendGreetingsMutation = useMutation({
    mutationFn: async (data: { festivalId: string; clientIds: string[]; channel: string }) => {
      return apiRequest('/api/agent/marketing/send-greetings', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Greetings Sent!',
        description: `Festival greetings sent to ${data.sentCount || selectedClients.length} clients.`,
      });
      setSelectedClients([]);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to send greetings. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleSendToClients = () => {
    if (selectedClients.length === 0) {
      toast({
        title: 'Select Clients',
        description: 'Please select at least one client to send greetings.',
        variant: 'destructive',
      });
      return;
    }
    sendGreetingsMutation.mutate({
      festivalId: selectedFestival.id,
      clientIds: selectedClients,
      channel: marketingChannel,
    });
  };

  const toggleClientSelection = (clientId: string) => {
    setSelectedClients(prev => 
      prev.includes(clientId) 
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const selectAllClients = () => {
    const clients = assignedClients as any[];
    if (selectedClients.length === clients.length) {
      setSelectedClients([]);
    } else {
      setSelectedClients(clients.map((c: any) => c.id));
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-yellow-500" />
              Festival Greeting Templates
            </h1>
            <p className="text-muted-foreground">
              Create personalized festival greetings for your clients with 17+ beautiful templates
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={activeTab === 'create' ? 'default' : 'outline'}
              onClick={() => setActiveTab('create')}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Create Greeting
            </Button>
            <Button
              variant={activeTab === 'marketing' ? 'default' : 'outline'}
              onClick={() => setActiveTab('marketing')}
            >
              <Users className="h-4 w-4 mr-2" />
              Share with Clients
            </Button>
          </div>
        </div>
      </div>

      {activeTab === 'marketing' ? (
        /* Marketing Tab Content */
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Panel - Client Selection */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Select Clients</CardTitle>
                    <CardDescription>Choose clients to send {selectedFestival.name} greetings</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={selectAllClients}>
                    {selectedClients.length === (assignedClients as any[]).length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingClients ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (assignedClients as any[]).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No clients assigned to you yet</p>
                    <p className="text-sm">Clients will appear here once assigned by admin</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {(assignedClients as any[]).map((client: any) => (
                        <div 
                          key={client.id}
                          className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${
                            selectedClients.includes(client.id) ? 'bg-muted border-primary' : ''
                          }`}
                          onClick={() => toggleClientSelection(client.id)}
                        >
                          <Checkbox 
                            checked={selectedClients.includes(client.id)}
                            onCheckedChange={() => toggleClientSelection(client.id)}
                          />
                          <div className="flex-1">
                            <p className="font-medium">{client.name}</p>
                            <div className="flex gap-4 text-sm text-muted-foreground">
                              {client.email && <span>📧 {client.email}</span>}
                              {client.phone && <span>📞 {client.phone}</span>}
                            </div>
                          </div>
                          <Badge variant="secondary">{client.status}</Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Send Options */}
          <div className="space-y-4">
            {/* Selected Festival Preview */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Selected Festival</CardTitle>
              </CardHeader>
              <CardContent>
                <div 
                  className="h-24 rounded-lg flex items-center justify-center"
                  style={{ background: selectedFestival.gradient }}
                >
                  <span className="text-4xl">{selectedFestival.emoji}</span>
                </div>
                <p className="font-medium text-center mt-2">{selectedFestival.name}</p>
              </CardContent>
            </Card>

            {/* Delivery Channel */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Delivery Channel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant={marketingChannel === 'email' ? 'default' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => setMarketingChannel('email')}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </Button>
                <Button
                  variant={marketingChannel === 'whatsapp' ? 'default' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => setMarketingChannel('whatsapp')}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  WhatsApp
                </Button>
              </CardContent>
            </Card>

            {/* Send Button */}
            <Card>
              <CardContent className="pt-6">
                <div className="text-center mb-4">
                  <p className="text-2xl font-bold">{selectedClients.length}</p>
                  <p className="text-muted-foreground">clients selected</p>
                </div>
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handleSendToClients}
                  disabled={selectedClients.length === 0 || sendGreetingsMutation.isPending}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {sendGreetingsMutation.isPending ? 'Sending...' : 'Send Greetings'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
      /* Create Tab Content */
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Panel - Agent Profile & Customization */}
        <div className="space-y-4">
          {/* Marketing Profile Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Your Marketing Profile
                </CardTitle>
                {!isEditing ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditForm(agentInfo);
                      setIsEditing(true);
                    }}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                ) : (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditing(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSaveProfile}
                      disabled={saveProfileMutation.isPending}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <CardDescription>
                This info appears on your greeting cards
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isEditing ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Display Name</Label>
                    <Input
                      id="edit-name"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      placeholder="Your full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-designation">Designation</Label>
                    <Input
                      id="edit-designation"
                      value={editForm.designation}
                      onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                      placeholder="e.g., Senior Financial Advisor"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-email">Email</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      placeholder="your.email@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-phone">Phone</Label>
                    <Input
                      id="edit-phone"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                    />
                  </div>
                  <Button 
                    className="w-full mt-2" 
                    onClick={handleSaveProfile}
                    disabled={saveProfileMutation.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saveProfileMutation.isPending ? 'Saving...' : 'Save Profile'}
                  </Button>
                </>
              ) : (
                <div className="space-y-2 text-sm">
                  {isLoadingProfile ? (
                    <div className="animate-pulse space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4"></div>
                      <div className="h-4 bg-muted rounded w-1/2"></div>
                      <div className="h-4 bg-muted rounded w-full"></div>
                      <div className="h-4 bg-muted rounded w-2/3"></div>
                    </div>
                  ) : agentInfo.name ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Name:</span>
                        <span className="font-medium">{agentInfo.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Designation:</span>
                        <span className="font-medium">{agentInfo.designation}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Email:</span>
                        <span className="font-medium text-xs">{agentInfo.email}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Phone:</span>
                        <span className="font-medium">{agentInfo.phone}</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground mb-2">No profile set</p>
                      <Button
                        size="sm"
                        onClick={() => setIsEditing(true)}
                      >
                        <Edit2 className="h-4 w-4 mr-2" />
                        Set Up Profile
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Live Preview Customization */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Quick Edit (Live Preview)</CardTitle>
              <CardDescription>
                Edit directly - changes update preview instantly
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={agentInfo.name}
                  onChange={(e) => setAgentInfo({ ...agentInfo, name: e.target.value })}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="designation">Designation</Label>
                <Input
                  id="designation"
                  value={agentInfo.designation}
                  onChange={(e) => setAgentInfo({ ...agentInfo, designation: e.target.value })}
                  placeholder="Your designation"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={agentInfo.email}
                  onChange={(e) => setAgentInfo({ ...agentInfo, email: e.target.value })}
                  placeholder="Your email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={agentInfo.phone}
                  onChange={(e) => setAgentInfo({ ...agentInfo, phone: e.target.value })}
                  placeholder="Your phone"
                />
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button onClick={handleDownload} className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Download PNG
            </Button>
            <Button variant="outline" onClick={handleShare} className="flex-1">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>
        </div>

        {/* Center Panel - Template Preview */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Preview - {selectedFestival.name}</CardTitle>
                <Badge variant="secondary">{selectedFestival.category}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div
                ref={templateRef}
                className="relative overflow-hidden rounded-xl shadow-2xl mx-auto"
                style={{
                  width: '100%',
                  maxWidth: '500px',
                  aspectRatio: '1/1',
                  background: selectedFestival.gradient,
                }}
              >
                {/* Decorative Elements */}
                <div className="absolute inset-0">
                  {selectedFestival.decorEmojis.map((emoji, idx) => (
                    <div
                      key={idx}
                      className="absolute animate-pulse"
                      style={{
                        top: `${10 + (idx * 20)}%`,
                        left: idx % 2 === 0 ? '5%' : '85%',
                        fontSize: idx === 0 ? '2.5rem' : '2rem',
                        animationDelay: `${idx * 0.3}s`,
                      }}
                    >
                      {emoji}
                    </div>
                  ))}
                  
                  {/* Decorative circle pattern */}
                  <div 
                    className="absolute bottom-24 left-1/2 transform -translate-x-1/2 opacity-20"
                    style={{ borderColor: selectedFestival.primaryColor }}
                  >
                    <div 
                      className="w-48 h-48 rounded-full border-4"
                      style={{ borderColor: selectedFestival.primaryColor }}
                    ></div>
                  </div>
                </div>

                {/* Main Content */}
                <div className="relative z-10 h-full flex flex-col items-center justify-center p-6 text-center">
                  {/* Festival Name */}
                  <div className="mb-2">
                    <span 
                      className="text-lg font-medium tracking-widest uppercase"
                      style={{ color: selectedFestival.primaryColor }}
                    >
                      Happy
                    </span>
                  </div>
                  
                  {/* Main Title */}
                  <h1 
                    className="text-5xl md:text-6xl font-bold mb-3"
                    style={{
                      background: `linear-gradient(180deg, ${selectedFestival.primaryColor} 0%, ${selectedFestival.secondaryColor} 100%)`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      textShadow: `0 0 30px ${selectedFestival.primaryColor}50`,
                      fontFamily: 'Georgia, serif',
                    }}
                  >
                    {selectedFestival.name.toUpperCase()}
                  </h1>

                  {/* Decorative Line */}
                  <div className="flex items-center gap-3 mb-4">
                    <div 
                      className="h-px w-12"
                      style={{ background: `linear-gradient(to right, transparent, ${selectedFestival.primaryColor})` }}
                    ></div>
                    <span className="text-2xl">{selectedFestival.emoji}</span>
                    <div 
                      className="h-px w-12"
                      style={{ background: `linear-gradient(to left, transparent, ${selectedFestival.primaryColor})` }}
                    ></div>
                  </div>

                  {/* Blessing Message */}
                  <p 
                    className="text-sm md:text-base mb-6 max-w-xs font-light italic opacity-90"
                    style={{ color: selectedFestival.secondaryColor === '#ffffff' ? '#ffffff' : `${selectedFestival.primaryColor}ee` }}
                  >
                    "{selectedFestival.message}"
                  </p>

                  {/* Agent Info Card */}
                  <div 
                    className="mt-auto w-full max-w-xs rounded-lg p-4"
                    style={{
                      background: `linear-gradient(135deg, ${selectedFestival.primaryColor}20 0%, ${selectedFestival.secondaryColor}15 100%)`,
                      backdropFilter: 'blur(10px)',
                      border: `1px solid ${selectedFestival.primaryColor}40`,
                    }}
                  >
                    <div className="text-foreground font-semibold text-lg mb-1">
                      {agentInfo.name || 'Your Name'}
                    </div>
                    <div 
                      className="text-xs mb-2 opacity-80"
                      style={{ color: selectedFestival.primaryColor }}
                    >
                      {agentInfo.designation || 'Financial Advisor'}
                    </div>
                    <div className="text-xs space-y-0.5 opacity-70" style={{ color: '#ffffff' }}>
                      <div>📧 {agentInfo.email || 'email@example.com'}</div>
                      <div>📞 {agentInfo.phone || '+91 XXXXX XXXXX'}</div>
                    </div>
                    
                    {/* Logo at bottom corner */}
                    <div className="absolute bottom-3 right-3 opacity-80">
                      <img 
                        src="/icon-192.png" 
                        alt="FintekPro" 
                        className="w-8 h-8 rounded"
                        style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.3))' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Festival Selection Tabs */}
          <div className="mt-6">
            <Tabs defaultValue="major" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="major">Major Festivals ({majorFestivals.length})</TabsTrigger>
                <TabsTrigger value="regional">Regional Festivals ({regionalFestivals.length})</TabsTrigger>
              </TabsList>
              
              <TabsContent value="major" className="mt-4">
                <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                  {majorFestivals.map((festival) => (
                    <Card 
                      key={festival.id}
                      className={`cursor-pointer transition-all hover:scale-105 overflow-hidden ${
                        selectedFestival.id === festival.id ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => setSelectedFestival(festival)}
                    >
                      <div 
                        className="h-16 flex items-center justify-center"
                        style={{ background: festival.gradient }}
                      >
                        <span className="text-3xl">{festival.emoji}</span>
                      </div>
                      <CardContent className="p-2 text-center">
                        <span className="text-xs font-medium">{festival.name}</span>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="regional" className="mt-4">
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                  {regionalFestivals.map((festival) => (
                    <Card 
                      key={festival.id}
                      className={`cursor-pointer transition-all hover:scale-105 overflow-hidden ${
                        selectedFestival.id === festival.id ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => setSelectedFestival(festival)}
                    >
                      <div 
                        className="h-16 flex items-center justify-center"
                        style={{ background: festival.gradient }}
                      >
                        <span className="text-3xl">{festival.emoji}</span>
                      </div>
                      <CardContent className="p-2 text-center">
                        <span className="text-xs font-medium">{festival.name}</span>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
