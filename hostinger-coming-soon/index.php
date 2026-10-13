<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Lotti Baby - Launch Day</title>
  <meta name="description" content="Lotti Baby - New Chapter, coming soon.">
  <meta name="theme-color" content="#FFFFFF">
  <link rel="icon" type="image/png" href="icon.PNG">
  <link rel="apple-touch-icon" href="icon.PNG">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #FFFFFF;
      --beige: #C8BBAB;
      --beige-light: #E2DBD1;
      --beige-box: #E5DED5;
      --brown: #7A6B5D;
      --brown-dark: #5C4D40;
      --brown-text: #4A3F35;
      --muted: #9E9080;
      --ok: #6B9E8A;
      --error: #C4605A;
    }

    html, body {
      width: 100%;
      min-height: 100%;
    }

    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: var(--bg);
      color: var(--brown-text);
      min-height: 100vh;
      min-height: 100svh;
      min-height: 100dvh;
      overflow-x: hidden;
    }

    .wrapper {
      width: 100%;
      min-height: 100vh;
      min-height: 100svh;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: max(6px, env(safe-area-inset-top)) 20px 24px;
    }

    .heading {
      margin-bottom: 28px;
      text-align: center;
      animation: fadeIn 0.8s ease-out both;
    }

    .heading-launch,
    .heading-day {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: clamp(4rem, 14vw, 9rem);
      font-weight: 400;
      letter-spacing: 0.14em;
      line-height: 1;
      text-transform: uppercase;
    }

    .heading-launch { color: var(--beige); }
    .heading-day { color: var(--brown); }

    .subtitle {
      font-family: 'Playfair Display', Georgia, serif;
      font-style: italic;
      font-weight: 400;
      font-size: clamp(1.1rem, 3vw, 1.5rem);
      color: var(--brown-dark);
      line-height: 1.65;
      margin-bottom: 44px;
      text-align: center;
      animation: fadeIn 0.8s ease-out 0.1s both;
    }

    .countdown {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: clamp(14px, 3vw, 28px);
      width: 100%;
      max-width: 900px;
      animation: fadeIn 0.8s ease-out both;
    }

    .app-icon {
      width: clamp(110px, 14vw, 150px);
      height: clamp(110px, 14vw, 150px);
      object-fit: contain;
      margin: 0 0 24px;
      display: block;
      animation: fadeIn 0.8s ease-out 0.12s both;
    }

    .countdown-box {
      background: var(--beige-box);
      border-radius: 16px;
      padding: clamp(24px, 5vw, 44px) 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }

    .countdown-number {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: clamp(3rem, 10vw, 6rem);
      font-weight: 400;
      color: #FFFFFF;
      line-height: 1;
      letter-spacing: 0.02em;
      text-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }

    .countdown-label {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: clamp(0.9rem, 2.5vw, 1.2rem);
      font-weight: 400;
      color: var(--brown);
      letter-spacing: 0.05em;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @media (max-width: 480px) {
      .wrapper {
        padding: 4px 14px 20px;
      }

      .heading {
        margin-bottom: 16px;
      }

      .heading-launch,
      .heading-day {
        font-size: clamp(3.2rem, 18vw, 5.4rem);
        letter-spacing: 0.09em;
      }

      .subtitle {
        margin-bottom: 20px;
        line-height: 1.45;
      }

      .app-icon {
        width: clamp(104px, 30vw, 138px);
        height: clamp(104px, 30vw, 138px);
        margin-bottom: 16px;
      }

      .countdown {
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
      }

      .countdown-box {
        border-radius: 12px;
        padding: 20px 8px;
      }

    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="heading">
      <div class="heading-launch">Launch</div>
      <div class="heading-day">Day</div>
    </div>

    <p class="subtitle">
      New Chapter &ndash; coming soon<br>
      Lotti Baby
    </p>

    <img class="app-icon" src="icon.PNG" alt="Lotti Baby App Icon">

    <div class="countdown">
      <div class="countdown-box">
        <span class="countdown-number" id="days">00</span>
        <span class="countdown-label">Days</span>
      </div>
      <div class="countdown-box">
        <span class="countdown-number" id="hours">00</span>
        <span class="countdown-label">Hours</span>
      </div>
      <div class="countdown-box">
        <span class="countdown-number" id="minutes">00</span>
        <span class="countdown-label">Minutes</span>
      </div>
      <div class="countdown-box">
        <span class="countdown-number" id="seconds">00</span>
        <span class="countdown-label">Seconds</span>
      </div>
    </div>
  </div>

  <script>
    var LAUNCH = new Date('2026-02-14T10:00:00+01:00').getTime();
    var MIN_EMBED_HEIGHT = 980;
    var IN_EMBED = false;

    try {
      IN_EMBED = window.self !== window.top || !!window.frameElement;
    } catch (e) {
      IN_EMBED = true;
    }

    var $d = document.getElementById('days');
    var $h = document.getElementById('hours');
    var $m = document.getElementById('minutes');
    var $s = document.getElementById('seconds');

    function pad(n) { return String(n).padStart(2, '0'); }

    function tick() {
      var diff = LAUNCH - Date.now();
      if (diff <= 0) { $d.textContent = '00'; $h.textContent = '00'; $m.textContent = '00'; $s.textContent = '00'; return; }
      var days = Math.floor(diff / 86400000); diff %= 86400000;
      var hours = Math.floor(diff / 3600000); diff %= 3600000;
      var mins = Math.floor(diff / 60000); diff %= 60000;
      var secs = Math.floor(diff / 1000);
      $d.textContent = pad(days);
      $h.textContent = pad(hours);
      $m.textContent = pad(mins);
      $s.textContent = pad(secs);
    }

    function syncEmbedHeight() {
      if (!IN_EMBED) {
        return;
      }

      var contentHeight = Math.max(
        document.body ? document.body.scrollHeight : 0,
        document.documentElement ? document.documentElement.scrollHeight : 0,
        MIN_EMBED_HEIGHT
      );

      try {
        if (window.frameElement) {
          window.frameElement.style.height = contentHeight + 'px';
          window.frameElement.style.minHeight = contentHeight + 'px';
          window.frameElement.setAttribute('height', String(contentHeight));
        }
      } catch (e) {}
    }

    tick();
    setInterval(tick, 1000);
    syncEmbedHeight();
    setTimeout(syncEmbedHeight, 250);
    setTimeout(syncEmbedHeight, 1000);
    window.addEventListener('resize', syncEmbedHeight);
  </script>
</body>
</html>
