declare module 'react-native-background-timer' {
  const BackgroundTimer: {
    setInterval(handler: () => void, timeout: number): number;
    clearInterval(intervalId: number): void;
    setTimeout(handler: () => void, timeout: number): number;
    clearTimeout(timeoutId: number): void;
  };

  export default BackgroundTimer;
}
