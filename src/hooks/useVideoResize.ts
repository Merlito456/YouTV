import { useState, useCallback, useRef } from 'react';

export interface VideoResizeOptions {
  defaultWidth?: string;
  adWidth?: string;
  transitionDuration?: number;
  onAdShow?: () => void;
  onAdHide?: () => void;
}

export const useVideoResize = (options: VideoResizeOptions = {}) => {
  const {
    defaultWidth = '100%',
    adWidth = 'calc(100% - 340px)', // 300px ad + 40px gap
    transitionDuration = 300,
    onAdShow,
    onAdHide
  } = options;

  const [isResized, setIsResized] = useState(false);
  const [showAd, setShowAd] = useState(false);
  const [adType, setAdType] = useState<'sidebar' | 'corner' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const adContainerRef = useRef<HTMLDivElement>(null);

  // Resize video for sidebar ad (compliant)
  const resizeForSidebarAd = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.style.transition = `width ${transitionDuration}ms ease`;
      containerRef.current.style.width = adWidth;
      setIsResized(true);
      setAdType('sidebar');
      if (onAdShow) onAdShow();
    }
  }, [adWidth, transitionDuration, onAdShow]);

  // For corner ad - no resize needed (ad is separate)
  const showCornerAd = useCallback(() => {
    setShowAd(true);
    setAdType('corner');
    if (onAdShow) onAdShow();
  }, [onAdShow]);

  // Restore video to full size
  const restoreVideoSize = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.style.transition = `width ${transitionDuration}ms ease`;
      containerRef.current.style.width = defaultWidth;
      setIsResized(false);
    }
    setShowAd(false);
    setAdType(null);
    if (onAdHide) onAdHide();
  }, [defaultWidth, transitionDuration, onAdHide]);

  // Show sidebar ad (between videos)
  const showSidebarAd = useCallback((duration: number = 8000) => {
    resizeForSidebarAd();
    setShowAd(true);
    
    const timer = setTimeout(() => {
      restoreVideoSize();
    }, duration);
    
    return () => clearTimeout(timer);
  }, [resizeForSidebarAd, restoreVideoSize]);

  // Show corner ad (periodic, no resize)
  const showCornerAdTimed = useCallback((duration: number = 8000) => {
    showCornerAd();
    
    const timer = setTimeout(() => {
      setShowAd(false);
      setAdType(null);
      if (onAdHide) onAdHide();
    }, duration);
    
    return () => clearTimeout(timer);
  }, [showCornerAd, onAdHide]);

  // Hide ad
  const hideAd = useCallback(() => {
    if (adType === 'sidebar') {
      restoreVideoSize();
    } else {
      setShowAd(false);
      setAdType(null);
      if (onAdHide) onAdHide();
    }
  }, [adType, restoreVideoSize, onAdHide]);

  return {
    containerRef,
    adContainerRef,
    showAd,
    adType,
    isResized,
    showSidebarAd,
    showCornerAdTimed,
    hideAd,
    restoreVideoSize
  };
};
