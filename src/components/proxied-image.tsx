import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api';

interface ProxiedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    placeholderSrc?: string;
}

export function ProxiedImage({ src, placeholderSrc = '/tauri.svg', ...props }: ProxiedImageProps) {
    const [imageSrc, setImageSrc] = useState<string | undefined>(placeholderSrc);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (src) {
            invoke<string>('proxy_fetch_image', { url: src })
                .then(dataUrl => {
                    setImageSrc(dataUrl);
                    setError(false);
                })
                .catch(err => {
                    console.error("Failed to proxy image:", err);
                    setError(true);
                    setImageSrc(placeholderSrc);
                });
        } else {
            setImageSrc(placeholderSrc);
        }
    }, [src, placeholderSrc]);

    return <img src={imageSrc} {...props} />;
} 