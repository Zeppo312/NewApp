import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

type Scene = {
  from: number;
  to: number;
  image: string;
  eyebrow: string;
  title: string;
  dark?: boolean;
};

const scenes: Scene[] = [
  {
    from: 0,
    to: 84,
    image: 'partner-post/01_accounts-linked.png',
    eyebrow: 'Gemeinsam starten',
    title: 'Lotti Baby ist\nnicht nur für Mamas.',
  },
  {
    from: 84,
    to: 180,
    image: 'partner-post/02_partner-update.png',
    eyebrow: 'Ein gemeinsamer Alltag',
    title: 'Er startet den Schlaf.\nDu siehst es sofort.',
  },
  {
    from: 180,
    to: 300,
    image: 'partner-post/03_shared-overview.png',
    eyebrow: 'Ein gemeinsamer Überblick',
    title: 'Ein Baby.\nEin Überblick.',
  },
  {
    from: 300,
    to: 450,
    image: 'partner-post/04_partner-notification.png',
    eyebrow: 'Auch nachts ein Team',
    title: 'Weniger: „Was war nochmal?“\nMehr: „Wir haben’s im Blick.“',
    dark: true,
  },
];

const fade = (frame: number, from: number, to: number) =>
  Math.min(
    interpolate(frame, [from, from + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
    interpolate(frame, [to - 12, to], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
  );

export const PartnerPost = () => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: '#fff8f0', fontFamily: 'Arial, sans-serif' }}>
      {scenes.map((scene) => {
        const opacity = fade(frame, scene.from, scene.to);
        const localFrame = frame - scene.from;
        const scale = interpolate(localFrame, [0, scene.to - scene.from], [1.11, 1.01], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const copyOpacity = interpolate(localFrame, [10, 24], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        return (
          <AbsoluteFill key={scene.image} style={{ opacity, overflow: 'hidden' }}>
            <Img
              src={staticFile(scene.image)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: `scale(${scale})`,
              }}
            />
            <AbsoluteFill
              style={{
                justifyContent: 'flex-end',
                padding: '0 62px 120px',
                background: scene.dark
                  ? 'linear-gradient(transparent 40%, rgba(0,0,0,0.68) 100%)'
                  : 'linear-gradient(transparent 50%, rgba(255,248,240,0.9) 100%)',
                color: scene.dark ? '#fff' : '#5c4033',
                opacity: copyOpacity,
              }}
            >
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 1.1, marginBottom: 16, color: scene.dark ? '#cde4dc' : '#8e4ec6' }}>
                {scene.eyebrow.toUpperCase()}
              </div>
              <div style={{ fontSize: 54, lineHeight: 1.08, fontWeight: 800, whiteSpace: 'pre-line', letterSpacing: -1.8 }}>
                {scene.title}
              </div>
            </AbsoluteFill>
          </AbsoluteFill>
        );
      })}
      <div style={{ position: 'absolute', top: 52, left: 0, right: 0, textAlign: 'center', fontSize: 21, fontWeight: 800, color: '#7d5a50' }}>
        LOTTI BABY
      </div>
      <div style={{ position: 'absolute', bottom: 38, left: 0, right: 0, textAlign: 'center', fontSize: 18, fontWeight: 700, color: height > 1000 ? '#7d5a50' : '#5c4033' }}>
        Gemeinsam im Blick
      </div>
    </AbsoluteFill>
  );
};
