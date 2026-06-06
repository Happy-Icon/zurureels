import { useState, useRef, useEffect } from 'react';
import { 
  Video, 
  Sparkles, 
  Bot, 
  Play, 
  Heart, 
  Bookmark, 
  Send, 
  RotateCcw, 
  ChevronRight, 
  Menu, 
  X, 
  Shield,
  DollarSign,
  TrendingUp,
  Tv,
  Eye,
  Compass,
  Award
} from 'lucide-react';

interface ChatMessage {
  sender: 'system' | 'user' | 'bot';
  text: string;
}

const initialMessages: ChatMessage[] = [
  {
    sender: 'system',
    text: 'Jambo! 🌴 Welcome to Zuru AI. Ask me about coastal destinations, local hidden gems, or trending reels.'
  }
];

const aiResponses: Record<string, string> = {
  "Find trending dhow cruises in Mombasa": 
    "⛵ **Trending Mombasa Cruises:**<br>The **Tamarind Dhow Cruise** is currently trending with 4.2k views on reels. Another top reel shows a **Traditional Swahili Dhow** sunset trip around Nyali with live Swahili drumming. Would you like to view the video stream?",
  
  "Recommend the best snorkeling spot in Diani": 
    "🐠 **Snorkeling in Diani:**<br>The absolute best spot is the **Robinson Island Reef**. Local hosts recently posted 8 new verified reels showing sea turtles and starfish near the outer coral shelf. The water visibility is currently rated as Excellent (8/10).",
  
  "Show me dining vibes in Lamu": 
    "🍽️ **Lamu Foodie Reels:**<br>Check out the reels for **Peponi Hotel Restaurant** in Shela (famous for fresh oysters and ginger crab) or the rooftop Swahili dining at **Majlis Resort**. You can scroll through the coastal cuisine feed above!"
};

// Data for the video feeds
const videoReelsData = [
  {
    city: "Mombasa",
    title: "Nyali Sunset Dhow Cruise",
    source: "https://vjs.zencdn.net/v/oceans.mp4",
    likes: "4.8k",
    views: "18.2k",
    tag: "#Sailing"
  },
  {
    city: "Diani",
    title: "Coral Reef Sea Turtle Safari",
    source: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    likes: "6.2k",
    views: "24.9k",
    tag: "#Snorkel"
  },
  {
    city: "Watamu",
    title: "Mida Creek Kayak Exploration",
    source: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    likes: "3.9k",
    views: "12.4k",
    tag: "#Kayaking"
  },
  {
    city: "Lamu",
    title: "Traditional Shela Village Walk",
    source: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    likes: "5.1k",
    views: "31.2k",
    tag: "#Culture"
  }
];

const coastalVibesData = [
  {
    title: "Dhow Sailing",
    description: "Feel the warm monsoon wind as you cruise on a traditional hand-carved Swahili sailboat.",
    video: "https://vjs.zencdn.net/v/oceans.mp4",
    duration: "15s reel"
  },
  {
    title: "Ocean Adventures",
    description: "Explore crystal clear water, coral reefs, dolphin sanctuaries, and marine parks.",
    video: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    duration: "20s reel"
  },
  {
    title: "Beach Clubs & Sunset Sessions",
    description: "Unwind at hidden beach clubs with smooth music, local fresh food, and spectacular views.",
    video: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    duration: "18s reel"
  }
];

export default function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isTyping, setIsTyping] = useState(false);
  const [activeVibeIndex, setActiveVibeIndex] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendChat = (textToSend?: string) => {
    const text = (textToSend || chatInput).trim();
    if (!text) return;

    setMessages(prev => [...prev, { sender: 'user', text }]);
    setChatInput('');
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      const reply = aiResponses[text] || 
        `Jambo! 🌴 I've searched the live feeds for "${text}". Launch the ZuruReels Web App to scroll through all related vertical videos.`;
      
      setMessages(prev => [...prev, { sender: 'bot', text: reply }]);
    }, 1000);
  };

  const handleClearChat = () => {
    setMessages(initialMessages);
  };

  return (
    <div className="relative min-h-screen font-body bg-white text-slate-900 overflow-x-hidden selection:bg-primary selection:text-white">
      {/* Background Soft Blobs */}
      <div className="blob blob-1 top-[5%] left-[-10%] w-[45vw] h-[45vw] bg-radial-gradient from-primary/10 to-transparent" />
      <div className="blob blob-2 top-[35%] right-[-10%] w-[40vw] h-[40vw] bg-radial-gradient from-primary/5 to-transparent" />
      
      {/* Navigation Header */}
      <header className="fixed top-0 left-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100 smooth-transition">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="text-2xl font-title font-extrabold tracking-tight flex items-center gap-2">
            <span className="text-primary">Zuru</span>Reels
            <span className="text-[10px] px-2.5 py-0.5 font-bold bg-primary/10 border border-primary/20 text-primary rounded-full uppercase tracking-wider">
              Discovery
            </span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8 font-semibold text-sm text-slate-500">
            <a href="#gallery" className="hover:text-primary smooth-transition">Live Feeds</a>
            <a href="#vibes" className="hover:text-primary smooth-transition">Coastal Vibes</a>
            <a href="#ai-concierge" className="hover:text-primary smooth-transition">Zuru AI</a>
            <a href="#creators" className="hover:text-primary smooth-transition">Creator Hub</a>
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <a href="../frontend" className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-full smooth-transition shadow-sm hover:-translate-y-0.5">
              Launch Web App
            </a>
          </div>

          {/* Mobile Navigation Toggle */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-800 focus:outline-none"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      <div className={`fixed inset-0 z-40 bg-white smooth-transition pt-24 ${mobileMenuOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
        <nav className="flex flex-col items-center gap-6 p-8 font-bold text-lg text-slate-600">
          <a href="#gallery" onClick={() => setMobileMenuOpen(false)} className="hover:text-primary">Live Feeds</a>
          <a href="#vibes" onClick={() => setMobileMenuOpen(false)} className="hover:text-primary">Coastal Vibes</a>
          <a href="#ai-concierge" onClick={() => setMobileMenuOpen(false)} className="hover:text-primary">Zuru AI</a>
          <a href="#creators" onClick={() => setMobileMenuOpen(false)} className="hover:text-primary">Creator Hub</a>
          <a href="../frontend" className="w-full text-center px-6 py-3 bg-slate-900 text-white text-base rounded-full shadow-md mt-4">
            Launch Web App
          </a>
        </nav>
      </div>

      {/* 1. Hero Section (Vogue Typography & Looping Video) */}
      <section className="relative pt-44 pb-32 min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0 w-full h-full z-0">
          <video 
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          >
            <source src="https://vjs.zencdn.net/v/oceans.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-white z-10" />
        </div>

        <div className="max-w-6xl mx-auto px-6 w-full text-center relative z-20">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-xs font-bold text-white mb-8">
            <Sparkles size={14} className="text-primary animate-pulse" /> Authentic Coastal Travel in Motion
          </div>
          
          <h1 className="text-5xl sm:text-7xl md:text-9xl font-black tracking-tighter text-slate-950 leading-[0.9] mb-8 drop-shadow-sm">
            Explore the Coast <br />
            <span className="text-primary">in Motion</span>
          </h1>
          
          <p className="text-lg sm:text-2xl text-slate-800 font-semibold leading-relaxed mb-12 max-w-3xl mx-auto">
            Skip static photos. See real, verified, short-form reels of Mombasa, Diani, Watamu, and Lamu. Powered by Zuru AI.
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-20">
            <a href="../frontend" className="px-10 py-4.5 bg-primary hover:bg-primary-hover text-white text-base font-bold rounded-full smooth-transition shadow-lg shadow-primary/25 hover:-translate-y-0.5 hover:shadow-xl flex items-center justify-center gap-2">
              Launch Web App <ChevronRight size={18} />
            </a>
            <a href="#gallery" className="px-10 py-4.5 border border-slate-300 bg-white/80 backdrop-blur-sm hover:bg-white text-slate-900 text-base font-bold rounded-full smooth-transition flex items-center justify-center gap-2 hover:-translate-y-0.5 shadow-sm">
              Watch Live Reels <Play size={16} className="text-slate-900 fill-slate-900" />
            </a>
          </div>

          <div className="flex flex-wrap gap-12 sm:gap-20 justify-center border-t border-slate-200/60 pt-10 max-w-4xl mx-auto">
            <div className="flex items-center gap-3">
              <Tv className="text-primary w-8 h-8" />
              <div className="text-left">
                <h3 className="text-2xl font-black text-slate-900">100% Video</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">No static stock photos</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Compass className="text-primary w-8 h-8" />
              <div className="text-left">
                <h3 className="text-2xl font-black text-slate-900">5+ Regions</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mombasa to Lamu</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="text-primary w-8 h-8" />
              <div className="text-left">
                <h3 className="text-2xl font-black text-slate-900">GPS Verified</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Real-time local verification</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Coastal Reels Gallery (Many Videos Grid) */}
      <section id="gallery" className="py-32 border-t border-slate-100 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center max-w-2xl mx-auto mb-20">
            <span className="text-primary font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-1">
              <TrendingUp size={14} /> Trending Video Streams
            </span>
            <h2 className="text-4xl sm:text-6xl font-black text-slate-900 mt-3 mb-6 tracking-tight">Cities in Motion</h2>
            <p className="text-slate-500 font-semibold text-base sm:text-lg">Experience coastal hotspots through active, auto-playing video reels updated daily by verified local hosts.</p>
          </div>

          {/* 4-Column Reels Video Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {videoReelsData.map((reel, idx) => (
              <div 
                key={idx}
                className="relative h-[550px] rounded-[32px] bg-slate-950 overflow-hidden shadow-xl smooth-transition hover:-translate-y-2 hover:shadow-2xl group border border-slate-100"
              >
                {/* Active Looping Video */}
                <video 
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                >
                  <source src={reel.source} type="video/mp4" />
                </video>

                {/* Card Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/20 z-10 pointer-events-none" />

                {/* Overlaid Badges */}
                <div className="absolute top-5 left-5 z-20 flex gap-2">
                  <span className="bg-slate-900/80 backdrop-blur-md text-white px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase">
                    {reel.city}
                  </span>
                  <span className="bg-primary text-white px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1">
                    <Shield size={10} /> Live
                  </span>
                </div>

                {/* Reel Info */}
                <div className="absolute left-5 bottom-6 z-20 text-white text-left max-w-[80%]">
                  <span className="text-xs font-bold text-primary mb-1 block">{reel.tag}</span>
                  <h3 className="text-lg font-bold leading-snug">{reel.title}</h3>
                  <div className="flex items-center gap-3 mt-3 text-xs text-slate-300">
                    <span className="flex items-center gap-1">
                      <Eye size={12} /> {reel.views}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart size={12} className="text-primary fill-primary" /> {reel.likes}
                    </span>
                  </div>
                </div>

                {/* Micro Action Buttons */}
                <div className="absolute right-5 bottom-6 z-20 flex flex-col gap-3">
                  <button className="w-10 h-10 bg-white/10 hover:bg-primary backdrop-blur-md text-white rounded-full flex items-center justify-center smooth-transition hover:scale-110">
                    <Heart size={18} />
                  </button>
                  <button className="w-10 h-10 bg-white/10 hover:bg-primary backdrop-blur-md text-white rounded-full flex items-center justify-center smooth-transition hover:scale-110">
                    <Bookmark size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-16">
            <a href="../frontend" className="px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-full smooth-transition inline-flex items-center shadow-md hover:-translate-y-0.5">
              Enter Live Discovery Hub
            </a>
          </div>
        </div>
      </section>

      {/* 3. Interactive Vibe Explorer (Tabbed Video Showcase) */}
      <section id="vibes" className="py-32 bg-slate-50 border-t border-b border-slate-100 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center max-w-2xl mx-auto mb-20">
            <span className="text-primary font-bold text-xs uppercase tracking-widest">Coastal Atmosphere</span>
            <h2 className="text-4xl sm:text-6xl font-black text-slate-900 mt-3 mb-6 tracking-tight">Tune into the Vibe</h2>
            <p className="text-slate-500 font-semibold text-base sm:text-lg">Click below to change the live feed and see what coastal activities feel like.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Vibe Selection Tabs (Left) */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              {coastalVibesData.map((vibe, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveVibeIndex(idx)}
                  className={`w-full text-left p-8 rounded-3xl smooth-transition border ${
                    activeVibeIndex === idx
                      ? 'bg-white border-primary shadow-xl -translate-y-1'
                      : 'bg-white/50 border-slate-200/60 hover:bg-white'
                  }`}
                >
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xl font-extrabold text-slate-900">{vibe.title}</h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 bg-slate-100 rounded-md text-slate-500">
                      {vibe.duration}
                    </span>
                  </div>
                  <p className="text-slate-500 text-sm leading-relaxed">{vibe.description}</p>
                </button>
              ))}
            </div>

            {/* Vibe Video Player Frame (Right) */}
            <div className="lg:col-span-7 flex justify-center">
              <div className="relative w-full aspect-video rounded-[36px] bg-slate-950 overflow-hidden shadow-2xl border-8 border-white">
                <video
                  key={activeVibeIndex}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                >
                  <source src={coastalVibesData[activeVibeIndex].video} type="video/mp4" />
                </video>
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-6 left-6 text-white flex items-center gap-2 bg-slate-900/60 backdrop-blur-md py-2 px-4 rounded-full text-xs font-bold">
                  <Play size={12} className="fill-white" /> Playing Vibe Reel {activeVibeIndex + 1}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. AI Concierge with Video Mockup */}
      <section id="ai-concierge" className="py-32 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
            
            {/* Chat Simulator & Questions */}
            <div className="lg:col-span-6">
              <span className="text-primary font-bold text-xs uppercase tracking-widest">Zuru AI Companion</span>
              <h2 className="text-4xl sm:text-5xl font-black text-slate-900 mt-3 mb-6 tracking-tight">Your Local Guide, Verified in Motion</h2>
              <p className="text-slate-500 text-base sm:text-lg mb-8 leading-relaxed">
                Interact with our AI concierge. Zuru AI translates questions about restaurants, beach clubs, or sailing trips into visual, verified loops.
              </p>

              <div className="flex flex-col gap-3 max-w-md">
                <button 
                  onClick={() => handleSendChat("Find trending dhow cruises in Mombasa")}
                  className="w-full text-left px-5 py-3.5 bg-slate-50 border border-slate-200 hover:border-primary/40 hover:bg-primary/5 rounded-2xl text-slate-800 text-sm font-bold smooth-transition"
                >
                  ⛵ Find sunset sailing dhows
                </button>
                <button 
                  onClick={() => handleSendChat("Recommend the best snorkeling spot in Diani")}
                  className="w-full text-left px-5 py-3.5 bg-slate-50 border border-slate-200 hover:border-primary/40 hover:bg-primary/5 rounded-2xl text-slate-800 text-sm font-bold smooth-transition"
                >
                  🐠 Find sea turtle snorkeling reefs
                </button>
                <button 
                  onClick={() => handleSendChat("Show me dining vibes in Lamu")}
                  className="w-full text-left px-5 py-3.5 bg-slate-50 border border-slate-200 hover:border-primary/40 hover:bg-primary/5 rounded-2xl text-slate-800 text-sm font-bold smooth-transition"
                >
                  🍽️ Explore coastal restaurants
                </button>
              </div>
            </div>

            {/* Interactive Chat Console Window (Right) */}
            <div className="lg:col-span-6 flex flex-col h-[500px] bg-white border border-slate-100 rounded-[32px] overflow-hidden shadow-2xl">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold">
                    <Bot size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Zuru Coastal AI</h4>
                    <p className="text-[10px] text-emerald-500 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-ping" /> Online & Mapping Reels
                    </p>
                  </div>
                </div>
                <button onClick={handleClearChat} className="p-2 text-slate-400 hover:text-primary smooth-transition">
                  <RotateCcw size={16} />
                </button>
              </div>

              {/* Chat messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((msg, i) => (
                  <div 
                    key={i}
                    className={`max-w-[85%] px-5 py-3.5 rounded-2xl text-sm leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-primary text-white ml-auto rounded-br-none shadow-md shadow-primary/10 font-medium'
                        : 'bg-slate-100 text-slate-800 rounded-bl-none font-medium'
                    }`}
                  >
                    <p dangerouslySetInnerHTML={{ __html: msg.text }} />
                  </div>
                ))}

                {isTyping && (
                  <div className="bg-slate-100 text-slate-800 rounded-2xl rounded-bl-none px-5 py-3.5 max-w-[85%] w-fit">
                    <div className="flex gap-1.5 items-center">
                      <span className="w-2 h-2 rounded-full bg-slate-400 typing-dot" />
                      <span className="w-2 h-2 rounded-full bg-slate-400 typing-dot [animation-delay:0.2s]" />
                      <span className="w-2 h-2 rounded-full bg-slate-400 typing-dot [animation-delay:0.4s]" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="p-4 border-t border-slate-100 flex gap-3 items-center">
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
                  placeholder="Ask about coastal experiences..."
                  className="flex-1 px-5 py-3 bg-slate-50 border border-slate-200 rounded-full text-slate-800 text-sm font-semibold focus:outline-none focus:border-primary/40 focus:bg-white smooth-transition"
                />
                <button 
                  onClick={() => handleSendChat()}
                  className="w-12 h-12 bg-primary hover:bg-primary-hover text-white rounded-full flex items-center justify-center smooth-transition hover:scale-105"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 5. Creator Hub & Become a Host (Asymmetrical Visuals with Looping Video) */}
      <section id="creators" className="py-32 bg-slate-50 border-t border-b border-slate-100 relative overflow-hidden">
        <div className="absolute inset-0 w-full h-full z-0">
          <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover opacity-5">
            <source src="https://vjs.zencdn.net/v/oceans.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-slate-50/95" />
        </div>

        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-16 items-center relative z-10">
          {/* Asymmetrical Video & Host Cards (Left) */}
          <div className="lg:col-span-7 grid grid-cols-2 gap-6 relative">
            <div className="relative h-[400px] rounded-3xl overflow-hidden shadow-xl mt-12 border border-slate-200">
              <video autoPlay loop muted playsInline className="w-full h-full object-cover">
                <source src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4" type="video/mp4" />
              </video>
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
              <div className="absolute bottom-5 left-5 text-white">
                <p className="text-[10px] font-bold uppercase text-primary tracking-widest mb-1">Mombasa Captain</p>
                <h4 className="text-sm font-bold">Captain Omari</h4>
              </div>
            </div>

            <div className="relative h-[400px] rounded-3xl overflow-hidden shadow-xl border border-slate-200">
              <img 
                src="assets/swahili_host_captain.png" 
                alt="Captain Omari on dhow" 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
              <div className="absolute bottom-5 left-5 text-white">
                <p className="text-[10px] font-bold uppercase text-primary tracking-widest mb-1">Diani Guide</p>
                <h4 className="text-sm font-bold">Mwanajuma K.</h4>
              </div>
            </div>

            {/* Verified float badge */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border border-slate-100 shadow-2xl py-3.5 px-6 rounded-2xl flex items-center gap-3 z-20">
              <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center font-bold">
                <Award size={18} />
              </div>
              <div className="text-left">
                <h5 className="text-xs font-black text-slate-900">100% On-Site</h5>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Hardware Verified</p>
              </div>
            </div>
          </div>

          {/* Become a Host Card (Right) */}
          <div className="lg:col-span-5 text-center lg:text-left z-10 relative">
            <div className="bg-white border border-slate-200/60 rounded-[32px] p-8 md:p-10 shadow-xl">
              <span className="text-primary font-bold text-xs uppercase tracking-widest block mb-2">Creator Hub</span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-6 tracking-tight">Showcase Your Coastal Adventure</h2>
              <p className="text-slate-500 text-base mb-8 leading-relaxed">
                Are you a local boat owner, marine guide, or ocean enthusiast? Join ZuruReels as a creator host to share authentic stories of coastal life.
              </p>

              <ul className="flex flex-col gap-5 text-left font-semibold text-slate-800 mb-8">
                <li className="flex gap-3 items-start">
                  <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Video size={14} />
                  </span>
                  <div>
                    <strong className="text-slate-950 font-bold block text-sm">Upload High-Definition Reels</strong>
                    <span className="text-slate-400 font-medium text-xs">Share real-time clips directly from your dhow, vessel, or seaside venue.</span>
                  </div>
                </li>
                <li className="flex gap-3 items-start">
                  <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <DollarSign size={14} />
                  </span>
                  <div>
                    <strong className="text-slate-950 font-bold block text-sm">Monetize Your Influence</strong>
                    <span className="text-slate-400 font-medium text-xs">Connect directly with travelers looking for the best local water sports and dining.</span>
                  </div>
                </li>
              </ul>

              <div className="flex flex-col gap-4">
                <a href="../frontend/become-host" className="px-8 py-4 bg-primary hover:bg-primary-hover text-white text-base font-extrabold rounded-full smooth-transition shadow-lg shadow-primary/20 hover:-translate-y-0.5 text-center block">
                  Become a Creator Host
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Footer */}
      <footer className="bg-white border-t border-slate-100 pt-16">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-10 pb-16">
          <div>
            <div className="text-xl font-title font-extrabold tracking-tight mb-4">
              <span className="text-primary">Zuru</span>Reels
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Connecting coastal explorers with verified experiences through video.
            </p>
            <div className="flex gap-3">
              <a href="#" className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 hover:bg-primary hover:text-white hover:border-primary smooth-transition flex items-center justify-center text-slate-500">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051C.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                </svg>
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 hover:bg-primary hover:text-white hover:border-primary smooth-transition flex items-center justify-center text-slate-500">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 text-sm mb-4">Explore</h4>
            <div className="flex flex-col gap-2.5 text-slate-400 text-sm font-semibold">
              <a href="#gallery" className="hover:text-primary">Live Feeds</a>
              <a href="#vibes" className="hover:text-primary">Coastal Vibes</a>
              <a href="#ai-concierge" className="hover:text-primary">Zuru AI</a>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 text-sm mb-4">Creator Hosts</h4>
            <div className="flex flex-col gap-2.5 text-slate-400 text-sm font-semibold">
              <a href="../frontend/become-host" className="hover:text-primary">Become a Creator Host</a>
              <a href="../frontend/host/verification" className="hover:text-primary">Verification Guidelines</a>
              <a href="../frontend/host/payouts" className="hover:text-primary">Payout Structure</a>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 text-sm mb-4">Legal</h4>
            <div className="flex flex-col gap-2.5 text-slate-400 text-sm font-semibold">
              <a href="#" className="hover:text-primary">Privacy Policy</a>
              <a href="#" className="hover:text-primary">Terms of Service</a>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 py-6 text-center text-xs font-semibold text-slate-400">
          <div className="max-w-7xl mx-auto px-6">
            &copy; 2026 ZuruReels. Made with ❤️ for Coastal Explorers.
          </div>
        </div>
      </footer>
    </div>
  );
}
