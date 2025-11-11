/**
 * Note Assistant Page JavaScript
 */

class NoteAssistantManager {
    constructor() {
        this.isRecording = false;
        this.recordingTime = 0;
        this.timerInterval = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.init();
    }
    
    init() {
        this.bindEventListeners();
    }
    
    bindEventListeners() {
        const recordBtn = document.getElementById('recordBtn');
        const uploadBtn = document.getElementById('uploadBtn');
        const transcribeBtn = document.getElementById('transcribeBtn');
        
        if (recordBtn) {
            recordBtn.addEventListener('click', () => this.toggleRecording());
        }
        
        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => this.uploadAudio());
        }
        
        if (transcribeBtn) {
            transcribeBtn.addEventListener('click', () => this.generateNote());
        }
    }
    
    async toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            await this.startRecording();
        }
    }
    
    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };
            
            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                this.handleAudioRecorded(audioBlob);
            };
            
            this.mediaRecorder.start();
            this.isRecording = true;
            this.recordingTime = 0;
            
            this.updateRecordingUI();
            this.startTimer();
            
            Utils.showNotification('Recording started', 'success');
        } catch (error) {
            console.error('Failed to start recording:', error);
            Utils.showNotification('Cannot access microphone', 'error');
        }
    }
    
    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            this.isRecording = false;
            this.stopTimer();
            this.updateRecordingUI();
            Utils.showNotification('Recording stopped', 'info');
        }
    }
    
    startTimer() {
        this.timerInterval = setInterval(() => {
            this.recordingTime++;
            this.updateTimeDisplay();
        }, 1000);
    }
    
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
    
    updateTimeDisplay() {
        const minutes = Math.floor(this.recordingTime / 60);
        const seconds = this.recordingTime % 60;
        const timeDisplay = document.querySelector('.recording-time');
        if (timeDisplay) {
            timeDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
    }
    
    updateRecordingUI() {
        const recordBtn = document.getElementById('recordBtn');
        const statusDisplay = document.querySelector('.recording-status');
        const transcribeBtn = document.getElementById('transcribeBtn');
        
        if (recordBtn) {
            if (this.isRecording) {
                recordBtn.classList.add('recording');
                recordBtn.innerHTML = '<i class="fas fa-stop"></i>';
            } else {
                recordBtn.classList.remove('recording');
                recordBtn.innerHTML = '<i class="fas fa-microphone"></i>';
            }
        }
        
        if (statusDisplay) {
            statusDisplay.textContent = this.isRecording ? 'Recording...' : 'Ready to record';
        }
        
        if (transcribeBtn) {
            transcribeBtn.disabled = this.isRecording || this.audioChunks.length === 0;
        }
    }
    
    handleAudioRecorded(audioBlob) {
        console.log('Audio recorded:', audioBlob.size, 'bytes');
        const transcribeBtn = document.getElementById('transcribeBtn');
        if (transcribeBtn) {
            transcribeBtn.disabled = false;
        }
    }
    
    uploadAudio() {
        fileUploader.selectFile('audio/*', async (file) => {
            console.log('Audio file selected:', file.name);
            Utils.showNotification('Uploading audio...', 'info');
            
            const result = await fileUploader.uploadFile(file, '/note/transcribe');
            if (result && result.success) {
                Utils.showNotification('Audio uploaded successfully', 'success');
                this.displayTranscription(result.transcription);
            }
        });
    }
    
    async generateNote() {
        Utils.showNotification('Generating note...', 'info');
        
        const result = await Utils.apiCall('/note/generate', 'POST', {
            text: 'Sample transcription text'
        });
        
        if (result && result.success) {
            Utils.showNotification('Note generated successfully', 'success');
            console.log('Generated note:', result.notes);
        }
    }
    
    displayTranscription(text) {
        console.log('Transcription:', text);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const noteManager = new NoteAssistantManager();
    console.log('Note Assistant initialized');
});
