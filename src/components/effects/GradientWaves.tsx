import { useEffect, useRef } from 'react';
import './GradientWaves.css';

export interface GradientWavesProps {
  /** 波速。越大横向流动越快，0.5 左右是「看得出在动，但不催人」 */
  speed?: number;
  /** 振幅，按容器高度的百分比算。旧版本当成像素用，2.5px 的波等于没有波 */
  amplitude?: number;
  /** 横向频率：一整屏里放多少个波峰 */
  waveScale?: number;
  /** 叠几条波带。越多越像远处的浪，越少越像一道光 */
  bands?: number;
  className?: string;
}

/**
 * 三层正弦波叠出来的「渐变浪」。
 *
 * 只有两个地方用它：404 页的背景、/craft 的展位。
 *
 * 之前那版有三个问题，一起改掉了：
 *
 * 1. 波是平的。`amplitude` 默认 2.5 被当成像素用，五条波叠起来振幅不到 2px，
 *    屏幕上看到的其实是「一块从中间铺到底的渐变色」，不是波。现在按容器高度的
 *    百分比算，默认 9%。
 * 2. 浅色主题几乎看不见。原来写死 #4f46e5 / #9333ea / #ec4899，再乘 0.6 透明度 ——
 *    同样的半透明色叠在近黑底上是有光的，叠在白底上只得到一点淡紫。
 *    现在颜色从 CSS 变量取（brand / topic-design / brand-2），跟着 data-theme 走；
 *    混合模式也分主题：深色 screen（光往上加），浅色 multiply（墨往纸里渗）。
 * 3. 属性是死的。`height` 和 `waveRatio` 传进来根本没用到；`resize` 里还对
 *    context 做 scale，每 resize 一次就再乘一次 DPR，越缩越糊。
 *    现在 resize 用 setTransform 覆盖而不是累乘，并且改用 ResizeObserver。
 *
 * 另外按站里的规矩：`prefers-reduced-motion` 下只画一帧静图，不跑 RAF。
 */
export default function GradientWaves({
  speed = 0.5,
  amplitude = 9,
  waveScale = 1.1,
  bands = 3,
  className = '',
}: GradientWavesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const root = document.documentElement;

    /*
     * canvas 里不能用 var()，只能把主题色读成具体的色值。
     * 读一次不够 —— 切主题时 data-theme 会变，所以挂 MutationObserver，
     * 切完下一帧就是新配色，不用重挂组件。
     */
    let palette = ['#7b6cff', '#f472b6', '#3ea6ff'];
    let isLight = false;
    const readTheme = () => {
      const style = getComputedStyle(canvas);
      const pick = (name: string, fallback: string) =>
        style.getPropertyValue(name).trim() || fallback;
      palette = [
        pick('--brand', '#7b6cff'),
        pick('--topic-design', '#f472b6'),
        pick('--brand-2', '#3ea6ff'),
      ];
      isLight = root.dataset.theme === 'light';
    };
    readTheme();

    const themeObserver = new MutationObserver(readTheme);
    themeObserver.observe(root, { attributes: true, attributeFilter: ['data-theme'] });

    let width = 0;
    let height = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      // 封顶 2：3× 屏上画布像素数会翻三倍，而这种大面积柔和渐变看不出差别
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      // setTransform 是覆盖，scale 是累乘 —— 后者每 resize 一次就多糊一层
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(canvas);
    resize();

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    let frame = 0;
    let time = 0;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      ctx.globalCompositeOperation = isLight ? 'multiply' : 'screen';

      for (let i = 0; i < bands; i += 1) {
        const progress = bands === 1 ? 0 : i / (bands - 1);
        const baseline = height * (0.46 + progress * 0.3);
        const swing = ((height * amplitude) / 100) * (1 - progress * 0.3);
        const phase = time * speed + i * 1.7;
        const color = palette[i % palette.length];

        // 先算好整条波脊：填充和描边共用同一组点，避免两次采样走出不同的形状
        const points: Array<[number, number]> = [];
        for (let x = 0; x <= width; x += 4) {
          const t = (x / width) * Math.PI * 2 * waveScale;
          const y =
            baseline +
            Math.sin(t + phase) * swing * (0.72 + 0.28 * Math.sin(time * 0.3 + i)) +
            Math.sin(t * 2.3 - phase * 1.4) * swing * 0.22;
          points.push([x, y]);
        }

        const crest = Math.min(...points.map(([, y]) => y));
        const gradient = ctx.createLinearGradient(0, crest, 0, height);
        gradient.addColorStop(0, color);
        gradient.addColorStop(0.45, color);
        gradient.addColorStop(1, 'transparent');

        ctx.globalAlpha = isLight ? 0.45 : 0.55;
        ctx.beginPath();
        ctx.moveTo(0, height);
        for (const [x, y] of points) ctx.lineTo(x, y);
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // 波脊上一条细线：没有它，几条波带的交界只是一片色块渐变，看不出「浪」
        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        for (const [x, y] of points) ctx.lineTo(x, y);
        ctx.strokeStyle = color;
        ctx.globalAlpha = isLight ? 0.38 : 0.5;
        ctx.lineWidth = 1.25;
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      if (reduced.matches) return;
      time += 0.016;
      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);

    // 系统里随时可能打开「减少动态效果」，改完立刻停，而不是等下次进页面
    const onPreferenceChange = () => {
      cancelAnimationFrame(frame);
      if (reduced.matches) draw();
      else frame = requestAnimationFrame(draw);
    };
    reduced.addEventListener('change', onPreferenceChange);

    return () => {
      cancelAnimationFrame(frame);
      sizeObserver.disconnect();
      themeObserver.disconnect();
      reduced.removeEventListener('change', onPreferenceChange);
    };
  }, [speed, amplitude, waveScale, bands]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`gradient-waves-canvas ${className}`}
      style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
    />
  );
}
