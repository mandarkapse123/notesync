// Speech-to-Text service utilizing the Web Speech API (supported in iOS Safari as webkitSpeechRecognition)

interface IWindow extends Window {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
}

export class SpeechService {
  private recognition: any = null;
  private isListening = false;
  private onTranscriptCallback: ((text: string, isFinal: boolean) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private onStateChangeCallback: ((isListening: boolean) => void) | null = null;

  constructor() {
    const win = window as unknown as IWindow;
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (SpeechRecognitionClass) {
      this.recognition = new SpeechRecognitionClass();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const text = finalTranscript || interimTranscript;
        if (this.onTranscriptCallback && text.trim()) {
          this.onTranscriptCallback(text, Boolean(finalTranscript));
        }
      };

      this.recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error !== 'no-speech' && this.onErrorCallback) {
          this.onErrorCallback(event.error);
        }
      };

      this.recognition.onend = () => {
        this.isListening = false;
        if (this.onStateChangeCallback) {
          this.onStateChangeCallback(false);
        }
      };
    }
  }

  public isSupported(): boolean {
    return Boolean(this.recognition);
  }

  public start(
    onTranscript: (text: string, isFinal: boolean) => void,
    onStateChange: (isListening: boolean) => void,
    onError?: (error: string) => void
  ) {
    if (!this.recognition) {
      if (onError) onError('Speech recognition is not supported in this browser.');
      return;
    }

    if (this.isListening) {
      this.stop();
      return;
    }

    this.onTranscriptCallback = onTranscript;
    this.onStateChangeCallback = onStateChange;
    this.onErrorCallback = onError || null;

    try {
      this.recognition.start();
      this.isListening = true;
      this.onStateChangeCallback(true);
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
    }
  }

  public stop() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (err) {
        console.error('Error stopping speech recognition:', err);
      }
    }
    this.isListening = false;
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(false);
    }
  }
}

export const speechService = new SpeechService();
