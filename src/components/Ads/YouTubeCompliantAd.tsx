import React, { useEffect, useRef, useState } from 'react';
import { AdSenseService } from '../../services/AdSenseService';

interface YouTubeCompliantAdProps {
  type: 'sidebar' | 'corner';
  adSlot?: string;
  duration?: number;
  onClose?: () => void;
  onAdLoaded?: () => void;
}

export const YouTubeCompliantAd: React.FC<YouTubeCompliantAdProps> = ({
  type,
  adSlot,
  duration = 8000,
  onClose,
  onAdLoaded
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const adId = useRef(`ad-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const [visible, setVisible] = useState(true);
  const [adLoaded, setAdLoaded] = useState(false);
  const adService = AdSenseService.getInstance();

  useEffect(() => {
    if (!containerRef.current) return;

    containerRef.current.id = adId.current;

    // Load the ad
    if (type === 'sidebar') {
      adService.createSidebarAd(adId.current, adSlot);
    } else {
      adService.createCornerAd(adId.current, adSlot);
    }

    // Mark as loaded after delay
    const loadTimer = setTimeout(() => {
      setAdLoaded(true);
      if (onAdLoaded) onAdLoaded();
    }, 1000);

    // Auto close after duration
    const closeTimer = setTimeout(() => {
      setVisible(false);
      if (onClose) onClose();
    }, duration);

    return () => {
      clearTimeout(loadTimer);
      clearTimeout(closeTimer);
    };
  }, [type, adSlot, duration]);

  if (!visible) return null;

  // Loading state
  if (!adLoaded) {
    return (
      <div
        style={{
          background: '#2a2a2a',
          borderRadius: '12px',
          padding: '20px',
          textAlign: 'center',
          minHeight: type === 'sidebar' ? '250px' : '100px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        <div style={{
          width: '30px',
          height: '30px',
          border: '2px solid #333',
          borderTop: '2px solid #ff0000',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <span style={{ color: '#888', fontSize: '11px' }}>Loading ad...</span>
      </div>
    );
  }

  // Sidebar Ad (resizes video)
  if (type === 'sidebar') {
    return (
      <div
        ref={containerRef}
        style={{
          width: '300px',
          background: '#1a1a1a',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid #ff0000',
          animation: 'fadeIn 0.3s ease'
        }}
      >
        {/* Ad Label - REQUIRED by YouTube */}
        <div style={{
          background: '#ff0000',
          color: 'white',
          fontSize: '10px',
          padding: '4px 8px',
          textAlign: 'center',
          fontWeight: 'bold',
          letterSpacing: '0.5px'
        }}>
          ADVERTISEMENT
        </div>
        
        {/* Ad Content */}
        <div style={{ padding: '15px' }}>
          <div id={`ad-content-${adId.current}`} />
        </div>
        
        {/* Close Button */}
        <button
          onClick={() => {
            setVisible(false);
            if (onClose) onClose();
          }}
          style={{
            width: '100%',
            padding: '8px',
            background: '#2a2a2a',
            color: '#888',
            border: 'none',
            borderTop: '1px solid #333',
            cursor: 'pointer',
            fontSize: '11px',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#3a3a3a'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#2a2a2a'}
        >
          ✕ Close Ad
        </button>
      </div>
    );
  }

  // Corner Ad (floating, doesn't resize video)
  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '280px',
        background: '#1a1a1a',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        border: '1px solid #ff0000',
        zIndex: 1000,
        animation: 'slideIn 0.3s ease'
      }}
    >
      {/* Ad Label */}
      <div style={{
        background: '#ff0000',
        color: 'white',
        fontSize: '10px',
        padding: '4px 8px',
        textAlign: 'center',
        fontWeight: 'bold',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>ADVERTISEMENT</span>
        <button
          onClick={() => {
            setVisible(false);
            if (onClose) onClose();
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: '12px',
            padding: '0 4px'
          }}
        >
          ✕
        </button>
      </div>
      
      {/* Ad Content */}
      <div style={{ padding: '12px' }}>
        <div id={`ad-content-${adId.current}`} />
      </div>
    </div>
  );
};

// Add animations
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;
document.head.appendChild(style);
