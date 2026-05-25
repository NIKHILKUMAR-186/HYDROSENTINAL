export const optimizeImageForMobile = (src: string, lowQuality?: string) => {
  // Mobile-specific optimization removed — always return full-quality image
  return src;
};

// Lazy load images with IntersectionObserver
export const lazyLoadImages = () => {
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            imageObserver.unobserve(img);
          }
        }
      });
    });

    const images = document.querySelectorAll('img[data-src]');
    images.forEach((img) => imageObserver.observe(img));
  }
};

// Detect device capability for smart performance
export const getDevicePerformanceLevel = () => {
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as any).deviceMemory || 4;
  const connection = (navigator as any).connection?.effectiveType || '4g';

  if (cores <= 2 || memory <= 2 || connection === '3g') {
    return 'low';
  } else if (cores <= 4 || memory <= 4 || connection === '4g') {
    return 'medium';
  }
  return 'high';
};

// Progressive image loading with LQIP (Low Quality Image Placeholder)
export const createProgressiveImageStyle = (placeholder: string) => ({
  backgroundImage: `url(${placeholder})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  filter: 'blur(20px)',
  transition: 'filter 0.3s ease',
});
