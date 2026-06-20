import { useState } from 'react';

interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 32, className = '' }: LogoProps) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className={`logo-wrap ${className}`.trim()} style={{ width: size, height: size }}>
      {!imgFailed ? (
        <img
          src="/logo.png"
          alt="SIMPA"
          width={size}
          height={size}
          className="logo-img"
          onError={() => setImgFailed(true)}
        />
      ) : null}
      <div className="logo-fallback" style={{ display: imgFailed ? 'flex' : 'none' }}>
        S
      </div>
    </div>
  );
}
