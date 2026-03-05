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
import { Download, Share2, Sparkles, Save, User, Edit2, Check, X, Send, Users, Mail, MessageSquare, UserPlus, Search, Clock, CalendarDays, Pencil, AlertTriangle } from 'lucide-react';
import { Link } from 'wouter';
import { format, differenceInCalendarDays } from 'date-fns';
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
    gradient: 'linear-gradient(135deg, #2b0f54 0%, #4a1680 35%, #5c1e8c 65%, #7b2fbe 100%)',
    primaryColor: '#ffd700',
    secondaryColor: '#ff8c00',
    message: 'Wishing you and your family a Diwali filled with prosperity, happiness, and financial success',
    decorEmojis: ['🪔', '✨', '⭐', '🎇']
  },
  {
    id: 'holi',
    name: 'Holi',
    emoji: '🎨',
    category: 'major',
    gradient: 'linear-gradient(135deg, #c0392b 0%, #e74c3c 20%, #e91e8c 45%, #7b1fa2 70%, #1565c0 100%)',
    primaryColor: '#ffffff',
    secondaryColor: '#ffeb3b',
    message: 'May your portfolio — like Holi — be rich in color, balanced in mix, and vibrant with returns',
    decorEmojis: ['🎨', '🌈', '💜', '💛']
  },
  {
    id: 'eid',
    name: 'Eid',
    emoji: '🌙',
    category: 'major',
    gradient: 'linear-gradient(135deg, #003d2e 0%, #00574b 40%, #007a68 75%, #009688 100%)',
    primaryColor: '#ffd700',
    secondaryColor: '#c0ca33',
    message: 'Wishing you and your family a blessed Eid filled with peace, prosperity, and sound investments',
    decorEmojis: ['🌙', '⭐', '🕌', '✨']
  },
  {
    id: 'christmas',
    name: 'Christmas',
    emoji: '🎄',
    category: 'major',
    gradient: 'linear-gradient(135deg, #880e0e 0%, #b71c1c 40%, #1a3d1a 75%, #2e7d32 100%)',
    primaryColor: '#ffd700',
    secondaryColor: '#ffffff',
    message: 'Wishing you a season of joy, peace, and the gift of lasting financial wellbeing',
    decorEmojis: ['🎄', '🎅', '⭐', '🎁']
  },
  {
    id: 'ganesh-chaturthi',
    name: 'Ganesh Chaturthi',
    emoji: '🐘',
    category: 'major',
    gradient: 'linear-gradient(135deg, #bf360c 0%, #e64a19 40%, #ff7043 70%, #ffab40 100%)',
    primaryColor: '#ffffff',
    secondaryColor: '#ffeb3b',
    message: 'May Lord Ganesha remove every obstacle on your path to wealth, wisdom, and wellbeing',
    decorEmojis: ['🐘', '🪷', '🙏', '✨']
  },
  {
    id: 'durga-puja',
    name: 'Durga Puja',
    emoji: '🪷',
    category: 'major',
    gradient: 'linear-gradient(135deg, #b71c1c 0%, #c62828 35%, #e65100 65%, #ff8f00 100%)',
    primaryColor: '#ffffff',
    secondaryColor: '#ffd700',
    message: 'May Goddess Durga bless you with the strength to build lasting wealth and the courage to invest wisely',
    decorEmojis: ['🪷', '🙏', '✨', '🔔']
  },
  {
    id: 'onam',
    name: 'Onam',
    emoji: '🌸',
    category: 'major',
    gradient: 'linear-gradient(135deg, #e65100 0%, #f57c00 45%, #ff9800 75%, #ffc107 100%)',
    primaryColor: '#ffffff',
    secondaryColor: '#4caf50',
    message: 'May this Onam harvest a life of health, happiness, and flourishing financial growth',
    decorEmojis: ['🌸', '🌺', '🛶', '🌾']
  },
  {
    id: 'pongal',
    name: 'Pongal',
    emoji: '🌾',
    category: 'major',
    gradient: 'linear-gradient(135deg, #bf360c 0%, #d84315 45%, #f4511e 75%, #ff7043 100%)',
    primaryColor: '#ffffff',
    secondaryColor: '#ffeb3b',
    message: 'May this Pongal bring an abundant harvest of health, happiness, and growing wealth',
    decorEmojis: ['🌾', '☀️', '🐂', '🍚']
  },
  {
    id: 'new-year',
    name: 'New Year',
    emoji: '🎆',
    category: 'major',
    gradient: 'linear-gradient(135deg, #0a1172 0%, #1a237e 35%, #283593 65%, #3949ab 100%)',
    primaryColor: '#ffd700',
    secondaryColor: '#ffffff',
    message: 'May the new year bring compounding growth in your wealth, health, and happiness',
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
    message: 'May this Ugadi open a new chapter of opportunity, growth, and financial abundance',
    decorEmojis: ['🌿', '🥭', '🌺', '✨']
  },
  {
    id: 'vishu',
    name: 'Vishu',
    emoji: '🌻',
    category: 'regional',
    gradient: 'linear-gradient(135deg, #e65100 0%, #f9a825 50%, #ffeb3b 100%)',
    primaryColor: '#1a237e',
    secondaryColor: '#ffffff',
    message: 'May Vishu bring you the golden fortune of good health, happiness, and a thriving portfolio',
    decorEmojis: ['🌻', '🪔', '🌾', '✨']
  },
  {
    id: 'bihu',
    name: 'Bihu',
    emoji: '🎋',
    category: 'regional',
    gradient: 'linear-gradient(135deg, #1b5e20 0%, #388e3c 40%, #f9a825 100%)',
    primaryColor: '#ffffff',
    secondaryColor: '#ffeb3b',
    message: 'May Bihu bring you the joy of new beginnings and a harvest of financial prosperity',
    decorEmojis: ['🎋', '🌾', '💃', '🪘']
  },
  {
    id: 'baisakhi',
    name: 'Baisakhi',
    emoji: '🌾',
    category: 'regional',
    gradient: 'linear-gradient(135deg, #e65100 0%, #ff8f00 50%, #ffa000 100%)',
    primaryColor: '#ffffff',
    secondaryColor: '#4caf50',
    message: 'May the spirit of Baisakhi bring an abundant harvest of joy, good health, and growing wealth',
    decorEmojis: ['🌾', '💫', '🙏', '☀️']
  },
  {
    id: 'lohri',
    name: 'Lohri',
    emoji: '🔥',
    category: 'regional',
    gradient: 'linear-gradient(135deg, #7f1800 0%, #bf360c 40%, #e64a19 75%, #ff7043 100%)',
    primaryColor: '#ffd700',
    secondaryColor: '#ffffff',
    message: 'May the warmth of the Lohri bonfire kindle lasting prosperity and happiness in your life',
    decorEmojis: ['🔥', '🥜', '🎉', '✨']
  },
  {
    id: 'makar-sankranti',
    name: 'Makar Sankranti',
    emoji: '🪁',
    category: 'regional',
    gradient: 'linear-gradient(135deg, #01579b 0%, #0288d1 50%, #4fc3f7 100%)',
    primaryColor: '#ffeb3b',
    secondaryColor: '#ffffff',
    message: 'May your financial goals soar as high and free as the kites this Makar Sankranti',
    decorEmojis: ['🪁', '☀️', '🌾', '✨']
  },
  {
    id: 'raksha-bandhan',
    name: 'Raksha Bandhan',
    emoji: '🎀',
    category: 'regional',
    gradient: 'linear-gradient(135deg, #880e4f 0%, #c2185b 45%, #e91e63 75%, #f48fb1 100%)',
    primaryColor: '#ffffff',
    secondaryColor: '#ffd700',
    message: 'Celebrating the timeless bond of trust, care, and the promise of a secure financial future',
    decorEmojis: ['🎀', '💝', '🤝', '✨']
  },
  {
    id: 'navratri',
    name: 'Navratri',
    emoji: '🙏',
    category: 'regional',
    gradient: 'linear-gradient(135deg, #7b1fa2 0%, #c62828 35%, #ff8a65 70%, #ffcc80 100%)',
    primaryColor: '#ffffff',
    secondaryColor: '#ffd700',
    message: 'May the divine energy of Navratri fill your life with strength, success, and lasting prosperity',
    decorEmojis: ['🙏', '💃', '🔔', '✨']
  },
  {
    id: 'maha-shivaratri',
    name: 'Maha Shivaratri',
    emoji: '🔱',
    category: 'major',
    gradient: 'linear-gradient(135deg, #0d1b6e 0%, #1a237e 35%, #3949ab 65%, #5c6bc0 100%)',
    primaryColor: '#e0e0e0',
    secondaryColor: '#b0bec5',
    message: 'May Lord Shiva bless you with inner peace, clarity of thought, and the wisdom to build lasting wealth',
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
  const templateRef   = useRef<HTMLDivElement>(null);
  const textBlockRef  = useRef<HTMLDivElement>(null);

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

  // Load Playfair Display for premium typography
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&display=swap';
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  const handleSaveProfile = () => {
    saveProfileMutation.mutate(editForm);
  };

  const captureGreetingCanvas = async () => {
    const el = templateRef.current!;
    const html2canvas = (await import('html2canvas')).default;

    const TARGET   = 1200;
    const naturalW = el.offsetWidth;
    const naturalH = el.offsetHeight;
    const scale    = Math.max(1, Math.round(TARGET / naturalW));

    // ── Snapshot text-block rect BEFORE html2canvas clones the DOM ───────
    const textBlockEl = textBlockRef.current;
    let tbRect: { x: number; y: number; w: number } | null = null;
    if (textBlockEl) {
      const cardR = el.getBoundingClientRect();
      const tbR   = textBlockEl.getBoundingClientRect();
      tbRect = {
        x: tbR.left - cardR.left,
        y: tbR.top  - cardR.top,
        w: tbR.width,
      };
    }

    // ── Step 1: render with html2canvas (text block hidden) ─────────────
    const rawCanvas = await html2canvas(el, {
      scale,
      useCORS:         true,
      allowTaint:      true,
      backgroundColor: null,
      logging:         false,
      letterRendering: true,
      onclone: (_doc, clonedEl) => {
        clonedEl.style.width     = `${naturalW}px`;
        clonedEl.style.height    = `${naturalH}px`;
        clonedEl.style.maxWidth  = 'none';
        clonedEl.style.aspectRatio = 'auto';
        clonedEl.style.overflow  = 'hidden';

        const textBlock = clonedEl.querySelector<HTMLElement>('#agent-text-block');
        if (textBlock) textBlock.style.visibility = 'hidden';

        clonedEl.querySelectorAll<HTMLElement>('*').forEach((node) => {
          const s = node.style;
          s.backdropFilter = 'none';
          (s as any).webkitBackdropFilter = 'none';
          s.animation     = 'none';
          s.animationDelay = '0s';
          s.transition    = 'none';
          s.transform     = 'none';
          if (s.borderColor && /^#[0-9a-f]{8}$/i.test(s.borderColor)) {
            const h  = s.borderColor;
            const r2 = parseInt(h.slice(1, 3), 16);
            const g2 = parseInt(h.slice(3, 5), 16);
            const b2 = parseInt(h.slice(5, 7), 16);
            const a2 = (parseInt(h.slice(7, 9), 16) / 255).toFixed(2);
            s.borderColor = `rgba(${r2},${g2},${b2},${a2})`;
          }
        });
      },
    });

    // ── Step 2: copy rawCanvas → FRESH canvas with a pristine 2D context ─
    // html2canvas may leave transforms / clips / compositing ops on its own
    // context. A fresh canvas is guaranteed to start in the identity state so
    // our text drawing is never suppressed.
    const canvas    = document.createElement('canvas');
    canvas.width    = rawCanvas.width;
    canvas.height   = rawCanvas.height;
    const ctx       = canvas.getContext('2d')!;  // fresh — no html2canvas residue

    ctx.drawImage(rawCanvas, 0, 0);              // blit the full rendered image

    // ── Step 3: overdraw agent text at measured CSS-pixel coordinates ─────
    if (tbRect) {
      // All measurements in raw canvas pixels = CSS px × scale
      const cx    = tbRect.x * scale;
      const cy    = tbRect.y * scale;
      const maxW  = tbRect.w * scale;

      const NAME_H = 20 * scale;
      const DES_H  = 16 * scale;
      const CON_H  = 14 * scale;
      const GAP    =  8 * scale;

      ctx.textBaseline = 'top';

      if (agentInfo.name) {
        ctx.font      = `bold ${14 * scale}px Inter, system-ui, -apple-system, sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(agentInfo.name, cx, cy, maxW);
      }

      if (agentInfo.designation) {
        ctx.font      = `600 ${11 * scale}px Inter, system-ui, -apple-system, sans-serif`;
        ctx.fillStyle = '#FFD700';
        ctx.fillText(agentInfo.designation, cx, cy + NAME_H + GAP, maxW);
      }

      if (agentInfo.email) {
        ctx.font      = `${10 * scale}px Inter, system-ui, -apple-system, sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.82)';
        ctx.fillText(`✉  ${agentInfo.email}`, cx, cy + NAME_H + GAP + DES_H + GAP, maxW);
      }

      if (agentInfo.phone) {
        ctx.font      = `${10 * scale}px Inter, system-ui, -apple-system, sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.82)';
        ctx.fillText(`☎  ${agentInfo.phone}`, cx, cy + NAME_H + GAP + DES_H + GAP + CON_H + GAP, maxW);
      }
    }

    return canvas;
  };

  const handleDownload = async () => {
    if (!templateRef.current) return;
    
    try {
      const canvas = await captureGreetingCanvas();
      
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
      const canvas = await captureGreetingCanvas();
      
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

  // ── Upcoming festivals constant ────────────────────────────────────────────
  const FESTIVAL_DATES = [
    { id: 'holi',            emoji: '🎨', name: 'Holi',              date: new Date(2026, 2, 14) },
    { id: 'eid',             emoji: '🌙', name: 'Eid',               date: new Date(2026, 2, 31) },
    { id: 'ram-navami',      emoji: '🪔', name: 'Ram Navami',         date: new Date(2026, 3, 6)  },
    { id: 'buddha-purnima',  emoji: '☸️', name: 'Buddha Purnima',     date: new Date(2026, 4, 12) },
    { id: 'eid-ul-adha',     emoji: '🌙', name: 'Eid-ul-Adha',        date: new Date(2026, 5, 7)  },
    { id: 'independence-day',emoji: '🇮🇳', name: 'Independence Day',   date: new Date(2026, 7, 15) },
    { id: 'diwali',          emoji: '🪔', name: 'Diwali',             date: new Date(2026, 9, 20) },
    { id: 'christmas',       emoji: '🎄', name: 'Christmas',          date: new Date(2026, 11, 25)},
    { id: 'new-year',        emoji: '🎆', name: 'New Year 2027',      date: new Date(2027, 0, 1)  },
  ];
  const today = new Date();
  const upcomingFestivals = FESTIVAL_DATES
    .map(f => ({ ...f, daysUntil: differenceInCalendarDays(f.date, today) }))
    .filter(f => f.daysUntil >= 0)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 3);

  // ── Marketing state ────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'create' | 'marketing' | 'history'>('create');
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [marketingChannel, setMarketingChannel] = useState<'email' | 'whatsapp'>('email');
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'client' | 'prospect'>('all');
  const [hideUnreachable, setHideUnreachable] = useState(true);
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [editingEmailValue, setEditingEmailValue] = useState('');

  // Fetch assigned clients
  const { data: assignedClients = [], isLoading: isLoadingClients } = useQuery({
    queryKey: ['/api/agent/marketing/clients'],
    select: (data) => Array.isArray(data) ? data : [],
  });

  // Fetch greeting history (T004)
  const { data: greetingHistory = [], isLoading: isLoadingHistory } = useQuery({
    queryKey: ['/api/agent/marketing/greeting-history'],
    enabled: activeTab === 'history',
    select: (data) => Array.isArray(data) ? data : [],
  });

  // Email update mutation (T003)
  const updateEmailMutation = useMutation({
    mutationFn: async ({ id, email, source }: { id: string; email: string; source: string }) => {
      return apiRequest(`/api/agent/marketing/contacts/${id}/email`, {
        method: 'PATCH',
        body: JSON.stringify({ email, source }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agent/marketing/clients'] });
      setEditingEmailId(null);
      setEditingEmailValue('');
      toast({ title: 'Email saved', description: 'Contact email updated successfully.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save email.', variant: 'destructive' });
    },
  });

  // Helpers for channel-aware reachability
  const isMaskedPhone = (ph: string | null | undefined) => !ph || ph.startsWith('+XXXX');
  const isReachable = (c: any) => {
    if (marketingChannel === 'email') return !!c.email;
    return !isMaskedPhone(c.phone);
  };

  // Filtered & deduplicated contacts list
  const allClients = assignedClients as any[];
  const filteredClients = allClients.filter(c => {
    const matchesSearch = !searchQuery || c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSource = sourceFilter === 'all' || c.source === sourceFilter;
    const matchesReachable = !hideUnreachable || isReachable(c);
    return matchesSearch && matchesSource && matchesReachable;
  });

  // Send greetings mutation
  const [greetingImageUploading, setGreetingImageUploading] = useState(false);

  const sendGreetingsMutation = useMutation({
    mutationFn: async (data: { festivalId: string; clientIds: string[]; channel: string; imageUrl?: string }) => {
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
      queryClient.invalidateQueries({ queryKey: ['/api/agent/marketing/greeting-history'] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to send greetings. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleSendToClients = async () => {
    if (selectedClients.length === 0) {
      toast({
        title: 'Select Clients',
        description: 'Please select at least one client to send greetings.',
        variant: 'destructive',
      });
      return;
    }

    let imageUrl: string | undefined;

    // For WhatsApp, capture and upload the greeting card image
    if (marketingChannel === 'whatsapp' && templateRef.current) {
      try {
        setGreetingImageUploading(true);
        const canvas = await captureGreetingCanvas();
        const imageBase64 = canvas.toDataURL('image/png');
        const uploadRes = await apiRequest('/api/agent/marketing/upload-greeting-image', {
          method: 'POST',
          body: JSON.stringify({ imageBase64, festivalId: selectedFestival.id }),
          headers: { 'Content-Type': 'application/json' },
        });
        imageUrl = (uploadRes as any)?.url;
      } catch (err) {
        console.warn('Greeting image upload failed, sending without image:', err);
      } finally {
        setGreetingImageUploading(false);
      }
    }

    sendGreetingsMutation.mutate({
      festivalId: selectedFestival.id,
      clientIds: selectedClients,
      channel: marketingChannel,
      imageUrl,
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
    const reachableIds = filteredClients.filter(isReachable).map((c: any) => c.id);
    const allSelected = reachableIds.every(id => selectedClients.includes(id));
    if (allSelected && reachableIds.length > 0) {
      setSelectedClients(prev => prev.filter(id => !reachableIds.includes(id)));
    } else {
      setSelectedClients(prev => Array.from(new Set([...prev, ...reachableIds])));
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
            <Button
              variant={activeTab === 'history' ? 'default' : 'outline'}
              onClick={() => setActiveTab('history')}
            >
              <Clock className="h-4 w-4 mr-2" />
              History
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
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Select Clients & Prospects
                    </CardTitle>
                    <CardDescription>
                      Send {selectedFestival.name} greetings to your clients and prospects
                      {allClients.length > 0 && (
                        <span className="ml-1 text-primary font-medium">
                          ({allClients.length} contacts)
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link href="/agent/leads">
                      <Button variant="outline" size="sm">
                        <UserPlus className="h-4 w-4 mr-1" />
                        Add Prospect
                      </Button>
                    </Link>
                    {filteredClients.filter(isReachable).length > 0 && (
                      <Button variant="outline" size="sm" onClick={selectAllClients}>
                        {filteredClients.filter(isReachable).every(c => selectedClients.includes(c.id))
                          ? 'Deselect All' : 'Select All'}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Search + source filter row */}
                {allClients.length > 0 && (
                  <div className="flex gap-2 mt-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search by name or email…"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div className="flex rounded-md border overflow-hidden">
                      {(['all', 'prospect', 'client'] as const).map(f => (
                        <button
                          key={f}
                          onClick={() => setSourceFilter(f)}
                          className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                            sourceFilter === f
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-background text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {f === 'all' ? 'All' : f === 'prospect' ? 'Prospects' : 'Clients'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Channel-aware info banner with hide-unreachable toggle */}
                {allClients.length > 0 && (
                  <div className="flex items-center justify-between gap-2 mt-2 bg-muted/50 rounded px-3 py-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                      {marketingChannel === 'email'
                        ? `${allClients.filter(c => !c.email).length} contacts have no email — click the pencil to add one.`
                        : `${allClients.filter(c => isMaskedPhone(c.phone)).length} contacts have masked phone numbers.`
                      }
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none flex-shrink-0">
                      <input
                        type="checkbox"
                        className="h-3 w-3 cursor-pointer"
                        checked={hideUnreachable}
                        onChange={e => setHideUnreachable(e.target.checked)}
                      />
                      Hide unreachable
                    </label>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {isLoadingClients ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : allClients.length === 0 ? (
                  <div className="text-center py-10">
                    <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                    <p className="font-medium text-muted-foreground mb-1">No contacts yet</p>
                    <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">
                      Add prospects via the Lead Pipeline to start sending greetings — no admin assignment needed.
                    </p>
                    <Link href="/agent/leads">
                      <Button size="sm">
                        <UserPlus className="h-4 w-4 mr-2" />
                        Add Your First Prospect
                      </Button>
                    </Link>
                  </div>
                ) : filteredClients.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No contacts match your search</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[420px]">
                    <div className="space-y-2">
                      {filteredClients.map((client: any) => {
                        const reachable = isReachable(client);
                        const isEditingThis = editingEmailId === client.id;
                        return (
                          <div
                            key={client.id}
                            className={`flex items-center gap-3 p-3 border rounded-lg transition-colors ${
                              !reachable
                                ? 'opacity-50 cursor-not-allowed bg-muted/30'
                                : selectedClients.includes(client.id)
                                  ? 'bg-primary/5 border-primary cursor-pointer hover:bg-primary/10'
                                  : 'cursor-pointer hover:bg-muted/50'
                            }`}
                            onClick={() => reachable && !isEditingThis && toggleClientSelection(client.id)}
                          >
                            <Checkbox
                              checked={selectedClients.includes(client.id)}
                              disabled={!reachable}
                              onCheckedChange={() => reachable && toggleClientSelection(client.id)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{client.name}</p>
                              <div className="flex gap-3 text-sm text-muted-foreground flex-wrap">
                                {client.email
                                  ? <span className="truncate">📧 {client.email}</span>
                                  : <span className="text-amber-500 text-xs flex items-center gap-1">
                                      <AlertTriangle className="h-3 w-3" /> no email
                                    </span>
                                }
                                {client.phone && !isMaskedPhone(client.phone) && (
                                  <span>📞 {client.phone}</span>
                                )}
                              </div>

                              {/* Inline email editor */}
                              {isEditingThis && (
                                <div
                                  className="flex items-center gap-2 mt-2"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <input
                                    type="email"
                                    autoFocus
                                    placeholder="Enter email…"
                                    value={editingEmailValue}
                                    onChange={e => setEditingEmailValue(e.target.value)}
                                    className="flex-1 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary bg-background"
                                  />
                                  <button
                                    className="p-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                                    disabled={updateEmailMutation.isPending || !editingEmailValue}
                                    onClick={() => updateEmailMutation.mutate({
                                      id: client.id,
                                      email: editingEmailValue,
                                      source: client.source,
                                    })}
                                  >
                                    <Check className="h-4 w-4" />
                                  </button>
                                  <button
                                    className="p-1 rounded hover:bg-muted"
                                    onClick={() => { setEditingEmailId(null); setEditingEmailValue(''); }}
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              {/* Pencil icon to add email (only when email channel + no email) */}
                              {marketingChannel === 'email' && !client.email && !isEditingThis && (
                                <button
                                  title="Add email"
                                  className="p-1 rounded hover:bg-muted text-muted-foreground"
                                  onClick={e => {
                                    e.stopPropagation();
                                    setEditingEmailId(client.id);
                                    setEditingEmailValue('');
                                  }}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <Badge
                                variant={client.source === 'prospect' ? 'outline' : 'secondary'}
                                className={client.source === 'prospect' ? 'border-blue-400 text-blue-400' : ''}
                              >
                                {client.source === 'prospect' ? 'Prospect' : 'Client'}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
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

            {/* Upcoming Festivals widget (T005) */}
            {upcomingFestivals.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    Upcoming Festivals
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {upcomingFestivals.map(f => (
                    <button
                      key={f.id}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors text-left"
                      onClick={() => {
                        const match = festivals.find(fe => fe.id === f.id);
                        if (match) setSelectedFestival(match);
                        setActiveTab('create');
                      }}
                    >
                      <span className="text-xl">{f.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{f.name}</p>
                      </div>
                      <Badge
                        variant={f.daysUntil === 0 ? 'default' : 'secondary'}
                        className={f.daysUntil <= 3 ? 'bg-amber-500 text-white border-0' : ''}
                      >
                        {f.daysUntil === 0 ? 'Today!' : `${f.daysUntil}d`}
                      </Badge>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Delivery Channel */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Delivery Channel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant={marketingChannel === 'email' ? 'default' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => { setMarketingChannel('email'); setSelectedClients([]); }}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </Button>
                <Button
                  variant={marketingChannel === 'whatsapp' ? 'default' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => { setMarketingChannel('whatsapp'); setSelectedClients([]); }}
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
                  <p className="text-sm text-muted-foreground">
                    {selectedClients.length === 1 ? 'contact' : 'contacts'} selected
                  </p>
                </div>
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handleSendToClients}
                  disabled={selectedClients.length === 0 || sendGreetingsMutation.isPending || greetingImageUploading}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {greetingImageUploading ? 'Preparing image…' : sendGreetingsMutation.isPending ? 'Sending...' : 'Send Greetings'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : activeTab === 'history' ? (
        /* History Tab Content (T004) */
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Greeting Send History
            </CardTitle>
            <CardDescription>
              Your past festival greeting campaigns — newest first
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : (greetingHistory as any[]).length === 0 ? (
              <div className="text-center py-12">
                <Clock className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                <p className="font-medium text-muted-foreground mb-1">No sends yet</p>
                <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">
                  Once you send a festival greeting to clients, each send will appear here.
                </p>
                <Button variant="outline" size="sm" onClick={() => setActiveTab('marketing')}>
                  <Send className="h-4 w-4 mr-2" />
                  Send Your First Greeting
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {(greetingHistory as any[]).map((h: any) => {
                  const festivalMeta = festivals.find(f => f.id === h.festivalId);
                  return (
                    <div key={h.id} className="flex items-center gap-4 p-3 border rounded-lg">
                      <span className="text-2xl">{festivalMeta?.emoji || '🎉'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{festivalMeta?.name || h.festivalId}</p>
                        <p className="text-xs text-muted-foreground">
                          {h.sentAt ? format(new Date(h.sentAt), 'dd MMM yyyy, hh:mm a') : 'Unknown date'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant="outline" className="capitalize">
                          {h.channel === 'whatsapp' ? '💬' : '📧'} {h.channel}
                        </Badge>
                        <Badge variant="secondary">
                          {h.clientCount} sent
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
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
                className="relative overflow-hidden rounded-2xl shadow-2xl mx-auto"
                style={{
                  width: '100%',
                  maxWidth: '500px',
                  aspectRatio: '1/1',
                  background: selectedFestival.gradient,
                }}
              >
                {/* ── Layer 1: Bokeh light spheres ── */}
                <div className="absolute inset-0 overflow-hidden">
                  {/* Large diffused sphere — top-left */}
                  <div className="absolute rounded-full"
                    style={{
                      width: '260px', height: '260px',
                      top: '-60px', left: '-60px',
                      background: `radial-gradient(circle, ${selectedFestival.primaryColor}28 0%, transparent 70%)`,
                      filter: 'blur(30px)',
                    }} />
                  {/* Medium sphere — top-right */}
                  <div className="absolute rounded-full"
                    style={{
                      width: '200px', height: '200px',
                      top: '-40px', right: '-30px',
                      background: `radial-gradient(circle, ${selectedFestival.secondaryColor}22 0%, transparent 70%)`,
                      filter: 'blur(25px)',
                    }} />
                  {/* Small hot-spot — center */}
                  <div className="absolute rounded-full"
                    style={{
                      width: '160px', height: '160px',
                      top: '28%', left: '50%',
                      transform: 'translateX(-50%)',
                      background: `radial-gradient(circle, rgba(255,255,255,0.14) 0%, transparent 70%)`,
                      filter: 'blur(18px)',
                    }} />
                  {/* Accent sphere — bottom-right */}
                  <div className="absolute rounded-full"
                    style={{
                      width: '180px', height: '180px',
                      bottom: '-40px', right: '-40px',
                      background: `radial-gradient(circle, ${selectedFestival.primaryColor}20 0%, transparent 70%)`,
                      filter: 'blur(28px)',
                    }} />
                </div>

                {/* ── Layer 2: Subtle dot-grid texture ── */}
                <div className="absolute inset-0"
                  style={{
                    backgroundImage: `radial-gradient(circle, ${selectedFestival.primaryColor}22 1px, transparent 1px)`,
                    backgroundSize: '28px 28px',
                    opacity: 0.6,
                  }} />

                {/* ── Layer 3: Diagonal gloss shimmer (top-left highlight) ── */}
                <div className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 40%, transparent 60%)',
                  }} />

                {/* ── Layer 4: Vignette — dark edges, bright centre ── */}
                <div className="absolute inset-0"
                  style={{
                    background: 'radial-gradient(ellipse at 50% 45%, transparent 40%, rgba(0,0,0,0.45) 100%)',
                  }} />

                {/* ── Layer 5: Bottom scrim for agent card legibility ── */}
                <div className="absolute inset-x-0 bottom-0 h-[45%]"
                  style={{
                    background: 'linear-gradient(to top, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.20) 60%, transparent 100%)',
                  }} />

                {/* ── Layer 6: Corner ornaments ── */}
                <div className="absolute top-4 left-4 w-10 h-10"
                  style={{ borderTop: `2px solid ${selectedFestival.primaryColor}90`, borderLeft: `2px solid ${selectedFestival.primaryColor}90` }} />
                <div className="absolute top-4 right-4 w-10 h-10"
                  style={{ borderTop: `2px solid ${selectedFestival.primaryColor}90`, borderRight: `2px solid ${selectedFestival.primaryColor}90` }} />
                <div className="absolute bottom-4 left-4 w-10 h-10"
                  style={{ borderBottom: `2px solid ${selectedFestival.primaryColor}90`, borderLeft: `2px solid ${selectedFestival.primaryColor}90` }} />
                <div className="absolute bottom-4 right-4 w-10 h-10"
                  style={{ borderBottom: `2px solid ${selectedFestival.primaryColor}90`, borderRight: `2px solid ${selectedFestival.primaryColor}90` }} />

                {/* ── Layer 7: Floating emoji decorations ── */}
                {selectedFestival.decorEmojis.map((emoji, idx) => (
                  <div
                    key={idx}
                    className="absolute select-none animate-pulse"
                    style={{
                      top: idx === 0 ? '7%' : idx === 1 ? '23%' : idx === 2 ? '52%' : '69%',
                      left: idx % 2 === 0 ? '5%' : '87%',
                      fontSize: idx === 0 ? '2rem' : '1.5rem',
                      animationDelay: `${idx * 0.5}s`,
                      animationDuration: '3.5s',
                      filter: `drop-shadow(0 0 8px ${selectedFestival.primaryColor}90)`,
                      opacity: 0.85,
                    }}
                  >
                    {emoji}
                  </div>
                ))}

                {/* Main Content — festival text centered in upper 65%, agent card pinned to bottom */}
                <div className="absolute inset-0 z-10">

                  {/* Festival text block — centered in the upper portion, leaving room for agent card */}
                  <div
                    className="absolute inset-x-0 top-0 flex flex-col items-center justify-center text-center px-6"
                    style={{ bottom: '110px' }}
                  >
                    {/* HAPPY label */}
                    <div
                      className="text-xs font-bold uppercase mb-2 px-4 py-1 rounded-full"
                      style={{
                        color: selectedFestival.primaryColor,
                        background: `${selectedFestival.primaryColor}18`,
                        border: `1px solid ${selectedFestival.primaryColor}35`,
                        letterSpacing: '0.3em',
                      }}
                    >
                      ✦ HAPPY ✦
                    </div>

                    {/* Festival name */}
                    <h1
                      className="font-extrabold leading-none mb-3"
                      style={{
                        fontSize: selectedFestival.name.length > 10 ? '2.2rem' : selectedFestival.name.length > 7 ? '2.8rem' : '3.4rem',
                        color: selectedFestival.primaryColor,
                        fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif',
                        letterSpacing: '0.06em',
                        filter: `drop-shadow(0 2px 14px ${selectedFestival.primaryColor}a0) drop-shadow(0 0 32px ${selectedFestival.primaryColor}55)`,
                        textTransform: 'uppercase',
                      }}
                    >
                      {selectedFestival.name}
                    </h1>

                    {/* Decorative divider */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-px w-16" style={{ background: `linear-gradient(to right, transparent, ${selectedFestival.primaryColor}aa)` }} />
                      <span className="text-xl" style={{ filter: `drop-shadow(0 0 5px ${selectedFestival.primaryColor}90)` }}>
                        {selectedFestival.emoji}
                      </span>
                      <div className="h-px w-16" style={{ background: `linear-gradient(to left, transparent, ${selectedFestival.primaryColor}aa)` }} />
                    </div>

                    {/* Message */}
                    <p
                      className="text-sm leading-relaxed max-w-[260px] italic"
                      style={{ color: 'rgba(255,255,255,0.90)', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
                    >
                      "{selectedFestival.message}"
                    </p>
                  </div>

                  {/* Agent Info Card — absolutely pinned to bottom, always fully visible */}
                  <div
                    data-agent-card="1"
                    className="absolute rounded-2xl p-3 flex items-center gap-3"
                    style={{
                      bottom: '16px',
                      left: '16px',
                      right: '16px',
                      height: 'auto',
                      background: 'rgba(0,0,0,0.48)',
                      backdropFilter: 'blur(16px)',
                      border: `1px solid ${selectedFestival.primaryColor}45`,
                      boxShadow: `0 2px 16px rgba(0,0,0,0.35)`,
                    }}
                  >
                    {/* Avatar circle — premium gold ring */}
                    <div
                      className="flex-shrink-0 rounded-full flex items-center justify-center font-bold"
                      style={{
                        width: '44px',
                        height: '44px',
                        flexShrink: 0,
                        background: `linear-gradient(135deg, ${selectedFestival.primaryColor}70, ${selectedFestival.secondaryColor}55)`,
                        border: `2px solid ${selectedFestival.primaryColor}80`,
                        color: '#fff',
                        fontFamily: '"Playfair Display", Georgia, serif',
                        fontSize: '1rem',
                        textShadow: `0 1px 4px rgba(0,0,0,0.5)`,
                      }}
                    >
                      {(agentInfo.name || 'Y').charAt(0).toUpperCase()}
                    </div>

                    {/* Text info — ID used by onclone for reliable targeting */}
                    {/* FLAT structure — all 4 rows are direct children so
                        index-based onclone styling hits them correctly */}
                    <div
                      ref={textBlockRef}
                      id="agent-text-block"
                      data-agent-card-text="1"
                      className="flex flex-col justify-center"
                      style={{ flex: 1, minWidth: 0, gap: '5px' }}
                    >
                      {/* child[0] — name */}
                      <div
                        className="agent-name"
                        style={{ color: '#ffffff', fontSize: '14px', fontWeight: 700, lineHeight: '18px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {agentInfo.name || 'Your Name'}
                      </div>
                      {/* child[1] — designation */}
                      <div
                        className="agent-designation"
                        style={{ color: selectedFestival.primaryColor, fontSize: '11px', lineHeight: '15px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {agentInfo.designation || 'Financial Advisor'}
                      </div>
                      {/* child[2] — email */}
                      {agentInfo.email && (
                        <div
                          className="agent-contact-row"
                          style={{ color: 'rgba(255,255,255,0.78)', fontSize: '10px', lineHeight: '14px', display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', whiteSpace: 'nowrap' }}
                        >
                          ✉ {agentInfo.email}
                        </div>
                      )}
                      {/* child[3] — phone */}
                      {agentInfo.phone && (
                        <div
                          className="agent-contact-row"
                          style={{ color: 'rgba(255,255,255,0.78)', fontSize: '10px', lineHeight: '14px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          ☎ {agentInfo.phone}
                        </div>
                      )}
                    </div>

                    {/* FintekPro logo badge */}
                    <div style={{ flexShrink: 0 }}>
                      <img
                        src="/icon-192.png"
                        alt="FintekPro"
                        style={{ width: '32px', height: '32px', borderRadius: '8px', filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.25))', opacity: 0.85 }}
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
