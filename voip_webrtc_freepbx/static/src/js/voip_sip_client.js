/** @odoo-module **/

/**
 * VoIP SIP Client using SIP.js
 * 
 * Based on Browser-Phone project by InnovateAsterisk
 * https://github.com/InnovateAsterisk/Browser-Phone
 * 
 * This implementation uses SIP.js 0.20.0 for WebRTC calls
 * 
 * REQUIREMENTS:
 * - HTTPS connection (required for getUserMedia)
 * - Modern browser with WebRTC support
 * - User microphone permissions
 * - Valid FreePBX/Asterisk server with WebSocket support
 */

export class VoipSipClient {
    constructor(config, voipService) {
        this.config = config;
        this.voipService = voipService;
        this.userAgent = null;
        this.currentSession = null;
        this.isRegistered = false;
        this.remoteAudio = null;
        this.localStream = null;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        
        // Audio feedback elements
        this.ringbackTone = null;
        this.busyTone = null;
        this.ringTone = null;
        
        // Check if SIP.js is loaded
        if (typeof window.SIP === 'undefined') {
            console.error('SIP.js library not loaded');
            throw new Error('SIP.js library not loaded. Please check your assets configuration.');
        }
        
        this.initAudioElements();
        this.initCallTones();
    }

    /**
     * Initialize audio elements for playback
     */
    initAudioElements() {
        // Create remote audio element for incoming audio
        if (!document.getElementById('voip-remote-audio')) {
            this.remoteAudio = document.createElement('audio');
            this.remoteAudio.autoplay = true;
            this.remoteAudio.id = 'voip-remote-audio';
            document.body.appendChild(this.remoteAudio);
        } else {
            this.remoteAudio = document.getElementById('voip-remote-audio');
        }
    }

    /**
     * Initialize call tones (ringback, busy, ring)
     */
    initCallTones() {
        // Ringback tone (صوت الرنين عند الاتصال)
        this.ringbackTone = new Audio();
        this.ringbackTone.loop = true;
        this.ringbackTone.volume = 0.5;
        
        // Busy tone (صوت مشغول)
        this.busyTone = new Audio();
        this.busyTone.loop = false;
        this.busyTone.volume = 0.7;
        
        // Ring tone (صوت رنين المكالمة الواردة)
        this.ringTone = new Audio();
        this.ringTone.loop = true;
        this.ringTone.volume = 0.8;
        
        // Generate tones using Web Audio API
        this.generateCallTones();
    }

    /**
     * Generate call tones using Web Audio API
     */
    generateCallTones() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Generate Ringback Tone (440Hz + 480Hz for 2s on, 4s off)
            this.ringbackTone.src = this.createRingbackTone(audioContext);
            
            // Generate Busy Tone (480Hz + 620Hz for 0.5s on, 0.5s off)
            this.busyTone.src = this.createBusyTone(audioContext);
            
            // Generate Ring Tone (440Hz sine wave)
            this.ringTone.src = this.createRingTone(audioContext);
            
        } catch (error) {
            console.warn('Could not generate call tones:', error);
        }
    }

    /**
     * Create ringback tone
     */
    createRingbackTone(audioContext) {
        const duration = 2;
        const sampleRate = audioContext.sampleRate;
        const buffer = audioContext.createBuffer(1, duration * sampleRate, sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < buffer.length; i++) {
            const t = i / sampleRate;
            // Mix 440Hz and 480Hz
            data[i] = (Math.sin(2 * Math.PI * 440 * t) + Math.sin(2 * Math.PI * 480 * t)) * 0.3;
        }
        
        return this.bufferToWave(buffer, buffer.length);
    }

    /**
     * Create busy tone
     */
    createBusyTone(audioContext) {
        const duration = 3;
        const sampleRate = audioContext.sampleRate;
        const buffer = audioContext.createBuffer(1, duration * sampleRate, sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < buffer.length; i++) {
            const t = i / sampleRate;
            const cycle = Math.floor(t * 2); // 0.5s cycles
            if (cycle % 2 === 0) {
                // Mix 480Hz and 620Hz
                data[i] = (Math.sin(2 * Math.PI * 480 * t) + Math.sin(2 * Math.PI * 620 * t)) * 0.4;
            }
        }
        
        return this.bufferToWave(buffer, buffer.length);
    }

    /**
     * Create ring tone
     */
    createRingTone(audioContext) {
        const duration = 2;
        const sampleRate = audioContext.sampleRate;
        const buffer = audioContext.createBuffer(1, duration * sampleRate, sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < buffer.length; i++) {
            const t = i / sampleRate;
            // 440Hz sine wave with fade in/out
            const envelope = Math.min(t * 10, 1) * Math.min((duration - t) * 10, 1);
            data[i] = Math.sin(2 * Math.PI * 440 * t) * envelope * 0.5;
        }
        
        return this.bufferToWave(buffer, buffer.length);
    }

    /**
     * Convert AudioBuffer to WAV data URL
     */
    bufferToWave(buffer, len) {
        const numOfChan = buffer.numberOfChannels;
        const length = len * numOfChan * 2 + 44;
        const bufferArray = new ArrayBuffer(length);
        const view = new DataView(bufferArray);
        const channels = [];
        let offset = 0;
        let pos = 0;

        // Write WAV header
        const setUint16 = (data) => {
            view.setUint16(pos, data, true);
            pos += 2;
        };
        const setUint32 = (data) => {
            view.setUint32(pos, data, true);
            pos += 4;
        };

        setUint32(0x46464952); // "RIFF"
        setUint32(length - 8); // file length - 8
        setUint32(0x45564157); // "WAVE"
        setUint32(0x20746d66); // "fmt " chunk
        setUint32(16); // length = 16
        setUint16(1); // PCM (uncompressed)
        setUint16(numOfChan);
        setUint32(buffer.sampleRate);
        setUint32(buffer.sampleRate * 2 * numOfChan);
        setUint16(numOfChan * 2);
        setUint16(16);
        setUint32(0x61746164); // "data" - chunk
        setUint32(length - pos - 4);

        // Write interleaved data
        for (let i = 0; i < buffer.numberOfChannels; i++) {
            channels.push(buffer.getChannelData(i));
        }

        while (pos < length) {
            for (let i = 0; i < numOfChan; i++) {
                let sample = Math.max(-1, Math.min(1, channels[i][offset]));
                sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16(pos, sample, true);
                pos += 2;
            }
            offset++;
        }

        const blob = new Blob([bufferArray], { type: 'audio/wav' });
        return URL.createObjectURL(blob);
    }

    /**
     * Play ringback tone
     */
    playRingbackTone() {
        this.stopAllTones();
        console.log('🔊 Playing ringback tone');
        this.ringbackTone.play().catch(e => console.warn('Could not play ringback tone:', e));
    }

    /**
     * Play busy tone
     */
    playBusyTone() {
        this.stopAllTones();
        console.log('🔊 Playing busy tone');
        this.busyTone.play().catch(e => console.warn('Could not play busy tone:', e));
    }

    /**
     * Play ring tone
     */
    playRingTone() {
        this.stopAllTones();
        console.log('🔊 Playing ring tone');
        this.ringTone.play().catch(e => console.warn('Could not play ring tone:', e));
    }

    /**
     * Stop all tones
     */
    stopAllTones() {
        try {
            this.ringbackTone.pause();
            this.ringbackTone.currentTime = 0;
            this.busyTone.pause();
            this.busyTone.currentTime = 0;
            this.ringTone.pause();
            this.ringTone.currentTime = 0;
        } catch (e) {
            console.warn('Could not stop tones:', e);
        }
    }

    /**
     * Initialize SIP User Agent with SIP.js
     */
    async initialize() {
        try {
            console.log('🔧 VoIP SIP Client Debug: Initializing...');
            console.log('Initializing VoIP SIP client with SIP.js...');
            
            // Check WebRTC support
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('WebRTC is not supported. Please use HTTPS and a modern browser.');
            }

            // Build WebSocket URI
            let wsUri = this.config.server.websocket_url;
            
            if (!wsUri) {
                // Auto-detect protocol based on use_tls
                const protocol = this.config.server.use_tls ? 'wss' : 'ws';
                const port = this.config.server.use_tls 
                    ? (this.config.server.secure_port || 8089) 
                    : (this.config.server.port || 8088);
                wsUri = `${protocol}://${this.config.server.host}:${port}/ws`;
            }

            // Build SIP URI
            const sipUri = `sip:${this.config.user.username}@${this.config.server.realm || this.config.server.host}`;

            console.log('🔌 Connecting to:', wsUri);
            console.log('📞 SIP URI:', sipUri);
            console.log('🔒 TLS:', this.config.server.use_tls ? 'Enabled' : 'Disabled');

            // Configure ICE servers (STUN/TURN)
            const iceServers = this.getIceServers();

            // Create User Agent options
            const userAgentOptions = {
                uri: window.SIP.UserAgent.makeURI(sipUri),
                transportOptions: {
                    server: wsUri,
                    connectionTimeout: 15,
                    keepAliveInterval: 30,
                },
                authorizationUsername: this.config.user.username,
                authorizationPassword: this.config.user.password,
                displayName: this.config.user.display_name || this.config.user.username,
                sessionDescriptionHandlerFactoryOptions: {
                    peerConnectionConfiguration: {
                        iceServers: iceServers,
                        rtcpMuxPolicy: 'require',
                        bundlePolicy: 'max-bundle',
                        iceTransportPolicy: 'all',
                    },
                    iceGatheringTimeout: 500,  // Reduced from 5000ms to 500ms for faster calls
                },
                delegate: {
                    onInvite: (invitation) => {
                        console.log('Incoming call from:', invitation.remoteIdentity.uri.user);
                        this.handleIncomingCall(invitation);
                    },
                    onMessage: (message) => {
                        console.log('Incoming message:', message);
                    },
                },
                autoStart: false,
                autoStop: false,
                register: false,
                noAnswerTimeout: 60,
            };

            // Create User Agent
            this.userAgent = new window.SIP.UserAgent(userAgentOptions);

            // Setup transport event handlers
            this.userAgent.transport.onConnect = () => {
                console.log('✅ Connected to WebSocket server');
                console.log('🔧 VoIP SIP Client Debug: Transport connected');
                this.onTransportConnected();
            };

            this.userAgent.transport.onDisconnect = (error) => {
                if (error) {
                    console.error('❌ WebSocket connection error:', error);
                    this.onTransportError(error);
                } else {
                    console.log('WebSocket disconnected');
                    this.onTransportDisconnected();
                }
            };

            // Start the user agent (connect to WebSocket)
            await this.userAgent.start();

            // Wait for connection
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Connection timeout'));
                }, 15000);

                const checkConnection = setInterval(() => {
                    if (this.userAgent.transport.state === window.SIP.TransportState.Connected) {
                        clearTimeout(timeout);
                        clearInterval(checkConnection);
                        resolve();
                    }
                }, 100);
            });

            // Register with server
            await this.register();

            console.log('✅ VoIP client initialized successfully');
            return true;

        } catch (error) {
            console.error('❌ Failed to initialize VoIP client:', error);
            
            // Provide helpful error messages
            let friendlyError = error;
            
            if (error.message && error.message.includes('1006')) {
                // WebSocket connection failed
                friendlyError = new Error(
                    'Failed to connect to VoIP server. Possible causes:\n' +
                    '1. Server is offline or unreachable\n' +
                    '2. SSL certificate expired or invalid\n' +
                    '3. Firewall blocking connection\n' +
                    '4. Wrong WebSocket URL or port\n\n' +
                    'Please check your VoIP server configuration.'
                );
            } else if (error.message && error.message.includes('timeout')) {
                friendlyError = new Error(
                    'Connection timeout. The VoIP server did not respond within 15 seconds.\n' +
                    'Please check if the server is online and accessible.'
                );
            }
            
            throw friendlyError;
        }
    }

    /**
     * Get ICE servers configuration
     */
    getIceServers() {
        const iceServers = [];

        // Add STUN server
        if (this.config.server.stun_server) {
            iceServers.push({
                urls: this.config.server.stun_server
            });
        } else {
            // Default Google STUN server
            iceServers.push({
                urls: 'stun:stun.l.google.com:19302'
            });
        }

        // Add TURN server if configured
        if (this.config.server.turn_server && this.config.server.turn_username) {
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
            if (!this.userAgent) {
                throw new Error('User Agent not initialized');
            }

            console.log('📞 Registering with SIP server...');

            // Create registerer
            const registererOptions = {
                expires: 300, // 5 minutes
                refreshFrequency: 75, // Re-register at 75% of expiration
            };

            this.userAgent.registerer = new window.SIP.Registerer(this.userAgent, registererOptions);

            // Setup state change listener
            this.userAgent.registerer.stateChange.addListener((state) => {
                console.log('Registration state:', state);
                switch (state) {
                    case window.SIP.RegistererState.Registered:
                        console.log('✅ Registered successfully');
                        this.isRegistered = true;
                        console.log('🔧 VoIP SIP Client Debug: Registration status updated to:', this.isRegistered);
                        this.onRegistered();
                        break;
                    case window.SIP.RegistererState.Unregistered:
                        console.log('Unregistered');
                        this.isRegistered = false;
                        this.onUnregistered();
                        break;
                    case window.SIP.RegistererState.Terminated:
                        console.log('Registration terminated');
                        this.isRegistered = false;
                        break;
                }
            });

            // Send REGISTER
            await this.userAgent.registerer.register({
                requestDelegate: {
                    onReject: (response) => {
                        console.error('❌ Registration rejected:', response.message.reasonPhrase);
                        throw new Error(`Registration failed: ${response.message.reasonPhrase}`);
                    },
                    onAccept: (response) => {
                        console.log('✅ Registration accepted');
                    }
                }
            });

            return true;

        } catch (error) {
            console.error('❌ Registration failed:', error);
            throw error;
        }
    }

    /**
     * Make an outbound call
     */
    async makeCall(phoneNumber) {
        const startTime = Date.now();
        console.log('🔧 VoIP SIP Client Debug: ===== MAKE CALL START =====', new Date().toISOString());
        console.log('🔧 VoIP SIP Client Debug: Phone number:', phoneNumber);
        console.log('🔧 VoIP SIP Client Debug: Odoo call ID BEFORE makeCall:', this.odooCallId);
        
        try {
            if (!this.userAgent || !this.isRegistered) {
                throw new Error('Not registered with SIP server');
            }

            console.log('📞 Making call to:', phoneNumber);
            console.log('⏱️ Time elapsed:', Date.now() - startTime, 'ms');

            // Build target URI
            console.log('⏱️ Building target URI...', Date.now() - startTime, 'ms');
            const targetUri = window.SIP.UserAgent.makeURI(
                `sip:${phoneNumber}@${this.config.server.realm || this.config.server.host}`
            );

            if (!targetUri) {
                throw new Error('Invalid phone number or server configuration');
            }
            console.log('⏱️ Target URI built:', Date.now() - startTime, 'ms');

            // Create inviter (outbound session)
            console.log('⏱️ Creating inviter...', Date.now() - startTime, 'ms');
            const inviter = new window.SIP.Inviter(this.userAgent, targetUri, {
                sessionDescriptionHandlerOptions: {
                    constraints: {
                        audio: true,
                        video: false
                    },
                    iceGatheringTimeout: 500  // Limit ICE gathering to 500ms
                }
            });
            console.log('⏱️ Inviter created:', Date.now() - startTime, 'ms');

            // Setup session event handlers
            this.setupSessionHandlers(inviter);
            console.log('⏱️ Session handlers setup:', Date.now() - startTime, 'ms');

            // Play ringback tone when call starts
            this.playRingbackTone();
            console.log('⏱️ Ringback tone started:', Date.now() - startTime, 'ms');

            // Variable to store rejection error
            let callRejected = false;
            let rejectionError = null;

            // Send INVITE
            console.log('⏱️ Sending INVITE...', Date.now() - startTime, 'ms');
            await inviter.invite({
                requestDelegate: {
                    onReject: (response) => {
                        const reasonPhrase = response.message.reasonPhrase || 'Unknown error';
                        const statusCode = response.message.statusCode;
                        
                        console.log('Call rejected:', reasonPhrase, 'Status:', statusCode);
                        
                        // Stop ringback and play busy tone
                        this.stopAllTones();
                        if (statusCode === 486 || statusCode === 503 || statusCode === 600) {
                            this.playBusyTone();
                        }
                        
                        // Store rejection info
                        callRejected = true;
                        
                        // Provide user-friendly error messages
                        if (statusCode === 503) {
                            rejectionError = 'Service Unavailable';
                        } else if (statusCode === 486) {
                            rejectionError = 'Busy Here';
                        } else if (statusCode === 404) {
                            rejectionError = 'Not Found';
                        } else if (statusCode === 408) {
                            rejectionError = 'Request Timeout';
                        } else if (statusCode === 480) {
                            rejectionError = 'Temporarily Unavailable';
                        } else {
                            rejectionError = reasonPhrase;
                        }
                        
                        console.log('🔊 Call rejected - busy tone playing');
                    }
                }
            });

            console.log('⏱️ INVITE sent, waiting for response...', Date.now() - startTime, 'ms');

            // Check if call was rejected
            if (callRejected) {
                console.log('⏱️ Call rejected at:', Date.now() - startTime, 'ms');
                throw new Error(rejectionError);
            }

            this.currentSession = inviter;
            console.log('✅ Call initiated successfully');
            console.log('⏱️ TOTAL TIME TO INITIATE CALL:', Date.now() - startTime, 'ms');
            console.log('🔧 VoIP SIP Client Debug: Odoo call ID AFTER makeCall:', this.odooCallId);
            
            // Don't start recording here - it will be started in onCallEstablished
            console.log('🔧 VoIP SIP Client Debug: Recording will be started in onCallEstablished');
            console.log('🔧 VoIP SIP Client Debug: ===== MAKE CALL END =====');

            return true;

        } catch (error) {
            console.error('❌ Failed to make call:', error);
            
            // Stop ringback and play busy tone on error
            this.stopAllTones();
            
            // Check if it's a busy/unavailable error
            const errorMsg = error.message || '';
            if (errorMsg.includes('Busy') || errorMsg.includes('Unavailable') || errorMsg.includes('503') || errorMsg.includes('486')) {
                console.log('🔊 Playing busy tone due to error');
                this.playBusyTone();
            }
            
            throw this.formatError(error);
        }
    }

    /**
     * Handle incoming call
     */
    async handleIncomingCall(invitation) {
        console.log('📱 Incoming call from:', invitation.remoteIdentity.uri.user);
        console.log('🔧 VoIP SIP Client Debug: Handling incoming call');

        this.currentSession = invitation;

        // Play ring tone for incoming call
        this.playRingTone();
        console.log('🔊 Playing ring tone for incoming call');

        // Setup session event handlers
        this.setupSessionHandlers(invitation);

        // Notify user (this will be handled by voipService)
        if (this.voipService.onIncomingCall) {
            console.log('🔧 VoIP SIP Client Debug: Notifying voipService of incoming call');
            this.voipService.onIncomingCall({
                from: invitation.remoteIdentity.uri.user,
                displayName: invitation.remoteIdentity.displayName,
                session: invitation
            });
        }
    }

    /**
     * Start recording
     */
    async startRecording() {
        try {
            console.log('🔧 VoIP SIP Client Debug: Starting recording');
            console.log('🔧 VoIP SIP Client Debug: Current session:', this.currentSession);
            console.log('🔧 VoIP SIP Client Debug: Session ID:', this.currentSession ? this.currentSession.id : 'none');
            
            if (!this.currentSession) {
                throw new Error('No active call to record');
            }

            // Get local and remote streams
            const localStream = this.currentSession.sessionDescriptionHandler.getLocalStream();
            const remoteStream = this.currentSession.sessionDescriptionHandler.getRemoteStream();

            console.log('🔧 VoIP SIP Client Debug: Local stream:', localStream);
            console.log('🔧 VoIP SIP Client Debug: Remote stream:', remoteStream);
            console.log('🔧 VoIP SIP Client Debug: Local stream tracks:', localStream ? localStream.getTracks() : 'none');
            console.log('🔧 VoIP SIP Client Debug: Remote stream tracks:', remoteStream ? remoteStream.getTracks() : 'none');

            if (!localStream && !remoteStream) {
                console.error('🔧 VoIP SIP Client Debug: No streams available for recording');
                throw new Error('No audio streams available for recording');
            }

            // Create a mixed stream for recording
            let recordingStream;
            
            if (localStream && remoteStream) {
                console.log('🔧 VoIP SIP Client Debug: Mixing both streams');
                // Mix both streams
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const destination = audioContext.createMediaStreamDestination();
                
                const localSource = audioContext.createMediaStreamSource(localStream);
                const remoteSource = audioContext.createMediaStreamSource(remoteStream);
                
                localSource.connect(destination);
                remoteSource.connect(destination);
                
                recordingStream = destination.stream;
                console.log('🔧 VoIP SIP Client Debug: Mixed stream created:', recordingStream);
            } else if (localStream) {
                console.log('🔧 VoIP SIP Client Debug: Using local stream only');
                recordingStream = localStream;
            } else if (remoteStream) {
                console.log('🔧 VoIP SIP Client Debug: Using remote stream only');
                recordingStream = remoteStream;
            }

            if (recordingStream) {
                console.log('🔧 VoIP SIP Client Debug: Creating MediaRecorder with stream:', recordingStream);
                console.log('🔧 VoIP SIP Client Debug: Stream tracks:', recordingStream.getTracks());
                console.log('🔧 VoIP SIP Client Debug: Stream active:', recordingStream.active);
                
                try {
                    // Check if MediaRecorder supports the stream
                    if (MediaRecorder.isTypeSupported('audio/webm')) {
                        console.log('🔧 VoIP SIP Client Debug: Using audio/webm format');
                        this.mediaRecorder = new MediaRecorder(recordingStream, {
                            mimeType: 'audio/webm'
                        });
                    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
                        console.log('🔧 VoIP SIP Client Debug: Using audio/mp4 format');
                        this.mediaRecorder = new MediaRecorder(recordingStream, {
                            mimeType: 'audio/mp4'
                        });
                    } else {
                        console.log('🔧 VoIP SIP Client Debug: Using default format');
                        this.mediaRecorder = new MediaRecorder(recordingStream);
                    }
                    
                    this.recordedChunks = [];
                    console.log('🔧 VoIP SIP Client Debug: MediaRecorder created:', this.mediaRecorder);

                    this.mediaRecorder.ondataavailable = (event) => {
                        console.log('🔧 VoIP SIP Client Debug: Data available:', event.data.size, 'bytes');
                        console.log('🔧 VoIP SIP Client Debug: Data type:', event.data.type);
                        if (event.data.size > 0) {
                            this.recordedChunks.push(event.data);
                            console.log('🔧 VoIP SIP Client Debug: Total chunks:', this.recordedChunks.length);
                        }
                    };

                    this.mediaRecorder.onstop = () => {
                        console.log('🔧 VoIP SIP Client Debug: Recording stopped, saving...');
                        console.log('🔧 VoIP SIP Client Debug: Total chunks to save:', this.recordedChunks.length);
                        this.saveRecording();
                    };

                    this.mediaRecorder.onerror = (event) => {
                        console.error('🔧 VoIP SIP Client Debug: MediaRecorder error:', event.error);
                    };

                    this.mediaRecorder.start(1000); // Record in 1-second chunks
                    console.log('🔧 VoIP SIP Client Debug: Recording started successfully');
                    console.log('🔧 VoIP SIP Client Debug: MediaRecorder state:', this.mediaRecorder.state);
                    
                } catch (recorderError) {
                    console.error('🔧 VoIP SIP Client Debug: MediaRecorder failed, trying fallback:', recorderError);
                    
                    // Fallback: Use getUserMedia to record system audio
                    try {
                        console.log('🔧 VoIP SIP Client Debug: Trying fallback recording...');
                        const fallbackStream = await navigator.mediaDevices.getUserMedia({ 
                            audio: {
                                echoCancellation: false,
                                noiseSuppression: false,
                                autoGainControl: false
                            } 
                        });
                        
                        console.log('🔧 VoIP SIP Client Debug: Fallback stream created:', fallbackStream);
                        this.mediaRecorder = new MediaRecorder(fallbackStream);
                        this.recordedChunks = [];

                        this.mediaRecorder.ondataavailable = (event) => {
                            console.log('🔧 VoIP SIP Client Debug: Fallback data available:', event.data.size, 'bytes');
                            if (event.data.size > 0) {
                                this.recordedChunks.push(event.data);
                            }
                        };

                        this.mediaRecorder.onstop = () => {
                            console.log('🔧 VoIP SIP Client Debug: Fallback recording stopped');
                            this.saveRecording();
                        };

                        this.mediaRecorder.start(1000);
                        console.log('🔧 VoIP SIP Client Debug: Fallback recording started');
                        
                    } catch (fallbackError) {
                        console.error('🔧 VoIP SIP Client Debug: Fallback recording failed:', fallbackError);
                        throw new Error('Recording not supported on this device');
                    }
                }
            }

        } catch (error) {
            console.error('🔧 VoIP SIP Client Debug: Failed to start recording:', error);
            throw error;
        }
    }

    /**
     * Save recording to server
     */
    async saveRecording() {
        console.log('🔧 VoIP SIP Client Debug: ===== SAVE RECORDING CALLED =====');
        console.log('🔧 VoIP SIP Client Debug: Recorded chunks available:', this.recordedChunks ? this.recordedChunks.length : 'none');
        console.log('🔧 VoIP SIP Client Debug: Odoo call ID:', this.odooCallId);
        console.log('🔧 VoIP SIP Client Debug: Current session:', this.currentSession);
        console.log('🔧 VoIP SIP Client Debug: Recording saved flag:', this.recordingSaved);
        console.log('🔧 VoIP SIP Client Debug: Recording saving in progress:', this.recordingSaving);
        
        try {
            // Check if already saved OR currently saving
            if (this.recordingSaved || this.recordingSaving) {
                console.log('🔧 VoIP SIP Client Debug: Recording already saved or saving in progress - EXITING to prevent duplicate');
                console.log('🔧 VoIP SIP Client Debug: recordingSaved:', this.recordingSaved);
                console.log('🔧 VoIP SIP Client Debug: recordingSaving:', this.recordingSaving);
                return;
            }
            
            if (this.recordedChunks.length === 0) {
                console.log('🔧 VoIP SIP Client Debug: No recording data to save - EXITING');
                return;
            }
            
            // Mark as saving IMMEDIATELY to prevent duplicate calls (race condition protection)
            this.recordingSaving = true;
            console.log('🔧 VoIP SIP Client Debug: Set recordingSaving flag to LOCK this operation');

            console.log('🔧 VoIP SIP Client Debug: ===== PROCEEDING WITH SAVE =====');
            console.log('🔧 VoIP SIP Client Debug: Saving recording to server');
            console.log('🔧 VoIP SIP Client Debug: Recording chunks:', this.recordedChunks.length);
            console.log('🔧 VoIP SIP Client Debug: Call ID:', this.currentSession ? this.currentSession.id : 'unknown');
            
            // Calculate duration
            let duration = this.getCallDuration();
            console.log('⏱️ VoIP SIP Client Debug: callStartTime:', this.callStartTime);
            console.log('⏱️ VoIP SIP Client Debug: callEndTime:', this.callEndTime);
            console.log('⏱️ VoIP SIP Client Debug: Current time:', Date.now());
            console.log('⏱️ VoIP SIP Client Debug: Calculated duration:', duration, 'seconds');
            
            // Fallback: estimate duration from recording size if callStartTime was not set
            if (duration === 0 && this.recordedChunks.length > 0) {
                // Rough estimate: 1 second of recording ≈ 8-16 KB (depending on quality)
                const totalSize = this.recordedChunks.reduce((sum, chunk) => sum + chunk.size, 0);
                duration = Math.max(1, Math.floor(totalSize / 10000)); // Conservative estimate
                console.log('⚠️ VoIP SIP Client Debug: callStartTime was not set, estimated duration from recording size:', duration, 'seconds');
            }
            
            const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
            console.log('🔧 VoIP SIP Client Debug: Blob size:', blob.size, 'bytes');
            
            const formData = new FormData();
            formData.append('recording', blob, `call_${Date.now()}.webm`);
            // Use Odoo call ID instead of SIP session ID
            const callId = this.odooCallId || (this.currentSession ? this.currentSession.id : 'unknown');
            formData.append('call_id', callId);
            formData.append('duration', duration);
            
            console.log('🔧 VoIP SIP Client Debug: Using call ID:', callId);
            console.log('🔧 VoIP SIP Client Debug: Odoo call ID:', this.odooCallId);
            console.log('🔧 VoIP SIP Client Debug: SIP session ID:', this.currentSession ? this.currentSession.id : 'none');

            console.log('🔧 VoIP SIP Client Debug: ===== SAVE RECORDING START =====');
            console.log('🔧 VoIP SIP Client Debug: Sending to server...');
            console.log('🔧 VoIP SIP Client Debug: URL: /voip_webrtc_freepbx/save_recording');
            console.log('🔧 VoIP SIP Client Debug: FormData entries:');
            for (let [key, value] of formData.entries()) {
                console.log('🔧 VoIP SIP Client Debug: -', key, ':', value);
            }
            
            // Send to Odoo server
            // Note: Don't set CSRF token manually - Odoo route has csrf=False
            const response = await fetch('/voip_webrtc_freepbx/save_recording', {
                method: 'POST',
                body: formData
            });

            console.log('🔧 VoIP SIP Client Debug: Server response received');
            console.log('🔧 VoIP SIP Client Debug: Response status:', response.status);
            console.log('🔧 VoIP SIP Client Debug: Response statusText:', response.statusText);
            console.log('🔧 VoIP SIP Client Debug: Response headers:', Object.fromEntries(response.headers.entries()));

            if (response.ok) {
                console.log('🔧 VoIP SIP Client Debug: Recording saved successfully!');
                const result = await response.json();
                console.log('🔧 VoIP SIP Client Debug: Server response:', result);
                console.log('🔧 VoIP SIP Client Debug: Recording ID:', result.recording_id);
                console.log('🔧 VoIP SIP Client Debug: Success message:', result.message);
                
                // Mark as saved after successful save
                this.recordingSaved = true;
                console.log('🔧 VoIP SIP Client Debug: Set recordingSaved = true after successful save');
            } else {
                console.error('🔧 VoIP SIP Client Debug: Server error occurred');
                console.error('🔧 VoIP SIP Client Debug: Status:', response.status);
                const errorText = await response.text();
                console.error('🔧 VoIP SIP Client Debug: Error text:', errorText);
                throw new Error(`Server error: ${response.status} - ${errorText}`);
            }

            console.log('🔧 VoIP SIP Client Debug: ===== SAVE RECORDING END =====');

        } catch (error) {
            console.error('🔧 VoIP SIP Client Debug: Failed to save recording:', error);
            console.error('🔧 VoIP SIP Client Debug: Error details:', error.message);
        } finally {
            // Always unlock the saving flag to allow retry on error
            this.recordingSaving = false;
            console.log('🔧 VoIP SIP Client Debug: Released recordingSaving lock');
        }
    }

    /**
     * Get call duration
     */
    getCallDuration() {
        if (this.callStartTime) {
            return Math.floor((Date.now() - this.callStartTime) / 1000);
        }
        return 0;
    }

    /**
     * Answer incoming call
     */
    async answerCall() {
        try {
            if (!this.currentSession) {
                throw new Error('No incoming call to answer');
            }

            console.log('✅ Answering call...');

            await this.currentSession.accept({
                sessionDescriptionHandlerOptions: {
                    constraints: {
                        audio: true,
                        video: false
                    }
                }
            });

            console.log('✅ Call answered');
            
            // Don't start recording here - it will be started in onCallEstablished
            console.log('🔧 VoIP SIP Client Debug: Recording will be started in onCallEstablished');
            return true;

        } catch (error) {
            console.error('❌ Failed to answer call:', error);
            throw this.formatError(error);
        }
    }

    /**
     * Hang up current call
     */
    async hangup() {
        try {
            if (!this.currentSession) {
                console.log('No active call to hang up');
                return false;
            }

            console.log('📴 Hanging up call...');

            // Stop recording if active
            this.stopRecording();

            // Clean up media
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => track.stop());
                this.localStream = null;
            }

            // Terminate session
            const state = this.currentSession.state;
            
            if (state === window.SIP.SessionState.Initial || 
                state === window.SIP.SessionState.Establishing) {
                // Cancel outgoing call
                await this.currentSession.cancel();
            } else if (state === window.SIP.SessionState.Established) {
                // Hang up established call
                await this.currentSession.bye();
            } else {
                // Reject incoming call
                await this.currentSession.reject();
            }

            this.currentSession = null;
            console.log('✅ Call ended');

            return true;

        } catch (error) {
            console.error('Failed to hang up:', error);
            this.currentSession = null;
            return false;
        }
    }

    /**
     * Setup session event handlers
     */
    setupSessionHandlers(session) {
        // Session state changes
        session.stateChange.addListener((state) => {
            console.log('Session state:', state);
            
            switch (state) {
                case window.SIP.SessionState.Establishing:
                    console.log('Call establishing...');
                    break;
                case window.SIP.SessionState.Established:
                    console.log('✅ Call established');
                    this.onCallEstablished(session);
                    break;
                case window.SIP.SessionState.Terminated:
                    console.log('Call terminated');
                    this.onCallTerminated(session);
                    break;
            }
        });
    }

    /**
     * Handle call established
     */
    onCallEstablished(session) {
        console.log('🔧 VoIP SIP Client Debug: ===== CALL ESTABLISHED =====');
        console.log('🔧 VoIP SIP Client Debug: Session:', session);
        console.log('🔧 VoIP SIP Client Debug: Session ID:', session ? session.id : 'none');
        console.log('🔧 VoIP SIP Client Debug: Config user enable_recording:', this.config.user.enable_recording);
        
        // Record call start time for duration calculation
        this.callStartTime = Date.now();
        console.log('⏱️ Call start time recorded:', this.callStartTime);
        
        // Stop all tones when call is established
        this.stopAllTones();
        console.log('🔊 Call established - stopped all tones');
        
        // Setup remote audio
        const sessionDescriptionHandler = session.sessionDescriptionHandler;
        console.log('🔧 VoIP SIP Client Debug: SessionDescriptionHandler:', sessionDescriptionHandler);
        console.log('🔧 VoIP SIP Client Debug: PeerConnection:', sessionDescriptionHandler ? sessionDescriptionHandler.peerConnection : 'none');
        
        if (sessionDescriptionHandler && sessionDescriptionHandler.peerConnection) {
            const remoteStream = new MediaStream();
            
            sessionDescriptionHandler.peerConnection.getReceivers().forEach((receiver) => {
                if (receiver.track) {
                    remoteStream.addTrack(receiver.track);
                }
            });

            console.log('🔧 VoIP SIP Client Debug: Remote stream created:', remoteStream);
            this.remoteAudio.srcObject = remoteStream;
            this.remoteAudio.play().catch(e => console.error('Error playing audio:', e));

            // Get local stream for recording
            sessionDescriptionHandler.peerConnection.getSenders().forEach((sender) => {
                if (sender.track && sender.track.kind === 'audio') {
                    this.localStream = new MediaStream([sender.track]);
                    console.log('🔧 VoIP SIP Client Debug: Local stream created:', this.localStream);
                }
            });

            console.log('🔧 VoIP SIP Client Debug: Local stream:', this.localStream);
            console.log('🔧 VoIP SIP Client Debug: Local stream tracks:', this.localStream ? this.localStream.getTracks() : 'none');

            // Start recording if enabled
            if (this.config.user.enable_recording && this.localStream) {
                console.log('🔧 VoIP SIP Client Debug: Starting recording with local stream...');
                console.log('🔧 VoIP SIP Client Debug: Odoo call ID before recording:', this.odooCallId);
                this.startRecording(this.localStream);
            } else {
                console.log('🔧 VoIP SIP Client Debug: Recording not started - enable_recording:', this.config.user.enable_recording, 'localStream:', !!this.localStream);
            }
        }

        // Notify service
        if (this.voipService.onCallEstablished) {
            this.voipService.onCallEstablished(session);
        }
        
        console.log('🔧 VoIP SIP Client Debug: ===== CALL ESTABLISHED END =====');
    }

    /**
     * Handle call terminated
     */
    onCallTerminated(session) {
        console.log('🔧 VoIP SIP Client Debug: ===== CALL TERMINATED =====');
        console.log('🔧 VoIP SIP Client Debug: Session:', session);
        console.log('🔧 VoIP SIP Client Debug: Session ID:', session ? session.id : 'none');
        console.log('🔧 VoIP SIP Client Debug: Current session:', this.currentSession);
        console.log('🔧 VoIP SIP Client Debug: ***** Odoo call ID at termination:', this.odooCallId);
        
        // Record call end time and log duration
        this.callEndTime = Date.now();
        const duration = this.getCallDuration();
        console.log('⏱️ Call end time recorded:', this.callEndTime);
        console.log('⏱️ Call start time:', this.callStartTime);
        console.log('⏱️ Call duration:', duration, 'seconds');
        
        // Stop all tones when call terminates
        this.stopAllTones();
        console.log('🔊 Call terminated - stopped all tones');
        console.log('🔧 VoIP SIP Client Debug: MediaRecorder:', this.mediaRecorder);
        console.log('🔧 VoIP SIP Client Debug: MediaRecorder state:', this.mediaRecorder ? this.mediaRecorder.state : 'none');
        console.log('🔧 VoIP SIP Client Debug: Recorded chunks:', this.recordedChunks ? this.recordedChunks.length : 'none');
        
        console.log('🔧 VoIP SIP Client Debug: Stopping recording with duration:', duration, 'seconds');
        // Stop recording
        this.stopRecording();

        console.log('🔧 VoIP SIP Client Debug: Cleaning up streams...');
        // Clean up streams
        if (this.localStream) {
            console.log('🔧 VoIP SIP Client Debug: Stopping local stream tracks');
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        if (this.remoteAudio.srcObject) {
            console.log('🔧 VoIP SIP Client Debug: Clearing remote audio');
            this.remoteAudio.srcObject = null;
        }

        console.log('🔧 VoIP SIP Client Debug: Clearing current session...');
        this.currentSession = null;
        
        // Reset call timing and recording state
        console.log('⏱️ Resetting call timing and recording variables');
        this.callStartTime = null;
        this.callEndTime = null;
        this.recordingSaved = false;
        this.recordingSaving = false;
        console.log('🔧 VoIP SIP Client Debug: Reset recording flags for next call');

        console.log('🔧 VoIP SIP Client Debug: Notifying service...');
        // Notify service
        if (this.voipService.onCallTerminated) {
            this.voipService.onCallTerminated(session);
        }
        
        console.log('🔧 VoIP SIP Client Debug: ===== CALL TERMINATED END =====');
    }

    /**
     * Start recording the call
     */
    startRecording(stream) {
        try {
            console.log('🔧 VoIP SIP Client Debug: ===== START RECORDING (OLD METHOD) =====');
            console.log('🔧 VoIP SIP Client Debug: Stream:', stream);
            console.log('🔧 VoIP SIP Client Debug: Stream tracks:', stream ? stream.getTracks() : 'none');
            console.log('🔧 VoIP SIP Client Debug: Stream active:', stream ? stream.active : 'none');
            
            // Reset recording state
            this.recordedChunks = [];
            this.recordingSaved = false;
            this.recordingSaving = false;
            console.log('🔧 VoIP SIP Client Debug: Reset recording flags for new recording');

            // Create MediaRecorder
            const options = MediaRecorder.isTypeSupported('audio/webm') 
                ? { mimeType: 'audio/webm' }
                : { mimeType: 'audio/ogg' };

            console.log('🔧 VoIP SIP Client Debug: MediaRecorder options:', options);
            this.mediaRecorder = new MediaRecorder(stream, options);
            console.log('🔧 VoIP SIP Client Debug: MediaRecorder created:', this.mediaRecorder);

            this.mediaRecorder.ondataavailable = (event) => {
                console.log('🔧 VoIP SIP Client Debug: Data available:', event.data.size, 'bytes');
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                    console.log('🔧 VoIP SIP Client Debug: Total chunks:', this.recordedChunks.length);
                }
            };

            this.mediaRecorder.onstop = () => {
                console.log('🔧 VoIP SIP Client Debug: ===== ONSTOP EVENT FIRED =====');
                console.log('🔧 VoIP SIP Client Debug: MediaRecorder stopped, saving...');
                console.log('🔧 VoIP SIP Client Debug: Total chunks collected:', this.recordedChunks.length);
                console.log('🔧 VoIP SIP Client Debug: Odoo call ID at onstop:', this.odooCallId);
                console.log('🔧 VoIP SIP Client Debug: Current session at onstop:', this.currentSession);
                console.log('🔧 VoIP SIP Client Debug: Calling saveRecording...');
                this.saveRecording();
                console.log('🔧 VoIP SIP Client Debug: ===== ONSTOP EVENT END =====');
            };

            this.mediaRecorder.onerror = (event) => {
                console.error('🔧 VoIP SIP Client Debug: MediaRecorder error:', event.error);
            };

            this.mediaRecorder.start(1000); // Collect data every second
            console.log('🔴 Recording started');
            console.log('🔧 VoIP SIP Client Debug: MediaRecorder state:', this.mediaRecorder.state);
            console.log('🔧 VoIP SIP Client Debug: ===== START RECORDING END =====');

        } catch (error) {
            console.error('🔧 VoIP SIP Client Debug: Failed to start recording:', error);
        }
    }

    /**
     * Stop recording
     */
    stopRecording() {
        console.log('🔧 VoIP SIP Client Debug: ===== STOP RECORDING =====');
        console.log('🔧 VoIP SIP Client Debug: MediaRecorder:', this.mediaRecorder);
        console.log('🔧 VoIP SIP Client Debug: MediaRecorder state:', this.mediaRecorder ? this.mediaRecorder.state : 'none');
        console.log('🔧 VoIP SIP Client Debug: Recorded chunks:', this.recordedChunks ? this.recordedChunks.length : 'none');
        console.log('🔧 VoIP SIP Client Debug: Odoo call ID at stop:', this.odooCallId);
        
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            console.log('🔧 VoIP SIP Client Debug: Stopping MediaRecorder...');
            console.log('🔧 VoIP SIP Client Debug: This will trigger onstop event...');
            this.mediaRecorder.stop();
            console.log('⏹️ Recording stopped');
            console.log('🔧 VoIP SIP Client Debug: Waiting for onstop event to fire...');
        } else {
            console.log('🔧 VoIP SIP Client Debug: MediaRecorder is not active or not available');
            console.log('🔧 VoIP SIP Client Debug: Manually calling saveRecording because MediaRecorder is inactive...');
            // If MediaRecorder is already inactive, we still need to save
            if (this.recordedChunks && this.recordedChunks.length > 0) {
                console.log('🔧 VoIP SIP Client Debug: Calling saveRecording directly...');
                this.saveRecording();
            }
        }
        
        console.log('🔧 VoIP SIP Client Debug: ===== STOP RECORDING END =====');
    }


    /**
     * Transport event handlers
     */
    onTransportConnected() {
        console.log('Transport connected');
    }

    onTransportDisconnected() {
        console.log('Transport disconnected');
        this.isRegistered = false;
    }

    onTransportError(error) {
        console.error('Transport error:', error);
        this.isRegistered = false;
    }

    /**
     * Registration event handlers
     */
    onRegistered() {
        console.log('SIP registration successful');
    }

    onUnregistered() {
        console.log('SIP unregistered');
    }

    /**
     * Disconnect and cleanup
     */
    async disconnect() {
        try {
            // Hang up any active call
            if (this.currentSession) {
                await this.hangup();
            }

            // Unregister
            if (this.userAgent && this.userAgent.registerer) {
                await this.userAgent.registerer.unregister();
            }

            // Stop user agent
            if (this.userAgent) {
                await this.userAgent.stop();
            }

            this.isRegistered = false;
            console.log('✅ VoIP client disconnected');

            return true;

        } catch (error) {
            console.error('Error disconnecting:', error);
            return false;
        }
    }

    /**
     * Format error messages
     */
    formatError(error) {
        if (error.name === 'NotAllowedError') {
            return new Error('Microphone access denied. Please allow microphone access.');
        } else if (error.name === 'NotFoundError') {
            return new Error('No microphone found. Please connect a microphone.');
        } else if (error.message && error.message.includes('HTTPS')) {
            return error;
        } else {
            return new Error(error.message || 'An error occurred');
        }
    }

    /**
     * Check if registered
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

