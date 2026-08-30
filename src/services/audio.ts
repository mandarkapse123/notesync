// Voice Note audio recorder and manager using HTML5 MediaRecorder API

export class AudioService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private startTime: number = 0;
  private timerInterval: any = null;

  public async startRecording(
    onTick: (durationSec: number) => void,
    onError?: (err: Error) => void
  ): Promise<boolean> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Determine supported mime type for iOS Safari and other browsers
      const mimeTypes = ['audio/webm', 'audio/mp4', 'audio/aac', 'audio/ogg'];
      const supportedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || '';

      this.mediaRecorder = supportedMimeType 
        ? new MediaRecorder(this.stream, { mimeType: supportedMimeType })
        : new MediaRecorder(this.stream);

      this.audioChunks = [];
      this.startTime = Date.now();

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(100); // collect in 100ms slices

      this.timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        onTick(elapsed);
      }, 200);

      return true;
    } catch (err) {
      console.error('Failed to access microphone:', err);
      if (onError) onError(err as Error);
      return false;
    }
  }

  public stopRecording(): Promise<{ blob: Blob; duration: number }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('MediaRecorder is not active'));
        return;
      }

      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }

      const duration = Math.max(1, Math.floor((Date.now() - this.startTime) / 1000));

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const blob = new Blob(this.audioChunks, { type: mimeType });
        
        // Stop audio tracks to release microphone hardware
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
          this.stream = null;
        }
        
        this.audioChunks = [];
        this.mediaRecorder = null;
        resolve({ blob, duration });
      };

      try {
        this.mediaRecorder.stop();
      } catch (err) {
        reject(err);
      }
    });
  }

  public cancelRecording() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch (e) {}
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.audioChunks = [];
    this.mediaRecorder = null;
  }
}

export const audioService = new AudioService();
