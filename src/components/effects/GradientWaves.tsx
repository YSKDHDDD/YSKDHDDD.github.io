import { useEffect, useRef } from 'react';
import './GradientWaves.css';

export interface GradientWavesProps {
  height?: number;
  speed?: number;
  amplitude?: number;
  waveScale?: number;
  waveRatio?: number;
  horizonColor?: string;
  waveColor?: string;
  crestColor?: string;
  className?: string;
}

export default function GradientWaves({
  height = 100,
  speed = 0.4,
  amplitude = 2.5,
  waveScale = 0.6,
  waveRatio = 0.9,
  horizonColor = '#4f46e5',
  waveColor = '#9333ea',
  crestColor = '#ec4899',
  className = ''
}: GradientWavesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;
    let animationId: number;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    const draw = () => {
      if (!canvas) return;

      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Create gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, horizonColor);
      gradient.addColorStop(0.5, waveColor);
      gradient.addColorStop(1, crestColor);

      // Draw waves
      const waves = 5;
      for (let i = 0; i < waves; i++) {
        ctx.beginPath();
        ctx.moveTo(0, height);

        for (let x = 0; x <= width; x += 5) {
          const y = height / 2 +
            Math.sin((x * waveRatio) / width * Math.PI * 2 + time * speed + i) *
            amplitude * Math.sin(time * 0.5 + i * 0.5) +
            Math.sin((x * waveRatio * 2) / width * Math.PI * 2 + time * speed * 1.5) * amplitude * 0.5;

          ctx.lineTo(x, y);
        }

        ctx.lineTo(width, height);
        ctx.closePath();

        const alpha = 1 - (i / waves);
        ctx.fillStyle = gradient;
        ctx.globalAlpha = alpha * 0.6;
        ctx.fill();
      }

      time += 0.01;
      animationId = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    animationId = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, [height, speed, amplitude, waveScale, waveRatio, horizonColor, waveColor, crestColor]);

  return (
    <canvas
      ref={canvasRef}
      className={`gradient-waves-canvas ${className}`}
      style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
    />
  );
}
