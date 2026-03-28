
export class AdSenseService {
  private static instance: AdSenseService;
  private isInitialized: boolean = false;
  private publisherId: string = 'ca-pub-XXXXXXXXXXXXXXXX'; // Replace with actual ID

  private constructor() {
    this.loadAdSenseScript();
  }

  public static getInstance(): AdSenseService {
    if (!AdSenseService.instance) {
      AdSenseService.instance = new AdSenseService();
    }
    return AdSenseService.instance;
  }

  private loadAdSenseScript() {
    if (typeof window === 'undefined' || this.isInitialized) return;

    const script = document.createElement('script');
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${this.publisherId}`;
    script.async = true;
    script.crossOrigin = 'anonymous';
    document.head.appendChild(script);
    this.isInitialized = true;
  }

  public pushAd() {
    try {
      (window as any).adsbygoogle = (window as any).adsbygoogle || [];
      (window as any).adsbygoogle.push({});
    } catch (e) {
      console.error('AdSense push error:', e);
    }
  }

  public createBannerAd(containerId: string, slot?: string) {
    this.renderAd(containerId, {
      style: 'display:inline-block;width:728px;height:90px',
      slot: slot || 'XXXXXXXXXX',
      format: 'auto'
    });
  }

  public createSidebarAd(containerId: string, slot?: string) {
    this.renderAd(containerId, {
      style: 'display:block',
      slot: slot || 'XXXXXXXXXX',
      format: 'auto',
      responsive: 'true'
    });
  }

  public createResponsiveAd(containerId: string, slot?: string) {
    this.renderAd(containerId, {
      style: 'display:block',
      slot: slot || 'XXXXXXXXXX',
      format: 'auto',
      responsive: 'true'
    });
  }

  public createInArticleAd(containerId: string, slot?: string) {
    this.renderAd(containerId, {
      style: 'display:block; text-align:center;',
      slot: slot || 'XXXXXXXXXX',
      format: 'fluid',
      layout: 'in-article'
    });
  }

  public createCornerAd(containerId: string, slot?: string) {
    this.renderAd(containerId, {
      style: 'display:inline-block;width:300px;height:250px',
      slot: slot || 'XXXXXXXXXX',
      format: 'auto'
    });
  }

  private renderAd(containerId: string, config: any) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <ins class="adsbygoogle"
           style="${config.style}"
           data-ad-client="${this.publisherId}"
           data-ad-slot="${config.slot}"
           ${config.format ? `data-ad-format="${config.format}"` : ''}
           ${config.responsive ? `data-full-width-responsive="${config.responsive}"` : ''}
           ${config.layout ? `data-ad-layout="${config.layout}"` : ''}></ins>
    `;

    this.pushAd();
  }
}
