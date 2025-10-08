import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

const LazyImage = ({ 
  src, 
  alt, 
  className = '', 
  placeholderClassName = '',
  onLoad,
  onError
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '50px'
      }
    );

    observer.observe(imgRef.current);

    return () => {
      if (imgRef.current) {
        observer.unobserve(imgRef.current);
      }
    };
  }, []);

  const handleLoad = () => {
    setIsLoaded(true);
    if (onLoad) onLoad();
  };

  const handleError = () => {
    setError(true);
    if (onError) onError();
  };

  return (
    <div ref={imgRef} className={`relative ${className}`}>
      {!isLoaded && !error && (
        <div className={`absolute inset-0 flex items-center justify-center bg-accent dark:bg-accent-dark ${placeholderClassName}`}>
          <Loader2 className="w-8 h-8 animate-spin text-primary dark:text-primary-dark" />
        </div>
      )}
      
      {error && (
        <div className={`absolute inset-0 flex items-center justify-center bg-error/10 ${placeholderClassName}`}>
          <span className="text-error text-sm">Failed to load image</span>
        </div>
      )}
      
      {isInView && !error && (
        <img
          src={src}
          alt={alt}
          className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
        />
      )}
    </div>
  );
};

export default LazyImage;