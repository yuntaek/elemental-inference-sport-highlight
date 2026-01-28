import { useNavigate } from "react-router";
import { ImageWithFallback } from "@/app/components/figma/ImageWithFallback";
import { ChevronRight } from "lucide-react";

export function WelcomeScreen() {
  const navigate = useNavigate();

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <ImageWithFallback
        src="https://images.unsplash.com/photo-1768697358705-c1b60333da35?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbGVnYW50JTIwcmVzdGF1cmFudCUyMGludGVyaW9yfGVufDF8fHx8MTc2OTE0NDY5Nnww&ixlib=rb-4.1.0&q=80&w=1080"
        alt="Restaurant Interior"
        className="absolute inset-0 w-full h-full object-cover"
      />
      
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40" />
      
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-8 text-center">
        <h1 className="text-white mb-6">
          Welcome to
        </h1>
        <h2 className="text-white mb-12">
          La Belle Cuisine
        </h2>
        <p className="text-white/90 max-w-md mb-16">
          Experience culinary excellence with our carefully curated menu. 
          Tap below to start your order.
        </p>
        
        <button
          onClick={() => navigate("/menu")}
          className="group flex items-center gap-3 px-8 py-4 bg-white text-gray-900 rounded-full transition-transform hover:scale-105 active:scale-95"
        >
          <span>View Menu</span>
          <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
        </button>
      </div>
    </div>
  );
}
