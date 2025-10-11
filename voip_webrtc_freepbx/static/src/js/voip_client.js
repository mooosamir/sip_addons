/** @odoo-module **/

/**
 * VoIP WebRTC Client
 * 
 * This client handles WebRTC connections to FreePBX server
 * using SIP protocol for voice calls.
 */

export class VoipClient {
    constructor(config, voipService) {
        this.config = config;
        this.voipService = voipService;
        this.userAgent = null;
        this.currentSession = null;
        this.isRegistered = false;
        this.remoteAudio = null;
        this.localAudio = null;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        
        this.initAudioElements();
    }

    /**
     * Initialize audio elements for playback
     */
    initAudioElements() {
        // Create remote audio element for incoming audio
        this.remoteAudio = document.createElement('audio');
        this.remoteAudio.autoplay = true;
        this.remoteAudio.id = 'voip-remote-audio';
        document.body.appendChild(this.remoteAudio);

        // Create local audio element for outgoing audio
        this.localAudio = document.createElement('audio');
        this.localAudio.muted = true;
        this.localAudio.id = 'voip-local-audio';
        document.body.appendChild(this.localAudio);
    }

    /**
     * Initialize SIP User Agent
     * Note: In production, you would use SIP.js library
     * This is a simplified implementation showing the structure
     */
    async initialize() {
        try {
            console.log('Initializing VoIP client...');
            
            // In a real implementation, you would initialize SIP.js here
            // Example with SIP.js (requires sip.js library):
            /*
            const { UserAgent, Registerer, Inviter } = window.SIP;
            
            const uri = UserAgent.makeURI(`sip:${this.config.user.username}@${this.config.server.realm}`);
            
            const transportOptions = {
                server: this.config.server.websocket_url,
            };
            
            const userAgentOptions = {
                authorizationUsername: this.config.user.username,
                authorizationPassword: this.config.user.password,
                uri: uri,
                transportOptions: transportOptions,
                sessionDescriptionHandlerFactoryOptions: {
                    peerConnectionConfiguration: {
                        iceServers: this.getIceServers(),
                    }
                }
            };
            
            this.userAgent = new UserAgent(userAgentOptions);
            
            // Handle incoming calls
            this.userAgent.delegate = {
                onInvite: (invitation) => {
                    this.handleIncomingCall(invitation);
                }
            };
            
            await this.userAgent.start();
            await this.register();
            */
            
            // Simplified version for demonstration
            console.log('VoIP client initialized with config:', this.config);
            this.isRegistered = true;
            
            return true;
        } catch (error) {
            console.error('Failed to initialize VoIP client:', error);
            return false;
        }
    }

    /**
     * Get ICE servers configuration for WebRTC
     */
    getIceServers() {
        const iceServers = [];
        
        // Add STUN server
        if (this.config.server.stun_server) {
            iceServers.push({
                urls: this.config.server.stun_server
            });
        }
        
        // Add TURN server if configured
        if (this.config.server.turn_server) {
            iceServers.push({
                urls: this.config.server.turn_server,
                username: this.config.server.turn_username,
                credential: this.config.server.turn_password
            });
        }
        
        return iceServers;
    }

    /**
     * Register with SIP server
     */
    async register() {
        try {
            console.log('Registering with SIP server...');
            
            // In real implementation with SIP.js:
            /*
            const registerer = new Registerer(this.userAgent);
            await registerer.register();
            */
            
            this.isRegistered = true;
            console.log('Successfully registered with SIP server');
            return true;
        } catch (error) {
            console.error('Failed to register with SIP server:', error);
            return false;
        }
    }

    /**
     * Make an outbound call
     */
    async makeCall(phoneNumber) {
        try {
            console.log('Making call to:', phoneNumber);
            
            // Get user media (microphone)
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false
            });
            
            // In real implementation with SIP.js:
            /*
            const target = UserAgent.makeURI(`sip:${phoneNumber}@${this.config.server.realm}`);
            const inviter = new Inviter(this.userAgent, target, {
                sessionDescriptionHandlerOptions: {
                    constraints: {
                        audio: true,
                        video: false
                    }
                }
            });
            
            await inviter.invite();
            this.currentSession = inviter;
            
            // Setup audio streams
            inviter.stateChange.addListener((state) => {
                if (state === SessionState.Established) {
                    this.setupRemoteAudio(inviter);
                    if (this.config.user.enable_recording) {
                        this.startRecording(stream);
                    }
                }
            });
            */
            
            // Simplified version
            console.log('Call initiated to:', phoneNumber);
            
            // Start recording if enabled
            if (this.config.user.enable_recording) {
                this.startRecording(stream);
            }
            
            return true;
        } catch (error) {
            console.error('Failed to make call:', error);
            return false;
        }
    }

    /**
     * Handle incoming call
     */
    handleIncomingCall(invitation) {
        console.log('Incoming call from:', invitation.remoteIdentity);
        
        // In real implementation:
        /*
        invitation.stateChange.addListener((state) => {
            if (state === SessionState.Established) {
                this.setupRemoteAudio(invitation);
            }
        });
        */
        
        this.currentSession = invitation;
        
        // Trigger incoming call notification
        // This would integrate with Odoo's notification system
        this.voipService.onIncomingCall && this.voipService.onIncomingCall(invitation);
    }

    /**
     * Answer incoming call
     */
    async answerCall() {
        try {
            if (!this.currentSession) {
                console.error('No active session to answer');
                return false;
            }
            
            // Get user media
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false
            });
            
            // In real implementation:
            /*
            await this.currentSession.accept({
                sessionDescriptionHandlerOptions: {
                    constraints: {
                        audio: true,
                        video: false
                    }
                }
            });
            
            this.setupRemoteAudio(this.currentSession);
            */
            
            console.log('Call answered');
            
            // Start recording if enabled
            if (this.config.user.enable_recording) {
                this.startRecording(stream);
            }
            
            return true;
        } catch (error) {
            console.error('Failed to answer call:', error);
            return false;
        }
    }

    /**
     * Hang up current call
     */
    async hangup() {
        try {
            if (!this.currentSession) {
                console.log('No active session to hang up');
                return false;
            }
            
            // Stop recording
            this.stopRecording();
            
            // In real implementation:
            /*
            await this.currentSession.bye();
            */
            
            console.log('Call ended');
            this.currentSession = null;
            
            return true;
        } catch (error) {
            console.error('Failed to hang up call:', error);
            return false;
        }
    }

    /**
     * Setup remote audio stream
     */
    setupRemoteAudio(session) {
        // In real implementation:
        /*
        const remoteStream = new MediaStream();
        session.sessionDescriptionHandler.peerConnection.getReceivers().forEach((receiver) => {
            if (receiver.track) {
                remoteStream.addTrack(receiver.track);
            }
        });
        this.remoteAudio.srcObject = remoteStream;
        */
    }

    /**
     * Start recording the call
     */
    startRecording(stream) {
        try {
            this.recordedChunks = [];
            
            // Create MediaRecorder
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                this.saveRecording();
            };
            
            this.mediaRecorder.start(1000); // Collect data every second
            console.log('Recording started');
        } catch (error) {
            console.error('Failed to start recording:', error);
        }
    }

    /**
     * Stop recording the call
     */
    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
            console.log('Recording stopped');
        }
    }

    /**
     * Save recording to server
     */
    async saveRecording() {
        if (this.recordedChunks.length === 0) {
            return;
        }
        
        try {
            const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
            
            // Create recording record
            const result = await this.voipService.rpc('/voip/recording/create', {
                call_id: this.voipService.getCurrentCall(),
                format: 'webm',
            });
            
            if (result.success) {
                // Upload recording file
                const formData = new FormData();
                formData.append('file', blob, 'recording.webm');
                
                await fetch(`/voip/recording/upload?recording_id=${result.recording_id}`, {
                    method: 'POST',
                    body: formData,
                });
                
                console.log('Recording saved successfully');
            }
        } catch (error) {
            console.error('Failed to save recording:', error);
        }
    }

    /**
     * Unregister and cleanup
     */
    async disconnect() {
        try {
            if (this.currentSession) {
                await this.hangup();
            }
            
            // In real implementation:
            /*
            if (this.userAgent) {
                await this.userAgent.stop();
            }
            */
            
            this.isRegistered = false;
            console.log('VoIP client disconnected');
            
            return true;
        } catch (error) {
            console.error('Failed to disconnect VoIP client:', error);
            return false;
        }
    }

    /**
     * Check if client is registered
     */
    isClientRegistered() {
        return this.isRegistered;
    }

    /**
     * Get current session
     */
    getCurrentSession() {
        return this.currentSession;
    }
}
